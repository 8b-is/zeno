"""
ZENO Agent Commerce Protocol (ACP) Engine (自律取引プロトコル)
Decentralized, machine-to-machine negotiation, escrow, and multi-rail settlement for AI agents.
"""

import time
import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from .ledger import ZenoLedger, Posting, AccountType
from .foken_gate import FokenBridge, InvoiceVerdict


@dataclass
class ACPQuote:
    quote_id: str
    rfq_id: str
    provider_agent: str
    payer_agent: str
    price_micro_yen: int
    payment_rail: str  # "stripe_fiat", "zeno_kintsugi", "zeno_microstream"
    valid_until: int
    status: str = "offered"  # "offered", "escrowed", "settled", "expired", "disputed"
    escrow_account_id: Optional[str] = None
    created_at: int = field(default_factory=lambda: int(time.time()))


class AgentCommerceProtocol:
    def __init__(
        self,
        ledger: ZenoLedger,
        foken_bridge: Optional[FokenBridge] = None,
        node_id: str = "node_8b_is_tokyo_edge",
    ):
        self.ledger = ledger
        self.foken_bridge = foken_bridge or FokenBridge(ledger)
        self.node_id = node_id
        self.rfqs: Dict[str, Dict[str, Any]] = {}
        self.quotes: Dict[str, ACPQuote] = {}

    def get_acp_manifest(self) -> Dict[str, Any]:
        """Generate /.well-known/acp.json discovery document."""
        return {
            "$schema": "https://zeno.vaked.dev/spec/acp-v1.json",
            "version": "1.2.0",
            "entity": "8b-is Family Research Company (https://8b.is)",
            "crew": ["Hue", "Aye", "Taisha", "Omni"],
            "nodeId": self.node_id,
            "supportedRails": ["stripe_fiat", "zeno_kintsugi", "zeno_microstream", "revolut_ultra"],
            "supportedCurrencies": ["JPY", "USD", "EUR", "HUF"],
            "services": [
                {
                    "serviceId": "inference_compute",
                    "pricingModel": "metered_per_token",
                    "baseRateMicroYenPerToken": 300,
                    "minSlaSeconds": 2.0,
                },
                {
                    "serviceId": "code_review_audit",
                    "pricingModel": "fixed_per_job",
                    "baseRateMicroYen": 2500000000,
                    "fokenGateEligible": True,
                },
                {
                    "serviceId": "market_quant_arbitrage",
                    "pricingModel": "profit_share_kintsugi",
                    "baseRateSharePercent": 15.0,
                }
            ],
            "endpoints": {
                "rfq": "https://zeno.vaked.dev/api/v1/acp/rfq",
                "quote": "https://zeno.vaked.dev/api/v1/acp/quote",
                "escrow": "https://zeno.vaked.dev/api/v1/acp/escrow",
                "settle": "https://zeno.vaked.dev/api/v1/acp/settle",
            }
        }

    def create_rfq(
        self,
        requester_agent: str,
        provider_agent: str,
        service_type: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Register a new Request for Quote between two agents."""
        rfq_id = f"rfq_{hashlib.sha256(f'{requester_agent}_{provider_agent}_{time.time()}'.encode()).hexdigest()[:16]}"
        record = {
            "rfqId": rfq_id,
            "requesterAgent": requester_agent,
            "providerAgent": provider_agent,
            "serviceType": service_type,
            "parameters": parameters or {},
            "status": "pending_quote",
            "createdAt": int(time.time()),
        }
        self.rfqs[rfq_id] = record
        return record

    def issue_quote(
        self,
        rfq_id: str,
        provider_agent: str,
        price_micro_yen: int,
        payment_rail: str = "zeno_kintsugi",
        ttl_seconds: int = 120,
    ) -> ACPQuote:
        """Issue an authoritative, cryptographically referenced quote for an RFQ."""
        rfq = self.rfqs.get(rfq_id)
        if not rfq:
            raise KeyError(f"RFQ {rfq_id} not found")

        quote_id = f"quo_{hashlib.sha256(f'{rfq_id}_{price_micro_yen}_{time.time()}'.encode()).hexdigest()[:16]}"
        quote = ACPQuote(
            quote_id=quote_id,
            rfq_id=rfq_id,
            provider_agent=provider_agent,
            payer_agent=rfq["requesterAgent"],
            price_micro_yen=price_micro_yen,
            payment_rail=payment_rail,
            valid_until=int(time.time()) + ttl_seconds,
            status="offered",
        )
        self.quotes[quote_id] = quote
        rfq["status"] = "quoted"
        rfq["activeQuoteId"] = quote_id
        return quote

    def lock_escrow(
        self,
        quote_id: str,
        payer_agent: str,
        amount_micro_yen: int,
    ) -> Dict[str, Any]:
        """
        Lock programmatic escrow in Kintsugi double-entry ledger before task execution.
        """
        quote = self.quotes.get(quote_id)
        if not quote:
            raise KeyError(f"Quote {quote_id} not found")

        if int(time.time()) > quote.valid_until:
            quote.status = "expired"
            raise TimeoutError("Quote expired before escrow could be locked")

        if payer_agent != quote.payer_agent:
            raise PermissionError(f"Payer {payer_agent} does not match quote payer {quote.payer_agent}")

        if amount_micro_yen != quote.price_micro_yen:
            raise ValueError(f"Escrow amount {amount_micro_yen} does not match quote {quote.price_micro_yen}")

        escrow_account_id = f"escrow:acp:{quote_id}"
        if not self.ledger.get_account(escrow_account_id):
            self.ledger.create_account(
                account_id=escrow_account_id,
                label=f"ACP Escrow [{quote_id}]",
                account_type=AccountType.LIABILITY,
                currency="JPY",
                owner=f"0xEscrowContract_{quote_id}",
            )

        # Move funds from payer agent to escrow account
        postings = [
            Posting(account_id=payer_agent, amount=amount_micro_yen, currency="JPY"),
            Posting(account_id=escrow_account_id, amount=-amount_micro_yen, currency="JPY"),
        ]
        tx = self.ledger.record_transaction(
            postings=postings,
            memo=f"ACP Escrow Lock for Quote:{quote_id}",
            signature=f"0x-acp-escrow-{quote_id[:8]}",
        )

        quote.status = "escrowed"
        quote.escrow_account_id = escrow_account_id

        return {
            "status": "escrow_locked",
            "quoteId": quote_id,
            "escrowAccountId": escrow_account_id,
            "txId": tx.tx_id,
            "amountMicroYen": amount_micro_yen,
        }

    def submit_delivery_and_settle(
        self,
        quote_id: str,
        provider_agent: str,
        proof_of_reasoning: str,
        foken_invoice: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Verify Proof of Reasoning (PoR), validate Foken net-utility if applicable,
        and release escrow to the provider agent.
        """
        quote = self.quotes.get(quote_id)
        if not quote:
            raise KeyError(f"Quote {quote_id} not found")

        if quote.status != "escrowed":
            raise ValueError(f"Cannot settle quote in status: {quote.status}")

        if not proof_of_reasoning:
            raise ValueError("Proof of reasoning is strictly required to settle ACP delivery")

        por_hash = hashlib.sha256(proof_of_reasoning.encode("utf-8")).hexdigest()

        # Optional Foken valuation check
        if foken_invoice:
            foken_eval = self.foken_bridge.evaluate_invoice(foken_invoice)
            if foken_eval.verdict == InvoiceVerdict.REJECTED:
                quote.status = "disputed"
                raise PermissionError("Delivery rejected by deterministic Foken valuation gate (negative net-utility)")

        # Release escrow to provider
        postings = [
            Posting(account_id=quote.escrow_account_id, amount=quote.price_micro_yen, currency="JPY"),
            Posting(account_id=provider_agent, amount=-quote.price_micro_yen, currency="JPY"),
        ]
        tx = self.ledger.record_transaction(
            postings=postings,
            memo=f"ACP Settlement PoR:{por_hash[:12]} Rail:{quote.payment_rail}",
            signature=f"0x-acp-settled-{por_hash[:12]}",
        )

        quote.status = "settled"

        return {
            "status": "settled",
            "quoteId": quote_id,
            "providerAgent": provider_agent,
            "payerAgent": quote.payer_agent,
            "amountMicroYen": quote.price_micro_yen,
            "paymentRail": quote.payment_rail,
            "porHash": por_hash,
            "txId": tx.tx_id,
        }
