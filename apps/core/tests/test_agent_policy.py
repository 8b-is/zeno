import unittest
from zeno_core.ledger import ZenoLedger, Posting, AccountType
from zeno_core.agent_policy import AgentPolicyEvaluator


class TestAgentPolicy(unittest.TestCase):
    def setUp(self):
        self.ledger = ZenoLedger()
        self.evaluator = AgentPolicyEvaluator(self.ledger)
        self.agent_policy = self.evaluator.register_agent(
            agent_id="test_agent_42",
            label="Inference Worker",
            owner="usr_operator",
            max_per_tx_jpy=1000,
            daily_limit_jpy=5000,
            allowed_counterparties=["srv_gpu_cloud", "srv_cloudflare"],
            require_proof_of_reasoning=True,
        )

        # Register counterparty account
        self.ledger.create_account(
            "srv_gpu_cloud", "GPU Cloud Vendor", AccountType.LIABILITY
        )
        self.ledger.create_account(
            "srv_unauthorized_vendor", "Rogue Vendor", AccountType.LIABILITY
        )

        # Fund the agent account with 10,000 JPY
        self.ledger.record_transaction(
            [
                Posting("asset:fiat:boj_escrow", 10_000_000_000, "JPY"),
                Posting("agt_test_agent_42", -10_000_000_000, "JPY"),
            ],
            "Funding Agent",
        )

    def test_authorized_spend_with_por(self):
        res = self.evaluator.execute_agent_spend(
            agent_account_id="agt_test_agent_42",
            to_account="srv_gpu_cloud",
            amount_micro_yen=500_000_000,  # 500 JPY
            reasoning_trace="Evaluated GPU spot price at 500 JPY; dispatching model inference.",
        )
        self.assertIsNotNone(res["txId"])
        self.assertIsNotNone(res["porHash"])

    def test_exceeding_per_tx_limit_fails(self):
        with self.assertRaises(PermissionError):
            self.evaluator.execute_agent_spend(
                agent_account_id="agt_test_agent_42",
                to_account="srv_gpu_cloud",
                amount_micro_yen=1_500_000_000,  # 1500 JPY > 1000 limit
                reasoning_trace="Large batch execution",
            )

    def test_unauthorized_counterparty_fails(self):
        with self.assertRaises(PermissionError):
            self.evaluator.execute_agent_spend(
                agent_account_id="agt_test_agent_42",
                to_account="srv_unauthorized_vendor",
                amount_micro_yen=100_000_000,  # 100 JPY
                reasoning_trace="Attempted rogue spend",
            )

    def test_missing_proof_of_reasoning_fails(self):
        with self.assertRaises(ValueError):
            self.evaluator.execute_agent_spend(
                agent_account_id="agt_test_agent_42",
                to_account="srv_gpu_cloud",
                amount_micro_yen=100_000_000,
                reasoning_trace="",  # Empty
            )


if __name__ == "__main__":
    unittest.main()
