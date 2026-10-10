import unittest
from zeno_core.ledger import ZenoLedger, Posting, AccountType


class TestZenoLedger(unittest.TestCase):
    def setUp(self):
        self.ledger = ZenoLedger()
        self.user1 = self.ledger.create_account(
            "usr_alice", "Alice Personal", AccountType.LIABILITY, owner="0xAlice"
        )
        self.user2 = self.ledger.create_account(
            "usr_bob", "Bob Personal", AccountType.LIABILITY, owner="0xBob"
        )

        # Deposit 10,000 JPY (10,000,000,000 uJPY) from bank escrow
        postings = [
            Posting("asset:fiat:boj_escrow", 10_000_000_000, "JPY"),
            Posting("usr_alice", -10_000_000_000, "JPY"),
        ]
        self.ledger.record_transaction(postings, "Initial Deposit")

    def test_double_entry_balance_equilibrium(self):
        # Alice sends 2,500 JPY to Bob
        amount = 2_500_000_000
        postings = [
            Posting("usr_alice", amount, "JPY"),
            Posting("usr_bob", -amount, "JPY"),
        ]
        tx = self.ledger.record_transaction(postings, "Transfer to Bob")
        self.assertIsNotNone(tx.tx_id)

        # Alice balance should now be -7,500,000,000 (credit)
        self.assertEqual(self.ledger.get_balance("usr_alice"), -7_500_000_000)
        # Bob balance should now be -2,500,000,000 (credit)
        self.assertEqual(self.ledger.get_balance("usr_bob"), -2_500_000_000)

    def test_unbalanced_transaction_fails(self):
        postings = [
            Posting("usr_alice", 1_000_000, "JPY"),
            Posting("usr_bob", -500_000, "JPY"),
        ]
        with self.assertRaises(ValueError):
            self.ledger.record_transaction(postings, "Unbalanced transfer")

    def test_insufficient_funds_fails(self):
        # Alice tries to send more than her 10,000 JPY balance
        excessive = 15_000_000_000
        postings = [
            Posting("usr_alice", excessive, "JPY"),
            Posting("usr_bob", -excessive, "JPY"),
        ]
        with self.assertRaises(ValueError) as ctx:
            self.ledger.record_transaction(postings, "Excessive transfer")
        self.assertIn("Insufficient funds", str(ctx.exception))

    def test_kintsugi_chain_integrity(self):
        self.assertTrue(self.ledger.verify_chain())
        self.assertGreaterEqual(len(self.ledger.chain), 1)

        # Record another transaction
        postings = [
            Posting("usr_alice", 1_000_000_000, "JPY"),
            Posting("usr_bob", -1_000_000_000, "JPY"),
        ]
        self.ledger.record_transaction(postings, "Second Transfer")
        self.assertTrue(self.ledger.verify_chain())
        self.assertEqual(len(self.ledger.chain), 2)

        # Tampering test: modify previous block
        self.ledger.chain[0].merkle_root = "tampered"
        self.assertFalse(self.ledger.verify_chain())


if __name__ == "__main__":
    unittest.main()
