#!/usr/bin/env python3
"""
ZENO → Google Wallet pass builder (Generic pass, "Add to Google Wallet").

Companion to generate_pass.py (Apple .pkpass). This module is the single source
of truth for the pass *payload*; the Cloudflare Worker re-implements the same
shape at runtime in deploy/build.mjs (so the live endpoint can sign without a
Python runtime). Keep the two in sync — the tests pin the contract.

Issuer onboarding (one-time, human steps):
  1. Create a Google Wallet API Issuer account:
     https://pay.google.com/business/console
  2. Create a Google Cloud service account and enable the Google Wallet API.
  3. Authorize the service account's client_email in the Business Console.
  4. Export the service account JSON key.

Then either:
  GOOGLE_WALLET_ISSUER_ID=3388000000012345678 \\
  GOOGLE_WALLET_SA_JSON=/path/to/service-account.json \\
  uv run python apps/wallet/google_wallet.py --account cnt_0x71c8 --holder "8b-is Crew"

or, for the live site, set the same two values as Worker secrets
(`wrangler secret put GOOGLE_WALLET_ISSUER_ID` / `GOOGLE_WALLET_SA_JSON`).

Nothing here embeds a private key. Without credentials the CLI prints the exact
claims it *would* sign plus `"mode": "unconfigured"` — never a fake pass.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

MICRO_YEN_PER_YEN = 1_000_000
SAVE_URL_PREFIX = "https://pay.google.com/gp/v/save/"
CLASS_SUFFIX = "zeno_aeon_pay"
MAX_SAFE_JWT_LEN = 1800  # Google's documented safe encoded-JWT length

# Card face mirrors the Apple pass (8b-is Crew, FeliCa transit rails).
HEX_BACKGROUND = "#07080b"
HEX_FOREGROUND = "#f5c451"


# --------------------------------------------------------------------------- #
# Encoding helpers
# --------------------------------------------------------------------------- #

def b64url_encode(data: bytes) -> str:
    """Unpadded base64url (RFC 7515 §2)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_decode(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def _localized(value: str, language: str = "en-US") -> dict[str, Any]:
    return {"defaultValue": {"language": language, "value": value}}


def sanitize_object_id(account_id: str) -> str:
    """
    Google object IDs allow [A-Za-z0-9._-] after the issuer prefix.
    Anything else would 400 on the API, so collapse it deterministically.
    """
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", account_id.strip())
    cleaned = cleaned.strip("._-") or "account"
    return cleaned[:60]


# --------------------------------------------------------------------------- #
# Pass construction
# --------------------------------------------------------------------------- #

def build_generic_class(issuer_id: str) -> dict[str, Any]:
    return {
        "id": f"{issuer_id}.{CLASS_SUFFIX}",
        "enableSmartTap": True,
    }


def build_generic_object(
    issuer_id: str,
    account_id: str,
    holder: str = "8b-is Crew",
    balance_ujpy: int | None = None,
    barcode_value: str | None = None,
) -> dict[str, Any]:
    if balance_ujpy is None:
        balance_ujpy = 4820 * MICRO_YEN_PER_YEN
    if not isinstance(balance_ujpy, int) or balance_ujpy < 0:
        raise ValueError("balance_ujpy must be a non-negative integer")

    barcode_value = barcode_value or f"zeno://pay/{account_id}?bank=ZENO"
    obj_id = f"{issuer_id}.zeno_{sanitize_object_id(account_id)}"
    yen = balance_ujpy / MICRO_YEN_PER_YEN

    return {
        "id": obj_id,
        "classId": f"{issuer_id}.{CLASS_SUFFIX}",
        "hexBackgroundColor": HEX_BACKGROUND,
        "cardTitle": _localized("ZENO 銭"),
        "header": _localized(f"¥{yen:,.0f}" if yen.is_integer() else f"¥{yen:,.2f}"),
        "subheader": _localized("Mobile PASMO · FeliCa NFC-F"),
        "logo": {
            "sourceUri": {"uri": "https://zeno.vaked.dev/icons/icon-192.png"}
        },
        "barcode": {
            "type": "QR_CODE",
            "value": barcode_value,
            "alternateText": account_id,
        },
        "textModulesData": [
            {"id": "holder", "header": "HOLDER", "body": holder},
            {"id": "rails", "header": "RAILS", "body": "FeliCa NFC-F · Kintsugi"},
        ],
    }


def build_claims(
    issuer_email: str,
    pass_class: dict[str, Any],
    pass_object: dict[str, Any],
    origins: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "iss": issuer_email,
        "aud": "google",
        "typ": "savetowallet",
        "iat": int(time.time()),
        "origins": origins if origins is not None else ["https://zeno.vaked.dev"],
        "payload": {
            "genericClasses": [pass_class],
            "genericObjects": [pass_object],
        },
    }


# --------------------------------------------------------------------------- #
# RS256 signing (openssl — no third-party Python deps)
# --------------------------------------------------------------------------- #

def _openssl_sign(message: bytes, private_key_pem: bytes) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".pem", delete=True) as keyfile:
        keyfile.write(private_key_pem)
        keyfile.flush()
        result = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", keyfile.name],
            input=message,
            capture_output=True,
            check=False,
        )
    if result.returncode != 0:
        raise RuntimeError(f"openssl signing failed: {result.stderr.decode(errors='replace')}")
    return result.stdout


def sign_jwt(claims: dict[str, Any], private_key_pem: bytes) -> str:
    header = b64url_encode(json.dumps({"alg": "RS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64url_encode(json.dumps(claims, separators=(",", ":"), ensure_ascii=False).encode())
    signing_input = f"{header}.{payload}".encode("ascii")
    signature = b64url_encode(_openssl_sign(signing_input, private_key_pem))
    return f"{header}.{payload}.{signature}"


def save_url(jwt: str) -> str:
    return SAVE_URL_PREFIX + jwt


def load_service_account(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    for field in ("client_email", "private_key"):
        if not data.get(field):
            raise ValueError(f"service account JSON missing '{field}'")
    return data


def build(
    account_id: str,
    holder: str = "8b-is Crew",
    balance_ujpy: int | None = None,
    issuer_id: str | None = None,
    service_account: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return a result dict: mode, claims (always), jwt/saveUrl when signable."""
    issuer_id = issuer_id or os.environ.get("GOOGLE_WALLET_ISSUER_ID")
    sa_path = os.environ.get("GOOGLE_WALLET_SA_JSON")

    if service_account is None and sa_path:
        service_account = load_service_account(sa_path)

    if not issuer_id or not service_account:
        # Still emit the exact payload so the shape is reviewable/testable.
        placeholder_issuer = issuer_id or "0"
        return {
            "mode": "unconfigured",
            "missing": [n for n, v in (("GOOGLE_WALLET_ISSUER_ID", issuer_id), ("GOOGLE_WALLET_SA_JSON", service_account)) if not v],
            "claims": build_claims(
                service_account.get("client_email", "unconfigured@example.invalid") if service_account else "unconfigured@example.invalid",
                build_generic_class(placeholder_issuer),
                build_generic_object(placeholder_issuer, account_id, holder, balance_ujpy),
            ),
        }

    claims = build_claims(
        service_account["client_email"],
        build_generic_class(issuer_id),
        build_generic_object(issuer_id, account_id, holder, balance_ujpy),
    )
    token = sign_jwt(claims, service_account["private_key"].encode())
    url = save_url(token)
    return {
        "mode": "live",
        "claims": claims,
        "jwt": token,
        "saveUrl": url,
        "jwtLength": len(token),
        "overLengthLimit": len(token) > MAX_SAFE_JWT_LEN,
    }


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build a ZENO Google Wallet save link")
    parser.add_argument("--account", default="cnt_0x71c8", help="ZENO account id")
    parser.add_argument("--holder", default="8b-is Crew", help="card holder label")
    parser.add_argument("--balance-ujpy", type=int, default=None, help="balance in micro-yen")
    parser.add_argument("--issuer-id", default=None, help="override GOOGLE_WALLET_ISSUER_ID")
    parser.add_argument("--out", default=None, help="write the save URL (or claims JSON) here")
    parser.add_argument("--json", action="store_true", help="print full JSON instead of URL")
    args = parser.parse_args(argv)

    result = build(args.account, args.holder, args.balance_ujpy, args.issuer_id)

    if args.out:
        Path(args.out).write_text(
            json.dumps(result, indent=2, ensure_ascii=False) if args.json else (result.get("saveUrl") or json.dumps(result, indent=2)),
            encoding="utf-8",
        )

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif result["mode"] == "live":
        print(result["saveUrl"])
        if result["overLengthLimit"]:
            print(f"warning: JWT is {result['jwtLength']} chars (> {MAX_SAFE_JWT_LEN})", file=sys.stderr)
    else:
        print("Google Wallet issuer not configured; claims preview below.", file=sys.stderr)
        print(f"missing: {', '.join(result['missing'])}", file=sys.stderr)
        print(json.dumps(result["claims"], indent=2, ensure_ascii=False))
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
