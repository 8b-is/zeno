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
      if (amountJpy <= 0) throw new Error("Deposit must be positive");
      this.balanceMicro += BigInt(Math.round(amountJpy * 1000000));
      return this.getBalanceFloat();
    }

    spend(amountJpy) {
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

      if (!/^0x[0-9a-fA-F]{40}$/.test(invoice.contributor)) {
        return { invoiceId: invId, verdict: "FAIL", reason: "Invalid Ethereum/Polygon contributor address" };
      }

      if (!invoice.artifact.provenanceHash || !invoice.artifact.provenanceHash.startsWith("sha256://")) {
        return { invoiceId: invId, verdict: "FAIL", reason: "Artifact provenanceHash must use sha256://" };
      }

      const val = invoice.valuation;
      const avoided = Number(val.futureWorkAvoidedHours) || 0;
      const added = Number(val.workAddedHours) || 0;
      const debt = Number(val.maintenanceDebtHours) || 0;
      const netCalculated = avoided - (added + 1.5 * debt);

      if (netCalculated <= 0) {
        return {
          invoiceId: invId,
          verdict: "REJECT",
          netUtilityHours: netCalculated,
          reason: "Negative or zero net contribution utility"
        };
      }

      const claimedNet = Number(val.netUtilityHours);
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
     * Prunes dead OTP/3DS challenges older than ttlMs and returns pruned IDs + surviving map.
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
      return { prunedCount: pruned.length, pruned, activeCount: active.length, active };
    }

    /**
     * Executes scheduled payments due at or before nowMs while preserving double-entry balance.
     * Amounts and balances are safe integers in the caller's chosen smallest currency unit.
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
      const validAccount = account => typeof account === "string" && account.trim().length > 0
        && !["__proto__", "constructor", "prototype"].includes(account);
      const balanceOf = account => Object.prototype.hasOwnProperty.call(balances, account)
        ? balances[account] : 0;
      for (const item of queue || []) {
        if (!item || typeof item !== "object" || Array.isArray(item)
          || !validAccount(item.from) || !validAccount(item.to)) {
          rejected.push({ ...item, trit: -1, reason: "INVALID_TRANSFER" });
          continue;
        }
        if (!Number.isSafeInteger(item.amount) || item.amount <= 0) {
          rejected.push({ ...item, trit: -1, reason: "INVALID_AMOUNT" });
          continue;
        }
        if (!Number.isSafeInteger(item.executeAtMs) || item.executeAtMs < 0) {
          rejected.push({ ...item, trit: -1, reason: "INVALID_TIMESTAMP" });
          continue;
        }
        if (item.executeAtMs > nowMs) {
          pending.push({ ...item, trit: 0 });
          continue;
        }
        const fromBal = balanceOf(item.from);
        const toBal = balanceOf(item.to);
        if (!Number.isSafeInteger(fromBal) || fromBal < 0 || !Number.isSafeInteger(toBal) || toBal < 0) {
          rejected.push({ ...item, trit: -1, reason: "INVALID_BALANCE" });
          continue;
        }
        if (fromBal < item.amount) {
          rejected.push({ ...item, trit: -1, reason: "INSUFFICIENT_FUNDS" });
          continue;
        }
        // Check both sides before posting; a self-transfer has no net balance change.
        if (item.from !== item.to) {
          const nextToBal = toBal + item.amount;
          if (!Number.isSafeInteger(nextToBal)) {
            rejected.push({ ...item, trit: -1, reason: "BALANCE_OVERFLOW" });
            continue;
          }
          balances[item.from] = fromBal - item.amount;
          balances[item.to] = nextToBal;
        }
        settled.push({ ...item, trit: 1 });
      }
      return { settled, pending, rejected, balances };
    }
  }

  return {
    version: "1.2.0",
    QWave: new QWaveDSP(),
    QWaveDSP,
    ContinuousStreamEngine,
    FokenGateValidator,
    KintsugiLedger
  };
});
