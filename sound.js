/**
 * ZENO Audio Engine — 和音 (Wa-On)
 * Procedural Web Audio API sound synthesis (zero audio files, zero network latency)
 */

class ZenoAudio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem("zeno_audio_muted") === "true";
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem("zeno_audio_muted", this.muted ? "true" : "false");
    return this.muted;
  }

  /**
   * 鈴 (Rin) — Temple Singing Bowl
   * 432 Hz fundamental with natural harmonics and slow exponential decay.
   * Triggered on Foken gate pass, block seal, or treasury mint.
   */
  playBell() {
    if (this.muted) return;
    this.init();
    const t = this.ctx.currentTime;

    const master = this.ctx.createGain();
    master.gain.setValueAtTime(0.001, t);
    master.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    master.connect(this.ctx.destination);

    // Fundamental: 432 Hz
    const osc1 = this.ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(432, t);
    osc1.connect(master);
    osc1.start(t);
    osc1.stop(t + 2.5);

    // Octave: 864 Hz
    const osc2 = this.ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(864, t);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.35, t);
    osc2.connect(g2);
    g2.connect(master);
    osc2.start(t);
    osc2.stop(t + 2.5);

    // Fifth: 1296 Hz
    const osc3 = this.ctx.createOscillator();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1296, t);
    const g3 = this.ctx.createGain();
    g3.gain.setValueAtTime(0.15, t);
    osc3.connect(g3);
    g3.connect(master);
    osc3.start(t);
    osc3.stop(t + 2.5);
  }

  /**
   * 鹿威し (Shishi-odoshi) — Water Drop
   * High-to-low fast chirp (1400Hz -> 450Hz).
   * Triggered on streaming ticks, toggles, and checkpoints.
   */
  playDrop() {
    if (this.muted) return;
    this.init();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(920, t);
    filter.Q.setValueAtTime(12, t);

    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(450, t + 0.04);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  /**
   * 箏 (Koto) — Harped string pluck
   * 528 Hz Solfeggio frequency with gentle high-frequency damping.
   * Triggered on tab switches and transfer confirmation.
   */
  playPluck() {
    if (this.muted) return;
    this.init();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.35);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(528, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.10, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.5);
  }
}

window.zenoAudio = new ZenoAudio();
