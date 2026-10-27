# RFC-006B: `zeno-wallet-issuer-angel` — ELI5 & `#![no_std]` Kernel Specification

**Project:** `Zeno-wallet` (Google Cloud Project Number `812856185326`)  
**OAuth 2.0 Client ID:** `812856185326-b6jhlilv11d8ufcjpbjjrg486uiffno9.apps.googleusercontent.com`  
**Service Account Name:** `zeno-wallet-issuer-angel`  
**Service Account Description:**  
> `ZENO Kintsugi Ledger Bridge: Authorized signer for FeliCa transit tokens and Google/Apple Wallet passes via Client ID 812856185326. Integrity enforced via SHA-256 trace-chaining.`

---

## 1. ELI5: Why We Have Both an OAuth Client ID and a Service Account (`zeno-wallet-issuer-angel`)

Think of **ZENO (`zeno.vaked.dev`)** like a train station ticket office in Tokyo:

1. **The OAuth 2.0 Client ID (`812856185326-b6jhlilv11d8ufcjpbjjrg486uiffno9.apps.googleusercontent.com`)** is the **Front Door Badge Scanner**. It identifies the ZENO Web/Android app when a human user signs in or links their Google account.
2. **The Service Account (`zeno-wallet-issuer-angel@...iam.gserviceaccount.com`)** is the **Automated Ticket Stamp Machine (`Angel`)** behind the counter. When a user taps **"Add to Google Wallet"**, Google Wallet requires a cryptographically signed RS256 JWT (`typ: "savetowallet"`). An OAuth Client ID cannot sign "Add to Wallet" passes on its own—only the Service Account's private key (`GOOGLE_WALLET_SA_JSON`) + your 19-digit Google Pay & Wallet Console **Issuer ID** (`GOOGLE_WALLET_ISSUER_ID`) can stamp and mint the pass.

### 3-Step Checklist in Google Cloud & Google Wallet Console
1. **Create the Service Account (`IAM & Admin → Service Accounts`)**:
   - **Service account name:** `zeno-wallet-issuer-angel`
   - **Service account ID:** `zeno-wallet-issuer-angel`
   - **Description:** `ZENO Kintsugi Ledger Bridge: Authorized signer for FeliCa transit tokens and Google/Apple Wallet passes via Client ID 812856185326. Integrity enforced via SHA-256 trace-chaining.`
   - Click **Create and Continue** → **Done** (no IAM project roles are required just to sign Wallet JWTs), then open **Keys → Add Key → Create new key → JSON** to download the key file.
2. **Enable the Google Wallet API (`APIs & Services → Library`)**:
   - Search for **Google Wallet API** in project `Zeno-wallet` (`812856185326`) and click **Enable**.
3. **Link in Google Pay & Wallet Console (`https://pay.google.com/business/console`)**:
   - Open **Google Wallet API** → copy your 19-digit **Issuer ID** (`3388000000...`).
   - Go to **Users → Invite a user** → paste `zeno-wallet-issuer-angel@<project-id>.iam.gserviceaccount.com` with **Developer** access.

---

## 2. `#![no_std]` Rust Kernel (`apps/rust/zeno-issuer-angel`)

Per **Christopher M Chenoweth (`@alexiai`)**, token time-window evaluation, Kintsugi trace-chaining, and `wupz` 32-byte witness sealing are implemented in [`apps/rust/zeno-issuer-angel/src/lib.rs`](/apps/rust/zeno-issuer-angel/src/lib.rs):

- **Zero-Float `p/q` `Rational` FeliCa Time-Windows (`FelicaTransitWindow`)**:
  - Enforces the JIS X 6319-4 `200 ms` (`1/5 s`) NFC-F gate window (`FELICA_GATE_WINDOW_SECONDS`) and `1800 s` (`1800/1 s`) Tokyo transfer grace window (`TRANSIT_TRANSFER_WINDOW_SECONDS`) using checked `i128`-reduced `p/q` rationals—eliminating IEEE-754 mantissa drift.
- **FIPS 180-4 `#![no_std]` SHA-256 Kintsugi Trace-Chaining (`kintsugi_trace_chain`)**:
  - Streams `H(prev_trace || ":" || payload)` in 64-byte stack blocks with zero heap allocation.
- **32-Byte `wupz` Witness Seal (`WupzWitnessSeal`)**:
  - Computes a deterministic 32B witness seal (`"WUPZ"` 4B magic + `wupz_popcount` 4B + `wupz_xor_fold` 8B + upper 16B of `sha256`) over the issuer descriptor and signed claims.
