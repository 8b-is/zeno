# RFC-008: ZENO US — USDC+USDT Backed Open-Core Sovereign Neo-Bank (USA First)

> **Status**: Standard Track · **Jurisdiction**: United States (First) · **Version**: `1.0.0`  
> **Authors**: 8b-is Crew (Hue, Aye, Taisha, Omni) & Family (`https://8b.is`)  
> **Live US Surface**: `https://zeno.vaked.dev/us` · **Boundary Spec**: [`LICENSING_BOUNDARY.md`](../LICENSING_BOUNDARY.md)

---

## 1. Executive Thesis: Robinhood × CashApp × Revolut, Built Privacy-First in the USA

Traditional neo-banks combine high-friction KYC surveillance with opaque fractional reserves or hidden FX spreads. **ZENO US** synthesizes the strongest ergonomics of three flagship consumer financial apps into a single **privacy-friendly, open-client / private-core** architecture deployed first in the United States:

| Inspiration | Capability Synthesized in ZENO US | ZENO Sovereign Upgrade |
| :--- | :--- | :--- |
| **Robinhood** | Scrubbable real-time portfolio chart, markets & T-bill yield watchlist, zero-commission feel | 1:1 `USDC` + `USDT` reserve parity bar + instant Kintsugi cryptographic receipt on every move |
| **CashApp** | Tactile numeric keypad, instant `$zenotag` P2P transfers, QR scan-to-pay / request | Zero-fee internal double-entry settlement (`sum(postings) == 0`) + blinded identity commitments |
| **Revolut** | Multi-currency vaults (`USD`, `JPY`, `EUR`, `GBP`, `HUF`), 3D titanium card, disposable virtual cards | Zero-float exact `p/q` rational FX rates + local WebCrypto virtual card generation |

---

## 2. Dual-Stablecoin 1:1 Backing Model (`USDC` + `USDT`)

ZENO US enforces **zero debt minting** and **zero floating-point accounting**:

1. **Exact Integer Micro-USD Accounting**:
   - All balances, reserves, transfers, and FX quotes operate in integer micro-USD (`1 USD = 1,000,000 µUSD`, `BigInt` in safe isomorphic JS, checked `i64`/`u64`/`i128` + `Rational` `p/q` in `#![no_std]` Rust — zero Python and zero floats on backend).
2. **Segregated Dual-Stablecoin Reserves**:
   - `asset:stable:usdc_reserve`: Segregated `USDC` treasury across Base, Solana, Ethereum, and Arbitrum.
   - `asset:stable:usdt_reserve`: Segregated `USDT` treasury across Ethereum, Solana, and Tron.
3. **1:1 Reserve Coverage Invariant (`p/q >= 1/1`)**:
   $$\frac{\text{USDC}_{\mu\text{USD}} + \text{USDT}_{\mu\text{USD}}}{\sum \text{User Liabilities}_{\mu\text{USD}}} \ge \frac{1}{1}$$
   - Trit verdict under the Sovereign Ontology: `+1` (over-backed), `0` (exact `1/1` parity), `-1` (under-backed — hard halt).
4. **Atomic 1:1 `USDC ⇄ USDT` Peg Bridge**:
   - Treasury rebalancing posts `(-amount, +amount)` across `asset:stable:usdc_reserve` and `asset:stable:usdt_reserve`, preserving total reserves identically at `0 bps` user markup.
5. **Cryptographic Sealing**:
   - Every mint, redeem, `$zenotag` transfer, and reserve swap is chained via **Kintsugi SHA-256** and sealed with the `0x62` **WUPZ 32-byte witness seal** (`zeno-issuer-angel`).

---

## 3. Open-Source Client (`MIT`) vs. Private Core (`PROPRIETARY`)

ZENO separates **verifiable client execution** from **custodial and compliance execution**:

- **Client-Side Open Source (`MIT`)**:
  - Visitors and security auditors can inspect `us.html`, `us.css`, `us.js`, `zeno-engine.js`, `sound.js`, `qrcode.js`, `sw.js`, and `manifest.webmanifest`.
  - Safe isomorphic JS only (`Object.create(null)` prototype-safe account maps, pure `BigInt`, zero `.innerHTML`), zero trackers/cookies, local WebCrypto ECDSA P-256 key generation/signing, and deterministic Proof-of-Reserve (`PoR`) checks directly in-browser.
  - Exportable cleanly via `scripts/export-public-client.sh`.
- **Private Core (`ALL RIGHTS RESERVED — RUST ONLY, NO PYTHON`)**:
  - `apps/rust/zeno-us-core` (`#![no_std]`, `#![forbid(unsafe_code)]`, zero floats, exact `p/q` `Rational` + checked integer ledger, blinded SHA-256 commitments, exact `p/q` FX) and `apps/rust/zeno-issuer-angel` (`StableReserveState`, `0x62` WUPZ seals), plus `infra/`, custody HSMs, and sponsor-bank rails remain strictly private.

---

## 4. Privacy-by-Design Architecture

1. **Blinded Identity Commitments on Ledger**: User accounts store only `sha256(cashtag + ":" + pubkey_hex + ":" + identity_salt)` (`identity_commitment`) — never raw SSNs, street addresses, emails, or phone numbers in the accounting ledger.
2. **Local-First WebCrypto Vault**: ECDSA P-256 keypairs are generated inside the browser via `crypto.subtle.generateKey` and private keys remain client-side.
3. **Zero Surveillance Telemetry**: `cookies: 0`, `thirdPartyTrackers: 0`, `analyticsBeacons: 0`, strict `_headers` security posture, and zero external audio files (`sound.js` Web Audio synthesis).
4. **Tiered Privacy Limits (`µUSD`)**:
   - `sovereign_lite`: `$1,000/tx` (`1,000,000,000 µUSD`), `$3,000/day`
   - `verified_us`: `$25,000/tx` (`25,000,000,000 µUSD`), `$100,000/day`
   - `institutional`: `$250,000/tx` (`250,000,000,000 µUSD`), `$1,000,000/day`

---

## 5. US Regulatory Launch Architecture (Informational Engineering Spec — Not Legal Advice)

> **Non-Legal-Advice Notice**: This section documents engineering architecture patterns for US deployment and does **not** constitute legal advice. Formal counsel review is required prior to live US fiat or custodial onboarding. Currently, `/us` runs in local simulated Proof-of-Reserve mode until live US custody & banking rails are activated.

| Regulatory Layer | US Engineering Posture | Private Core Enforcement |
| :--- | :--- | :--- |
| **Federal BSA / FinCEN MSB** | Money Services Business registration + SAR/CTR workflow isolation inside private core | Keeps PII & compliance vaults physically segregated from public client & Kintsugi ledger |
| **State MTL vs. Sponsor Bank FBO** | Phased US rollout via regulated US Sponsor Bank FBO accounts (ACH / FedNow / Wire) alongside state Money Transmitter License coverage | Private Rust core webhook & settlement bridge (`zeno-us-core` + HSM signer) |
| **Payment Stablecoin 1:1 Reserves** | 100% segregated `USDC` + `USDT` reserves + monthly CPA attestation alignment + continuous `p/q >= 1/1` invariant | `UsNeoBankCore::proof_of_reserve()` + `#![no_std]` `StableReserveState::verify_full_backing()` |
| **OFAC / Sanctions Screening** | Ingress screening at private-core custody deposit/withdraw boundaries without mass-surveillance client SDKs | Private core ingress gate prior to `mint_from_stablecoin` / `redeem_to_stablecoin` |

---

## 6. Client ↔ Private Core JSON API Contract (Zero XML, Zero Float)

All monetary amounts are encoded as integer micro-USD (`1 USD = 1_000_000 µUSD`).

### Public Edge Endpoints (`zeno.vaked.dev`)
- `GET /api/us/reserve-proof`
  ```json
  {
    "asset": "USD",
    "backing": ["USDC", "USDT"],
    "usdcReserveMicro": 31240500000,
    "usdtReserveMicro": 20800000000,
    "totalReservesMicro": 52040500000,
    "totalLiabilitiesMicro": 52040500000,
    "coverageRatioPQ": "1/1",
    "trit": 0,
    "gate": "0x62",
    "mode": "simulated_local_por_until_us_custody_live"
  }
  ```
- `GET /api/us/architecture`
  ```json
  {
    "surface": "ZENO US",
    "jurisdiction": "US-first",
    "backing": ["USDC", "USDT"],
    "clientLicense": "MIT",
    "coreLicense": "PROPRIETARY_PRIVATE",
    "backendLanguage": "rust",
    "pythonAllowed": false,
    "zeroFloatPQ": true,
    "clientRuntime": "safe-isomorphic-js",
    "zeroTelemetry": true,
    "openSourceClientRoutes": ["/us", "/us.css", "/us.js", "/zeno-engine.js", "/sound.js", "/qrcode.js"],
    "privateCoreModules": ["apps/rust/zeno-us-core", "apps/rust/zeno-issuer-angel"]
  }
  ```

### Authenticated Private-Core Endpoints (Production Custody Phase)
- `POST /v1/us/deposit` — Signed WebCrypto request + verified on-chain `USDC`/`USDT` tx receipt → 1:1 liability mint.
- `POST /v1/us/send` — Signed `$zenotag` transfer (`amountMicro`, `fromTag`, `toTag`, `nonce`) → double-entry zero-sum Kintsugi block.
- `POST /v1/us/swap` — Atomic 1:1 `USDC ⇄ USDT` reserve peg rebalance (`0 bps` fee).
- `POST /v1/us/redeem` — Signed stablecoin withdrawal to destination address after reserve & tier policy verification.

---

## 7. UltraZeno M1-M2-M3 Structural Compression Witness

Verified via `ultra-mcp` `ultra_zeno_structural_compression` across the 10-node, 13-edge US neo-bank architecture graph (client UI, WebCrypto vault, PoR verifier, edge worker, Rust `zeno-us-core`, Rust `#![no_std]` angel, USDC reserve, USDT reserve, sponsor bank FBO, Kintsugi ledger):

- **M1 Erdos–Renyi Percolation**: `connected_components = 1`, `empirical_density = 0.2889 > 0.2303` (`connected_supercritical`), `giant_component_fraction = 1.0`.
- **M2 UltraZeno Dyadic MDL Bottleneck**: `optimal_zeno_step = 0`, `optimal_partition = 2` supernodes (Open-Source Client vs. Private Core), `mdl_compression_ratio = 0.6997`, `steiner_backbone = 5` retained edges.
- **M3 System 2 Invariants**: `largest_clique_witness = [4, 6, 9]` (Core × USDC × Kintsugi), `moser_tardos_homeostasis = converged` in `0` resamples (`symbolic_m3_fixed_point`).
