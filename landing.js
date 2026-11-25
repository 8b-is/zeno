/**
 * ZENO Zen Landing & ELI5 Guide Runtime (MIT Safe Client)
 * Safe DOM createElement/textContent only, zero trackers, exact micro-USD BigInt & /zeno-client.wasm math.
 */
(function () {
  "use strict";

  const MICRO_USD = 1000000n;
  const WASM_FX_ID = Object.freeze({ USD: 0, JPY: 1, EUR: 2, GBP: 3, HUF: 4 });
  const FX_RATES = Object.freeze({
    JPY: { symbol: "¥", num: 305n, den: 2n },
    EUR: { symbol: "€", num: 23n, den: 25n },
    GBP: { symbol: "£", num: 79n, den: 100n },
    HUF: { symbol: "Ft ", num: 737n, den: 2n },
  });

  let wasmExports = null;

  function parseUsdToMicro(raw) {
    const cleaned = String(raw || "").trim().replace(/^\$/, "").replace(/,/g, "");
    if (!cleaned || cleaned.startsWith("-")) return null;
    if (!/^\d+(\.\d{1,6})?$/.test(cleaned)) return null;
    const parts = cleaned.split(".");
    const whole = BigInt(parts[0]);
    const frac = BigInt((parts[1] || "").padEnd(6, "0"));
    const total = whole * MICRO_USD + frac;
    return total > 0n ? total : null;
  }

  function formatMicroCurrency(micro, symbol) {
    const roundedCents = micro / 10000n;
    const whole = roundedCents / 100n;
    const cents = roundedCents % 100n;
    const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${symbol}${wholeStr}.${cents.toString().padStart(2, "0")}`;
  }

  function computeSanpoYoshiSplit(totalMicro) {
    if (wasmExports && typeof wasmExports.zeno_sanpo_yoshi_family === "function") {
      const fam = BigInt(wasmExports.zeno_sanpo_yoshi_family(totalMicro));
      const fok = BigInt(wasmExports.zeno_sanpo_yoshi_foken(totalMicro));
      const ops = BigInt(wasmExports.zeno_sanpo_yoshi_operating(totalMicro));
      return { ops, fam, fok };
    }
    if (window.ZenoEngine && window.ZenoEngine.StablecoinReserveEngine) {
      const s = window.ZenoEngine.StablecoinReserveEngine.splitSanpoYoshiRevenue(totalMicro);
      return { ops: s.operatingMicro, fam: s.familyTrustMicro, fok: s.fokenCommonsMicro };
    }
    const fam = (totalMicro * 3n) / 10n;
    const fok = (totalMicro * 2n) / 10n;
    const ops = totalMicro - fam - fok;
    return { ops, fam, fok };
  }

  function computeFxOut(usdMicro, currency) {
    const cid = WASM_FX_ID[currency] ?? 1;
    const meta = FX_RATES[currency] || FX_RATES.JPY;
    if (wasmExports && typeof wasmExports.zeno_fx_convert_micro === "function") {
      const outMicro = BigInt(wasmExports.zeno_fx_convert_micro(usdMicro, cid));
      return formatMicroCurrency(outMicro, meta.symbol);
    }
    if (window.ZenoEngine && window.ZenoEngine.StablecoinReserveEngine) {
      const res = window.ZenoEngine.StablecoinReserveEngine.convertFx(usdMicro, currency);
      return formatMicroCurrency(res.amountMicroOut, meta.symbol);
    }
    const outMicro = (usdMicro * meta.num) / meta.den;
    return formatMicroCurrency(outMicro, meta.symbol);
  }

  function updatePlayground() {
    const usdInput = document.getElementById("pg-usd-input");
    const curSelect = document.getElementById("pg-currency");
    const fxOutEl = document.getElementById("pg-fx-out");
    const opsEl = document.getElementById("pg-ops-out");
    const famEl = document.getElementById("pg-fam-out");
    const fokEl = document.getElementById("pg-foken-out");
    if (!usdInput || !curSelect || !fxOutEl || !opsEl || !famEl || !fokEl) return;

    const usdMicro = parseUsdToMicro(usdInput.value);
    if (!usdMicro) {
      fxOutEl.textContent = "Enter valid USD";
      opsEl.textContent = "—";
      famEl.textContent = "—";
      fokEl.textContent = "—";
      return;
    }

    const currency = curSelect.value || "JPY";
    fxOutEl.textContent = computeFxOut(usdMicro, currency);
    const split = computeSanpoYoshiSplit(usdMicro);
    opsEl.textContent = formatMicroCurrency(split.ops, "$");
    famEl.textContent = formatMicroCurrency(split.fam, "$");
    fokEl.textContent = formatMicroCurrency(split.fok, "$");
  }

  async function initWasm() {
    const badge = document.getElementById("pg-runtime-badge");
    if (typeof WebAssembly !== "object") {
      if (badge) badge.textContent = "BigInt JS Exact Mode";
      return;
    }
    try {
      let instance;
      if (typeof WebAssembly.instantiateStreaming === "function") {
        try {
          instance = (await WebAssembly.instantiateStreaming(fetch("/zeno-client.wasm"), {})).instance;
        } catch {
          const resp = await fetch("/zeno-client.wasm");
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          instance = (await WebAssembly.instantiate(await resp.arrayBuffer(), {})).instance;
        }
      } else {
        const resp = await fetch("/zeno-client.wasm");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        instance = (await WebAssembly.instantiate(await resp.arrayBuffer(), {})).instance;
      }
      wasmExports = instance.exports;
      const ver = Number(wasmExports.zeno_wasm_version());
      if (badge) badge.textContent = `🦀 Rust WASM v${ver} Active · Exact p/q`;
      updatePlayground();
    } catch {
      if (badge) badge.textContent = "BigInt JS Exact Fallback";
    }
  }

  async function loadBillingReadiness() {
    const row = document.getElementById("pg-readiness-row");
    if (!row) return;
    try {
      const resp = await fetch("/api/us/support");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const doc = await resp.json();
      const b = doc.billingReadiness || {};
      const items = [
        { label: "Stripe Payment Links", live: Boolean(b.stripePaymentLinksLive) },
        { label: "Solana USDC Treasury", live: Boolean(b.solanaDirectLive) },
        { label: "Discord Alerts", live: Boolean(b.discordAlertsLive) },
        { label: "Stripe Webhook", live: Boolean(b.stripeWebhookLive) },
      ];
      row.textContent = "";
      for (const item of items) {
        const pill = document.createElement("span");
        pill.className = item.live ? "por-pill" : "btn-pill";
        pill.textContent = `${item.live ? "●" : "○"} ${item.label}: ${item.live ? "LIVE" : "READY"}`;
        row.appendChild(pill);
      }
    } catch {
      row.textContent = "";
      const pill = document.createElement("span");
      pill.className = "btn-pill";
      pill.textContent = "Local offline math mode active";
      row.appendChild(pill);
    }
  }

  function wireSoundButton() {
    const btn = document.getElementById("btn-zen-sound");
    if (!btn) return;
    const syncLabel = () => {
      const muted = Boolean(window.zenoAudio && window.zenoAudio.muted);
      btn.textContent = muted ? "🔕 Sound Off" : "🔔 Bell Sound On";
    };
    syncLabel();
    btn.addEventListener("click", () => {
      if (window.zenoAudio && typeof window.zenoAudio.toggleMute === "function") {
        const muted = window.zenoAudio.toggleMute();
        if (!muted && typeof window.zenoAudio.playBell === "function") {
          window.zenoAudio.playBell();
        }
      }
      syncLabel();
    });
  }

  function wirePlayground() {
    const usdInput = document.getElementById("pg-usd-input");
    const curSelect = document.getElementById("pg-currency");
    if (usdInput) usdInput.addEventListener("input", updatePlayground);
    if (curSelect) curSelect.addEventListener("change", updatePlayground);
    document.querySelectorAll(".pg-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (usdInput) usdInput.value = btn.getAttribute("data-usd") || "49.00";
        updatePlayground();
        if (window.zenoAudio && !window.zenoAudio.muted && typeof window.zenoAudio.playShishiOdoshi === "function") {
          window.zenoAudio.playShishiOdoshi();
        }
      });
    });
    updatePlayground();
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireSoundButton();
    wirePlayground();
    initWasm();
    loadBillingReadiness();
  });
})();
