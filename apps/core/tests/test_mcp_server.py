"""
Unit tests for ZENO Model Context Protocol (MCP) Server
"""

import unittest
import json
from zeno_core.mcp_server import ZenoMCPServer


class TestZenoMCPServer(unittest.TestCase):
    def setUp(self):
        self.server = ZenoMCPServer()

    def test_json_rpc_initialize(self):
        req = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        resp = json.loads(self.server.handle_json_rpc(req))
        self.assertEqual(resp["id"], 1)
        self.assertEqual(resp["result"]["protocolVersion"], "2024-11-05")
        self.assertEqual(resp["result"]["serverInfo"]["name"], "zeno-stripe-acp-server")

    def test_tools_list(self):
        req = json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        resp = json.loads(self.server.handle_json_rpc(req))
        tools = resp["result"]["tools"]
        tool_names = [t["name"] for t in tools]
        self.assertEqual(len(tools), 8)
        self.assertIn("stripe_create_payment_intent", tool_names)
        self.assertIn("stripe_create_checkout_session", tool_names)
        self.assertIn("stripe_record_metered_usage", tool_names)
        self.assertIn("stripe_issue_virtual_card", tool_names)
        self.assertIn("stripe_get_balance", tool_names)
        self.assertIn("acp_request_quote", tool_names)
        self.assertIn("acp_settle_invoice", tool_names)
        self.assertIn("zeno_bridge_convert", tool_names)

    def test_tool_call_stripe_payment_intent(self):
        req = json.dumps({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "stripe_create_payment_intent",
                "arguments": {
                    "amountCents": 3000,
                    "currency": "jpy",
                    "agentId": "agt_crush_reasoner",
                }
            }
        })
        resp = json.loads(self.server.handle_json_rpc(req))
        content = json.loads(resp["result"]["content"][0]["text"])
        self.assertTrue(content["id"].startswith("pi_zeno_"))
        self.assertEqual(content["amount"], 3000)

    def test_tool_call_issue_virtual_card(self):
        req = json.dumps({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "stripe_issue_virtual_card",
                "arguments": {
                    "agentId": "agt_crush_reasoner",
                    "spendLimitCents": 5000,
                    "currency": "usd",
                    "purpose": "Hetzner cloud server provisioning",
                    "proofOfReasoning": "Automated infra deployment requested by operator",
                }
            }
        })
        resp = json.loads(self.server.handle_json_rpc(req))
        content = json.loads(resp["result"]["content"][0]["text"])
        self.assertTrue(content["id"].startswith("ic_zeno_"))
        self.assertEqual(content["brand"], "Visa")
        self.assertEqual(content["status"], "active")

    def test_resources_list_and_read(self):
        req_list = json.dumps({"jsonrpc": "2.0", "id": 5, "method": "resources/list", "params": {}})
        resp_list = json.loads(self.server.handle_json_rpc(req_list))
        self.assertTrue(len(resp_list["result"]["resources"]) >= 2)

        req_read = json.dumps({"jsonrpc": "2.0", "id": 6, "method": "resources/read", "params": {"uri": "stripe://balance"}})
        resp_read = json.loads(self.server.handle_json_rpc(req_read))
        content = json.loads(resp_read["result"]["contents"][0]["text"])
        self.assertEqual(content["object"], "balance")


if __name__ == "__main__":
    unittest.main()
