/**
 * 8b-is / ZENO High-Performance Q-Wave Engine & Isomorphic Runtime
 * 
 * Sub-millisecond continuous ledger streaming, Q-Wave procedural DSP synthesis,
 * offline WAV rendering, Kintsugi double-entry balancing, and Foken net-utility gating.
 * 
 * Works identically in Node.js (server/CLI) and modern browsers (edge/client).
 * Zero runtime dependencies.
 * 
 * @version 1.2.0
 * @author 8b-is Family Research Foundation <3
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ZenoEngine = factory();
    root.QWave = root.ZenoEngine.QWave;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // --- 1. Q-WAVE PROCEDURAL DSP & AUDIO SYNTHESIZER ---

  class QWaveDSP {
    constructor(sampleRate = 44100) {
      this.sampleRate = sampleRate;
      this.A4_FREQ = 432.0; // Sacred 432 Hz Solfeggio standard
      this._initSineTable();
    }

    _initSineTable(size = 4096) {
      this._tableSize = size;
      this._sineTable = new Float32Array(size);
      for (let i = 0; i < size; i++) {
        this._sineTable[i] = Math.sin((i / size) * 2 * Math.PI);
      }
    }

    /**
     * Fast O(1) table lookup sine oscillator
     */
    fastSine(phase) {
      const idx = ((phase % 1.0 + 1.0) % 1.0) * this._tableSize;
      const i0 = Math.floor(idx);
      const frac = idx - i0;
      const i1 = (i0 + 1) % this._tableSize;
      return this._sineTable[i0] * (1.0 - frac) + this._sineTable[i1] * frac;
    }

    /**
     * Generate raw mono Float32 audio buffer for a given duration (seconds)
     */
    createBuffer(durationSec) {
      const numSamples = Math.floor(durationSec * this.sampleRate);
      return new Float32Array(numSamples);
    }

    /**
     * 鈴 (Rin) — 432 Hz Temple Singing Bowl (Fundamental + 864Hz + 1296Hz)
     */
    renderRin(durationSec = 2.4) {
      const buf = this.createBuffer(durationSec);
      const sr = this.sampleRate;
      const f1 = this.A4_FREQ; // 432
      const f2 = f1 * 2;       // 864
      const f3 = f1 * 3;       // 1296

      for (let i = 0; i < buf.length; i++) {
        const t = i / sr;
        // Natural exponential envelope with soft 20ms attack
        const env = t < 0.02 ? t / 0.02 : Math.exp(-t * 1.8);
        const s1 = Math.sin(2 * Math.PI * f1 * t);
        const s2 = Math.sin(2 * Math.PI * f2 * t) * 0.35;
        const s3 = Math.sin(2 * Math.PI * f3 * t) * 0.15;
        buf[i] = (s1 + s2 + s3) * env * 0.45;
      }
      return buf;
    }

    /**
     * 鹿威し (Shishi-odoshi) — Water Drop (1400Hz -> 450Hz chirp)
     */
    renderDrop(durationSec = 0.08) {
      const buf = this.createBuffer(durationSec);
      const sr = this.sampleRate;

      for (let i = 0; i < buf.length; i++) {
        const t = i / sr;
        const env = t < 0.005 ? t / 0.005 : Math.exp(-t * 45.0);
        // Exponential frequency sweep
        const freq = 1400.0 * Math.pow(450.0 / 1400.0, t / durationSec);
        const phase = 2 * Math.PI * freq * t;
        buf[i] = Math.sin(phase) * env * 0.4;
      }
      return buf;
    }

    /**
     * 改札 (FeliCa) — Tokyo Transit 2-Tone Chime (1760Hz -> 2349.3Hz)
     */
    renderFeliCa(durationSec = 0.22) {
      const buf = this.createBuffer(durationSec);
      const sr = this.sampleRate;

      for (let i = 0; i < buf.length; i++) {
        const t = i / sr;
        let s = 0.0;
        // Ping 1 (A6: 1760Hz, 0ms - 60ms)
        if (t < 0.06) {
          const t1 = t;
          const env1 = t1 < 0.004 ? t1 / 0.004 : Math.exp(-t1 * 50.0);
          s += Math.sin(2 * Math.PI * 1760.0 * t1) * env1 * 0.4;
        }
        // Ping 2 (D7: 2349.3Hz, 65ms - 220ms)
        if (t >= 0.065) {
          const t2 = t - 0.065;
          const env2 = t2 < 0.005 ? t2 / 0.005 : Math.exp(-t2 * 35.0);
          s += Math.sin(2 * Math.PI * 2349.3 * t2) * env2 * 0.45;
        }
        buf[i] = s;
      }
      return buf;
    }

    /**
     * 白金 (Platinum Shimmer) — Revolut Ultra 4-Note Arpeggiated Sheen
     */
    renderUltraShimmer(durationSec = 0.75) {
      const buf = this.createBuffer(durationSec);
      const sr = this.sampleRate;
      const freqs = [1046.5, 1318.5, 1567.98, 2093.0]; // C6, E6, G6, C7
      const step = 0.035;

      for (let i = 0; i < buf.length; i++) {
        const t = i / sr;
        let s = 0.0;
        for (let idx = 0; idx < freqs.length; idx++) {
          const startTime = idx * step;
          if (t >= startTime) {
            const dt = t - startTime;
            const env = dt < 0.006 ? dt / 0.006 : Math.exp(-dt * 6.5);
            s += Math.sin(2 * Math.PI * freqs[idx] * dt) * env * (0.25 / (idx + 1));
          }
        }
        buf[i] = s;
      }
      return buf;
    }

    /**
     * Convert Float32Array mono buffer to standard 16-bit PCM WAV binary format (ArrayBuffer)
     * Suitable for writing .wav files in Node.js or serving via HTTP/Blob.
     */
    exportWav(float32Buffer) {
      const numSamples = float32Buffer.length;
      const byteRate = this.sampleRate * 2; // 16-bit mono = 2 bytes per sample
      const blockAlign = 2;
      const dataSize = numSamples * 2;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);

      // RIFF header
      this._writeString(view, 0, "RIFF");
      view.setUint32(4, 36 + dataSize, true);
      this._writeString(view, 8, "WAVE");

      // fmt subchunk
      this._writeString(view, 12, "fmt ");
      view.setUint32(16, 16, true);          // SubChunk1Size (16 for PCM)
      view.setUint16(20, 1, true);           // AudioFormat (1 = PCM)
      view.setUint16(22, 1, true);           // NumChannels (1 = Mono)
      view.setUint32(24, this.sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, 16, true);          // BitsPerSample

      // data subchunk
      this._writeString(view, 36, "data");
      view.setUint32(40, dataSize, true);

      // Write PCM samples (clipped to [-1.0, 1.0])
      let offset = 44;
      for (let i = 0; i < numSamples; i++) {
        let sample = float32Buffer[i];
        if (sample < -1.0) sample = -1.0;
        if (sample > 1.0) sample = 1.0;
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }

      return buffer;
    }

    _writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
  }

  // --- 2. HIGH-PERFORMANCE CONTINUOUS MICRO-STREAMING LEDGER ---

  class ContinuousStreamEngine {
    constructor(initialBalanceJpy = 50000.0, streamRateJpyPerSec = 0.42) {
      // Internal tracking uses micro-units (1 JPY = 1,000,000 micro-JPY) for exact integer arithmetic
      this.MICRO = 1000000n;
      this.balanceMicro = BigInt(Math.round(initialBalanceJpy * 1000000));
      this.rateMicroPerSec = BigInt(Math.round(streamRateJpyPerSec * 1000000));
      this.lastTickTimeUs = this._nowUs();
    }

    _nowUs() {
      if (typeof performance !== "undefined" && performance.now) {
        return BigInt(Math.floor(performance.now() * 1000));
      }
      return BigInt(Date.now() * 1000);
    }

    /**
     * Advance ledger by dt microseconds. Zero heap allocation loop.
     */
    tick(targetTimeUs = null) {
      const now = targetTimeUs !== null ? targetTimeUs : this._nowUs();
      const dtUs = now - this.lastTickTimeUs;
      if (dtUs > 0n) {
        // balance += (rate * dtUs) / 1,000,000
        const delta = (this.rateMicroPerSec * dtUs) / 1000000n;
        this.balanceMicro += delta;
        this.lastTickTimeUs = now;
      }
      return this.getBalanceFloat();
    }

    getBalanceFloat() {
      return Number(this.balanceMicro) / 1000000;
    }

    deposit(amountJpy) {
      if (typeof amountJpy !== "number" || !Number.isFinite(amountJpy) || amountJpy <= 0) {
        throw new RangeError("Deposit must be a positive finite number");
      }
      this.balanceMicro += BigInt(Math.round(amountJpy * 1000000));
      return this.getBalanceFloat();
    }

    spend(amountJpy) {
      if (typeof amountJpy !== "number" || !Number.isFinite(amountJpy) || amountJpy <= 0) {
        throw new RangeError("Spend must be a positive finite number");
      }
      const spendMicro = BigInt(Math.round(amountJpy * 1000000));
      if (spendMicro > this.balanceMicro) {
        throw new Error("Insufficient funds in sovereign vault");
      }
      this.balanceMicro -= spendMicro;
      return this.getBalanceFloat();
    }
  }

  // --- 3. FOKEN GATE EVALUATOR ---

  class FokenGateValidator {
    /**
     * Evaluates proof-of-contribution invoice in < 0.1ms
     */
    static evaluate(invoice) {
      const invId = invoice?.invoiceId || "unknown";
      const required = ["invoiceId", "version", "contributor", "work", "artifact", "valuation", "ipAssignment"];

      for (const field of required) {
        if (!invoice || invoice[field] === undefined || invoice[field] === null) {
          return { invoiceId: invId, verdict: "FAIL", reason: `Missing required field: ${field}` };
        }
      }

      if (typeof invoice.contributor !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(invoice.contributor)) {
        return { invoiceId: invId, verdict: "FAIL", reason: "Invalid Ethereum/Polygon contributor address" };
      }

      if (typeof invoice.artifact.provenanceHash !== "string" || !/^sha256:\/\/[0-9a-zA-Z_-]{8,}$/.test(invoice.artifact.provenanceHash)) {
        return { invoiceId: invId, verdict: "FAIL", reason: "Artifact provenanceHash must use sha256://" };
      }

      const val = invoice.valuation;
      const avoided = Number(val.futureWorkAvoidedHours);
      const added = Number(val.workAddedHours);
      const debt = Number(val.maintenanceDebtHours);
      const claimedNet = Number(val.netUtilityHours);
      if (
        !Number.isFinite(avoided) || avoided < 0 || avoided > 1_000_000 ||
        !Number.isFinite(added) || added < 0 || added > 1_000_000 ||
        !Number.isFinite(debt) || debt < 0 || debt > 1_000_000 ||
        !Number.isFinite(claimedNet)
      ) {
        return { invoiceId: invId, verdict: "FAIL", reason: "Valuation hour fields must be finite non-negative numbers" };
      }
      const netCalculated = avoided - (added + 1.5 * debt);

      if (netCalculated <= 0) {
        return {
          invoiceId: invId,
          verdict: "REJECT",
          netUtilityHours: netCalculated,
          reason: "Negative or zero net contribution utility"
        };
      }

      if (Math.abs(netCalculated - claimedNet) > 0.01) {
        return {
          invoiceId: invId,
          verdict: "FAIL",
          reason: `Net utility mismatch: claimed ${claimedNet}, formula calculated ${netCalculated.toFixed(2)}`
        };
      }

      const tokenAmount = Math.floor(netCalculated * 100);

      return {
        invoiceId: invId,
        verdict: "PASS",
        contributor: invoice.contributor,
        netUtilityHours: netCalculated,
        tokensAwarded: tokenAmount,
        settlementJpy: tokenAmount * 100, // 100 JPY per FOKEN
        timestamp: new Date().toISOString()
      };
    }
  }

  // --- 4. KINTSUGI LEDGER BALANCER ---

  class KintsugiLedger {
    /**
     * Verify double-entry zero-sum invariant: sum(postings.amount) == 0
     */
    static verifyPostings(postings) {
      if (!Array.isArray(postings) || postings.length < 2) {
        return { valid: false, reason: "At least 2 postings required for double entry" };
      }

      let sum = 0n;
      for (const p of postings) {
        if (typeof p.amount !== "number" && typeof p.amount !== "bigint") {
          return { valid: false, reason: "Posting amount must be numeric" };
        }
        sum += BigInt(Math.round(Number(p.amount) * 1000));
      }

      if (sum !== 0n) {
        return { valid: false, reason: `Unbalanced transaction: sum = ${Number(sum) / 1000}` };
      }

      return { valid: true };
    }

    /**
     * Prunes dead OTP/3DS challenges older than ttlMs and returns pruned IDs + surviving map,
     * while accumulating cumulative otpSweptTotal across invocations.
     */
    static sweepExpiredChallenges(challenges, nowMs = Date.now(), ttlMs = 120000) {
      const pruned = [];
      const active = [];
      for (const ch of challenges || []) {
        if (nowMs - Number(ch.born) > ttlMs) {
          pruned.push({ id: ch.id, trit: -1, reason: "3DS_OTP_EXPIRED" });
        } else {
          active.push(ch);
        }
      }
      KintsugiLedger.otpSweptTotal = (KintsugiLedger.otpSweptTotal || 0) + pruned.length;
      return {
        prunedCount: pruned.length,
        otpSweptTotal: KintsugiLedger.otpSweptTotal,
        sweptTotal: KintsugiLedger.otpSweptTotal,
        pruned,
        activeCount: active.length,
        active
      };
    }

    /**
     * Registers a one-shot or recurring scheduled payment in the ledger registry.
     */
    static schedulePayment(item) {
      const intervalMs = Number(item.intervalMs) || 0;
      const maxRuns = item.maxRuns !== undefined && item.maxRuns !== null
        ? Number(item.maxRuns)
        : (intervalMs > 0 ? Infinity : 1);
      const executeAtMs = Number(item.executeAtMs ?? item.executeAt ?? 0);
      const job = {
        ...item,
        executeAtMs,
        executeAt: executeAtMs,
        intervalMs,
        maxRuns,
        runCount: Number(item.runCount) || 0,
        status: "pending",
        trit: 0
      };
      if (job.id) {
        KintsugiLedger.scheduledRegistry.set(job.id, job);
      }
      return job;
    }

    /**
     * Cancels a pending scheduled payment by id (or queue + id, or job reference).
     */
    static cancelScheduledPayment(idOrQueue, maybeId = undefined) {
      let target = null;
      let id = maybeId;
      if (Array.isArray(idOrQueue)) {
        target = idOrQueue.find((item) => item && item.id === maybeId) || null;
      } else if (typeof idOrQueue === "string") {
        id = idOrQueue;
        target = KintsugiLedger.scheduledRegistry.get(id) || null;
      } else if (idOrQueue && typeof idOrQueue === "object") {
        target = idOrQueue;
        id = idOrQueue.id;
      }
      if (!target) {
        return { cancelled: false, id, error: "NOT_FOUND", status: 404 };
      }
      if (target.status && target.status !== "pending") {
        return { cancelled: false, id, status: target.status, error: "ALREADY_PROCESSED", code: 409, job: target };
      }
      target.status = "cancelled";
      target.trit = -1;
      if (id) {
        KintsugiLedger.scheduledRegistry.set(id, target);
      }
      return { cancelled: true, id, status: "cancelled", trit: -1, job: target };
    }

    /**
     * Executes scheduled payments due at or before nowMs while preserving double-entry balance.
     * Supports recurring payments (intervalMs, maxRuns, runCount), registry lookup and
     * cancelled items. Amounts and balances are safe integers in the caller's smallest unit.
     */
    static executeScheduledBatch(queue, balances, nowMs = Date.now()) {
      if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
        throw new RangeError("nowMs must be a non-negative safe integer timestamp");
      }
      if (queue != null && !Array.isArray(queue)) {
        throw new TypeError("queue must be an array");
      }
      if (!balances || typeof balances !== "object" || Array.isArray(balances)) {
        throw new TypeError("balances must be an account map");
      }
      const settled = [];
      const pending = [];
      const rejected = [];
      const cancelled = [];
      const validAccount = account => typeof account === "string" && account.trim().length > 0
        && !["__proto__", "constructor", "prototype"].includes(account);
      const balanceOf = account => Object.prototype.hasOwnProperty.call(balances, account)
        ? balances[account] : 0;
      const items = queue || [...KintsugiLedger.scheduledRegistry.values()];
      for (const item of items) {
        const regItem = item && item.id ? KintsugiLedger.scheduledRegistry.get(item.id) : null;
        if (!item || typeof item !== "object" || Array.isArray(item)
          || !validAccount(item.from) || !validAccount(item.to)) {
          rejected.push({ ...item, trit: -1, reason: "INVALID_TRANSFER" });
          continue;
        }
        if (item.executeAtMs === undefined && item.executeAt !== undefined) {
          item.executeAtMs = item.executeAt;
        }
        if (item.status === "cancelled" || (regItem && regItem.status === "cancelled")) {
          item.status = "cancelled";
          item.trit = -1;
          cancelled.push({ ...item, status: "cancelled", trit: -1 });
          continue;
        }
        if (item.status === "executed") {
          continue;
        }
        if (!Number.isSafeInteger(item.amount) || item.amount <= 0) {
          item.status = "rejected";
          item.trit = -1;
          rejected.push({ ...item, status: "rejected", trit: -1, reason: "INVALID_AMOUNT" });
          continue;
        }
        if (!Number.isSafeInteger(item.executeAtMs) || item.executeAtMs < 0) {
          item.status = "rejected";
          item.trit = -1;
          rejected.push({ ...item, status: "rejected", trit: -1, reason: "INVALID_TIMESTAMP" });
          continue;
        }
        if (item.executeAtMs > nowMs) {
          item.status = item.status || "pending";
          item.trit = 0;
          pending.push({ ...item, executeAtMs: item.executeAtMs, executeAt: item.executeAtMs, runCount: Number(item.runCount) || 0, status: "pending", trit: 0 });
          continue;
        }
        const fromBal = balanceOf(item.from);
        const toBal = balanceOf(item.to);
        if (!Number.isSafeInteger(fromBal) || fromBal < 0 || !Number.isSafeInteger(toBal) || toBal < 0) {
          item.status = "rejected";
          item.trit = -1;
          rejected.push({ ...item, status: "rejected", trit: -1, reason: "INVALID_BALANCE" });
          continue;
        }
        if (fromBal < item.amount) {
          item.status = "rejected";
          item.trit = -1;
          rejected.push({ ...item, status: "rejected", trit: -1, reason: "INSUFFICIENT_FUNDS" });
          continue;
        }
        // Check both sides before posting; a self-transfer has no net balance change.
        if (item.from !== item.to) {
          const nextToBal = toBal + item.amount;
          if (!Number.isSafeInteger(nextToBal)) {
            item.status = "rejected";
            item.trit = -1;
            rejected.push({ ...item, status: "rejected", trit: -1, reason: "BALANCE_OVERFLOW" });
            continue;
          }
          balances[item.from] = fromBal - item.amount;
          balances[item.to] = nextToBal;
        }
        // Recurrence bookkeeping: advance executeAtMs and runCount until maxRuns.
        const runCount = (Number(item.runCount) || 0) + 1;
        const intervalMs = Number(item.intervalMs) || 0;
        const maxRuns = item.maxRuns !== undefined && item.maxRuns !== null
          ? Number(item.maxRuns)
          : (intervalMs > 0 ? Infinity : 1);
        item.runCount = runCount;
        item.intervalMs = intervalMs;
        item.maxRuns = maxRuns;
        if (intervalMs > 0 && runCount < maxRuns) {
          const nextExecuteAtMs = item.executeAtMs + intervalMs;
          item.executeAtMs = nextExecuteAtMs;
          item.executeAt = nextExecuteAtMs;
          item.status = "pending";
          item.trit = 0;
          settled.push({ ...item, runCount, maxRuns, intervalMs, executeAtMs: nextExecuteAtMs, executeAt: nextExecuteAtMs, status: "pending", trit: 1 });
          pending.push({ ...item, runCount, maxRuns, intervalMs, executeAtMs: nextExecuteAtMs, executeAt: nextExecuteAtMs, status: "pending", trit: 0 });
        } else {
          item.status = "executed";
          item.trit = 1;
          settled.push({ ...item, runCount, maxRuns, intervalMs, status: "executed", trit: 1 });
        }
      }
      return { settled, pending, rejected, cancelled, balances };
    }
  }

  KintsugiLedger.otpSweptTotal = 0;
  KintsugiLedger.scheduledRegistry = new Map();

  // --- 5. ZENO US USDC + USDT 1:1 RESERVE & FX ENGINE (ZERO-FLOAT BIGINT) ---

  const MICRO_USD = 1000000n;
  const US_STABLES = Object.freeze(["USDC", "USDT"]);
  const FORBIDDEN_ACCOUNT_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const SOLANA_MAINNET = Object.freeze({
    NETWORK: "solana-mainnet-beta",
    USDC_MINT: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT_MINT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    TOKEN_PROGRAM: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    VAKED_POLYGON_ERC20: "0x2Ae7DA713A2c8527AF70825C0F79632AF2e2ae4A",
  });

  const STABLECOIN_NETWORKS = Object.freeze({
    solana: Object.freeze({
      id: "solana",
      name: "Solana Mainnet",
      chainId: "mainnet-beta",
      addressKind: "solana",
      usdcContract: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      usdtContract: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      avgFinality: "~0.4s",
      typicalFee: "~$0.001",
    }),
    base: Object.freeze({
      id: "base",
      name: "Base L2",
      chainId: 8453,
      addressKind: "evm",
      usdcContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      usdtContract: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      avgFinality: "~2s",
      typicalFee: "<$0.01",
    }),
    ethereum: Object.freeze({
      id: "ethereum",
      name: "Ethereum L1",
      chainId: 1,
      addressKind: "evm",
      usdcContract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      usdtContract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      avgFinality: "~12s",
      typicalFee: "$0.50-$3",
    }),
    arbitrum: Object.freeze({
      id: "arbitrum",
      name: "Arbitrum One",
      chainId: 42161,
      addressKind: "evm",
      usdcContract: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      usdtContract: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      avgFinality: "~1s",
      typicalFee: "<$0.02",
    }),
    polygon: Object.freeze({
      id: "polygon",
      name: "Polygon PoS",
      chainId: 137,
      addressKind: "evm",
      usdcContract: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      usdtContract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      avgFinality: "~2s",
      typicalFee: "<$0.01",
    }),
    optimism: Object.freeze({
      id: "optimism",
      name: "OP Mainnet",
      chainId: 10,
      addressKind: "evm",
      usdcContract: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      usdtContract: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      avgFinality: "~2s",
      typicalFee: "<$0.01",
    }),
    tron: Object.freeze({
      id: "tron",
      name: "Tron TRC-20 (USDT)",
      chainId: "tron-mainnet",
      addressKind: "tron",
      usdcContract: null,
      usdtContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      avgFinality: "~3s",
      typicalFee: "$0.30-$1",
    }),
  });

  const SUBSCRIPTION_PLANS = Object.freeze({
    free: Object.freeze({
      id: "free",
      name: "Free",
      monthlyFeeMicro: 0n,
      autoTradeBps: 50n,
      bridgeBps: 25n,
      includedApiCalls: 500,
    }),
    plus: Object.freeze({
      id: "plus",
      name: "ZENO Plus",
      monthlyFeeMicro: 9990000n,
      autoTradeBps: 25n,
      bridgeBps: 15n,
      includedApiCalls: 10000,
    }),
    ultra_quant: Object.freeze({
      id: "ultra_quant",
      name: "ZENO Ultra Quant",
      monthlyFeeMicro: 49000000n,
      autoTradeBps: 10n,
      bridgeBps: 5n,
      includedApiCalls: 100000,
    }),
    institutional: Object.freeze({
      id: "institutional",
      name: "Institutional",
      monthlyFeeMicro: 199000000n,
      autoTradeBps: 5n,
      bridgeBps: 2n,
      includedApiCalls: 1000000,
    }),
  });

  const USAGE_RATES_MICRO = Object.freeze({
    API_CALL_OVERAGE: 500n,
    AUTO_TRADE_TICK: 10000n,
    CROSS_CHAIN_BRIDGE_MIN: 50000n,
    DISPOSABLE_CARD_MINT: 250000n,
  });

  const FX_RATES_PQ = Object.freeze({
    USD: Object.freeze({ num: 1n, den: 1n, symbol: "$", decimals: 2 }),
    JPY: Object.freeze({ num: 15250n, den: 100n, symbol: "¥", decimals: 0 }),
    EUR: Object.freeze({ num: 92n, den: 100n, symbol: "€", decimals: 2 }),
    GBP: Object.freeze({ num: 79n, den: 100n, symbol: "£", decimals: 2 }),
    HUF: Object.freeze({ num: 36850n, den: 100n, symbol: "Ft ", decimals: 0 }),
  });

  function _gcdBigInt(a, b) {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x === 0n ? 1n : x;
  }

  function _fnv1a64Hex(str, seed = 0xcbf29ce484222325n) {
    let h = seed;
    const prime = 0x100000001b3n;
    const mask = 0xffffffffffffffffn;
    for (let i = 0; i < str.length; i++) {
      h ^= BigInt(str.charCodeAt(i));
      h = (h * prime) & mask;
    }
    return h.toString(16).padStart(16, "0");
  }

  function _toBigIntMicro(value, label = "amountMicro") {
    if (typeof value === "bigint") {
      if (value <= 0n) throw new RangeError(`${label} must be > 0n`);
      return value;
    }
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      return BigInt(value);
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
      const parsed = BigInt(value);
      if (parsed > 0n) return parsed;
    }
    throw new RangeError(`${label} must be a positive integer micro-USD value`);
  }

  class StablecoinReserveEngine {
    constructor(seedState = null) {
      if (seedState && typeof seedState === "object" && !Array.isArray(seedState)) {
        const usdc = BigInt(seedState.reserves?.USDC ?? -1n);
        const usdt = BigInt(seedState.reserves?.USDT ?? -1n);
        if (usdc < 0n || usdt < 0n) {
          throw new RangeError("Seeded stablecoin reserves cannot be negative or missing");
        }
        this.reserves = { USDC: usdc, USDT: usdt };
        this.accounts = Object.create(null);
        for (const [tag, bal] of Object.entries(seedState.accounts || {})) {
          if (FORBIDDEN_ACCOUNT_KEYS.has(tag)) {
            throw new Error("Forbidden prototype key in seedState");
          }
          const cleanTag = this._normalizeTag(tag);
          if (Object.hasOwn(this.accounts, cleanTag)) {
            throw new Error(`Duplicate canonical tag in seedState: ${cleanTag}`);
          }
          const parsedBal = BigInt(bal);
          if (parsedBal < 0n) {
            throw new RangeError(`Account balance for ${cleanTag} cannot be negative`);
          }
          this.accounts[cleanTag] = parsedBal;
        }
        if (!Array.isArray(seedState.receipts) || seedState.receipts.length === 0) {
          throw new Error("seedState receipts must be a non-empty array");
        }
        this.receipts = seedState.receipts.map((r) => {
          if (!r || typeof r !== "object" || Array.isArray(r) || typeof r.seal !== "string" || typeof r.memo !== "string") {
            throw new Error("Malformed receipt in seedState");
          }
          BigInt(r.amountMicro);
          return r;
        });
        this.chainHead = typeof seedState.chainHead === "string" && /^0x62[0-9a-f]{16}$/.test(seedState.chainHead)
          ? seedState.chainHead
          : (() => { throw new Error("Invalid chainHead in seedState"); })();
        if (!Number.isSafeInteger(seedState.seq) || seedState.seq < 1) {
          throw new RangeError("Invalid seq in seedState");
        }
        this.seq = seedState.seq;
        this.plans = Object.create(null);
        if (seedState.plans && typeof seedState.plans === "object" && !Array.isArray(seedState.plans)) {
          for (const [tag, planId] of Object.entries(seedState.plans)) {
            if (!FORBIDDEN_ACCOUNT_KEYS.has(tag) && Object.hasOwn(SUBSCRIPTION_PLANS, planId)) {
              this.plans[this._normalizeTag(tag)] = planId;
            }
          }
        }
        const audit = this.verifyDoubleEntryAudit();
        if (!audit.valid) {
          throw new Error(`Tampered seedState rejected: ${audit.reason || "unbalanced"}`);
        }
      } else {
        // Default US seed: $52,040.50 exact 1:1 backed by USDC ($31,240.50) + USDT ($20,800.00)
        this.reserves = {
          USDC: 31240500000n,
          USDT: 20800000000n,
        };
        this.accounts = Object.assign(Object.create(null), {
          "$you": 12840500000n,
          "$alexandra": 5000000000n,
          "$chris": 5000000000n,
          "$yves": 4200000000n,
          "$8bis": 25000000000n,
        });
        this.seq = 1;
        this.plans = Object.create(null);
        const genesisSeal = _fnv1a64Hex("0x62|GENESIS|USDC:31240500000|USDT:20800000000");
        this.chainHead = `0x62${genesisSeal}`;
        this.receipts = [
          {
            seq: 1,
            kind: "GENESIS_RESERVE_ATTESTATION",
            asset: "USDC+USDT",
            amountMicro: "52040500000",
            memo: "1:1 Segregated USDC ($31,240.50) + USDT ($20,800.00) Reserve",
            seal: this.chainHead,
            gate: "0x62",
            timestamp: new Date().toISOString(),
            postings: [
              { account: "asset:stable:usdc_reserve", amount: "31240500000" },
              { account: "asset:stable:usdt_reserve", amount: "20800000000" },
              { account: "liability:us:all_holders", amount: "-52040500000" },
            ],
          },
        ];
      }
    }

    _sealReceipt(kind, asset, amountMicro, postings, memo) {
      let sum = 0n;
      for (const p of postings) {
        sum += BigInt(p.amount);
      }
      if (sum !== 0n) {
        throw new Error(`Double-entry invariant violated: sum = ${sum.toString()}`);
      }
      this.seq += 1;
      const payload = `${this.chainHead}|${this.seq}|${kind}|${asset}|${amountMicro.toString()}|${memo}`;
      const seal = `0x62${_fnv1a64Hex(payload)}`;
      this.chainHead = seal;
      const receipt = {
        seq: this.seq,
        kind,
        asset,
        amountMicro: amountMicro.toString(),
        memo,
        seal,
        gate: "0x62",
        timestamp: new Date().toISOString(),
        postings: postings.map((p) => ({ account: p.account, amount: BigInt(p.amount).toString() })),
      };
      this.receipts.unshift(receipt);
      if (this.receipts.length > 50) this.receipts.length = 50;
      return receipt;
    }

    _normalizeTag(tag) {
      const clean = String(tag || "").trim().toLowerCase();
      if (FORBIDDEN_ACCOUNT_KEYS.has(clean) || !/^\$[a-z0-9_]{2,20}$/.test(clean)) {
        throw new Error("Invalid $zenotag: must match ^\\$[a-z0-9_]{2,20}$");
      }
      return clean;
    }

    _normalizeAsset(asset) {
      const upper = String(asset || "").trim().toUpperCase();
      if (!US_STABLES.includes(upper)) {
        throw new Error(`Unsupported stablecoin asset: ${asset}`);
      }
      return upper;
    }

    depositReserve(tag, asset, amountMicroInput, rail = "Base", memo = "") {
      const cleanTag = this._normalizeTag(tag);
      const stable = this._normalizeAsset(asset);
      const amount = _toBigIntMicro(amountMicroInput);

      const postings = [
        { account: `asset:stable:${stable.toLowerCase()}_reserve`, amount },
        { account: `usd:${cleanTag}`, amount: -amount },
      ];
      this.reserves[stable] += amount;
      this.accounts[cleanTag] = (this.accounts[cleanTag] ?? 0n) + amount;
      const receipt = this._sealReceipt(
        "MINT_1_TO_1",
        stable,
        amount,
        postings,
        memo || `Deposit ${StablecoinReserveEngine.formatUsd(amount)} ${stable} via ${rail} -> ${cleanTag}`,
      );
      return { receipt, parity: this.verifyReserveParity() };
    }

    redeemReserve(tag, asset, amountMicroInput, destination = "0xSelfCustody") {
      const cleanTag = this._normalizeTag(tag);
      const stable = this._normalizeAsset(asset);
      const amount = _toBigIntMicro(amountMicroInput);

      const userBal = this.accounts[cleanTag] ?? 0n;
      if (userBal < amount) {
        throw new Error(`Insufficient USD balance for ${cleanTag}`);
      }
      if (this.reserves[stable] < amount) {
        throw new Error(`Insufficient ${stable} reserve liquidity; swap USDC<->USDT first`);
      }

      const postings = [
        { account: `usd:${cleanTag}`, amount },
        { account: `asset:stable:${stable.toLowerCase()}_reserve`, amount: -amount },
      ];
      this.accounts[cleanTag] = userBal - amount;
      this.reserves[stable] -= amount;
      const receipt = this._sealReceipt(
        "REDEEM_1_TO_1",
        stable,
        amount,
        postings,
        `Redeem ${StablecoinReserveEngine.formatUsd(amount)} -> ${stable} (${destination})`,
      );
      return { receipt, parity: this.verifyReserveParity() };
    }

    swapStablecoin(fromAsset, toAsset, amountMicroInput) {
      const src = this._normalizeAsset(fromAsset);
      const dst = this._normalizeAsset(toAsset);
      const amount = _toBigIntMicro(amountMicroInput);
      if (src === dst) {
        throw new Error("Source and destination stablecoin must differ");
      }
      if (this.reserves[src] < amount) {
        throw new Error(`Insufficient ${src} reserve for atomic 1:1 peg swap`);
      }

      const postings = [
        { account: `asset:stable:${dst.toLowerCase()}_reserve`, amount },
        { account: `asset:stable:${src.toLowerCase()}_reserve`, amount: -amount },
      ];
      this.reserves[src] -= amount;
      this.reserves[dst] += amount;
      const receipt = this._sealReceipt(
        "ATOMIC_PEG_SWAP_1_TO_1",
        `${src}->${dst}`,
        amount,
        postings,
        `Atomic 1:1 peg bridge ${StablecoinReserveEngine.formatUsd(amount)} ${src} -> ${dst} (0 bps)`,
      );
      return { receipt, parity: this.verifyReserveParity() };
    }

    p2pSend(fromTag, toTag, amountMicroInput, assetLabel = "USD (USDC+USDT)", memo = "") {
      const sender = this._normalizeTag(fromTag);
      const recipient = this._normalizeTag(toTag);
      const amount = _toBigIntMicro(amountMicroInput);
      if (sender === recipient) {
        throw new Error("Sender and recipient $zenotag must differ");
      }
      const senderBal = this.accounts[sender] ?? 0n;
      if (senderBal < amount) {
        throw new Error(`Insufficient balance in ${sender}`);
      }

      const postings = [
        { account: `usd:${sender}`, amount },
        { account: `usd:${recipient}`, amount: -amount },
      ];
      this.accounts[sender] = senderBal - amount;
      this.accounts[recipient] = (this.accounts[recipient] ?? 0n) + amount;
      const receipt = this._sealReceipt(
        "P2P_ZENOTAG",
        assetLabel,
        amount,
        postings,
        memo ? `${sender} -> ${recipient}: ${memo}` : `${sender} -> ${recipient} instant $zenotag pay`,
      );
      return { receipt, parity: this.verifyReserveParity() };
    }

    verifyReserveParity() {
      const usdcMicro = this.reserves.USDC;
      const usdtMicro = this.reserves.USDT;
      const totalReservesMicro = usdcMicro + usdtMicro;
      let totalLiabilitiesMicro = 0n;
      for (const bal of Object.values(this.accounts)) {
        totalLiabilitiesMicro += bal;
      }

      let ratioNum = 1n;
      let ratioDen = 1n;
      if (totalLiabilitiesMicro === 0n) {
        ratioNum = totalReservesMicro === 0n ? 1n : totalReservesMicro;
        ratioDen = 1n;
      } else {
        const g = _gcdBigInt(totalReservesMicro, totalLiabilitiesMicro);
        ratioNum = totalReservesMicro / g;
        ratioDen = totalLiabilitiesMicro / g;
      }

      let trit = 0;
      if (totalReservesMicro > totalLiabilitiesMicro) trit = 1;
      else if (totalReservesMicro < totalLiabilitiesMicro) trit = -1;

      return {
        usdcMicro,
        usdtMicro,
        totalReservesMicro,
        totalLiabilitiesMicro,
        ratioNum,
        ratioDen,
        ratioPQ: `${ratioNum.toString()}/${ratioDen.toString()}`,
        trit,
        balanced: totalReservesMicro >= totalLiabilitiesMicro,
      };
    }

    verifyDoubleEntryAudit() {
      if (this.receipts.length === 0 || this.receipts[0]?.seal !== this.chainHead) {
        return { valid: false, reason: "Chain head seal mismatch" };
      }
      for (const receipt of this.receipts) {
        if (!Array.isArray(receipt.postings) || receipt.postings.length < 2) {
          return { valid: false, reason: `Receipt #${receipt.seq} missing postings` };
        }
        let sum = 0n;
        for (const posting of receipt.postings) {
          sum += BigInt(posting.amount);
        }
        if (sum !== 0n) {
          return { valid: false, reason: `Receipt #${receipt.seq} unbalanced: ${sum.toString()}` };
        }
      }
      const parity = this.verifyReserveParity();
      return {
        valid: parity.balanced,
        reason: parity.balanced ? "OK" : "Reserve ratio below 1/1",
        receiptsChecked: this.receipts.length,
        ratioPQ: parity.ratioPQ,
        trit: parity.trit,
      };
    }

    static evaluateFokenGatePQ(invoice) {
      const invId = String(invoice?.invoiceId || "unknown");
      if (!invoice || typeof invoice !== "object" || Array.isArray(invoice)
        || !invoice.work || !invoice.artifact || !invoice.valuation || !invoice.ipAssignment || !invoice.netUtility) {
        return { invoiceId: invId, verdict: "FAIL", trit: -1, reason: "Missing required Foken invoice sections" };
      }
      if (typeof invoice.contributor !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(invoice.contributor)) {
        return { invoiceId: invId, verdict: "FAIL", trit: -1, reason: "Invalid contributor address" };
      }
      if (typeof invoice.artifact.provenanceHash !== "string" || !/^sha256:\/\/[0-9a-fA-F]{32,64}$/.test(invoice.artifact.provenanceHash)) {
        return { invoiceId: invId, verdict: "FAIL", trit: -1, reason: "Provenance hash must use sha256://<hex>" };
      }
      const fokens = invoice.valuation.selfAssessedFokens;
      if (typeof fokens !== "number" || !Number.isSafeInteger(fokens) || fokens <= 0 || fokens > 250000) {
        return { invoiceId: invId, verdict: "FAIL", trit: -1, reason: "selfAssessedFokens must be in 1..250000" };
      }
      const ip = invoice.ipAssignment;
      if (typeof ip.statement !== "string" || !ip.statement.includes("IRREVOCABLE ASSIGNMENT")
        || typeof ip.signature !== "string" || !/^0x[0-9a-fA-F]{8,}$/.test(ip.signature)) {
        return { invoiceId: invId, verdict: "FAIL", trit: -1, reason: "Missing or unsigned IRREVOCABLE ASSIGNMENT" };
      }
      const nu = invoice.netUtility;
      const avoided = Number(nu.futureWorkAvoidedHours);
      const added = Number(nu.workAddedHours);
      const debt = Number(nu.maintenanceDebtHours);
      if (!Number.isSafeInteger(avoided) || avoided < 0 || avoided > 1_000_000
        || !Number.isSafeInteger(added) || added < 0 || added > 1_000_000
        || !Number.isSafeInteger(debt) || debt < 0 || debt > 1_000_000) {
        return { invoiceId: invId, verdict: "FAIL", trit: -1, reason: "netUtility hours must be bounded non-negative safe integers" };
      }

      // Exact half-hour integer arithmetic: net = avoided - (added + 3/2 * debt)
      const halfNum = 2n * BigInt(avoided) - (2n * BigInt(added) + 3n * BigInt(debt));
      const g = _gcdBigInt(halfNum, 2n);
      const netNum = halfNum / g;
      const netDen = 2n / g;
      const netUtilityPQ = `${netNum.toString()}/${netDen.toString()}`;

      if (halfNum <= 0n) {
        return {
          invoiceId: invId,
          verdict: "FAIL",
          trit: -1,
          netUtilityPQ,
          fokensAwarded: 0,
          usdMicroAwarded: 0n,
          reason: `Net utility non-positive (${netUtilityPQ}h)`,
        };
      }

      // Proportional ceiling: <= 100 FOKEN per net-utility hour
      if (BigInt(fokens) * 2n > halfNum * 100n) {
        return {
          invoiceId: invId,
          verdict: "FAIL",
          trit: -1,
          netUtilityPQ,
          fokensAwarded: 0,
          usdMicroAwarded: 0n,
          reason: `Claimed ${fokens} FKN exceeds 100 FKN/hr ceiling for ${netUtilityPQ}h`,
        };
      }

      const usdMicroAwarded = BigInt(fokens) * MICRO_USD;
      return {
        invoiceId: invId,
        verdict: "PASS",
        trit: 1,
        netUtilityPQ,
        fokensAwarded: fokens,
        usdMicroAwarded,
        reason: `FOKEN gate passed (${netUtilityPQ}h net utility -> ${fokens} FKN = ${StablecoinReserveEngine.formatUsd(usdMicroAwarded)})`,
      };
    }

    mintFromFoken(tag, asset, invoice) {
      const gate = StablecoinReserveEngine.evaluateFokenGatePQ(invoice);
      if (gate.verdict !== "PASS") {
        throw new Error(gate.reason);
      }
      const res = this.depositReserve(
        tag,
        asset,
        gate.usdMicroAwarded,
        "Foken Gate",
        `FOKEN_MINT:${gate.fokensAwarded} FKN (${gate.netUtilityPQ}h net) backed 1:1 by ${asset} -> ${tag}`,
      );
      return { ...res, gate };
    }

    toJSON() {
      const accounts = {};
      for (const [k, v] of Object.entries(this.accounts)) {
        accounts[k] = v.toString();
      }
      const plans = {};
      for (const [k, v] of Object.entries(this.plans || {})) {
        plans[k] = v;
      }
      return {
        reserves: {
          USDC: this.reserves.USDC.toString(),
          USDT: this.reserves.USDT.toString(),
        },
        accounts,
        plans,
        receipts: this.receipts,
        chainHead: this.chainHead,
        seq: this.seq,
      };
    }

    static validateNetworkAddress(networkId, asset, address) {
      const netKey = String(networkId || "").trim().toLowerCase();
      if (!Object.hasOwn(STABLECOIN_NETWORKS, netKey)) {
        throw new Error(`Unsupported network: ${networkId}`);
      }
      const net = STABLECOIN_NETWORKS[netKey];
      const upperAsset = String(asset || "").trim().toUpperCase();
      if (upperAsset !== "USDC" && upperAsset !== "USDT") {
        throw new Error(`Unsupported stablecoin asset: ${asset}`);
      }
      const contract = upperAsset === "USDC" ? net.usdcContract : net.usdtContract;
      if (!contract) {
        throw new Error(`${upperAsset} is not supported on ${net.name}`);
      }
      const cleanAddr = String(address || "").trim();
      if (net.addressKind === "solana") {
        StablecoinReserveEngine.decodeSolanaPubkey(cleanAddr);
      } else if (net.addressKind === "evm") {
        if (!/^0x[0-9a-fA-F]{40}$/.test(cleanAddr) || /^0x0{40}$/i.test(cleanAddr)) {
          throw new Error(`Invalid EVM address for ${net.name}`);
        }
      } else if (net.addressKind === "tron") {
        if (cleanAddr.length !== 34 || !cleanAddr.startsWith("T")) {
          throw new Error(`Invalid TRON address for ${net.name}`);
        }
        for (const ch of cleanAddr) {
          if (BASE58_ALPHABET.indexOf(ch) < 0) {
            throw new Error(`Invalid Base58 char in TRON address`);
          }
        }
      }
      return { network: net, asset: upperAsset, contract, address: cleanAddr };
    }

    static splitSanpoYoshiRevenue(totalMicroInput) {
      const total = BigInt(totalMicroInput);
      if (total < 0n) throw new RangeError("Revenue fee cannot be negative");
      const familyTrustMicro = (total * 3n) / 10n;
      const fokenCommonsMicro = (total * 2n) / 10n;
      const operatingMicro = total - familyTrustMicro - fokenCommonsMicro;
      return { totalMicro: total, operatingMicro, familyTrustMicro, fokenCommonsMicro };
    }

    _applyRevenueCharge(cleanTag, kind, feeMicro, memo, planId = null) {
      const userBal = this.accounts[cleanTag] ?? 0n;
      if (userBal < feeMicro) {
        throw new Error(`Insufficient USD balance in ${cleanTag} for fee ${StablecoinReserveEngine.formatUsd(feeMicro)}`);
      }
      const split = StablecoinReserveEngine.splitSanpoYoshiRevenue(feeMicro);
      const postings = [{ account: `usd:${cleanTag}`, amount: feeMicro }];
      if (split.operatingMicro > 0n) {
        postings.push({ account: "usd:$rev_operating", amount: -split.operatingMicro });
      }
      if (split.familyTrustMicro > 0n) {
        postings.push({ account: "usd:$rev_family_trust", amount: -split.familyTrustMicro });
      }
      if (split.fokenCommonsMicro > 0n) {
        postings.push({ account: "usd:$rev_foken_commons", amount: -split.fokenCommonsMicro });
      }
      this.accounts[cleanTag] = userBal - feeMicro;
      this.accounts["$rev_operating"] = (this.accounts["$rev_operating"] ?? 0n) + split.operatingMicro;
      this.accounts["$rev_family_trust"] = (this.accounts["$rev_family_trust"] ?? 0n) + split.familyTrustMicro;
      this.accounts["$rev_foken_commons"] = (this.accounts["$rev_foken_commons"] ?? 0n) + split.fokenCommonsMicro;
      if (planId) {
        this.plans[cleanTag] = planId;
      }
      const receipt = this._sealReceipt(kind, "USD", feeMicro, postings, memo);
      return { receipt, split, parity: this.verifyReserveParity() };
    }

    getPlan(tag) {
      const cleanTag = this._normalizeTag(tag);
      const planId = (this.plans && Object.hasOwn(this.plans, cleanTag)) ? this.plans[cleanTag] : "free";
      return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
    }

    subscribePlan(tag, planId) {
      const cleanTag = this._normalizeTag(tag);
      if (!Object.hasOwn(SUBSCRIPTION_PLANS, planId)) {
        throw new Error(`Unknown subscription plan: ${planId}`);
      }
      const plan = SUBSCRIPTION_PLANS[planId];
      if (plan.monthlyFeeMicro === 0n) {
        this.plans[cleanTag] = plan.id;
        return {
          plan,
          feeMicro: 0n,
          split: StablecoinReserveEngine.splitSanpoYoshiRevenue(0n),
          parity: this.verifyReserveParity(),
        };
      }
      const res = this._applyRevenueCharge(
        cleanTag,
        "SUBSCRIPTION_BILLING",
        plan.monthlyFeeMicro,
        `Subscription ${plan.name} (${StablecoinReserveEngine.formatUsd(plan.monthlyFeeMicro)}/mo) · 50/30/20 Sanpo Yoshi`,
        plan.id,
      );
      return { plan, feeMicro: plan.monthlyFeeMicro, ...res };
    }

    billMeteredUsage(tag, kind, unitsInput, notionalMicroInput = 0n) {
      const cleanTag = this._normalizeTag(tag);
      const units = BigInt(unitsInput);
      if (units <= 0n) throw new RangeError("Usage units must be > 0");
      const notionalMicro = BigInt(notionalMicroInput);
      if (notionalMicro < 0n) throw new RangeError("Notional amount cannot be negative");
      const plan = this.getPlan(cleanTag);
      const cleanKind = String(kind || "").trim().toUpperCase();

      let feeMicro = 0n;
      if (cleanKind === "API_CALL_OVERAGE") {
        feeMicro = units * USAGE_RATES_MICRO.API_CALL_OVERAGE;
      } else if (cleanKind === "AUTO_TRADE_TICK") {
        feeMicro = units * USAGE_RATES_MICRO.AUTO_TRADE_TICK + (notionalMicro * plan.autoTradeBps) / 10000n;
      } else if (cleanKind === "CROSS_CHAIN_BRIDGE") {
        const bpsFee = (notionalMicro * plan.bridgeBps) / 10000n;
        const minFee = units * USAGE_RATES_MICRO.CROSS_CHAIN_BRIDGE_MIN;
        feeMicro = bpsFee > minFee ? bpsFee : minFee;
      } else if (cleanKind === "DISPOSABLE_CARD_MINT") {
        feeMicro = units * USAGE_RATES_MICRO.DISPOSABLE_CARD_MINT;
      } else {
        throw new Error(`Unsupported metered usage kind: ${kind}`);
      }
      if (feeMicro <= 0n) throw new RangeError("Computed metered fee must be > 0");
      const res = this._applyRevenueCharge(
        cleanTag,
        "METERED_USAGE_FEE",
        feeMicro,
        `Metered ${cleanKind} (${units.toString()} units · ${plan.id}) -> ${StablecoinReserveEngine.formatUsd(feeMicro)}`,
      );
      return { plan, kind: cleanKind, feeMicro, ...res };
    }

    getRevenueSummary() {
      const operatingMicro = this.accounts["$rev_operating"] ?? 0n;
      const familyTrustMicro = this.accounts["$rev_family_trust"] ?? 0n;
      const fokenCommonsMicro = this.accounts["$rev_foken_commons"] ?? 0n;
      return {
        operatingMicro,
        familyTrustMicro,
        fokenCommonsMicro,
        totalRevenueMicro: operatingMicro + familyTrustMicro + fokenCommonsMicro,
      };
    }

    static convertFx(amountMicroUsdInput, targetCurrency = "JPY") {
      const amount = _toBigIntMicro(amountMicroUsdInput);
      const code = String(targetCurrency || "USD").trim().toUpperCase();
      if (!Object.hasOwn(FX_RATES_PQ, code)) {
        throw new Error(`Unsupported FX currency: ${targetCurrency}`);
      }
      const rate = FX_RATES_PQ[code];
      const g = _gcdBigInt(rate.num, rate.den);
      const rateNum = rate.num / g;
      const rateDen = rate.den / g;
      const amountMicroOut = (amount * rateNum) / rateDen;
      return {
        targetCurrency: code,
        amountMicroIn: amount,
        amountMicroOut,
        rateNum,
        rateDen,
        ratePQ: `${rateNum.toString()}/${rateDen.toString()}`,
        feeBps: 0,
        formattedOut: StablecoinReserveEngine.formatCurrency(amountMicroOut, code),
      };
    }

    static formatUsd(microInput) {
      return StablecoinReserveEngine.formatCurrency(microInput, "USD");
    }

    static formatCurrency(microInput, currency = "USD") {
      const val = BigInt(microInput);
      const neg = val < 0n;
      const abs = neg ? -val : val;
      const meta = Object.hasOwn(FX_RATES_PQ, currency) ? FX_RATES_PQ[currency] : FX_RATES_PQ.USD;
      const whole = abs / MICRO_USD;
      const fracMicro = abs % MICRO_USD;
      const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      if (meta.decimals === 0) {
        return `${neg ? "-" : ""}${meta.symbol}${wholeStr}`;
      }
      const cents = (fracMicro / 10000n).toString().padStart(2, "0");
      return `${neg ? "-" : ""}${meta.symbol}${wholeStr}.${cents}`;
    }

    static decodeSolanaPubkey(address) {
      const clean = String(address || "").trim();
      if (clean.length < 32 || clean.length > 44) {
        throw new Error("Invalid Solana Base58 address length");
      }
      let num = 0n;
      let leadingZeros = 0;
      let countLeading = true;
      for (const ch of clean) {
        const idx = BASE58_ALPHABET.indexOf(ch);
        if (idx < 0) {
          throw new Error(`Invalid Base58 character in Solana address: ${ch}`);
        }
        if (countLeading && ch === "1") leadingZeros++;
        else countLeading = false;
        num = num * 58n + BigInt(idx);
      }
      const body = [];
      while (num > 0n) {
        body.push(Number(num & 0xffn));
        num >>= 8n;
      }
      body.reverse();
      if (leadingZeros + body.length !== 32) {
        throw new Error("Solana address must decode to exactly 32 bytes");
      }
      const out = new Uint8Array(32);
      out.set(body, leadingZeros);
      if (out.every((b) => b === 0)) {
        throw new Error("All-zero Solana system address cannot receive payouts");
      }
      return out;
    }

    static formatMicroExactDecimal(microInput) {
      const val = _toBigIntMicro(microInput, "amountMicro");
      const whole = val / MICRO_USD;
      const frac = val % MICRO_USD;
      if (frac === 0n) return whole.toString();
      const fracTrimmed = frac.toString().padStart(6, "0").replace(/0+$/, "");
      return `${whole.toString()}.${fracTrimmed}`;
    }

    static buildSolanaPayUsdcIntent({ recipient, amountMicro, label = "ZENO Family Trust", memo = "" }) {
      const cleanRecipient = String(recipient || "").trim();
      StablecoinReserveEngine.decodeSolanaPubkey(cleanRecipient);
      const exactMicro = _toBigIntMicro(amountMicro, "amountMicro");
      const amountDecimal = StablecoinReserveEngine.formatMicroExactDecimal(exactMicro);
      const cleanLabel = String(label || "ZENO Family Trust").trim().slice(0, 64);
      const cleanMemo = String(memo || "").trim().slice(0, 128);
      const params = [
        `amount=${encodeURIComponent(amountDecimal)}`,
        `spl-token=${encodeURIComponent(SOLANA_MAINNET.USDC_MINT)}`,
        `label=${encodeURIComponent(cleanLabel)}`,
      ];
      if (cleanMemo) {
        params.push(`memo=${encodeURIComponent(cleanMemo)}`);
      }
      const solanaPayUri = `solana:${cleanRecipient}?${params.join("&")}`;
      const cliCommand = `spl-token transfer ${SOLANA_MAINNET.USDC_MINT} ${amountDecimal} ${cleanRecipient} --fund-recipient --allow-unfunded-recipient`;
      return {
        status: "UNSIGNED_AWAITING_SOLANA_SIGNER",
        network: SOLANA_MAINNET.NETWORK,
        mint: SOLANA_MAINNET.USDC_MINT,
        tokenProgram: SOLANA_MAINNET.TOKEN_PROGRAM,
        recipient: cleanRecipient,
        amountMicro: exactMicro.toString(),
        amountDecimal,
        solanaPayUri,
        cliCommand,
      };
    }
  }

  return {
    version: "1.5.0",
    QWave: new QWaveDSP(),
    QWaveDSP,
    ContinuousStreamEngine,
    FokenGateValidator,
    KintsugiLedger,
    StablecoinReserveEngine,
    SOLANA_MAINNET,
    STABLECOIN_NETWORKS,
    SUBSCRIPTION_PLANS,
    USAGE_RATES_MICRO,
    MICRO_USD,
  };
});
