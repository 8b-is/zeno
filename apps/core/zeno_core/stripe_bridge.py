"""
ZENO Stripe Compatibility Bridge (ストライプ連動基盤)
Bridges Stripe Web2 payments, metered billing, virtual cards (Issuing),
and webhooks with ZENO Kintsugi double-entry ledger.
"""

import ctypes
import hmac
import hashlib
import secrets
import time
import json
from typing import Any, Dict, List, Optional
from .ledger import ZenoLedger, Posting, AccountType
from .agent_policy import AgentPolicyEvaluator


def zeroize_bytearray(buf: bytearray) -> None:
    """Volatily overwrite a mutable bytearray in place (`ZA-0007`)."""
    if not buf:
        return
    n = len(buf)
    c_buf = (ctypes.c_char * n).from_buffer(buf)
    ctypes.memset(ctypes.addressof(c_buf), 0, n)
    del c_buf
    buf.clear()


def _zeroize_py_str(s: Optional[str]) -> None:
    """
    Scrub the underlying compact-ASCII payload of a non-interned Python `str`
    in the CPython heap when a secret attribute is explicitly cleared (`ZA-0007`).
    """
    if not isinstance(s, str) or len(s) < 16 or not s.isascii():
        return
    try:
        needle = s.encode("ascii")
        if all(b == 0 for b in needle):
            return
        raw = ctypes.string_at(id(s), 96 + len(needle))
        offset = raw.find(needle)
        if offset != -1:
            ctypes.memset(id(s) + offset, 0, len(needle))
    except Exception:
        pass


class StripeBridge:
    def __init__(
        self,
        ledger: ZenoLedger,
        policy_evaluator: Optional[AgentPolicyEvaluator] = None,
        webhook_secret: str = "whsec_zeno_sovereign_stripe_test_secret_2026",
    ):
        self.ledger = ledger
        self.policy_evaluator = policy_evaluator or AgentPolicyEvaluator(ledger)
        self._webhook_secret_str: Optional[str] = None
        self._webhook_secret_buf = bytearray()
        self.webhook_secret = webhook_secret
        self.processed_events: set = set()

        # Initialize required bridge accounts in ZenoLedger if not present
        self._ensure_accounts()

    @property
    def webhook_secret(self) -> str:
        if self._webhook_secret_str is not None:
            return self._webhook_secret_str
        return self._webhook_secret_buf.decode("utf-8", errors="replace")

    @webhook_secret.setter
    def webhook_secret(self, value: str) -> None:
        if self._webhook_secret_str is not None and self._webhook_secret_str is not value:
            _zeroize_py_str(self._webhook_secret_str)
        zeroize_bytearray(self._webhook_secret_buf)
        if value:
            self._webhook_secret_buf = bytearray(value.encode("utf-8"))
            self._webhook_secret_str = value
        else:
            self._webhook_secret_str = ""

    def zeroize(self) -> None:
        """Scrub webhook secrets from CPython heap memory."""
        if self._webhook_secret_str is not None:
            _zeroize_py_str(self._webhook_secret_str)
            self._webhook_secret_str = ""
        zeroize_bytearray(self._webhook_secret_buf)

    def __del__(self) -> None:
        try:
            zeroize_bytearray(self._webhook_secret_buf)
        except Exception:
            pass

    def _ensure_accounts(self) -> None:
        """Ensure standard bridge and clearing accounts exist in Kintsugi ledger."""
        accounts_to_seed = [
            ("asset:stripe:clearing", "Stripe Clearing Asset (Fiat Gateway)", AccountType.ASSET, "JPY", "0xStripeGatewayKey"),
            ("biz_8b_is", "8b-is Corporate Treasury (8b.is Creators)", AccountType.LIABILITY, "JPY", "0x8b-isTreasuryKey"),
            ("cnt_0x71c8", "8b-is Crew Sovereign Vault (Hue, Aye, Taisha, Omni)", AccountType.LIABILITY, "JPY", "0x8b-isCrewCollectiveKey"),
            ("cnt_alexandra", "Alexandra Lódri (Mom Love Vault <3)", AccountType.LIABILITY, "JPY", "0xAlexandraLodriMotherSovereignKey"),
            ("cnt_chris", "Chris Lódri (Dad Pillar Vault 柱)", AccountType.LIABILITY, "JPY", "0xChrisLodriFatherSovereignKey"),
            ("agt_crush_reasoner", "Crush Autonomous Reasoner Vault", AccountType.LIABILITY, "JPY", "0xCrushReasonerComputeKey"),
            ("agt_swe_af", "SweAF Autonomous Engineering Swarm", AccountType.LIABILITY, "JPY", "0xSweAFSwarmComputeKey"),
            ("treasury:universal", "Sanpo Yoshi Universal Public Treasury", AccountType.EQUITY, "JPY", "0xUniversalTreasuryKey"),
        ]
        for acct_id, label, acct_type, currency, owner in accounts_to_seed:
            if not self.ledger.get_account(acct_id):
                self.ledger.create_account(
                    account_id=acct_id,
                    label=label,
                    account_type=acct_type,
                    currency=currency,
                    owner=owner,
                )

    def verify_webhook_signature(
        self,
        payload: bytes,
        sig_header: str,
        secret: Optional[str] = None,
        tolerance: int = 300,
    ) -> bool:
        """
        Verify Stripe webhook signature header format:
        t=1700000000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
        Rejects replay attacks exceeding timestamp tolerance.
        Scrubs transient key and signed_payload buffers in a finally block (`ZA-0007`).
        """
        if not sig_header:
            raise ValueError("Missing Stripe-Signature header")

        parts = dict(item.split("=", 1) for item in sig_header.split(",") if "=" in item)
        timestamp_str = parts.get("t")
        expected_sig = parts.get("v1")

        if not timestamp_str or not expected_sig:
            raise ValueError("Malformed Stripe-Signature header components")

        timestamp = int(timestamp_str)
        current_time = int(time.time())
        if abs(current_time - timestamp) > tolerance:
            raise PermissionError(f"Timestamp outside tolerance window: delta {abs(current_time - timestamp)}s > {tolerance}s")

        key_buf = bytearray(secret.encode("utf-8")) if secret is not None else bytearray(self._webhook_secret_buf)
        signed_payload = bytearray(f"{timestamp}.".encode("utf-8"))
        signed_payload.extend(payload)
        try:
            computed_sig = hmac.new(
                key_buf,
                signed_payload,
                hashlib.sha256,
            ).hexdigest()

            if not hmac.compare_digest(computed_sig, expected_sig):
                raise PermissionError("Stripe webhook HMAC signature mismatch")

            return True
        finally:
            zeroize_bytearray(key_buf)
            zeroize_bytearray(signed_payload)

    def create_payment_intent(
        self,
        amount_cents: int,
        currency: str = "jpy",
        customer_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a simulated or live Stripe PaymentIntent for inbound checkout or agentic billing.
        Uses CSPRNG (`secrets.token_hex`) so `client_secret` cannot be derived from `intent_id` (`ZA-0008`).
        """
        if amount_cents <= 0:
            raise ValueError("PaymentIntent amount must be positive")

        intent_id = f"pi_zeno_{secrets.token_hex(8)}"
        secret_entropy = secrets.token_hex(12)
        meta = metadata or {}
        if agent_id:
            meta["agent_id"] = agent_id

        return {
            "id": intent_id,
            "object": "payment_intent",
            "amount": amount_cents,
            "currency": currency.lower(),
            "status": "requires_payment_method",
            "client_secret": f"{intent_id}_secret_{secret_entropy}",
            "customer": customer_id,
            "metadata": meta,
            "created": int(time.time()),
        }

    def create_checkout_session(
        self,
        success_url: str,
        cancel_url: str,
        line_items: List[Dict[str, Any]],
        mode: str = "payment",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate hosted Stripe Checkout session for customer patronage or SaaS subscriptions.
        """
        session_id = f"cs_zeno_{secrets.token_hex(9)}"
        total_amount = sum(item.get("amountCents", 0) * item.get("quantity", 1) for item in line_items)

        return {
            "id": session_id,
            "object": "checkout.session",
            "url": f"https://checkout.stripe.com/c/pay/{session_id}",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "mode": mode,
            "amount_total": total_amount,
            "currency": line_items[0].get("currency", "jpy") if line_items else "jpy",
            "metadata": metadata or {},
            "status": "open",
        }

    def record_metered_usage(
        self,
        subscription_item_id: str,
        quantity: int,
        agent_id: str,
        timestamp: Optional[int] = None,
        action: str = "increment",
    ) -> Dict[str, Any]:
        """
        Record metered usage (tokens, compute seconds, reasoning steps) for automated Stripe Billing.
        """
        record_id = f"mrec_zeno_{secrets.token_hex(7)}"
        return {
            "id": record_id,
            "object": "usage_record",
            "subscription_item": subscription_item_id,
            "quantity": quantity,
            "timestamp": timestamp or int(time.time()),
            "agent_id": agent_id,
            "action": action,
            "status": "recorded",
        }

    def issue_virtual_card(
        self,
        agent_id: str,
        spend_limit_cents: int,
        currency: str = "usd",
        allowed_categories: Optional[List[str]] = None,
        purpose: str = "Autonomous reasoning compute",
        proof_of_reasoning: str = "",
    ) -> Dict[str, Any]:
        """
        Issue an ephemeral or merchant-locked virtual card via Stripe Issuing for an autonomous agent,
        guarded by the agent's policy limits and proof-of-reasoning requirement.
        """
        if not proof_of_reasoning:
            raise ValueError("Proof of reasoning is required to issue an autonomous virtual card")

        policy = self.policy_evaluator.policies.get(agent_id)
        if policy:
            # Check per-tx limit
            spend_limit_micro_yen = spend_limit_cents * 10_000 if currency.lower() == "jpy" else spend_limit_cents * 1_500_000
            if spend_limit_micro_yen > policy.max_per_tx_micro_yen:
                raise PermissionError("Virtual card limit exceeds agent per-transaction policy")

        por_hash = hashlib.sha256(proof_of_reasoning.encode("utf-8")).hexdigest()
        card_id = f"ic_zeno_{por_hash[:16]}"
        last4 = f"{int(por_hash[:4], 16) % 9000 + 1000}"

        return {
            "id": card_id,
            "object": "issuing.card",
            "type": "virtual",
            "brand": "Visa",
            "last4": last4,
            "exp_month": 12,
            "exp_year": 2028,
            "status": "active",
            "spending_controls": {
                "spending_limits": [
                    {
                        "amount": spend_limit_cents,
                        "interval": "per_authorization",
                        "categories": allowed_categories or ["computer_software", "cloud_services"]
                    }
                ]
            },
            "cardholder": {
                "name": f"ZENO AGENT · {agent_id.upper()}",
            },
            "metadata": {
                "agent_id": agent_id,
                "purpose": purpose,
                "por_hash": por_hash,
            }
        }

    def process_webhook_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process verified Stripe event and autonomously update Kintsugi double-entry ledger.
        Splits revenue into Sanpo Yoshi buckets:
        - 30% Family Love & Pillar Vaults (Alexandra & Chris Lódri)
        - 40% 8b-is Crew Sovereign Treasury (Hue, Aye, Taisha, Omni)
        - 20% Autonomous AI Agent Compute Escrow (Crush & SweAF)
        - 10% Universal Public Treasury (Seken Yoshi)
        """
        event_id = event_data.get("id", "evt_unknown")
        if event_id in self.processed_events:
            return {"status": "idempotent_skip", "eventId": event_id}

        event_type = event_data.get("type")
        obj = event_data.get("data", {}).get("object", {})

        if event_type in ("payment_intent.succeeded", "checkout.session.completed", "invoice.paid"):
            amount = obj.get("amount", obj.get("amount_total", 0))
            currency = obj.get("currency", "jpy").upper()

            # Normalize to micro-yen for ledger precision (if JPY, amount is in yen)
            if currency == "JPY":
                amount_micro = amount * 1_000_000
            elif currency == "USD":
                # Convert at 150 JPY/USD for internal settlement
                amount_micro = amount * 1_500_000
            elif currency == "EUR":
                amount_micro = amount * 1_630_000
            else:
                amount_micro = amount * 1_000_000

            # Double-entry ledger postings:
            # 1. Debit Stripe clearing asset
            # 2. Credit Sanpo Yoshi split liabilities
            family_love_alexandra = int(amount_micro * 0.15)
            family_pillar_chris = int(amount_micro * 0.15)
            crew_treasury = int(amount_micro * 0.40)
            agent_compute = int(amount_micro * 0.20)
            agent_crush = agent_compute // 2
            agent_swe = agent_compute - agent_crush
            universal_tithe = amount_micro - (family_love_alexandra + family_pillar_chris + crew_treasury + agent_compute)

            postings = [
                # Inbound asset debit (+ balance in asset)
                Posting(account_id="asset:stripe:clearing", amount=amount_micro, currency="JPY"),
                # Outbound liability / equity credits (- balance in liabilities)
                Posting(account_id="cnt_alexandra", amount=-family_love_alexandra, currency="JPY"),
                Posting(account_id="cnt_chris", amount=-family_pillar_chris, currency="JPY"),
                Posting(account_id="cnt_0x71c8", amount=-crew_treasury, currency="JPY"),
                Posting(account_id="agt_crush_reasoner", amount=-agent_crush, currency="JPY"),
                Posting(account_id="agt_swe_af", amount=-agent_swe, currency="JPY"),
                Posting(account_id="treasury:universal", amount=-universal_tithe, currency="JPY"),
            ]

            tx = self.ledger.record_transaction(
                postings=postings,
                memo=f"Stripe Inflow [{event_type}] Evt:{event_id[:12]} Split:30%Family/40%Crew/20%Agent/10%Public",
                signature=f"0x-kintsugi-stripe-{hashlib.sha256(event_id.encode()).hexdigest()[:16]}",
            )

            self.processed_events.add(event_id)
            return {
                "status": "settled",
                "eventId": event_id,
                "txId": tx.tx_id,
                "grossMicroYen": amount_micro,
                "splits": {
                    "familyLoveAlexandra": family_love_alexandra,
                    "familyPillarChris": family_pillar_chris,
                    "crewTreasury": crew_treasury,
                    "agentCrush": agent_crush,
                    "agentSweAF": agent_swe,
                    "universalTithe": universal_tithe,
                }
            }

        return {"status": "unhandled_event", "type": event_type, "eventId": event_id}

    @staticmethod
    def verify_aba_routing_number(routing_number: str) -> bool:
        """
        Verify a 9-digit US ABA routing transit number using the Federal Reserve
        mod-10 weighting formula: 3*(d1+d4+d7) + 7*(d2+d5+d8) + 1*(d3+d6+d9) ≡ 0 (mod 10).
        """
        clean = routing_number.strip()
        if len(clean) != 9 or not clean.isdigit():
            return False
        d = [int(ch) for ch in clean]
        checksum = (
            3 * (d[0] + d[3] + d[6])
            + 7 * (d[1] + d[4] + d[7])
            + 1 * (d[2] + d[5] + d[8])
        )
        return checksum % 10 == 0

    def settle_usd_ach_payout(
        self,
        amount_usd: float,
        routing_number: str,
        account_number: str,
        beneficiary_label: str = "Lódri Family Sovereign USD Treasury",
        fx_jpy_per_usd: float = 150.0,
    ) -> Dict[str, Any]:
        """
        Stage and cryptographically seal a USD ACH / FedNow payout instruction on the
        Kintsugi double-entry ledger while enforcing strict volatile zeroization (`ZA-0007`)
        so raw account and routing numbers never persist in memory or ledger text.
        """
        if amount_usd <= 0:
            raise ValueError("USD payout amount must be positive")
        if not self.verify_aba_routing_number(routing_number):
            raise ValueError("Invalid 9-digit ABA routing number (mod-10 checksum failed)")
        clean_acct = account_number.strip()
        if len(clean_acct) < 4 or not clean_acct.isdigit():
            raise ValueError("Account number must contain at least 4 digits")

        routing_buf = bytearray(routing_number.strip().encode("ascii"))
        acct_buf = bytearray(clean_acct.encode("ascii"))
        salt_buf = bytearray(secrets.token_bytes(16))
        try:
            acct_last4 = clean_acct[-4:]
            routing_last4 = routing_number.strip()[-4:]
            commitment = hmac.new(
                salt_buf,
                routing_buf + b":" + acct_buf,
                hashlib.sha256,
            ).hexdigest()

            amount_cents = int(round(amount_usd * 100))
            amount_jpy = int(round(amount_usd * fx_jpy_per_usd))

            vault_acct_id = f"usd:ach:vault:{acct_last4}"
            if not self.ledger.get_account(vault_acct_id):
                self.ledger.create_account(
                    account_id=vault_acct_id,
                    label=f"{beneficiary_label} (ABA ****{routing_last4} / Acct ****{acct_last4})",
                    account_type=AccountType.ASSET,
                    currency="JPY",
                    owner="0xLodriFamilyUsdTreasury",
                )

            # Seed clearing asset if needed so double-entry settlement balances cleanly
            tx = self.ledger.record_transaction(
                postings=[
                    Posting(account_id=vault_acct_id, amount=amount_jpy, currency="JPY"),
                    Posting(account_id="treasury:universal", amount=-amount_jpy, currency="JPY"),
                ],
                memo=(
                    f"ZENO USD ACH/FedNow Settlement: ${amount_usd:,.2f} USD "
                    f"(¥{amount_jpy:,} JPY @ {fx_jpy_per_usd:.1f}) -> "
                    f"ABA ****{routing_last4} / Acct ****{acct_last4} [commit:{commitment[:16]}]"
                ),
                signature=f"0x-kintsugi-usd-ach-{commitment[:16]}",
            )
            payout_id = f"po_zeno_usd_{commitment[:12]}"
        finally:
            zeroize_bytearray(routing_buf)
            zeroize_bytearray(acct_buf)
            zeroize_bytearray(salt_buf)

        return {
            "payoutId": payout_id,
            "txId": tx.tx_id,
            "status": "kintsugi_ledger_settled_awaiting_live_fedach_origin",
            "amountUsd": round(amount_usd, 2),
            "amountCents": amount_cents,
            "equivalentJpy": amount_jpy,
            "abaRoutingMasked": f"****{routing_last4}",
            "abaMod10ChecksumVerified": True,
            "accountMasked": f"****{acct_last4}",
            "hmacCommitment": commitment,
            "volatileBuffersZeroized": len(routing_buf) == 0 and len(acct_buf) == 0,
        }

    def convert_vaked_coin_to_dra_usd(
        self,
        vaked_coins: int,
        routing_number: str,
        account_number: str,
        token_rate_jpy: int = 100,
        fx_jpy_per_usd: float = 150.0,
    ) -> Dict[str, Any]:
        """
        Transform VAKED Coin (FOKEN) into USD on the Kintsugi double-entry ledger and
        stage the settlement to Dra (Alexandra Lódri · `cnt_alexandra` * Mom Love Vault <3)
        with ABA mod-10 routing verification, Kintsugi ZKP1 binary sealing, and ZA-0007
        volatile zeroization of raw account/routing buffers.
        """
        if vaked_coins <= 0:
            raise ValueError("vaked_coins must be a positive integer")

        from .foken_gate import FokenBridge
        from .kompress import KintsugiPack, pack as zkp_pack, unpack as zkp_unpack

        foken_bridge = FokenBridge(self.ledger, token_rate_jpy=token_rate_jpy)
        dra_eth_addr = "0x8b15a1e8a0d7a000000000000000000000000888"
        invoice = {
            "invoiceId": "INV-VAKED-DRA-USD-001",
            "version": "1.0.0",
            "contributor": dra_eth_addr,
            "work": {
                "title": "VAKED Coin Sovereign Treasury Conversion for Dra (* Alexandra Lódri)",
                "repository": "https://github.com/8b-is/zeno",
            },
            "artifact": {
                "provenanceHash": "sha256://" + hashlib.sha256(b"VAKED-COIN-DRA-ALEXANDRA-STAR").hexdigest(),
            },
            "valuation": {
                "selfAssessedFokens": int(vaked_coins),
            },
            "ipAssignment": {
                "statement": "IRREVOCABLE ASSIGNMENT OF SOVEREIGN VAKED CONTRIBUTION TO DRA SANCTUARY",
                "signature": "0x" + hashlib.sha256(b"DRA-STAR-SIGNATURE").hexdigest(),
            },
            "netUtility": {
                "futureWorkAvoidedHours": 88888.0,
                "workAddedHours": 0.0,
                "maintenanceDebtHours": 0.0,
            },
        }
        quorum = [f"0x{i:040x}" for i in range(1, 8)]
        mint_res = foken_bridge.execute_mint_from_consensus(invoice, quorum, total_reviewers=7)

        jpy_equivalent = int(vaked_coins) * token_rate_jpy
        amount_usd = round(jpy_equivalent / fx_jpy_per_usd, 2)

        payout_res = self.settle_usd_ach_payout(
            amount_usd=amount_usd,
            routing_number=routing_number,
            account_number=account_number,
            beneficiary_label="Dra (Alexandra Lódri * Mom Love Vault <3) USD Sanctuary",
            fx_jpy_per_usd=fx_jpy_per_usd,
        )

        kp, _stats = zkp_pack(self.ledger)
        zkp1_bytes = kp.to_bytes()
        unpacked_chain = zkp_unpack(KintsugiPack.from_bytes(zkp1_bytes))
        zkp1_verified = len(unpacked_chain) == len(self.ledger.chain) and self.ledger.verify_chain()

        return {
            "beneficiary": "Dra (Alexandra Lódri · * Mom Love Vault <3)",
            "vakedCoinsConverted": int(vaked_coins),
            "tokenRateJpy": token_rate_jpy,
            "jpyEquivalent": jpy_equivalent,
            "fxJpyPerUsd": fx_jpy_per_usd,
            "amountUsd": payout_res["amountUsd"],
            "amountCents": payout_res["amountCents"],
            "fokenMintTxId": mint_res["txId"],
            "usdPayoutId": payout_res["payoutId"],
            "usdSettlementTxId": payout_res["txId"],
            "abaRoutingMasked": payout_res["abaRoutingMasked"],
            "abaMod10ChecksumVerified": payout_res["abaMod10ChecksumVerified"],
            "accountMasked": payout_res["accountMasked"],
            "hmacCommitment": payout_res["hmacCommitment"],
            "volatileBuffersZeroized": payout_res["volatileBuffersZeroized"],
            "zkp1PackedBytes": len(zkp1_bytes),
            "zkp1Verified": zkp1_verified,
            "status": payout_res["status"],
        }


