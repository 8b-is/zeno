# RFC-006 — Google Wallet + Deep Links (Android wallet layer)

Status: implemented (credential-gated)
Companion to: RFC-005 (AEON Pay QR, `spec/AEON_PAY_QR_ASIA_LAYER.md`)

## Goal

Give ZENO the Android analogue of the Apple `.pkpass` rail, and make every
ZENO payment entry point converge on one route:

```
zeno://pay/<account_id>?mode=<receive|paycode>&bank=ZENO&amount=<uJPY>
https://zeno.vaked.dev/pay/<account_id>?mode=…&amount=…
Quick Settings tile  ─┐
App Link (https)     ─┼─→ MainActivity → AEON Pay tab (tab index 1)
custom scheme        ─┘
```

## Components

| Layer | File | Notes |
|---|---|---|
| Pass payload (source of truth) | `apps/wallet/google_wallet.py` | stdlib + `openssl` RS256 |
| Pass payload (runtime mirror) | `deploy/build.mjs` → `googleWalletPass()` | WebCrypto RS256 |
| Contract tests | `apps/wallet/test_google_wallet.py` | 10 tests, incl. signature verify |
| HTTP endpoint | `GET /api/wallet/google-pass` | `mode: live | unconfigured` |
| App Links verification | `/.well-known/assetlinks.json` ← `deploy/assetlinks.json` | package `dev.vaked.zeno` |
| Android SDK bridge | `wallet/GoogleWalletController.kt` | `PayClient.savePassesJwt` |
| UI | `ui/components/AddToGoogleWalletButton.kt` | Transit tab |
| Quick Settings tile | `wallet/AeonPayTileService.kt` | Pay-Code in one swipe |
| Deep-link router | `MainActivity.handleDeepLink()` | also `onNewIntent` |

## Why the pass is signed server-side

The Android SDK's `savePasses(json, …)` signs with the app's registered SHA-1.
That only works for a registered app and yields a different signing pipeline
from the web. Using `savePassesJwt(jwt, …)` with the Worker-signed JWT keeps a
**single** issuer pipeline for web + Android, and keeps the service-account key
out of the APK.

## Credential gating (intentional)

Nothing is faked. Without credentials the endpoint returns:

```json
{ "mode": "unconfigured", "missing": ["GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SA_JSON"], "claims": { … } }
```

and both the web button and the Android button surface the missing names. Once
configured, the same call returns `mode: "live"`, a `jwt`, and a
`https://pay.google.com/gp/v/save/<jwt>` link.

### Enabling

```bash
# 1. Google Wallet Business Console → create issuer → note issuer ID
# 2. Google Cloud → service account → enable Google Wallet API → export JSON
# 3. Authorize the service account in the Business Console

# Web/Worker (production):
cd deploy
wrangler secret put GOOGLE_WALLET_ISSUER_ID
wrangler secret put GOOGLE_WALLET_SA_JSON      # paste the whole JSON key

# Local CLI:
GOOGLE_WALLET_ISSUER_ID=… GOOGLE_WALLET_SA_JSON=./key.json \
  uv run python apps/wallet/google_wallet.py --account cnt_0x71c8
```

## JWT size

Google truncates save links beyond ~1800 characters. The claims payload is
trimmed to stay under it; the builder reports `jwtLength` and
`overLengthLimit` so a regression is visible instead of silently broken.
Current size: **1591 chars** (verified with a generated 2048-bit key).

## App Links

`deploy/assetlinks.json` ships the **debug** signing fingerprint
`E8:B8:…:46:33`. A release build must add its own SHA-256 before shipping:

```bash
keytool -list -v -keystore <release.keystore> -alias <alias> \
  | grep SHA256
```

Verification on-device:

```bash
adb shell pm verify-app-links --re-verify dev.vaked.zeno
adb shell pm get-app-links dev.vaked.zeno   # → zeno.vaked.dev: verified
```

## Latest Android surfaces used

- **Predictive back** — `android:enableOnBackInvokedCallback="true"`.
- **Quick Settings tile** — `TileService` + `startActivityAndCollapse(PendingIntent)`
  on API 34+, legacy `Intent` below.
- **Verified App Links** — `autoVerify` + assetlinks.
- **Google Wallet SDK** — `play-services-pay:16.5.0`, `PayClient.savePassesJwt`.

## Deliberate non-goals

- No Suica/PASMO/EMV emulation. HCE remains a proprietary `F05A454E4F3842`
  loyalty AID (`nfc/ZenoHostApduService.kt`); impersonating transit or payment
  credentials is non-functional and unlawful.
- No pass *updates* via the REST API yet (balance is snapshotted per save).


## Obtaining the credentials (ELI5)

The Wallet pass stays `mode:"unconfigured"` until two secrets exist. They come
from Google, never from GitHub — GitHub is only the place they must NEVER go.

1. **Cloud project**: console.cloud.google.com → New Project (e.g.
   `zeno-wallet`). Free.
2. **Flip the breaker**: APIs & Services → Library → search *Google Wallet
   API* → Enable.
3. **Issuer ID** (who you are): pay.google.com/business-console → same Google
   account → accept terms → the 19-20 digit number at the top =
   `GOOGLE_WALLET_ISSUER_ID`.
4. **Robot key** (prove it is you): Cloud Console → IAM & Admin → Service
   Accounts → Create (`zeno-wallet-signer`, no role) → Keys → Add Key →
   Create new key → **JSON** → downloaded file = `GOOGLE_WALLET_SA_JSON`.
5. **Let the robot in**: business console → team/settings → add the service
   account email (`…@…iam.gserviceaccount.com`) as admin, or Google ignores
   its signatures.
6. **Secrets to the worker, not the repo**:
   `npx wrangler secret put GOOGLE_WALLET_ISSUER_ID` and
   `npx wrangler secret put GOOGLE_WALLET_SA_JSON` (paste file content).
   Local dev may use gitignored `.dev.vars`; never commit either.
7. **Leak drill**: Cloud Console → Service Accounts → Keys → delete the key.
   Dead instantly.
8. **Test mode**: add your Google email under *Test accounts* in the business
   console; passes install on your phones until production branding approval.
