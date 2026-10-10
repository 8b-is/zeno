# ZENO Design System — 墨と金 (Sumi to Kin)

The design system for Zeno bridges ancient Japanese calligraphy (*Shodō* 書道) and architectural spatial balance (*Ma* 間) with cyberpunk edge-minimalism and high-density financial clarity.

---

## 1. Palette: 墨・金・浅葱・藤 (Sumi, Kin, Asagi, Fuji)

| Token | Hex | Role | Cultural Inspiration |
|---|---|---|---|
| `--color-sumi-black` | `#07080b` | Background void | *Sumi* (墨) — concentrated calligraphy inkstone wash |
| `--color-slate-depth` | `#0d0f17` | Card background | *Kyoto Slate* (京都の敷石) — rain-soaked temple flagstones |
| `--color-slate-border` | `rgba(180, 139, 255, 0.15)` | Primary borders | Fine silk binding thread |
| `--color-kin-gold` | `#e8b05c` | Accents & Kintsugi lines | *Kin-paku* (金箔) — Kanazawa hammered gold leaf |
| `--color-asagi-teal` | `#62e6c9` | Yield & positive flow | *Asagi-iro* (浅葱色) — traditional pale blue-green samurai silk |
| `--color-fuji-violet` | `#b48bff` | Constellation links / identities | *Fuji-iro* (藤色) — Japanese wisteria blossoms |
| `--color-sakura-frost` | `#f4f3ef` | Primary text | *Washi* (和紙) — handmade Echizen mulberry paper |
| `--color-kasumi-gray` | `#8a87a0` | Subdued secondary text | *Kasumi* (霞) — morning mountain mist |
| `--color-urushi-crimson`| `#ff5370` | Alerts & gates failed | *Urushi* (漆) — vermilion lacquered torii gates |

---

## 2. Typography

1. **Display / Headlines**:
   - Primary: `Shippori Mincho`, `Noto Serif JP`, serif
   - Aesthetic: Elegant Japanese brush calligraphy contrast, deliberate and contemplative.
2. **Body & Numbers**:
   - Primary: `JetBrains Mono`, `Geist Mono`, `ui-monospace`, monospace
   - Aesthetic: Precise, tabular numerals (`font-variant-numeric: tabular-nums;`), zero visual jitter when streaming currency updates every 16ms.

---

## 3. Spatial System: 間 (Ma) & 畳 (Tatami) Proportions

- **Ma (間)** is negative space that is not empty, but pregnant with potential and clarity.
- Every container obeys harmonic spacing multipliers:
  - `space-xs`: `0.25rem` (4px)
  - `space-sm`: `0.5rem` (8px)
  - `space-md`: `1rem` (16px)
  - `space-lg`: `1.5rem` (24px)
  - `space-xl`: `2.5rem` (40px)
  - `space-2xl`: `4rem` (64px)
- Component cards use an aspect ratio referencing traditional Japanese tatami mats ($2:1$ or $\sqrt{2}:1$ Silver Ratio - *Yamato Hiritu* 大和比).

---

## 4. Tactile Micro-Interactions

- **The Kintsugi Seam**: When balances update or ledger blocks seal, a subtle 1px golden hair-line gleams across the container with a soft cubic-bezier ease (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Ink Dispersion**: Hovering over buttons or account cards induces a gentle diffuse radial glow, mimicking a drop of ink dispersing in water.
- **Continuous Stream Flow**: Balances streaming $\mu\text{JPY}$ tick with smooth, non-distracting decimal transitions, giving the immediate visceral sensation of living financial water.

---

## 5. Web Audio Design (Shishi-odoshi & Temple Bell)

Zeno embeds pure Web Audio synthesis (zero MP3 assets, zero external network requests):
1. **Temple Singing Bowl (*Rin* 鈴)**: A resonant $432\,\text{Hz}$ carrier with subtle beating at $434\,\text{Hz}$ with a 2.4-second exponential decay when an invoice passes the Foken gate.
2. **Bamboo Water Drop (*Shishi-odoshi* 鹿威し)**: A crisp dual-sine chirp ($1400\,\text{Hz} \to 800\,\text{Hz}$, $45\,\text{ms}$) on micro-stream ticks or toggles.
3. **Koto Pluck (*Sō* 箏)**: A gentle comb-filtered noise burst with pentatonic microtonal ring ($528\,\text{Hz}$) on account switching.
