#!/usr/bin/env bash
set -euo pipefail

# Builds the MIT client bundle for zeno.8b.is in dist/zeno-8b-is/
# and optionally deploys Caddy config to an authorized remote host via --push <user@host>.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/zeno-8b-is"
PUSH_TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push)
      PUSH_TARGET="${2:-${ZENO_8B_TARGET:-}}"
      if [[ -z "$PUSH_TARGET" || "$PUSH_TARGET" == -* ]]; then
        echo "ERROR: --push requires <user@host> (or set ZENO_8B_TARGET)" >&2
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "Usage: $0 [--push <user@host>]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ROOT_DIR" || "$DIST_DIR" != "$ROOT_DIR/dist/"* ]]; then
  echo "FATAL: Refusing unsafe DIST_DIR: $DIST_DIR" >&2
  exit 2
fi

rm -rf -- "$DIST_DIR"
bash "$ROOT_DIR/scripts/export-public-client.sh" --out "$DIST_DIR"
echo "Prepared MIT zeno.8b.is bundle in $DIST_DIR (infra configs kept outside bundle)"

if [[ -n "$PUSH_TARGET" ]]; then
  if [[ ! "$PUSH_TARGET" =~ ^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$ ]]; then
    echo "FATAL: Invalid SSH target format (expected user@host): $PUSH_TARGET" >&2
    exit 3
  fi
  ssh -- "$PUSH_TARGET" "mkdir -p /etc/caddy/conf.d"
  scp -- "$ROOT_DIR/deploy/zeno.8b.is.Caddyfile" "$PUSH_TARGET:/etc/caddy/conf.d/zeno.8b.is.caddy.tmp"
  ssh -- "$PUSH_TARGET" "mv /etc/caddy/conf.d/zeno.8b.is.caddy.tmp /etc/caddy/conf.d/zeno.8b.is.caddy && caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy"
  echo "Validated and reloaded Caddy on $PUSH_TARGET for https://zeno.8b.is"
fi
