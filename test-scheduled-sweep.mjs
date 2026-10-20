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
