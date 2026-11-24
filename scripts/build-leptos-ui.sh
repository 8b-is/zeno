#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRATE_DIR="$ROOT_DIR/apps/rust/zeno-leptos-ui"
OUT_DIR="$ROOT_DIR/us-rust"
TARGET_WASM="$CRATE_DIR/target/wasm32-unknown-unknown/release/zeno_leptos_ui.wasm"
OUT_WASM="$OUT_DIR/zeno_leptos_bg.wasm"

(cd "$CRATE_DIR" && env -u RUSTFLAGS cargo build --release --target wasm32-unknown-unknown)

if [[ ! -f "$TARGET_WASM" ]]; then
  echo "ERROR: Missing compiled WASM at $TARGET_WASM" >&2
  exit 1
fi

wasm-bindgen \
  --target web \
  --no-typescript \
  --out-dir "$OUT_DIR" \
  --out-name zeno_leptos \
  "$TARGET_WASM"

if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -Oz \
    --enable-bulk-memory \
    --enable-nontrapping-float-to-int \
    --enable-sign-ext \
    --enable-mutable-globals \
    "$OUT_WASM" -o "$OUT_WASM"
fi

RAW_BYTES=$(wc -c < "$OUT_WASM" | tr -d ' ')
GZIP_BYTES=$(gzip -c "$OUT_WASM" | wc -c | tr -d ' ')
if command -v shasum >/dev/null 2>&1; then
  SHA256=$(shasum -a 256 "$OUT_WASM" | awk '{print $1}')
else
  SHA256=$(sha256sum "$OUT_WASM" | awk '{print $1}')
fi

echo "Built $OUT_WASM (raw=${RAW_BYTES} bytes, gzip=${GZIP_BYTES} bytes, sha256=${SHA256})"
