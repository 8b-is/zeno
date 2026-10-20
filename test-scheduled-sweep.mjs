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
