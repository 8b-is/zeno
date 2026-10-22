# RFC-005: AEON Pay / Alipay-style QR Payment Layer — Asia First (銭・禅・善)

> **Status**: Standard Track · **Category**: Payments & Rail Compatibility
> **Authors**: 8b-is Crew (Hue, Aye, Taisha, Omni) & Family <team@8b.is>
> **Creators**: [https://8b.is](https://8b.is) · **Constellation**: vaked.dev (zeno.vaked.dev)
> **Version**: 1.0.0 · **Date**: October 2026

---

## 1. Executive Summary

ZENO is a Japanese proof-of-contribution sovereign neo-bank. In East Asia the
dominant consumer payment rail is **QR-code payment** (Alipay, WeChat Pay,
AEON Pay / AEON Wallet, PayPay), where a scannable code moves money without a
physical card or POS terminal.

**RFC-005 adds the "Asia first" QR payment layer**: a bank-branded,
machine-readable `zeno://pay/<account_id>` URI rendered as a scannable QR code,
supporting both a merchant-presented **receive** flow and a customer-presented
**pay-code** flow, gated by **3-D Secure (3DS)** risk-based authentication, and
settled on the Kintsugi double-entry ledger.

It complements RFC-002 (Stripe/ACP) and the FeliCa NFC-F transit rails: QR is the
contactless-at-a-glance rail for the dense Japanese/Asian retail and konbini
surface, while FeliCa remains the tap-and-go transit rail.

---

## 2. Design Goals

1. **Asia-first, bank-branded** — the QR carries the ZENO identity
   (`ZENO`, `銭・禅・善`, `8b-is Family Research Company`), matching the AEON Pay /
   Alipay surface.
2. **Both flows, one scheme** — `receive` (scan-to-pay) and `paycode`
   (show-to-charge) share one URI scheme with a `mode` discriminator.
3. **Fixed or open amount** — a QR can pin an exact amount, or leave it open for
   the payer to enter at scan time.
4. **3-D Secure** — amounts at/above a risk threshold require a one-time
   challenge before settlement; lower amounts are frictionless.
5. **Sovereign & zero-external-asset** — the QR is generated in-repo (vendored
   MIT encoder), no CDN, no third-party SDK; settlement honours the Kintsugi
   double-entry equilibrium rule (postings sum to zero).

---

## 3. The `zeno://pay` URI Scheme

```
zeno://pay/<account_id>?mode=<receive|paycode>&bank=ZENO&amount=<uJPY>&memo=<...>&ts=<epoch>&nonce=<hex>
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `account_id` | path | yes | ZENO account (e.g. `cnt_0x71c8`, `treasury:universal`, `asset:fiat:boj_escrow`). Percent-encoded. |
| `mode` | query | no | `receive` (default) or `paycode`. |
| `bank` | query | no | Bank brand id, `ZENO`. |
| `amount` | query | no | Exact amount in micro-yen (1 JPY = 1,000,000 uJPY). Omit for open amount. |
| `memo` | query | no | Human-readable memo. |
| `ts` | query | yes | Epoch seconds when issued. |
| `nonce` | query | yes | CSPRNG hex (12 bytes) — anti-replay; required on parse. |

**Example**

```
zeno://pay/cnt_alexandra?mode=receive&bank=ZENO&amount=5000000&memo=love&ts=1730000000&nonce=4875eaeea906303551840347
```

---

## 4. 3-D Secure Gate

The 3DS gate is a risk-based challenge state machine:

```
begin(uri) ──▶ risk=high (amount >= ¥1.00 or open) ──▶ CHALLENGE_REQUIRED
              risk=low  (amount < ¥1.00)            ──▶ NOT_REQUIRED
CHALLENGE_REQUIRED ──▶ issue_challenge() ──▶ verify(code) ──▶ CHALLENGE_PASSED | CHALLENGE_FAILED
NOT_REQUIRED  ──▶ verify() ──▶ CHALLENGE_PASSED (frictionless)
CHALLENGE_PASSED | NOT_REQUIRED ──▶ settle() ──▶ SETTLED
```

- Challenge code is CSPRNG and compared with constant-time compare.
- Verification is attempt-bounded (default 3); exceeding the limit locks the
  session as `CHALLENGE_FAILED` and refuses settlement.
- Settlement emits double-entry postings summing to zero:
  `asset:fiat:boj_escrow +amount` / target account `-amount` (inbound payment;
  credited accounts carry a negative balance, per ZENO ledger convention).

---

## 5. Reference Implementation

| Layer | Path | Notes |
|-------|------|-------|
| Core URI + 3DS | `apps/core/zeno_core/qr_pay.py` | `build_pay_uri`, `parse_pay_uri`, `QrPayUri`, `QrPayThreeDs` |
| Core tests | `apps/core/tests/test_qr_pay.py` | 13 unit tests |
| Frontend QR | `qrcode.js` (vendored, MIT) + `app.js` / `index.html` | Client-side render, amount input, mode toggle, 3DS overlay |
| Ledger | `apps/core/zeno_core/ledger.py` | `record_transaction`, double-entry invariant |

---

## 6. Security Notes

- `nonce` is mandatory on parse (anti-replay); generated with CSPRNG.
- Challenge code compared with `secrets.compare_digest`.
- The frontend 3DS step is a **client-side demonstration**; the authoritative
  gate is server-side in `qr_pay.py`. The client never holds secrets.
- No debt minting: an inbound QR payment credits an existing account against a
  fiat clearing asset; it does not create balance out of nothing.
