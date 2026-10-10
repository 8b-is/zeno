"""
Zeno Continuous Micro-Streaming Protocol Engine (水流決済)
"""

import time
import uuid
from dataclasses import dataclass
from typing import Dict, List, Optional
from .ledger import ZenoLedger, Posting, AccountType


@dataclass
class MicroStream:
    stream_id: str
    from_account: str
    to_account: str
    rate_micro_yen_per_sec: int  # uJPY per second (1 JPY = 1,000,000 uJPY)
    start_time: float
    stop_time: Optional[float]
    settled_amount: int = 0
    last_checkpoint_time: float = 0.0
    status: str = "active"  # "active", "paused", "completed", "cancelled"

    def accrued_at(self, current_time: float) -> int:
        if current_time <= self.start_time:
            return 0
        effective_end = current_time
        if self.stop_time and effective_end > self.stop_time:
            effective_end = self.stop_time
        duration = effective_end - self.start_time
        return int(self.rate_micro_yen_per_sec * duration)

    def uncheckpointed_amount(self, current_time: float) -> int:
        total = self.accrued_at(current_time)
        return total - self.settled_amount


class StreamEngine:
    def __init__(self, ledger: ZenoLedger):
        self.ledger = ledger
        self.streams: Dict[str, MicroStream] = {}

    def create_stream(
        self,
        from_account: str,
        to_account: str,
        rate_micro_yen_per_sec: int,
        duration_seconds: Optional[int] = None,
    ) -> MicroStream:
        if rate_micro_yen_per_sec <= 0:
            raise ValueError("Streaming rate must be positive")

        from_acct = self.ledger.get_account(from_account)
        to_acct = self.ledger.get_account(to_account)
        if not from_acct or not to_acct:
            raise KeyError("Both source and destination accounts must exist")

        now = time.time()
        stop_time = now + duration_seconds if duration_seconds else None

        stream_id = f"stm_{uuid.uuid4().hex[:12]}"
        stream = MicroStream(
            stream_id=stream_id,
            from_account=from_account,
            to_account=to_account,
            rate_micro_yen_per_sec=rate_micro_yen_per_sec,
            start_time=now,
            stop_time=stop_time,
            last_checkpoint_time=now,
            status="active",
        )
        self.streams[stream_id] = stream
        return stream

    def checkpoint_stream(self, stream_id: str, at_time: Optional[float] = None) -> int:
        stream = self.streams.get(stream_id)
        if not stream:
            raise KeyError(f"Stream {stream_id} not found")

        now = at_time or time.time()
        delta = stream.uncheckpointed_amount(now)
        if delta <= 0:
            return 0

        # Post to double-entry ledger: Debit sender liability, Credit receiver liability
        postings = [
            Posting(account_id=stream.from_account, amount=delta, currency="JPY"),
            Posting(account_id=stream.to_account, amount=-delta, currency="JPY"),
        ]
        self.ledger.record_transaction(
            postings=postings,
            memo=f"Stream Checkpoint #{stream.stream_id} (+{delta} uJPY)",
            signature="0x-kintsugi-stream-seal",
        )

        stream.settled_amount += delta
        stream.last_checkpoint_time = now

        if stream.stop_time and now >= stream.stop_time:
            stream.status = "completed"

        return delta

    def get_realtime_balance(self, account_id: str, at_time: Optional[float] = None) -> int:
        now = at_time or time.time()
        base_balance = self.ledger.get_balance(account_id)
        acct = self.ledger.get_account(account_id)
        if not acct:
            raise KeyError(f"Account {account_id} not found")

        # For liability accounts: negative balance is available funds (Credit)
        available = -base_balance if acct.account_type == AccountType.LIABILITY else base_balance

        # Adjust for uncheckpointed active streams
        for stream in self.streams.values():
            if stream.status == "active":
                unsettled = stream.uncheckpointed_amount(now)
                if stream.from_account == account_id:
                    available -= unsettled
                elif stream.to_account == account_id:
                    available += unsettled

        return available
