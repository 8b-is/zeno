#!/usr/bin/env node
/**
 * ZENO Local Off-Chain FOKEN Proof-of-Contribution Minter
 *
 * Evaluates registered Constellation work items (`constellation.json`) and any local
 * FOKEN invoice (`../foken/live_omni_invoice.json`) using exact integer p/q rational math
 * (`ZenoEngine.StablecoinReserveEngine.evaluateFokenGatePQ`), and appends idempotent,
 * 0x62 hash-chained off-chain contribution credits to `.zeno-local/foken-mint-ledger.json`.
 *
 * IMPORTANT: Strictly OFF-CHAIN contribution accounting (`isOnChainUsdc: false`).
 * Never mints unbacked on-chain USDC/USDT without funded custody.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ZenoEngine from "../zeno-engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const stateDir = join(root, ".zeno-local");
const ledgerPath = join(stateDir, "foken-mint-ledger.json");

const { StablecoinReserveEngine } = ZenoEngine;

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function deterministicUuidV7Like(id) {
  const h = sha256Hex(`ZENO:FOKEN:CONSTELLATION:V1:${id}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-7${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function buildConstellationInvoices() {
  const doc = JSON.parse(readFileSync(join(root, "constellation.json"), "utf8"));
  const invoices = [];
  for (const project of doc.projects || []) {
    const f = project.foken || {};
    const halfNum = 2 * Number(f.futureWorkAvoidedHours || 0) -
      (2 * Number(f.workAddedHours || 0) + 3 * Number(f.maintenanceDebtHours || 0));
    if (!Number.isSafeInteger(halfNum) || halfNum <= 0) continue;
    // Mint conservatively at 25 FKN per net-utility hour (well within the 100 FKN/hr ceiling)
    const conservativeFokens = Math.min(250000, Math.max(1, Math.floor((halfNum * 25) / 2)));
    const provDigest = sha256Hex(`constellation:${project.id}:${project.url}:${halfNum}`);
    const sigDigest = sha256Hex(`ip:${project.id}:IRREVOCABLE_ASSIGNMENT`);
    invoices.push({
      invoiceId: deterministicUuidV7Like(project.id),
      version: 1,
      contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
      work: {
        title: `${project.name} (${project.id})`,
        repo: project.url,
      },
      artifact: {
        provenanceHash: `sha256://${provDigest}`,
      },
      valuation: {
        selfAssessedFokens: conservativeFokens,
      },
      ipAssignment: {
        statement: "IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
        signature: `0x${sigDigest}`,
      },
      netUtility: {
        futureWorkAvoidedHours: Number(f.futureWorkAvoidedHours),
        workAddedHours: Number(f.workAddedHours),
        maintenanceDebtHours: Number(f.maintenanceDebtHours),
      },
    });
  }

  const liveOmniPath = join(root, "..", "foken", "live_omni_invoice.json");
  if (existsSync(liveOmniPath)) {
    invoices.push(JSON.parse(readFileSync(liveOmniPath, "utf8")));
  }
  return invoices;
}

function parseNetHoursNumDen(pqStr) {
  const [n, d] = String(pqStr).split("/");
  return { num: BigInt(n), den: BigInt(d || "1") };
}

function loadLedger() {
  if (!existsSync(ledgerPath)) {
    return {
      surface: "ZENO Off-Chain Local FOKEN Minter",
      settlementMode: "OFF_CHAIN_LOCAL_FOKEN_CONTRIBUTION_LEDGER",
      isOnChainUsdc: false,
      gate: "0x62",
      chainHead: `0x62${"0".repeat(64)}`,
      entries: [],
    };
  }
  return JSON.parse(readFileSync(ledgerPath, "utf8"));
}

function main() {
  mkdirSync(stateDir, { recursive: true });
  const ledger = loadLedger();
  const seen = new Set(ledger.entries.map((e) => e.invoiceId));
  const invoices = buildConstellationInvoices();

  let newlyMintedCount = 0;
  let newlyMintedFokens = 0;

  for (const inv of invoices) {
    if (seen.has(inv.invoiceId)) continue;
    const gate = StablecoinReserveEngine.evaluateFokenGatePQ(inv);
    if (gate.verdict !== "PASS") continue;

    const seq = ledger.entries.length + 1;
    const frame = `ZENO:FOKEN:LOCAL:V1:0x62:${seq}:${ledger.chainHead}:${inv.invoiceId}:${gate.fokensAwarded}:${gate.netUtilityPQ}`;
    const nextSeal = `0x62${sha256Hex(frame)}`;
    ledger.chainHead = nextSeal;
    ledger.entries.push({
      seq,
      invoiceId: inv.invoiceId,
      title: inv.work?.title || inv.invoiceId,
      fokensAwarded: gate.fokensAwarded,
      netUtilityPQ: gate.netUtilityPQ,
      trit: gate.trit,
      provenanceHash: inv.artifact.provenanceHash,
      seal: nextSeal,
      mintedAt: new Date().toISOString(),
    });
    seen.add(inv.invoiceId);
    newlyMintedCount += 1;
    newlyMintedFokens += gate.fokensAwarded;
  }

  let totalFokensMinted = 0;
  let sumNum = 0n;
  for (const entry of ledger.entries) {
    totalFokensMinted += Number(entry.fokensAwarded || 0);
    const { num, den } = parseNetHoursNumDen(entry.netUtilityPQ);
    // Normalize to half-hours (den is 1 or 2)
    sumNum += den === 1n ? num * 2n : num;
  }
  const totalNetUtilityHours = Number(sumNum) / 2;

  ledger.updatedAt = new Date().toISOString();
  ledger.totalMintedEntries = ledger.entries.length;
  ledger.totalFokensMinted = totalFokensMinted;
  ledger.totalNetUtilityHours = totalNetUtilityHours;

  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");

  console.log(
    JSON.stringify(
      {
        settlementMode: ledger.settlementMode,
        isOnChainUsdc: ledger.isOnChainUsdc,
        newlyMintedCount,
        newlyMintedFokens,
        totalMintedEntries: ledger.totalMintedEntries,
        totalFokensMinted: ledger.totalFokensMinted,
        totalNetUtilityHours: ledger.totalNetUtilityHours,
        chainHead: ledger.chainHead,
        ledgerPath,
      },
      null,
      2,
    ),
  );
}

main();
