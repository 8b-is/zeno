"""
Security regression tests for /zeroize-audit findings ZA-0006 through ZA-0010.
"""

import ctypes
import gc
import hashlib
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

ZENO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ZENO_ROOT / "apps" / "wallet"))
sys.path.insert(0, str(ZENO_ROOT / "apps" / "cli"))

import generate_pass
import zeno_cli
from zeno_core.kompress import PackIntegrityError, pack, unpack
from zeno_core.ledger import AccountType, Posting, ZenoLedger
from zeno_core.stripe_bridge import StripeBridge


class TestZeroizeRemediation(unittest.TestCase):
    def test_za_0006_pkpass_encrypted_key_and_fail_closed(self):
        """ZA-0006: pass_key.pem is AES-256 encrypted and generate_signature fails closed."""
        with tempfile.TemporaryDirectory() as tmp:
            certs = Path(tmp) / "generated-certs"
            passphrase = "synthetic-fixture-only"
            _, key_path = generate_pass._ensure_encrypted_keypair(certs, passphrase)
            key_bytes = key_path.read_bytes()
            self.assertIn(b"-----BEGIN ENCRYPTED PRIVATE KEY-----", key_bytes)
            self.assertNotIn(b"-----BEGIN PRIVATE KEY-----", key_bytes)
            self.assertEqual(stat.S_IMODE(key_path.stat().st_mode), 0o600)
            wrong_password = subprocess.run(
                ["openssl", "pkey", "-in", str(key_path), "-passin", "pass:incorrect", "-noout"],
                capture_output=True, timeout=10,
            )
            self.assertNotEqual(wrong_password.returncode, 0)

            bad_certs = Path(tmp) / "certs"
            bad_certs.mkdir()
            (bad_certs / "pass_cert.pem").write_text("INVALID_CERT")
            (bad_certs / "pass_key.pem").write_text("INVALID_KEY")
            with self.assertRaises(RuntimeError):
                generate_pass.generate_signature(b'{"pass.json":"deadbeef"}', bad_certs)

    def test_za_0006_temporary_signature_verifies_and_reuses_key(self):
        """Sign only a synthetic manifest and verify its detached PKCS#7 signature."""
        manifest = b'{"synthetic.json":"fixture-only"}'
        with tempfile.TemporaryDirectory() as tmp:
            certs = Path(tmp) / "certs"
            with patch.dict(os.environ, {"ZENO_PASS_KEY_PASSPHRASE": "synthetic-fixture-only"}):
                signature = generate_pass.generate_signature(manifest, certs)
                original_key = (certs / "pass_key.pem").read_bytes()
                generate_pass.generate_signature(manifest, certs)
                self.assertEqual((certs / "pass_key.pem").read_bytes(), original_key)
            manifest_path = Path(tmp) / "manifest.json"
            signature_path = Path(tmp) / "signature.der"
            manifest_path.write_bytes(manifest)
            signature_path.write_bytes(signature)
            result = subprocess.run(
                ["openssl", "smime", "-verify", "-binary", "-inform", "DER",
                 "-in", str(signature_path), "-content", str(manifest_path), "-noverify"],
                capture_output=True, timeout=10,
            )
            self.assertEqual(result.returncode, 0, result.stderr.decode())
            self.assertEqual(result.stdout, manifest)

    def test_za_0007_stripe_webhook_secret_heap_scrubbed(self):
        """ZA-0007: Clearing StripeBridge.webhook_secret scrubs the CPython heap buffer."""
        ledger = ZenoLedger()
        dyn_secret = "whsec_zeno_sovereign_" + "stripe_test_secret_2026"
        bridge = StripeBridge(ledger, webhook_secret=dyn_secret)
        secret_addr = id(bridge.webhook_secret)

        bridge.webhook_secret = ""
        del dyn_secret
        del bridge
        gc.collect()

        raw_mem = ctypes.string_at(secret_addr, 128)
        self.assertNotIn(b"whsec_zeno_sovereign_stripe_test_secret_2026", raw_mem)

    def test_za_0008_payment_intent_client_secret_csprng(self):
        """ZA-0008: PaymentIntent.client_secret has independent CSPRNG entropy."""
        ledger = ZenoLedger()
        bridge = StripeBridge(ledger)
        intent = bridge.create_payment_intent(amount_cents=500000, currency="jpy")
        public_id = intent["id"]
        forged_24 = f"{public_id}_secret_{hashlib.sha256(public_id.encode()).hexdigest()[:24]}"
        forged_16 = f"{public_id}_secret_{hashlib.sha256(public_id.encode()).hexdigest()[:16]}"
        self.assertNotEqual(intent["client_secret"], forged_24)
        self.assertNotEqual(intent["client_secret"], forged_16)

    def test_za_0009_kompress_unpack_error_path_scrubs_raw(self):
        """ZA-0009: PackIntegrityError scrubs decompressed raw bytes from frame locals."""
        ledger = ZenoLedger()
        ledger.create_account("user:alice", "Alice Vault", AccountType.LIABILITY, "JPY", "0xAliceKey")
        ledger.record_transaction(
            postings=[
                Posting("asset:fiat:boj_escrow", 1_000_000, "JPY"),
                Posting("user:alice", -1_000_000, "JPY"),
            ],
            memo="TOP_SECRET_WITNESS_MEMO_2026",
            signature="0x-secret-witness-sig",
        )
        kp, _ = pack(ledger, window_size=8)
        tampered_win = replace(kp.windows[0], raw_sha256="0" * 64)
        tampered_pack = replace(kp, windows=(tampered_win,))

        try:
            unpack(tampered_pack)
            self.fail("Expected PackIntegrityError")
        except PackIntegrityError as exc:
            tb = exc.__traceback__
            while tb.tb_next is not None:
                tb = tb.tb_next
            leaked_raw = tb.tb_frame.f_locals.get("raw", b"")
            self.assertNotIn(b"TOP_SECRET_WITNESS_MEMO_2026", leaked_raw)
            self.assertEqual(leaked_raw, b"")

    def test_za_0010_cli_state_0600_and_redacted_pass_tokens(self):
        """ZA-0010: save_state enforces 0o600 permissions and pass*.json contain no hardcoded tokens."""
        for fname in ("pass.json", "pass_alexandra.json", "pass_chris.json", "pass_8b_is.json"):
            data = json.loads((ZENO_ROOT / "apps" / "wallet" / fname).read_text())
            self.assertEqual(data.get("authenticationToken"), "")

        orig_dir, orig_file = zeno_cli.STATE_DIR, zeno_cli.STATE_FILE
        try:
            with tempfile.TemporaryDirectory() as tmp:
                zeno_cli.STATE_DIR = Path(tmp) / ".zeno"
                zeno_cli.STATE_FILE = zeno_cli.STATE_DIR / "state.json"
                zeno_cli.save_state({"accounts": {"peter": {"balance": 9999}}})
                mode = stat.S_IMODE(os.stat(zeno_cli.STATE_FILE).st_mode)
                self.assertEqual(mode, 0o600)
        finally:
            zeno_cli.STATE_DIR, zeno_cli.STATE_FILE = orig_dir, orig_file


if __name__ == "__main__":
    unittest.main()
