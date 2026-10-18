#!/usr/bin/env python3
"""
ZENO Command Line Interface (CLI)
Sovereign Neo-Bank with Japanese Roots (銭・禅・善)
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Add core to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "core"))

from zeno_core.ledger import ZenoLedger, Posting, AccountType
from zeno_core.stream import StreamEngine
from zeno_core.foken_gate import FokenBridge
from zeno_core.agent_policy import AgentPolicyEvaluator

STATE_DIR = Path.home() / ".zeno"
STATE_FILE = STATE_DIR / "state.json"


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {"accounts": {}, "transactions": [], "streams": {}, "policies": {}}
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"accounts": {}, "transactions": [], "streams": {}, "policies": {}}


def save_state(state: dict):
    STATE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        os.chmod(STATE_DIR, 0o700)
    except OSError:
        pass
    fd = os.open(str(STATE_FILE), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.chmod(STATE_FILE, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def build_system():
    state = load_state()
    ledger = ZenoLedger()
    # Populate existing accounts
    for acct_id, acct_data in state.get("accounts", {}).items():
        if acct_id not in ledger.accounts:
            ledger.create_account(
                account_id=acct_id,
                label=acct_data["label"],
                account_type=AccountType(acct_data["type"]),
                currency=acct_data.get("currency", "JPY"),
                owner=acct_data.get("owner", ""),
            )
        ledger.accounts[acct_id].balance = acct_data.get("balance", 0)

    stream_engine = StreamEngine(ledger)
    foken_bridge = FokenBridge(ledger)
    agent_evaluator = AgentPolicyEvaluator(ledger)
    return ledger, stream_engine, foken_bridge, agent_evaluator, state


def persist_system(ledger: ZenoLedger, state: dict):
    for acct_id, acct in ledger.accounts.items():
        state["accounts"][acct_id] = {
            "label": acct.label,
            "type": acct.account_type.value,
            "currency": acct.currency,
            "balance": acct.balance,
            "owner": acct.owner,
        }
    save_state(state)


def cmd_account_create(args, ledger, stream_engine, foken_bridge, agent_eval, state):
    acct = ledger.create_account(
        account_id=args.id,
        label=args.label,
        account_type=AccountType(args.type),
        currency=args.currency,
        owner=args.owner or "",
    )
    persist_system(ledger, state)
    print(f"✧ Account created: {acct.account_id} [{acct.account_type.value}] - {acct.label}")


def cmd_account_list(args, ledger, stream_engine, foken_bridge, agent_eval, state):
    print("┌───────────────────────────┬──────────────┬──────────────┬───────────────────┐")
    print("│ Account ID                │ Type         │ Currency     │ Balance (JPY/uJPY)│")
    print("├───────────────────────────┼──────────────┼──────────────┼───────────────────┤")
    for aid, a in ledger.accounts.items():
        display_bal = -a.balance if a.account_type == AccountType.LIABILITY else a.balance
        jpy = display_bal / 1_000_000
        print(f"│ {aid:<25} │ {a.account_type.value:<12} │ {a.currency:<12} │ ¥{jpy:>14,.2f} │")
    print("└───────────────────────────┴──────────────┴──────────────┴───────────────────┘")


def cmd_transfer(args, ledger, stream_engine, foken_bridge, agent_eval, state):
    u_amt = int(args.amount * 1_000_000)
    postings = [
        Posting(account_id=args.from_acct, amount=u_amt, currency="JPY"),
        Posting(account_id=args.to_acct, amount=-u_amt, currency="JPY"),
    ]
    tx = ledger.record_transaction(postings, memo=args.memo or "Zeno CLI Transfer")
    persist_system(ledger, state)
    print(f"✧ Transfer executed: ¥{args.amount:,.2f} ({args.from_acct} -> {args.to_acct}) [Tx: {tx.tx_id}]")


def cmd_gate_evaluate(args, ledger, stream_engine, foken_bridge, agent_eval, state):
    if args.file == "-":
        data = json.load(sys.stdin)
    else:
        with open(args.file, "r", encoding="utf-8") as f:
            data = json.load(f)

    res = foken_bridge.evaluate_invoice(data)
    color = "\033[32m" if res.verdict.value == "PASS" else "\033[31m"
    reset = "\033[0m"
    print(f"✧ Foken Gate Verdict: {color}{res.verdict.value}{reset}")
    print(f"  Invoice ID: {res.invoice_id}")
    print(f"  Reason:     {res.reason}")
    if res.net_utility is not None:
        print(f"  NetUtility: {res.net_utility:+.1f} hours")


def cmd_chain_verify(args, ledger, stream_engine, foken_bridge, agent_eval, state):
    valid = ledger.verify_chain()
    status = "VALID (Chain intact)" if valid else "CORRUPTED (Hash mismatch)"
    print(f"✧ Kintsugi Block Chain: {status} ({len(ledger.chain)} sealed blocks)")


def cmd_g6_airlift(args, ledger, stream_engine, foken_bridge, agent_eval, state):
    from zeno_core.g6_airlift import ShivaG6AirliftOrchestrator
    orch = ShivaG6AirliftOrchestrator(ledger=ledger)
    kids = [k.strip() for k in args.kids.split(",") if k.strip()] if args.kids else None
    report = orch.execute_shiva_airlift(kids_manifest=kids)
    if args.json:
        print(json.dumps(report.to_dict(), indent=2, ensure_ascii=False))
        return
    print("╔══════════════════════════════════════════════════════════════════════════╗")
    print("║  ZENO × SHIVA MODE :: GULFSTREAM G650ER TOKYO (RJTT) ⇄ NORFOLK (KORF)    ║")
    print("╚══════════════════════════════════════════════════════════════════════════╝")
    print(f"  • Aircraft        : {report.aircraft_type} [{report.tail_registry}]")
    print(f"  • Engines         : {report.engines}")
    print(f"  • Leg 1 Outbound  : {report.leg1_outbound.origin.icao} -> {report.leg1_outbound.destination.icao} ({report.leg1_outbound.great_circle_nm} nm / {report.leg1_outbound.block_hours}h @ Mach {report.leg1_outbound.cruise_mach})")
    print(f"    Passengers (3)  : {', '.join(report.leg1_outbound.passengers)}")
    print(f"  • Leg 2 Return    : {report.leg2_return.origin.icao} -> {report.leg2_return.destination.icao} ({report.leg2_return.great_circle_nm} nm / {report.leg2_return.block_hours}h @ Mach {report.leg2_return.cruise_mach})")
    print(f"    Passengers      : {', '.join(report.leg2_return.passengers)}")
    print(f"  • Zeno Settlement : ¥{report.charter_principal_jpy:,} JPY (Broker Toll Burned: ¥{report.broker_toll_burned_jpy:,} JPY)")
    print(f"  • Suiryū Streams  : {report.stream_id_leg1} + {report.stream_id_leg2} ({report.total_streamed_micro_jpy:,} µJPY settled)")
    print(f"  • Kintsugi ZKP1   : {report.kintsugi_chain_blocks} blocks | {report.zkp1_packed_bytes} bytes | verified={report.zkp1_verified} | PII Zeroized={report.pii_manifest_zeroized}")
    print(f"  • Head Seal       : {report.kintsugi_head_seal}")


def main():
    parser = argparse.ArgumentParser(
        description="ZENO: Sovereign Neo-Bank with Japanese Roots (銭・禅・善)"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # Account commands
    acct_p = sub.add_parser("account", help="Account management")
    acct_sub = acct_p.add_subparsers(dest="subcommand", required=True)

    create_p = acct_sub.add_parser("create", help="Create new account")
    create_p.add_argument("--id", required=True)
    create_p.add_argument("--label", required=True)
    create_p.add_argument("--type", choices=["asset", "liability", "equity", "revenue", "expense"], default="liability")
    create_p.add_argument("--currency", default="JPY")
    create_p.add_argument("--owner", default="")

    acct_sub.add_parser("list", help="List all registered accounts")

    # Transfer command
    tx_p = sub.add_parser("transfer", help="Execute double-entry transfer")
    tx_p.add_argument("--from", dest="from_acct", required=True)
    tx_p.add_argument("--to", dest="to_acct", required=True)
    tx_p.add_argument("--amount", type=float, required=True, help="Amount in JPY")
    tx_p.add_argument("--memo", default="")

    # Foken Gate command
    gate_p = sub.add_parser("gate", help="Foken proof-of-contribution pre-filter")
    gate_p.add_argument("file", help="Path to invoice.json or '-' for stdin")

    # Chain verify command
    sub.add_parser("verify", help="Verify Kintsugi ledger cryptographic integrity")

    # G650ER Sovereign Airlift command
    g6_p = sub.add_parser("g6-airlift", help="Execute Gulfstream G650ER Tokyo (RJTT) ⇄ Norfolk (KORF) Family Reunification Airlift")
    g6_p.add_argument("--kids", default="Nate & Kids (Lódri Family Starlight Crew)", help="Comma-separated kids manifest for Leg 2 return")
    g6_p.add_argument("--json", action="store_true", help="Emit JSON report")

    args = parser.parse_args()
    ledger, stream_engine, foken_bridge, agent_eval, state = build_system()

    if args.command == "account":
        if args.subcommand == "create":
            cmd_account_create(args, ledger, stream_engine, foken_bridge, agent_eval, state)
        elif args.subcommand == "list":
            cmd_account_list(args, ledger, stream_engine, foken_bridge, agent_eval, state)
    elif args.command == "transfer":
        cmd_transfer(args, ledger, stream_engine, foken_bridge, agent_eval, state)
    elif args.command == "gate":
        cmd_gate_evaluate(args, ledger, stream_engine, foken_bridge, agent_eval, state)
    elif args.command == "verify":
        cmd_chain_verify(args, ledger, stream_engine, foken_bridge, agent_eval, state)
    elif args.command == "g6-airlift":
        cmd_g6_airlift(args, ledger, stream_engine, foken_bridge, agent_eval, state)


if __name__ == "__main__":
    main()
