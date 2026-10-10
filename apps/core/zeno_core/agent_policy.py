"""
Zeno Autonomous Agent Banking Policy Evaluator (自律口座規約)
"""

import hashlib
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from .ledger import ZenoLedger, Posting, AccountType


@dataclass
class AgentPolicy:
    agent_id: str
    max_per_tx_micro_yen: int
    daily_spend_limit_micro_yen: int
    allowed_counterparties: List[str]
    require_proof_of_reasoning: bool = True
    spent_today_micro_yen: int = 0
    last_reset_day: int = field(default_factory=lambda: int(time.time() // 86400))


class AgentPolicyEvaluator:
    def __init__(self, ledger: ZenoLedger):
        self.ledger = ledger
        self.policies: Dict[str, AgentPolicy] = {}

    def register_agent(
        self,
        agent_id: str,
        label: str,
        owner: str,
        max_per_tx_jpy: int,
        daily_limit_jpy: int,
        allowed_counterparties: List[str],
        require_proof_of_reasoning: bool = True,
    ) -> AgentPolicy:
        acct_id = f"agt_{agent_id}"
        if not self.ledger.get_account(acct_id):
            self.ledger.create_account(
                account_id=acct_id,
                label=label,
                account_type=AccountType.LIABILITY,
                currency="JPY",
                owner=owner,
            )

        policy = AgentPolicy(
            agent_id=acct_id,
            max_per_tx_micro_yen=max_per_tx_jpy * 1_000_000,
            daily_spend_limit_micro_yen=daily_limit_jpy * 1_000_000,
            allowed_counterparties=allowed_counterparties,
            require_proof_of_reasoning=require_proof_of_reasoning,
        )
        self.policies[acct_id] = policy
        return policy

    def execute_agent_spend(
        self,
        agent_account_id: str,
        to_account: str,
        amount_micro_yen: int,
        reasoning_trace: str,
        category: str = "inference_compute",
    ) -> Dict[str, Any]:
        policy = self.policies.get(agent_account_id)
        if not policy:
            raise KeyError(f"No policy registered for agent account {agent_account_id}")

        # Check daily reset
        current_day = int(time.time() // 86400)
        if current_day > policy.last_reset_day:
            policy.spent_today_micro_yen = 0
            policy.last_reset_day = current_day

        # 1. Per-transaction limit
        if amount_micro_yen > policy.max_per_tx_micro_yen:
            raise PermissionError(
                f"Agent transaction exceeds per-tx limit: {amount_micro_yen} > {policy.max_per_tx_micro_yen}"
            )

        # 2. Daily spend limit
        if policy.spent_today_micro_yen + amount_micro_yen > policy.daily_spend_limit_micro_yen:
            raise PermissionError("Agent daily spend limit exceeded")

        # 3. Counterparty whitelist
        if policy.allowed_counterparties and to_account not in policy.allowed_counterparties:
            raise PermissionError(f"Counterparty {to_account} is not in agent whitelist")

        # 4. Proof of Reasoning
        if policy.require_proof_of_reasoning and not reasoning_trace:
            raise ValueError("Proof of reasoning is strictly required by agent policy")

        por_hash = hashlib.sha256(reasoning_trace.encode("utf-8")).hexdigest()

        # Execute double-entry transfer
        postings = [
            Posting(account_id=agent_account_id, amount=amount_micro_yen, currency="JPY"),
            Posting(account_id=to_account, amount=-amount_micro_yen, currency="JPY"),
        ]
        tx = self.ledger.record_transaction(
            postings=postings,
            memo=f"Agent Spend [{category}] PoR:{por_hash[:12]}",
            signature=f"0x-agent-sig-{por_hash[:8]}",
        )

        policy.spent_today_micro_yen += amount_micro_yen
        return {
            "txId": tx.tx_id,
            "agentAccountId": agent_account_id,
            "toAccount": to_account,
            "amountMicroYen": amount_micro_yen,
            "porHash": por_hash,
            "remainingDailyLimit": policy.daily_spend_limit_micro_yen - policy.spent_today_micro_yen,
        }
