import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ZenoEngine from "./zeno-engine.js";
import worker from "./deploy/worker.js";

const here = dirname(fileURLToPath(import.meta.url));
const { StablecoinReserveEngine, ContinuousStreamEngine, FokenGateValidator, MICRO_USD } = ZenoEngine;

async function fetchWorker(path, init = {}) {
  return worker.fetch(new Request("https://zeno.vaked.dev" + path, init), {}, {});
}

test("ZENO US backend is Rust-only (#![no_std], zero floats, zero Python)", () => {
  assert.equal(
    existsSync(join(here, "apps", "core", "zeno_core", "us_stablecoin.py")),
    false,
    "Python US stablecoin module must not exist",
  );
  assert.equal(
    existsSync(join(here, "apps", "core", "tests", "test_us_stablecoin.py")),
    false,
    "Python US stablecoin test must not exist",
  );

  const rustSrc = readFileSync(join(here, "apps", "rust", "zeno-us-core", "src", "lib.rs"), "utf8");
  const angelSrc = readFileSync(join(here, "apps", "rust", "zeno-issuer-angel", "src", "lib.rs"), "utf8");
  for (const src of [rustSrc, angelSrc]) {
    assert.ok(src.includes("#![no_std]"), "Rust crate must be #![no_std]");
    assert.ok(!/\bf32\b/.test(src), "f32 float type is forbidden in Rust core");
    assert.ok(!/\bf64\b/.test(src), "f64 float type is forbidden in Rust core");
  }
  assert.ok(rustSrc.includes("#![forbid(unsafe_code)]"), "zeno-us-core must forbid unsafe code");
});

test("StablecoinReserveEngine is prototype-safe, pure BigInt, tamper-resistant, and passes audit", () => {
  const engine = new StablecoinReserveEngine();
  assert.equal(Object.getPrototypeOf(engine.accounts), null, "accounts map must use null prototype");

  assert.throws(() => {
    engine.depositReserve("__proto__", "USDC", 100n * MICRO_USD);
  }, /Invalid \$zenotag/);

  // Tampered seedState (under-backed reserves) must be rejected
  const snapshot = engine.toJSON();
  snapshot.reserves.USDC = "1";
  assert.throws(() => new StablecoinReserveEngine(snapshot), /Tampered seedState rejected/);

  // Negative spend in ContinuousStreamEngine must be rejected
  const stream = new ContinuousStreamEngine(1000, 1);
  assert.throws(() => stream.spend(-500), RangeError);

  // Negative maintenanceDebtHours in FokenGateValidator must be rejected
  const negGate = FokenGateValidator.evaluate({
    invoiceId: "inv_neg",
    version: 1,
    contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
    work: {},
    artifact: { provenanceHash: "sha256://8b1s_quantum_wave_engine_pass" },
    valuation: {
      futureWorkAvoidedHours: 10,
      workAddedHours: 5,
      maintenanceDebtHours: -20,
      netUtilityHours: 35,
    },
    ipAssignment: true,
  });
  assert.equal(negGate.verdict, "FAIL");

  const initialParity = engine.verifyReserveParity();
  assert.equal(initialParity.ratioPQ, "1/1");
  assert.equal(initialParity.trit, 0);
  assert.equal(initialParity.balanced, true);

  const dep = engine.depositReserve("$you", "USDC", 500n * MICRO_USD, "Base");
  assert.equal(dep.parity.ratioPQ, "1/1");
  assert.equal(dep.receipt.gate, "0x62");

  const sw = engine.swapStablecoin("USDC", "USDT", 250n * MICRO_USD);
  assert.equal(sw.parity.ratioPQ, "1/1");
  assert.equal(sw.parity.totalReservesMicro, dep.parity.totalReservesMicro);

  const p2p = engine.p2pSend("$you", "$alexandra", 100n * MICRO_USD, "ZENO Instant 0-Fee", "coffee");
  assert.equal(p2p.parity.ratioPQ, "1/1");

  assert.throws(() => {
    engine.p2pSend("$you", "$chris", 999999999n * MICRO_USD);
  }, /Insufficient balance/);

  const red = engine.redeemReserve("$you", "USDT", 150n * MICRO_USD, "0xSelfCustody");
  assert.equal(red.parity.ratioPQ, "1/1");

  const audit = engine.verifyDoubleEntryAudit();
  assert.equal(audit.valid, true);
  assert.equal(audit.ratioPQ, "1/1");

  const fx = StablecoinReserveEngine.convertFx(100n * MICRO_USD, "JPY");
  assert.equal(fx.ratePQ, "305/2");
  assert.equal(fx.feeBps, 0);
  assert.equal(fx.amountMicroOut, 15250n * MICRO_USD);
  assert.equal(fx.formattedOut, "¥15,250");

  // FOKEN gate exact p/q valuation & 1:1 USDC-backed settlement
  const fokenInvoice = {
    invoiceId: "01933b70-9831-7bc8-8123-018b1509a001",
    version: 1,
    contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
    work: { title: "OMNI Ternary Dot" },
    artifact: { provenanceHash: "sha256://0abcabf86830af11bb5e8cd74dc9c9d00abcabf86830af11bb5e8cd74dc9c9d0" },
    valuation: { selfAssessedFokens: 400 },
    ipAssignment: {
      statement: "IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
      signature: "0x4f8a3c9b71c8",
    },
    netUtility: {
      futureWorkAvoidedHours: 120,
      workAddedHours: 10,
      maintenanceDebtHours: 2,
    },
  };
  const fokenRes = engine.mintFromFoken("$you", "USDC", fokenInvoice);
  assert.equal(fokenRes.gate.verdict, "PASS");
  assert.equal(fokenRes.gate.netUtilityPQ, "107/1");
  assert.equal(fokenRes.gate.usdMicroAwarded, 400n * MICRO_USD);
  assert.equal(fokenRes.parity.ratioPQ, "1/1");

  // Solana Base58 validation + unsigned 200 USDC Solana Pay payout intent
  const coinbaseSolana = "HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS";
  const decoded = StablecoinReserveEngine.decodeSolanaPubkey(coinbaseSolana);
  assert.equal(decoded.length, 32);
  assert.deepEqual(Array.from(decoded.slice(0, 4)), [0xf9, 0xdf, 0xbe, 0x49]);
  assert.throws(() => StablecoinReserveEngine.decodeSolanaPubkey("0OIl"), /Invalid Solana Base58/);
  assert.throws(() => StablecoinReserveEngine.decodeSolanaPubkey("11111111111111111111111111111111"), /All-zero/);

  const solIntent = StablecoinReserveEngine.buildSolanaPayUsdcIntent({
    recipient: coinbaseSolana,
    amountMicro: 200n * MICRO_USD,
    label: "ZENO Family Trust",
    memo: "test",
  });
  assert.equal(solIntent.status, "UNSIGNED_AWAITING_SOLANA_SIGNER");
  assert.equal(solIntent.amountDecimal, "200");
  assert.equal(
    solIntent.solanaPayUri,
    "solana:HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS?amount=200&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=ZENO%20Family%20Trust&memo=test",
  );
  assert.equal(
    solIntent.cliCommand,
    "spl-token transfer EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 200 HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS --fund-recipient --allow-unfunded-recipient",
  );
});

test("Worker serves hardened /us CSP, 405/413 guards, safe icons, and Rust-only architecture", async () => {
  const usRes = await fetchWorker("/us");
  assert.equal(usRes.status, 200);
  const csp = usRes.headers.get("content-security-policy") || "";
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(usRes.headers.get("x-frame-options"), "DENY");
  assert.equal(usRes.headers.get("cross-origin-opener-policy"), "same-origin");

  for (const path of ["/us.css", "/us.js", "/rfc-008", "/solana-pipeline", "/licensing-boundary"]) {
    const res = await fetchWorker(path);
    assert.equal(res.status, 200, `${path} did not return 200`);
  }

  const solSpecRes = await fetchWorker("/api/us/solana-payout-spec");
  assert.equal(solSpecRes.status, 200);
  const solSpec = await solSpecRes.json();
  assert.equal(solSpec.usdcMint, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  assert.equal(solSpec.payoutExecutionMode, "UNSIGNED_CLIENT_OR_HSM_SIGNER_REQUIRED");
  assert.equal(solSpec.familyTrustTiers.tier1LiquidReserves.usdBackingWeight, "1/1");
  assert.equal(solSpec.familyTrustTiers.tier2FokenContribution.constellationNetUtilityHours, 2406);
  assert.equal(solSpec.familyTrustTiers.tier3VakedUtility.vakedContract, "0x2Ae7DA713A2c8527AF70825C0F79632AF2e2ae4A");
  assert.equal(solSpec.familyTrustTiers.tier3VakedUtility.vakedUsdBackingWeight, "0/1");
  assert.equal(solSpec.familyTrustTiers.tier3VakedUtility.financialClaim, false);

  const solSpec405 = await fetchWorker("/api/us/solana-payout-spec", { method: "POST" });
  assert.equal(solSpec405.status, 405);

  // Method & prototype-key hardening
  const method405 = await fetchWorker("/us", { method: "POST" });
  assert.equal(method405.status, 405);
  const gateGet405 = await fetchWorker("/api/v1/gate", { method: "GET" });
  assert.equal(gateGet405.status, 405);
  const protoIcon = await fetchWorker("/icons/toString");
  assert.equal(protoIcon.status, 404);

  // Oversized body guard (413)
  const bigBody = JSON.stringify({ pad: "a".repeat(20000) });
  const tooLarge = await fetchWorker("/api/us/foken", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: bigBody,
  });
  assert.equal(tooLarge.status, 413);

  // Negative maintenance debt rejected on /api/v1/gate & /api/us/foken
  const negFoken = await fetchWorker("/api/us/foken", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      invoiceId: "inv-neg",
      version: 1,
      contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
      work: { title: "Neg" },
      artifact: { provenanceHash: "sha256://0abcabf86830af11bb5e8cd74dc9c9d00abcabf86830af11bb5e8cd74dc9c9d0" },
      valuation: { selfAssessedFokens: 10 },
      ipAssignment: {
        statement: "IRREVOCABLE ASSIGNMENT",
        signature: "0x4f8a3c9b71c8",
      },
      netUtility: {
        futureWorkAvoidedHours: 1,
        workAddedHours: 1,
        maintenanceDebtHours: -5,
      },
    }),
  });
  assert.equal(negFoken.status, 422);

  const porRes = await fetchWorker("/api/us/reserve-proof");
  assert.equal(porRes.status, 200);
  const por = await porRes.json();
  assert.deepEqual(por.backing, ["USDC", "USDT"]);
  assert.equal(por.coverageRatioPQ, "1/1");
  assert.equal(por.trit, 0);
  assert.equal(por.gate, "0x62");
  assert.equal(por.usdcReserveMicro + por.usdtReserveMicro, por.totalReservesMicro);
  assert.equal(por.totalReservesMicro, por.totalLiabilitiesMicro);

  const archRes = await fetchWorker("/api/us/architecture");
  assert.equal(archRes.status, 200);
  const arch = await archRes.json();
  assert.equal(arch.jurisdiction, "US-first");
  assert.equal(arch.backendLanguage, "rust");
  assert.equal(arch.pythonAllowed, false);
  assert.equal(arch.zeroFloatPQ, true);
  assert.equal(arch.clientRuntime, "safe-isomorphic-js");
  assert.equal(arch.clientLicense, "MIT");
  assert.equal(arch.coreLicense, "PROPRIETARY_PRIVATE");
  assert.equal(arch.zeroTelemetry, true);
  assert.equal(arch.fokenGate, true);
  assert.deepEqual(arch.domains, ["zeno.vaked.dev", "zeno.8b.is"]);
  assert.deepEqual(arch.privateCoreModules, ["apps/rust/zeno-us-core", "apps/rust/zeno-issuer-angel"]);

  const fokenInfoRes = await fetchWorker("/api/us/foken");
  assert.equal(fokenInfoRes.status, 200);
  const fokenInfo = await fokenInfoRes.json();
  assert.equal(fokenInfo.fokenToUsdMicro, 1000000);
  assert.deepEqual(fokenInfo.domains, ["zeno.vaked.dev", "zeno.8b.is"]);

  const fokenPostRes = await fetchWorker("/api/us/foken", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      invoiceId: "01933b70-9831-7bc8-8123-018b1509a001",
      version: 1,
      contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
      work: { title: "OMNI Ternary Dot" },
      artifact: { provenanceHash: "sha256://0abcabf86830af11bb5e8cd74dc9c9d00abcabf86830af11bb5e8cd74dc9c9d0" },
      valuation: { selfAssessedFokens: 400 },
      ipAssignment: {
        statement: "IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
        signature: "0x4f8a3c9b71c8",
      },
      netUtility: {
        futureWorkAvoidedHours: 120,
        workAddedHours: 10,
        maintenanceDebtHours: 2,
      },
    }),
  });
  assert.equal(fokenPostRes.status, 200);
  const fokenPost = await fokenPostRes.json();
  assert.equal(fokenPost.verdict, "PASS");
  assert.equal(fokenPost.netUtilityPQ, "107/1");
  assert.equal(fokenPost.usdMicroAwarded, 400000000);

  const caddyfile = readFileSync(join(here, "deploy", "zeno.8b.is.Caddyfile"), "utf8");
  assert.match(caddyfile, /zeno\.8b\.is/);
  assert.match(caddyfile, /reverse_proxy https:\/\/zeno\.vaked\.dev/);
  assert.match(caddyfile, /header_up -CF-Connecting-IP/);
});

test("Safe isomorphic US client has zero innerHTML, zero inline styles, zero Google Fonts, zero purple", () => {
  const usCss = readFileSync(join(here, "us.css"), "utf8");
  const usHtml = readFileSync(join(here, "us.html"), "utf8");
  const usJs = readFileSync(join(here, "us.js"), "utf8");

  assert.ok(!/innerHTML/i.test(usJs), "innerHTML is forbidden in safe US client JS");
  assert.ok(!/\sstyle="/i.test(usHtml), "inline style attributes are forbidden under strict CSP");
  assert.ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(usHtml), "external font telemetry forbidden on /us");
  assert.ok(!/generateKey\([^)]*,\s*true\s*,/s.test(usJs), "WebCrypto private key must be non-extractable (false)");
  assert.ok(!/\.replace\(\s*\/\[\^0-9\.\]/i.test(usJs), "parseUsdToMicro must not strip minus signs silently");

  for (const src of [usCss, usHtml, usJs]) {
    assert.ok(!/#b48bff/i.test(src), "purple hex #b48bff is forbidden in US UI");
    assert.ok(!/\bpurple\b/i.test(src), "purple color keyword is forbidden in US UI");
    assert.ok(!/\bviolet\b/i.test(src), "violet color keyword is forbidden in US UI");
    assert.ok(!/rgba\(\s*180\s*,\s*139\s*,\s*255/i.test(src), "purple rgba is forbidden in US UI");
  }
  assert.ok(!/<xml/i.test(usJs), "no XML allowed");
});

test("Public MIT client exporter dry-run excludes all private-core paths", () => {
  const out = execFileSync("bash", ["scripts/export-public-client.sh", "--dry-run"], {
    cwd: here,
    encoding: "utf8",
  });
  assert.match(out, /us\.html/);
  assert.match(out, /zeno-engine\.js/);
  assert.ok(!out.includes("apps/core"), "exporter leaked apps/core");
  assert.ok(!out.includes("apps/rust"), "exporter leaked apps/rust");
  assert.ok(!out.includes(".pkpass"), "exporter leaked .pkpass");
  assert.ok(!out.includes("certs"), "exporter leaked certs");
});
