# RFC-007 — Constellation & KOMRESS-ULTRA ZKP1 Wiring

**Status:** implemented · **Version:** 1.0.0 · **Owner:** 8b-is Family Research
**Surface:** `zeno.vaked.dev` · **Registry:** [`constellation.json`](../constellation.json)

## 1. Problem

ZENO already linked to sister 8b-is surfaces in prose and badges, but the links
were inert: no machine-readable registry, no valuation, and no shared surface
between the web app, iOS, and Android. Every new project had to be re-linked in
three places from memory.

This RFC makes the constellation a **first-class ZENO object**: one canonical
registry, scored by the Foken gate, consumed by every surface.

## 2. Data model

`constellation.json` is the single source of truth. No surface may hard-code a
project that is absent here.

```jsonc
{
  "spec": "https://zeno.vaked.dev/spec/CONSTELLATION_WIRING.md",
  "version": "1.0.0",
  "projects": [
    {
      "id": "sovereign-library",      // ^[a-z0-9-]+$, unique
      "name": "Sovereign Library",
      "kanji": "主権図書館",
      "url": "https://…",             // https only
      "trit": 1,                      // -1 | 0 | +1
      "lane": "canon",
      "role": "…",
      "foken": {
        "futureWorkAvoidedHours": 240,
        "workAddedHours": 60,
        "maintenanceDebtHours": 12
      }
    }
  ],
  "packs": [
    {
      "id": "architect-neo-trinity-tibetan-omni",
      "containerUrl": "https://…/…zkp1",
      "companionUrl": "https://…/…html",
      "blocks": 7,
      "languages": ["EN", "BO", "HU", "JA", "LA", "1bitLang"],
      "rawBytes": 11108,
      "sealedBytes": 5448,
      "savingsPercent": 50.95,
      "wupzFold": "0x44dcbd34fd19d0b1",
      "sha256Raw": "c51366…c7591",
      "sha256Sealed": "8fb9cc…9f7f0"
    }
  ]
}
```

### 2.1 Trit semantics

Inherited from the Sovereign Ontology (`sovereign-library/ONTOLOGY.md`):

| Trit | Meaning | Ledger consequence |
|------|---------|--------------------|
| `-1` | Closed scalar / rent-seeking / falling fire | Refused by the Foken gate; no mint |
| `0` | Witnessed, maintained, held in the Sanctuary | No mint; visible and auditable |
| `+1` | Verified binding, net-positive contribution | Merited-mint eligible |

### 2.2 Net utility

```
net = futureWorkAvoidedHours - (workAddedHours + 1.5 * maintenanceDebtHours)
```

`1.5` is the maintenance-debt multiplier carried over from the Foken gate
(`spec/FOKEN_BRIDGE.md`). A project whose net is `<= 0` must not be registered
with a `+1` trit; the test suite enforces net-positive for every entry.

## 3. API contracts

Both endpoints are read-only, cacheable for 5 minutes, and contain no secrets.

### 3.1 `GET /api/constellation`

Returns the full registry with `netHours` computed per project and `totals`
added:

```jsonc
{
  "projects": [
    { "id": "sovereign-library", "netHours": 162, "foken": { "netHours": 162, "...": 0 }, "...": "" }
  ],
  "packs": [ "..." ],
  "totals": { "projects": 11, "netHours": 1205, "sealedBytes": 5448 }
}
```

`netHours` is emitted both at the project top level (client convenience) and
inside `foken` (formula locality).

### 3.2 `GET /api/kompress`

Returns `{ spec, version, packs, totals: { packs, sealedBytes } }`. The receipt
numbers are computed from `constellation.json`, which is verified against the
real container bytes — the API never re-derives hashes from prose.

## 4. Surfaces

| Surface | Contract |
|---------|----------|
| Web (`index.html` → `星座` tab) | Static, offline-readable registry + receipt. `initConstellationUI()` fetches `/api/constellation` and re-renders the receipt so the page cannot drift; the seal button appends a witness block to the Kintsugi ledger via `zenoState.ledgerBlocks`. |
| iOS (`ConstellationView`) | Fetches the API with an 8 s timeout; falls back to `ConstellationDoc.fallback` (same ids). |
| Android (`ConstellationCard`) | `ConstellationRepository` uses `HttpURLConnection` + `org.json`; no new Gradle dependencies. Same fallback ids. |
| Worker | Routes live in `deploy/build.mjs`; `deploy/worker.js` is generated. |

## 5. Verification

`node test-constellation.mjs` asserts:

1. ids are unique and URL-safe; every URL is `https`;
2. every project passes the Foken gate (net > 0);
3. `totals.netHours == 1205`, trit split `7 / 4 / 0`;
4. ZKP1 arithmetic (`11,108 → 5,448`, 50.95%) and the sealed SHA-256;
5. every registry id and URL appears on the landing page;
6. `/api/constellation` and `/api/kompress` return the computed values;
7. the generated worker embeds the registry and both routes;
8. iOS and Android fallbacks carry the same ids.

Reference bytes for the seal check:

```
raw    c513660ef75bf3215b25e4c2a166d000100e7d876d278a222888f00f136c7591
sealed 8fb9cc110652cf07f75afb2609ea82f834a3a106f53a8de7596b24309549f7f0
```

## 6. Non-goals

- No real money, no PII, no KYC. Foken hours and witness seals are simulated.
- No live crawling of sister sites: the registry is curated, not scraped.
- No claim that a SHA-256 is a zero-knowledge proof. `ZKP1` here is the
  KintsugiPack container format; its hashes are content identifiers.
- No new mobile dependencies (no serialization/HTTP libraries).

## 7. Changing the registry

1. Add or edit the project in `constellation.json`.
2. Add the matching row (with `data-constellation-id`) to the web pane.
3. If it replaces a fallback id, update `Constellation.swift` and `Constellation.kt`.
4. `node deploy/build.mjs && node test-constellation.mjs`.
5. Bump `sw.js` `CACHE_NAME`, deploy, smoke-check both endpoints.
