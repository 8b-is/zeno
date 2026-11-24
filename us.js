/**
 * ZENO US Client Runtime (MIT Open-Source Safe Isomorphic JS Client)
 * Zero-float BigInt accounting via ZenoEngine.StablecoinReserveEngine,
 * safe DOM element construction (createElement + textContent), WebCrypto P-256 local-first vault,
 * interactive Robinhood chart, CashApp keypad, and Revolut multi-currency + disposable cards.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "zeno_us_open_client_v1";
  const MICRO_USD = ZenoEngine.MICRO_USD || 1000000n;
  const Engine = ZenoEngine.StablecoinReserveEngine;

  const MARKETS = Object.freeze([
    { sym: "USDC", name: "USD Coin · Circle Segregated", price: "$1.0000", delta: "1:1 Peg", tag: "RESERVE" },
    { sym: "USDT", name: "Tether USD · Treasury Pool", price: "$1.0000", delta: "1:1 Peg", tag: "RESERVE" },
    { sym: "US-TBILL", name: "3M US Treasury Yield", price: "$100.00", delta: "4.85% APY", tag: "YIELD" },
    { sym: "BTC", name: "Bitcoin Spot Reference", price: "$96,420", delta: "+2.14%", tag: "CRYPTO" },
    { sym: "SOL", name: "Solana USDC/USDT Rail", price: "$244.10", delta: "+4.65%", tag: "RAIL" },
    { sym: "SPY-T", name: "S&P 500 Tokenized Index", price: "$598.40", delta: "+0.72%", tag: "EQUITY" },
  ]);

  // Integer USD cents per timeframe point (last point replaced dynamically by exact BigInt account balance)
  const CHART_CURVES_CENTS = Object.freeze({
    "1D": [1242000, 1245500, 1249000, 1246500, 1254000, 1261000, 1259500, 1268000, 1274000, 1279000, 1284050],
    "1W": [1190000, 1205000, 1198000, 1219000, 1232000, 1241000, 1256000, 1263000, 1271000, 1284050],
    "1M": [1085000, 1112000, 1134000, 1129000, 1164000, 1198000, 1215000, 1249000, 1268000, 1284050],
    "3M": [920000, 965000, 1012000, 1045000, 1089000, 1130000, 1178000, 1221000, 1259000, 1284050],
    "1Y": [640000, 710000, 795000, 840000, 910000, 985000, 1060000, 1142000, 1218000, 1284050],
    "ALL": [150000, 280000, 420000, 560000, 720000, 880000, 1020000, 1150000, 1230000, 1284050],
  });

  let engine = loadEngine();
  let activeTf = "1D";
  let cashEntry = "0";
  let cardFrozen = false;
  let cardPan = "4815 •••• •••• 0420";
  let cardCvc = "862";
  let cardTypeLabel = "PRIMARY SOVEREIGN DEBIT · $you";
  let pockets = Object.assign(Object.create(null), {
    JPY: 0n,
    EUR: 0n,
    GBP: 0n,
    HUF: 0n,
  });
  let localKeyPair = null;
  let localFingerprint = "";

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "className") node.className = v;
      else if (k === "textContent") node.textContent = v;
      else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
      else node.setAttribute(k, v);
    }
    for (const child of children) {
      if (typeof child === "string") node.appendChild(document.createTextNode(child));
      else if (child) node.appendChild(child);
    }
    return node;
  }

  function loadEngine() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return new Engine(JSON.parse(raw));
      }
    } catch (_) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
    }
    return new Engine();
  }

  function saveEngine() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(engine.toJSON()));
    } catch (_) {}
  }

  function parseUsdToMicro(inputStr) {
    const trimmed = String(inputStr ?? "").trim();
    if (!/^\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,6})?$/.test(trimmed)) {
      throw new Error("Enter a valid non-negative USD amount (up to 6 decimals)");
    }
    const clean = trimmed.replace(/[$,\s]/g, "");
    const [whole, frac = ""] = clean.split(".");
    const micro = BigInt(whole) * MICRO_USD + BigInt(frac.padEnd(6, "0"));
    if (micro <= 0n) throw new Error("Amount must be greater than $0.00");
    return micro;
  }

  function showToast(msg, isError = false) {
    const toast = document.getElementById("us-toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = isError ? "toast-banner show err" : "toast-banner show";
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 4500);
  }

  function switchView(viewName) {
    document.querySelectorAll(".view-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === `view-${viewName}`);
    });
    document.querySelectorAll(".nav-item, .bottom-nav-btn").forEach((btn) => {
      const isSelected = btn.getAttribute("data-view") === viewName;
      btn.classList.toggle("active", isSelected);
      if (btn.getAttribute("role") === "tab") {
        btn.setAttribute("aria-selected", isSelected ? "true" : "false");
      }
    });
    if (viewName === "home") drawChart();
    window.zenoAudio?.playPluck();
  }

  function renderAll() {
    const parity = engine.verifyReserveParity();
    const youBal = engine.accounts["$you"] ?? 0n;
    const youFormatted = Engine.formatUsd(youBal);

    document.getElementById("home-balance").textContent = youFormatted;
    document.getElementById("pay-available").textContent = youFormatted;
    document.getElementById("stat-usdc").textContent = Engine.formatUsd(parity.usdcMicro);
    document.getElementById("stat-usdt").textContent = Engine.formatUsd(parity.usdtMicro);
    document.getElementById("stat-total-reserves").textContent = Engine.formatUsd(parity.totalReservesMicro);
    document.getElementById("stat-total-liabilities").textContent = Engine.formatUsd(parity.totalLiabilitiesMicro);
    document.getElementById("hdr-por-ratio").textContent = parity.ratioPQ;
    document.getElementById("por-trit-badge").textContent = `Coverage ${parity.ratioPQ} · trit ${parity.trit}`;
    document.getElementById("rail-seal").textContent = `${engine.chainHead.slice(0, 10)}…`;
    document.getElementById("swap-availability").textContent =
      `USDC: ${Engine.formatUsd(parity.usdcMicro)} · USDT: ${Engine.formatUsd(parity.usdtMicro)}`;

    const total = parity.totalReservesMicro;
    const usdcPct = total > 0n ? Number((parity.usdcMicro * 100n) / total) : 50;
    document.getElementById("bar-usdc").style.width = `${usdcPct}%`;
    document.getElementById("bar-usdt").style.width = `${100 - usdcPct}%`;

    renderMarkets();
    renderActivity();
    renderPockets(parity);
    renderProDashboard();
    updateFxPreview();
    drawChart();
  }

  function renderProDashboard() {
    const planGrid = document.getElementById("pro-plans-grid");
    const netGrid = document.getElementById("pro-networks-grid");
    const activePlan = engine.getPlan("$you");
    const activeBadge = document.getElementById("pro-active-plan-badge");
    if (activeBadge) {
      activeBadge.textContent = `ACTIVE: ${activePlan.name.toUpperCase()} (${activePlan.autoTradeBps.toString()} BPS)`;
    }
    const rev = engine.getRevenueSummary();
    const setText = (id, txt) => {
      const node = document.getElementById(id);
      if (node) node.textContent = txt;
    };
    setText("pro-total-revenue", `REV: ${Engine.formatUsd(rev.totalRevenueMicro)}`);
    setText("rev-operating", Engine.formatUsd(rev.operatingMicro));
    setText("rev-family", Engine.formatUsd(rev.familyTrustMicro));
    setText("rev-foken", Engine.formatUsd(rev.fokenCommonsMicro));

    if (planGrid && ZenoEngine.SUBSCRIPTION_PLANS) {
      const cards = Object.values(ZenoEngine.SUBSCRIPTION_PLANS).map((plan) => {
        const isCurrent = plan.id === activePlan.id;
        const btn = el("button", {
          type: "button",
          className: isCurrent ? "btn-secondary w-full" : "btn-primary w-full",
          textContent: isCurrent ? "✓ Active Plan" : `Subscribe (${Engine.formatUsd(plan.monthlyFeeMicro)}/mo)`,
        });
        btn.addEventListener("click", () => {
          try {
            const res = engine.subscribePlan("$you", plan.id);
            saveEngine();
            renderAll();
            updateUsagePreview();
            window.zenoAudio?.playBell();
            showToast(`Activated ${plan.name} (${Engine.formatUsd(res.feeMicro)} billed 50/30/20)`);
          } catch (err) {
            showToast(err.message, true);
          }
        });
        return el("div", { className: isCurrent ? "plan-card plan-active" : "plan-card" }, [
          el("div", {}, [
            el("div", { className: "stat-label", textContent: plan.id.toUpperCase() }),
            el("div", { className: "plan-price", textContent: `${Engine.formatUsd(plan.monthlyFeeMicro)}/mo` }),
            el("div", {
              className: "panel-sub mt-xs",
              textContent: `${plan.autoTradeBps.toString()} bps auto-trade · ${plan.bridgeBps.toString()} bps bridge · ${plan.includedApiCalls.toLocaleString("en-US")} API calls`,
            }),
          ]),
          btn,
        ]);
      });
      planGrid.replaceChildren(...cards);
    }

    if (netGrid && ZenoEngine.STABLECOIN_NETWORKS) {
      const cards = Object.values(ZenoEngine.STABLECOIN_NETWORKS).map((net) =>
        el("div", { className: "net-card" }, [
          el("div", { className: "stat-label", textContent: `${net.name} (${String(net.chainId)})` }),
          el("div", { className: "panel-sub", textContent: `Finality ${net.avgFinality} · Typical fee ${net.typicalFee}` }),
          el("div", {
            className: "net-contract",
            textContent: `USDC: ${net.usdcContract || "unsupported (native deprecated)"}`,
          }),
          el("div", {
            className: "net-contract",
            textContent: `USDT: ${net.usdtContract}`,
          }),
        ]),
      );
      netGrid.replaceChildren(...cards);
    }
  }

  function updateUsagePreview() {
    const outEl = document.getElementById("pro-fee-preview");
    const kindEl = document.getElementById("pro-usage-kind");
    const unitsEl = document.getElementById("pro-usage-units");
    const notionalEl = document.getElementById("pro-usage-notional");
    if (!outEl || !kindEl || !unitsEl || !notionalEl) return;
    try {
      const rawUnits = String(unitsEl.value || "").trim();
      if (!/^\d+$/.test(rawUnits) || BigInt(rawUnits) <= 0n) throw new Error("—");
      const units = BigInt(rawUnits);
      const plan = engine.getPlan("$you");
      const rates = ZenoEngine.USAGE_RATES_MICRO;
      let notional = 0n;
      try {
        notional = parseUsdToMicro(notionalEl.value);
      } catch {
        notional = 0n;
      }
      let fee = 0n;
      if (kindEl.value === "API_CALL_OVERAGE") fee = units * rates.API_CALL_OVERAGE;
      else if (kindEl.value === "AUTO_TRADE_TICK") fee = units * rates.AUTO_TRADE_TICK + (notional * plan.autoTradeBps) / 10000n;
      else if (kindEl.value === "CROSS_CHAIN_BRIDGE") {
        const bpsFee = (notional * plan.bridgeBps) / 10000n;
        const minFee = units * rates.CROSS_CHAIN_BRIDGE_MIN;
        fee = bpsFee > minFee ? bpsFee : minFee;
      } else {
        fee = units * rates.DISPOSABLE_CARD_MINT;
      }
      outEl.textContent = Engine.formatUsd(fee);
    } catch {
      outEl.textContent = "—";
    }
  }

  function initProMonetization() {
    ["pro-usage-kind", "pro-usage-units", "pro-usage-notional"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) {
        node.addEventListener("input", updateUsagePreview);
        node.addEventListener("change", updateUsagePreview);
      }
    });
    document.getElementById("btn-bill-usage")?.addEventListener("click", () => {
      try {
        const kind = document.getElementById("pro-usage-kind").value;
        const rawUnits = String(document.getElementById("pro-usage-units").value || "").trim();
        if (!/^\d+$/.test(rawUnits) || BigInt(rawUnits) <= 0n) {
          throw new Error("Units must be a positive integer");
        }
        const units = BigInt(rawUnits);
        let notional = 0n;
        if (kind === "AUTO_TRADE_TICK" || kind === "CROSS_CHAIN_BRIDGE") {
          notional = parseUsdToMicro(document.getElementById("pro-usage-notional").value);
        }
        const res = engine.billMeteredUsage("$you", kind, units, notional);
        saveEngine();
        renderAll();
        updateUsagePreview();
        window.zenoAudio?.playUltraShimmer?.() || window.zenoAudio?.playBell();
        showToast(`Billed ${Engine.formatUsd(res.feeMicro)} (${res.kind}) · Split 50/30/20 · Seal ${res.receipt.seal.slice(0, 12)}`);
      } catch (err) {
        showToast(err.message, true);
      }
    });
    document.getElementById("btn-pro-checkout")?.addEventListener("click", async () => {
      const planId = document.getElementById("pro-checkout-plan")?.value || "ultra_quant";
      const paymentRail = document.getElementById("pro-checkout-rail")?.value || "stripe";
      const outEl = document.getElementById("pro-checkout-out");
      if (!outEl) return;
      outEl.textContent = "Requesting live checkout from /api/us/checkout…";
      try {
        const resp = await fetch("/api/us/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planId, paymentRail, cashtag: "$you" }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || `HTTP ${resp.status}`);
        }
        if (data.mode === "stripe_live" && data.checkoutUrl) {
          outEl.textContent = `LIVE STRIPE CHECKOUT (${data.planId}): ${data.checkoutUrl}`;
        } else if (data.paymentUri) {
          outEl.textContent = `DIRECT ${data.mode.toUpperCase()} (${data.amountExact} USDC): ${data.paymentUri}`;
        } else {
          const missing = Array.isArray(data.missingSecrets) ? data.missingSecrets.join(", ") : "configuration";
          outEl.textContent = `${data.mode || "unconfigured"} · Set Wrangler secrets: ${missing}`;
        }
        window.zenoAudio?.playPluck();
      } catch (err) {
        outEl.textContent = `Checkout error: ${err.message}`;
        showToast(err.message, true);
      }
    });
    updateUsagePreview();
  }

  function renderMarkets() {
    const root = document.getElementById("market-list");
    if (!root) return;
    const rows = MARKETS.map((item) => {
      const row = el("button", { type: "button", className: "market-row" }, [
        el("div", { style: { textAlign: "left" } }, [
          el("div", { className: "market-sym" }, [
            item.sym + " ",
            el("span", { className: "tag-badge", style: { fontSize: "0.6rem" }, textContent: item.tag }),
          ]),
          el("div", { className: "market-name", textContent: item.name }),
        ]),
        el("div", { className: "market-price" }, [
          el("div", { style: { fontWeight: "700" }, textContent: item.price }),
          el("div", { style: { fontSize: "0.75rem", color: "var(--emerald)" }, textContent: item.delta }),
        ]),
      ]);
      row.addEventListener("click", () => {
        window.zenoAudio?.playDrop();
        showToast(`${item.sym} (${item.price}) · ${item.delta} — 0-commission US preview`);
      });
      return row;
    });
    root.replaceChildren(...rows);
  }

  function renderActivity() {
    const root = document.getElementById("activity-list");
    const countEl = document.getElementById("activity-count");
    if (!root) return;
    countEl.textContent = `${engine.receipts.length} block${engine.receipts.length === 1 ? "" : "s"}`;
    const rows = engine.receipts.slice(0, 6).map((r) =>
      el("div", { className: "market-row", style: { cursor: "default" } }, [
        el("div", { style: { minWidth: "0" } }, [
          el("div", {
            className: "market-sym",
            style: { fontSize: "0.82rem", color: "var(--gold)" },
            textContent: `#${r.seq} · ${r.kind}`,
          }),
          el("div", {
            className: "market-name",
            style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
            textContent: r.memo,
          }),
        ]),
        el("div", { className: "market-price" }, [
          el("div", {
            style: { fontWeight: "700", color: "var(--teal)" },
            textContent: Engine.formatUsd(r.amountMicro),
          }),
          el("div", {
            style: { fontSize: "0.68rem", color: "var(--text-secondary)" },
            textContent: String(r.seal).slice(0, 10),
          }),
        ]),
      ]),
    );
    root.replaceChildren(...rows);
  }

  function renderPockets(parity) {
    const root = document.getElementById("pockets-grid");
    if (!root) return;
    const list = [
      { code: "USDC", label: "USDC Segregated Reserve", val: Engine.formatUsd(parity.usdcMicro), color: "var(--teal)" },
      { code: "USDT", label: "USDT Segregated Reserve", val: Engine.formatUsd(parity.usdtMicro), color: "var(--emerald)" },
      { code: "JPY", label: "Tokyo Transit Pocket", val: Engine.formatCurrency(pockets.JPY, "JPY"), color: "var(--gold)" },
      { code: "EUR", label: "Euro Sovereign Pocket", val: Engine.formatCurrency(pockets.EUR, "EUR"), color: "var(--text-primary)" },
      { code: "GBP", label: "Sterling Pocket", val: Engine.formatCurrency(pockets.GBP, "GBP"), color: "var(--text-primary)" },
      { code: "HUF", label: "Budapest Pocket", val: Engine.formatCurrency(pockets.HUF, "HUF"), color: "var(--text-primary)" },
    ];
    const cards = list.map((p) =>
      el("div", { className: "pocket-card" }, [
        el("div", { className: "stat-label", textContent: p.code }),
        el("div", { className: "stat-val", style: { color: p.color }, textContent: p.val }),
        el("div", { className: "panel-sub", style: { marginTop: "0.2rem" }, textContent: p.label }),
      ]),
    );
    root.replaceChildren(...cards);
  }

  function drawChart(scrubIdx = null) {
    const canvas = document.getElementById("rh-chart");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const ptsCents = (CHART_CURVES_CENTS[activeTf] || CHART_CURVES_CENTS["1D"]).map((c) => BigInt(c) * 10000n);
    ptsCents[ptsCents.length - 1] = engine.accounts["$you"] ?? 0n;

    const ptsNum = ptsCents.map((m) => Number(m / 10000n));
    const min = Math.min(...ptsNum) * 0.985;
    const max = Math.max(...ptsNum) * 1.015;
    const padX = 14;
    const padY = 18;
    const w = rect.width - padX * 2;
    const h = rect.height - padY * 2;

    const coords = ptsNum.map((v, i) => ({
      x: padX + (i / (ptsNum.length - 1)) * w,
      y: padY + h - ((v - min) / (max - min || 1)) * h,
      micro: ptsCents[i],
    }));

    ctx.clearRect(0, 0, rect.width, rect.height);

    const grad = ctx.createLinearGradient(0, padY, 0, rect.height);
    grad.addColorStop(0, "rgba(0, 212, 126, 0.28)");
    grad.addColorStop(1, "rgba(0, 212, 126, 0.0)");

    ctx.beginPath();
    coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
    ctx.lineTo(coords[coords.length - 1].x, rect.height);
    ctx.lineTo(coords[0].x, rect.height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
    ctx.strokeStyle = "#00d47e";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    const active = scrubIdx !== null ? coords[Math.max(0, Math.min(coords.length - 1, scrubIdx))] : coords[coords.length - 1];
    if (scrubIdx !== null) {
      ctx.beginPath();
      ctx.moveTo(active.x, padY);
      ctx.lineTo(active.x, rect.height - padY);
      ctx.strokeStyle = "rgba(232, 176, 92, 0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const readout = document.getElementById("chart-readout");
      if (readout) {
        readout.textContent = `${activeTf} Point: ${Engine.formatUsd(active.micro)} · 1:1 USDC+USDT Backed`;
      }
    }

    ctx.beginPath();
    ctx.arc(active.x, active.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#e8b05c";
    ctx.fill();
  }

  function initChartScrubber() {
    const canvas = document.getElementById("rh-chart");
    if (!canvas) return;
    const handlePointer = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const pts = CHART_CURVES_CENTS[activeTf] || CHART_CURVES_CENTS["1D"];
      const idx = Math.round(ratio * (pts.length - 1));
      drawChart(idx);
    };
    canvas.addEventListener("mousemove", (e) => handlePointer(e.clientX));
    canvas.addEventListener("touchmove", (e) => {
      if (e.touches[0]) handlePointer(e.touches[0].clientX);
    }, { passive: true });
    canvas.addEventListener("mouseleave", () => {
      document.getElementById("chart-readout").textContent = "▲ +$412.80 (+3.32%) · 1:1 USDC+USDT Backed";
      drawChart(null);
    });
  }

  function openModal(title, contentNode, onMount) {
    document.getElementById("us-modal-title").textContent = title;
    const body = document.getElementById("us-modal-body");
    body.replaceChildren(contentNode);
    document.getElementById("us-modal-backdrop").classList.add("open");
    if (onMount) onMount();
  }

  function renderQrCanvas(container, payload, targetPx = 188) {
    if (!container) return;
    if (typeof window.qrcode !== "function") {
      container.replaceChildren(
        el("div", { className: "panel-sub", textContent: "QR generator unavailable" }),
      );
      return;
    }
    const qr = window.qrcode(0, "M");
    qr.addData(payload);
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 2;
    const totalModules = count + quiet * 2;
    const cell = Math.max(2, Math.floor(targetPx / totalModules));
    const size = totalModules * cell;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.setAttribute("aria-label", "QR Code");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#06090e";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
        }
      }
    }
    container.replaceChildren(canvas);
  }

  function closeModal() {
    document.getElementById("us-modal-backdrop").classList.remove("open");
  }

  function openReserveModal(mode) {
    const isDeposit = mode === "deposit";
    const assetSelect = el("select", { id: "mdl-asset", className: "select" }, [
      el("option", { value: "USDC", textContent: "USDC (Circle)" }),
      el("option", { value: "USDT", textContent: "USDT (Tether)" }),
    ]);
    const railInput = el("select", { id: "mdl-rail", className: "select" }, [
      el("option", { value: "Solana Mainnet", textContent: "Solana Mainnet (USDC/USDT)" }),
      el("option", { value: "Base L2", textContent: "Base L2 (USDC/USDT)" }),
      el("option", { value: "Ethereum L1", textContent: "Ethereum L1 (USDC/USDT)" }),
      el("option", { value: "Arbitrum One", textContent: "Arbitrum One (USDC/USDT)" }),
      el("option", { value: "Polygon PoS", textContent: "Polygon PoS (USDC/USDT)" }),
      el("option", { value: "OP Mainnet", textContent: "OP Mainnet (USDC/USDT)" }),
      el("option", { value: "Tron TRC-20", textContent: "Tron TRC-20 (USDT only)" }),
    ]);
    const amtInput = el("input", {
      id: "mdl-amt",
      className: "input",
      type: "number",
      min: "1",
      step: "0.01",
      value: "250.00",
    });
    const confirmBtn = el("button", {
      id: "mdl-confirm",
      className: "btn-primary",
      style: { width: "100%" },
      type: "button",
      textContent: isDeposit ? "✓ Confirm 1:1 Deposit" : "✓ Confirm 1:1 Withdrawal",
    });

    const content = el("div", {}, [
      el("div", { className: "field-grid" }, [
        el("div", { className: "field" }, [
          el("label", { for: "mdl-asset", textContent: "Stablecoin" }),
          assetSelect,
        ]),
        el("div", { className: "field" }, [
          el("label", { for: "mdl-rail", textContent: isDeposit ? "Network Rail" : "Destination" }),
          railInput,
        ]),
        el("div", { className: "field" }, [
          el("label", { for: "mdl-amt", textContent: "Amount (USD)" }),
          amtInput,
        ]),
      ]),
      el("div", { className: "btn-row", style: { marginTop: "1rem" } }, [confirmBtn]),
    ]);

    confirmBtn.addEventListener("click", () => {
      try {
        const asset = assetSelect.value;
        const rail = railInput.value.trim() || "Base";
        const micro = parseUsdToMicro(amtInput.value);
        const res = isDeposit
          ? engine.depositReserve("$you", asset, micro, rail)
          : engine.redeemReserve("$you", asset, micro, rail);
        saveEngine();
        renderAll();
        closeModal();
        window.zenoAudio?.playBell();
        showToast(`${isDeposit ? "Minted" : "Redeemed"} ${Engine.formatUsd(micro)} ${asset} · Seal ${res.receipt.seal.slice(0, 12)}`);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    openModal(
      isDeposit ? "Deposit USDC or USDT (1:1 Mint)" : "Withdraw to USDC or USDT (1:1 Redeem)",
      content,
    );
  }

  function updateCashDisplay() {
    document.getElementById("cash-amount-display").textContent = `$${cashEntry}`;
  }

  function initKeypad() {
    document.querySelectorAll(".key-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-key");
        window.zenoAudio?.playDrop();
        if (key === "BACK") {
          cashEntry = cashEntry.length <= 1 ? "0" : cashEntry.slice(0, -1);
        } else if (key === ".") {
          if (!cashEntry.includes(".")) cashEntry += ".";
        } else {
          if (cashEntry === "0") {
            cashEntry = key;
          } else {
            const parts = cashEntry.split(".");
            if (parts[1] && parts[1].length >= 2) return;
            if (cashEntry.length >= 10) return;
            cashEntry += key;
          }
        }
        updateCashDisplay();
      });
    });

    document.querySelectorAll(".chip-btn[data-quick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cashEntry = btn.getAttribute("data-quick");
        updateCashDisplay();
        window.zenoAudio?.playDrop();
      });
    });

    document.querySelectorAll(".contact-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("pay-to-tag").value = btn.getAttribute("data-tag");
        window.zenoAudio?.playDrop();
      });
    });

    document.getElementById("btn-pay-send").addEventListener("click", () => {
      try {
        const micro = parseUsdToMicro(cashEntry);
        const toTag = document.getElementById("pay-to-tag").value.trim();
        const rail = document.getElementById("pay-rail").value;
        const memo = document.getElementById("pay-memo").value.trim();
        const res = engine.p2pSend("$you", toTag, micro, rail, memo);
        saveEngine();
        renderAll();
        cashEntry = "0";
        updateCashDisplay();
        window.zenoAudio?.playBell();
        showToast(`Sent ${Engine.formatUsd(micro)} to ${toTag} (${rail}) · Seal ${res.receipt.seal.slice(0, 12)}`);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById("btn-pay-qr").addEventListener("click", () => {
      const toTag = document.getElementById("pay-to-tag").value.trim() || "$you";
      const amt = cashEntry === "0" ? "" : `&amount=${encodeURIComponent(cashEntry)}`;
      const payload = `zeno://pay/${encodeURIComponent(toTag)}?rail=USDC_USDT${amt}`;
      const qrBox = el("div", {
        id: "us-qr-box",
        style: {
          display: "inline-block",
          padding: "12px",
          background: "#ffffff",
          borderRadius: "12px",
          marginBottom: "0.85rem",
        },
      });
      const content = el("div", { style: { textAlign: "center" } }, [
        qrBox,
        el("div", {
          className: "mono",
          style: { fontSize: "0.74rem", wordBreak: "break-all", color: "var(--teal)" },
          textContent: payload,
        }),
      ]);
      openModal(`Request QR (${toTag})`, content, () => {
        renderQrCanvas(qrBox, payload, 180);
        window.zenoAudio?.playPluck();
      });
    });
  }

  function updateFxPreview() {
    const outEl = document.getElementById("fx-quote-out");
    const pqEl = document.getElementById("fx-quote-pq");
    if (!outEl || !pqEl) return;
    try {
      const usdMicro = parseUsdToMicro(document.getElementById("fx-amount-usd").value);
      const target = document.getElementById("fx-target-currency").value;
      const quote = Engine.convertFx(usdMicro, target);
      outEl.textContent = quote.formattedOut;
      pqEl.textContent = `Rate p/q = ${quote.ratePQ} · Fee: ${quote.feeBps} bps`;
    } catch (err) {
      outEl.textContent = "—";
      pqEl.textContent = err.message;
    }
  }

  function initSwapAndFx() {
    document.getElementById("btn-exec-swap").addEventListener("click", () => {
      try {
        const dir = document.getElementById("swap-direction").value;
        const micro = parseUsdToMicro(document.getElementById("swap-amount").value);
        const [from, to] = dir === "USDC_TO_USDT" ? ["USDC", "USDT"] : ["USDT", "USDC"];
        const res = engine.swapStablecoin(from, to, micro);
        saveEngine();
        renderAll();
        window.zenoAudio?.playUltraShimmer?.() || window.zenoAudio?.playBell();
        showToast(`Swapped ${Engine.formatUsd(micro)} ${from} -> ${to} at 1/1 · Seal ${res.receipt.seal.slice(0, 12)}`);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById("fx-amount-usd").addEventListener("input", updateFxPreview);
    document.getElementById("fx-target-currency").addEventListener("change", updateFxPreview);
    document.getElementById("btn-fx-pocket").addEventListener("click", () => {
      try {
        const usdMicro = parseUsdToMicro(document.getElementById("fx-amount-usd").value);
        const target = document.getElementById("fx-target-currency").value;
        const quote = Engine.convertFx(usdMicro, target);
        pockets[target] = (pockets[target] ?? 0n) + quote.amountMicroOut;
        renderPockets(engine.verifyReserveParity());
        window.zenoAudio?.playBell();
        showToast(`Allocated ${quote.formattedOut} into ${target} pocket at exact rate ${quote.ratePQ}`);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    const parseStrictNonNegInt = (id) => {
      const raw = String(document.getElementById(id).value ?? "").trim();
      if (!/^\d+$/.test(raw)) return -1;
      const n = Number(raw);
      return Number.isSafeInteger(n) ? n : -1;
    };

    const buildFokenInvoice = () => ({
      invoiceId: "01933b70-9831-7bc8-8123-018b1509a001",
      version: 1,
      contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
      work: { title: "8b.is OMNI Hardware GPU+CPU Compute & Ternary Dot" },
      artifact: { provenanceHash: "sha256://0abcabf86830af11bb5e8cd74dc9c9d00abcabf86830af11bb5e8cd74dc9c9d0" },
      valuation: { selfAssessedFokens: parseStrictNonNegInt("foken-amount") },
      ipAssignment: {
        statement: "IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
        signature: "0x4f8a3c9b71c8364f3b8844892cfa7d2fa9f430589acee940",
      },
      netUtility: {
        futureWorkAvoidedHours: parseStrictNonNegInt("foken-avoided"),
        workAddedHours: parseStrictNonNegInt("foken-added"),
        maintenanceDebtHours: parseStrictNonNegInt("foken-debt"),
      },
    });

    const refreshFokenReadout = () => {
      const readoutEl = document.getElementById("foken-live-readout");
      const badgeEl = document.getElementById("foken-verdict-badge");
      if (!readoutEl || !badgeEl) return;
      const asset = document.getElementById("foken-asset").value;
      const gate = Engine.evaluateFokenGatePQ(buildFokenInvoice());
      badgeEl.textContent = gate.verdict === "PASS" ? `PASS · ${gate.netUtilityPQ}h` : "FAIL · REJECTED";
      badgeEl.className = gate.verdict === "PASS" ? "tag-badge emerald" : "tag-badge crimson";
      readoutEl.textContent = gate.verdict === "PASS"
        ? `Net Utility p/q = ${gate.netUtilityPQ} hrs · ${gate.fokensAwarded} FKN = ${Engine.formatUsd(gate.usdMicroAwarded)} backed 1:1 by ${asset}`
        : gate.reason;
    };

    ["foken-avoided", "foken-added", "foken-debt", "foken-amount", "foken-asset"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.addEventListener("input", refreshFokenReadout);
      if (node) node.addEventListener("change", refreshFokenReadout);
    });
    refreshFokenReadout();

    document.getElementById("btn-foken-mint").addEventListener("click", () => {
      try {
        const asset = document.getElementById("foken-asset").value;
        const res = engine.mintFromFoken("$you", asset, buildFokenInvoice());
        saveEngine();
        renderAll();
        refreshFokenReadout();
        window.zenoAudio?.playBell();
        showToast(`FOKEN settled ${Engine.formatUsd(res.gate.usdMicroAwarded)} (${res.gate.netUtilityPQ}h) backed 1:1 by ${asset} · Seal ${res.receipt.seal.slice(0, 12)}`);
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  function initCards() {
    const card = document.getElementById("titanium-card");
    const flip = () => {
      card.classList.toggle("flipped");
      window.zenoAudio?.playPluck();
    };
    card.addEventListener("click", flip);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        flip();
      }
    });
    document.getElementById("btn-card-flip").addEventListener("click", flip);

    document.getElementById("btn-card-freeze").addEventListener("click", (e) => {
      cardFrozen = !cardFrozen;
      card.classList.toggle("frozen", cardFrozen);
      const badge = document.getElementById("card-status-badge");
      badge.textContent = cardFrozen ? "FROZEN" : "ACTIVE";
      badge.className = cardFrozen ? "tag-badge crimson" : "tag-badge emerald";
      e.target.textContent = cardFrozen ? "🔥 Unfreeze Card" : "❄ Freeze Card";
      window.zenoAudio?.playDrop();
    });

    document.getElementById("btn-card-disposable").addEventListener("click", () => {
      const buf = new Uint32Array(2);
      crypto.getRandomValues(buf);
      const last4 = String(buf[0] % 10000).padStart(4, "0");
      const cvc = String(100 + (buf[1] % 900));
      cardPan = `4921 •••• •••• ${last4}`;
      cardCvc = cvc;
      cardTypeLabel = "DISPOSABLE SINGLE-USE VIRTUAL · BURNS AFTER 1 TX";
      document.getElementById("card-pan-display").textContent = cardPan;
      document.getElementById("card-cvc").textContent = cardCvc;
      document.getElementById("card-type-label").textContent = cardTypeLabel;
      window.zenoAudio?.playUltraShimmer?.();
      showToast(`Generated disposable virtual card ending in ${last4}`);
    });

    document.getElementById("card-cap-slider").addEventListener("input", (e) => {
      const val = Number(e.target.value).toLocaleString("en-US");
      document.getElementById("card-cap-label").textContent = `$${val}`;
      document.getElementById("card-cap-text").textContent = `$${val}/day`;
    });
  }

  async function initLocalWebCrypto() {
    const fpEl = document.getElementById("vault-fingerprint");
    const backFpEl = document.getElementById("card-back-fp");
    if (!window.crypto || !window.crypto.subtle) {
      fpEl.textContent = "WebCrypto unavailable in this environment";
      return;
    }
    try {
      localKeyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign", "verify"],
      );
      const spki = await crypto.subtle.exportKey("spki", localKeyPair.publicKey);
      const digest = await crypto.subtle.digest("SHA-256", spki);
      localFingerprint = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      fpEl.textContent = localFingerprint;
      if (backFpEl) backFpEl.textContent = localFingerprint.slice(0, 12);
    } catch (err) {
      fpEl.textContent = `Keygen error: ${err.message}`;
    }
  }

  function initPrivacyTab() {
    const cookiesEl = document.getElementById("audit-cookies");
    if (cookiesEl) cookiesEl.textContent = document.cookie ? String(document.cookie.split(";").length) : "0";

    document.getElementById("btn-rotate-key").addEventListener("click", async () => {
      await initLocalWebCrypto();
      window.zenoAudio?.playPluck();
      showToast("Rotated local browser ECDSA P-256 keypair");
    });

    document.getElementById("btn-sign-attestation").addEventListener("click", async () => {
      if (!localKeyPair) return showToast("Local keypair not initialized", true);
      const parity = engine.verifyReserveParity();
      const audit = engine.verifyDoubleEntryAudit();
      const payload = JSON.stringify({
        surface: "ZENO US",
        ratioPQ: parity.ratioPQ,
        auditValid: audit.valid,
        chainHead: engine.chainHead,
        pubkeyFp: localFingerprint.slice(0, 16),
      });
      const sig = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        localKeyPair.privateKey,
        new TextEncoder().encode(payload),
      );
      const sigHex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
      document.getElementById("vault-sig-out").textContent = `sig:${sigHex.slice(0, 64)}…`;
      window.zenoAudio?.playBell();
      showToast("Signed Proof-of-Reserve attestation locally via WebCrypto P-256");
    });

    document.getElementById("btn-export-proof").addEventListener("click", () => {
      const parity = engine.verifyReserveParity();
      const audit = engine.verifyDoubleEntryAudit();
      const doc = {
        surface: "ZENO US",
        clientLicense: "MIT",
        coreBoundary: "RUST_PRIVATE_CORE_NO_PYTHON",
        usdcReserveMicro: parity.usdcMicro.toString(),
        usdtReserveMicro: parity.usdtMicro.toString(),
        totalReservesMicro: parity.totalReservesMicro.toString(),
        totalLiabilitiesMicro: parity.totalLiabilitiesMicro.toString(),
        coverageRatioPQ: parity.ratioPQ,
        trit: parity.trit,
        doubleEntryAudit: audit,
        chainHead: engine.chainHead,
        pubkeyFingerprint: localFingerprint,
        receipts: engine.receipts,
      };
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "zeno-us-por-proof.json";
      a.click();
      URL.revokeObjectURL(url);
      window.zenoAudio?.playDrop();
    });

    document.getElementById("btn-reset-local").addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      engine = new Engine();
      pockets = Object.assign(Object.create(null), { JPY: 0n, EUR: 0n, GBP: 0n, HUF: 0n });
      renderAll();
      window.zenoAudio?.playPluck();
      showToast("Reset local US ledger to seeded 1:1 USDC+USDT parity");
    });
  }

  function initSolanaPayout() {
    const recEl = document.getElementById("sol-recipient");
    const amtEl = document.getElementById("sol-amount");
    const memoEl = document.getElementById("sol-memo");
    const qrContainer = document.getElementById("sol-qr-container");
    const uriEl = document.getElementById("sol-uri-out");
    const cliEl = document.getElementById("sol-cli-out");
    const badgeEl = document.getElementById("sol-status-badge");
    const openLink = document.getElementById("btn-sol-open");
    if (!recEl || !amtEl || !uriEl || !cliEl) return;

    let latestIntent = null;

    const refresh = (notify = false) => {
      try {
        const amountMicro = parseUsdToMicro(amtEl.value);
        latestIntent = Engine.buildSolanaPayUsdcIntent({
          recipient: recEl.value,
          amountMicro,
          label: "ZENO Family Trust",
          memo: memoEl ? memoEl.value : "",
        });
        uriEl.textContent = latestIntent.solanaPayUri;
        cliEl.textContent = latestIntent.cliCommand;
        if (openLink) openLink.href = latestIntent.solanaPayUri;
        if (badgeEl) {
          badgeEl.textContent = `UNSIGNED · ${latestIntent.amountDecimal} USDC INTENT READY`;
          badgeEl.className = "tag-badge gold";
        }
        renderQrCanvas(qrContainer, latestIntent.solanaPayUri, 188);
        if (notify) {
          window.zenoAudio?.playBell();
          showToast(`Prepared unsigned ${latestIntent.amountDecimal} USDC Solana Pay intent -> ${latestIntent.recipient.slice(0, 8)}…`);
        }
      } catch (err) {
        latestIntent = null;
        if (badgeEl) {
          badgeEl.textContent = "INVALID SOLANA PAYOUT INPUT";
          badgeEl.className = "tag-badge crimson";
        }
        uriEl.textContent = err.message;
        cliEl.textContent = "—";
        if (openLink) openLink.removeAttribute("href");
        if (qrContainer) {
          qrContainer.replaceChildren(
            el("div", { className: "panel-sub", textContent: err.message }),
          );
        }
        if (notify) showToast(err.message, true);
      }
    };

    const copyText = async (text, label) => {
      if (!text || text === "—") return showToast("Fix Solana payout fields first", true);
      try {
        await navigator.clipboard.writeText(text);
        window.zenoAudio?.playPluck();
        showToast(`Copied ${label} to clipboard`);
      } catch {
        showToast(`Copy blocked — select ${label} manually`, true);
      }
    };

    recEl.addEventListener("input", () => refresh(false));
    amtEl.addEventListener("input", () => refresh(false));
    if (memoEl) memoEl.addEventListener("input", () => refresh(false));
    document.querySelectorAll(".sol-amt-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        amtEl.value = chip.getAttribute("data-sol-amt") || "5.00";
        refresh(true);
      });
    });
    document.getElementById("btn-sol-refresh")?.addEventListener("click", () => refresh(true));
    document.getElementById("btn-sol-copy-uri")?.addEventListener("click", () => {
      copyText(latestIntent?.solanaPayUri, "Solana Pay URI");
    });
    document.getElementById("btn-sol-copy-cli")?.addEventListener("click", () => {
      copyText(latestIntent?.cliCommand, "spl-token CLI command");
    });

    refresh(false);
  }

  function initHeaderAndNav() {
    document.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.getAttribute("data-view")));
    });
    document.getElementById("btn-por-header").addEventListener("click", () => switchView("privacy"));
    document.getElementById("btn-open-deposit").addEventListener("click", () => openReserveModal("deposit"));
    document.getElementById("btn-open-withdraw").addEventListener("click", () => openReserveModal("withdraw"));
    document.getElementById("btn-close-us-modal").addEventListener("click", closeModal);
    document.getElementById("us-modal-backdrop").addEventListener("click", (e) => {
      if (e.target.id === "us-modal-backdrop") closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    const soundBtn = document.getElementById("btn-us-sound");
    const syncSoundLabel = () => {
      soundBtn.textContent = window.zenoAudio?.muted ? "🔇 Sound Off" : "🔔 Sound On";
    };
    syncSoundLabel();
    soundBtn.addEventListener("click", () => {
      window.zenoAudio?.toggleMute();
      syncSoundLabel();
      if (!window.zenoAudio?.muted) window.zenoAudio?.playBell();
    });

    document.querySelectorAll(".tf-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTf = btn.getAttribute("data-tf");
        document.querySelectorAll(".tf-btn").forEach((b) => b.classList.toggle("active", b === btn));
        drawChart();
        window.zenoAudio?.playDrop();
      });
    });

    window.addEventListener("resize", () => drawChart());
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHeaderAndNav();
    initChartScrubber();
    initKeypad();
    initSolanaPayout();
    initSwapAndFx();
    initProMonetization();
    initCards();
    initPrivacyTab();
    initLocalWebCrypto();
    renderAll();
  });
})();
