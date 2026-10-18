"""
Unit tests for ZENO Stripe Compatibility Bridge
"""

import unittest
import time
import hmac
import hashlib
import json
from zeno_core.ledger import ZenoLedger, AccountType
from zeno_core.agent_policy import AgentPolicyEvaluator
from zeno_core.stripe_bridge import StripeBridge


class TestStripeBridge(unittest.TestCase):
    def setUp(self):
        self.ledger = ZenoLedger()
        self.policy_eval = AgentPolicyEvaluator(self.ledger)
        self.bridge = StripeBridge(
            ledger=self.ledger,
            policy_evaluator=self.policy_eval,
            webhook_secret="whsec_test_secret_zeno_2026",
        )

        # Register test agent with spending limits
        self.policy_eval.register_agent(
            agent_id="test_agent",
            label="Test Autonomous Agent",
            owner="0xAgentOwnerKey",
            max_per_tx_jpy=10000,
            daily_limit_jpy=50000,
            allowed_counterparties=["asset:stripe:clearing", "cnt_0x71c8"],
            require_proof_of_reasoning=True,
        )

    def test_webhook_signature_verification(self):
        payload = json.dumps({"id": "evt_test_123", "type": "payment_intent.succeeded"}).encode("utf-8")
        timestamp = int(time.time())
        signed_payload = f"{timestamp}.".encode("utf-8") + payload
        sig = hmac.new(b"whsec_test_secret_zeno_2026", signed_payload, hashlib.sha256).hexdigest()
        sig_header = f"t={timestamp},v1={sig}"

        self.assertTrue(self.bridge.verify_webhook_signature(payload, sig_header))

    def test_webhook_replay_protection(self):
        payload = b'{"id":"evt_old"}'
        old_timestamp = int(time.time()) - 600  # 10 minutes ago
        signed_payload = f"{old_timestamp}.".encode("utf-8") + payload
        sig = hmac.new(b"whsec_test_secret_zeno_2026", signed_payload, hashlib.sha256).hexdigest()
        sig_header = f"t={old_timestamp},v1={sig}"

        with self.assertRaises(PermissionError):
            self.bridge.verify_webhook_signature(payload, sig_header)

    def test_payment_intent_and_checkout_session(self):
        pi = self.bridge.create_payment_intent(
            amount_cents=5000,
            currency="jpy",
            agent_id="agt_test_agent",
        )
        self.assertTrue(pi["id"].startswith("pi_zeno_"))
        self.assertEqual(pi["amount"], 5000)
        self.assertEqual(pi["metadata"]["agent_id"], "agt_test_agent")

        cs = self.bridge.create_checkout_session(
            success_url="https://zeno.vaked.dev/success",
            cancel_url="https://zeno.vaked.dev/cancel",
            line_items=[{"name": "Sovereign SaaS", "amountCents": 12000, "currency": "jpy", "quantity": 1}],
        )
        self.assertTrue(cs["id"].startswith("cs_zeno_"))
        self.assertEqual(cs["amount_total"], 12000)

    def test_virtual_card_issuing_with_por(self):
        # Card issue requires proof of reasoning
        with self.assertRaises(ValueError):
            self.bridge.issue_virtual_card(
                agent_id="agt_test_agent",
                spend_limit_cents=2500,
                currency="usd",
                proof_of_reasoning="",
            )

        card = self.bridge.issue_virtual_card(
            agent_id="agt_test_agent",
            spend_limit_cents=2500,
            currency="usd",
            purpose="Deploy Hetzner GPU inference node",
            proof_of_reasoning="Task #8841: GPU compute requirement verified by SweAF reasoner",
        )
        self.assertTrue(card["id"].startswith("ic_zeno_"))
        self.assertEqual(card["type"], "virtual")
        self.assertEqual(card["status"], "active")
        self.assertTrue(len(card["last4"]) == 4)

    def test_webhook_revenue_splitting_in_kintsugi_ledger(self):
        event_payload = {
            "id": "evt_checkout_100k_yen",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "amount_total": 100000,  # ¥100,000 JPY
                    "currency": "jpy",
                }
            }
        }

        res = self.bridge.process_webhook_event(event_payload)
        self.assertEqual(res["status"], "settled")
        self.assertEqual(res["grossMicroYen"], 100_000_000_000)

        # Verify Sanpo Yoshi splits in ledger
        # Family Love (Mom Alexandra): 15% = ¥15,000
        # Family Pillar (Dad Chris): 15% = ¥15,000
        # 8b-is Crew Treasury: 40% = ¥40,000
        # Agents Compute (Crush + SweAF): 20% = ¥20,000
        # Universal Tithe: 10% = ¥10,000
        splits = res["splits"]
        self.assertEqual(splits["familyLoveAlexandra"], 15_000_000_000)
        self.assertEqual(splits["familyPillarChris"], 15_000_000_000)
        self.assertEqual(splits["crewTreasury"], 40_000_000_000)
        self.assertEqual(splits["agentCrush"] + splits["agentSweAF"], 20_000_000_000)
        self.assertEqual(splits["universalTithe"], 10_000_000_000)

        # Check ledger balance equilibrium
        self.assertTrue(self.ledger.verify_chain())

        # Test idempotency
        dup_res = self.bridge.process_webhook_event(event_payload)
        self.assertEqual(dup_res["status"], "idempotent_skip")

    def test_usd_ach_payout_and_aba_checksum(self):
        # Valid ABA routing number (mod-10 check passes)
        self.assertTrue(self.bridge.verify_aba_routing_number("111000025"))
        self.assertFalse(self.bridge.verify_aba_routing_number("111000026"))

        res = self.bridge.settle_usd_ach_payout(
            amount_usd=360000.0,
            routing_number="111000025",
            account_number="0000998877",
        )
        self.assertEqual(res["amountUsd"], 360000.0)
        self.assertEqual(res["equivalentJpy"], 54_000_000)
        self.assertEqual(res["abaRoutingMasked"], "****0025")
        self.assertEqual(res["accountMasked"], "****8877")
        self.assertTrue(res["abaMod10ChecksumVerified"])
        self.assertTrue(res["volatileBuffersZeroized"])
        self.assertTrue(self.ledger.verify_chain())


if __name__ == "__main__":
    unittest.main()
