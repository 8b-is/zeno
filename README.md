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
```bash
cd apps/core
uv run python -m unittest discover -s tests
```
*Output: 13 tests passed in 0.001s.*

### 4.2 Use the Zeno CLI
```bash
# List accounts and balances
uv run python apps/cli/zeno_cli.py account list

# Create a new contributor account
uv run python apps/cli/zeno_cli.py account create \
  --id cnt_takashi --label "Takashi Sato" --type liability

# Evaluate a Foken invoice through the deterministic gate
uv run python apps/cli/zeno_cli.py gate path/to/invoice.json

# Verify Kintsugi ledger cryptographic integrity
uv run python apps/cli/zeno_cli.py verify
```

### 4.3 Launch Local Web Surface
```bash
python3 -m http.server 8089
# Open http://localhost:8089 in your browser
```

---

## 5. Web Audio Soundscape

Zeno includes procedural, zero-dependency Web Audio feedback:
- **鈴 (Rin — 432 Hz)**: Temple singing bowl with harmonic overtones and 2.4s decay upon Foken gate passage and block sealing.
- **鹿威し (Shishi-odoshi — 1400→450 Hz)**: Downward bamboo water-drop chirp on streaming checkpoints.
- **箏 (Koto — 528 Hz)**: Harped string pluck on transaction confirmation.

---

## 6. Constellation Wiring

Part of the **vaked.dev constellation network**:
- **koan.vaked.dev**: The hub
- **weave.vaked.dev**: Stipple board
- **art.vaked.dev**: Visual gallery & ecosystem hub
- **proposal.vaked.dev**: Routing proposal
- **foken**: Proof-of-contribution valuation gate
- **zeno.vaked.dev**: The sovereign neo-bank

---

## 7. License

MIT License. Crafted with love, fine touch from within, and devotion to sovereign human and agentic flourishing. 銭・禅・善.
