import test from "node:test";
import assert from "node:assert/strict";
import ZenoEngine from "./zeno-engine.js";

const { KintsugiLedger } = ZenoEngine;

test("KintsugiLedger.sweepExpiredChallenges prunes expired OTP challenges with trit -1", () => {
  const now = 500_000;
  const res = KintsugiLedger.sweepExpiredChallenges(
    [
      { id: "ch-dead", born: 100_000 },
      { id: "ch-live", born: 450_000 },
    ],
    now,
    120_000
  );
  assert.equal(res.prunedCount, 1);
  assert.equal(res.pruned[0].id, "ch-dead");
  assert.equal(res.pruned[0].trit, -1);
  assert.equal(res.activeCount, 1);
  assert.equal(res.active[0].id, "ch-live");
});

test("KintsugiLedger.executeScheduledBatch settles due payments and preserves future ones", () => {
  const balances = { "vault:peter": 1000, "vault:yves": 500 };
  const res = KintsugiLedger.executeScheduledBatch(
    [
      { id: "s1", from: "vault:peter", to: "vault:yves", amount: 300, executeAtMs: 1000 },
      { id: "s2", from: "vault:peter", to: "vault:yves", amount: 200, executeAtMs: 9000 },
    ],
    balances,
    2000
  );
  assert.equal(res.settled.length, 1);
  assert.equal(res.settled[0].trit, 1);
  assert.equal(res.pending.length, 1);
  assert.equal(res.pending[0].trit, 0);
  assert.equal(res.balances["vault:peter"], 700);
  assert.equal(res.balances["vault:yves"], 800);
});

test("KintsugiLedger.sweepExpiredChallenges tracks cumulative otpSweptTotal across sweeps", () => {
  const baseline = KintsugiLedger.otpSweptTotal;
  const sweep1 = KintsugiLedger.sweepExpiredChallenges(
    [
      { id: "ch-exp-1", born: 10_000 },
      { id: "ch-exp-2", born: 20_000 },
      { id: "ch-fresh", born: 290_000 },
    ],
    300_000,
    120_000
  );
  assert.equal(sweep1.prunedCount, 2);
  assert.equal(sweep1.otpSweptTotal, baseline + 2);

  const sweep2 = KintsugiLedger.sweepExpiredChallenges(
    [{ id: "ch-exp-3", born: 50_000 }],
    300_000,
    120_000
  );
  assert.equal(sweep2.prunedCount, 1);
  assert.equal(sweep2.otpSweptTotal, baseline + 3);
  assert.equal(KintsugiLedger.otpSweptTotal, baseline + 3);
});

test("KintsugiLedger recurring scheduled payments advance executeAtMs and runCount until maxRuns", () => {
  const balances = { "vault:8b_is": 1000, "vault:yves": 200 };
  const job = KintsugiLedger.schedulePayment({
    id: "sched-rec-1",
    from: "vault:8b_is",
    to: "vault:yves",
    amount: 100,
    executeAtMs: 1_000,
    intervalMs: 1_000,
    maxRuns: 3,
  });
  const queue = [job];

  // Tick 1 at t=1000 -> runCount=1, rescheduled to 2000 as pending
  const t1 = KintsugiLedger.executeScheduledBatch(queue, balances, 1_000);
  assert.equal(t1.settled.length, 1);
  assert.equal(t1.pending.length, 1);
  assert.equal(job.runCount, 1);
  assert.equal(job.executeAtMs, 2_000);
  assert.equal(job.status, "pending");
  assert.equal(balances["vault:8b_is"], 900);
  assert.equal(balances["vault:yves"], 300);

  // Tick 2 at t=2000 -> runCount=2, rescheduled to 3000 as pending
  const t2 = KintsugiLedger.executeScheduledBatch(queue, balances, 2_000);
  assert.equal(t2.settled.length, 1);
  assert.equal(t2.pending.length, 1);
  assert.equal(job.runCount, 2);
  assert.equal(job.executeAtMs, 3_000);
  assert.equal(job.status, "pending");
  assert.equal(balances["vault:8b_is"], 800);
  assert.equal(balances["vault:yves"], 400);

  // Tick 3 at t=3000 -> runCount=3 >= maxRuns, transitions to executed
  const t3 = KintsugiLedger.executeScheduledBatch(queue, balances, 3_000);
  assert.equal(t3.settled.length, 1);
  assert.equal(t3.pending.length, 0);
  assert.equal(job.runCount, 3);
  assert.equal(job.status, "executed");
  assert.equal(job.trit, 1);
  assert.equal(balances["vault:8b_is"], 700);
  assert.equal(balances["vault:yves"], 500);
});

test("KintsugiLedger.cancelScheduledPayment cancels pending payment with trit -1 and blocks execution", () => {
  const balances = { "vault:peter": 500, "vault:alexandra": 500 };
  const job = KintsugiLedger.schedulePayment({
    id: "sched-cancel-me",
    from: "vault:peter",
    to: "vault:alexandra",
    amount: 150,
    executeAtMs: 5_000,
    intervalMs: 2_000,
    maxRuns: 2,
  });

  const cancelRes = KintsugiLedger.cancelScheduledPayment("sched-cancel-me");
  assert.equal(cancelRes.cancelled, true);
  assert.equal(cancelRes.status, "cancelled");
  assert.equal(cancelRes.trit, -1);
  assert.equal(job.status, "cancelled");

  const batchRes = KintsugiLedger.executeScheduledBatch([job], balances, 10_000);
  assert.equal(batchRes.settled.length, 0);
  assert.equal(batchRes.cancelled.length, 1);
  assert.equal(balances["vault:peter"], 500);
  assert.equal(balances["vault:alexandra"], 500);
});

const transfer = (overrides = {}) => ({
  id: "scheduled", from: "a", to: "b", amount: 300, executeAtMs: 1000, ...overrides,
});

test("scheduled transfers reject malformed amounts and timestamps without changing balances", () => {
  for (const field of ["amount", "executeAtMs"]) {
    for (const value of [NaN, Infinity, -Infinity, "300", null, undefined, true, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const balances = { a: 1000, b: 500 };
      const result = KintsugiLedger.executeScheduledBatch([transfer({ [field]: value })], balances, 2000);
      assert.equal(result.rejected.length, 1, `${field}: ${String(value)}`);
      assert.equal(result.settled.length, 0);
      assert.equal(result.pending.length, 0);
      assert.deepEqual(balances, { a: 1000, b: 500 });
    }
  }
  const result = KintsugiLedger.executeScheduledBatch([transfer({ amount: 0 })], { a: 1000, b: 500 }, 2000);
  assert.equal(result.rejected.length, 1);
});

test("malformed future transfers and account identifiers are rejected before scheduling", () => {
  for (const item of [null, 1, transfer({ amount: NaN, executeAtMs: 9000 }),
    ...[undefined, null, "", " ", 1, "__proto__", "constructor", "prototype"].flatMap(account => [
      transfer({ from: account }), transfer({ to: account }),
    ])]) {
    const balances = { a: 1000, b: 500 };
    const result = KintsugiLedger.executeScheduledBatch([item], balances, 2000);
    assert.equal(result.rejected.length, 1);
    assert.deepEqual(balances, { a: 1000, b: 500 });
  }
});

test("invalid stored balances and destination overflow never debit the sender", () => {
  for (const account of ["a", "b"]) {
    for (const value of [NaN, Infinity, -Infinity, "500", null, undefined, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const balances = { a: 1000, b: 500, [account]: value };
      const before = { ...balances };
      const result = KintsugiLedger.executeScheduledBatch([transfer()], balances, 2000);
      assert.equal(result.rejected.length, 1);
      assert.deepEqual(balances, before);
    }
  }
  const balances = { a: 1000, b: Number.MAX_SAFE_INTEGER };
  const result = KintsugiLedger.executeScheduledBatch([transfer({ amount: 1 })], balances, 2000);
  assert.equal(result.rejected[0].reason, "BALANCE_OVERFLOW");
  assert.deepEqual(balances, { a: 1000, b: Number.MAX_SAFE_INTEGER });
});

test("invalid batch clocks fail before any settlement", () => {
  for (const now of [NaN, Infinity, "2000", null, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const balances = { a: 1000, b: 500 };
    assert.throws(() => KintsugiLedger.executeScheduledBatch([transfer()], balances, now), RangeError);
    assert.deepEqual(balances, { a: 1000, b: 500 });
  }
});

test("invalid batch containers fail without mutation", () => {
  for (const queue of [{}, "queue", false]) {
    const balances = { a: 1000, b: 500 };
    assert.throws(() => KintsugiLedger.executeScheduledBatch(queue, balances, 2000), TypeError);
    assert.deepEqual(balances, { a: 1000, b: 500 });
  }
  for (const balances of [null, undefined, [], "balances"]) {
    assert.throws(() => KintsugiLedger.executeScheduledBatch([transfer()], balances, 2000), TypeError);
  }
});

test("inherited balances cannot supply funds", () => {
  const balances = Object.create({ a: 1000 });
  balances.b = 500;
  const result = KintsugiLedger.executeScheduledBatch([transfer()], balances, 2000);
  assert.equal(result.rejected[0].reason, "INSUFFICIENT_FUNDS");
  assert.deepEqual(Object.keys(balances), ["b"]);
  assert.equal(balances.b, 500);
});

test("mixed settlements conserve integer units, including same-account and missing accounts", () => {
  const balances = { a: Number.MAX_SAFE_INTEGER, b: 0 };
  const result = KintsugiLedger.executeScheduledBatch([
    transfer({ id: "self", to: "a", amount: 1 }),
    transfer({ id: "out", amount: 300 }),
    transfer({ id: "back", from: "b", to: "a", amount: 100 }),
    transfer({ id: "new", from: "b", to: "c", amount: 50, executeAtMs: 2000 }),
    transfer({ id: "missing", from: "missing", amount: 1 }),
    transfer({ id: "overdraw", from: "b", amount: 1000 }),
    transfer({ id: "future", executeAtMs: 2001 }),
  ], balances, 2000);
  assert.deepEqual(result.settled.map(item => item.id), ["self", "out", "back", "new"]);
  assert.deepEqual(result.rejected.map(item => item.id), ["missing", "overdraw"]);
  assert.deepEqual(result.pending.map(item => item.id), ["future"]);
  assert.deepEqual(balances, { a: Number.MAX_SAFE_INTEGER - 200, b: 150, c: 50 });
  assert.equal(Object.values(balances).reduce((sum, value) => sum + BigInt(value), 0n), BigInt(Number.MAX_SAFE_INTEGER));
});
