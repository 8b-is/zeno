import unittest

from zeno_core.ledger import ZenoLedger
from zeno_core.transit_envelope import (
    CREW_WALLET,
    ENVELOPE_WALLET,
    allocate_transit_envelope,
    envelope_balance_jpy,
    ensure_crew_treasury,
)


class TransitEnvelopeTests(unittest.TestCase):
    def setUp(self):
        self.ledger = ZenoLedger()

    def test_envelope_allocation_is_double_entry_and_moves_1000_jpy(self):
        ensure_crew_treasury(self.ledger, deposit_jpy=4_820)
        envelope_id, tx = allocate_transit_envelope(self.ledger, amount_jpy=1_000)

        self.assertEqual(envelope_id, ENVELOPE_WALLET)
        self.assertEqual(sum(p.amount for p in tx.postings), 0)
        self.assertEqual(envelope_balance_jpy(self.ledger), 1_000)
        # crew wallet spent 1,000 of its 4,820 deposit
        self.assertEqual(-self.ledger.get_balance(CREW_WALLET) // 1_000_000, 3_820)

    def test_allocation_cannot_overdraw_the_crew_treasury(self):
        ensure_crew_treasury(self.ledger, deposit_jpy=500)
        with self.assertRaises(ValueError):
            allocate_transit_envelope(self.ledger, amount_jpy=1_000)
        self.assertEqual(envelope_balance_jpy(self.ledger), 0)

    def test_no_debt_is_minted(self):
        ensure_crew_treasury(self.ledger, deposit_jpy=1_000)
        allocate_transit_envelope(self.ledger, amount_jpy=1_000)
        # escrow asset still backs every liability claim, exactly
        escrow = self.ledger.get_balance("asset:fiat:boj_escrow")
        claims = -(
            self.ledger.get_balance(CREW_WALLET) + self.ledger.get_balance(ENVELOPE_WALLET)
        )
        self.assertEqual(escrow, claims)

    def test_chain_still_verifies_after_allocation(self):
        ensure_crew_treasury(self.ledger, deposit_jpy=4_820)
        allocate_transit_envelope(self.ledger, amount_jpy=1_000)
        self.assertTrue(self.ledger.verify_chain())


if __name__ == "__main__":
    unittest.main()
