# ZENO Family Trust · VAKED · FOKEN -> Solana SPL-USDC End-to-End Pipeline

This specification documents the end-to-end architecture connecting **VAKED**, **FOKEN**, the **ZENO Family Trust**, and **Solana Mainnet SPL-USDC** payouts (`zeno.vaked.dev` and `zeno.8b.is`).

---

## 1. Strict Three-Tier Sovereign Backing Separation

Under ZENO Hard Rule #3 (**No Debt Minting**) and the **VAKED Whitepaper v1.2** (§2 & §6), liabilities and utility attestations MUST stay strictly separated so off-chain governance scores or PoW utility stamps never forge unbacked dollar claims:

| Tier | Instrument | Network / Source | USD Backing Weight (`p/q`) | Legal / Accounting Role |
|---|---|---|---|---|
| **Tier 1** | **Liquid USDC + USDT** | Solana Mainnet (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` / `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`), Base, Ethereum | **`1/1`** (`1.00 USD = 1_000_000 µUSD`) | **Sole liquid backing** for ZENO US balances and outbound SPL-USDC payouts |
| **Tier 2** | **FOKEN Proof-of-Contribution** | Off-chain Foken gate (`foken/`) + `constellation.json` (19 projects, 2,406 net-utility hrs) | **`0/1`** (allocation weight only until funded custody settles) | Determines merited contribution priority in the ZENO Family Trust |
| **Tier 3** | **VAKED PoW Utility Token** | Polygon PoS (`0x2Ae7DA713A2c8527AF70825C0F79632AF2e2ae4A`), 21M cap, `owner() == address(0)` | **`0/1`** (`financialClaim = false`) | Proof-of-presence & Sovereign Library attestation per `vaked.dev/whitepaper` |

> **Critical Integrity Rule**: Holding FOKEN or Polygon PoS VAKED never mints on-chain Solana USDC out of thin air. Outbound Solana SPL-USDC payouts require funded Tier-1 Solana custody (`USDC_ATA >= payout_micro`) and a real Ed25519 Solana signature.

---

## 2. Canonical Solana Mainnet Parameters

- **Network**: `solana-mainnet-beta`
- **SPL Token Program**: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- **USDC Mint (6 decimals)**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **USDT Mint (6 decimals)**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **First Launch Test Recipient (Coinbase Wallet, Solana)**:
  - Address: `HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS`
  - Length: `44` Base58 chars -> validated `32`-byte Ed25519 pubkey (`0xf9dfbe49...`)
  - Test Amount: `200 USDC` (`200_000_000` integer micro-USD, zero float)

---

## 3. How the End-to-End Flow Works (`apps/rust/zeno-us-core` -> MIT Client)

1. **Private Rust `#![no_std]` Core (`apps/rust/zeno-us-core`)**:
   - `decode_solana_pubkey(address)` verifies Base58 alphabet, bounds, exact 32-byte payload, and rejects the all-zero key.
   - `family_trust_backing(...)` computes integer `FamilyTrustBackingSnapshot` enforcing `liquid_usd_backing_weight = 1/1`, `foken_usd_backing_weight = 0/1`, `vaked_usd_backing_weight = 0/1`.
   - `prepare_solana_usdc_payout(...)` checks per-tx and daily privacy-tier caps, verifies `acct.balance_micro >= amount_micro` and `reserves.usdc_micro >= amount_micro`, formats exact integer decimal amount (`200`), seals an **UNSIGNED** `SolanaUsdcPayoutIntent` with `0x62` WUPZ trace chaining (`status = "UNSIGNED_AWAITING_SOLANA_SIGNER"`), and emits both the **Solana Pay URI** and exact **`spl-token transfer`** command.
2. **Safe Isomorphic MIT Client (`/us` -> Pay Tab)**:
   - Renders a scannable **Solana Pay QR** (`qrcode.js`) encoding:
     ```text
     solana:HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS?amount=200&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=ZENO%20Family%20Trust&memo=ZENO%20Family%20Trust%20Test%20%231
     ```
   - Never simulates or fabricates a fake on-chain transaction signature.

---

## 4. Operator Runbook: Sending the Live 200 USDC Test

Because signing keys and funded USDC custody never live inside an unprivileged CI/build workspace, execute the live transfer from your funded Solana wallet:

### Option A — Mobile / Hardware Wallet (Solana Pay QR)
1. Open `https://zeno.vaked.dev/us` -> **Pay · $zenotag**.
2. Review pre-filled recipient `HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS` and amount `200.00` USDC.
3. Scan the QR code with **Coinbase Wallet**, **Phantom**, **Solflare**, or **Backpack** (or click **Open in Solana Wallet**) and confirm signing.

### Option B — Solana CLI (`mainnet-beta`)
```bash
# 1. Install Anza/Solana CLI (if not installed)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# 2. Target mainnet-beta & inspect your funded treasury keypair + SOL fee balance
solana config set --url https://api.mainnet-beta.solana.com
solana balance
spl-token balance EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# 3. Execute live 200 USDC SPL transfer (creates recipient ATA if unfunded; requires ~0.00204 SOL fee reserve)
spl-token transfer \
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  200 \
  HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS \
  --fund-recipient \
  --allow-unfunded-recipient
```

---

## 5. Dual-Domain Launch Matrix

- **Primary Edge Worker (`zeno.vaked.dev`)**: `wrangler deploy -c deploy/wrangler.toml`
- **Mirror Surface (`zeno.8b.is`)**: `bash scripts/deploy-zeno-8b-is.sh --push <user>@5.78.220.57`
