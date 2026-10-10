# ZENO Ledger Specification — 金継ぎ台帳 (Kintsugi Ledger)

The Zeno Ledger is a zero-debt, cryptographic, double-entry immutable accounting engine.

---

## 1. Accounting Equation & Invariants

All accounts belong to the standard financial chart:
1. **Assets ($A$)**: Cash reserves, JPY fiat escrow, BOJ central bank deposits, Foken treasury holdings.
2. **Liabilities ($L$)**: User deposit obligations, active streaming escrows.
3. **Equity ($E$)**: Universal Treasury retained value, reserve surpluses.
4. **Revenue ($R$)**: Gateway settlement fees, protocol yield.
5. **Expenses ($X$)**: Cloud compute infrastructure costs, oracle maintenance.

$$\Delta A + \Delta X = \Delta L + \Delta E + \Delta R$$

Every transaction $T$ consists of $N \ge 2$ postings such that:
$$\sum_{j=1}^N \text{posting}_j.\text{amount} = 0$$
where Debits are represented as positive numbers ($+v$) and Credits as negative numbers ($-v$).

---

## 2. Cryptographic Hash Chaining (Kintsugi Block Seal)

Each ledger block $B_k$ seals one or more transactions with an immutable cryptographic pointer:

```json
{
  "blockIndex": 1042,
  "timestamp": "2026-10-11T08:30:00.000Z",
  "previousHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "merkleRoot": "7a35c...921f",
  "transactions": [
    {
      "txId": "tx_01jb2x...",
      "timestamp": "2026-10-11T08:29:58.120Z",
      "postings": [
        { "accountId": "treasury:foken_reserve", "amount": 5000000, "currency": "ZENO" },
        { "accountId": "usr_0x71c...b29", "amount": -5000000, "currency": "ZENO" }
      ],
      "memo": "Foken Invoice Settlement #inv_01jb2w...",
      "signature": "0x-kintsugi-witness-sig"
    }
  ],
  "seal": "8f5a2...3b1c"
}
```

The seal is computed as:
$$\text{seal}_k = \text{SHA256}(\text{previousHash} \,\|\, \text{blockIndex} \,\|\, \text{timestamp} \,\|\, \text{merkleRoot})$$

---

## 3. Account Chart Designations

| Account ID Pattern | Class | Description | Normal Balance |
|---|---|---|---|
| `asset:vault:jpy_fiat` | Asset | Legal Affairs Bureau & commercial bank JPY escrow | Debit |
| `asset:vault:treasury_foken` | Asset | Collateralized verified utility assets | Debit |
| `liability:user:<id>` | Liability | Customer checking & savings balances | Credit |
| `liability:agent:<id>` | Liability | AI agent operational balances | Credit |
| `equity:universal_treasury` | Equity | Communal retained surplus from Foken mints | Credit |
| `revenue:stream_fee` | Revenue | Infinitesimal settlement fee ($0.01\%$) | Credit |

---

## 4. Concurrency & Serializability

- Optimistic concurrency control via monotonic account sequence numbers (`sequence_num`).
- Transaction processing uses strict serializability ($ACID$) for atomic state commits.
- Local-first offline signing with deterministic replay protection.
