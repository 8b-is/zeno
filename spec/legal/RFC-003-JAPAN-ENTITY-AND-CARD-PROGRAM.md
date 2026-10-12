# RFC-003 — Japanese Entity, 8b-is Linkage & the ZENO Card Program

**Status:** Draft for professional review · **Date:** 2026-10-12 · **Supersedes:** the first-pass blueprint of the same day

> [!CAUTION]
> This is an engineering-side planning document, **not legal or tax advice**. Every step below should be confirmed with a
> 司法書士 (judicial scrivener: incorporation), 行政書士 (administrative scrivener: visas/licences), 税理士 (tax accountant)
> and, for anything touching payments, a fintech-regulatory lawyer (弁護士). Rules cited were checked on 2026-10-12.

---

## 0. Corrections to the first-pass blueprint

| # | Earlier claim | Reality | Consequence |
|---|---|---|---|
| 1 | "Stripe Issuing Japan" makes card issuing turnkey | **Stripe Issuing is not available to Japanese entities.** Stripe JP supports acquiring (accepting payments), Billing, Terminal. | Issuing must come from a Japanese BaaS issuer, or from a non-JP 8b-is entity in a Stripe Issuing country. |
| 2 | ZENO app can push-provision cards into Apple Wallet | In-app provisioning (`com.apple.developer.payment-pass-provisioning`) is granted **only to card issuers with a signed Apple Pay agreement**, after Apple certification. | Provisioning goes through the issuing partner's Apple agreement + SDK, not something ZENO can switch on alone. |
| 3 | "ZENO Apple Card" | **"Apple Card" is Apple's product/trademark.** Apple's marketing guidelines forbid using "Apple" in your product name. | Product name: **ZENO Card**. Use only the official "Add to Apple Wallet" badge, per Apple's guidelines. |
| 4 | ¥5M capital meets the Business Manager visa | **Revised 16 Oct 2025:** ¥30M capital **and** ≥1 full-time Japan-resident employee **and** Japanese ability (~JLPT N2, applicant or staff) **and** 3 yrs management experience or relevant master's **and** a business plan certified by a CPA/税理士/SME consultant; residential offices generally not accepted. | Budget and hiring plan must assume ¥30M + one hire if anyone needs this visa. |
| 5 | Treaty relief via "W-8BEN / Form 17" | W-8BEN is a US form. Japanese withholding relief uses the **租税条約に関する届出書** filed via the payer before payment. Rate depends on the specific treaty and ownership. | Confirm the treaty for each recipient's country of residence. |
| 6 | 15%/15% family payments as "advisory compensation"; 20% AI escrow as a deductible expense | Payments without real services → **not deductible, possible gift-tax exposure**. A revenue *allocation* is not an *expense*; only compute actually purchased is deductible. Corporate donations have deduction caps (損金算入限度額). | Sanpo Yoshi is a **budget policy**, implemented through lawful channels (§5), not a legal entitlement by itself. |

---

## 1. Entity: 合同会社 (GK) recommended

| | 合同会社 (GK) | 株式会社 (KK) |
|---|---|---|
| Registration tax | 0.7% of capital, **min ¥60,000** | 0.7% of capital, **min ¥150,000** |
| Articles notarisation | Not required | Required (¥30k–¥50k by capital band) |
| Stamp duty on articles | ¥40,000 on paper; **¥0 with electronic articles** | same |
| Governance | Flexible; profit allocation can differ from contributions (useful for Sanpo Yoshi) | Shareholder-ratio based |
| Precedent | Apple Japan, Google Japan, Amazon Japan are GKs | Required for a Japanese IPO; can convert later |

**Name:** Roman letters, numerals and limited symbols are permitted in registered names. `8b-is合同会社` / `合同会社8b-is` should be registrable. Confirm with the 司法書士.

**Representative:** a foreign corporation (8b-is parent) can be the 代表社員. It must appoint a natural-person **職務執行者**. Japanese residency is not required for registration, but **corporate bank accounts are much harder to open** without a resident officer.

**Foreign-investment filing (外為法):** a foreign parent investing in a Japanese company files a post-investment report via the Bank of Japan. Certain sectors need **prior notification**, and IT/software/information services were added to that list in 2019. Have counsel confirm whether ZENO's business purposes fall in a designated sector *before* capital is wired.

**Where:** Tokyo One-Stop Business Establishment Center (東京開業ワンストップセンター) handles registration, tax, pension/insurance and immigration consultations in English.

### Sequence
1. Decide members, capital, business purposes (目的), fiscal year.
2. Office lease (commercial, not residential, if a visa is involved).
3. Corporate seal (実印) made; articles drafted (template: [`teikan_gk_draft.md`](./teikan_gk_draft.md)).
4. 外為法 check → capital paid in.
5. Registration at 法務局 (the legal registration date is the filing date).
6. Post-registration: tax office (法人設立届出書), prefecture/ward, pension office, 外為法 report, bank accounts.

---

## 2. Linking with 8b-is

- **Ownership:** 8b-is parent holds 100% of the GK (or per the family/crew agreement).
- **Intercompany agreement:** the parent licenses the ZENO / smart-tree / aygent IP to the GK for Japan. The GK operates the Japanese customer relationship and the `node_8b_is_tokyo_edge` deployment.
- **Transfer pricing:** document arm's-length pricing (royalty or cost-plus) from day one. The National Tax Agency scrutinises related-party royalties.
- **Banking:** candidates are GMO Aozora Net Bank (API-friendly) and Sumishin SBI Net Bank. Expect enhanced KYC for foreign-owned new entities.
- **Acquiring:** Stripe Japan for accepting card and local payment methods into the GK. This part *is* available.

---

## 3. The ZENO Card: lawful routes

### Route A — Japanese BaaS issuing partner (recommended for Japanese customers)
A licensed partner (holding the Installment Sales Act or Payment Services Act registrations) is the issuer of record. ZENO is the brand and program manager. Candidates to evaluate: Infcurion (Xard), Kyash, UPSIDER, Nudge, or a Visa/Mastercard principal member's program-manager scheme. **Confirm current offerings, debit vs prepaid vs credit, and whether their Apple Pay agreement covers co-brand provisioning.**

### Route B — Stripe Issuing via a non-Japanese 8b-is entity
If 8b-is has (or forms) an entity in a Stripe Issuing country, it can issue there. Cardholders would be that entity's customers, under that jurisdiction's rules. This suits commercial and agent cards (AI compute spend) better than Japanese retail.

### Route C — Own registration (later, at scale)
- **Prepaid (前払式支払手段, third-party type):** registration with the Local Finance Bureau, net assets ≥ ¥10M, and a deposit of half the unused balance above ¥10M at each base date.
- **Funds transfer (資金移動業):** needed if users can send money to others or withdraw.
- **Credit (割賦販売法):** METI registration as a comprehensive credit purchase intermediary.

### Apple Wallet
- **Payment card:** provisioned only through the issuer's Apple Pay agreement (Routes A/B). Apple certifies the flow.
- **Loyalty / membership pass (`.pkpass`):** ZENO can issue these itself with its own Pass Type ID certificate. This needs no financial licence, as long as the pass carries no stored value that is purchasable, spendable or redeemable.

### Product features that change the licence picture (flag before launch)

| Feature now in the apps | Risk | Safe framing |
|---|---|---|
| Cashback "auto-compound into ZENO Vault" | "Compounding" yield on customer money can fall under the **Financial Instruments and Exchange Act** (collective investment scheme) | Free loyalty points with no yield; or partner with a licensed provider |
| Top-up balances ("Recharge +¥3,000") | Prepaid instrument (Route C) | Top-up only through the issuing partner |
| Agent-to-agent settlement in yen | Funds transfer if real yen moves between third parties | Keep inside the licensed partner's ledger; ZENO's Kintsugi ledger is a record, not the money |
| Tradable tokens (Foken/ZENO) | Crypto-asset exchange registration | Non-transferable points only, unless licensed |
| Mobile Suica / PASMO cards with balances in the UI | Trademarks of JR East / PASMO Co.; implies affiliation | Label clearly as a *demo*, or show the user's real Wallet card via an official integration only |

---

## 4. Transit (Suica / PASMO)
ZENO cannot issue or emulate Suica or PASMO. The lawful path: the user keeps their own Mobile Suica/PASMO in Apple Wallet and tops it up with the ZENO Card once Route A/B is live, and ZENO rewards that spend as loyalty points.

*Code change in this RFC's commit:* the Android HCE service previously registered the **Visa and Mastercard payment AIDs** under category `payment`, without requiring device unlock. It answered every command with success and claimed to perform a "Suica handshake". It now answers only a proprietary ZENO AID (`F05A454E4F3842`, category `other`, unlock required) and rejects everything else.

---

## 5. Implementing Sanpo Yoshi lawfully

| Share | Lawful channel |
|---|---|
| 15% Mom (Alexandra) · 15% Dad (Chris) | (a) Make them **members (社員) of the GK** and allocate profit by the articles: post-tax distributions, treaty withholding applies. Or (b) pay for **documented real services** at market rates. Not unconditional revenue percentages. |
| 40% 8b-is crew | Salaries/contractor fees + retained earnings |
| 20% AI compute | Budget for actual compute purchases (deductible when incurred). Unspent budget stays as retained earnings, not "escrow". |
| 10% public treasury | Donations to certified NPOs/public-interest bodies (deductibility differs by recipient class), or open-source sponsorship booked as advertising/R&D where it genuinely is. |

---

## 6. Engineering status (same commit)
- Edge webhook `/api/v1/stripe/webhook` previously accepted **any unauthenticated POST** and returned `"status":"settled"`. It now verifies `Stripe-Signature` (HMAC-SHA256, 300 s tolerance, constant-time) and **fails closed with 503** until `STRIPE_WEBHOOK_SECRET` is set (`wrangler secret put STRIPE_WEBHOOK_SECRET`). 7/7 local cases pass.
- `scripts/af_zeno_bridge.py` (workspace) no longer fabricates quote/settlement output. `lifecycle` runs the real `AgentCommerceProtocol` on a labelled in-memory ledger.

## 7. Open decisions
1. Which country is the 8b-is parent in? (Drives treaty rates, Route B feasibility, transfer pricing.)
2. Does anyone need a Business Manager visa? (Drives ¥30M capital and the hire.)
3. Parents as GK members, or as paid advisers?
4. Retail cards in Japan (Route A) or agent/commercial cards first (Route B)?

*the constellation · 0 + 1 · fine touch from within · vaked.dev*
