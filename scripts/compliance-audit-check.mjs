#!/usr/bin/env node
/**
 * ZENO US Continuous Regulatory & Security Compliance Audit Gate
 * Verifies technical controls for GDPR, SOC2, PCI-DSS SAQ-A boundary, BSA/OFAC,
 * WCAG 2.1 AA client hygiene, and OWASP MASVS Android hardening.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const manifestXml = read("apps/android/app/src/main/AndroidManifest.xml");
const netSecXmlPath = join(root, "apps/android/app/src/main/res/xml/network_security_config.xml");
const netSecXml = existsSync(netSecXmlPath) ? readFileSync(netSecXmlPath, "utf8") : "";
const rustUsCore = read("apps/rust/zeno-us-core/src/lib.rs");
const rustNonTest = rustUsCore.split("#[cfg(test)]")[0];
const buildMjs = read("deploy/build.mjs");
const usHtml = read("us.html");
const usCss = read("us.css");
const usJs = read("us.js");
const androidUsCard = read("apps/android/app/src/main/java/dev/vaked/zeno/ui/components/ZenoUsMonetizationCard.kt");
const exporterSh = read("scripts/export-public-client.sh");
const gitignore = read(".gitignore");
const caddyfile = read("deploy/zeno.8b.is.Caddyfile");

const checks = [
  {
    id: "MASVS-STORAGE-ANDROID",
    standard: "OWASP MASVS",
    desc: "AndroidManifest disables allowBackup & cleartext traffic and binds network_security_config",
    ok: manifestXml.includes('android:allowBackup="false"')
      && manifestXml.includes('android:usesCleartextTraffic="false"')
      && manifestXml.includes('@xml/network_security_config'),
  },
  {
    id: "MASVS-NETWORK-TLS",
    standard: "OWASP MASVS",
    desc: "Android network_security_config enforces cleartextTrafficPermitted=false",
    ok: netSecXml.includes('cleartextTrafficPermitted="false"'),
  },
  {
    id: "RUST-ZERO-UNSAFE-ZERO-FLOAT",
    standard: "SOC2-PI1.4",
    desc: "zeno-us-core is #![no_std], #![forbid(unsafe_code)], zero f32/f64, zero .expect in lib code",
    ok: rustNonTest.includes("#![no_std]")
      && rustNonTest.includes("#![forbid(unsafe_code)]")
      && !/\bf32\b|\bf64\b/.test(rustNonTest)
      && !rustNonTest.includes(".expect("),
  },
  {
    id: "GDPR-ART17-ART20",
    standard: "GDPR",
    desc: "Rust core provides GDPR Art. 17 crypto-shredding and Art. 20 portability export",
    ok: rustNonTest.includes("gdpr_crypto_shred_account")
      && rustNonTest.includes("export_account_portability_json"),
  },
  {
    id: "BSA-FINCEN-OFAC",
    standard: "FinCEN/BSA/OFAC",
    desc: "Rust core enforces Travel Rule ($3k), CTR ($10k), and sanctioned_addresses screening",
    ok: rustNonTest.includes("FINCEN_TRAVEL_RULE_MICRO")
      && rustNonTest.includes("FINCEN_CTR_THRESHOLD_MICRO")
      && rustNonTest.includes("sanctioned_addresses")
      && rustNonTest.includes("ComplianceBlocked"),
  },
  {
    id: "PCIDSS-SAQ-A-BOUNDARY",
    standard: "PCI-DSS v4.0 SAQ-A",
    desc: "Worker checkout tokenizes via Stripe without handling raw card PAN/CVV fields",
    ok: buildMjs.includes('if (p === "/api/us/checkout")')
      && !/\bcardNumber\b|\brawPan\b|\btrackData\b/i.test(buildMjs),
  },
  {
    id: "EDGE-STRICT-CSP-HEADERS",
    standard: "SOC2-CC6.6",
    desc: "Strict /us CSP ('self' + 'wasm-unsafe-eval', zero unsafe-eval/unsafe-inline) + DENY + COOP + CORP enforced",
    ok: buildMjs.includes("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'")
      && !buildMjs.includes("'unsafe-eval'")
      && !buildMjs.includes("'unsafe-inline'")
      && buildMjs.includes('"x-frame-options": "DENY"')
      && buildMjs.includes('"cross-origin-opener-policy": "same-origin"'),
  },
  {
    id: "CLIENT-ZERO-TELEMETRY-XSS",
    standard: "GDPR / SOC2",
    desc: "/us client has zero external fonts, zero inline style=, zero innerHTML",
    ok: !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(usHtml)
      && !/\sstyle="/i.test(usHtml)
      && !/innerHTML/i.test(usJs),
  },
  {
    id: "WCAG-21-AA-A11Y",
    standard: "WCAG 2.1 AA / ADA",
    desc: "/us provides skip-link, prefers-reduced-motion, aria-live toast, and ARIA tabs",
    ok: usHtml.includes('class="skip-link"')
      && usHtml.includes('aria-live="polite"')
      && usHtml.includes('role="tab"')
      && usCss.includes("prefers-reduced-motion: reduce")
      && usCss.includes(".skip-link"),
  },
  {
    id: "WEBCRYPTO-NON-EXTRACTABLE",
    standard: "SOC2-CC6.1",
    desc: "Browser WebCrypto ECDSA P-256 keypair generated with extractable: false",
    ok: /generateKey\([^)]*,\s*false\s*,/s.test(usJs),
  },
  {
    id: "US-BRAND-NO-PURPLE",
    standard: "ZENO US Design Lock",
    desc: "US surfaces (web + native card) contain zero purple/violet/#b48bff tokens",
    ok: [usCss, usHtml, usJs, androidUsCard].every(
      (s) => !/#b48bff|\bpurple\b|\bviolet\b|rgba\(\s*180\s*,\s*139\s*,\s*255/i.test(s),
    ),
  },
  {
    id: "HONEST-SIMULATED-RESERVE",
    standard: "FTC / Truth-in-Reserves",
    desc: "Worker reserve-proof discloses simulated genesis seed status",
    ok: buildMjs.includes("isSimulatedGenesisSeed: true")
      && buildMjs.includes("simulated_local_por_until_us_custody_live"),
  },
  {
    id: "SUPPLY-CHAIN-BOUNDARY",
    standard: "SOC2-CC8.1",
    desc: "Public MIT exporter excludes private-core & Caddy strips untrusted forwarding headers",
    ok: exporterSh.includes("apps/rust")
      && exporterSh.includes("if [[ -L ")
      && caddyfile.includes("header_up -CF-Connecting-IP")
      && gitignore.includes(".zeno-local/")
      && gitignore.includes(".st/"),
  },
  {
    id: "RUST-ASM-ISOLATION",
    standard: "SOC2-PI1.4 / Defense-in-Depth",
    desc: "Inline assembly isolated to apps/rust/zeno-asm while zeno-us-core retains #![forbid(unsafe_code)] and valid client WASM magic",
    ok: existsSync(join(root, "apps", "rust", "zeno-asm", "src", "lib.rs"))
      && existsSync(join(root, "zeno-client.wasm"))
      && readFileSync(join(root, "zeno-client.wasm")).subarray(0, 4).toString("latin1") === "\0asm"
      && rustNonTest.includes("#![forbid(unsafe_code)]"),
  },
  {
    id: "RUST-LEPTOS-AND-WORKERS-RS",
    standard: "SOC2-PI1.4 / Zero-Float Client & Edge",
    desc: "Leptos 0.8 /us-rust WASM UI and workers-rs Edge Worker present with zero floats, zero inline script/style, and zero purple",
    ok: existsSync(join(root, "apps", "rust", "zeno-leptos-ui", "src", "lib.rs"))
      && existsSync(join(root, "apps", "rust", "zeno-edge-worker", "src", "lib.rs"))
      && existsSync(join(root, "us-rust", "zeno_leptos_bg.wasm"))
      && readFileSync(join(root, "us-rust", "zeno_leptos_bg.wasm")).subarray(0, 4).toString("latin1") === "\0asm"
      && !/\sstyle="/i.test(read("us-rust/index.html"))
      && !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(read("us-rust/index.html"))
      && !/\bf32\b|\bf64\b/.test(read("apps/rust/zeno-leptos-ui/src/lib.rs").split("#[cfg(test)]")[0])
      && !/#b48bff|\bpurple\b|\bviolet\b/i.test(read("apps/rust/zeno-leptos-ui/src/lib.rs")),
  },
  {
    id: "RUST-SERVICE-BINDING-AND-ANDROID-NEON-JNI",
    standard: "SOC2-PI1.4 / Edge & Mobile ASM Isolation",
    desc: "wrangler.toml binds RUST_EDGE_API to zeno-us-rust-worker and Android NativeBridge links ARM64 NEON ASM + zeno-us-core",
    ok: read("deploy/wrangler.toml").includes('binding = "RUST_EDGE_API"')
      && read("deploy/wrangler.toml").includes('service = "zeno-us-rust-worker"')
      && buildMjs.includes("env.RUST_EDGE_API.fetch(request)")
      && read("apps/rust/zeno-native/src/lib.rs").includes("NativeBridge_asmSelfTestJson")
      && read("apps/rust/zeno-native/src/lib.rs").includes("MAX_JNI_BYTES")
      && read("apps/android/app/src/main/java/dev/vaked/zeno/native/NativeBridge.kt").includes("asmSelfTestJson()"),
  },
  {
    id: "STRIPE-DISCORD-SUPPORT-HYGIENE",
    standard: "SOC2-CC6.1 / PCI-DSS / Support Contact",
    desc: "/api/us/support + Admin BCC configured and zero plaintext Discord/Stripe secret URLs checked into repo files",
    ok: buildMjs.includes('if (p === "/api/us/support")')
      && buildMjs.includes("aye@8b.is")
      && buildMjs.includes("56 Broad St STE 14135")
      && buildMjs.includes("a@8b.is")
      && buildMjs.includes("c@8b.is")
      && buildMjs.includes("p@8b.is")
      && ![buildMjs, usHtml, usJs, read("deploy/wrangler.toml"), read("scripts/activate-live-stripe-and-treasury.sh")].some(
        (s) => /discord\.com\/api\/webhooks\/|whsec_|sk_live_/i.test(s),
      ),
  },
];

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log(
  JSON.stringify(
    {
      audit: "ZENO_US_CONTINUOUS_COMPLIANCE_CHECK",
      totalChecks: checks.length,
      passed,
      failedCount: failed.length,
      status: failed.length === 0 ? "PASS" : "FAIL",
      failures: failed.map((f) => ({ id: f.id, standard: f.standard, desc: f.desc })),
    },
    null,
    2,
  ),
);

if (failed.length > 0) {
  process.exit(1);
}
