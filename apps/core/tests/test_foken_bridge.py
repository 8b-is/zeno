import unittest
from zeno_core.ledger import ZenoLedger, Posting, AccountType
from zeno_core.foken_gate import FokenBridge, InvoiceVerdict


class TestFokenBridge(unittest.TestCase):
    def setUp(self):
        self.ledger = ZenoLedger()
        self.bridge = FokenBridge(self.ledger, token_rate_jpy=100)
        self.valid_invoice = {
            "invoiceId": "01925b6a-91dc-7b18-8f55-123456789abc",
            "version": 1,
            "contributor": "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
            "work": {
                "title": "Zeno Core Engine",
                "description": "Double-entry ledger & streaming settlement",
                "repo": "https://github.com/8b-is/zeno",
                "commit": "a3f892c",
            },
            "artifact": {
                "provenanceHash": "sha256://b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
                "artifactUri": "ipfs://bafybeic52...",
            },
            "valuation": {
                "selfAssessedFokens": 50,
                "basis": "JPY",
                "rationale": "High leverage infrastructure work",
                "evidence": ["https://zeno.vaked.dev"],
            },
            "ipAssignment": {
                "statement": "IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
                "license": "MIT",
                "signedAt": "2026-10-11T08:30:00Z",
                "signature": "0x4f8a3c9b...",
            },
            "netUtility": {
                "futureWorkAvoidedHours": 100,
                "workAddedHours": 10,
                "maintenanceDebtHours": 5,
            },
            "dedup": {"claimedNovelty": "Novel architecture", "relatedInvoiceIds": []},
        }

    def test_passing_invoice(self):
        result = self.bridge.evaluate_invoice(self.valid_invoice)
        self.assertEqual(result.verdict, InvoiceVerdict.PASS)
        self.assertEqual(result.net_utility, 82.5)

    def test_net_negative_utility_fails(self):
        bad_inv = dict(self.valid_invoice)
        bad_inv["netUtility"] = {
            "futureWorkAvoidedHours": 10,
            "workAddedHours": 40,
            "maintenanceDebtHours": 20,
        }
        # net = 10 - (40 + 30) = -60
        result = self.bridge.evaluate_invoice(bad_inv)
        self.assertEqual(result.verdict, InvoiceVerdict.FAIL)
        self.assertIn("net-negative utility", result.reason)

    def test_missing_ip_assignment_fails(self):
        bad_inv = dict(self.valid_invoice)
        bad_inv["ipAssignment"] = {"statement": "STANDARD LICENSE", "signature": "0x123"}
        result = self.bridge.evaluate_invoice(bad_inv)
        self.assertEqual(result.verdict, InvoiceVerdict.FAIL)
        self.assertIn("no IP, no mint", result.reason)

    def test_mint_from_consensus(self):
        reviewers = [
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
            "0x3333333333333333333333333333333333333333",
            "0x4444444444444444444444444444444444444444",
        ]
        res = self.bridge.execute_mint_from_consensus(
            self.valid_invoice, reviewer_approvals=reviewers, total_reviewers=7
        )
        self.assertEqual(res["fokensMinted"], 50)
        self.assertEqual(res["jpyEquivalent"], 5000)

        # Contributor account should now hold credited balance
        cnt_acct = res["contributorAccount"]
        # Credit balance of 5000 JPY = -5,000,000,000 uJPY
        self.assertEqual(self.ledger.get_balance(cnt_acct), -5_000_000_000)
        self.assertTrue(self.ledger.verify_chain())


if __name__ == "__main__":
    unittest.main()
