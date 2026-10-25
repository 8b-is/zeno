import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
const reader = readFileSync(
  join(here, "apps", "android", "app", "src", "main", "java", "dev", "vaked", "zeno", "transit", "PhysicalIcReader.kt"),
  "utf8",
);
const physicalCard = readFileSync(
  join(here, "apps", "android", "app", "src", "main", "java", "dev", "vaked", "zeno", "ui", "components", "PhysicalIcCard.kt"),
  "utf8",
);

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

test("physical IC reader pins the verified FeliCa wire protocol", () => {
  assert.ok(reader.includes("const val SYSTEM_CODE_JAPAN_IC = 0x0003"));
  assert.ok(reader.includes("NativeBridge.buildPollFrame"), "poll before read");
  assert.ok(reader.includes("TagLostException"), "must tolerate tag loss with partial results");
  assert.ok(reader.includes("readChunk(tag, idm, cursor, 1)"), "1-block fallback");
});

test("physical read is read-only and privacy-preserving in UI", () => {
  assert.ok(!reader.includes("writeWithoutEncryption"));
  assert.ok(physicalCard.includes("READ ONLY"));
  assert.ok(physicalCard.includes("read.idmHex.take(8)"), "IDm must be truncated");
  assert.ok(physicalCard.includes("保存・送信はしません"));
});

test("web note documents the physical read bridge", () => {
  assert.ok(indexHtml.includes("物理ICカードをお持ちの場合"));
  assert.ok(indexHtml.includes("0x090f"));
});

test("Kotlin is a thin NFC shell; Rust owns the protocol", () => {
  assert.ok(reader.includes("NativeBridge.buildReadFrame"));
  assert.ok(reader.includes("NativeBridge.parseHistoryJson"));
  assert.ok(!reader.includes("private fun parseHistory"), "Kotlin must not parse history");

  const rust = readFileSync(join(here, "apps", "rust", "zeno-native", "src", "felica.rs"), "utf8");
  assert.ok(rust.includes("pub const SYSTEM_CODE_JAPAN_IC: u16 = 0x0003"));
  assert.ok(rust.includes("pub const SERVICE_HISTORY: u16 = 0x090f"));
  assert.ok(rust.includes("resp.len().wrapping_sub(count * BLOCK_SIZE)"), "adaptive header offset");
  assert.ok(rust.includes("2000 + (date_raw >> 9)"), "7-bit year packing");
  assert.ok(existsSync(join(here, "apps", "android", "app", "src", "main", "jniLibs", "arm64-v8a", "libzeno_native.so")));
});

test("Zig verifier is the third independent implementation", () => {
  const zig = readFileSync(join(here, "tools", "zkp1_verify.zig"), "utf8");
  assert.ok(zig.includes("Sha256.hash"));
  assert.ok(zig.includes("savingsPercent"));
  assert.ok(zig.includes("sha256Sealed"));
});

test("worker serves the transit spec at /ic-card", async () => {
  const res = await worker.fetch(new Request("https://zeno.vaked.dev/ic-card"), {}, {});
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/markdown/);
  const text = await res.text();
  assert.match(text, /IC カード & Samsung Wallet 交通系カード/);
  assert.ok(text.includes("CONTACTLESS EMV READY"));
});
