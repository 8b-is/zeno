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
      label: "Alice Personal (個人)",
      type: "personal",
      currency: "JPY",
      balanceMicro: 250000 * 1000000, // 250,000 JPY
      owner: "0x3918aC92b8A375c3A7b0e..."
    },
    "cnt_0x71c8": {
      id: "cnt_0x71c8",
      label: "Péter Lódri (貢献者)",
      type: "contributor",
      currency: "JPY",
      balanceMicro: 50000 * 1000000, // 50,000 JPY
      owner: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940"
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
      label: "Zeno Architecture & Constellation DO Loop"
    },
    {
      id: "stm_cnt_to_agent",
      from: "cnt_0x71c8",
      to: "agt_crush_reasoner",
      rateMicroSec: 5 * 1000000, // 5 JPY/sec
      startTime: Date.now() - 1800000, // started 30 min ago
      label: "Autonomous Inference & Test Sweeps"
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

// Continuous Animation Loop (60fps requestAnimationFrame)
function startStreamingLoop() {
  const tick = () => {
    const now = Date.now();

    // Compute dynamic accrued amounts for streams
    let totalStreamedJPY = 0;
    const accountDeltas = {};
    for (const key of Object.keys(zenoState.accounts)) {
      accountDeltas[key] = 0;
    }

    zenoState.streams.forEach(stream => {
      const elapsedSec = (now - stream.startTime) / 1000;
      const accruedMicro = stream.rateMicroSec * elapsedSec;
      totalStreamedJPY += accruedMicro / 1000000;

      accountDeltas[stream.from] -= accruedMicro;
      accountDeltas[stream.to] += accruedMicro;
    });

    // Update Live Ticker
    const streamTickerEl = document.getElementById("ticker-streaming-rate");
    if (streamTickerEl) {
      const activeRateJPY = zenoState.streams.reduce((acc, s) => acc + (s.rateMicroSec / 1000000), 0);
      streamTickerEl.innerText = `¥${activeRateJPY.toFixed(2)}/s`;
    }

    const totalVolumeEl = document.getElementById("ticker-stream-volume");
    if (totalVolumeEl) {
      totalVolumeEl.innerText = `¥${totalStreamedJPY.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Update Account Balances in DOM
    for (const [acctId, acct] of Object.entries(zenoState.accounts)) {
      const el = document.getElementById(`balance-${acctId}`);
      if (el) {
        const liveMicro = acct.balanceMicro + accountDeltas[acctId];
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

// Bootstrapping
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initAudioToggle();
  initFokenGateUI();
  initTransferForm();
  initAgentSpend();
  renderLedgerTable();
  startStreamingLoop();
});
