"""Transit envelope: field-work funds moved from the 8b-crew treasury.

The physical Suica/PASMO read by the Android app is read-only, so ZENO books
the working funds instead: a double-entry allocation from the crew wallet to a
per-trip transit envelope. No debt is minted — the crew wallet is funded by a
fiat escrow deposit first, and the allocation merely moves liability claims.
"""

from typing import Tuple

from .ledger import AccountType, Posting, Transaction, ZenoLedger

CREW_WALLET = "wallet:crew_8b"
ENVELOPE_WALLET = "wallet:transit_envelope:ichigo"
UJPY_PER_JPY = 1_000_000

DEFAULT_ENVELOPE_JPY = 1_000
SUNGLASSES_CABLES_FOOD_JPY = 2_000
TOTAL_FIELD_ENVELOPE_JPY = DEFAULT_ENVELOPE_JPY + SUNGLASSES_CABLES_FOOD_JPY


def ensure_crew_treasury(ledger: ZenoLedger, deposit_jpy: int) -> None:
    """Fund the 8b-crew wallet from fiat escrow (asset up, liability up)."""
    if CREW_WALLET not in ledger.accounts:
        ledger.create_account(
            CREW_WALLET,
            "8b-is Crew Treasury Wallet",
            AccountType.LIABILITY,
            currency="JPY",
            owner="8b-is crew",
        )
    if ledger.get_balance(CREW_WALLET) == 0 and deposit_jpy > 0:
        amount = deposit_jpy * UJPY_PER_JPY
        ledger.record_transaction(
            [
                Posting("asset:fiat:boj_escrow", amount, "JPY"),
                Posting(CREW_WALLET, -amount, "JPY"),
            ],
            "8b-crew treasury fiat deposit (BoJ escrow)",
        )


def allocate_transit_envelope(
    ledger: ZenoLedger,
    amount_jpy: int = DEFAULT_ENVELOPE_JPY,
    memo: str = "Ichigo-ichie Japan field-work transit envelope",
) -> Tuple[str, Transaction]:
    """Move ``amount_jpy`` from the crew treasury into the transit envelope."""
    if ENVELOPE_WALLET not in ledger.accounts:
        ledger.create_account(
            ENVELOPE_WALLET,
            "Transit Envelope · Ichigo (physical IC top-up fund)",
            AccountType.LIABILITY,
            currency="JPY",
            owner="peter",
        )
    amount = amount_jpy * UJPY_PER_JPY
    tx = ledger.record_transaction(
        [
            Posting(CREW_WALLET, amount, "JPY"),
            Posting(ENVELOPE_WALLET, -amount, "JPY"),
        ],
        memo,
    )
    return ENVELOPE_WALLET, tx


def allocate_sunglasses_cables_food_envelope(
    ledger: ZenoLedger,
    amount_jpy: int = SUNGLASSES_CABLES_FOOD_JPY,
    memo: str = "Sunglasses, cables & food for Dra, Chris & Peter",
) -> Tuple[str, Transaction]:
    """Move ``amount_jpy`` (+¥2,000) for sunglasses, cables & food for Dra, Chris & Peter."""
    return allocate_transit_envelope(ledger, amount_jpy=amount_jpy, memo=memo)


def envelope_balance_jpy(ledger: ZenoLedger) -> int:
    """Available envelope funds in JPY (liability credit balance)."""
    if ENVELOPE_WALLET not in ledger.accounts:
        return 0
    return -ledger.get_balance(ENVELOPE_WALLET) // UJPY_PER_JPY
