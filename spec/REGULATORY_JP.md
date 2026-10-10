# ZENO Japanese Regulatory Architecture — 資金決済法と銀行法対応

To ensure institutional endurance and legitimate global operation with deep Japanese roots, Zeno is architected around Japan's regulatory statutes: the **Payment Services Act (資金決済法 - PSA)**, the **Banking Act (銀行法)**, and the **Financial Instruments and Exchange Act (金融商品取引法 - FIEA)** under the supervision of the **Financial Services Agency (金融庁 - JFSA)**.

---

## 1. Statutory Categorization & Licensing Blueprint

```
┌────────────────────────────────────────────────────────────────────────┐
│                        JFSA Regulatory Tiers                           │
├────────────────────────────────┬───────────────────────────────────────┤
│ Type I (第一種資金移動業)        │ Remittances > ¥1,000,000 (No upper cap│
│                                │ Requires direct JFSA registration     │
├────────────────────────────────┼───────────────────────────────────────┤
│ Type II (第二種資金移動業)       │ Remittances <= ¥1,000,000             │
│ [Primary Zeno Operating Tier]  │ Standard consumer & Guild remittances │
│                                │ 100% legal performance deposit escrow │
├────────────────────────────────┼───────────────────────────────────────┤
│ Type III (第三種資金移動業)      │ Remittances <= ¥50,000                │
│                                │ Ultra-light micro-payment tier        │
├────────────────────────────────┼───────────────────────────────────────┤
│ Electronic Payment Instruments │ Stablecoins / JPYC backing            │
│ (電子決済手段等取扱業 - 2023)    │ 100% segregated fiat reserves         │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Customer Asset Segregation (分別管理)

In strict accordance with PSA Article 43:
1. **Asset Segregation**: All customer fiat funds (JPY) are held in legally segregated trust accounts (*Shintaku* 信託) with authorized Japanese trust banks (e.g., Mitsubishi UFJ Trust, Sumitomo Mitsui Trust).
2. **Performance Deposit Guarantee (履行保証金保全契約)**:
   - Zeno maintains a 100% statutory guarantee contract filed with the Tokyo Legal Affairs Bureau (東京法務局).
   - In the unlikely event of bankruptcy or platform failure, depositors have top-priority statutory liens (*Senkushu Tokken* 先取特権) ensuring 100% capital return.
3. **Foken Treasury Distinction**:
   - Foken utility tokens represent communal proof-of-work governance rights and are strictly accounted for in segregated cryptographic reserves, never mingled with customer fiat trust funds.

---

## 3. AML / CFT & Travel Rule (犯罪収益移転防止法)

1. **Identity Verification (eKYC)**:
   - Japanese residents: Instant verification via **My Number Card (マイナンバーカード)** NFC chip verification (J-LIS public certificate authentication) or Japanese driver's license with facial liveness matching.
   - International contributors: Zero-Knowledge Passkey credentials verifying non-sanctioned residency without storing unencrypted PII on public servers.
2. **Travel Rule (JVCEA / TRUST / Sygna Alliance)**:
   - For transfers exceeding ¥100,000, originator and beneficiary data are cryptographically relayed using the IVMS-101 standardized schema.

---

## 4. Bank of Japan CBDC & Digital Yen Alignment

- Zeno is structured to interface directly with the **Bank of Japan CBDC Pilot Project (日本銀行 中央銀行デジタル通貨パイロット実験)**.
- Dual-rail gateway:
  - **Zengin Rail (全銀ネット)**: For legacy Japanese domestic interbank wire transfers (FSP code routing).
  - **CBDC / JPYC Rail**: For sub-second, zero-fee sovereign settlement.
