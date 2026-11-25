#!/usr/bin/env bash
set -euo pipefail

# ZENO US Live Stripe & Base EVM Treasury Activation Helper
# Usage:
#   1. Authenticate Stripe CLI on your VAKED account: `stripe login`
#   2. Export `STRIPE_SECRET_KEY=sk_live_...` (or set interactive prompt) and optional `ZENO_TREASURY_EVM=0x...`
#   3. Run: `./scripts/activate-live-stripe-and-treasury.sh`

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRANGLER_BIN="${WRANGLER_BIN:-/Users/lodripeter/.bun/bin/wrangler}"
WRANGLER_CFG="$ROOT_DIR/deploy/wrangler.toml"

if [[ ! -x "$WRANGLER_BIN" ]]; then
  WRANGLER_BIN="$(command -v wrangler)"
fi

echo "Checking Stripe CLI live session..."
if ! stripe products list --live --limit 1 >/dev/null 2>&1; then
  echo "ERROR: Stripe CLI live key is expired or not logged in." >&2
  echo "Run: stripe login" >&2
  exit 1
fi

extract_id() {
  node -e 'const fs = require("fs"); const j = JSON.parse(fs.readFileSync(0, "utf8")); if (!j.id) process.exit(1); process.stdout.write(j.id);'
}

extract_secret() {
  node -e 'const fs = require("fs"); const j = JSON.parse(fs.readFileSync(0, "utf8")); if (!j.secret) process.exit(1); process.stdout.write(j.secret);'
}

PROD_PLUS_ID=$(stripe products create --live --name="ZENO Plus" --description="25 bps Auto-Trade & 10,000 Quant API calls/mo" | extract_id)
PRICE_PLUS_ID=$(stripe prices create --live --product="$PROD_PLUS_ID" --unit-amount=999 --currency=usd --recurring-interval=month | extract_id)

PROD_ULTRA_ID=$(stripe products create --live --name="ZENO Ultra Quant" --description="10 bps Auto-Trade & 100,000 Quant API calls/mo" | extract_id)
PRICE_ULTRA_ID=$(stripe prices create --live --product="$PROD_ULTRA_ID" --unit-amount=4900 --currency=usd --recurring-interval=month | extract_id)

PROD_INST_ID=$(stripe products create --live --name="ZENO Institutional" --description="5 bps Auto-Trade & 1,000,000 Quant API calls/mo" | extract_id)
PRICE_INST_ID=$(stripe prices create --live --product="$PROD_INST_ID" --unit-amount=19900 --currency=usd --recurring-interval=month | extract_id)

WEBHOOK_SECRET=$(stripe webhook_endpoints create --live \
  --url="https://zeno.vaked.dev/api/v1/stripe/webhook" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=invoice.paid" \
  -d "enabled_events[]=customer.subscription.deleted" | extract_secret)

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  read -rsp "Enter live STRIPE_SECRET_KEY (sk_live_...): " STRIPE_SECRET_KEY
  echo ""
fi

if [[ -z "${STRIPE_SECRET_KEY:-}" || "$STRIPE_SECRET_KEY" != sk_live_* ]]; then
  echo "ERROR: Valid sk_live_... STRIPE_SECRET_KEY is required." >&2
  exit 2
fi

printf '%s' "$STRIPE_SECRET_KEY" | "$WRANGLER_BIN" secret put STRIPE_SECRET_KEY -c "$WRANGLER_CFG"
printf '%s' "$WEBHOOK_SECRET"    | "$WRANGLER_BIN" secret put STRIPE_WEBHOOK_SECRET -c "$WRANGLER_CFG"
printf '%s' "$PRICE_PLUS_ID"     | "$WRANGLER_BIN" secret put STRIPE_PRICE_PLUS -c "$WRANGLER_CFG"
printf '%s' "$PRICE_ULTRA_ID"    | "$WRANGLER_BIN" secret put STRIPE_PRICE_ULTRA -c "$WRANGLER_CFG"
printf '%s' "$PRICE_INST_ID"     | "$WRANGLER_BIN" secret put STRIPE_PRICE_INSTITUTIONAL -c "$WRANGLER_CFG"

if [[ -n "${ZENO_TREASURY_EVM:-}" ]]; then
  printf '%s' "$ZENO_TREASURY_EVM" | "$WRANGLER_BIN" secret put ZENO_TREASURY_EVM -c "$WRANGLER_CFG"
fi

echo "Active Cloudflare Worker secrets on $WRANGLER_CFG:"
"$WRANGLER_BIN" secret list -c "$WRANGLER_CFG"
