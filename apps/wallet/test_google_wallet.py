#!/usr/bin/env python3
"""Contract tests for the ZENO Google Wallet pass builder (no network, no secrets)."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import google_wallet as gw

HAVE_OPENSSL = shutil.which("openssl") is not None


class EncodingTest(unittest.TestCase):
    def test_b64url_roundtrip_unpadded(self):
        for raw in (b"", b"a", b"ab", b"abc", b"zeno://pay/cnt_0x71c8?bank=ZENO"):
            enc = gw.b64url_encode(raw)
            self.assertNotIn("=", enc)
            self.assertNotIn("+", enc)
            self.assertNotIn("/", enc)
            self.assertEqual(gw.b64url_decode(enc), raw)

    def test_sanitize_object_id(self):
        self.assertEqual(gw.sanitize_object_id("cnt_0x71c8"), "cnt_0x71c8")
        self.assertEqual(gw.sanitize_object_id("a/b c!"), "a_b_c")
        self.assertEqual(gw.sanitize_object_id("!!!"), "account")
        self.assertEqual(len(gw.sanitize_object_id("x" * 200)), 60)


class ClaimsTest(unittest.TestCase):
    ISSUER = "3388000000012345678"

    def test_class_id_uses_issuer_prefix(self):
        cls = gw.build_generic_class(self.ISSUER)
        self.assertEqual(cls["id"], f"{self.ISSUER}.{gw.CLASS_SUFFIX}")

    def test_object_references_class_and_barcode(self):
        obj = gw.build_generic_object(self.ISSUER, "cnt_0x71c8", "8b-is Crew", 4820 * 1_000_000)
        self.assertEqual(obj["classId"], f"{self.ISSUER}.{gw.CLASS_SUFFIX}")
        self.assertEqual(obj["id"], f"{self.ISSUER}.zeno_cnt_0x71c8")
        self.assertEqual(obj["barcode"]["type"], "QR_CODE")
        self.assertEqual(obj["barcode"]["value"], "zeno://pay/cnt_0x71c8?bank=ZENO")
        self.assertEqual(obj["header"]["defaultValue"]["value"], "¥4,820")

    def test_balance_is_micro_yen_and_rejects_negative(self):
        with self.assertRaises(ValueError):
            gw.build_generic_object(self.ISSUER, "a", balance_ujpy=-1)
        obj = gw.build_generic_object(self.ISSUER, "a", balance_ujpy=1_500_000)
        self.assertEqual(obj["header"]["defaultValue"]["value"], "¥1.50")

    def test_claims_shape_matches_google_contract(self):
        claims = gw.build_claims(
            "svc@example.iam.gserviceaccount.com",
            gw.build_generic_class(self.ISSUER),
            gw.build_generic_object(self.ISSUER, "cnt_0x71c8"),
        )
        self.assertEqual(claims["aud"], "google")
        self.assertEqual(claims["typ"], "savetowallet")
        self.assertIsInstance(claims["iat"], int)
        self.assertEqual(claims["origins"], ["https://zeno.vaked.dev"])
        self.assertEqual(len(claims["payload"]["genericClasses"]), 1)
        self.assertEqual(len(claims["payload"]["genericObjects"]), 1)


class ModeTest(unittest.TestCase):
    def test_unconfigured_returns_claims_and_missing_list(self):
        result = gw.build("cnt_0x71c8", issuer_id=None, service_account=None)
        self.assertEqual(result["mode"], "unconfigured")
        self.assertIn("GOOGLE_WALLET_ISSUER_ID", result["missing"])
        self.assertIn("genericObjects", result["claims"]["payload"])
        self.assertNotIn("saveUrl", result)

    def test_never_fabricates_a_jwt(self):
        result = gw.build("cnt_0x71c8", issuer_id=None, service_account=None)
        self.assertNotIn("jwt", result)

    def test_live_mode_with_injected_service_account(self):
        if not HAVE_OPENSSL:
            self.skipTest("openssl unavailable")
        key = _generate_key()
        result = gw.build(
            "cnt_0x71c8",
            issuer_id="3388000000012345678",
            service_account={
                "client_email": "svc@example.iam.gserviceaccount.com",
                "private_key": key,
            },
        )
        self.assertEqual(result["mode"], "live")
        self.assertTrue(result["saveUrl"].startswith(gw.SAVE_URL_PREFIX))
        self.assertEqual(result["jwt"].count("."), 2)


@unittest.skipUnless(HAVE_OPENSSL, "openssl unavailable")
class JwtSignatureTest(unittest.TestCase):
    def test_signature_verifies_with_public_key(self):
        private_pem = _generate_key()
        public_pem = subprocess.run(
            ["openssl", "pkey", "-pubout"],
            input=private_pem.encode(),
            capture_output=True,
            check=True,
        ).stdout

        claims = gw.build_claims(
            "svc@example.iam.gserviceaccount.com",
            gw.build_generic_class("3388000000012345678"),
            gw.build_generic_object("3388000000012345678", "cnt_0x71c8"),
        )
        token = gw.sign_jwt(claims, private_pem.encode())
        header_b64, payload_b64, sig_b64 = token.split(".")

        self.assertEqual(json.loads(gw.b64url_decode(header_b64)), {"alg": "RS256", "typ": "JWT"})
        self.assertEqual(json.loads(gw.b64url_decode(payload_b64))["aud"], "google")

        with tempfile.TemporaryDirectory() as tmp:
            pub = Path(tmp, "pub.pem")
            pub.write_bytes(public_pem)
            sig = Path(tmp, "sig.bin")
            sig.write_bytes(gw.b64url_decode(sig_b64))
            verify = subprocess.run(
                ["openssl", "dgst", "-sha256", "-verify", str(pub), "-signature", str(sig)],
                input=f"{header_b64}.{payload_b64}".encode(),
                capture_output=True,
                check=False,
            )
        self.assertEqual(verify.returncode, 0, verify.stderr.decode(errors="replace"))


def _generate_key() -> str:
    return subprocess.run(
        ["openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048"],
        capture_output=True,
        check=True,
    ).stdout.decode()


if __name__ == "__main__":
    unittest.main(verbosity=2)
