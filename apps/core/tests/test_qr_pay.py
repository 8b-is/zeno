"""
Unit tests for ZENO QR Payment Layer (AEON Pay / Alipay-style, Asia First) and 3DS gate.
"""

import unittest

from zeno_core.ledger import ZenoLedger, AccountType
from zeno_core.qr_pay import (
    BANK_ID,
    BANK_LEGAL,
    BANK_MARK,
    QrPayMode,
    QrPayThreeDs,
    QrPayThreeDsStatus,
    build_pay_uri,
    parse_pay_uri,
    validate_pay_uri,
)


class TestQrPayUri(unittest.TestCase):
    def test_build_and_parse_roundtrip_receive(self):
        uri = build_pay_uri("cnt_0x71c8", amount_uJPY=2_500_000, memo="matcha")
        parsed = parse_pay_uri(uri)
        self.assertEqual(parsed.account_id, "cnt_0x71c8")
        self.assertEqual(parsed.mode, QrPayMode.RECEIVE)
        self.assertEqual(parsed.amount_uJPY, 2_500_000)
        self.assertEqual(parsed.memo, "matcha")
        self.assertEqual(parsed.bank, BANK_ID)
        self.assertTrue(parsed.nonce)
        self.assertEqual(parsed.uri, uri)

    def test_build_paycode_open_amount(self):
        uri = build_pay_uri("treasury:universal", mode=QrPayMode.PAYCODE)
        parsed = parse_pay_uri(uri)
        self.assertEqual(parsed.mode, QrPayMode.PAYCODE)
        self.assertIsNone(parsed.amount_uJPY)

    def test_account_id_with_colons_and_dots(self):
        uri = build_pay_uri("asset:fiat:boj_escrow")
        self.assertEqual(parse_pay_uri(uri).account_id, "asset:fiat:boj_escrow")

    def test_validate_rejects_bad_scheme(self):
        with self.assertRaises(ValueError):
            validate_pay_uri("https://pay/cnt_0x71c8?nonce=abc")

    def test_validate_rejects_missing_nonce(self):
        uri = build_pay_uri("cnt_0x71c8", nonce="abcdef123456")
        stripped = uri.replace(f"nonce=abcdef123456", "")
        with self.assertRaises(ValueError):
            validate_pay_uri(stripped)

    def test_validate_rejects_nonpositive_amount(self):
        with self.assertRaises(ValueError):
            build_pay_uri("cnt_0x71c8", amount_uJPY=0)

    def test_validate_rejects_invalid_account(self):
        with self.assertRaises(ValueError):
            build_pay_uri("cnt!bad")

    def test_to_dict_includes_bank_branding(self):
        uri = build_pay_uri("cnt_0x71c8", amount_uJPY=1_000_000)
        d = parse_pay_uri(uri).to_dict()
        self.assertEqual(d["bank"], "ZENO")
        self.assertEqual(d["bankLegal"], BANK_LEGAL)
        self.assertEqual(d["bankMark"], BANK_MARK)
        self.assertEqual(d["amountJPY"], 1.0)


class TestQrPayThreeDs(unittest.TestCase):
    def test_high_amount_requires_challenge(self):
        gate = QrPayThreeDs()
        uri = build_pay_uri("cnt_0x71c8", amount_uJPY=2_000_000)
        session = gate.begin(uri)
        self.assertEqual(session.status, QrPayThreeDsStatus.CHALLENGE_REQUIRED)
        self.assertEqual(session.risk, "high")

    def test_low_amount_is_frictionless(self):
        gate = QrPayThreeDs()
        uri = build_pay_uri("cnt_0x71c8", amount_uJPY=100_000)
        session = gate.begin(uri)
        self.assertEqual(session.status, QrPayThreeDsStatus.NOT_REQUIRED)
        self.assertEqual(session.risk, "low")
        self.assertTrue(gate.verify(session, "000000"))
        self.assertEqual(session.status, QrPayThreeDsStatus.CHALLENGE_PASSED)

    def test_challenge_verify_and_settle(self):
        gate = QrPayThreeDs()
        uri = build_pay_uri("cnt_0x71c8", amount_uJPY=5_000_000)
        session = gate.begin(uri)
        code = gate.issue_challenge(session)
        self.assertTrue(code)
        self.assertTrue(gate.verify(session, code))
        self.assertEqual(session.status, QrPayThreeDsStatus.CHALLENGE_PASSED)

        result = gate.settle(session)
        self.assertEqual(result["status"], "settled")
        self.assertEqual(result["amountUJPY"], 5_000_000)
        self.assertEqual(sum(p["amount"] for p in result["postings"]), 0)

    def test_challenge_failed_blocks_settlement(self):
        gate = QrPayThreeDs(max_attempts=2)
        uri = build_pay_uri("cnt_0x71c8", amount_uJPY=5_000_000)
        session = gate.begin(uri)
        gate.issue_challenge(session)
        self.assertFalse(gate.verify(session, "wrong"))
        self.assertFalse(gate.verify(session, "wrong"))
        self.assertEqual(session.status, QrPayThreeDsStatus.CHALLENGE_FAILED)
        with self.assertRaises(ValueError):
            gate.settle(session)

    def test_ledger_settlement_posts_balanced_transaction(self):
        ledger = ZenoLedger()
        ledger.create_account("cnt_test_recipient", "Test Recipient", AccountType.EQUITY)
        gate = QrPayThreeDs()
        uri = build_pay_uri("cnt_test_recipient", amount_uJPY=3_000_000)
        session = gate.begin(uri)
        gate.issue_challenge(session)
        gate.verify(session, session.challenge_code)

        result = gate.settle(session, ledger=ledger)
        self.assertEqual(result["status"], "settled")
        acct = ledger.accounts["cnt_test_recipient"]
        self.assertEqual(acct.balance, -3_000_000)
        self.assertEqual(ledger.accounts["asset:fiat:boj_escrow"].balance, 3_000_000)


if __name__ == "__main__":
    unittest.main()
