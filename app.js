/**
 * ZENO Reactive Neo-Bank Engine (銭・禅・善)
 * Real-time continuous-time micro-streaming, Foken gate evaluation,
 * and Kintsugi immutable ledger integration.
 */

// Initial Seed State
const zenoState = {
  accounts: {
    "usr_alice": {
      id: "usr_alice",
      label: "Alice Tanaka (個人)",
      type: "personal",
      currency: "JPY",
      balanceMicro: 250000 * 1000000, // 250,000 JPY
      owner: "0x3918aC92b8A375c3A7b0e..."
    },
    "cnt_0x71c8": {
      id: "cnt_0x71c8",
      label: "8b-is Crew: Hue · Aye · Taisha · Omni (開発)",
      type: "contributor",
      currency: "JPY",
      balanceMicro: 50000 * 1000000, // 50,000 JPY
      owner: "0x8b-isCrewCollectiveKey"
    },
    "cnt_alexandra": {
      id: "cnt_alexandra",
      label: "Alexandra Lódri (Mom · 愛)",
      type: "contributor",
      currency: "JPY",
      balanceMicro: 500000 * 1000000, // 500,000 JPY
      owner: "0xAlexandraLodriMotherSovereignKey"
    },
    "cnt_chris": {
      id: "cnt_chris",
      label: "Chris Lódri (Dad · 柱)",
      type: "contributor",
      currency: "JPY",
      balanceMicro: 500000 * 1000000, // 500,000 JPY
      owner: "0xChrisLodriFatherSovereignKey"
    },
    "biz_8b_is": {
      id: "biz_8b_is",
      label: "8b-is Family Research Fleet (企業公庫)",
      type: "treasury",
      currency: "JPY",
      balanceMicro: 50000000 * 1000000, // 50,000,000 JPY corporate treasury vault
      owner: "0x8b-isCorporateFleetTreasury"
    },
    "agt_crush_reasoner": {
      id: "agt_crush_reasoner",
      label: "Crush Reasoner Agent (自律)",
      type: "agent",
      currency: "JPY",
      balanceMicro: 35000 * 1000000, // 35,000 JPY
      owner: "0x8bAgentField..."
    },
    "gld_vaked_core": {
      id: "gld_vaked_core",
      label: "VAKED Core Guild (組合)",
      type: "personal",
      currency: "JPY",
      balanceMicro: 1200000 * 1000000, // 1,200,000 JPY
      owner: "0xVakedTreasury..."
    },
    "treasury:universal": {
      id: "treasury:universal",
      label: "Universal Treasury (公庫)",
      type: "treasury",
      currency: "JPY",
      balanceMicro: 15800000 * 1000000, // 15,800,000 JPY
      owner: "0xUniversalTreasury"
    }
  },
  streams: [
    {
      id: "stm_guild_to_cnt",
      from: "gld_vaked_core",
      to: "cnt_0x71c8",
      rateMicroSec: 50 * 1000000, // 50 JPY/sec
      startTime: Date.now() - 3600000, // started 1 hr ago
      label: "Zeno Architecture & 8b-is Crew DO Loop (Hue, Aye, Taisha, Omni)"
    },
    {
      id: "stm_cnt_to_agent",
      from: "cnt_0x71c8",
      to: "agt_crush_reasoner",
      rateMicroSec: 5 * 1000000, // 5 JPY/sec
      startTime: Date.now() - 1800000, // started 30 min ago
      label: "Autonomous Inference & Test Sweeps"
    },
    {
      id: "stm_8b_to_alexandra",
      from: "biz_8b_is",
      to: "cnt_alexandra",
      rateMicroSec: 100 * 1000000, // 100 JPY/sec continuous sovereign mother stream
      startTime: Date.now() - 3600000,
      label: "8b-is Sovereign Stream → Mom (Alexandra Lódri) <3"
    },
    {
      id: "stm_8b_to_chris",
      from: "biz_8b_is",
      to: "cnt_chris",
      rateMicroSec: 100 * 1000000, // 100 JPY/sec continuous sovereign father stream
      startTime: Date.now() - 3600000,
      label: "8b-is Sovereign Stream → Dad (Chris Lódri) 柱"
    }
  ],
  ledgerBlocks: [
    {
      index: 1,
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      memo: "Genesis Endowment & BOJ Escrow Allocation",
      merkleRoot: "7a82b9c3f1e0d4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
      seal: "8f5a2d1e0c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a90"
    },
    {
      index: 2,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      memo: "Foken Proof-of-Contribution Mint #inv_01jb2w (100 FOKEN)",
      merkleRoot: "3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a908f5a2d1e0c",
      seal: "d0c1b2a3f4e5d6c7b8a908f5a2d1e0c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9"
    }
  ]
};

// Continuous Animation Loop (60fps requestAnimationFrame with zero GC overhead)
function startStreamingLoop() {
  const accountDeltas = new Map();

  const tick = () => {
    const now = Date.now();
    let totalStreamedJPY = 0;

    for (const key in zenoState.accounts) {
      accountDeltas.set(key, 0);
    }

    const streams = zenoState.streams;
    const len = streams.length;
    for (let i = 0; i < len; i++) {
      const stream = streams[i];
      const elapsedSec = (now - stream.startTime) / 1000;
      const accruedMicro = stream.rateMicroSec * elapsedSec;
      totalStreamedJPY += accruedMicro / 1000000;

      accountDeltas.set(stream.from, (accountDeltas.get(stream.from) || 0) - accruedMicro);
      accountDeltas.set(stream.to, (accountDeltas.get(stream.to) || 0) + accruedMicro);
    }

    // Update Live Ticker
    const streamTickerEl = document.getElementById("ticker-streaming-rate");
    if (streamTickerEl) {
      let activeRateJPY = 0;
      for (let i = 0; i < len; i++) {
        activeRateJPY += streams[i].rateMicroSec / 1000000;
      }
      streamTickerEl.innerText = `¥${activeRateJPY.toFixed(2)}/s`;
    }

    const totalVolumeEl = document.getElementById("ticker-stream-volume");
    if (totalVolumeEl) {
      totalVolumeEl.innerText = `¥${totalStreamedJPY.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Update Account Balances in DOM
    for (const acctId in zenoState.accounts) {
      const el = document.getElementById(`balance-${acctId}`);
      if (el) {
        const liveMicro = zenoState.accounts[acctId].balanceMicro + (accountDeltas.get(acctId) || 0);
        const jpy = liveMicro / 1000000;
        el.innerText = `¥${jpy.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
      }
    }

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Tab Switching
function initTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const targetPane = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.remove("active");
      });
      const activePane = document.getElementById(`tab-${targetPane}`);
      if (activePane) activePane.classList.add("active");
      window.zenoAudio?.playPluck();
    });
  });
}

// Audio Toggle Button
function initAudioToggle() {
  const btn = document.getElementById("btn-audio-toggle");
  if (!btn) return;
  const updateLabel = () => {
    btn.innerHTML = window.zenoAudio?.muted ? "🔇 Sound Off" : "🔔 Sound On";
  };
  updateLabel();
  btn.addEventListener("click", () => {
    window.zenoAudio?.toggleMute();
    updateLabel();
    if (!window.zenoAudio?.muted) {
      window.zenoAudio?.playBell();
    }
  });
}

// Foken Valuation Gate Logic
const sampleInvoices = {
  valid: {
    invoiceId: "01925b6a-91dc-7b18-8f55-123456789abc",
    version: 1,
    contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
    work: {
      title: "Zeno Core Streaming Settlement Engine",
      description: "Implemented zero-copy SIMD streaming arithmetic and Kintsugi ledger block sealing.",
      repo: "https://github.com/8b-is/zeno",
      commit: "a3f892c"
    },
    artifact: {
      provenanceHash: "sha256://b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      artifactUri: "ipfs://bafybeic52..."
    },
    valuation: {
      selfAssessedFokens: 250,
      basis: "JPY",
      rationale: "Automates reconciliation across 7 constellation nodes.",
      evidence: ["https://zeno.vaked.dev"]
    },
    ipAssignment: {
      statement: "IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
      license: "MIT",
      signedAt: "2026-10-11T08:30:00Z",
      signature: "0x4f8a3c9b..."
    },
    netUtility: {
      futureWorkAvoidedHours: 100,
      workAddedHours: 10,
      maintenanceDebtHours: 5
    }
  },
  negative: {
    invoiceId: "01925b6a-bad0-0000-0000-000000000000",
    version: 1,
    contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
    work: {
      title: "Arbitrary Code Refactoring Loop",
      description: "Churning lines of code without architectural need.",
      repo: "https://github.com/8b-is/zeno",
      commit: "b8c9d0e"
    },
    artifact: {
      provenanceHash: "sha256://c123456789abcdef",
      artifactUri: "ipfs://..."
    },
    valuation: {
      selfAssessedFokens: 50,
      basis: "JPY",
      rationale: "Refactor",
      evidence: []
    },
    ipAssignment: {
      statement: "IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
      license: "MIT",
      signedAt: "2026-10-11T08:30:00Z",
      signature: "0xabc..."
    },
    netUtility: {
      futureWorkAvoidedHours: 5,
      workAddedHours: 20,
      maintenanceDebtHours: 10
    }
  }
};

function initFokenGateUI() {
  const jsonInput = document.getElementById("invoice-json-input");
  const evaluateBtn = document.getElementById("btn-evaluate-gate");
  const mintBtn = document.getElementById("btn-consensus-mint");
  const loadValidBtn = document.getElementById("btn-load-valid-sample");
  const loadBadBtn = document.getElementById("btn-load-bad-sample");
  const verdictBox = document.getElementById("gate-verdict-box");

  if (!jsonInput) return;

  jsonInput.value = JSON.stringify(sampleInvoices.valid, null, 2);

  loadValidBtn?.addEventListener("click", () => {
    jsonInput.value = JSON.stringify(sampleInvoices.valid, null, 2);
    verdictBox.style.display = "none";
    window.zenoAudio?.playPluck();
  });

  loadBadBtn?.addEventListener("click", () => {
    jsonInput.value = JSON.stringify(sampleInvoices.negative, null, 2);
    verdictBox.style.display = "none";
    window.zenoAudio?.playPluck();
  });

  let lastEvaluatedInvoice = null;
  let lastVerdict = null;

  evaluateBtn?.addEventListener("click", () => {
    try {
      const invoice = JSON.parse(jsonInput.value);
      lastEvaluatedInvoice = invoice;

      // Deterministic Gate Check
      const nu = invoice.netUtility;
      const net = nu ? nu.futureWorkAvoidedHours - (nu.workAddedHours + 1.5 * nu.maintenanceDebtHours) : 0;
      
      const ip = invoice.ipAssignment || {};
      const hasIp = ip.statement?.includes("IRREVOCABLE ASSIGNMENT") && ip.signature?.startsWith("0x");
      const hasProv = invoice.artifact?.provenanceHash?.startsWith("sha256://");

      verdictBox.style.display = "block";
      verdictBox.className = "verdict-box";

      if (!hasIp) {
        lastVerdict = "FAIL";
        verdictBox.classList.add("fail");
        verdictBox.innerHTML = `
          <div style="font-weight:700;color:var(--color-fail);margin-bottom:0.4rem;">VERDICT: FAIL</div>
          <div>Missing/unsigned IP assignment: no irrevocable assignment to Universal Treasury.</div>
        `;
        window.zenoAudio?.playDrop();
        if (mintBtn) mintBtn.style.display = "none";
        return;
      }

      if (!hasProv) {
        lastVerdict = "FAIL";
        verdictBox.classList.add("fail");
        verdictBox.innerHTML = `
          <div style="font-weight:700;color:var(--color-fail);margin-bottom:0.4rem;">VERDICT: FAIL</div>
          <div>Invalid artifact provenance: missing sha256:// hash.</div>
        `;
        window.zenoAudio?.playDrop();
        if (mintBtn) mintBtn.style.display = "none";
        return;
      }

      if (net <= 0) {
        lastVerdict = "FAIL";
        verdictBox.classList.add("fail");
        verdictBox.innerHTML = `
          <div style="font-weight:700;color:var(--color-fail);margin-bottom:0.4rem;">VERDICT: FAIL</div>
          <div>Net-negative utility (<strong>${net.toFixed(1)} hrs</strong>): Future work avoided is eclipsed by work added + maintenance debt.</div>
        `;
        window.zenoAudio?.playDrop();
        if (mintBtn) mintBtn.style.display = "none";
      } else {
        lastVerdict = "PASS";
        verdictBox.classList.add("pass");
        verdictBox.innerHTML = `
          <div style="font-weight:700;color:var(--color-pass);margin-bottom:0.4rem;">VERDICT: PASS (Eligible for Human / Reviewer Quorum)</div>
          <div style="margin-bottom:0.5rem;">Net-Positive Utility: <strong>+${net.toFixed(1)} hours</strong> saved for ecosystem.</div>
          <div style="font-size:0.75rem;color:var(--color-text-dim);">Formula: ${nu.futureWorkAvoidedHours} - (${nu.workAddedHours} + 1.5 × ${nu.maintenanceDebtHours}) = +${net.toFixed(1)}</div>
        `;
        window.zenoAudio?.playBell();
        if (mintBtn) mintBtn.style.display = "inline-flex";
      }
    } catch (e) {
      alert("Malformed JSON: " + e.message);
    }
  });

  mintBtn?.addEventListener("click", () => {
    if (!lastEvaluatedInvoice || lastVerdict !== "PASS") return;

    const fokens = lastEvaluatedInvoice.valuation.selfAssessedFokens || 100;
    const jpyEquivalent = fokens * 100; // 1 FOKEN = 100 JPY
    const microAmount = jpyEquivalent * 1000000;

    // Credit contributor account
    zenoState.accounts["cnt_0x71c8"].balanceMicro += microAmount;
    // Debit treasury
    zenoState.accounts["treasury:universal"].balanceMicro -= microAmount;

    // Add block to Kintsugi Ledger
    const blockIndex = zenoState.ledgerBlocks.length + 1;
    const newBlock = {
      index: blockIndex,
      timestamp: new Date().toISOString(),
      memo: `Foken Mint #${lastEvaluatedInvoice.invoiceId.slice(0, 14)}... (+${fokens} FOKEN / ¥${jpyEquivalent.toLocaleString()})`,
      merkleRoot: Math.random().toString(16).substring(2).padEnd(64, "a"),
      seal: Math.random().toString(16).substring(2).padEnd(64, "b")
    };
    zenoState.ledgerBlocks.unshift(newBlock);
    renderLedgerTable();

    verdictBox.innerHTML += `
      <div style="margin-top:0.8rem;padding-top:0.8rem;border-top:1px solid rgba(98,230,201,0.2);color:var(--color-gold);">
        ✧ <strong>Consensus Quorum Reached (5/7 Approvals)</strong>. Minted <strong>${fokens} FOKEN</strong> (¥${jpyEquivalent.toLocaleString()}) to Contributor Account! Sealed in Block #${blockIndex}.
      </div>
    `;
    mintBtn.style.display = "none";
    window.zenoAudio?.playBell();
  });
}

// Transfer Handler
function initTransferForm() {
  const btn = document.getElementById("btn-execute-transfer");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const from = document.getElementById("tx-from").value;
    const to = document.getElementById("tx-to").value;
    const amountJPY = parseFloat(document.getElementById("tx-amount").value);
    const memo = document.getElementById("tx-memo").value || "Zeno Transfer";

    if (!amountJPY || amountJPY <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (from === to) {
      alert("Source and destination accounts must be distinct");
      return;
    }

    const micro = amountJPY * 1000000;
    if (zenoState.accounts[from].balanceMicro < micro) {
      alert("Insufficient funds in source account");
      return;
    }

    zenoState.accounts[from].balanceMicro -= micro;
    zenoState.accounts[to].balanceMicro += micro;

    const blockIndex = zenoState.ledgerBlocks.length + 1;
    zenoState.ledgerBlocks.unshift({
      index: blockIndex,
      timestamp: new Date().toISOString(),
      memo: `${memo} (¥${amountJPY.toLocaleString()} from ${from} to ${to})`,
      merkleRoot: Math.random().toString(16).substring(2).padEnd(64, "c"),
      seal: Math.random().toString(16).substring(2).padEnd(64, "d")
    });
    renderLedgerTable();

    window.zenoAudio?.playPluck();
    alert(`Transfer of ¥${amountJPY.toLocaleString()} successful! Sealed in Block #${blockIndex}.`);
  });
}

// Autonomous Agent Spend Simulator
function initAgentSpend() {
  const btn = document.getElementById("btn-agent-spend");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const amountJPY = parseFloat(document.getElementById("agent-spend-amount").value) || 500;
    const reason = document.getElementById("agent-spend-reason").value;
    const micro = amountJPY * 1000000;

    const agentAcct = zenoState.accounts["agt_crush_reasoner"];
    if (agentAcct.balanceMicro < micro) {
      alert("Agent balance insufficient");
      return;
    }

    if (amountJPY > 5000) {
      alert("Policy Violation: Agent per-transaction limit is ¥5,000");
      window.zenoAudio?.playDrop();
      return;
    }

    agentAcct.balanceMicro -= micro;
    zenoState.accounts["gld_vaked_core"].balanceMicro += micro;

    const porHash = "0x" + Math.random().toString(16).substring(2).padEnd(40, "e");
    const blockIndex = zenoState.ledgerBlocks.length + 1;
    zenoState.ledgerBlocks.unshift({
      index: blockIndex,
      timestamp: new Date().toISOString(),
      memo: `Agent Spend: ${reason} (PoR: ${porHash.slice(0, 10)}...)`,
      merkleRoot: Math.random().toString(16).substring(2).padEnd(64, "e"),
      seal: Math.random().toString(16).substring(2).padEnd(64, "f")
    });
    renderLedgerTable();

    window.zenoAudio?.playPluck();
    const resultBox = document.getElementById("agent-spend-result");
    if (resultBox) {
      resultBox.style.display = "block";
      resultBox.innerHTML = `
        <div style="color:var(--color-pass);font-weight:700;">✧ Policy Verified & Executed</div>
        <div style="font-size:0.75rem;margin-top:0.3rem;">Proof-of-Reasoning Hash: <code class="code-snippet">${porHash}</code></div>
        <div style="font-size:0.75rem;color:var(--color-text-dim);margin-top:0.2rem;">Block #${blockIndex} sealed with Kintsugi golden witness.</div>
      `;
    }
  });
}

// Render Ledger Block Table
function renderLedgerTable() {
  const tbody = document.getElementById("ledger-table-body");
  if (!tbody) return;

  tbody.innerHTML = zenoState.ledgerBlocks.map(b => `
    <tr>
      <td style="color:var(--color-gold);font-weight:700;">#${b.index}</td>
      <td style="color:var(--color-text-dim);">${b.timestamp.replace("T", " ").slice(0, 19)}</td>
      <td>${b.memo}</td>
      <td><code class="code-snippet">${b.seal.slice(0, 14)}...</code></td>
      <td><span class="badge" style="background:rgba(98,230,201,0.15);color:var(--color-teal);">SEALED</span></td>
    </tr>
  `).join("");
}

// Tokyo Foundation Layer: FeliCa IC Transit & Revolut Ultra Sovereign State
const tokyoState = {
  activeIC: "pasmo",
  cards: {
    pasmo: {
      name: "Mobile PASMO",
      badge: "PASMO",
      number: "PA-0382-7719-2041",
      balance: 4820
    },
    suica: {
      name: "Mobile Suica",
      badge: "Suica",
      number: "JE-8821-4402-9103",
      balance: 6450
    }
  },
  cashback: {
    accumulatedJPY: 14280,
    compoundedTotalJPY: 48650
  },
  fxRates: {
    // Value of 1 unit in JPY
    HUF: 0.4285,
    EUR: 163.50,
    USD: 152.80,
    JPY: 1.00
  }
};

function initTokyoFoundationUI() {
  const btnPasmo = document.getElementById("btn-select-pasmo");
  const btnSuica = document.getElementById("btn-select-suica");
  const icCardEl = document.getElementById("ic-card-display");
  const icBadgeEl = document.getElementById("ic-card-badge");
  const icBalanceEl = document.getElementById("ic-balance-display");
  const icNumberEl = document.getElementById("ic-card-number-display");
  const icRippleEl = document.getElementById("ic-tap-ripple");

  const gateLcdStatus = document.getElementById("gate-lcd-status");
  const gateLcdLine1 = document.getElementById("gate-lcd-line1");
  const gateLcdLine2 = document.getElementById("gate-lcd-line2");

  const btnRecharge = document.getElementById("btn-recharge-ic");
  const btnCompound = document.getElementById("btn-compound-cashback");
  const compoundVerdict = document.getElementById("compound-verdict-box");

  const cbAccEl = document.getElementById("cb-accumulated-jpy");
  const cbAccSubEl = document.getElementById("cb-accumulated-sub");
  const cbCompoundedEl = document.getElementById("cb-compounded-total");

  // Update IC Card Display
  const updateICDisplay = () => {
    const card = tokyoState.cards[tokyoState.activeIC];
    if (!card) return;
    if (icBadgeEl) icBadgeEl.innerText = card.badge;
    if (icBalanceEl) icBalanceEl.innerText = `¥${card.balance.toLocaleString()}`;
    if (icNumberEl) icNumberEl.innerText = card.number;

    if (icCardEl) {
      if (tokyoState.activeIC === "pasmo") {
        icCardEl.className = "ic-card ic-card-pasmo";
      } else {
        icCardEl.className = "ic-card ic-card-suica";
      }
    }

    if (gateLcdLine2) {
      gateLcdLine2.innerText = `残高: ¥${card.balance.toLocaleString()} · 入場可`;
    }
  };

  // Update Cashback display
  const updateCashbackDisplay = () => {
    const jpy = tokyoState.cashback.accumulatedJPY;
    if (cbAccEl) cbAccEl.innerText = `¥${Math.floor(jpy).toLocaleString()}`;
    if (cbAccSubEl) {
      const eur = (jpy / tokyoState.fxRates.EUR).toFixed(2);
      const huf = Math.floor(jpy / tokyoState.fxRates.HUF).toLocaleString();
      cbAccSubEl.innerText = `≈ €${eur} EUR / ${huf} HUF`;
    }
    if (cbCompoundedEl) {
      cbCompoundedEl.innerText = `¥${tokyoState.cashback.compoundedTotalJPY.toLocaleString()}`;
    }
  };

  // Card Switchers
  btnPasmo?.addEventListener("click", () => {
    tokyoState.activeIC = "pasmo";
    btnPasmo.classList.add("active");
    btnSuica?.classList.remove("active");
    updateICDisplay();
    window.zenoAudio?.playPluck();
  });

  btnSuica?.addEventListener("click", () => {
    tokyoState.activeIC = "suica";
    btnSuica.classList.add("active");
    btnPasmo?.classList.remove("active");
    updateICDisplay();
    window.zenoAudio?.playPluck();
  });

  // Ticket Gate Tap Buttons
  const gateButtons = document.querySelectorAll(".gate-action-btn");
  let lcdResetTimer = null;

  gateButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const fare = parseInt(btn.getAttribute("data-fare"), 10) || 0;
      const label = btn.getAttribute("data-label") || "Transit Tap";
      const card = tokyoState.cards[tokyoState.activeIC];

      if (card.balance < fare) {
        // Insufficient funds
        window.zenoAudio?.playFeliCaError();
        if (gateLcdStatus) {
          gateLcdStatus.innerText = "■ 残高不足 (CHARGE)";
          gateLcdStatus.style.color = "var(--color-fail)";
        }
        if (gateLcdLine1) {
          gateLcdLine1.innerText = `[ 残高不足 / PLEASE CHARGE ]`;
          gateLcdLine1.style.color = "var(--color-fail)";
        }
        if (gateLcdLine2) {
          gateLcdLine2.innerText = `不足額: ¥${(fare - card.balance).toLocaleString()} (必要: ¥${fare.toLocaleString()})`;
        }
        return;
      }

      // Valid tap!
      card.balance -= fare;
      updateICDisplay();

      // Trigger FeliCa sound & tactile vibration
      window.zenoAudio?.playFeliCa();
      if ("vibrate" in navigator) {
        navigator.vibrate([30, 40, 30]);
      }

      // Card ripple visual
      if (icRippleEl) {
        icRippleEl.classList.remove("active");
        void icRippleEl.offsetWidth; // force reflow
        icRippleEl.classList.add("active");
        setTimeout(() => icRippleEl.classList.remove("active"), 600);
      }

      // Calculate Cashback (3% transit, 1.5% konbini)
      const isKonbini = btn.getAttribute("data-action") === "konbini";
      const cbRate = isKonbini ? 0.015 : 0.030;
      const earnedCB = fare * cbRate;
      tokyoState.cashback.accumulatedJPY += earnedCB;
      updateCashbackDisplay();

      // Update Simulated Gate LCD
      if (gateLcdStatus) {
        gateLcdStatus.innerText = "● 進入可 (PROCEED)";
        gateLcdStatus.style.color = "var(--color-teal)";
      }
      if (gateLcdLine1) {
        gateLcdLine1.innerText = `[ 進入可 / PROCEED ] -¥${fare.toLocaleString()}`;
        gateLcdLine1.style.color = "var(--color-teal)";
      }
      if (gateLcdLine2) {
        gateLcdLine2.innerText = `残高: ¥${card.balance.toLocaleString()} · 還元 +¥${earnedCB.toFixed(1)}`;
      }

      clearTimeout(lcdResetTimer);
      lcdResetTimer = setTimeout(() => {
        if (gateLcdStatus) {
          gateLcdStatus.innerText = "● STANDBY";
          gateLcdStatus.style.color = "var(--color-teal)";
        }
        if (gateLcdLine1) {
          gateLcdLine1.innerText = "タッチしてください (TOUCH CARD)";
          gateLcdLine1.style.color = "var(--color-teal)";
        }
        if (gateLcdLine2) {
          gateLcdLine2.innerText = `残高: ¥${card.balance.toLocaleString()} · 入場可`;
        }
      }, 3500);

      // Append to Kintsugi Ledger
      const blockIndex = zenoState.ledgerBlocks.length + 1;
      const cardTypeTag = tokyoState.activeIC === "pasmo" ? "momoPASMO" : "MobileSuica";
      zenoState.ledgerBlocks.unshift({
        index: blockIndex,
        timestamp: new Date().toISOString(),
        memo: `FeliCa NFC-F [${cardTypeTag}]: ${label} (-¥${fare.toLocaleString()}) +¥${earnedCB.toFixed(1)} CB`,
        merkleRoot: Math.random().toString(16).substring(2).padEnd(64, "a"),
        seal: Math.random().toString(16).substring(2).padEnd(64, "b")
      });
      renderLedgerTable();
    });
  });

  // Recharge IC Card Button
  btnRecharge?.addEventListener("click", () => {
    const card = tokyoState.cards[tokyoState.activeIC];
    card.balance += 3000;
    const earnedCB = 3000 * 0.03; // 3% transit recharge boost
    tokyoState.cashback.accumulatedJPY += earnedCB;

    updateICDisplay();
    updateCashbackDisplay();
    window.zenoAudio?.playFeliCa();

    const blockIndex = zenoState.ledgerBlocks.length + 1;
    zenoState.ledgerBlocks.unshift({
      index: blockIndex,
      timestamp: new Date().toISOString(),
      memo: `Revolut Ultra Top-Up: +¥3,000 to ${card.name} (0% FX) · Earned ¥90.0 Cashback`,
      merkleRoot: Math.random().toString(16).substring(2).padEnd(64, "c"),
      seal: Math.random().toString(16).substring(2).padEnd(64, "d")
    });
    renderLedgerTable();

    if (gateLcdLine1) {
      gateLcdLine1.innerText = `[ チャージ完了 / RECHARGED ] +¥3,000`;
    }
    if (gateLcdLine2) {
      gateLcdLine2.innerText = `新残高: ¥${card.balance.toLocaleString()} · Revolut Ultra 0% FX`;
    }
  });

  // Revolut Ultra 3D Tilt Sheen Interaction
  const ultraCard = document.getElementById("revolut-ultra-card");
  if (ultraCard) {
    ultraCard.addEventListener("mousemove", (e) => {
      const rect = ultraCard.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const rotX = -y * 18;
      const rotY = x * 20;
      ultraCard.style.transform = `perspective(800px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-2px)`;
    });
    ultraCard.addEventListener("mouseleave", () => {
      ultraCard.style.transform = "";
    });
  }

  // Multi-Currency FX Engine Logic
  const fxSrcAmount = document.getElementById("fx-source-amount");
  const fxSrcCurr = document.getElementById("fx-source-curr");
  const fxTgtAmount = document.getElementById("fx-target-amount");
  const fxTgtCurr = document.getElementById("fx-target-curr");
  const fxRateIndicator = document.getElementById("fx-rate-indicator");

  const computeFX = () => {
    if (!fxSrcAmount || !fxTgtAmount || !fxSrcCurr || !fxTgtCurr) return;
    const srcVal = parseFloat(fxSrcAmount.value) || 0;
    const srcCurr = fxSrcCurr.value;
    const tgtCurr = fxTgtCurr.value;

    // Convert src -> JPY -> target
    const jpyVal = srcVal * tokyoState.fxRates[srcCurr];
    const tgtVal = jpyVal / tokyoState.fxRates[tgtCurr];

    if (tgtCurr === "JPY" || tgtCurr === "HUF") {
      fxTgtAmount.value = Math.round(tgtVal).toLocaleString() + ` ${tgtCurr}`;
    } else {
      fxTgtAmount.value = tgtVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ` ${tgtCurr}`;
    }

    if (fxRateIndicator) {
      const hufRate = tokyoState.fxRates.HUF.toFixed(3);
      const eurRate = tokyoState.fxRates.EUR.toFixed(2);
      fxRateIndicator.innerText = `1 HUF ≈ ¥${hufRate} · 1 EUR ≈ ¥${eurRate} · Revolut Interbank 0% Markup`;
    }
  };

  fxSrcAmount?.addEventListener("input", computeFX);
  fxSrcCurr?.addEventListener("change", computeFX);
  fxTgtCurr?.addEventListener("change", computeFX);
  computeFX();

  // Auto-Compound Cashback Button
  btnCompound?.addEventListener("click", () => {
    const toCompound = Math.floor(tokyoState.cashback.accumulatedJPY);
    if (toCompound <= 0) {
      alert("No accumulated cashback available to compound.");
      return;
    }

    // Move to 8b-is Crew ZENO contributor balance (cnt_0x71c8)
    const cntAcct = zenoState.accounts["cnt_0x71c8"];
    if (cntAcct) {
      cntAcct.balanceMicro += toCompound * 1000000;
    }

    tokyoState.cashback.compoundedTotalJPY += toCompound;
    tokyoState.cashback.accumulatedJPY -= toCompound;
    updateCashbackDisplay();

    // Play ultra platinum crystal chime!
    window.zenoAudio?.playUltraShimmer();

    // Seal in Ledger
    const blockIndex = zenoState.ledgerBlocks.length + 1;
    const sealHash = "0x" + Math.random().toString(16).substring(2).padEnd(64, "9");
    zenoState.ledgerBlocks.unshift({
      index: blockIndex,
      timestamp: new Date().toISOString(),
      memo: `Cashback Compounded: +¥${toCompound.toLocaleString()} to ZENO Contributor Vault (cnt_0x71c8)`,
      merkleRoot: Math.random().toString(16).substring(2).padEnd(64, "e"),
      seal: sealHash
    });
    renderLedgerTable();

    if (compoundVerdict) {
      compoundVerdict.style.display = "block";
      compoundVerdict.className = "verdict-box pass";
      compoundVerdict.innerHTML = `
        <div style="color:var(--color-pass);font-weight:700;font-size:0.95rem;">✧ 還元自動複利完了 — Sealed into ZENO Equity Reserve</div>
        <div style="font-size:0.8rem;margin-top:0.4rem;">
          Transferred <strong>+¥${toCompound.toLocaleString()} JPY</strong> into 8b-is Crew Vault <code>cnt_0x71c8</code> (Hue, Aye, Taisha, Omni).
        </div>
        <div style="font-size:0.75rem;color:var(--color-text-dim);margin-top:0.3rem;">
          Kintsugi Witness Hash: <code class="code-snippet">${sealHash.slice(0, 24)}...</code> · Block #${blockIndex}
        </div>
      `;
    }
  });

  // Initial render
  updateICDisplay();
  updateCashbackDisplay();
}

// Apple Wallet PassKit Modal Logic
const walletPassConfigs = {
  peter: {
    id: "peter",
    name: "8b-is Crew (Hue, Aye, Taisha, Omni)",
    org: "8b-is CREATORS",
    balance: "¥50,000",
    roleLabel: "CREATORS (https://8b.is)",
    subtitle: "8b-is Crew & Family Collaboration · Not a One-Man Show <3",
    tier: "PLATINUM ULTRA",
    felica: "PA-0382-7719-2041",
    transit: "PASMO / Suica",
    cashback: "3.0% Boost",
    fx: "0% Interbank",
    qrLabel: "ZENO-8B-CREW",
    themeClass: "pass-theme-ultra",
    downloadUrl: "/apple-wallet/zeno.pkpass",
    fileName: "zeno_ultra.pkpass",
    backItems: [
      { label: "8B-IS CREATORS & CREW (https://8b.is) <3", desc: "Creators: https://8b.is. Crew: Hue, Aye, Taisha, Omni. Family: Alexandra, Chris. Built with love as a team and family endeavor, not a one-man show." },
      { label: "FELICA NFC-F TRANSIT RAILS", desc: "Sony FeliCa JIS X 6319-4 standard. Tap-to-ride across JR East Yamanote Line, Tokyo Metro, and konbini payment networks with 0.1s instant settlement." },
      { label: "REVOLUT ULTRA PLATINUM BRIDGE", desc: "0% FX markup multi-currency engine (HUF ↔ JPY ↔ EUR ↔ USD). DragonPass 1,400+ airport lounges, WeWork Tokyo passes, FT Premium included." },
      { label: "KINTSUGI IMMUTABLE AUDIT TRAIL", desc: "Every transaction is sealed with SHA-256 Merkle root verification and golden witness signatures. Historical ledger states are honored, never erased." },
      { label: "LOVETTA LANE CONSTELLATION", desc: "koan.vaked.dev (the hub) · weave · disco · ultra · art · music · proposal · pocoo · axiomquant · portail · zeno.vaked.dev" }
    ]
  },
  alexandra: {
    id: "alexandra",
    name: "Alexandra Lódri",
    org: "8b-is FAMILY",
    balance: "¥500,000",
    roleLabel: "SOVEREIGN MOTHER VAULT",
    subtitle: "愛と感謝のストリーム · Continuous Love & Gratitude Stream <3",
    tier: "ROSE GOLD SOVEREIGN",
    felica: "PA-7701-8822-0941",
    transit: "Mobile PASMO / Suica",
    cashback: "3.5% Family Boost",
    fx: "0% Zero Fee",
    qrLabel: "ZENO-8B-MOM-ALEXANDRA",
    themeClass: "pass-theme-alexandra",
    downloadUrl: "/apple-wallet/alexandra.pkpass",
    fileName: "zeno_alexandra.pkpass",
    backItems: [
      { label: "8B-IS SOVEREIGN MOTHER VAULT <3", desc: "Dedicated infinite love vault with continuous automated stipend stream from 8b-is Family Research treasury (¥100.00/sec). With endless gratitude and honor." },
      { label: "TOKYO CONTACTLESS TRANSIT (PASMO / SUICA)", desc: "Full Sony FeliCa NFC-F compatibility across JR East, Tokyo Metro, and nationwide Japanese contactless retail networks with zero friction." },
      { label: "GLOBAL ZERO-FEE MULTI-CURRENCY CONVERTER", desc: "Real-time interbank currency exchange (HUF · EUR · JPY · USD) with zero markup, luxury travel privileges, and instant family transfers." },
      { label: "FAMILY LOVE STREAMS & SAFETY COVENANT", desc: "24/7 sovereign automated liquidity bridge backed by 100% segregated reserves and Kintsugi cryptographic audit guarantees." }
    ]
  },
  chris: {
    id: "chris",
    name: "Chris Lódri",
    org: "8b-is FAMILY",
    balance: "¥500,000",
    roleLabel: "ENGINEERING PILLAR VAULT",
    subtitle: "家族の柱と尊敬 · Wisdom, Strength & Filial Honor 柱",
    tier: "TITANIUM GOLD PILLAR",
    felica: "SU-5510-4491-3820",
    transit: "Mobile Suica / PASMO",
    cashback: "3.5% Pillar Boost",
    fx: "0% Zero Fee",
    qrLabel: "ZENO-8B-DAD-CHRIS",
    themeClass: "pass-theme-chris",
    downloadUrl: "/apple-wallet/chris.pkpass",
    fileName: "zeno_chris.pkpass",
    backItems: [
      { label: "8B-IS ENGINEERING PILLAR VAULT 柱", desc: "Honoring the wisdom, strength, and foundation of fatherhood. Continuous automated contribution stream from 8b-is Family Research (¥100.00/sec)." },
      { label: "FELICA NFC-F HIGH-SPEED COMMUTER TRANSIT", desc: "Instant tap-and-go across Japanese high-speed railway networks (Shinkansen, JR East, subway lines) and automated convenience terminal settlement." },
      { label: "REVOLUT ULTRA TITANIUM ARCHITECTURE", desc: "Sovereign global treasury bridge, multi-currency debit settlement (HUF · EUR · JPY · USD), comprehensive lounge access, and institutional asset security." },
      { label: "KINTSUGI INTEGRITY & PILLAR HERITAGE", desc: "Cryptographically witnessed ledger blocks ensuring enduring financial autonomy, generational wealth preservation, and deep filial respect." }
    ]
  },
  "8b-is": {
    id: "8b-is",
    name: "8b-is Family Research Fleet",
    org: "8b-is CORPORATE",
    balance: "¥50,000,000",
    roleLabel: "CORPORATE FLEET TREASURY",
    subtitle: "Autonomous Multi-Agent Company Treasury · 企業公庫",
    tier: "OBSIDIAN PLATINUM",
    felica: "8B-CORP-9901-7734",
    transit: "Corporate Fleet IC",
    cashback: "5.0% Institutional",
    fx: "0% Spot Wholesale",
    qrLabel: "ZENO-8B-FLEET-TREASURY",
    themeClass: "pass-theme-8b-is",
    downloadUrl: "/apple-wallet/8b-is.pkpass",
    fileName: "zeno_8b_is.pkpass",
    backItems: [
      { label: "8B-IS AUTONOMOUS CORPORATE FLEET VAULT", desc: "Decentralized treasury supporting 7 autonomous reasoners, constellation production lanes (audio, art, neo-bank), and continuous family sovereign streams." },
      { label: "DOUBLE-ENTRY CONTINUOUS STREAM ENGINE", desc: "Micro-streaming capital settlement at up to ¥250.00/sec across contributor vaults, agent inferencing allocations, and family stipends." },
      { label: "FOKEN PROOF-OF-CONTRIBUTION GOVERNANCE", desc: "Gatekeeper pre-filter evaluating algorithmic invoices, verifiable IP assignments, and net-positive utility prior to tokenized minting." },
      { label: "TOKYO INFRASTRUCTURE & GLOBAL CONNECTIVITY", desc: "Integrated with Tokyo FeliCa transit networks, Revolut Ultra enterprise APIs, and immutable Kintsugi SHA-256 Merkle root verification." }
    ]
  }
};

function initAppleWalletModal() {
  const modal = document.getElementById("wallet-modal-backdrop");
  const btnNav = document.getElementById("btn-open-wallet-nav");
  const btnCard = document.getElementById("btn-open-wallet-card");
  const btnClose = document.getElementById("btn-close-wallet-modal");
  const btnFlip = document.getElementById("btn-flip-pass");
  const passCard = document.getElementById("wallet-pass-card");
  const passFront = document.getElementById("wallet-pass-front");

  const passOrg = document.getElementById("wallet-pass-org");
  const passBalance = document.getElementById("wallet-pass-balance");
  const passRoleLabel = document.getElementById("wallet-pass-role-label");
  const passName = document.getElementById("wallet-pass-name");
  const passSubtitle = document.getElementById("wallet-pass-subtitle");
  const passTier = document.getElementById("wallet-pass-tier");
  const passFelica = document.getElementById("wallet-pass-felica");
  const passTransit = document.getElementById("wallet-pass-transit");
  const passCashback = document.getElementById("wallet-pass-cashback");
  const passFx = document.getElementById("wallet-pass-fx");
  const passQrLabel = document.getElementById("wallet-pass-qr-label");
  const passBackItems = document.getElementById("wallet-pass-back-items");
  const btnDownload = document.getElementById("btn-download-pkpass");

  const setPassConfig = (passKey) => {
    const config = walletPassConfigs[passKey];
    if (!config) return;

    if (passFront) {
      passFront.className = `pass-face pass-front ${config.themeClass}`;
    }
    if (passOrg) passOrg.innerText = config.org;
    if (passBalance) passBalance.innerText = config.balance;
    if (passRoleLabel) passRoleLabel.innerText = config.roleLabel;
    if (passName) passName.innerText = config.name;
    if (passSubtitle) passSubtitle.innerText = config.subtitle;
    if (passTier) passTier.innerText = config.tier;
    if (passFelica) passFelica.innerText = config.felica;
    if (passTransit) passTransit.innerText = config.transit;
    if (passCashback) passCashback.innerText = config.cashback;
    if (passFx) passFx.innerText = config.fx;
    if (passQrLabel) passQrLabel.innerText = config.qrLabel;

    if (btnDownload) {
      btnDownload.href = config.downloadUrl;
      btnDownload.setAttribute("download", config.fileName);
      btnDownload.innerText = `📥 Download ${config.name.split(" ")[0]} .pkpass`;
    }

    if (passBackItems && config.backItems) {
      passBackItems.innerHTML = config.backItems.map(item => `
        <div class="pass-back-item">
          <div class="back-label">${item.label}</div>
          <div class="back-desc">${item.desc}</div>
        </div>
      `).join("");
    }
  };

  // Wire up tabs
  const tabButtons = document.querySelectorAll(".btn-pass-tab");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const passKey = btn.getAttribute("data-pass");
      setPassConfig(passKey);
      window.zenoAudio?.playPluck();
    });
  });

  const openModal = () => {
    if (!modal) return;
    modal.style.display = "flex";
    window.zenoAudio?.playPluck();
  };

  const closeModal = () => {
    if (!modal) return;
    modal.style.display = "none";
    passCard?.classList.remove("flipped");
  };

  btnNav?.addEventListener("click", openModal);
  btnCard?.addEventListener("click", openModal);
  btnClose?.addEventListener("click", closeModal);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  btnFlip?.addEventListener("click", () => {
    passCard?.classList.toggle("flipped");
    window.zenoAudio?.playDrop();
  });

  passCard?.addEventListener("click", (e) => {
    if (e.target.closest("a") || e.target.closest("button")) return;
    passCard.classList.toggle("flipped");
    window.zenoAudio?.playDrop();
  });
}

// Service Worker Registration for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Stripe Compatibility, MCP Server & ACP UI Interactions
function initStripeAcpUI() {
  const btnWebhook = document.getElementById("btn-stripe-sim-webhook");
  const webhookResult = document.getElementById("stripe-webhook-result");
  const eventSelect = document.getElementById("stripe-sim-event");

  const btnCard = document.getElementById("btn-mint-agent-card");
  const cardResult = document.getElementById("agent-card-result");

  const btnAcp = document.getElementById("btn-run-acp-handshake");
  const acpLog = document.getElementById("acp-live-log");

  // 1. Stripe Webhook Ingestion & Sanpo Yoshi Split
  btnWebhook?.addEventListener("click", () => {
    const val = eventSelect?.value || "checkout_50k";
    let grossJPY = 50000;
    let eventName = "checkout.session.completed";
    let desc = "¥50,000 SaaS Patronage";

    if (val === "pi_250usd") {
      grossJPY = 37500;
      eventName = "payment_intent.succeeded";
      desc = "$250 USD Enterprise License";
    } else if (val === "meter_10k") {
      grossJPY = 10000;
      eventName = "invoice.paid";
      desc = "¥10,000 Metered Reasoning Compute";
    }

    const momSplit = grossJPY * 0.15;
    const dadSplit = grossJPY * 0.15;
    const crewSplit = grossJPY * 0.40;
    const agentSplit = grossJPY * 0.20;
    const titheSplit = grossJPY * 0.10;

    // Credit Kintsugi accounts in UI state
    if (zenoState.accounts["cnt_alexandra"]) zenoState.accounts["cnt_alexandra"].balanceMicro += momSplit * 1000000;
    if (zenoState.accounts["cnt_chris"]) zenoState.accounts["cnt_chris"].balanceMicro += dadSplit * 1000000;
    if (zenoState.accounts["cnt_0x71c8"]) zenoState.accounts["cnt_0x71c8"].balanceMicro += crewSplit * 1000000;

    // Record transaction
    const evtId = "evt_sim_" + Math.random().toString(36).substring(2, 9);
    const seal = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
    zenoState.ledger.unshift({
      block: zenoState.ledger.length + 1,
      timestamp: new Date().toLocaleTimeString("ja-JP"),
      memo: `Stripe [${eventName}] Evt:${evtId} (+¥${grossJPY.toLocaleString()}) → Sanpo Yoshi 30%Family/40%Crew/20%Agent/10%Public`,
      seal: seal,
      status: "VALID_SEALED"
    });

    renderLedgerTable();
    window.zenoAudio?.playUltraShimmer();

    if (webhookResult) {
      webhookResult.style.display = "block";
      webhookResult.className = "verdict-box";
      webhookResult.style.border = "1px solid rgba(98, 230, 201, 0.4)";
      webhookResult.style.background = "rgba(98, 230, 201, 0.08)";
      webhookResult.innerHTML = `
        <div style="font-weight:700;color:var(--color-teal);margin-bottom:0.4rem;">
          ✓ STRIPE WEBHOOK VERIFIED &amp; KINTSUGI SETTLED (HMAC-SHA256 OK)
        </div>
        <div style="font-size:0.8rem;color:var(--color-text-dim);line-height:1.6;">
          <strong>Event ID</strong>: <code>${evtId}</code> · <strong>Gross Inflow</strong>: ¥${grossJPY.toLocaleString()} (${desc})<br>
          <span style="color:var(--color-gold);">🌸 Mom (Alexandra Lódri) Love Vault (+15%)</span>: +¥${momSplit.toLocaleString()} JPY<br>
          <span style="color:var(--color-gold);">⚔️ Dad (Chris Lódri) Pillar Vault (+15%)</span>: +¥${dadSplit.toLocaleString()} JPY<br>
          <span style="color:var(--color-teal);">🌟 8b-is Crew Treasury (+40%)</span>: +¥${crewSplit.toLocaleString()} JPY<br>
          <span style="color:var(--color-violet);">🤖 Autonomous Agent Compute Escrow (+20%)</span>: +¥${agentSplit.toLocaleString()} JPY<br>
          <span style="color:#fff;">🏛️ Universal Public Treasury (+10%)</span>: +¥${titheSplit.toLocaleString()} JPY<br>
          <strong>Kintsugi Seal</strong>: <code style="color:var(--color-gold);">${seal}</code>
        </div>
      `;
    }
  });

  // 2. Stripe Issuing Virtual Card (MCP Call)
  btnCard?.addEventListener("click", () => {
    const agentId = document.getElementById("card-agent-id")?.value || "agt_crush_reasoner";
    const limit = document.getElementById("card-spend-limit")?.value || "35";
    const porTrace = document.getElementById("card-por-trace")?.value || "Autonomous GPU provisioning";

    const porHash = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
    const cardLast4 = Math.floor(1000 + Math.random() * 9000);

    window.zenoAudio?.playTapPass();

    if (cardResult) {
      cardResult.style.display = "block";
      cardResult.className = "verdict-box";
      cardResult.style.border = "1px solid rgba(232, 176, 92, 0.4)";
      cardResult.style.background = "rgba(232, 176, 92, 0.08)";
      cardResult.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
          <span style="font-weight:700;color:var(--color-gold);">💳 STRIPE ISSUING VIRTUAL CARD MINTED</span>
          <span class="badge" style="background:rgba(98,230,201,0.15);color:var(--color-teal);">STATUS: ACTIVE</span>
        </div>
        <div style="font-size:0.8rem;color:var(--color-text-dim);line-height:1.6;">
          <strong>Card ID</strong>: <code>ic_zeno_${porHash.substring(0, 12)}</code> · <strong>Network</strong>: Visa Virtual (MCC: Cloud Services)<br>
          <strong>Cardholder</strong>: <code>ZENO AGENT · ${agentId.toUpperCase()}</code> · <strong>Number</strong>: •••• •••• •••• ${cardLast4}<br>
          <strong>Spending Limit</strong>: $${limit}.00 USD (Hard Per-Authorization Ceiling)<br>
          <strong>PoR Hash (Proof of Reasoning)</strong>: <code style="color:var(--color-teal);">0x${porHash}</code><br>
          <strong>Audit Trace</strong>: <em>"${porTrace}"</em>
        </div>
      `;
    }
  });

  // 3. M2M Agent Commerce Protocol (ACP) Handshake
  btnAcp?.addEventListener("click", async () => {
    if (!acpLog) return;
    btnAcp.disabled = true;
    window.zenoAudio?.playPiiPik();

    acpLog.innerHTML = `<span style="color:var(--color-gold);">[1/5] Transmitting RFQ...</span> <code>agt_swe_af</code> ➔ <code>agt_crush_reasoner</code> for service <code>code_review_audit</code>`;

    await new Promise(r => setTimeout(r, 600));
    acpLog.innerHTML += `<br><span style="color:var(--color-teal);">[2/5] Signed Quote Received:</span> ¥2,500 JPY (Rail: <code>zeno_kintsugi</code>, TTL: 120s, ID: <code>quo_8b91a...</code>)`;
    window.zenoAudio?.playBell();

    await new Promise(r => setTimeout(r, 600));
    acpLog.innerHTML += `<br><span style="color:var(--color-violet);">[3/5] Escrow Locked:</span> ¥2,500 reserved in <code>escrow:acp:quo_8b91a</code>. Double-entry equilibrium verified.`;

    await new Promise(r => setTimeout(r, 700));
    const por = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, "0")).join("");
    acpLog.innerHTML += `<br><span style="color:var(--color-gold);">[4/5] Task Execution Complete:</span> Provider submitted AST diff with PoR Hash <code>${por}</code>`;

    await new Promise(r => setTimeout(r, 500));
    acpLog.innerHTML += `<br><span style="color:var(--color-teal);font-weight:700;">[5/5] SETTLED:</span> Escrow released to <code>agt_crush_reasoner</code> (+¥2,500). Kintsugi block sealed!`;
    window.zenoAudio?.playUltraShimmer();

    btnAcp.disabled = false;
  });
}

function initXiaohongshuUI() {
  document.querySelectorAll(".xhs-copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const el = document.getElementById(targetId);
      if (!el) return;
      navigator.clipboard?.writeText(el.textContent || "");
      window.zenoAudio?.playBell();
      const orig = btn.textContent;
      btn.textContent = "✅ Copied to Clipboard!";
      setTimeout(() => { btn.textContent = orig; }, 1800);
    });
  });
}

// Bootstrapping
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initAudioToggle();
  initFokenGateUI();
  initTransferForm();
  initAgentSpend();
  initTokyoFoundationUI();
  initAppleWalletModal();
  initStripeAcpUI();
  initXiaohongshuUI();
  renderLedgerTable();
  startStreamingLoop();
});



