# ZENO US Monetization, Subscriptions & Automated Trading Spec (`v1.9.0`)

This document specifies how **ZENO US** (`zeno.vaked.dev` and `zeno.8b.is`) monetizes usage, recurring subscriptions, and automated stablecoin strategies using deterministic integer micro-USD + `p/q` rational billing while splitting net revenue under the **Sanpo Yoshi (三方よし) 50 / 30 / 20** allocation rule.

---

## 1. Top 7 USDC + USDT Settlement Networks

All 7 high-liquidity settlement networks are wired in both the private Rust core (`apps/rust/zeno-us-core`) and the MIT safe isomorphic JS client (`zeno-engine.js`, `/api/us/networks`):

| Network | Chain ID | Address Format | USDC Contract | USDT Contract |
|---|---|---|---|---|
| **Solana** (`solana`) | `mainnet-beta` | Base58 (32B Ed25519) | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| **Base** (`base`) | `8453` | EVM `0x` (20B) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` |
| **Ethereum** (`ethereum`) | `1` | EVM `0x` (20B) | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| **Arbitrum One** (`arbitrum`) | `42161` | EVM `0x` (20B) | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| **Polygon PoS** (`polygon`) | `137` | EVM `0x` (20B) | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| **OP Mainnet** (`optimism`) | `10` | EVM `0x` (20B) | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58` |
| **Tron** (`tron`) | `tron-mainnet` | Base58Check `T...` (34c) | `unsupported` (native deprecated) | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |

---

## 2. Subscription Tiers & Automated Trading Fee Schedule

| Plan | Monthly Fee | Automated Trading Fee (`bps`) | Cross-Chain Bridge Fee (`bps`) | Included API Quota / mo | Target User |
|---|---|---|---|---|---|
| **Free** (`free`) | `$0.00` | `50 bps` (`0.50%`) | `25 bps` | `500` calls | Self-custody P2P & reserve verification |
| **ZENO Plus** (`plus`) | `$9.99` | `25 bps` (`0.25%`) | `15 bps` | `10,000` calls | Active DCA & automated savings |
| **ZENO Ultra Quant** (`ultra_quant`) | `$49.00` | `10 bps` (`0.10%`) | `5 bps` | `100,000` calls | Automated peg-arb, bots & multi-chain execution |
| **Institutional** (`institutional`) | `$199.00` | `5 bps` (`0.05%`) | `2 bps` | `1,000,000` calls | Treasury desks & autonomous agent fleets |

### Metered Usage Rates (Integer Micro-USD, Zero Float)
- **Automated Trading Strategy Tick**: `$0.01` (`10,000` µUSD) per tick + plan-tier `bps` on executed notional.
- **Cross-Chain Bridge Execution**: plan-tier `bps` on bridged notional (minimum `$0.05` / `50,000` µUSD).
- **API Overage**: `$0.0005` (`500` µUSD) per call above plan quota.
- **Disposable Single-Use Card Mint**: `$0.25` (`250,000` µUSD) per card after free tier allowance.

---

## 3. Sanpo Yoshi (50 / 30 / 20) Revenue Distribution

Every dollar of platform subscription and metered usage fee is split deterministically using exact `p/q` integer arithmetic (`operating + family_trust + foken_commons == total`):
- **50% (`1/2`) Operating & Infrastructure Reserve** (`revenue:operating`)
- **30% (`3/10`) ZENO Family Trust USDC Reserve** (`revenue:family_trust`)
- **20% (`1/5`) FOKEN Open-Source Contributor Commons** (`revenue:foken_commons`)

---

## 4. Going Live with Real Revenue Collection

1. **Stripe Fiat Card / ACH Billing**: Configure Cloudflare Worker secrets via Wrangler:
   ```bash
   wrangler secret put STRIPE_SECRET_KEY -c deploy/wrangler.toml
   wrangler secret put STRIPE_WEBHOOK_SECRET -c deploy/wrangler.toml
   wrangler secret put STRIPE_PRICE_PLUS -c deploy/wrangler.toml
   wrangler secret put STRIPE_PRICE_ULTRA -c deploy/wrangler.toml
   wrangler secret put STRIPE_PRICE_INSTITUTIONAL -c deploy/wrangler.toml
   ```
2. **Direct On-Chain USDC Subscriptions**: Point customers or autonomous agents to your funded Treasury Solana / Base USDC vault (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` / `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and verify settlement via signed webhook / RPC watcher.
