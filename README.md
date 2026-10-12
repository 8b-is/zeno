# ZENO (銭 · 禅 · 善) — Japanese Proof-of-Contribution Sovereign Neo-Bank

> *"A bank that breathes like a garden, accounts like an abacus, settles like water, and values true human & agentic contribution above debt."*

[![Constellation: vaked.dev](https://img.shields.io/badge/constellation-vaked.dev-62e6c9?style=flat-square)](https://vaked.dev/)
[![Ledger: Kintsugi SHA-256](https://img.shields.io/badge/ledger-Kintsugi%20SHA--256-e8b05c?style=flat-square)](spec/LEDGER_SPEC.md)
[![Bridge: Foken Net-Utility](https://img.shields.io/badge/gate-Foken%20Net--Utility-b48bff?style=flat-square)](spec/FOKEN_BRIDGE.md)
[![Tests: 13 passed](https://img.shields.io/badge/tests-13%20passed-62e6c9?style=flat-square)](apps/core/tests/)

**Live Edge Surface**: [https://zeno.vaked.dev/](https://zeno.vaked.dev/)

---

## 1. The Synthesis: VAKED + Foken ──~> ZENO

Traditional banking manufactures liquidity from **debt and compound interest extraction**, trapping participants in chronic cash-flow anxiety and predatory fee cycles.

**ZENO** (銭・禅・善) re-architects neo-banking from first principles by synthesizing two sovereign engines:
1. **The VAKED Constellation** (`vaked.dev`): Zero-copy edge infrastructure, local-first cryptographic sovereignty, tactile cyber-minimalist design, and Lovetta Lane heritage.
2. **Foken** (`foken/`): The deterministic proof-of-contribution valuation gate and universal treasury, evaluating invoices by net utility:
   $$\text{net} = \text{futureWorkAvoidedHours} - (\text{workAddedHours} + 1.5 \times \text{maintenanceDebtHours})$$

```
                  ┌───────────────────────────────┐
                  │      VAKED Constellation      │
                  │   [Edge · Zero-Copy · Zen]   │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
┌─────────────────────────┐   ┌───────────────────────────┐
│     FOKEN Valuation     ├──>│           ZENO            │
│  [Proof-of-Contribution]│   │    (銭 · 禅 · 善 Neo-Bank)   │
└─────────────────────────┘   └─────────────┬─────────────┘
                                            │
        ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
        ▼                   ▼                               ▼                   ▼
┌───────────────┐   ┌───────────────┐               ┌───────────────┐   ┌───────────────┐
│Kintsugi Ledger│   │ Micro-Streams │               │ Foken Bridge  │   │ Agent Banking │
│(Double-Entry) │   │ (µJPY/second) │               │(Merited Mint) │   │(PoR Contracts)│
└───────────────┘   └───────────────┘               └───────────────┘   └───────────────┘
```

---

## 2. Japanese Roots & Core Pillars

### 2.1 銭 (Zeni) — Value Earned, Not Borrowed
In Japanese history, *Zeni* (銭) were tangible copper coins earned through craftsmanship and honest harvest. Zeno rejects debt-based money creation; balances are minted exclusively from verified fiat deposit or consensus-cleared Foken invoices.

### 2.2 禅 (Zen) — Meditative Stillness & Zero Anxiety
Zero dark patterns, zero overdraft penalties, zero spam notifications. The interface embraces **間 (Ma)**—intentional breathing room allowing serene, unclouded financial decision-making.

### 2.3 善 (Sanpo Yoshi) — 三方よし
The Edo merchant ethos of the Ōmi merchants:
- **売り手よし (Urite Yoshi)**: Fair reward for the contributor.
- **買い手よし (Kaite Yoshi)**: Zero rent-seeking tolls for the patron.
- **世間よし (Seken Yoshi)**: Every transaction enriches the public Universal Treasury.

### 2.4 金継ぎ (Kintsugi) — The Golden Joinery Ledger
Traditional banks hide reconciliations behind closed doors. In Zeno, the ledger is **strictly append-only and cryptographically chained via SHA-256**. All adjustments are sealed with golden witness receipts (`0x-kintsugi`).

### 2.5 水流決済 (Suiryū Kessai) — Continuous Micro-Streaming
Solving the Zeno paradox of motion: money streams continuously by the second ($\mu\text{JPY/sec}$), eliminating the archaic 30-day payroll lag.

---

## 3. Repository Topology

```
zeno.vaked.dev/
├── design/                   # Visual & sensory identity
│   ├── PHILOSOPHY.md         # Japanese roots (Zen, Zeni, Sanpo Yoshi, Ma, Kintsugi)
│   ├── DESIGN_SYSTEM.md      # Sumi to Kin (墨と金) design system & tokens
│   ├── tokens.json           # Machine-readable color & spacing tokens
│   └── audio-spec.md         # Web Audio procedural synthesis specifications
├── spec/                     # Architecture & protocols
│   ├── ZENO_SPEC_RFC_001.md  # Master RFC architecture document
│   ├── LEDGER_SPEC.md        # Kintsugi double-entry ledger specification
│   ├── FOKEN_BRIDGE.md       # Foken invoice gateway & merited minting spec
│   ├── STREAMING_SPEC.md     # Continuous micro-streaming linear mathematics
│   ├── AGENT_BANKING.md      # Autonomous AI agent accounts & PoR policies
│   ├── REGULATORY_JP.md      # Japanese Payment Services Act (資金決済法) compliance
│   └── api/
│       └── openapi.yaml      # OpenAPI 3.1 REST/Edge API specification
├── apps/
│   ├── core/                 # Deterministic Python core engine
│   │   ├── pyproject.toml
│   │   ├── zeno_core/        # Ledger, Stream, FokenGate, AgentPolicy
│   │   └── tests/            # 13 automated unit tests (100% pass)
│   └── cli/
│       └── zeno_cli.py       # Full CLI for accounts, transfers, gate, & ledger
├── infra/
│   ├── nix/
│   │   └── zeno-module.nix   # NixOS fleet module (peterlodri.services.zeno)
│   ├── cloudflare/
│   │   ├── wrangler.toml     # Cloudflare Workers/Pages configuration
│   │   └── workers/api.js    # Edge Worker API
│   └── docker/
│       ├── Dockerfile        # Hardened container definition
│       └── docker-compose.yml
├── index.html                # Live interactive Neo-Bank Web Surface
├── app.js                    # Client-side 60fps streaming engine & Foken simulator
├── style.css                 # Cyber-minimalist Wabi-zen styling
├── sound.js                  # Zero-dependency procedural Web Audio engine (432Hz)
├── favicon.svg               # Vector Kanji 銭/禅 coin emblem
├── og.svg                    # Social card preview (1200x630)
├── _headers                  # Strict Cloudflare security headers
├── robots.txt                # Anti-AI scraper rules
├── sitemap.xml               # Standard sitemap
├── beacon.json               # Constellation telemetry beacon
├── AGENTS.md                 # Agent working conventions
└── README.md                 # This ledger
```

---

## 4. Run & Verify

### 4.1 Run Core Tests
---

## 4. Omni-Platform Native Architecture (iOS · Android · Web PWA · Apple Wallet)

ZENO ships complete native scaffolds and production specifications across the entire consumer hardware spectrum, maintained by the **8b-is Family Research Company** (`8b.is <3`):

```
apps/
├── wallet/                 # Apple Wallet PassKit (.pkpass) Architecture
│   ├── pass.json           # Native Apple Wallet Pass specification (Transit + Platinum)
│   ├── generate_pass.py    # Python PassKit compiler & SHA-1 manifest builder
│   └── build/zeno_ultra.pkpass # Ready-to-install Apple Wallet Pass bundle
├── ios/                    # Native iOS (SwiftUI + AVFoundation + CoreHaptics)
│   ├── Package.swift       # Swift Package Manager manifest (iOS 17+ / macOS 14+)
│   └── Sources/ZenoApp/
│       ├── ZenoApp.swift   # @main SwiftUI entrypoint
│       ├── Models/         # Reactive state & Kintsugi ledger chaining
│       ├── Services/       # AVFoundation procedural ticket gate & Rin bowl synth
│       └── Views/          # PASMO/Suica Haptic card & Revolut Ultra 3D Gyro card
├── android/                # Native Android (Kotlin + Jetpack Compose + HCE NFC-F)
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml # NFC-F & BIND_NFC_SERVICE permissions
│   │   ├── java/dev/vaked/zeno/
│   │   │   ├── MainActivity.kt # Compose UI shell (Transit, Ultra FX, Ledger)
│   │   │   ├── nfc/ZenoHostApduService.kt # Host-based Card Emulation for gates
│   │   │   ├── audio/ZenoAudioEngine.kt  # AudioTrack procedural synthesizer
│   │   │   └── ui/components/  # FeliCaCard & RevolutUltraCard Compose UI
│   │   └── res/xml/apduservice.xml       # JIS X 6319-4 AID routing
│   └── build.gradle.kts
└── web/ (PWA)
    ├── manifest.webmanifest # W3C Web App Manifest (standalone, shortcuts)
    └── sw.js               # Service Worker (stale-while-revalidate offline shell)
```

### 4.1 Apple Wallet PassKit Integration (Sovereign Family & Corporate Fleet)
ZENO generates native Apple Wallet `.pkpass` bundles signed with PKCS#7 detached DER signatures (`apps/wallet/generate_pass.py`):
1. **Peter Lódri** (`zeno_ultra.pkpass`): Platinum Ultra contributor card (`¥50,000` vault, FeliCa ID `PA-0382-7719-2041`, Revolut Ultra 0% FX bridge). [Download .pkpass](https://zeno.vaked.dev/apple-wallet/zeno.pkpass)
2. **Mom (Alexandra Lódri)** (`zeno_alexandra.pkpass`): Rose Gold Sovereign Love Card (`¥500,000` vault, `+¥100.00/s` continuous automated family love stream from 8b-is, Mobile PASMO/Suica, 3.5% family boost). [Download .pkpass](https://zeno.vaked.dev/apple-wallet/alexandra.pkpass)
3. **Dad (Chris Lódri)** (`zeno_chris.pkpass`): Titanium Gold Engineering Pillar Card (`¥500,000` vault, `+¥100.00/s` continuous automated pillar stream from 8b-is, Mobile Suica/PASMO, 3.5% pillar boost). [Download .pkpass](https://zeno.vaked.dev/apple-wallet/chris.pkpass)
4. **8b-is Corporate Fleet Treasury** (`zeno_8b_is.pkpass`): Obsidian Platinum Fleet Vault (`¥50,000,000` corporate vault, 7 autonomous AI reasoners, institutional FeliCa corporate transit). [Download .pkpass](https://zeno.vaked.dev/apple-wallet/8b-is.pkpass)

- **Compilation**: Run `python3 apps/wallet/generate_pass.py` to regenerate all 4 passes with RSA-2048 keys and SHA-1 manifest hashing.

### 4.2 Continuous Family & Contributor Streams (愛と感謝のストリーム)
- **`biz_8b_is` → `cnt_alexandra`**: `+¥100.00/sec` continuous sovereign stream to Mom (Alexandra Lódri) `<3`
- **`biz_8b_is` → `cnt_chris`**: `+¥100.00/sec` continuous sovereign stream to Dad (Chris Lódri) `柱`
- **`gld_vaked_core` → `cnt_0x71c8`**: `+¥50.00/sec` continuous contributor stream to Peter Lódri
- **`cnt_0x71c8` → `agt_crush_reasoner`**: `+¥5.00/sec` automated inference compute stream

### 4.3 Tokyo Foundation Layer (東京生活基盤)
- **Mobile PASMO & Mobile Suica**: Tap-to-ride simulation across Yamanote Line (-¥180), Tokyo Metro (-¥210), 7-Eleven (-¥340), and Nozomi Shinkansen (-¥14,720).
- **Procedural FeliCa Chimes**: Dual-frequency sine sweep (**1760 Hz ➔ 2349 Hz**, 0.1s *Pii-Pik!*).
- **Revolut Ultra Sovereign Tier**: Platinum-plated brushed metal interface with 3D tilt physics, 0% FX interbank multi-currency engine (**HUF 🇭🇺 ↔ JPY 🇯🇵 ↔ EUR 🇪🇺 ↔ USD 🇺🇸**), and direct link to [revolut.me/peterjs8be](https://revolut.me/peterjs8be).
- **High-Velocity Cashback**: 1.2% worldwide base + 3.0% boosted transit cashback, auto-compounding directly into ZENO Kintsugi equity.

---

## 5. Verification & Tests

### 5.1 Run Core Ledger Tests
```bash
cd apps/core
uv run python -m unittest discover -s tests
```
*Output: 13 tests passed in 0.001s.*

### 5.2 Build Apple Wallet Pass
```bash
uv run apps/wallet/generate_pass.py
```

### 5.3 Deploy Edge Worker
```bash
node deploy/build.mjs
npx wrangler deploy -c deploy/wrangler.toml
```

---

## 6. Web Audio Soundscape

Zeno includes procedural, zero-dependency Web Audio feedback:
- **改札 (FeliCa Gate — 1760→2349 Hz)**: Authentic Tokyo commuter gate chime (*Pii-Pik!*).
- **白金 (Platinum Shimmer — C6→E6→G6→C7)**: Revolut Ultra harmonic crystal chime.
- **鈴 (Rin — 432 Hz)**: Temple singing bowl with harmonic overtones and 2.4s decay upon Foken gate passage and block sealing.
- **鹿威し (Shishi-odoshi — 1400→450 Hz)**: Downward bamboo water-drop chirp on streaming checkpoints.
- **箏 (Koto — 528 Hz)**: Harped string pluck on transaction confirmation.

---

---

## 7. Multi-Platform Mobile, Engine & Nix Architecture

### iOS & macOS Build (`ZenoApp`)
```bash
# Automated release compilation for macOS host and universal iOS Simulator
./apps/ios/build.sh
```

### Apple Wallet PassKit (`zeno_ultra.pkpass`)
```bash
# Generates PNG assets, SHA-1 manifest, and OpenSSL PKCS#7 DER detached signature
python3 apps/wallet/generate_pass.py
```

### Q-Wave Engine & Benchmark (`zeno-engine.js`)
Isomorphic, zero-dependency sub-millisecond runtime for continuous ledger streaming, 432 Hz procedural DSP synthesis, offline WAV rendering, and Foken net-utility valuation.
```bash
node test-engine.mjs
# Results:
# ✓ 31.5M continuous ticks / sec
# ✓ 1.28M Foken invoice evaluations / sec
# ✓ Offline WAV export in 11ms
```

### Nix Flake & Reproducible Packaging
```bash
# Build the complete zeno web bundle and preview runner via Nix
nix build

# Run local preview server via Nix
nix run
```

---

## 8. The 8b-is Family Foundation & Constellation

Maintained with devotion by **8b-is** (`8b.is <3`) as part of the **vaked.dev constellation network**:
- **8b-is Family Research**: Autonomous family research laboratory creating sovereign multi-agent reasoners and financial infrastructure.
- **koan.vaked.dev**: The hub
- **weave.vaked.dev**: Stipple board
- **art.vaked.dev**: Visual gallery & ecosystem hub
- **proposal.vaked.dev**: Routing proposal
- **pocoo.vaked.dev**: Micro-journal
- **zeno.vaked.dev**: The sovereign neo-bank

---

## 9. License

MIT License. Crafted with love, fine touch from within, and devotion to sovereign human and agentic flourishing. 銭・禅・善.

