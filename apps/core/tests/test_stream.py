import time
import unittest
from zeno_core.ledger import ZenoLedger, Posting, AccountType
from zeno_core.stream import StreamEngine


class TestStreamEngine(unittest.TestCase):
    def setUp(self):
        self.ledger = ZenoLedger()
        self.sender = self.ledger.create_account(
            "usr_streamer", "Streamer", AccountType.LIABILITY
        )
        self.receiver = self.ledger.create_account(
            "usr_worker", "Worker", AccountType.LIABILITY
        )

        # Fund streamer with 50,000 JPY (50,000,000,000 uJPY)
        self.ledger.record_transaction(
            [
                Posting("asset:fiat:boj_escrow", 50_000_000_000, "JPY"),
                Posting("usr_streamer", -50_000_000_000, "JPY"),
            ],
            "Funding Streamer",
        )
        self.engine = StreamEngine(self.ledger)

    def test_linear_accrual_and_checkpoint(self):
        # Stream 100 JPY per second (100,000,000 uJPY/sec) for 10 seconds
        rate = 100_000_000
        stream = self.engine.create_stream("usr_streamer", "usr_worker", rate, duration_seconds=10)

        # Simulate 2 seconds passed
        simulated_time = stream.start_time + 2.0
        accrued = stream.accrued_at(simulated_time)
        self.assertEqual(accrued, 200_000_000)

        # Check real-time balance
        worker_balance = self.engine.get_realtime_balance("usr_worker", at_time=simulated_time)
        self.assertEqual(worker_balance, 200_000_000)

        streamer_balance = self.engine.get_realtime_balance("usr_streamer", at_time=simulated_time)
        self.assertEqual(streamer_balance, 50_000_000_000 - 200_000_000)

        # Checkpoint the stream at 2 seconds
        settled = self.engine.checkpoint_stream(stream.stream_id, at_time=simulated_time)
        self.assertEqual(settled, 200_000_000)
        self.assertEqual(stream.settled_amount, 200_000_000)

        # Ledger now permanently holds the checkpointed balances
        self.assertEqual(self.ledger.get_balance("usr_worker"), -200_000_000)


if __name__ == "__main__":
    unittest.main()
