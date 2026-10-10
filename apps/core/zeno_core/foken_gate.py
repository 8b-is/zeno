"""
Zeno ↔ Foken Valuation Gate Bridge (貢献鋳造)
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from .ledger import ZenoLedger, Posting, AccountType


class InvoiceVerdict(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    REVIEW = "REVIEW"


@dataclass
class GateResult:
    invoice_id: str
    verdict: InvoiceVerdict
    reason: str
    net_utility: Optional[float] = None


class FokenBridge:
    ETH_ADDR_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")

    def __init__(self, ledger: ZenoLedger, token_rate_jpy: int = 100):
        self.ledger = ledger
        self.token_rate_jpy = token_rate_jpy  # 1 FOKEN = 100 JPY (in micro-units: 100 * 1,000,000)

    def evaluate_invoice(self, invoice: Dict[str, Any]) -> GateResult:
        inv_id = str(invoice.get("invoiceId", "unknown"))

        # 1. Structure check
        required_top = ["invoiceId", "version", "contributor", "work", "artifact", "valuation", "ipAssignment"]
        for key in required_top:
            if key not in invoice:
                return GateResult(inv_id, InvoiceVerdict.FAIL, f"malformed invoice: missing field '{key}'")

        # 2. Contributor address check
        contributor = invoice.get("contributor", "")
        if not isinstance(contributor, str) or not self.ETH_ADDR_RE.match(contributor):
            return GateResult(inv_id, InvoiceVerdict.FAIL, f"invalid contributor address: {contributor}")

        # 3. Artifact provenance check
        artifact = invoice.get("artifact", {})
        prov_hash = artifact.get("provenanceHash", "")
        if not isinstance(prov_hash, str) or not prov_hash.startswith("sha256://"):
            return GateResult(inv_id, InvoiceVerdict.FAIL, "invalid artifact provenance: must start with 'sha256://'")

        # 4. Valuation check
        valuation = invoice.get("valuation", {})
        tokens = valuation.get("selfAssessedFokens")
        if not isinstance(tokens, int) or isinstance(tokens, bool) or tokens <= 0:
            return GateResult(inv_id, InvoiceVerdict.FAIL, "selfAssessedFokens must be a positive integer")

        # 5. IP Assignment Hard Gate
        ip = invoice.get("ipAssignment", {})
        stmt = ip.get("statement", "")
        sig = ip.get("signature", "")
        if "IRREVOCABLE ASSIGNMENT" not in stmt or not isinstance(sig, str) or not sig.startswith("0x"):
            return GateResult(inv_id, InvoiceVerdict.FAIL, "missing/unsigned IP assignment — no IP, no mint")

        # 6. Net-Utility Formula Evaluation
        nu = invoice.get("netUtility")
        if not isinstance(nu, dict):
            return GateResult(inv_id, InvoiceVerdict.REVIEW, "missing netUtility: manual review required")

        avoided = nu.get("futureWorkAvoidedHours")
        added = nu.get("workAddedHours")
        debt = nu.get("maintenanceDebtHours")

        if any(v is None or not isinstance(v, (int, float)) or v < 0 for v in [avoided, added, debt]):
            return GateResult(inv_id, InvoiceVerdict.REVIEW, "invalid netUtility numeric values")

        net = avoided - (added + 1.5 * debt)
        if net <= 0:
            return GateResult(
                inv_id,
                InvoiceVerdict.FAIL,
                f"net-negative utility ({net}): future work avoided is eclipsed by work added + maintenance debt",
                net_utility=net,
            )

        return GateResult(
            inv_id,
            InvoiceVerdict.PASS,
            f"eligible for human vote (net utility = {net})",
            net_utility=net,
        )

    def execute_mint_from_consensus(
        self,
        invoice: Dict[str, Any],
        reviewer_approvals: List[str],
        total_reviewers: int = 7,
    ) -> Dict[str, Any]:
        result = self.evaluate_invoice(invoice)
        if result.verdict != InvoiceVerdict.PASS:
            raise ValueError(f"Cannot mint: Invoice failed gate with reason: {result.reason}")

        # Validate quorum (>50% distinct valid 0x addresses)
        distinct_reviewers = set(reviewer_approvals)
        for r in distinct_reviewers:
            if not self.ETH_ADDR_RE.match(r):
                raise ValueError(f"Malformed reviewer address in quorum: {r}")

        if len(distinct_reviewers) * 2 <= total_reviewers:
            raise ValueError(
                f"Quorum not reached: {len(distinct_reviewers)}/{total_reviewers} approvals "
                f"(requires > {total_reviewers // 2})"
            )

        contributor = invoice["contributor"]
        fokens = invoice["valuation"]["selfAssessedFokens"]
        jpy_micro_amount = fokens * self.token_rate_jpy * 1_000_000

        # Ensure contributor account exists
        acct_id = f"cnt_{contributor.lower()}"
        if not self.ledger.get_account(acct_id):
            self.ledger.create_account(
                account_id=acct_id,
                label=f"Contributor {contributor[:10]}...",
                account_type=AccountType.LIABILITY,
                currency="JPY",
                owner=contributor,
            )

        # Record double-entry minting:
        # Debit Treasury Asset, Credit Contributor Liability
        postings = [
            Posting(account_id="treasury:universal", amount=jpy_micro_amount, currency="JPY"),
            Posting(account_id=acct_id, amount=-jpy_micro_amount, currency="JPY"),
        ]

        tx = self.ledger.record_transaction(
            postings=postings,
            memo=f"Foken Proof-of-Contribution Mint #{invoice['invoiceId']} ({fokens} FOKEN)",
            signature=f"0x-consensus-quorum-{len(distinct_reviewers)}of{total_reviewers}",
        )

        return {
            "invoiceId": invoice["invoiceId"],
            "contributorAccount": acct_id,
            "fokensMinted": fokens,
            "jpyEquivalent": fokens * self.token_rate_jpy,
            "txId": tx.tx_id,
            "netUtility": result.net_utility,
        }
