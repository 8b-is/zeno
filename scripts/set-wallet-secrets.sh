#!/usr/bin/env bash
# Safely validate and upload GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_SA_JSON
# to Cloudflare Workers via Wrangler without echoing secret contents.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  printf 'Usage: %s <19-or-20-digit-issuer-id> <path-to-google-wallet-sa.json>\n' "$0" >&2
  exit 2
fi

ISSUER_ID="$1"
SA_JSON_PATH="$2"

if [[ ! "$ISSUER_ID" =~ ^[0-9]{15,22}$ ]]; then
  printf 'Error: GOOGLE_WALLET_ISSUER_ID must be a numeric Issuer ID (got length %d).\n' "${#ISSUER_ID}" >&2
  exit 1
fi

if [[ ! -f "$SA_JSON_PATH" ]]; then
  printf 'Error: Service account JSON file not found at %s\n' "$SA_JSON_PATH" >&2
  exit 1
fi

python3 - "$SA_JSON_PATH" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)
required = ("type", "project_id", "private_key_id", "private_key", "client_email")
missing = [k for k in required if not data.get(k)]
if data.get("type") != "service_account" or missing:
    raise SystemExit(f"Invalid service account JSON (missing: {missing})")
print(f"Validated service account JSON for: {data['client_email']} (project: {data['project_id']})")
PY

cd "$(dirname "$0")/.."
printf '%s' "$ISSUER_ID" | npx wrangler secret put GOOGLE_WALLET_ISSUER_ID --config deploy/wrangler.toml
npx wrangler secret put GOOGLE_WALLET_SA_JSON --config deploy/wrangler.toml < "$SA_JSON_PATH"
printf 'Successfully configured GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_SA_JSON.\n'
