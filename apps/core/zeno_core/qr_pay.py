"""
ZENO AEON Pay / Alipay-style QR Payment Layer — Asia First (銭・禅・善)

Canonical ``zeno://pay/<account_id>`` QR pay-URI scheme with an AEON Pay /
Alipay-style sovereign payment surface and a 3-D Secure (3DS) risk-based
challenge gate.

Semantics
---------
- ``receive`` mode: a merchant-presented QR that a payer scans to send the
  account money (fixed amount optional, else open amount at scan time).
- ``paycode`` mode: a customer-presented QR that a merchant scans to charge the
  account (short-lived nonce token).
- 3DS: amounts above a risk threshold require a one-time challenge (one-time
  passcode) before settlement. Settlement emits double-entry postings that sum
  to zero, honouring the ZENO Kintsugi equilibrium rule.

The URI is machine-readable and bank-branded (ZENO, ``8b-is Family Research
Company``, ``銭・禅・善``) so any ZENO-compatible reader can resolve and settle.
"""

from __future__ import annotations

import secrets
import time
import urllib.parse
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional

# --- ZENO bank identity (Asia-first branding) ---------------------------------
BANK_ID: str = "ZENO"
BANK_LEGAL: str = "8b-is Family Research Company"
BANK_MARK: str = "銭・禅・善"
PAY_SCHEME: str = "zeno"
PAY_HOST: str = "pay"

# 1 JPY = 1,000,000 uJPY (matches zeno_core.ledger Account micro-units)
MICRO_UNITS_PER_JPY: int = 1_000_000

# Inbound QR-payment clearing asset (exists in the default ZenoLedger).
QR_CLEARING_ACCOUNT: str = "asset:fiat:boj_escrow"

# 3DS risk gate: amounts at/above this many micro-yen require a challenge.
THREE_DS_CHALLENGE_THRESHOLD_UJPY: int = 1_000_000  # ¥1.00
MAX_CHALLENGE_ATTEMPTS: int = 3

_ACCOUNT_ID_RE = frozenset(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_:-."
)


class QrPayMode(str, Enum):
    RECEIVE = "receive"
    PAYCODE = "paycode"


class QrPayThreeDsStatus(str, Enum):
    NOT_REQUIRED = "not_required"
    CHALLENGE_REQUIRED = "challenge_required"
    CHALLENGE_PASSED = "challenge_passed"
    CHALLENGE_FAILED = "challenge_failed"
    SETTLED = "settled"


def new_nonce() -> str:
    """CSPRNG nonce so a QR pay-URI cannot be predicted or replayed."""
    return secrets.token_hex(12)


def _valid_account_id(account_id: str) -> bool:
    return bool(account_id) and all(c in _ACCOUNT_ID_RE for c in account_id)


@dataclass(frozen=True)
class QrPayUri:
    """A parsed/validated ZENO QR pay-URI."""

    account_id: str
    mode: QrPayMode = QrPayMode.RECEIVE
    amount_uJPY: Optional[int] = None
    memo: str = ""
    bank: str = BANK_ID
    ts: int = 0
    nonce: str = ""

    @property
    def uri(self) -> str:
        path = f"{PAY_SCHEME}://{PAY_HOST}/{urllib.parse.quote(self.account_id, safe='')}"
        params: Dict[str, str] = {"mode": self.mode.value, "bank": self.bank}
        if self.amount_uJPY is not None:
            params["amount"] = str(self.amount_uJPY)
        if self.memo:
            params["memo"] = self.memo
        if self.ts:
            params["ts"] = str(self.ts)
        if self.nonce:
            params["nonce"] = self.nonce
        return path + "?" + urllib.parse.urlencode(params)

    def to_dict(self) -> Dict[str, object]:
        return {
            "uri": self.uri,
            "accountId": self.account_id,
            "mode": self.mode.value,
            "amountUJPY": self.amount_uJPY,
            "amountJPY": (
                None if self.amount_uJPY is None else self.amount_uJPY / MICRO_UNITS_PER_JPY
            ),
            "memo": self.memo,
            "bank": self.bank,
            "bankLegal": BANK_LEGAL,
            "bankMark": BANK_MARK,
            "ts": self.ts,
            "nonce": self.nonce,
        }


def build_pay_uri(
    account_id: str,
    *,
    amount_uJPY: Optional[int] = None,
    memo: str = "",
    mode: QrPayMode = QrPayMode.RECEIVE,
    bank: str = BANK_ID,
    ts: Optional[int] = None,
    nonce: Optional[str] = None,
) -> str:
    """Build a canonical ``zeno://pay/<account>`` QR pay-URI string."""
    if not _valid_account_id(account_id):
        raise ValueError(f"Invalid ZENO account_id: {account_id!r}")
    if amount_uJPY is not None and amount_uJPY <= 0:
        raise ValueError("amount_uJPY must be a positive integer when provided")
    if amount_uJPY is not None and amount_uJPY != int(amount_uJPY):
        raise ValueError("amount_uJPY must be an integer")
    uri = QrPayUri(
        account_id=account_id,
        mode=mode,
        amount_uJPY=None if amount_uJPY is None else int(amount_uJPY),
        memo=memo,
        bank=bank,
        ts=int(time.time()) if ts is None else int(ts),
        nonce=new_nonce() if nonce is None else nonce,
    )
    return uri.uri


def parse_pay_uri(uri: str) -> QrPayUri:
    """Parse a ZENO QR pay-URI string into a ``QrPayUri`` (raises on malformed)."""
    parsed = urllib.parse.urlparse(uri)
    if parsed.scheme != PAY_SCHEME or parsed.netloc != PAY_HOST:
        raise ValueError(f"Not a ZENO pay URI: {uri!r}")
    account_id = urllib.parse.unquote(parsed.path.lstrip("/"))
    if not _valid_account_id(account_id):
        raise ValueError(f"Invalid account_id in pay URI: {account_id!r}")

    q = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    try:
        mode = QrPayMode(q.get("mode", [QrPayMode.RECEIVE.value])[0])
    except ValueError as exc:
        raise ValueError(f"Invalid pay mode: {q.get('mode')!r}") from exc

    amount_raw = q.get("amount", [None])[0]
    amount_uJPY: Optional[int] = None
    if amount_raw is not None:
        try:
            amount_uJPY = int(amount_raw)
        except ValueError as exc:
            raise ValueError(f"Invalid amount in pay URI: {amount_raw!r}") from exc
        if amount_uJPY <= 0:
            raise ValueError("amount must be a positive integer")

    memo = q.get("memo", [""])[0]
    bank = q.get("bank", [BANK_ID])[0]
    ts_raw = q.get("ts", ["0"])[0]
    try:
        ts = int(ts_raw)
    except ValueError as exc:
        raise ValueError(f"Invalid ts in pay URI: {ts_raw!r}") from exc

    nonce = q.get("nonce", [""])[0]
    if not nonce:
        raise ValueError("pay URI missing nonce (anti-replay)")

    return QrPayUri(
        account_id=account_id,
        mode=mode,
        amount_uJPY=amount_uJPY,
        memo=memo,
        bank=bank,
        ts=ts,
        nonce=nonce,
    )


def validate_pay_uri(uri: str) -> QrPayUri:
    """Parse and fully validate a ZENO QR pay-URI (alias with stricter intent)."""
    return parse_pay_uri(uri)


@dataclass
class QrPaySession:
    """A live QR payment session with a 3DS authentication lifecycle."""

    session_id: str
    uri: QrPayUri
    status: QrPayThreeDsStatus = QrPayThreeDsStatus.CHALLENGE_REQUIRED
    risk: str = ""
    attempts: int = 0
    created_at: float = field(default_factory=time.time)
    challenge_code: str = ""

    def to_dict(self) -> Dict[str, object]:
        return {
            "sessionId": self.session_id,
            "uri": self.uri.uri,
            "accountId": self.uri.account_id,
            "mode": self.uri.mode.value,
            "amountUJPY": self.uri.amount_uJPY,
            "amountJPY": (
                None if self.uri.amount_uJPY is None
                else self.uri.amount_uJPY / MICRO_UNITS_PER_JPY
            ),
            "bank": self.uri.bank,
            "bankLegal": BANK_LEGAL,
            "bankMark": BANK_MARK,
            "status": self.status.value,
            "risk": self.risk,
            "attempts": self.attempts,
            "createdAt": self.created_at,
        }


class QrPayThreeDs:
    """3-D Secure risk-based challenge gate for ZENO QR payments.

    Amounts at/above ``THREE_DS_CHALLENGE_THRESHOLD_UJPY`` require a one-time
    challenge before settlement. Lower amounts settle without a challenge
    (frictionless 3DS). A challenge is verified with a CSPRNG one-time code and
    bounded attempt count.
    """

    def __init__(self, max_attempts: int = MAX_CHALLENGE_ATTEMPTS) -> None:
        self.max_attempts = max(1, int(max_attempts))

    def _risk(self, amount_uJPY: Optional[int]) -> str:
        if amount_uJPY is None or amount_uJPY >= THREE_DS_CHALLENGE_THRESHOLD_UJPY:
            return "high"
        return "low"

    def begin(self, uri: str) -> QrPaySession:
        """Open a QR payment session; decide 3DS challenge requirement."""
        pay_uri = validate_pay_uri(uri)
        risk = self._risk(pay_uri.amount_uJPY)
        status = (
            QrPayThreeDsStatus.CHALLENGE_REQUIRED
            if risk == "high"
            else QrPayThreeDsStatus.NOT_REQUIRED
        )
        return QrPaySession(
            session_id=f"qr_{secrets.token_hex(8)}",
            uri=pay_uri,
            status=status,
            risk=risk,
        )

    def issue_challenge(self, session: QrPaySession) -> str:
        """Issue a one-time 3DS challenge code (CSPRNG, not stored plaintext)."""
        if session.status != QrPayThreeDsStatus.CHALLENGE_REQUIRED:
            raise ValueError("3DS challenge not required for this session")
        session.challenge_code = secrets.token_hex(6)
        return session.challenge_code

    def verify(self, session: QrPaySession, code: str) -> bool:
        """Verify a 3DS challenge code; enforces bounded attempts."""
        if session.status == QrPayThreeDsStatus.SETTLED:
            raise ValueError("session already settled")
        if session.status == QrPayThreeDsStatus.CHALLENGE_PASSED:
            return True
        if session.status == QrPayThreeDsStatus.NOT_REQUIRED:
            session.status = QrPayThreeDsStatus.CHALLENGE_PASSED
            return True

        session.attempts += 1
        if secrets.compare_digest(str(code), session.challenge_code):
            session.status = QrPayThreeDsStatus.CHALLENGE_PASSED
            return True
        if session.attempts >= self.max_attempts:
            session.status = QrPayThreeDsStatus.CHALLENGE_FAILED
        return False

    def settle(self, session: QrPaySession, ledger=None) -> Dict[str, Any]:
        """Settle a QR payment, emitting double-entry postings that sum to zero.

        Debits the fiat/clearing asset and credits the target account, honouring
        ZENO's double-entry equilibrium rule. Without a ledger, returns the
        balanced postings for the caller to post.
        """
        if session.status == QrPayThreeDsStatus.CHALLENGE_FAILED:
            raise ValueError("3DS challenge failed; settlement refused")
        if session.status not in (
            QrPayThreeDsStatus.NOT_REQUIRED,
            QrPayThreeDsStatus.CHALLENGE_PASSED,
        ):
            raise ValueError("session not authenticated for settlement")

        amount = session.uri.amount_uJPY
        if amount is None:
            raise ValueError("open-amount QR must be resolved before settlement")

        debit = {"account_id": QR_CLEARING_ACCOUNT, "amount": amount, "currency": "JPY"}
        credit = {"account_id": session.uri.account_id, "amount": -amount, "currency": "JPY"}
        if (debit["amount"] + credit["amount"]) != 0:
            raise ValueError("double-entry equilibrium violated (postings must sum to 0)")

        if ledger is not None:
            try:
                from zeno_core.ledger import Posting

                ledger.record_transaction(
                    [
                        Posting(**debit),
                        Posting(**credit),
                    ],
                    memo=f"zeno qr pay {session.session_id}",
                )
            except Exception as exc:  # pragma: no cover - ledger integration
                raise ValueError(f"ledger settlement failed: {exc}") from exc

        session.status = QrPayThreeDsStatus.SETTLED
        return {
            "sessionId": session.session_id,
            "status": session.status.value,
            "amountUJPY": amount,
            "amountJPY": amount / MICRO_UNITS_PER_JPY,
            "currency": "JPY",
            "postings": [debit, credit],
        }
