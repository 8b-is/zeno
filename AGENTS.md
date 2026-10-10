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
# Run unit tests
cd apps/core && uv run python -m unittest discover -s tests

# Test CLI
cd ../.. && uv run python apps/cli/zeno_cli.py account list
```
