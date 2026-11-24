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

async function fetchWorker(path, init = {}, env = {}) {
  return worker.fetch(new Request("https://zeno.vaked.dev" + path, init), env, {});
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

  // Top 7 USDC+USDT network address validation & Tron USDC refusal
  const evmAddr = "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940";
  const tronAddr = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  assert.equal(Object.keys(ZenoEngine.STABLECOIN_NETWORKS).length, 7);
  for (const net of ["base", "ethereum", "arbitrum", "polygon", "optimism"]) {
    assert.equal(StablecoinReserveEngine.validateNetworkAddress(net, "USDC", evmAddr).network.id, net);
    assert.equal(StablecoinReserveEngine.validateNetworkAddress(net, "USDT", evmAddr).network.id, net);
  }
  assert.equal(StablecoinReserveEngine.validateNetworkAddress("solana", "USDC", coinbaseSolana).asset, "USDC");
  assert.equal(StablecoinReserveEngine.validateNetworkAddress("tron", "USDT", tronAddr).contract, tronAddr);
  assert.throws(() => StablecoinReserveEngine.validateNetworkAddress("tron", "USDC", tronAddr), /not supported/);

  // Subscriptions & automated trading usage monetization (Sanpo Yoshi 50/30/20 split)
  const sub = engine.subscribePlan("$you", "ultra_quant");
  assert.equal(sub.feeMicro, 49000000n);
  assert.equal(sub.split.familyTrustMicro, 14700000n);
  assert.equal(sub.split.fokenCommonsMicro, 9800000n);
  assert.equal(sub.split.operatingMicro, 24500000n);

  const usage = engine.billMeteredUsage("$you", "AUTO_TRADE_TICK", 5n, 2000n * MICRO_USD);
  assert.equal(usage.feeMicro, 2050000n); // 5 * $0.01 + 10 bps * $2,000 = $2.05
  const rev = engine.getRevenueSummary();
  assert.equal(rev.totalRevenueMicro, 51050000n);
  assert.equal(engine.verifyDoubleEntryAudit().valid, true);
  assert.equal(engine.verifyReserveParity().ratioPQ, "1/1");
});

test("Worker serves hardened /us CSP, 405/413 guards, safe icons, and Rust-only architecture", async () => {
  const usRes = await fetchWorker("/us");
  assert.equal(usRes.status, 200);
  const csp = usRes.headers.get("content-security-policy") || "";
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.ok(!csp.includes("'unsafe-eval'"), "JS unsafe-eval must remain forbidden");
  assert.match(csp, /style-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(usRes.headers.get("x-frame-options"), "DENY");
  assert.equal(usRes.headers.get("cross-origin-opener-policy"), "same-origin");

  for (const path of ["/us.css", "/us.js", "/rfc-008", "/solana-pipeline", "/monetization-spec", "/compliance-audit", "/rust-wasm-spec", "/licensing-boundary"]) {
    const res = await fetchWorker(path);
    assert.equal(res.status, 200, `${path} did not return 200`);
  }

  const wasmRes = await fetchWorker("/zeno-client.wasm");
  assert.equal(wasmRes.status, 200);
  assert.equal(wasmRes.headers.get("content-type"), "application/wasm");
  const wasmBytes = new Uint8Array(await wasmRes.arrayBuffer());
  assert.deepEqual(Array.from(wasmBytes.subarray(0, 4)), [0x00, 0x61, 0x73, 0x6d]);
  assert.equal(await fetchWorker("/zeno-client.wasm", { method: "POST" }).then((r) => r.status), 405);
  assert.equal(await fetchWorker("/rust-wasm-spec", { method: "POST" }).then((r) => r.status), 405);

  const compRes = await fetchWorker("/api/us/compliance");
  assert.equal(compRes.status, 200);
  const compDoc = await compRes.json();
  assert.equal(compDoc.formalCertification, false);
  assert.equal(compDoc.frameworks.gdpr.art17CryptoShredding, true);
  assert.equal(compDoc.frameworks.pciDssSaqA.rawPanHandled, false);
  assert.equal(compDoc.frameworks.owaspMasvsAndroid.usesCleartextTraffic, false);
  assert.equal(await fetchWorker("/api/us/compliance", { method: "POST" }).then((r) => r.status), 405);
  assert.equal(await fetchWorker("/compliance-audit", { method: "POST" }).then((r) => r.status), 405);

  const netsRes = await fetchWorker("/api/us/networks");
  assert.equal(netsRes.status, 200);
  const netsDoc = await netsRes.json();
  assert.equal(netsDoc.count, 7);
  assert.equal(netsDoc.networks.length, 7);
  assert.equal(await fetchWorker("/api/us/networks", { method: "POST" }).then((r) => r.status), 405);

  const pricingRes = await fetchWorker("/api/us/pricing");
  assert.equal(pricingRes.status, 200);
  const pricing = await pricingRes.json();
  assert.equal(pricing.plans.length, 4);
  assert.equal(pricing.sanpoYoshiRevenueSplitPQ.familyTrustUsdc, "3/10");
  assert.equal(await fetchWorker("/api/us/pricing", { method: "POST" }).then((r) => r.status), 405);

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

  // /api/us/checkout tests (Stripe unconfigured fail-closed, direct USDC Solana/Base, 405, 400, 413)
  assert.equal(await fetchWorker("/api/us/checkout", { method: "GET" }).then((r) => r.status), 405);
  const stripeUnconf = await fetchWorker("/api/us/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ planId: "ultra_quant", paymentRail: "stripe", cashtag: "$you" }),
  });
  assert.equal(stripeUnconf.status, 200);
  const stripeDoc = await stripeUnconf.json();
  assert.equal(stripeDoc.mode, "stripe_unconfigured");
  assert.deepEqual(stripeDoc.missingSecrets, ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ULTRA"]);

  const solCheckout = await fetchWorker(
    "/api/us/checkout",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId: "plus", paymentRail: "usdc_solana", cashtag: "$you" }),
    },
    { ZENO_TREASURY_SOLANA: "HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS" },
  );
  assert.equal(solCheckout.status, 200);
  const solCheckoutDoc = await solCheckout.json();
  assert.equal(solCheckoutDoc.mode, "usdc_solana_direct");
  assert.equal(solCheckoutDoc.amountExact, "9.99");
  assert.ok(solCheckoutDoc.paymentUri.startsWith("solana:HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS?amount=9.99"));

  const baseCheckout = await fetchWorker(
    "/api/us/checkout",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId: "institutional", paymentRail: "usdc_base", cashtag: "$you" }),
    },
    { ZENO_TREASURY_EVM: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940" },
  );
  assert.equal(baseCheckout.status, 200);
  const baseCheckoutDoc = await baseCheckout.json();
  assert.equal(baseCheckoutDoc.mode, "usdc_base_direct");
  assert.equal(baseCheckoutDoc.chainId, 8453);
  assert.ok(baseCheckoutDoc.paymentUri.includes("uint256=199000000"));

  assert.equal(
    await fetchWorker("/api/us/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId: "bad", paymentRail: "stripe" }),
    }).then((r) => r.status),
    400,
  );
  assert.equal(
    await fetchWorker("/api/us/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pad: "a".repeat(9000) }),
    }).then((r) => r.status),
    413,
  );

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
  assert.equal(arch.clientRuntime, "rust-wasm-no-std+safe-isomorphic-js");
  assert.equal(arch.wasmClientActive, true);
  assert.equal(arch.wasmClientPath, "/zeno-client.wasm");
  assert.equal(arch.asmKernelCrate, "apps/rust/zeno-asm");
  assert.equal(arch.clientLicense, "MIT");
  assert.equal(arch.coreLicense, "PROPRIETARY_PRIVATE");
  assert.equal(arch.zeroTelemetry, true);
  assert.equal(arch.fokenGate, true);
  assert.deepEqual(arch.domains, ["zeno.vaked.dev", "zeno.8b.is"]);
  assert.deepEqual(arch.privateCoreModules, ["apps/rust/zeno-us-core", "apps/rust/zeno-issuer-angel", "apps/rust/zeno-asm"]);

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
  assert.match(out, /zeno-client\.wasm/);
  assert.match(out, /RUST_ASM_WASM_ARCHITECTURE\.md/);
  assert.ok(!out.includes("apps/core"), "exporter leaked apps/core");
  assert.ok(!out.includes("apps/rust"), "exporter leaked apps/rust");
  assert.ok(!out.includes(".pkpass"), "exporter leaked .pkpass");
  assert.ok(!out.includes("certs"), "exporter leaked certs");
});

test("Client-side Rust WASM module (zeno-client.wasm) matches BigInt engine parity and bounds guards", async () => {
  const bytes = readFileSync(join(here, "zeno-client.wasm"));
  assert.ok(bytes.length < 32768, `WASM binary too large: ${bytes.length} bytes`);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const ex = instance.exports;

  assert.equal(ex.zeno_wasm_version(), 1120);
  const scratchPtr = ex.zeno_scratch_ptr();
  const scratchLen = ex.zeno_scratch_len();
  assert.equal(scratchLen, 1024);

  const memView = new Uint8Array(ex.memory.buffer, scratchPtr, scratchLen);
  const write = (offset, data) => {
    const src = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    memView.set(src, offset);
    return src.length;
  };

  assert.equal(ex.zeno_gcd_u64(305n, 2n), 1n);
  assert.equal(ex.zeno_gcd_u64(52040500000n, 52040500000n), 52040500000n);

  // Exact FX parity with StablecoinReserveEngine.convertFx
  assert.equal(
    ex.zeno_fx_convert_micro(100n * MICRO_USD, 1),
    StablecoinReserveEngine.convertFx(100n * MICRO_USD, "JPY").amountMicroOut,
  );
  assert.equal(
    ex.zeno_fx_convert_micro(100n * MICRO_USD, 2),
    StablecoinReserveEngine.convertFx(100n * MICRO_USD, "EUR").amountMicroOut,
  );
  assert.equal(
    ex.zeno_fx_convert_micro(100n * MICRO_USD, 3),
    StablecoinReserveEngine.convertFx(100n * MICRO_USD, "GBP").amountMicroOut,
  );
  assert.equal(
    ex.zeno_fx_convert_micro(100n * MICRO_USD, 4),
    StablecoinReserveEngine.convertFx(100n * MICRO_USD, "HUF").amountMicroOut,
  );

  // Sanpo Yoshi exact zero-sum 50/30/20
  const fee = 49000000n;
  const fam = ex.zeno_sanpo_yoshi_family(fee);
  const fok = ex.zeno_sanpo_yoshi_foken(fee);
  const ops = ex.zeno_sanpo_yoshi_operating(fee);
  assert.equal(fam, 14700000n);
  assert.equal(fok, 9800000n);
  assert.equal(ops, 24500000n);
  assert.equal(fam + fok + ops, fee);

  // FOKEN net utility milli-hours
  assert.equal(ex.zeno_foken_net_milli_hours(100000n, 10000n, 2000n), 87000n);

  // Solana Base58 validation
  const goodLen = write(0, "HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS");
  assert.equal(ex.zeno_validate_solana_b58(0, goodLen), 1);
  const badLen = write(64, "0OIlHpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkb");
  assert.equal(ex.zeno_validate_solana_b58(64, badLen), 0);
  const zeroLen = write(128, "11111111111111111111111111111111");
  assert.equal(ex.zeno_validate_solana_b58(128, zeroLen), 0);

  // WUPZ XOR-fold, popcount & constant-time compare + OOB guards
  const d = new Uint8Array(32).fill(0x55);
  write(256, d);
  write(320, d);
  assert.equal(ex.zeno_wupz_popcount(256, 32), 128);
  assert.equal(ex.zeno_ct_eq_32(256, 320), 1);
  d[15] ^= 0x80;
  write(320, d);
  assert.equal(ex.zeno_ct_eq_32(256, 320), 0);
  assert.equal(ex.zeno_ct_eq_32(1000, 0), -1);
  assert.equal(ex.zeno_wupz_xor_fold(1020, 16), 0n);
});
