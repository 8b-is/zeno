import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import worker from "./deploy/worker.js";

const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(here, "index.html"), "utf8");
const manifest = readFileSync(join(here, "apps", "android", "app", "src", "main", "AndroidManifest.xml"), "utf8");
const probe = readFileSync(
  join(here, "apps", "android", "app", "src", "main", "java", "dev", "vaked", "zeno", "transit", "TransitCapability.kt"),
  "utf8",
);
const card = readFileSync(
  join(here, "apps", "android", "app", "src", "main", "java", "dev", "vaked", "zeno", "ui", "components", "IcTransitCard.kt"),
  "utf8",
);
const spec = readFileSync(join(here, "spec", "TRANSIT_CARD_PROVISIONING.md"), "utf8");

test("probe keys on the two real Osaifu-Keitai signals, not vibes", () => {
  assert.ok(probe.includes('"android.hardware.nfc.felica"'), "must probe the Type-F feature");
  assert.ok(probe.includes('PACKAGE_MFC_CLIENT = "com.felicanetworks.mfc"'), "must probe the MFC client");
  assert.ok(probe.includes("osaifuKeitai: Boolean get() = hasFeliCaHardware && hasMfcClient"));
  assert.ok(probe.includes('hasNfc = pm.hasSystemFeature(PackageManager.FEATURE_NFC)'));
});

test("unsupported devices get a working route, not a dead end", () => {
  assert.ok(probe.includes("contactlessEmv: Boolean get() = hasNfc && (hasSamsungWallet || hasGoogleWallet)"));
  assert.ok(probe.includes("CONTACTLESS EMV READY"));
  assert.ok(card.includes("Samsung Wallet に銀行カードを追加 (改札タッチ)"));
  assert.ok(card.includes("ZENO QR で支払う (AEON Pay)"));
});

test("the app never claims it minted an IC card", () => {
  assert.ok(!card.includes("カードを追加しました"));
  assert.ok(probe.includes("NO OSAIFU-KEITAI"));
  assert.ok(spec.includes("Impossible"));
});

test("package visibility is declared so the probe cannot lie on API 30+", () => {
  for (const id of [
    "com.felicanetworks.mfc",
    "com.mobilepasmo.android",
    "com.jreast.mobile.suica",
    "com.samsung.android.spay",
    "com.google.android.apps.walletnfcrel",
  ]) {
    assert.ok(manifest.includes(`<package android:name="${id}" />`), `missing <queries> for ${id}`);
  }
});

test("web wallet modal carries the same disclosure", () => {
  assert.ok(indexHtml.includes('id="ic-wallet-note"'));
  assert.ok(indexHtml.includes("com.felicanetworks.mfc"));
  assert.ok(indexHtml.includes("コンタクトレス決済"));
  assert.ok(indexHtml.includes("Mobile PASMO"));
});

test("worker serves the transit spec at /ic-card", async () => {
  const res = await worker.fetch(new Request("https://zeno.vaked.dev/ic-card"), {}, {});
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/markdown/);
  const text = await res.text();
  assert.match(text, /IC カード & Samsung Wallet 交通系カード/);
  assert.ok(text.includes("CONTACTLESS EMV READY"));
});
