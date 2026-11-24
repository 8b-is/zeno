# Security Audit & Attack-Surface Reduction Report — ZENO US (`RFC-008`)

**Audit Date**: 2026-11-24 · **Methodology**: Parallel 3-Auditor Swarm (`sec-rust`, `sec-edge-js`, `sec-supply-git`) + Subagent Verification  
**Scope**: `apps/rust/zeno-us-core`, `apps/rust/zeno-issuer-angel`, `apps/rust/zeno-native`, `deploy/build.mjs`, `_headers`, `sw.js`, `zeno-engine.js`, `us.html`, `us.css`, `us.js`, `scripts/*.sh`, `deploy/zeno.8b.is.Caddyfile`, `.gitignore`.

---

## Summary of Findings & Verified Remediations

| ID | Severity | Component | Finding | Remediation Applied |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **CRITICAL** | `zeno-us-core` | Missing `(chain, tx_hash)` & `invoice_id` replay protection allowed repeat minting | Added `seen_deposits` + `seen_invoices` `BTreeSet`s returning `UsCoreError::ReplayDetected` |
| **SEC-02** | **CRITICAL** | `zeno-us-core` | `KintsugiTx` seal hashed only `seq\|kind\|memo`, not posting accounts/amounts | Canonical `ZENO:TX:V1:` length-prefixed framing now authenticates `seq`, `kind`, `memo`, and every `(account, amount_micro)` posting |
| **SEC-03** | **CRITICAL** | `zeno-us-core`, `build.mjs`, `zeno-engine.js` | Foken gate allowed weak `sha256://` / `0x1` strings, uncapped `selfAssessedFokens`, and negative `workAddedHours` / `maintenanceDebtHours` | Enforced strict hex provenance/signature formats, non-negative bounded integers, and proportional `<= 100 FKN/hr` valuation cap (`<= 250,000 FKN`) |
| **SEC-04** | **HIGH** | `zeno-us-core` | `daily_cap_micro` defined on `PrivacyTier` but never enforced (split-tx bypass) | Added `daily_day_epoch` + `daily_volume_micro` enforcement across mint, redeem, P2P send, and Foken settlement |
| **SEC-05** | **HIGH** | `zeno-native` | Unchecked `jint as usize` / `u8` casts across JNI `extern "system"` FFI could panic or wrap | Added `TryFrom` bounds, `idm.len() == 8`, `MAX_BLOCKS_PER_READ`, `MAX_JNI_BYTES = 16_384`, and checked arithmetic in `felica.rs` |
| **SEC-06** | **HIGH** | `zeno-us-core` | Unbounded strings, non-atomic balance/reserve mutations, and 4 `.expect()` calls in library code | Bounded all input lengths (`InputTooLong`), switched to prepare-then-commit atomic updates, replaced `.expect()` with `ok_or(InternalInvariant)?` |
| **SEC-07** | **HIGH** | `deploy/build.mjs`, `_headers`, `sw.js` | Worker omitted `X-Frame-Options`, `COOP`, `CORP`, strict `/us` CSP; `_headers` had `'unsafe-eval'`; SW cached `/api/*` & non-200 HTML | Added `X-Frame-Options: DENY`, `COOP`, `CORP`, strict zero-inline `/us` CSP (`script-src 'self'; style-src 'self'`), removed `'unsafe-eval'`, and bypassed `/api/*` + `no-store` in `sw.js` |
| **SEC-08** | **HIGH** | `zeno-engine.js` | `ContinuousStreamEngine.spend` accepted negative values (balance inflation) | Added positive finite validation in both `deposit` and `spend` |
| **SEC-09** | **MEDIUM** | `us.html`, `us.css` | External Google Fonts leaked user IP/referrer; inline `style=` blocked strict CSP | Removed `fonts.googleapis.com` links (0 external requests) and moved all styles to `us.css` |
| **SEC-10** | **MEDIUM** | `us.js`, `zeno-engine.js` | WebCrypto key generated with `extractable: true`; `parseUsdToMicro` stripped `-`; tampered `localStorage` `seedState` not verified | Changed to `extractable: false`, rejected `-`/`+`/`e` in `parseUsdToMicro`, and enforced parity + double-entry audit on `seedState` hydration |
| **SEC-11** | **MEDIUM** | `deploy/build.mjs` | Unbounded POST bodies, missing HTTP `405`, raw `err.message` leaks, `/icons/toString` & `__proto__` webhook 500 crashes | Added `readBoundedText`, `methodNotAllowed` (`405`), `Object.hasOwn(ICONS_BASE64, name)`, `Object.create(null)` for webhook sigs, and generic JSON errors |
| **SEC-12** | **MEDIUM** | `zeno-issuer-angel` | Silent `concurrency_lanes as u16` truncation and premature `i64` cast in `coverage_ratio` | Used `u16::try_from` and GCD reduction in `u64` prior to `i64` conversion |
| **SEC-13** | **MEDIUM** | `scripts/*.sh`, `Caddyfile`, `.gitignore` | Option injection in `deploy-zeno-8b-is.sh`, Caddyfile copied into MIT bundle, unescaped JSON manifest, unstripped forwarding headers, `.st/` & `*.pkpass` missing from `.gitignore` | Validated `user@host`, removed Caddyfile from `$DIST_DIR`, serialized manifest via `node`, stripped untrusted proxy headers in Caddy, expanded `.gitignore` |
