"""
Unit tests for ZENO Agent Commerce Protocol (ACP)
"""

import unittest
import time
from zeno_core.ledger import ZenoLedger, AccountType
from zeno_core.foken_gate import FokenBridge
from zeno_core.acp_protocol import AgentCommerceProtocol


class TestAgentCommerceProtocol(unittest.TestCase):
    def setUp(self):
        self.ledger = ZenoLedger()
        self.foken_bridge = FokenBridge(self.ledger)
        self.acp = AgentCommerceProtocol(self.ledger, self.foken_bridge)

        # Create test agent accounts with funds
        self.ledger.create_account("agt_requester", "Requester Agent", AccountType.LIABILITY, "JPY", "0xReq")
        self.ledger.create_account("agt_provider", "Provider Agent", AccountType.LIABILITY, "JPY", "0xProv")

        # Credit payer account with ¥10,000 (10,000,000,000 micro-yen credit = -10,000,000,000)
        self.ledger.accounts["agt_requester"].balance = -10_000_000_000

    def test_acp_manifest(self):
        manifest = self.acp.get_acp_manifest()
        self.assertEqual(manifest["version"], "1.2.0")
        self.assertIn("stripe_fiat", manifest["supportedRails"])
        self.assertIn("zeno_kintsugi", manifest["supportedRails"])
        self.assertEqual(len(manifest["services"]), 3)

    def test_full_acp_lifecycle(self):
        # 1. Create RFQ
        rfq = self.acp.create_rfq(
            requester_agent="agt_requester",
            provider_agent="agt_provider",
            service_type="code_review_audit",
            parameters={"prUrl": "https://github.com/8b-is/zeno/pull/42"},
        )
        self.assertTrue(rfq["rfqId"].startswith("rfq_"))

        # 2. Issue Quote (¥2,500)
        price_micro = 2_500_000_000
        quote = self.acp.issue_quote(
            rfq_id=rfq["rfqId"],
            provider_agent="agt_provider",
            price_micro_yen=price_micro,
            payment_rail="zeno_kintsugi",
            ttl_seconds=60,
        )
        self.assertEqual(quote.status, "offered")

        # 3. Lock Escrow
        escrow_res = self.acp.lock_escrow(
            quote_id=quote.quote_id,
            payer_agent="agt_requester",
            amount_micro_yen=price_micro,
        )
        self.assertEqual(escrow_res["status"], "escrow_locked")
        self.assertEqual(quote.status, "escrowed")
        self.assertTrue(self.ledger.verify_chain())

        # 4. Submit Delivery & Settle
        settle_res = self.acp.submit_delivery_and_settle(
            quote_id=quote.quote_id,
            provider_agent="agt_provider",
            proof_of_reasoning="AST verification complete: 0 vulnerabilities found, Fowler compliance 100%",
        )
        self.assertEqual(settle_res["status"], "settled")
        self.assertEqual(quote.status, "settled")

        # Verify provider received the exact funds
        provider_acct = self.ledger.get_account("agt_provider")
        self.assertEqual(provider_acct.balance, -price_micro)  # In double-entry liability credit is negative balance
        self.assertTrue(self.ledger.verify_chain())


if __name__ == "__main__":
    unittest.main()
