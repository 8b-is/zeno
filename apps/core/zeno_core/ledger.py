"""
Zeno Double-Entry Kintsugi Ledger Engine
"""

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, List, Optional


class AccountType(str, Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


@dataclass
class Account:
    account_id: str
    label: str
    account_type: AccountType
    currency: str = "JPY"
    balance: int = 0  # In micro-units (1 JPY = 1,000,000 uJPY)
    owner: str = ""
    created_at: float = field(default_factory=time.time)


@dataclass
class Posting:
    account_id: str
    amount: int  # +Debit, -Credit (must sum to 0)
    currency: str = "JPY"


@dataclass
class Transaction:
    tx_id: str
    timestamp: float
    postings: List[Posting]
    memo: str
    signature: str = ""

    def to_dict(self):
        return {
            "txId": self.tx_id,
            "timestamp": self.timestamp,
            "postings": [asdict(p) for p in self.postings],
            "memo": self.memo,
            "signature": self.signature,
        }


@dataclass
class KintsugiBlock:
    block_index: int
    timestamp: float
    previous_hash: str
    merkle_root: str
    transactions: List[Transaction]
    seal: str

    def to_dict(self):
        return {
            "blockIndex": self.block_index,
            "timestamp": self.timestamp,
            "previousHash": self.previous_hash,
            "merkleRoot": self.merkle_root,
            "transactions": [tx.to_dict() for tx in self.transactions],
            "seal": self.seal,
        }


class ZenoLedger:
    GENESIS_HASH = "0" * 64

    def __init__(self):
        self.accounts: Dict[str, Account] = {}
        self.chain: List[KintsugiBlock] = []
        self._pending_txs: List[Transaction] = []
        self._init_system_accounts()

    def _init_system_accounts(self):
        # Universal Treasury
        self.create_account(
            "treasury:universal",
            "Universal Treasury Equity",
            AccountType.EQUITY,
            currency="JPY",
        )
        self.create_account(
            "treasury:foken_vault",
            "Foken Proof-of-Contribution Vault",
            AccountType.ASSET,
            currency="FOKEN",
        )
        self.create_account(
            "asset:fiat:boj_escrow",
            "Bank of Japan Fiat Legal Escrow",
            AccountType.ASSET,
            currency="JPY",
        )

    def create_account(
        self,
        account_id: str,
        label: str,
        account_type: AccountType,
        currency: str = "JPY",
        owner: str = "",
    ) -> Account:
        if account_id in self.accounts:
            raise ValueError(f"Account {account_id} already exists")
        acct = Account(
            account_id=account_id,
            label=label,
            account_type=account_type,
            currency=currency,
            owner=owner,
        )
        self.accounts[account_id] = acct
        return acct

    def get_account(self, account_id: str) -> Optional[Account]:
        return self.accounts.get(account_id)

    def get_balance(self, account_id: str) -> int:
        acct = self.accounts.get(account_id)
        if not acct:
            raise KeyError(f"Account {account_id} not found")
        return acct.balance

    def record_transaction(
        self,
        postings: List[Posting],
        memo: str,
        signature: str = "0x-kintsugi-witness-ok",
    ) -> Transaction:
        if len(postings) < 2:
            raise ValueError("Transaction must contain at least 2 postings")

        # Double-entry invariant check
        total = sum(p.amount for p in postings)
        if total != 0:
            raise ValueError(
                f"Double-entry violation: debits and credits do not balance (sum={total})"
            )

        # Verify all accounts exist
        for p in postings:
            if p.account_id not in self.accounts:
                raise KeyError(f"Account {p.account_id} does not exist")

        # Insolvency check for liabilities/assets
        # Positive amount = debit, Negative = credit
        for p in postings:
            acct = self.accounts[p.account_id]
            # If liability account, normal balance is credit (-). Available funds = -balance.
            # Debit (+) reduces liability (spend). Balance cannot become positive.
            if acct.account_type == AccountType.LIABILITY and p.amount > 0:
                if -acct.balance < p.amount:
                    raise ValueError(
                        f"Insufficient funds in liability account {p.account_id} "
                        f"(balance: {-acct.balance}, required: {p.amount})"
                    )

        # Apply balance changes
        for p in postings:
            acct = self.accounts[p.account_id]
            acct.balance += p.amount

        tx = Transaction(
            tx_id=f"tx_{uuid.uuid4().hex[:16]}",
            timestamp=time.time(),
            postings=postings,
            memo=memo,
            signature=signature,
        )

        self._pending_txs.append(tx)
        self.seal_block()
        return tx

    def compute_merkle_root(self, txs: List[Transaction]) -> str:
        if not txs:
            return self.GENESIS_HASH
        hashes = [
            hashlib.sha256(json.dumps(tx.to_dict(), sort_keys=True).encode("utf-8")).hexdigest()
            for tx in txs
        ]
        combined = "".join(hashes).encode("utf-8")
        return hashlib.sha256(combined).hexdigest()

    def seal_block(self) -> KintsugiBlock:
        if not self._pending_txs:
            raise ValueError("No pending transactions to seal")

        prev_hash = self.chain[-1].seal if self.chain else self.GENESIS_HASH
        idx = len(self.chain) + 1
        ts = time.time()
        m_root = self.compute_merkle_root(self._pending_txs)

        seal_payload = f"{prev_hash}|{idx}|{ts}|{m_root}".encode("utf-8")
        seal = hashlib.sha256(seal_payload).hexdigest()

        block = KintsugiBlock(
            block_index=idx,
            timestamp=ts,
            previous_hash=prev_hash,
            merkle_root=m_root,
            transactions=list(self._pending_txs),
            seal=seal,
        )
        self.chain.append(block)
        self._pending_txs.clear()
        return block

    def verify_chain(self) -> bool:
        if not self.chain:
            return True
        for i, block in enumerate(self.chain):
            expected_prev = self.chain[i - 1].seal if i > 0 else self.GENESIS_HASH
            if block.previous_hash != expected_prev:
                return False
            # Verify seal
            seal_payload = f"{block.previous_hash}|{block.block_index}|{block.timestamp}|{block.merkle_root}".encode(
                "utf-8"
            )
            expected_seal = hashlib.sha256(seal_payload).hexdigest()
            if block.seal != expected_seal:
                return False
        return True
