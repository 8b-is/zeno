#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASM_CRATE="$ROOT_DIR/apps/rust/zeno-wasm-client"
TARGET_WASM="$WASM_CRATE/target/wasm32-unknown-unknown/release/zeno_wasm_client.wasm"
OUT_WASM="$ROOT_DIR/zeno-client.wasm"

(cd "$WASM_CRATE" && env -u RUSTFLAGS cargo build --release --target wasm32-unknown-unknown)

if [[ ! -f "$TARGET_WASM" ]]; then
  echo "ERROR: Expected release WASM binary missing at $TARGET_WASM" >&2
  exit 1
fi

cp -- "$TARGET_WASM" "$OUT_WASM"
BYTES=$(wc -c < "$OUT_WASM" | tr -d ' ')
if [[ "$BYTES" -gt 32768 ]]; then
  echo "ERROR: zeno-client.wasm exceeded 32 KiB budget (${BYTES} bytes)" >&2
  exit 2
fi

if command -v shasum >/dev/null 2>&1; then
  SHA256=$(shasum -a 256 "$OUT_WASM" | awk '{print $1}')
else
  SHA256=$(sha256sum "$OUT_WASM" | awk '{print $1}')
fi

echo "Built $OUT_WASM (${BYTES} bytes, sha256=${SHA256})"
