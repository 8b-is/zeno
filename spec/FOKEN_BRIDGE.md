# ZENO ↔ FOKEN Bridge Specification — 貢献鋳造 (Kōken Chūzō)

This document formalizes the integration contract between the **Foken proof-of-contribution valuation gate** (`foken/gate.py`, `foken/tally.py`, `invoice.schema.json`) and the **Zeno Neo-Bank Core Ledger**.

---

## 1. The Core Paradigm: Merited Minting

Traditional neo-banks create credit balances when a borrower pledges future labor under interest debt. 
Zeno creates balances **only when labor has already been executed, proved, IP-assigned, and evaluated as net-positive to the commons.**

```
[ Contributor completes work ]
              │
              ▼
[ Generates Artifact (sha256://) + IP Assignment ]
              │
              ▼
[ Submits Foken Invoice (UUID-v7, 0x-contributor) ]
              │
              ▼
[ Foken Deterministic Pre-Filter Gate (gate.py) ]
  ├── 1. Structure & Type Check
  ├── 2. Hard IP Gate ("IRREVOCABLE ASSIGNMENT", 0x-sig)
  ├── 3. Artifact Provenance ("sha256://...")
  ├── 4. Contributor Format (0x + 40 hex)
  ├── 5. Valuation (positive integer)
  └── 6. Net-Utility Formula Evaluation
              │
         ┌────┴────────────────────────┐
         ▼                             ▼
    [ FAIL <= 0 ]                 [ PASS > 0 ]
   (No Mint, Rejection)                │
                                       ▼
                       [ Reviewer Quorum Tally (>50%) ]
                                       │
                                       ▼
                       [ Zeno Bridge: mintFromConsensus ]
                                       │
                                       ▼
                       [ ZENO Ledger: Credit Contributor ]
                       [ ZENO Ledger: Debit Universal Treasury ]
```

---

## 2. Invoicing Contract Mapping

Zeno ingests the exact Foken Invoice format defined in `foken/invoice.schema.json`:

```json
{
  "invoiceId": "01925b6a-91dc-7b18-8f55-123456789abc",
  "version": 1,
  "contributor": "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
  "work": {
    "title": "Zeno Core Streaming Settlement Engine",
    "description": "Implemented zero-copy SIMD streaming arithmetic and Kintsugi ledger block sealing.",
    "repo": "https://github.com/8b-is/zeno",
    "commit": "a3f892c"
  },
  "artifact": {
    "provenanceHash": "sha256://b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    "artifactUri": "ipfs://bafybeic52..."
  },
  "valuation": {
    "selfAssessedFokens": 500,
    "basis": "JPY",
    "rationale": "Saves 120 hours of manual reconciliation; implements RFC-001.",
    "evidence": ["https://zeno.vaked.dev/spec/"]
  },
  "ipAssignment": {
    "statement": "IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
    "license": "MIT",
    "signedAt": "2026-10-11T08:30:00Z",
    "signature": "0x4f8a3c9b..."
  },
  "netUtility": {
    "futureWorkAvoidedHours": 120,
    "workAddedHours": 15,
    "maintenanceDebtHours": 5
  },
  "dedup": {
    "claimedNovelty": "Novel micro-yen streaming arithmetic on Cloudflare edge.",
    "relatedInvoiceIds": []
  }
}
```

---

## 3. Valuation & Net-Utility Formula

The formula is strictly applied:
$$\text{net} = \text{futureWorkAvoidedHours} - (\text{workAddedHours} + 1.5 \times \text{maintenanceDebtHours})$$

In the above example:
$$\text{net} = 120 - (15 + 1.5 \times 5) = 120 - (15 + 7.5) = 97.5 > 0 \implies \mathbf{PASS}$$

---

## 4. Off-Chain Reviewer Consensus & Minting

1. `foken/tally.py` validates the reviewer set ($N \ge 5$ distinct `0x` addresses).
2. Quorum requires strictly more than half:
   $$\text{approvals} \times 2 > N$$
3. Upon reaching quorum, `tally.py` generates the mint consensus payload:
   ```json
   {
     "invoiceId": "01925b6a-91dc-7b18-8f55-123456789abc",
     "contributor": "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
     "approvedFokens": 500,
     "consensusHash": "0x9812df...",
     "quorum": "4/7"
   }
   ```
4. The Zeno Core Ledger executes `mintFromConsensus`:
   - Debits `asset:vault:treasury_foken` by $500 \times \text{ExchangeRate}$
   - Credits `liability:user:0x71c8...` with $500$ ZENO ($¥50,000$ equivalent).
   - Seals the transaction in the next Kintsugi block.
