# ZENO Autonomous Agent Banking Specification — 自律口座 (Jiritsu Kōza)

Autonomous software agents (AI reasoners, automated engineering swarms, search bots) require first-class financial sovereignty without risking catastrophic runaway expenditures.

---

## 1. The Autonomous Agent Account (`agt_...`)

In Zeno, an AI Agent is not a sub-wallet or a shared credit card; it is a cryptographic principal registered in the Kintsugi Ledger with an assigned **Policy Contract**.

### 1.1 Identity & Key Hierarchy
- **Master Sovereign Key**: Belongs to the human operator or organization guild.
- **Agent Operational Key**: Ephemeral ed25519 or secp256k1 key pair held in agent execution environment (e.g., NixOS container, Crush/Enthea runtime).
- **Agent Account ID**: Format `agt_<40_hex_chars>`.

---

## 2. Policy Enforcement Matrix

Every outbound transaction initiated by an agent is evaluated against its deterministic Policy Contract:

```json
{
  "agentId": "agt_9a82b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
  "owner": "usr_0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
  "policy": {
    "currency": "JPY",
    "maxPerTransaction": 5000,
    "maxDailySpend": 50000,
    "allowedCategories": ["inference_compute", "data_feed", "foken_bounty", "infra_hosting"],
    "counterpartyWhitelist": [
      "srv_cloud_hetzner",
      "srv_cloudflare_workers",
      "cnt_0x82b...",
      "treasury:universal"
    ],
    "requireProofOfReasoning": true
  }
}
```

---

## 3. Proof-of-Reasoning (PoR) Hash

When an agent requests a disbursement:
1. It records its reasoning trace and target task ID.
2. It generates a cryptographic proof-of-reasoning hash:
   $$\text{porHash} = \text{SHA256}(\text{taskId} \,\|\, \text{promptHash} \,\|\, \text{outputHash} \,\|\, \text{timestamp})$$
3. The disbursement transaction embeds `porHash` into the ledger memo. If an audit is conducted, the operator can trace the exact chain of thought that authorized the expenditure.
