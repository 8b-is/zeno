# ZENO US Open-Core Licensing & Privacy Boundary

This repository uses an **Open-Client / Private-Core** architecture for the US-first **ZENO US** neo-bank surface (`https://zeno.vaked.dev/us`), ensuring users can inspect, audit, and self-verify every byte of client-side code and cryptography while keeping custodial engines, compliance rails, and cryptographic signing infrastructure private.

---

## 1. Classification Matrix

| Path / Directory | Classification | License | Purpose |
| :--- | :--- | :--- | :--- |
| `us.html` | **PUBLIC CLIENT** | `MIT` | US-first neo-bank PWA shell (Robinhood × CashApp × Revolut UI) |
| `us.css` | **PUBLIC CLIENT** | `MIT` | Sovereign Obsidian Terminal design system (zero purple, zero trackers) |
| `us.js` | **PUBLIC CLIENT** | `MIT` | Safe isomorphic client runtime (zero `.innerHTML`, WebCrypto P-256 vault, PoR self-verifier) |
| `index.html`, `style.css`, `app.js` | **PUBLIC CLIENT** | `MIT` | Constellation & Japanese neo-bank PWA surface |
| `zeno-engine.js` | **PUBLIC CLIENT** | `MIT` | Safe isomorphic `BigInt` ledger (`Object.create(null)` maps), `StablecoinReserveEngine`, Q-Wave & Foken |
| `sound.js`, `qrcode.js`, `sw.js`, `manifest.webmanifest` | **PUBLIC CLIENT** | `MIT` | Procedural Web Audio, local QR generator, offline service worker |
| `favicon.svg`, `og.svg`, `icons/`, `robots.txt`, `_headers` | **PUBLIC CLIENT** | `MIT` | Brand assets, PWA icons, strict security & anti-scraping headers |
| `constellation.json`, `design/` | **PUBLIC CLIENT** | `MIT` | Constellation metadata, design tokens & philosophy |
| `spec/RFC-008-US-USDC-USDT-OPEN-CORE.md` | **PUBLIC SPEC** | `MIT` | US USDC+USDT 1:1 backing, privacy & open-core architecture spec |
| `LICENSING_BOUNDARY.md` | **PUBLIC SPEC** | `MIT` | This authoritative open-client vs. private-core boundary ledger |
| `scripts/export-public-client.sh` | **PUBLIC TOOLING** | `MIT` | Deterministic allowlist exporter for the standalone MIT client repo |
| `apps/rust/zeno-us-core/` | **PRIVATE CORE** | `ALL RIGHTS RESERVED` | Proprietary Rust `#![no_std]` zero-float `p/q` ZENO US core (no Python) |
| `apps/rust/zeno-issuer-angel/` | **PRIVATE CORE** | `ALL RIGHTS RESERVED` | Proprietary `#![no_std]` FeliCa/PoR kernel & 32B `0x62` WUPZ seals |
| `apps/rust/zeno-native/` | **PRIVATE CORE** | `ALL RIGHTS RESERVED` | Proprietary Rust JNI/FFI bridge |
| `apps/core/` | **PRIVATE CORE (LEGACY)** | `ALL RIGHTS RESERVED` | Legacy Constellation Python reference suite (excluded from ZENO US backend) |
| `apps/wallet/certs/`, `apps/wallet/*.pkpass` | **PRIVATE CORE** | `ALL RIGHTS RESERVED` | Signing certificates and compiled pass artifacts |
| `infra/`, `deploy/wrangler.toml`, `scripts/set-wallet-secrets.sh` | **PRIVATE CORE** | `ALL RIGHTS RESERVED` | Cloud infrastructure, secret provisioning, and deployment config |

---

## 2. Exporting the Standalone MIT Client Repository

Use [`scripts/export-public-client.sh`](scripts/export-public-client.sh) to preview or materialize the clean open-source client bundle:

```bash
# Preview the exact MIT allowlist and verify zero private-core paths match
bash scripts/export-public-client.sh --dry-run

# Export the standalone MIT client + SHA-256 manifest to an output folder
bash scripts/export-public-client.sh --out /tmp/zeno-us-client-mit
```

The exporter fails closed (non-zero exit) if any private-core path (`apps/core`, `apps/rust`, `certs`, `.env`, or `*.pkpass`) ever appears in the export list.
