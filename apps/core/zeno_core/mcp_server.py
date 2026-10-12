"""
ZENO Model Context Protocol (MCP) Server (JSON-RPC 2.0)
Standardized Anthropic Model Context Protocol server exposing Stripe financial rails,
ACP machine-to-machine commerce, and ZENO Kintsugi double-entry ledger tools to LLMs.
"""

import sys
import json
import time
from typing import Any, Dict, List, Optional
from .ledger import ZenoLedger, Posting, AccountType
from .agent_policy import AgentPolicyEvaluator
from .stripe_bridge import StripeBridge
from .acp_protocol import AgentCommerceProtocol


class ZenoMCPServer:
    def __init__(self, ledger: Optional[ZenoLedger] = None):
        self.ledger = ledger or ZenoLedger()
        self.policy_evaluator = AgentPolicyEvaluator(self.ledger)
        self.stripe_bridge = StripeBridge(self.ledger, self.policy_evaluator)
        self.acp = AgentCommerceProtocol(self.ledger)

        # Seed standard agent policy for testing and execution
        self._seed_agent_policies()

    def _seed_agent_policies(self) -> None:
        """Seed default sovereign agent policies."""
        if not self.policy_evaluator.policies.get("agt_crush_reasoner"):
            self.policy_evaluator.register_agent(
                agent_id="crush_reasoner",
                label="Crush Autonomous Compute Agent",
                owner="0xCrushReasonerOwnerKey",
                max_per_tx_jpy=50000,
                daily_limit_jpy=200000,
                allowed_counterparties=["srv_hetzner", "cnt_0x71c8", "treasury:universal", "asset:stripe:clearing"],
                require_proof_of_reasoning=True,
            )

    def get_tools_list(self) -> List[Dict[str, Any]]:
        """Return MCP tools definition conforming to protocol specification."""
        return [
            {
                "name": "stripe_create_payment_intent",
                "description": "Generate a Stripe PaymentIntent for inbound checkout or card charge with agent attribution.",
                "inputSchema": {
                    "type": "object",
                    "required": ["amountCents", "currency"],
                    "properties": {
                        "amountCents": {"type": "integer", "description": "Amount in minor currency units (e.g. 5000 for ¥5,000 or $50.00)"},
                        "currency": {"type": "string", "enum": ["jpy", "usd", "eur"], "default": "jpy"},
                        "customerId": {"type": "string", "description": "Optional Stripe Customer ID"},
                        "agentId": {"type": "string", "description": "Calling agent account ID"},
                        "metadata": {"type": "object"}
                    }
                }
            },
            {
                "name": "stripe_create_checkout_session",
                "description": "Create a hosted Stripe Checkout session URL for customer SaaS subscriptions or donations.",
                "inputSchema": {
                    "type": "object",
                    "required": ["successUrl", "cancelUrl", "lineItems"],
                    "properties": {
                        "successUrl": {"type": "string"},
                        "cancelUrl": {"type": "string"},
                        "lineItems": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["name", "amountCents", "currency", "quantity"],
                                "properties": {
                                    "name": {"type": "string"},
                                    "amountCents": {"type": "integer"},
                                    "currency": {"type": "string"},
                                    "quantity": {"type": "integer", "default": 1}
                                }
                            }
                        },
                        "mode": {"type": "string", "enum": ["payment", "subscription"], "default": "payment"}
                    }
                }
            },
            {
                "name": "stripe_record_metered_usage",
                "description": "Report metered LLM token counts, compute duration, or tool runs to Stripe Metered Billing.",
                "inputSchema": {
                    "type": "object",
                    "required": ["subscriptionItemId", "quantity", "agentId"],
                    "properties": {
                        "subscriptionItemId": {"type": "string"},
                        "quantity": {"type": "integer"},
                        "agentId": {"type": "string"},
                        "action": {"type": "string", "enum": ["increment", "set"], "default": "increment"}
                    }
                }
            },
            {
                "name": "stripe_issue_virtual_card",
                "description": "Mint an ephemeral or merchant-locked virtual debit card via Stripe Issuing for autonomous agent spend.",
                "inputSchema": {
                    "type": "object",
                    "required": ["agentId", "spendLimitCents", "purpose", "proofOfReasoning"],
                    "properties": {
                        "agentId": {"type": "string"},
                        "spendLimitCents": {"type": "integer"},
                        "currency": {"type": "string", "enum": ["usd", "jpy", "eur"], "default": "usd"},
                        "purpose": {"type": "string"},
                        "proofOfReasoning": {"type": "string"}
                    }
                }
            },
            {
                "name": "stripe_get_balance",
                "description": "Retrieve live available, pending, and clearing balances across currency vaults.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "acp_request_quote",
                "description": "Submit a standardized Request for Quote (RFQ) to an agent peer via Agent Commerce Protocol.",
                "inputSchema": {
                    "type": "object",
                    "required": ["requesterAgent", "providerAgent", "serviceType"],
                    "properties": {
                        "requesterAgent": {"type": "string"},
                        "providerAgent": {"type": "string"},
                        "serviceType": {"type": "string"},
                        "parameters": {"type": "object"}
                    }
                }
            },
            {
                "name": "acp_settle_invoice",
                "description": "Settle an ACP invoice against cryptographic Proof of Reasoning (PoR) and release escrow.",
                "inputSchema": {
                    "type": "object",
                    "required": ["quoteId", "providerAgent", "proofOfReasoning"],
                    "properties": {
                        "quoteId": {"type": "string"},
                        "providerAgent": {"type": "string"},
                        "proofOfReasoning": {"type": "string"}
                    }
                }
            },
            {
                "name": "zeno_bridge_convert",
                "description": "Convert and bridge fiat receivables into sovereign ZENO Kintsugi double-entry equity.",
                "inputSchema": {
                    "type": "object",
                    "required": ["amountCents", "currency", "targetVault"],
                    "properties": {
                        "amountCents": {"type": "integer"},
                        "currency": {"type": "string", "enum": ["jpy", "usd", "eur"]},
                        "targetVault": {"type": "string", "description": "Target vault account ID (e.g. cnt_0x71c8)"}
                    }
                }
            }
        ]

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute MCP tool dispatch."""
        if tool_name == "stripe_create_payment_intent":
            return self.stripe_bridge.create_payment_intent(
                amount_cents=arguments["amountCents"],
                currency=arguments.get("currency", "jpy"),
                customer_id=arguments.get("customerId"),
                agent_id=arguments.get("agentId"),
                metadata=arguments.get("metadata"),
            )

        elif tool_name == "stripe_create_checkout_session":
            return self.stripe_bridge.create_checkout_session(
                success_url=arguments["successUrl"],
                cancel_url=arguments["cancelUrl"],
                line_items=arguments["lineItems"],
                mode=arguments.get("mode", "payment"),
            )

        elif tool_name == "stripe_record_metered_usage":
            return self.stripe_bridge.record_metered_usage(
                subscription_item_id=arguments["subscriptionItemId"],
                quantity=arguments["quantity"],
                agent_id=arguments["agentId"],
                action=arguments.get("action", "increment"),
            )

        elif tool_name == "stripe_issue_virtual_card":
            return self.stripe_bridge.issue_virtual_card(
                agent_id=arguments["agentId"],
                spend_limit_cents=arguments["spendLimitCents"],
                currency=arguments.get("currency", "usd"),
                purpose=arguments.get("purpose", ""),
                proof_of_reasoning=arguments.get("proofOfReasoning", ""),
            )

        elif tool_name == "stripe_get_balance":
            clearing = self.ledger.get_account("asset:stripe:clearing")
            crew = self.ledger.get_account("cnt_0x71c8")
            return {
                "object": "balance",
                "clearingBalanceJPY": (clearing.balance / 1_000_000) if clearing else 0,
                "crewSovereignVaultJPY": (-crew.balance / 1_000_000) if crew else 0,
                "currencies": ["JPY", "USD", "EUR"],
                "liveGateway": "active",
            }

        elif tool_name == "acp_request_quote":
            rfq = self.acp.create_rfq(
                requester_agent=arguments["requesterAgent"],
                provider_agent=arguments["providerAgent"],
                service_type=arguments["serviceType"],
                parameters=arguments.get("parameters"),
            )
            # Default auto-quote simulation
            quote = self.acp.issue_quote(
                rfq_id=rfq["rfqId"],
                provider_agent=arguments["providerAgent"],
                price_micro_yen=100_000_000,  # 100 JPY
                payment_rail="zeno_kintsugi",
            )
            return {"rfq": rfq, "quote": quote.__dict__}

        elif tool_name == "acp_settle_invoice":
            return self.acp.submit_delivery_and_settle(
                quote_id=arguments["quoteId"],
                provider_agent=arguments["providerAgent"],
                proof_of_reasoning=arguments["proofOfReasoning"],
            )

        elif tool_name == "zeno_bridge_convert":
            amt_cents = arguments["amountCents"]
            curr = arguments.get("currency", "jpy").upper()
            target = arguments["targetVault"]
            micro_yen = amt_cents * 1_000_000 if curr == "JPY" else amt_cents * 1_500_000

            postings = [
                Posting(account_id="asset:stripe:clearing", amount=micro_yen, currency="JPY"),
                Posting(account_id=target, amount=-micro_yen, currency="JPY"),
            ]
            tx = self.ledger.record_transaction(
                postings=postings,
                memo=f"Zeno Bridge Conversion [{curr} -> JPY] -> {target}",
                signature="0x-bridge-conversion",
            )
            return {"status": "converted", "txId": tx.tx_id, "creditedMicroYen": micro_yen}

        raise KeyError(f"Unknown MCP tool: {tool_name}")

    def handle_json_rpc(self, request_str: str) -> str:
        """Handle incoming standard JSON-RPC 2.0 message."""
        try:
            req = json.loads(request_str)
            msg_id = req.get("id")
            method = req.get("method")
            params = req.get("params", {})

            if method == "initialize":
                res = {
                    "protocolVersion": "2024-11-05",
                    "serverInfo": {
                        "name": "zeno-stripe-acp-server",
                        "version": "1.2.0"
                    },
                    "capabilities": {
                        "tools": {"listChanged": False},
                        "resources": {"subscribe": False, "listChanged": False}
                    }
                }
                return json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": res})

            elif method == "tools/list":
                return json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": {"tools": self.get_tools_list()}})

            elif method == "tools/call":
                name = params.get("name")
                args = params.get("arguments", {})
                tool_result = self.call_tool(name, args)
                return json.dumps({
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "content": [{"type": "text", "text": json.dumps(tool_result, indent=2)}]
                    }
                })

            elif method == "resources/list":
                res = {
                    "resources": [
                        {"uri": "stripe://balance", "name": "Live Stripe & Zeno Balances", "mimeType": "application/json"},
                        {"uri": "acp://capabilities", "name": "ACP Capabilities & Rails", "mimeType": "application/json"},
                    ]
                }
                return json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": res})

            elif method == "resources/read":
                uri = params.get("uri")
                if uri == "stripe://balance":
                    content = json.dumps(self.call_tool("stripe_get_balance", {}))
                elif uri == "acp://capabilities":
                    content = json.dumps(self.acp.get_acp_manifest())
                else:
                    return json.dumps({"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32602, "message": "Resource not found"}})
                return json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": {"contents": [{"uri": uri, "text": content}]}})

            return json.dumps({"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32601, "message": f"Method not found: {method}"}})

        except Exception as e:
            return json.dumps({"jsonrpc": "2.0", "id": req.get("id") if 'req' in locals() else None, "error": {"code": -32000, "message": str(e)}})


def main():
    """Run standard stdio loop for MCP clients."""
    server = ZenoMCPServer()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        response = server.handle_json_rpc(line)
        sys.stdout.write(response + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
