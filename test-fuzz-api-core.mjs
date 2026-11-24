import test from "node:test";
import assert from "node:assert/strict";

import ZenoEngine from "./zeno-engine.js";
import worker from "./deploy/worker.js";

const { StablecoinReserveEngine, MICRO_USD } = ZenoEngine;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const VALID_PROV = "sha256://0abcabf86830af11bb5e8cd74dc9c9d00abcabf86830af11bb5e8cd74dc9c9d0";
const USER_SOLANA = "HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS";

function makeRng(seed = 0x8b15_2026_0062n) {
  let state = BigInt(seed) & ((1n << 64n) - 1n);
  return function nextInt(maxExclusive) {
    state ^= state >> 12n;
    state ^= (state << 25n) & ((1n << 64n) - 1n);
    state ^= state >> 27n;
    const val = (state * 0x2545f4914f6cdd1dn) & ((1n << 64n) - 1n);
    return Number(val % BigInt(maxExclusive));
  };
}

async function fetchWorker(path, init = {}, env = {}) {
  return worker.fetch(new Request("https://zeno.vaked.dev" + path, init), env, {});
}

test("Fuzz Edge Worker API routes against malformed JSON, prototype pollution, invalid methods, and boundary numbers", async () => {
  const nextInt = makeRng(0x1337_0062n);

  const poisonPayloads = [
    "",
    "{",
    "null",
    "[]",
    "42",
    "true",
    "\"string\"",
    JSON.stringify({ __proto__: { polluted: true }, constructor: { prototype: { polluted: true } } }),
    JSON.stringify({
      invoiceId: "fuzz-neg",
      version: 1,
      contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
      work: {},
      artifact: { provenanceHash: VALID_PROV },
      valuation: { selfAssessedFokens: 10 },
      ipAssignment: { statement: "IRREVOCABLE ASSIGNMENT", signature: "0x4f8a3c9b71c8" },
      netUtility: { futureWorkAvoidedHours: 100, workAddedHours: -1, maintenanceDebtHours: 0 },
    }),
    JSON.stringify({
      invoiceId: "fuzz-float",
      version: 1,
      contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
      work: {},
      artifact: { provenanceHash: VALID_PROV },
      valuation: { selfAssessedFokens: 10.5 },
      ipAssignment: { statement: "IRREVOCABLE ASSIGNMENT", signature: "0x4f8a3c9b71c8" },
      netUtility: { futureWorkAvoidedHours: 100.5, workAddedHours: 0, maintenanceDebtHours: 0 },
    }),
    JSON.stringify({
      invoiceId: "fuzz-overclaim",
      version: 1,
      contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
      work: {},
      artifact: { provenanceHash: VALID_PROV },
      valuation: { selfAssessedFokens: 250000 },
      ipAssignment: { statement: "IRREVOCABLE ASSIGNMENT", signature: "0x4f8a3c9b71c8" },
      netUtility: { futureWorkAvoidedHours: 1, workAddedHours: 0, maintenanceDebtHours: 0 },
    }),
  ];

  // Deterministic randomized POST fuzzing on /api/us/foken and /api/v1/gate
  for (let i = 0; i < 60; i++) {
    let payload;
    if (i < poisonPayloads.length) {
      payload = poisonPayloads[i];
    } else if (i % 2 === 0) {
      const junkLen = nextInt(200);
      let s = "";
      for (let j = 0; j < junkLen; j++) {
        s += String.fromCharCode(32 + nextInt(95));
      }
      payload = s;
    } else {
      payload = JSON.stringify({
        invoiceId: `rnd-${i}`,
        contributor: nextInt(2) ? "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940" : "bad",
        work: nextInt(3) ? { title: "fuzz" } : null,
        artifact: { provenanceHash: VALID_PROV },
        valuation: { selfAssessedFokens: nextInt(5000) - 500 },
        ipAssignment: { statement: "IRREVOCABLE ASSIGNMENT", signature: "0xdeadbeef1234" },
        netUtility: {
          futureWorkAvoidedHours: nextInt(2000) - 100,
          workAddedHours: nextInt(500) - 20,
          maintenanceDebtHours: nextInt(200) - 10,
        },
      });
    }

    for (const ep of ["/api/us/foken", "/api/v1/gate", "/api/us/checkout"]) {
      const res = await fetchWorker(ep, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });
      assert.ok(res.status < 500, `${ep} returned 5xx (${res.status}) on fuzz payload #${i}`);
      assert.ok([200, 400, 413, 422].includes(res.status), `${ep} unexpected status ${res.status}`);
    }
  }

  // Stripe webhook signature header fuzzing (fail-closed 503 when unconfigured; strictly 4xx when configured)
  for (const sigHeader of ["", "t=1,v1=dead", "__proto__=1,t=abc,v1=zz", "t=9999999999,v1=00"]) {
    const resUnconf = await fetchWorker("/api/v1/stripe/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": sigHeader },
      body: JSON.stringify({ id: "evt_fuzz", type: "payment_intent.succeeded" }),
    });
    assert.equal(resUnconf.status, 503, "unconfigured stripe webhook must fail closed with 503");

    const resConf = await fetchWorker(
      "/api/v1/stripe/webhook",
      {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": sigHeader },
        body: JSON.stringify({ id: "evt_fuzz", type: "payment_intent.succeeded" }),
      },
      { STRIPE_WEBHOOK_SECRET: "whsec_fuzz_test_secret_0x62" },
    );
    assert.ok(resConf.status >= 400 && resConf.status < 500, `configured stripe webhook returned ${resConf.status}`);
  }

  // Method confusion across core endpoints (no 500s)
  const readOnlyEndpoints = [
    "/",
    "/us",
    "/us.css",
    "/us.js",
    "/api/us/reserve-proof",
    "/api/us/architecture",
    "/api/us/solana-payout-spec",
    "/api/us/networks",
    "/api/us/pricing",
    "/api/wallet/google-pass",
    "/api/wallet/issuer-angel",
    "/api/constellation",
    "/api/kompress",
    "/rfc-008",
    "/solana-pipeline",
    "/monetization-spec",
  ];
  for (const ep of readOnlyEndpoints) {
    for (const method of ["PUT", "DELETE", "PATCH"]) {
      const res = await fetchWorker(ep, { method });
      assert.equal(res.status, 405, `${method} ${ep} must return 405, got ${res.status}`);
    }
  }

  // Icon path traversal and Object.prototype property lookup
  for (const iconPath of [
    "/icons/__proto__",
    "/icons/constructor",
    "/icons/toString",
    "/icons/valueOf",
    "/icons/../../etc/passwd",
    "/icons/%2e%2e%2fsecret.png",
  ]) {
    const res = await fetchWorker(iconPath);
    assert.ok(res.status === 404 || res.status === 400, `${iconPath} returned unexpected status ${res.status}`);
  }

  // Google Wallet balance_ujpy fuzzing
  for (const rawBal of ["-1", "NaN", "Infinity", "1e30", "9007199254740993", "abc", "0", "4820000000"]) {
    const res = await fetchWorker(`/api/wallet/google-pass?balance_ujpy=${encodeURIComponent(rawBal)}`);
    assert.ok(res.status === 200 || res.status === 400, `google-pass balance_ujpy=${rawBal} -> ${res.status}`);
  }

  assert.equal(({}).polluted, undefined, "Object.prototype must never be polluted");
});

test("Fuzz Solana Base58 decoder (1,000 strings) and StablecoinReserveEngine (300 randomized ops)", () => {
  const nextInt = makeRng(0x501a_aa00_0062n);

  // Base58 fuzzing
  for (let i = 0; i < 1000; i++) {
    const len = nextInt(60);
    let cand = "";
    for (let j = 0; j < len; j++) {
      if (i % 5 === 0) cand += "1";
      else if (i % 7 === 0) cand += String.fromCharCode(32 + nextInt(95));
      else cand += B58[nextInt(B58.length)];
    }
    try {
      const decoded = StablecoinReserveEngine.decodeSolanaPubkey(cand);
      assert.equal(decoded.length, 32);
      assert.ok(cand.length >= 32 && cand.length <= 44);
      assert.ok(!decoded.every((b) => b === 0));
    } catch (err) {
      assert.ok(err instanceof Error);
    }
  }

  // State machine fuzzing
  const engine = new StablecoinReserveEngine();
  const tags = ["$you", "$alexandra", "$chris", "$yves"];
  const assets = ["USDC", "USDT"];

  for (let step = 0; step < 300; step++) {
    const op = nextInt(6);
    const tag = tags[nextInt(tags.length)];
    const tag2 = tags[nextInt(tags.length)];
    const asset = assets[nextInt(2)];
    const amountMicro = BigInt(1 + nextInt(2000)) * 10000n; // $0.01 .. $20.00 in micro-USD

    try {
      if (op === 0) {
        engine.depositReserve(tag, asset, amountMicro, "Solana");
      } else if (op === 1) {
        engine.swapStablecoin(assets[0], assets[1], amountMicro);
      } else if (op === 2) {
        engine.swapStablecoin(assets[1], assets[0], amountMicro);
      } else if (op === 3) {
        engine.p2pSend(tag, tag2, amountMicro, "ZENO Instant 0-Fee", `fuzz-${step}`);
      } else if (op === 4) {
        engine.redeemReserve(tag, asset, amountMicro, USER_SOLANA);
      } else {
        const avoided = 10 + nextInt(200);
        const added = nextInt(50);
        const debt = nextInt(20);
        const fokens = 1 + nextInt(1000);
        engine.mintFromFoken(tag, asset, {
          invoiceId: `fuzz-inv-${step}`,
          version: 1,
          contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
          work: { title: "Fuzz" },
          artifact: { provenanceHash: VALID_PROV },
          valuation: { selfAssessedFokens: fokens },
          ipAssignment: { statement: "IRREVOCABLE ASSIGNMENT", signature: "0xabcdef1234567890" },
          netUtility: {
            futureWorkAvoidedHours: avoided,
            workAddedHours: added,
            maintenanceDebtHours: debt,
          },
        });
      }
    } catch (err) {
      assert.ok(err instanceof Error);
    }

    const intent = StablecoinReserveEngine.buildSolanaPayUsdcIntent({
      recipient: USER_SOLANA,
      amountMicro: 5n * MICRO_USD,
      memo: `step-${step}`,
    });
    assert.equal(intent.status, "UNSIGNED_AWAITING_SOLANA_SIGNER");
    assert.equal(intent.amountDecimal, "5");

    const audit = engine.verifyDoubleEntryAudit();
    assert.equal(audit.valid, true, `Audit failed at fuzz step ${step}: ${audit.reason}`);
    assert.equal(audit.ratioPQ, "1/1");
  }
});
