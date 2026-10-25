# IC カード & Samsung Wallet 交通系カード — provisioning constraints

**Status:** implemented (probe + honest routing) · **App:** ZENO 1.5.x
**Related:** [RFC-005 AEON Pay QR](AEON_PAY_QR_ASIA_LAYER.md) · [RFC-006 Google Wallet](GOOGLE_WALLET_ANDROID_LAYER.md)

## 1. The ask

"Add the ZENO card to Samsung Wallet as an IC/transit card so it can be used to
tap through gates and pay in Tokyo."

## 2. What is and is not possible

| Path | Verdict | Why |
|------|---------|-----|
| App mints Suica/PASMO | **Impossible** | Cards are issued by JR East / PASMO Association into the Mobile FeliCa secure element. There is no public issuance API. |
| App emulates FeliCa via HCE | **Impossible** | Android HCE covers ISO-DEP (Type A/B) only. FeliCa is Type F with issuer keys in the FeliCa SE; `HCE-F` exists but cannot mint a transit card accepted by gates. |
| App adds a transit card to Samsung Wallet | **Impossible without the issuer** | Samsung Wallet Japan surfaces *already-issued* Osaifu-Keitai cards; it does not itself mint Suica/PASMO. Samsung Wallet Partner SDK requires partner approval and an issuer agreement. |
| App probes the device and routes to the issuer | **Possible — implemented** | `TransitCapability.probe()` + `IcTransitCard`. |
| App takes payment in Tokyo | **Possible — shipped** | ZENO QR / AEON Pay (`zeno://pay/…`), plus Google Wallet pass (credential-gated). |
| Tap Tokyo gates **without** FeliCa | **Possible — shipped** | Tokyo Metro / Toei gates accept contactless EMV (Visa, Mastercard, JCB, Amex, Diners, Discover). Add a bank card to Samsung/Google Wallet and tap. JR East gates vary by station. |

## 3. Hardware requirement (the hard wall)

Osaifu-Keitai needs **both**:

1. `android.hardware.nfc.felica` — the Mobile FeliCa (Type-F) controller, and
2. `com.felicanetworks.mfc` — the FeliCa Networks MFC client (non-removable on JP models).

Japanese Galaxy SKUs (`SC-*`, JP-CSC `SM-S9xx`) carry both. US/EU SKUs
(`XAA`, `EUX`, …) ship NFC-A/B + eSE + HCE/HCE-F but **no Type-F FeliCa** — they
can never tap Suica/PASMO, regardless of which apps are installed.

Verified on the operator's device (`SM-S928U1`, CSC `XAA`, Android 16):

```
$ pm list features | grep -ci felica      → 0
$ pm list packages | grep felicanetworks  → (none)
$ Mobile PASMO 2.0.0 launch                → 「ご利用の機種はおサイフケータイに対応しておりません。」
```

`IcTransitCard` reads exactly these two signals and reports
`NO OSAIFU-KEITAI` instead of pretending success. The verdict is **not** a dead
end: when `hasNfc && (Samsung Wallet || Google Wallet)` the card additionally
reports `CONTACTLESS EMV READY` and routes to the wallet so the user can tap
Metro/Toei gates with a bank card today.

> Note: `android.hardware.nfc.hcef` is present on this device and is **not**
> evidence of FeliCa transit support. It only exposes the HCE-F API.

## 4. Implemented behaviour

`apps/android/.../transit/TransitCapability.kt`

```
osaifuKeitai = hasFeliCaHardware && hasMfcClient
route =
  ISSUER_THEN_WALLET  osaifu + Samsung Wallet + issuer app      → "発行アプリへ" then Wallet
  ISSUER_REQUIRED     osaifu + Samsung Wallet, no issuer app    → get Mobile PASMO/Suica
  ISSUER_APP          osaifu, no Samsung Wallet                 → issuer app only
  UNSUPPORTED         no FeliCa                                 → EMV route (if wallet) + ZENO QR
```

`apps/android/.../ui/components/IcTransitCard.kt` renders the verdict, one-tap
routes (issuer app, Play listing, Samsung Wallet), and a `端末診断` panel that
prints the raw probe. Nothing is cached or transmitted.

`AndroidManifest.xml` declares `<queries>` for the five packages — without it,
API 30+ package visibility makes every `getPackageInfo` throw
`NameNotFoundException` and the probe lies in the opposite direction (reports
"absent" for installed apps).

## 5. The provisionable path (when a JP device is in hand)

1. Insert a JP carrier SIM / use a JP SKU device with Osaifu-Keitai.
2. Install **Mobile PASMO** (or Mobile Suica) and issue a card; fund it.
3. The card appears under Osaifu-Keitai settings and in **Samsung Wallet →
   交通系ICカード**; taps work at gates and in shops.
4. ZENO's role is funding and ledgering, not issuance: recharge flow and the QR
   fallback remain ours.

To go further (ZENO-branded transit card), the only legitimate route is a
co-branded issuance agreement with the issuer + Samsung Wallet Partner SDK
approval. That is a commercial agreement, not a code change.

## 6. What the web surface says

The wallet modal carries a matching disclosure (`#ic-wallet-note`) with the
requirement table, the "no app can mint it" statement, and links to the issuer
apps — so the product does not imply a capability it lacks.

## 7. Non-goals

- No card emulation, no cloned/replayed FeliCa frames, no "demo" card presented
  as real value.
- No claim that Google Wallet or Samsung Wallet can hold a ZENO-issued IC card.
- No device spoofing to make an unsupported SKU pass the probe.
