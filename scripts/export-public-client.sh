#!/usr/bin/env bash
set -euo pipefail

# Deterministic MIT Open-Source Client Exporter for ZENO US
# Ensures ZERO private-core files, symlinks, or secrets are ever included.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="dry-run"
OUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      MODE="dry-run"
      shift
      ;;
    --out)
      MODE="export"
      OUT_DIR="${2:-}"
      if [[ -z "$OUT_DIR" || "$OUT_DIR" == -* ]]; then
        echo "ERROR: --out requires a valid destination directory path" >&2
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "Usage: $0 [--dry-run | --out <dir>]" >&2
      exit 1
      ;;
  esac
done

ALLOWLIST=(
  "us.html"
  "us.css"
  "us.js"
  "index.html"
  "style.css"
  "app.js"
  "zeno-engine.js"
  "sound.js"
  "qrcode.js"
  "sw.js"
  "manifest.webmanifest"
  "favicon.svg"
  "og.svg"
  "robots.txt"
  "_headers"
  "constellation.json"
  "LICENSING_BOUNDARY.md"
  "spec/RFC-008-US-USDC-USDT-OPEN-CORE.md"
  "spec/SOLANA_USDC_VAKED_FOKEN_PIPELINE.md"
  "spec/US_MONETIZATION_SUBSCRIPTIONS.md"
  "spec/COMPLIANCE_AUDIT_SOC2_GDPR_PCIDSS_BSA.md"
  "scripts/export-public-client.sh"
  "design/DESIGN_SYSTEM.md"
  "design/PHILOSOPHY.md"
  "design/tokens.json"
  "design/audio-spec.md"
  "icons/icon-16.png"
  "icons/icon-32.png"
  "icons/icon-48.png"
  "icons/icon-192.png"
  "icons/icon-512.png"
  "icons/icon-maskable-192.png"
  "icons/icon-maskable-512.png"
  "icons/apple-touch-icon.png"
  "icons/favicon-16.png"
  "icons/favicon-32.png"
  "icons/favicon.ico"
  "icons/og-image.png"
)

# Fail closed if any forbidden private-core pattern or symlink appears in ALLOWLIST
for rel in "${ALLOWLIST[@]}"; do
  if [[ "$rel" == *apps/core* || "$rel" == *apps/rust* || "$rel" == *certs* || "$rel" == *.env* || "$rel" == *.pkpass* || "$rel" == *.pem* || "$rel" == *.key* || "$rel" == *.st/* || "$rel" == *deploy/* || "$rel" == *infra/* || "$rel" == *set-wallet-secrets* ]]; then
    echo "FATAL: Private-core or infra path detected in public client allowlist: $rel" >&2
    exit 2
  fi
  if [[ -L "$ROOT_DIR/$rel" ]]; then
    echo "FATAL: Symlink forbidden in public client allowlist: $rel" >&2
    exit 3
  fi
  if [[ ! -f "$ROOT_DIR/$rel" ]]; then
    echo "FATAL: Missing allowlisted public client file: $ROOT_DIR/$rel" >&2
    exit 4
  fi
done

if [[ "$MODE" == "dry-run" ]]; then
  echo "=== ZENO US MIT Public Client Export (DRY RUN) ==="
  echo "Verified ${#ALLOWLIST[@]} public files (0 private-core leaks):"
  for rel in "${ALLOWLIST[@]}"; do
    echo "  + $rel"
  done
  exit 0
fi

if [[ "$OUT_DIR" == "/" || "$OUT_DIR" == "$ROOT_DIR" ]]; then
  echo "FATAL: Refusing unsafe --out path: $OUT_DIR" >&2
  exit 5
fi

mkdir -p -- "$OUT_DIR"
MANIFEST_PATH="$OUT_DIR/public-client-manifest.json"
HASH_RECORDS=""

for rel in "${ALLOWLIST[@]}"; do
  dest="$OUT_DIR/$rel"
  mkdir -p -- "$(dirname "$dest")"
  cp -- "$ROOT_DIR/$rel" "$dest"
  if command -v shasum >/dev/null 2>&1; then
    digest="$(shasum -a 256 "$dest" | awk '{print $1}')"
  else
    digest="$(sha256sum "$dest" | awk '{print $1}')"
  fi
  HASH_RECORDS="${HASH_RECORDS}${rel}|${digest}"$'\n'
done

# Serialize manifest safely using Node JSON.stringify
HASH_RECORDS="$HASH_RECORDS" node -e '
const fs = require("fs");
const lines = (process.env.HASH_RECORDS || "").trim().split("\n").filter(Boolean);
const files = lines.map((line) => {
  const sep = line.lastIndexOf("|");
  return { path: line.slice(0, sep), sha256: line.slice(sep + 1) };
});
const doc = {
  surface: "ZENO US Open-Source Client",
  license: "MIT",
  coreBoundary: "PRIVATE (apps/core, apps/rust, certs, deploy, infra excluded)",
  fileCount: files.length,
  files,
};
fs.writeFileSync(process.argv[1], JSON.stringify(doc, null, 2) + "\n");
' "$MANIFEST_PATH"

echo "Exported ${#ALLOWLIST[@]} MIT client files to $OUT_DIR"
echo "Manifest written to $MANIFEST_PATH"
