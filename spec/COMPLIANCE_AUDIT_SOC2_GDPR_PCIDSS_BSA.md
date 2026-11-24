# ZENO US Regulatory Compliance & Security Readiness Audit (`v1.11.0`)

> **Disclaimer**: This document is an engineering control readiness assessment and continuous audit specification prepared for `zeno.vaked.dev` and `zeno.8b.is`. It is **not** legal counsel, regulatory licensing approval, or a formal external SOC 2 / PCI-DSS QSA / FinCEN examination certificate.

---

## 1. Compliance Assessment

| Framework / Standard | Scope & Applicability | Current Technical Posture | Formal Audit Status |
|---|---|---|---|
| **GDPR / CCPA** | Client-side identity keys & minimized pseudonymous ledger | Non-extractable P-256 keys (`extractable: false`), zero third-party trackers, zero cookies, blinded `ZENO:ID:V1:` commitments, GDPR Art. 17 crypto-shredding & Art. 20 portability JSON export in Rust `zeno-us-core` | Engineering controls implemented; organizational DPO/SCCs required for EU public launch |
| **US FinCEN / BSA / OFAC** | US-first USDC+USDT money-services boundary | PrivacyTier per-tx & cumulative UTC daily caps (`SovereignLite` / `VerifiedUs` / `Institutional`), Travel Rule `$3,000` (`FINCEN_TRAVEL_RULE_MICRO`) & CTR `$10,000` (`FINCEN_CTR_THRESHOLD_MICRO`) evaluators, OFAC address screening (`sanctioned_addresses`), immutable 5-year hash-chained ledger receipts | Technical controls ready; requires US Sponsor Bank FBO & FinCEN MSB registration prior to live retail custody |
| **PCI-DSS v4.0 (SAQ-A)** | Subscription & fiat on-ramp processing | Zero raw PAN, CVC, or magnetic-stripe track data ever touches Cloudflare Worker (`POST /api/us/checkout` delegates tokenization to Stripe Checkout; webhook uses HMAC-SHA256 constant-time verification) | SAQ-A architecture enforced |
| **SOC 2 Type II** (Security, Availability, Confidentiality, Processing Integrity) | Edge Worker, Rust `#![no_std]` core, CI/Fuzzing gates | Zero `unsafe` in `zeno-us-core`, zero float arithmetic (`p/q`), deterministic zero-sum double-entry invariants, 100% pass fuzz & unit test suites, strict CSP/COOP/CORP headers | Technical controls automated; requires formal Type II observation window |
| **OWASP MASVS v2 (Android)** | `dev.vaked.zeno` (`SM_S928U1` / API 26–34) | `allowBackup="false"`, `usesCleartextTraffic="false"`, `network_security_config.xml`, bounded FFI (`MAX_JNI_BYTES = 16_384`), isolated NDK Rust JNI `libzeno_native.so` | Hardened APK verified (`versionCode = 12`, `v1.11.0`); release keystore SHA-256 pending Play Store release |

---

## 2. Gap Analysis

| ID | Gap Description | Severity | Status |
|---|---|---|---|
| **GAP-01** | Live US Sponsor Bank FBO & FinCEN MSB / state MTL licensing prior to accepting live retail US customer fiat/USDC custody | **Critical (Legal/Ops)** | **Open (Operational)** — Sandbox runs transparently in `simulated_local_por_until_us_custody_live` |
| **GAP-02** | Production Stripe secret keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs) & funded Solana/Base treasury addresses | **High (Ops)** | **Open (Secrets)** — Fail-closed until configured via `wrangler secret put` |
| **GAP-03** | GDPR Art. 17 crypto-shredding + Art. 20 portability + OFAC/Travel Rule screening in Rust core | **High (Technical)** | **Closed** in `apps/rust/zeno-us-core/src/lib.rs` (`v0.4.0`) |
| **GAP-04** | Android `allowBackup="true"` & implicit cleartext risk | **Medium (Mobile)** | **Closed** (`allowBackup="false"`, `usesCleartextTraffic="false"`, `@xml/network_security_config`) |
| **GAP-05** | Release keystore SHA-256 fingerprint in `deploy/assetlinks.json` | **Medium (Mobile)** | **Open (Release)** — Debug fingerprint only until Play Store signing key created |
| **GAP-06** | Continuous automated compliance verification script | **Medium (Gov)** | **Closed** (`scripts/compliance-audit-check.mjs`) |

---

## 3. Prioritized Implementation Plan

1. **Immediate (Shipped in `v1.11.0`)**:
   - Enforce Android MASVS manifest & cleartext rules (`AndroidManifest.xml`, `network_security_config.xml`).
   - Ship Rust `gdpr_crypto_shred_account`, `export_account_portability_json`, `evaluate_bsa_compliance`, and `sanctioned_addresses` screening.
   - Pass `cargo clippy --all-targets -- -D warnings` with zero warnings across all 3 Rust crates and automate `scripts/compliance-audit-check.mjs`.
2. **Pre-Launch 30 Days**:
   - Execute Sponsor Bank FBO / custodial partner agreement & BSA/AML KYC provider integration.
   - Provision `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ZENO_TREASURY_SOLANA`, and `ZENO_TREASURY_EVM` via `wrangler secret put`.
3. **Pre-Scale 90 Days**:
   - Complete third-party penetration test, PCI-DSS SAQ-A attestation, and SOC 2 Type I/II auditor evidence collection.

---

## 4. Technical Controls Mapping

- **Blind Privacy & GDPR Erasure**: `apps/rust/zeno-us-core/src/lib.rs` (`UsPrivacyAccount::identity_commitment`, `gdpr_crypto_shred_account`, `export_account_portability_json`).
- **FinCEN Travel Rule / CTR / OFAC Gate**: `apps/rust/zeno-us-core/src/lib.rs` (`FINCEN_TRAVEL_RULE_MICRO`, `FINCEN_CTR_THRESHOLD_MICRO`, `sanctioned_addresses`, `evaluate_bsa_compliance`).
- **Edge Security & SAQ-A Tokenization**: `deploy/build.mjs` (`US_CSP_HEADER`, `COMMON_HEADERS`, `methodNotAllowed`, `readBoundedText`, `POST /api/us/checkout`, constant-time Stripe HMAC verification).
- **Client Zero-Telemetry & WCAG 2.1 AA**: `us.html`, `us.css`, `us.js` (zero inline `style=`, zero `innerHTML`, zero third-party fonts/scripts, `extractable: false` WebCrypto ECDSA P-256, `.skip-link`, `prefers-reduced-motion`).
- **Mobile Hardening**: `apps/android/app/src/main/AndroidManifest.xml`, `apps/android/app/src/main/res/xml/network_security_config.xml`, `apps/rust/zeno-native/src/lib.rs` (`MAX_JNI_BYTES = 16_384`).

---

## 5. Policy & Privacy Notice Templates

### Client Privacy Notice Summary (MIT Surface)
> ZENO US (`/us`) runs 100% locally with **zero third-party cookies, trackers, or advertising beacons**. Client-side ECDSA P-256 signing keys are generated inside your browser WebCrypto keystore with `extractable: false` and never leave your device. Disclosing VAKED or FOKEN metrics does not establish an investment contract; see `https://vaked.dev/whitepaper` and `/licensing-boundary`.

### Data Subject Access / Erasure Flow (GDPR Art. 17 & Art. 20)
1. Account holder withdraws all residual `1:1` USDC/USDT balance to `$0.00`.
2. Backend invokes `gdpr_crypto_shred_account($tag)` — erasing blinded identity commitments (`[0u8; 32]`) and keys while retaining pseudonymous double-entry hashes solely for statutory BSA 5-year recordkeeping.
3. Portability snapshot is generated on demand via `export_account_portability_json($tag)`.

---

## 6. Continuous Audit Procedures

Run the automated compliance and security verification suite on every release:
```bash
node scripts/compliance-audit-check.mjs
node test-us-neobank.mjs
node test-fuzz-api-core.mjs
bash scripts/export-public-client.sh --dry-run
(cd apps/rust/zeno-us-core && cargo clippy --all-targets -- -D warnings && cargo test)
(cd apps/rust/zeno-issuer-angel && cargo clippy --all-targets -- -D warnings && cargo test)
(cd apps/rust/zeno-native && cargo clippy --all-targets -- -D warnings && cargo test)
```

---

## 7. Auditor Evidence & Recordkeeping Matrix

| Artifact | Location | Purpose |
|---|---|---|
| Immutable Double-Entry Seals | Rust `KintsugiTx` (`0x62` WUPZ trace chain) | Integrity & financial conservation evidence |
| Automated Compliance Scorecard | `scripts/compliance-audit-check.mjs` | Continuous CI technical control verification |
| Security Audit & RFC-008 | `spec/SECURITY_AUDIT_REPORT_RFC008.md`, `spec/RFC-008-US-USDC-USDT-OPEN-CORE.md` | Threat model, 13 remediations & open-core split |
| MIT Bundle Manifest | `dist/zeno-8b-is/public-client-manifest.json` | Supply-chain SHA-256 attestation & zero secret leakage |

---

## 8. Workforce Security & Compliance Training Checklist

1. **Zero-Secrets Hygiene**: Never commit `.env`, `.dev.vars`, `.pkpass`, `.pem`, `.key`, or `.zeno-local/` artifacts; manage Edge secrets exclusively via `wrangler secret put`.
2. **BSA/AML Escalation**: Any suspicious structuring (`SPLIT_TX`), daily limit bypass attempt, or OFAC hit (`UsCoreError::ComplianceBlocked`) must be logged and escalated before manual intervention.
3. **No-Float Financial Arithmetic**: All money, FX, and fee calculations must use Rust integer micro-USD / `p/q` `Rational` or JS `BigInt`.
