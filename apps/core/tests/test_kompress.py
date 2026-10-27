import unittest

from zeno_core.kompress import (
    DEFAULT_WINDOW,
    GATE_0X62,
    GENESIS_HASH,
    HistoryRewriteError,
    KintsugiPack,
    PackError,
    PackIntegrityError,
    kompress_super_ultra,
    pack,
    seal_frame_32b,
    unpack,
    verify_frame_32b,
)
from zeno_core.ledger import AccountType, Posting, ZenoLedger


def _ledger_with(n_transfers: int) -> ZenoLedger:
    ledger = ZenoLedger()
    ledger.create_account("usr_romeo", "Romeo", AccountType.LIABILITY, owner="0xRomeo")
    ledger.create_account("usr_juliet", "Juliet", AccountType.LIABILITY, owner="0xJuliet")
    ledger.record_transaction(
        [
            Posting("asset:fiat:boj_escrow", 1_000_000_000, "JPY"),
            Posting("usr_romeo", -1_000_000_000, "JPY"),
        ],
        "Initial Deposit",
    )
    _transfer(ledger, n_transfers)
    return ledger


def _transfer(ledger: ZenoLedger, n: int) -> None:
    for i in range(n):
        ledger.record_transaction(
            [Posting("usr_romeo", 1_000, "JPY"), Posting("usr_juliet", -1_000, "JPY")],
            f"love letter #{i}",
        )


class TestKintsugiPack(unittest.TestCase):
    def test_round_trip_preserves_the_chain(self):
        ledger = _ledger_with(40)  # 41 blocks
        p, stats = pack(ledger, window_size=8)
        self.assertEqual(p.block_count, 41)
        self.assertEqual([w.count for w in p.windows], [8, 8, 8, 8, 8, 1])
        self.assertEqual(stats.windows_repacked, 6)
        self.assertEqual(p.head_seal, ledger.chain[-1].seal)
        self.assertEqual(unpack(p), [b.to_dict() for b in ledger.chain])

    def test_compresses_repetitive_ledgers(self):
        p, stats = pack(_ledger_with(63))
        self.assertLess(stats.packed_bytes_total, stats.raw_bytes_packed)

    def test_serialised_bytes_round_trip(self):
        ledger = _ledger_with(20)
        p, _ = pack(ledger, window_size=4)
        blob = p.to_bytes()
        q = KintsugiPack.from_bytes(blob)
        self.assertEqual(q, p)
        self.assertEqual(unpack(q), [b.to_dict() for b in ledger.chain])

    def test_incremental_repacks_only_the_tail(self):
        ledger = _ledger_with(20)  # 21 blocks → windows 8, 8, 5
        first, _ = pack(ledger, window_size=8)
        _transfer(ledger, 10)  # 31 blocks → windows 8, 8, 8, 7
        second, stats = pack(ledger, previous=first)
        self.assertEqual(stats.windows_total, 4)
        self.assertEqual(stats.windows_repacked, 2)  # the old tail + one new window
        self.assertAlmostEqual(stats.reuse_ratio, 0.5)
        # Full windows are the same objects, not re-packed copies.
        self.assertIs(second.windows[0], first.windows[0])
        self.assertIs(second.windows[1], first.windows[1])
        self.assertEqual(unpack(second), [b.to_dict() for b in ledger.chain])

    def test_unchanged_chain_reuses_every_full_window(self):
        ledger = _ledger_with(15)  # 16 blocks = 2 full windows of 8
        first, _ = pack(ledger, window_size=8)
        _, stats = pack(ledger, previous=first)
        self.assertEqual(stats.windows_repacked, 0)
        self.assertEqual(stats.reuse_ratio, 1.0)

    def test_history_rewrite_is_refused(self):
        ledger = _ledger_with(10)
        first, _ = pack(ledger, window_size=4)
        # Re-seal a different chain of the same height: same shape, other history.
        other = _ledger_with(10)
        with self.assertRaises(HistoryRewriteError):
            pack(other, previous=first)
        # A shorter chain is a rewrite too.
        with self.assertRaises(HistoryRewriteError):
            pack([b.to_dict() for b in ledger.chain[:5]], previous=first)

    def test_tampered_input_chain_is_not_packed(self):
        blocks = [b.to_dict() for b in _ledger_with(5).chain]
        blocks[2]["transactions"][0]["postings"][0]["amount"] = 999_999
        with self.assertRaises(PackIntegrityError):
            pack(blocks)

    def test_corrupted_pack_is_detected(self):
        p, _ = pack(_ledger_with(12), window_size=4)
        blob = bytearray(p.to_bytes())
        blob[-3] ^= 0xFF
        with self.assertRaises(PackIntegrityError):
            unpack(KintsugiPack.from_bytes(bytes(blob)))
        with self.assertRaises(PackIntegrityError):
            KintsugiPack.from_bytes(bytes(blob) + b"x")
        with self.assertRaises(PackIntegrityError):
            KintsugiPack.from_bytes(b"nope")

    def test_empty_chain_and_bad_window_size(self):
        p, stats = pack([])
        self.assertEqual((p.block_count, p.head_seal, p.windows), (0, GENESIS_HASH, ()))
        self.assertEqual(p.window_size, DEFAULT_WINDOW)
        self.assertEqual(stats.reuse_ratio, 1.0)
        self.assertEqual(unpack(p), [])
        with self.assertRaises(PackError):
            pack([], window_size=0)
        first, _ = pack(_ledger_with(3), window_size=4)
        with self.assertRaises(PackError):
            pack(_ledger_with(3), previous=first, window_size=8)

    def test_wupz_32b_frame_sealing_at_0x62_gate(self):
        raw = bytes((i * 73 + 19) & 0xFF for i in range(3761))
        packed = bytes((i * 41 + 7) & 0xFF for i in range(3314))
        frame = seal_frame_32b(raw, packed, gate=GATE_0X62)
        self.assertEqual(len(frame), 32)
        self.assertEqual(frame[24], 0x62)
        self.assertEqual(frame[25], 0x01)
        self.assertTrue(verify_frame_32b(frame, raw, packed, gate=GATE_0X62))

        # Amplitude spike / lane-trip bit flip is caught immediately
        spiked = bytearray(frame)
        spiked[31] ^= 0x01
        self.assertFalse(verify_frame_32b(bytes(spiked), raw, packed, gate=GATE_0X62))

        # kompress_super_ultra end-to-end envelope
        env = kompress_super_ultra(raw, gate=GATE_0X62)
        self.assertEqual(env["gate"], "0x62")
        self.assertTrue(env["verified"])
        self.assertEqual(env["signalState"], 1)
        self.assertEqual(len(env["frameSeal32b"]), 64)

        # Tampered window frameSeal32b in KintsugiPack triggers 0x62 gate trip
        p, _ = pack(_ledger_with(6), window_size=4)
        self.assertEqual(len(p.windows[0].frame_seal_32b), 64)
        bad_seal = p.windows[0].frame_seal_32b[:-2] + (
            "00" if p.windows[0].frame_seal_32b[-2:] != "00" else "ff"
        )
        tampered_win = type(p.windows[0])(
            index=p.windows[0].index,
            first_block=p.windows[0].first_block,
            count=p.windows[0].count,
            raw_sha256=p.windows[0].raw_sha256,
            raw_len=p.windows[0].raw_len,
            data=p.windows[0].data,
            frame_seal_32b=bad_seal,
        )
        tampered_pack = KintsugiPack(
            window_size=p.window_size,
            block_count=p.block_count,
            head_seal=p.head_seal,
            windows=(tampered_win,) + p.windows[1:],
        )
        with self.assertRaises(PackIntegrityError):
            unpack(tampered_pack)


if __name__ == "__main__":
    unittest.main()
