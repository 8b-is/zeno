# AGENTS.md — zeno.vaked.dev (ZENO Sovereign Neo-Bank)

## Overview
`zeno.vaked.dev` is the Japanese proof-of-contribution sovereign neo-bank surface in the **VAKED Constellation** (`vaked.dev`). It synthesizes VAKED zero-copy, edge-first architecture with the **Foken** valuation gate (`foken/`).

## Hard Rules
1. **Python via `uv`**: Always invoke Python via `uv run` inside `apps/core` or `apps/cli`. Never call bare `python` or `pip`.
2. **Double-Entry Equilibrium**: Ledger postings must strictly sum to zero ($\sum \text{amount} = 0$).
3. **No Debt Minting**: Balances expand only upon verified fiat deposit or consensus-cleared Foken invoices.
4. **Constellation Alignment**:
   - `_headers`: Strict Cloudflare security headers.
   - `robots.txt`: Anti-AI scraping rules.
   - Lovetta Lane footer must be preserved with backreferences.
   - Procedural Web Audio: Zero external audio files; all sound is synthesized via Web Audio API.

## Testing & Verification
```bash
# Core suite (canonical — works as-is)
cd apps/core && uv run python -m unittest discover -s tests
# pytest equivalent needs the package on the path (no pytest config in pyproject):
cd apps/core && PYTHONPATH=. uv run --quiet pytest -q

# Wallet/pass contract tests
cd apps/wallet && uv run python -m unittest test_google_wallet

# Native core (Rust) + ZKP1 witness (Zig)
cd apps/rust/zeno-native && cargo test
zig run tools/zkp1_verify.zig -- \\
  /Users/lodripeter/workspace/peterlodri-sec/pocoo.vaked.dev/dist/demos/book/architect-neo-trinity-tibetan-omni.zkp1 \\
  constellation.json

# Engine tests (Node, run from repo root)
node test-engine.mjs
node test-scheduled-sweep.mjs
node test-google-wallet.mjs

# Test CLI
cd ../.. && uv run python apps/cli/zeno_cli.py account list
```

Note: `uv run pytest` without `PYTHONPATH=.` fails with `ModuleNotFoundError:
No module named 'zeno_core'` and ~10 collection errors. That is expected, not a
broken tree.

## Build & Deploy
```bash
# `deploy/worker.js` is GENERATED — never hand-edit it.
node deploy/build.mjs
node --check deploy/worker.js      # gate: build can emit invalid JS
node --check app.js

# Deploy the edge worker (from repo root, wrangler already authenticated)
npx wrangler deploy -c deploy/wrangler.toml

# Post-deploy smoke: all must be 200; sw.js must report the new CACHE_NAME
curl -s -o /dev/null -w '%{http_code} /\n'            https://zeno.vaked.dev/
curl -s -o /dev/null -w '%{http_code} api\n'          https://zeno.vaked.dev/api/wallet/google-pass
curl -s -o /dev/null -w '%{http_code} assetlinks\n'   https://zeno.vaked.dev/.well-known/assetlinks.json
curl -s https://zeno.vaked.dev/sw.js | head -3
```

Editing `deploy/build.mjs` (worker template string) gotchas:
- The generated worker is a JS string literal. Do **not** use `${...}` template
  interpolation inside it — build paths by concatenation instead.
- Regex escapes must be doubled in the template (`\\+`, `\\//`, `\\s+`).
- New static assets need both an entry in the base64/asset map *and* an explicit
  route; there is no catch-all static handler.

## Release checklist
1. Bump `versionCode`/`versionName` (`apps/android/app/build.gradle.kts`) and the
   ACP `"version"` + `index.html` badge when the contract changes.
2. Bump `sw.js` `CACHE_NAME` (`zeno-v3-…`) on every asset change or clients keep
   stale files.
3. Run the full suite above (Node + Python), then `node deploy/build.mjs`.
4. Deploy, run the smoke checks, then push to **both** remotes:
   `git push origin main && git push mirror main`
5. Known gap: `deploy/assetlinks.json` ships only the debug SHA-256. Add the
   release keystore fingerprint before shipping a signed release build.
