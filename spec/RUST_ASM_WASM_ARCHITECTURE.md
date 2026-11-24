# ZENO Rust + Inline Assembly + Client-Side WebAssembly Architecture (`v1.12.0`)

> **Status**: Active · **Surface**: ZENO (`zeno.vaked.dev`, `zeno.8b.is`) · **License Split**: `zeno-client.wasm` (MIT Public Client) vs `apps/rust/zeno-asm` & `apps/rust/zeno-us-core` (Private Core)

---

## 1. End-to-End Rust + Assembly Philosophy

ZENO enforces deterministic, **zero-float** (`p/q` rationals and integer micro-USD, `1 USD = 1_000_000 µUSD`) computation from bare-metal CPU registers up to the browser DOM:

| Layer | Crate / Artifact | Compilation Target | Safety Boundary | Role |
|---|---|---|---|---|
| **Hardware ASM Kernels** | `apps/rust/zeno-asm` | `aarch64-apple-darwin`, `aarch64-linux-android`, `x86_64`, portable fallback | Isolated `core::arch::asm!` verified by 1,000-vector differential fuzzing | NEON `cnt`/`addv`/`umov` popcount, `eor` 4-way XOR-fold, `rbit`/`clz` Stein GCD, branchless constant-time 32B digest compare |
| **Private Sovereign Core** | `apps/rust/zeno-us-core` | Native server / Android JNI | `#![no_std]` · **`#![forbid(unsafe_code)]`** | Double-entry zero-sum Kintsugi ledger, BSA/FinCEN/OFAC, GDPR Art. 17/20, Sanpo Yoshi subscriptions |
| **Issuer Angel & Native JNI** | `apps/rust/zeno-issuer-angel`, `apps/rust/zeno-native` | ARM64 Android `.so` + host | `#![no_std]` core + bounded 16 KiB JNI | Google/Apple Wallet `p/q` transit & SHA-256/WUPZ sealing |
| **Client-Side Rust WASM** | `apps/rust/zeno-wasm-client` -> `zeno-client.wasm` | `wasm32-unknown-unknown` (`6,987 B`) | `#![no_std]` (on `wasm32`), zero heap allocator, bounded 1 KiB scratch | Runs live inside `/us` browsers & Node test parity |

**Key architectural rule**: `zeno-us-core` MUST retain `#![forbid(unsafe_code)]`. All hardware inline assembly (`core::arch::asm!`) lives strictly inside `apps/rust/zeno-asm/`.

---

## 2. Implemented Crates & Verified Kernels

### 2.1 `apps/rust/zeno-asm` (Inline Assembly)
- **`wupz_xor_fold_asm`**: 4-way unrolled 64-byte XOR fold using `aarch64` `eor` (`x86_64` `xor` / portable fallback). Bit-identical to `zeno_issuer_angel::wupz_xor_fold`.
- **`wupz_popcount_asm`**: `aarch64` NEON `fmov d0, {x}; cnt v0.8b, v0.8b; addv b0, v0.8b; umov {out:w}, v0.b[0]` (and `x86_64` `popcnt` when enabled) for bit-counting witness streams.
- **`ct_eq_32_asm`**: Constant-time 32-byte equality (`aarch64` `eor`/`orr`/`cmp`/`cset`; `x86_64` `xor`/`or`/`test`/`sete`) with zero secret-dependent branches.
- **`gcd_u64_asm`**: Stein's binary GCD accelerated via `aarch64` `rbit` + `clz` (`ctz_u64`).
- Cross-checked cleanly with `cargo check --target aarch64-linux-android` (Samsung Galaxy S24 Ultra ARMv9), `cargo clippy --all-targets -- -D warnings`, and a 1,000-vector differential fuzz suite.

### 2.2 `apps/rust/zeno-wasm-client` (`zeno-client.wasm` · `6,987` bytes)
Compiled with `opt-level = "z"`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`, and zero Cargo dependencies:
- Uses a static `1024`-byte linear-memory scratch buffer (`zeno_scratch_ptr`, `zeno_scratch_len`) so JS never links `wasm-bindgen` or a heap allocator while keeping every slice access strictly bounds-checked.
- Exports C-ABI entrypoints (`#[unsafe(no_mangle)] pub extern "C" fn`):
  - `zeno_wasm_version() -> u32` (`1120`)
  - `zeno_gcd_u64(a, b) -> u64`
  - `zeno_fx_convert_micro(amount_micro, currency_id) -> u64` (`USD=1/1`, `JPY=305/2`, `EUR=23/25`, `GBP=79/100`, `HUF=737/2`)
  - `zeno_sanpo_yoshi_family`, `zeno_sanpo_yoshi_foken`, `zeno_sanpo_yoshi_operating` (exact `50/30/20` micro-USD residual)
  - `zeno_foken_net_milli_hours(avoided, added, debt) -> i64`
  - `zeno_validate_solana_b58(offset, len) -> i32` (full 32-byte Base58 decode + all-zero rejection)
  - `zeno_wupz_xor_fold(offset, len) -> u64`, `zeno_wupz_popcount(offset, len) -> u32`, `zeno_ct_eq_32(off_a, off_b) -> i32`

---

## 3. Client-Side Rust Ecosystem Research & Tradeoff Matrix

To guide ZENO's evolution from a pure `#![no_std]` WASM compute core toward optional full-stack Rust UI or edge Rust workers, we evaluated the five primary 2025/2026 Rust client/edge architectures:

| Approach | Typical WASM Size | UI / Rendering Model | Local Dev / Toolchain | Best ZENO Fit |
|---|---|---|---|---|
| **1. Bare `#![no_std]` `wasm32-unknown-unknown` Micro-Kernel (Active Today)** | **`~7 KiB`** | Safe vanilla DOM shell (`us.js`) + WASM math/crypto/validation | Zero external tools (`rustup target add wasm32-unknown-unknown`) | Instant mobile load (`0 ms` parse), strict zero-dependency auditability, MIT client drop-in |
| **2. Leptos** | `~120–300 KiB` (gzipped) | Fine-grained Solid-style signals (no Virtual DOM), direct DOM mutations, SSR + hydration | `cargo-leptos` / `trunk` + `wasm-bindgen` | Replacing `us.js` entirely with Rust reactive UI when SEO SSR + single-language web UI is desired |
| **3. Dioxus (`dx` CLI installed at `/opt/homebrew/bin/dx`)** | `~250–600 KiB` | Unified `rsx!` component model (VDOM / Blitz), cross-compiles to **Web WASM, macOS/Linux Desktop, iOS, and Android** | `/opt/homebrew/bin/dx` already present on workstation | Unifying `/us` web UI with native `zeno-android` & `zeno-ios` screens from one Rust repo |
| **4. Makepad** | `~1–3 MiB` | GPU-native immediate-mode rendering via **WebGL / WebGPU / Metal / Vulkan** (bypasses HTML DOM) | `cargo-makepad` | High-frequency automated quant trading terminal & sub-millisecond Kintsugi orderbook canvas |
| **5. Cloudflare Workers Rust (`workers-rs`)** | `~200–700 KiB` | Edge `fetch()` compiled to `wasm32-unknown-unknown` inside V8 isolates | `worker-build` + `wrangler` | Migrating `deploy/build.mjs` Worker routes & Stripe/ACP settlement validation to Rust WASM (`panic=unwind` / `C-unwind` recovery, well under Cloudflare's 1 MiB free / 10 MiB paid compressed limit) |

### Recommended Staged Roadmap
1. **Stage 1 (Shipped in `v1.12.0`)**: Keep `/us` instantaneous and dependency-free via the `~7 KiB` `zeno-client.wasm` `#![no_std]` kernel paired with `us.js` safe DOM (`createElement` + `textContent`).
2. **Stage 2 (Edge Worker in Rust)**: Port `/api/us/*` + ACP Worker routing from `deploy/build.mjs` to `workers-rs` so server and browser share identical Rust `zeno-us-core` types.
3. **Stage 3 (Unified Native + Web UI via Dioxus `dx` / Leptos)**: Evaluate `dx` (`Dioxus`) for shared Web + Galaxy S24 Ultra Android + iOS UI screens while retaining `zeno-asm` NEON kernels underneath via FFI/JNI.

---

## 4. Security, CSP `'wasm-unsafe-eval'`, and Open-Core Boundaries

- **W3C CSP Level 3 `'wasm-unsafe-eval'`**: `/us` enforces:
  `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`
  Unlike `'unsafe-eval'`, `'wasm-unsafe-eval'` permits ONLY compiled WebAssembly instantiation (`WebAssembly.instantiateStreaming`) while keeping JavaScript `eval()`, `new Function()`, and inline scripts completely blocked.
- **Open-Core Separation**: `zeno-client.wasm` exposes ONLY public MIT deterministic arithmetic, FX ratios, Sanpo Yoshi splits, and Base58 syntax validation. Private custody, HSM signing, FinCEN BSA/OFAC screening (`zeno-us-core`), and hardware inline assembly (`zeno-asm`) never ship to the client bundle.
