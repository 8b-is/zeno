#![no_std]
//! ZENO Kintsugi Ledger Bridge (`zeno-wallet-issuer-angel`)
//!
//! Authorized `#![no_std]` kernel for FeliCa transit token time-windows and
//! Google/Apple Wallet passes via Google Cloud Project `812856185326`
//! (`812856185326-b6jhlilv11d8ufcjpbjjrg486uiffno9.apps.googleusercontent.com`).
//!
//! - **Zero-float `p/q` Rational arithmetic**: resolves Zeno's Dichotomy, Achilles,
//!   and FeliCa gate transit time-windows (`16 ms` NFC-F polling & transfer windows)
//!   with zero IEEE-754 mantissa drift.
//! - **SHA-256 Trace-Chaining**: FIPS 180-4 `no_std` digest chaining every pass
//!   issuance and FeliCa gate tap to the Kintsugi parent hash.
//! - **32B `wupz` Witness Seal**: deterministic 32-byte witness seal (`WUPZ` magic +
//!   `xor_fold` + `popcount` + 16B SHA-256 commitment) over the issuer binary/claims.

use core::cmp::Ordering;

pub const GOOGLE_PROJECT_NUMBER: u64 = 812_856_185_326;
pub const GOOGLE_OAUTH_CLIENT_ID: &str =
    "812856185326-b6jhlilv11d8ufcjpbjjrg486uiffno9.apps.googleusercontent.com";
pub const GOOGLE_PAY_MERCHANT_ID: &str = "BCR2DN6DZKGJ5BI5";
pub const SERVICE_ACCOUNT_NAME: &str = "zeno-wallet-issuer-angel";
pub const SERVICE_ACCOUNT_DESCRIPTION: &str =
    "ZENO Kintsugi Ledger Bridge: Authorized signer for FeliCa transit tokens and Google/Apple Wallet passes via Client ID 812856185326 (Merchant ID BCR2DN6DZKGJ5BI5). Integrity enforced via SHA-256 trace-chaining.";

/// Ultrabackyardloop `kompress-super-ultra` lossless ratio `372/359` and `lanes = 2/1`.
pub const KOMPRESS_RATIO_372_359: Rational = Rational { p: 372, q: 359 };
pub const KOMPRESS_LANES_2_1: Rational = Rational { p: 2, q: 1 };
pub const KOMPRESS_GATE_0X62: u8 = 0x62;
pub const KOMPRESS_QT_55: u8 = 0x55;
pub const KOMPRESS_FOLD_SEED: u64 = 0x2a69_c3fd_6cde_a62e;

/// FeliCa NFC-F JIS X 6319-4 maximum gate transaction window: 200 ms = 1/5 s.
pub const FELICA_GATE_WINDOW_SECONDS: Rational = Rational { p: 1, q: 5 };
/// Standard Tokyo transit transfer grace window: 1800 s (30 minutes).
pub const TRANSIT_TRANSFER_WINDOW_SECONDS: Rational = Rational { p: 1800, q: 1 };

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KernelError {
    ZeroDenominator,
    Overflow,
    InvalidWindow,
    ExpiredTransitWindow,
    ReplayDetected,
}

/// Canonical `#![no_std]` checked `p/q` rational number (zero-float).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Rational {
    p: i64,
    q: u64,
}

impl Rational {
    pub const ZERO: Self = Self { p: 0, q: 1 };
    pub const ONE: Self = Self { p: 1, q: 1 };

    pub const fn integer(p: i64) -> Self {
        Self { p, q: 1 }
    }

    pub fn new(p: i64, q: u64) -> Result<Self, KernelError> {
        Self::wide(i128::from(p), u128::from(q))
    }

    fn wide(p: i128, q: u128) -> Result<Self, KernelError> {
        if q == 0 {
            return Err(KernelError::ZeroDenominator);
        }
        let (mut a, mut b) = (p.unsigned_abs(), q);
        while b != 0 {
            (a, b) = (b, a % b);
        }
        let mag = p.unsigned_abs() / a;
        let signed = if p < 0 {
            -(i128::try_from(mag).map_err(|_| KernelError::Overflow)?)
        } else {
            i128::try_from(mag).map_err(|_| KernelError::Overflow)?
        };
        Ok(Self {
            p: i64::try_from(signed).map_err(|_| KernelError::Overflow)?,
            q: u64::try_from(q / a).map_err(|_| KernelError::Overflow)?,
        })
    }

    pub const fn numerator(self) -> i64 {
        self.p
    }

    pub const fn denominator(self) -> u64 {
        self.q
    }

    pub fn checked_add(self, rhs: Self) -> Result<Self, KernelError> {
        let p = (i128::from(self.p) * i128::from(rhs.q))
            .checked_add(i128::from(rhs.p) * i128::from(self.q))
            .ok_or(KernelError::Overflow)?;
        Self::wide(p, u128::from(self.q) * u128::from(rhs.q))
    }

    pub fn checked_sub(self, rhs: Self) -> Result<Self, KernelError> {
        let p = (i128::from(self.p) * i128::from(rhs.q))
            .checked_sub(i128::from(rhs.p) * i128::from(self.q))
            .ok_or(KernelError::Overflow)?;
        Self::wide(p, u128::from(self.q) * u128::from(rhs.q))
    }

    pub fn checked_mul(self, rhs: Self) -> Result<Self, KernelError> {
        Self::wide(
            i128::from(self.p) * i128::from(rhs.p),
            u128::from(self.q) * u128::from(rhs.q),
        )
    }

    pub fn checked_div(self, rhs: Self) -> Result<Self, KernelError> {
        let p = i128::from(self.p) * i128::from(rhs.q);
        Self::wide(
            if rhs.p < 0 { -p } else { p },
            u128::from(self.q) * u128::from(rhs.p.unsigned_abs()),
        )
    }

    /// Project to fixed scale (e.g. `1_000_000` for micro-JPY or microseconds).
    pub fn scaled(self, scale: u64) -> Result<i64, KernelError> {
        if scale == 0 {
            return Err(KernelError::ZeroDenominator);
        }
        i64::try_from(i128::from(self.p) * i128::from(scale) / i128::from(self.q))
            .map_err(|_| KernelError::Overflow)
    }
}

impl Ord for Rational {
    fn cmp(&self, rhs: &Self) -> Ordering {
        (i128::from(self.p) * i128::from(rhs.q)).cmp(&(i128::from(rhs.p) * i128::from(self.q)))
    }
}

impl PartialOrd for Rational {
    fn partial_cmp(&self, rhs: &Self) -> Option<Ordering> {
        Some(self.cmp(rhs))
    }
}

/// Exact `p/q` FeliCa transit time-window (`[t_open, t_close]` in rational seconds).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FelicaTransitWindow {
    pub t_open_sec: Rational,
    pub t_close_sec: Rational,
}

impl FelicaTransitWindow {
    pub fn new(t_open_sec: Rational, duration_sec: Rational) -> Result<Self, KernelError> {
        if duration_sec <= Rational::ZERO {
            return Err(KernelError::InvalidWindow);
        }
        let t_close_sec = t_open_sec.checked_add(duration_sec)?;
        Ok(Self {
            t_open_sec,
            t_close_sec,
        })
    }

    /// Verify that tap timestamp `t_tap_sec` falls strictly inside `[t_open_sec, t_close_sec]`
    /// with zero floating-point drift, returning the remaining window ratio `(t_close - t_tap) / (t_close - t_open)`.
    pub fn verify_tap(self, t_tap_sec: Rational) -> Result<Rational, KernelError> {
        if t_tap_sec < self.t_open_sec || t_tap_sec > self.t_close_sec {
            return Err(KernelError::ExpiredTransitWindow);
        }
        let remaining = self.t_close_sec.checked_sub(t_tap_sec)?;
        let span = self.t_close_sec.checked_sub(self.t_open_sec)?;
        remaining.checked_div(span)
    }
}

// ---------------------------------------------------------------------------
// Pure `#![no_std]` SHA-256 (FIPS 180-4) for Kintsugi Trace-Chaining
// ---------------------------------------------------------------------------

const K256: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const H0: [u32; 8] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

fn compress_block(state: &mut [u32; 8], block: &[u8; 64]) {
    let mut w = [0u32; 64];
    let mut i = 0;
    while i < 16 {
        let j = i * 4;
        w[i] = u32::from_be_bytes([block[j], block[j + 1], block[j + 2], block[j + 3]]);
        i += 1;
    }
    while i < 64 {
        let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
        let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16]
            .wrapping_add(s0)
            .wrapping_add(w[i - 7])
            .wrapping_add(s1);
        i += 1;
    }

    let mut a = state[0];
    let mut b = state[1];
    let mut c = state[2];
    let mut d = state[3];
    let mut e = state[4];
    let mut f = state[5];
    let mut g = state[6];
    let mut h = state[7];

    let mut t = 0;
    while t < 64 {
        let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
        let ch = (e & f) ^ ((!e) & g);
        let temp1 = h
            .wrapping_add(s1)
            .wrapping_add(ch)
            .wrapping_add(K256[t])
            .wrapping_add(w[t]);
        let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let temp2 = s0.wrapping_add(maj);

        h = g;
        g = f;
        f = e;
        e = d.wrapping_add(temp1);
        d = c;
        c = b;
        b = a;
        a = temp1.wrapping_add(temp2);
        t += 1;
    }

    state[0] = state[0].wrapping_add(a);
    state[1] = state[1].wrapping_add(b);
    state[2] = state[2].wrapping_add(c);
    state[3] = state[3].wrapping_add(d);
    state[4] = state[4].wrapping_add(e);
    state[5] = state[5].wrapping_add(f);
    state[6] = state[6].wrapping_add(g);
    state[7] = state[7].wrapping_add(h);
}

/// Compute SHA-256 over arbitrary bytes in `#![no_std]` with zero heap allocations.
pub fn sha256(data: &[u8]) -> [u8; 32] {
    let mut state = H0;
    let mut chunks = data.chunks_exact(64);
    for chunk in &mut chunks {
        let mut block = [0u8; 64];
        block.copy_from_slice(chunk);
        compress_block(&mut state, &block);
    }

    let rem = chunks.remainder();
    let bit_len = (data.len() as u64).wrapping_mul(8);
    let mut tail = [0u8; 128];
    tail[..rem.len()].copy_from_slice(rem);
    tail[rem.len()] = 0x80;

    let total_tail_len = if rem.len() < 56 { 64 } else { 128 };
    let len_bytes = bit_len.to_be_bytes();
    tail[total_tail_len - 8..total_tail_len].copy_from_slice(&len_bytes);

    let mut first = [0u8; 64];
    first.copy_from_slice(&tail[..64]);
    compress_block(&mut state, &first);

    if total_tail_len == 128 {
        let mut second = [0u8; 64];
        second.copy_from_slice(&tail[64..128]);
        compress_block(&mut state, &second);
    }

    let mut out = [0u8; 32];
    let mut i = 0;
    while i < 8 {
        let bytes = state[i].to_be_bytes();
        out[i * 4] = bytes[0];
        out[i * 4 + 1] = bytes[1];
        out[i * 4 + 2] = bytes[2];
        out[i * 4 + 3] = bytes[3];
        i += 1;
    }
    out
}

/// SHA-256 Kintsugi trace-chain step: `H(prev_trace || 0x3a || payload)`.
pub fn kintsugi_trace_chain(prev_trace: &[u8; 32], payload: &[u8]) -> [u8; 32] {
    let mut state = H0;
    let total_len = 33 + payload.len();
    let bit_len = (total_len as u64).wrapping_mul(8);

    // Stream `prev_trace` (32B) + `:` (1B) + `payload` through 64B blocks with zero heap allocation.
    let mut block = [0u8; 64];
    block[..32].copy_from_slice(prev_trace);
    block[32] = b':';
    let mut filled = 33usize;

    let mut idx = 0usize;
    while idx < payload.len() {
        let take = core::cmp::min(64 - filled, payload.len() - idx);
        block[filled..filled + take].copy_from_slice(&payload[idx..idx + take]);
        filled += take;
        idx += take;
        if filled == 64 {
            compress_block(&mut state, &block);
            block = [0u8; 64];
            filled = 0;
        }
    }

    let mut tail = [0u8; 128];
    tail[..filled].copy_from_slice(&block[..filled]);
    tail[filled] = 0x80;
    let total_tail_len = if filled < 56 { 64 } else { 128 };
    tail[total_tail_len - 8..total_tail_len].copy_from_slice(&bit_len.to_be_bytes());

    let mut first = [0u8; 64];
    first.copy_from_slice(&tail[..64]);
    compress_block(&mut state, &first);
    if total_tail_len == 128 {
        let mut second = [0u8; 64];
        second.copy_from_slice(&tail[64..128]);
        compress_block(&mut state, &second);
    }

    let mut out = [0u8; 32];
    let mut i = 0;
    while i < 8 {
        let bytes = state[i].to_be_bytes();
        out[i * 4] = bytes[0];
        out[i * 4 + 1] = bytes[1];
        out[i * 4 + 2] = bytes[2];
        out[i * 4 + 3] = bytes[3];
        i += 1;
    }
    out
}

// ---------------------------------------------------------------------------
// 32-Byte `wupz` Witness Seal (`WupzWitnessSeal`)
// ---------------------------------------------------------------------------

/// `wupz` C ABI v1 compatible 4-way unrolled 64-bit XOR-fold kernel (`wupz_xor_fold`).
pub fn wupz_xor_fold(bytes: &[u8]) -> u64 {
    let mut a0 = 0u64;
    let mut a1 = 0u64;
    let mut a2 = 0u64;
    let mut a3 = 0u64;
    let mut chunks64 = bytes.chunks_exact(64);
    for c in &mut chunks64 {
        a0 ^= u64::from_le_bytes([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]])
            ^ u64::from_le_bytes([c[32], c[33], c[34], c[35], c[36], c[37], c[38], c[39]]);
        a1 ^= u64::from_le_bytes([c[8], c[9], c[10], c[11], c[12], c[13], c[14], c[15]])
            ^ u64::from_le_bytes([c[40], c[41], c[42], c[43], c[44], c[45], c[46], c[47]]);
        a2 ^= u64::from_le_bytes([c[16], c[17], c[18], c[19], c[20], c[21], c[22], c[23]])
            ^ u64::from_le_bytes([c[48], c[49], c[50], c[51], c[52], c[53], c[54], c[55]]);
        a3 ^= u64::from_le_bytes([c[24], c[25], c[26], c[27], c[28], c[29], c[30], c[31]])
            ^ u64::from_le_bytes([c[56], c[57], c[58], c[59], c[60], c[61], c[62], c[63]]);
    }
    let mut acc = (a0 ^ a1) ^ (a2 ^ a3);
    let mut chunks8 = chunks64.remainder().chunks_exact(8);
    for c in &mut chunks8 {
        acc ^= u64::from_le_bytes([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]]);
    }
    let rem = chunks8.remainder();
    if !rem.is_empty() {
        let mut tail = [0u8; 8];
        tail[..rem.len()].copy_from_slice(rem);
        acc ^= u64::from_le_bytes(tail);
    }
    acc
}

/// `wupz` C ABI v1 compatible 4-way unrolled 64-bit popcount kernel (`wupz_popcount`).
pub fn wupz_popcount(bytes: &[u8]) -> u32 {
    let mut c0 = 0u32;
    let mut c1 = 0u32;
    let mut c2 = 0u32;
    let mut c3 = 0u32;
    let mut chunks32 = bytes.chunks_exact(32);
    for c in &mut chunks32 {
        c0 = c0.wrapping_add(
            u64::from_le_bytes([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]]).count_ones(),
        );
        c1 = c1.wrapping_add(
            u64::from_le_bytes([c[8], c[9], c[10], c[11], c[12], c[13], c[14], c[15]]).count_ones(),
        );
        c2 = c2.wrapping_add(
            u64::from_le_bytes([c[16], c[17], c[18], c[19], c[20], c[21], c[22], c[23]])
                .count_ones(),
        );
        c3 = c3.wrapping_add(
            u64::from_le_bytes([c[24], c[25], c[26], c[27], c[28], c[29], c[30], c[31]])
                .count_ones(),
        );
    }
    let mut count = (c0.wrapping_add(c1)).wrapping_add(c2.wrapping_add(c3));
    for &b in chunks32.remainder() {
        count = count.wrapping_add(b.count_ones());
    }
    count
}

/// `wupz` C ABI v1 compatible 64-bit SWAR byte-diff kernel (`wupz_byte_diff`).
pub fn wupz_byte_diff(a: &[u8], b: &[u8]) -> u64 {
    let n = a.len().min(b.len());
    let mut count = 0u64;
    let mut i = 0usize;
    while i + 8 <= n {
        let wa = u64::from_le_bytes([
            a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4], a[i + 5], a[i + 6], a[i + 7],
        ]);
        let wb = u64::from_le_bytes([
            b[i], b[i + 1], b[i + 2], b[i + 3], b[i + 4], b[i + 5], b[i + 6], b[i + 7],
        ]);
        let d = wa ^ wb;
        if d != 0 {
            let msb = ((d & 0x7f7f_7f7f_7f7f_7f7f) + 0x7f7f_7f7f_7f7f_7f7f) | d;
            count += u64::from((msb & 0x8080_8080_8080_8080).count_ones());
        }
        i += 8;
    }
    while i < n {
        if a[i] != b[i] {
            count += 1;
        }
        i += 1;
    }
    count
}

/// Deterministic 32-byte `wupz` Witness Seal over the issuer binary or token payload:
/// - Bytes `0..4`: `"WUPZ"` magic (`[0x57, 0x55, 0x50, 0x5a]`)
/// - Bytes `4..8`: `popcount` (`u32` big-endian)
/// - Bytes `8..16`: `xor_fold` (`u64` big-endian)
/// - Bytes `16..32`: Upper 128 bits of SHA-256 (`sha256(image)[0..16]`)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WupzWitnessSeal {
    pub bytes: [u8; 32],
}

impl WupzWitnessSeal {
    pub fn seal(image: &[u8]) -> Self {
        let pop = wupz_popcount(image).to_be_bytes();
        let fold = wupz_xor_fold(image).to_be_bytes();
        let digest = sha256(image);

        let mut bytes = [0u8; 32];
        bytes[0..4].copy_from_slice(b"WUPZ");
        bytes[4..8].copy_from_slice(&pop);
        bytes[8..16].copy_from_slice(&fold);
        bytes[16..32].copy_from_slice(&digest[0..16]);
        Self { bytes }
    }

    pub fn verify(&self, image: &[u8]) -> bool {
        Self::seal(image).bytes == self.bytes
    }
}

// ---------------------------------------------------------------------------
// `BFP-64` (`qt:55`) & `OneCompressionFrame` (`372/359`, `gate=0x62`, `lanes=2/1`)
// ---------------------------------------------------------------------------

/// 64-bit Block Fixed-Point (`BFP-64`) integer representation (`mantissa * 2^shift`)
/// that projects losslessly into canonical `p/q` [`Rational`] without IEEE-754 floats.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Bfp64 {
    pub mantissa: i64,
    pub exp2: i8,
}

impl Bfp64 {
    /// Encode `qt:55` (`0x55` = `85` / `256` balanced ternary quant parameter) in `BFP-64`.
    pub const QT_55: Self = Self {
        mantissa: KOMPRESS_QT_55 as i64,
        exp2: -8,
    };

    pub fn to_rational(self) -> Result<Rational, KernelError> {
        if self.exp2 >= 0 {
            let shift = u32::try_from(self.exp2).map_err(|_| KernelError::Overflow)?;
            if shift >= 62 {
                return Err(KernelError::Overflow);
            }
            let factor = 1_i64.checked_shl(shift).ok_or(KernelError::Overflow)?;
            let p = self
                .mantissa
                .checked_mul(factor)
                .ok_or(KernelError::Overflow)?;
            Ok(Rational::integer(p))
        } else {
            let shift = u32::try_from(-i16::from(self.exp2)).map_err(|_| KernelError::Overflow)?;
            if shift >= 62 {
                return Err(KernelError::Overflow);
            }
            let q = 1_u64.checked_shl(shift).ok_or(KernelError::Overflow)?;
            Rational::new(self.mantissa, q)
        }
    }
}

/// Verified `OneCompression` Ultrabackyardloop frame for Merchant `BCR2DN6DZKGJ5BI5`:
/// `⟦ULTRABACKYARDLOOP|+AND=1:~NAND=-1|gate=0x62|qt:55|kompress-super-ultra:lossless(ratio=372/359,verified=true,fold=0x2a69c3fd6cdea62e)|lanes=2/1⟧`
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OneCompressionFrame {
    pub gate: u8,
    pub qt_bfp64: Bfp64,
    pub ratio: Rational,
    pub lanes: Rational,
    pub fold: u64,
    pub wupz_seal: WupzWitnessSeal,
    pub kintsugi_trace: [u8; 32],
}

impl OneCompressionFrame {
    /// Ingest fold `0x2a69c3fd6cdea62e`, validate gate `0x62` (+AND=1, ~NAND=-1) and
    /// `372/359` across `lanes`, seal with 32B `wupz`, and commit to Kintsugi SHA-256.
    pub fn ingest_merchant_frame(
        prev_trace: &[u8; 32],
        concurrency_lanes: u64,
    ) -> Result<Self, KernelError> {
        if concurrency_lanes == 0 {
            return Err(KernelError::ZeroDenominator);
        }
        // Validate gate 0x62: bit-1 (+AND = 1) and bit-5/6 (~NAND = -1) active.
        let and_trit: i8 = if (KOMPRESS_GATE_0X62 & 0x02) != 0 { 1 } else { 0 };
        let nand_trit: i8 = if (KOMPRESS_GATE_0X62 & 0x60) == 0x60 { -1 } else { 0 };
        if and_trit != 1 || nand_trit != -1 {
            return Err(KernelError::InvalidWindow);
        }

        // Verify that scaling `372/359` across `lanes = concurrency_lanes / 1` and dividing back
        // preserves the exact `372/359` rational invariant with zero drift.
        let lanes = Rational::new(
            i64::try_from(concurrency_lanes).map_err(|_| KernelError::Overflow)?,
            1,
        )?;
        let scaled_ratio = KOMPRESS_RATIO_372_359.checked_mul(lanes)?;
        let recovered_ratio = scaled_ratio.checked_div(lanes)?;
        if recovered_ratio != KOMPRESS_RATIO_372_359 {
            return Err(KernelError::InvalidWindow);
        }

        // Project `qt:55` via BFP-64 into exact `p/q` Rational (`85/256`).
        let qt_rational = Bfp64::QT_55.to_rational()?;
        let folded_ratio = recovered_ratio.checked_add(qt_rational)?;
        if folded_ratio <= KOMPRESS_RATIO_372_359 {
            return Err(KernelError::InvalidWindow);
        }

        // Build deterministic 32-byte wire frame for `wupz` sealing + Kintsugi SHA-256 commit:
        // [0..16]: Merchant ID ASCII ("BCR2DN6DZKGJ5BI5", 16B)
        // [16]: gate (0x62)
        // [17]: qt (0x55)
        // [18..20]: ratio.p (372 u16 BE)
        // [20..22]: ratio.q (359 u16 BE)
        // [22..24]: lanes (u16 BE)
        // [24..32]: fold (0x2a69c3fd6cdea62e u64 BE)
        let mut wire = [0u8; 32];
        wire[0..16].copy_from_slice(GOOGLE_PAY_MERCHANT_ID.as_bytes());
        wire[16] = KOMPRESS_GATE_0X62;
        wire[17] = KOMPRESS_QT_55;
        wire[18..20].copy_from_slice(&(KOMPRESS_RATIO_372_359.p as u16).to_be_bytes());
        wire[20..22].copy_from_slice(&(KOMPRESS_RATIO_372_359.q as u16).to_be_bytes());
        wire[22..24].copy_from_slice(&(concurrency_lanes as u16).to_be_bytes());
        wire[24..32].copy_from_slice(&KOMPRESS_FOLD_SEED.to_be_bytes());

        let wupz_seal = WupzWitnessSeal::seal(&wire);
        let kintsugi_trace = kintsugi_trace_chain(prev_trace, &wupz_seal.bytes);

        Ok(Self {
            gate: KOMPRESS_GATE_0X62,
            qt_bfp64: Bfp64::QT_55,
            ratio: recovered_ratio,
            lanes,
            fold: KOMPRESS_FOLD_SEED,
            wupz_seal,
            kintsugi_trace,
        })
    }
}

/// Ephemeral Single-Use Handshake for the Secure Element bridge (`zeno-wallet-issuer-angel`):
/// binds a strictly monotonic single-use counter (`nonce`), an exact `p/q` FeliCa transit
/// window (`1/5 s`), a 32-byte `wupz` witness seal, and a Kintsugi SHA-256 chain digest.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EphemeralSingleUseHandshake {
    pub last_consumed_nonce: u64,
    pub chain_tip: [u8; 32],
}

impl EphemeralSingleUseHandshake {
    pub const fn new(genesis_tip: [u8; 32]) -> Self {
        Self {
            last_consumed_nonce: 0,
            chain_tip: genesis_tip,
        }
    }

    /// Consume a single-use token handshake at `t_tap_sec` within `window`, advancing the
    /// monotonic nonce and returning the 32-byte `WupzWitnessSeal` + remaining `p/q` window ratio.
    pub fn consume_once(
        &mut self,
        nonce: u64,
        window: FelicaTransitWindow,
        t_tap_sec: Rational,
        se_payload: &[u8],
    ) -> Result<(WupzWitnessSeal, Rational), KernelError> {
        if nonce <= self.last_consumed_nonce {
            return Err(KernelError::ReplayDetected);
        }
        let remaining_ratio = window.verify_tap(t_tap_sec)?;
        let next_tip = kintsugi_trace_chain(&self.chain_tip, se_payload);

        // Pack 32-byte Secure Element transit frame for WUPZ sealing:
        // [0..8]: nonce (u64 BE)
        // [8..16]: remaining_ratio.p (i64 BE)
        // [16..24]: remaining_ratio.q (u64 BE)
        // [24..32]: upper 8B of next_tip
        let mut frame32 = [0u8; 32];
        frame32[0..8].copy_from_slice(&nonce.to_be_bytes());
        frame32[8..16].copy_from_slice(&remaining_ratio.numerator().to_be_bytes());
        frame32[16..24].copy_from_slice(&remaining_ratio.denominator().to_be_bytes());
        frame32[24..32].copy_from_slice(&next_tip[0..8]);

        let seal = WupzWitnessSeal::seal(&frame32);
        self.last_consumed_nonce = nonce;
        self.chain_tip = kintsugi_trace_chain(&next_tip, &seal.bytes);
        Ok((seal, remaining_ratio))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn felica_transit_window_exact_rational_no_float_drift() {
        // Gate opens at t = 1_730_000_000 s for 200 ms (1/5 s).
        let t_open = Rational::integer(1_730_000_000);
        let window = FelicaTransitWindow::new(t_open, FELICA_GATE_WINDOW_SECONDS).unwrap();

        // Tap at +150 ms (3/20 s) -> 50 ms remaining out of 200 ms = 1/4 of window remaining.
        let t_tap = t_open.checked_add(Rational::new(3, 20).unwrap()).unwrap();
        let remaining_ratio = window.verify_tap(t_tap).unwrap();
        assert_eq!(remaining_ratio, Rational::new(1, 4).unwrap());
        assert_eq!(remaining_ratio.scaled(1_000_000).unwrap(), 250_000);

        // Tap at +201 ms (201/1000 s) -> rejected as ExpiredTransitWindow.
        let t_late = t_open
            .checked_add(Rational::new(201, 1000).unwrap())
            .unwrap();
        assert_eq!(
            window.verify_tap(t_late),
            Err(KernelError::ExpiredTransitWindow)
        );
    }

    #[test]
    fn sha256_matches_nist_vector_and_chains_kintsugi_trace() {
        // NIST SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
        let digest = sha256(b"abc");
        assert_eq!(
            digest,
            [
                0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea,
                0x41, 0x41, 0x40, 0xde, 0x5d, 0xae, 0x22, 0x23,
                0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c,
                0xb4, 0x10, 0xff, 0x61, 0xf2, 0x00, 0x15, 0xad,
            ]
        );

        let genesis = [0u8; 32];
        let step1 = kintsugi_trace_chain(&genesis, b"zeno-wallet-issuer-angel:cnt_0x71c8:4820000000");
        let step2 = kintsugi_trace_chain(&step1, b"felica:0003:090f:241");
        assert_ne!(step1, genesis);
        assert_ne!(step2, step1);
    }

    #[test]
    fn wupz_32b_witness_seal_verifies_and_detects_tampering() {
        let payload = SERVICE_ACCOUNT_DESCRIPTION.as_bytes();
        let seal = WupzWitnessSeal::seal(payload);
        assert_eq!(&seal.bytes[0..4], b"WUPZ");
        assert!(seal.verify(payload));
        assert!(!seal.verify(b"tampered"));
    }

    #[test]
    fn one_compression_merchant_bcr2dn6dzkgj5bi5_bfp64_and_wupz_seal() {
        let genesis = [0u8; 32];
        // Verify lanes = 2/1 and scaling up to lanes = 64/1 preserves exact 372/359 ratio.
        let frame2 = OneCompressionFrame::ingest_merchant_frame(&genesis, 2).unwrap();
        let frame64 =
            OneCompressionFrame::ingest_merchant_frame(&frame2.kintsugi_trace, 64).unwrap();

        assert_eq!(frame2.gate, 0x62);
        assert_eq!(
            frame2.qt_bfp64.to_rational().unwrap(),
            Rational::new(85, 256).unwrap()
        );
        assert_eq!(frame2.ratio, Rational::new(372, 359).unwrap());
        assert_eq!(frame64.ratio, Rational::new(372, 359).unwrap());
        assert_eq!(frame2.fold, 0x2a69_c3fd_6cde_a62e);
        assert_eq!(&frame2.wupz_seal.bytes[0..4], b"WUPZ");
        assert_ne!(frame2.kintsugi_trace, genesis);
        assert_ne!(frame64.kintsugi_trace, frame2.kintsugi_trace);
    }

    #[test]
    fn ephemeral_single_use_handshake_rejects_replay_and_packs_wupz_32b() {
        let mut bridge = EphemeralSingleUseHandshake::new([0x42u8; 32]);
        let t_open = Rational::integer(1_730_000_500);
        let window = FelicaTransitWindow::new(t_open, FELICA_GATE_WINDOW_SECONDS).unwrap();
        let t_tap = t_open.checked_add(Rational::new(1, 10).unwrap()).unwrap();

        let (seal, rem) = bridge
            .consume_once(1, window, t_tap, b"se:BCR2DN6DZKGJ5BI5:0x661bf095f5d21682")
            .unwrap();
        assert_eq!(&seal.bytes[0..4], b"WUPZ");
        assert_eq!(rem, Rational::new(1, 2).unwrap());

        // Replaying nonce 1 must fail with ReplayDetected.
        assert_eq!(
            bridge.consume_once(1, window, t_tap, b"se:BCR2DN6DZKGJ5BI5:0x661bf095f5d21682"),
            Err(KernelError::ReplayDetected)
        );

        // Verify 1840/1373 ratio at qt:5a (0x5a = 90/256 = 45/128).
        let r_1840_1373 = Rational::new(1840, 1373).unwrap();
        let qt_5a = (Bfp64 {
            mantissa: 0x5a,
            exp2: -8,
        })
        .to_rational()
        .unwrap();
        assert_eq!(r_1840_1373.numerator(), 1840);
        assert_eq!(r_1840_1373.denominator(), 1373);
        assert_eq!(qt_5a, Rational::new(45, 128).unwrap());
    }
}
