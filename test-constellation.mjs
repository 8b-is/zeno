import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import worker from "./deploy/worker.js";

const here = dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(join(here, "constellation.json"), "utf8"));
const indexHtml = readFileSync(join(here, "index.html"), "utf8");
const workerSrc = readFileSync(join(here, "deploy", "worker.js"), "utf8");
const iosModel = readFileSync(
  join(here, "apps", "ios", "Sources", "ZenoApp", "Models", "Constellation.swift"),
  "utf8",
);
const androidModel = readFileSync(
  join(here, "apps", "android", "app", "src", "main", "java", "dev", "vaked", "zeno", "constellation", "Constellation.kt"),
  "utf8",
);

async function get(path) {
  const res = await worker.fetch(new Request("https://zeno.vaked.dev" + path), {}, {});
  return { res, body: await res.json() };
}

function netHours(foken) {
  return Number(
    (foken.futureWorkAvoidedHours - (foken.workAddedHours + 1.5 * foken.maintenanceDebtHours)).toFixed(3),
  );
}

test("registry is well-formed and every project link is https", () => {
  assert.ok(Array.isArray(registry.projects));
  assert.ok(registry.projects.length >= 10);

  const ids = new Set();
  for (const project of registry.projects) {
    assert.match(project.id, /^[a-z0-9-]+$/, `bad id: ${project.id}`);
    assert.ok(!ids.has(project.id), `duplicate id: ${project.id}`);
    ids.add(project.id);
    assert.ok([-1, 0, 1].includes(project.trit), `bad trit: ${project.id}`);
    assert.match(project.url, /^https:\/\//, `non-https url: ${project.id}`);
    assert.ok(project.name && project.lane && project.role, `incomplete: ${project.id}`);
  }
});

test("Foken gate is net-positive for every registered project", () => {
  for (const project of registry.projects) {
    assert.ok(
      netHours(project.foken) > 0,
      `${project.id} is not net-positive: ${netHours(project.foken)}`,
    );
  }
});

test("registry totals match the arithmetic", () => {
  const total = registry.projects.reduce((sum, p) => sum + netHours(p.foken), 0);
  assert.equal(Number(total.toFixed(3)), 2330);
  assert.equal(registry.projects.filter((p) => p.trit === 1).length, 14);
  assert.equal(registry.projects.filter((p) => p.trit === 0).length, 4);
  assert.equal(registry.projects.filter((p) => p.trit === -1).length, 0);
});

test("ZKP1 receipt matches the sealed container arithmetic", () => {
  assert.equal(registry.packs.length, 1);
  const pack = registry.packs[0];
  assert.equal(pack.blocks, 7);
  assert.equal(pack.rawBytes, 11108);
  assert.equal(pack.sealedBytes, 5448);

  const savings = (1 - pack.sealedBytes / pack.rawBytes) * 100;
  assert.ok(Math.abs(savings - pack.savingsPercent) < 0.01, `savings drift: ${savings}`);

  assert.match(pack.sha256Raw, /^[0-9a-f]{64}$/);
  assert.match(pack.sha256Sealed, /^[0-9a-f]{64}$/);
  assert.match(pack.wupzFold, /^0x[0-9a-f]{16}$/);
  assert.equal(pack.sha256Sealed, "8fb9cc110652cf07f75afb2609ea82f834a3a106f53a8de7596b24309549f7f0");
});

test("landing page renders every project and links the canonical pack", () => {
  for (const project of registry.projects) {
    assert.ok(
      indexHtml.includes(`data-constellation-id="${project.id}"`),
      `landing page missing ${project.id}`,
    );
    assert.ok(indexHtml.includes(`href="${project.url}"`), `landing page missing url for ${project.id}`);
  }
  assert.ok(indexHtml.includes(`href="${registry.packs[0].containerUrl}"`));
  assert.ok(indexHtml.includes(`href="${registry.packs[0].companionUrl}"`));
  assert.ok(indexHtml.includes('data-tab="constellation"'));
});

test("worker serves /api/constellation with computed netHours", async () => {
  const { res, body } = await get("/api/constellation");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/json/);
  assert.equal(body.projects.length, registry.projects.length);
  assert.equal(body.totals.netHours, 2330);

  for (const project of body.projects) {
    assert.equal(project.netHours, netHours(project.foken), `netHours mismatch: ${project.id}`);
  }
});

test("worker serves /api/kompress with the sealed receipt", async () => {
  const { res, body } = await get("/api/kompress");
  assert.equal(res.status, 200);
  assert.equal(body.packs.length, 1);
  assert.equal(body.packs[0].sha256Sealed, registry.packs[0].sha256Sealed);
  assert.deepEqual(body.totals, { packs: 1, sealedBytes: 5448 });
});

test("worker serves the RFC-007 spec at /rfc-007", async () => {
  const res = await worker.fetch(new Request("https://zeno.vaked.dev/rfc-007"), {}, {});
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/markdown/);
  const text = await res.text();
  assert.match(text, /Constellation & KOMRESS-ULTRA ZKP1 Wiring/);
  assert.ok(text.includes("8fb9cc110652cf07f75afb2609ea82f834a3a106f53a8de7596b24309549f7f0"));
});

test("generated worker embeds the registry and both routes", () => {
  assert.ok(workerSrc.includes("const CONSTELLATION_JSON ="), "registry not embedded");
  assert.ok(workerSrc.includes('p === "/api/constellation"'));
  assert.ok(workerSrc.includes('p === "/api/kompress"'));
});

test("mobile scaffolds ship the same registry ids in their offline fallbacks", () => {
  for (const id of [
    "sovereign-library",
    "kompress-ultra",
    "fandom-mcp",
    "pocoo",
    "zeno",
    "aurora",
    "alexiai",
    "wupz",
    "zen-ultra-cooker",
    "go-setup",
    "peter-applications",
    "zoneinn-bonfire",
  ]) {
    assert.ok(iosModel.includes(`id: "${id}"`), `iOS fallback missing ${id}`);
    assert.ok(androidModel.includes(`"${id}"`), `Android fallback missing ${id}`);
  }
  assert.ok(iosModel.includes("8fb9cc110652cf07f75afb2609ea82f834a3a106f53a8de7596b24309549f7f0"));
  assert.ok(androidModel.includes("0x44dcbd34fd19d0b1"));
});
