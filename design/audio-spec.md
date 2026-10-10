# ZENO Audio Specification — 和音 (Wa-On)

In accordance with VAKED constellation audio standards (seen in `music.vaked.dev` and `bonfire.vaked.dev`), Zeno incorporates a zero-dependency procedural Web Audio sound engine. Sound is not used for invasive alerts, but as auditory feedback grounding digital transactions in physical reality.

---

## 1. Synthesis Engines

### 1.1 鈴 (Rin) — Singing Bowl & Temple Bell
- **Trigger**: Foken invoice passed gate / Treasury mint confirmed.
- **Synthesis Architecture**:
  - Carrier oscillator: Sine wave at $f_0 = 432\,\text{Hz}$ (Verdi tuning / natural harmonic).
  - Overtone 1: Sine wave at $f_1 = 864\,\text{Hz}$ (Octave) with amplitude $0.35$.
  - Overtone 2: Sine wave at $f_2 = 1296\,\text{Hz}$ (Perfect Fifth) with amplitude $0.15$.
  - Modulation: Low-frequency oscillator ($3.2\,\text{Hz}$) applying subtle pitch chorus depth ($2\,\text{cents}$).
  - Envelope: Instant attack ($5\,\text{ms}$), slow exponential decay ($T_{\text{decay}} = 2.4\,\text{s}$).

### 1.2 鹿威し (Shishi-odoshi) — Water Drop & Bamboo Rock
- **Trigger**: Micro-stream tick / balance toggle / ledger refresh.
- **Synthesis Architecture**:
  - Oscillator: Rapid downward exponential frequency ramp: $1400\,\text{Hz} \to 450\,\text{Hz}$ over $38\,\text{ms}$.
  - Resonant Bandpass filter: Center frequency $920\,\text{Hz}$, $Q = 14$.
  - Amplitude envelope: Attack $2\,\text{ms}$, release $55\,\text{ms}$.

### 1.3 箏 (Koto) — Harped String Pluck
- **Trigger**: Account switch / tab transition / transfer signed.
- **Synthesis Architecture**:
  - Karplus-Strong physical modeling emulation or 3-harmonic pluck:
    - Fundamental: $528\,\text{Hz}$ (Solfeggio frequency of transformation).
    - Second harmonic: $1056\,\text{Hz}$.
    - Decay: $420\,\text{ms}$ with high-damping low-pass filter rolling off above $2.2\,\text{kHz}$.

---

## 2. Behavioral Contract
- Audio context is initialized strictly on first user interaction (gesture), respecting browser autoplay policies.
- Mute toggle is always prominently available and persists state in `localStorage['zeno_audio_mute']`.
- Master gain is capped at a gentle $-18\,\text{dB}$ (`gain = 0.12`) to prevent acoustic fatigue.
