#![cfg_attr(not(test), no_std)]
//! Bare-metal `#![no_std]` Rust + `core::arch::asm!` acceleration kernels for ZENO.
//!
//! Architecture isolation rule:
//! - Hardware inline assembly lives ONLY in `zeno-asm`; `zeno-us-core` retains `#![forbid(unsafe_code)]`.
//! - Zero floating-point types (`f32`/`f64`) anywhere in the crate.
//! - Every assembly kernel has a bit-exact pure-Rust reference implementation tested under differential fuzzing.

/// Return the active assembly backend tag for diagnostics & telemetry.
pub const fn asm_backend_tag() -> &'static str {
    #[cfg(target_arch = "aarch64")]
    {
        "aarch64-neon-inline-asm"
    }
    #[cfg(all(target_arch = "x86_64", not(target_arch = "aarch64")))]
    {
        "x86_64-inline-asm"
    }
    #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64")))]
    {
        "portable-no-std"
    }
}

#[inline(always)]
fn read_le_u64(chunk: &[u8]) -> u64 {
    u64::from_le_bytes([
        chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5], chunk[6], chunk[7],
    ])
}

#[cfg(target_arch = "aarch64")]
#[inline(always)]
fn eor4_aarch64(mut acc: [u64; 4], w: [u64; 4]) -> [u64; 4] {
    // SAFETY: Register-only AArch64 `eor` instructions; no memory dereferences or side effects.
    unsafe {
        core::arch::asm!(
            "eor {a0}, {a0}, {w0}",
            "eor {a1}, {a1}, {w1}",
            "eor {a2}, {a2}, {w2}",
            "eor {a3}, {a3}, {w3}",
            a0 = inout(reg) acc[0],
            a1 = inout(reg) acc[1],
            a2 = inout(reg) acc[2],
            a3 = inout(reg) acc[3],
            w0 = in(reg) w[0],
            w1 = in(reg) w[1],
            w2 = in(reg) w[2],
            w3 = in(reg) w[3],
            options(pure, nomem, nostack),
        );
    }
    acc
}

#[cfg(target_arch = "x86_64")]
#[inline(always)]
fn xor4_x86_64(mut acc: [u64; 4], w: [u64; 4]) -> [u64; 4] {
    // SAFETY: Register-only x86_64 `xor` instructions over local u64 accumulators.
    unsafe {
        core::arch::asm!(
            "xor {a0}, {w0}",
            "xor {a1}, {w1}",
            "xor {a2}, {w2}",
            "xor {a3}, {w3}",
            a0 = inout(reg) acc[0],
            a1 = inout(reg) acc[1],
            a2 = inout(reg) acc[2],
            a3 = inout(reg) acc[3],
            w0 = in(reg) w[0],
            w1 = in(reg) w[1],
            w2 = in(reg) w[2],
            w3 = in(reg) w[3],
            options(pure, nomem, nostack),
        );
    }
    acc
}

/// Bit-exact `wupz` C ABI v1 4-way unrolled 64-bit XOR-fold kernel using inline assembly.
pub fn wupz_xor_fold_asm(bytes: &[u8]) -> u64 {
    let mut acc4 = [0u64; 4];

    let (chunks64, rem64) = bytes.as_chunks::<64>();
    for c in chunks64 {
        let w = [
            read_le_u64(&c[0..8]) ^ read_le_u64(&c[32..40]),
            read_le_u64(&c[8..16]) ^ read_le_u64(&c[40..48]),
            read_le_u64(&c[16..24]) ^ read_le_u64(&c[48..56]),
            read_le_u64(&c[24..32]) ^ read_le_u64(&c[56..64]),
        ];

        #[cfg(target_arch = "aarch64")]
        {
            acc4 = eor4_aarch64(acc4, w);
        }
        #[cfg(target_arch = "x86_64")]
        {
            acc4 = xor4_x86_64(acc4, w);
        }
        #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64")))]
        {
            acc4[0] ^= w[0];
            acc4[1] ^= w[1];
            acc4[2] ^= w[2];
            acc4[3] ^= w[3];
        }
    }

    let mut acc = (acc4[0] ^ acc4[1]) ^ (acc4[2] ^ acc4[3]);
    let (chunks8, rem) = rem64.as_chunks::<8>();
    for c in chunks8 {
        acc ^= read_le_u64(c);
    }
    if !rem.is_empty() {
        let mut tail = [0u8; 8];
        tail[..rem.len()].copy_from_slice(rem);
        acc ^= u64::from_le_bytes(tail);
    }
    acc
}

#[cfg(target_arch = "aarch64")]
#[inline(always)]
fn popcnt_u64_aarch64(x: u64) -> u32 {
    let out: u32;
    // SAFETY: Pure AArch64 NEON `fmov`/`cnt`/`addv`/`umov` over a value register; v0 declared clobbered.
    unsafe {
        core::arch::asm!(
            "fmov d0, {x}",
            "cnt v0.8b, v0.8b",
            "addv b0, v0.8b",
            "umov {out:w}, v0.b[0]",
            x = in(reg) x,
            out = lateout(reg) out,
            out("v0") _,
            options(pure, nomem, nostack),
        );
    }
    out
}

#[cfg(all(target_arch = "x86_64", target_feature = "popcnt"))]
#[inline(always)]
fn popcnt_u64_x86_64(x: u64) -> u32 {
    let out: u64;
    // SAFETY: `popcnt` instruction enabled via cfg(target_feature = "popcnt"); pure register op.
    unsafe {
        core::arch::asm!(
            "popcnt {out}, {x}",
            x = in(reg) x,
            out = lateout(reg) out,
            options(pure, nomem, nostack),
        );
    }
    out as u32
}

#[inline(always)]
fn popcnt_u64(x: u64) -> u32 {
    #[cfg(target_arch = "aarch64")]
    {
        popcnt_u64_aarch64(x)
    }
    #[cfg(all(target_arch = "x86_64", target_feature = "popcnt"))]
    {
        popcnt_u64_x86_64(x)
    }
    #[cfg(not(any(
        target_arch = "aarch64",
        all(target_arch = "x86_64", target_feature = "popcnt")
    )))]
    {
        x.count_ones()
    }
}

/// Bit-exact `wupz` C ABI v1 4-way unrolled popcount kernel (`aarch64` NEON `cnt`/`addv`).
pub fn wupz_popcount_asm(bytes: &[u8]) -> u32 {
    let mut c0 = 0u32;
    let mut c1 = 0u32;
    let mut c2 = 0u32;
    let mut c3 = 0u32;

    let (chunks32, rem32) = bytes.as_chunks::<32>();
    for c in chunks32 {
        c0 = c0.wrapping_add(popcnt_u64(read_le_u64(&c[0..8])));
        c1 = c1.wrapping_add(popcnt_u64(read_le_u64(&c[8..16])));
        c2 = c2.wrapping_add(popcnt_u64(read_le_u64(&c[16..24])));
        c3 = c3.wrapping_add(popcnt_u64(read_le_u64(&c[24..32])));
    }

    let mut count = c0.wrapping_add(c1).wrapping_add(c2.wrapping_add(c3));
    for &b in rem32 {
        count = count.wrapping_add(b.count_ones());
    }
    count
}

/// Branchless constant-time 32-byte digest comparison (`aarch64` / `x86_64` inline ASM).
pub fn ct_eq_32_asm(a: &[u8; 32], b: &[u8; 32]) -> bool {
    let w0 = read_le_u64(&a[0..8]);
    let w1 = read_le_u64(&a[8..16]);
    let w2 = read_le_u64(&a[16..24]);
    let w3 = read_le_u64(&a[24..32]);
    let y0 = read_le_u64(&b[0..8]);
    let y1 = read_le_u64(&b[8..16]);
    let y2 = read_le_u64(&b[16..24]);
    let y3 = read_le_u64(&b[24..32]);

    #[cfg(target_arch = "aarch64")]
    {
        let eq: u32;
        // SAFETY: Register-only constant-time `eor`/`orr`/`cmp`/`cset`; zero secret-dependent branches.
        unsafe {
            core::arch::asm!(
                "eor {a0}, {a0}, {b0}",
                "eor {a1}, {a1}, {b1}",
                "eor {a2}, {a2}, {b2}",
                "eor {a3}, {a3}, {b3}",
                "orr {a0}, {a0}, {a1}",
                "orr {a2}, {a2}, {a3}",
                "orr {a0}, {a0}, {a2}",
                "cmp {a0}, #0",
                "cset {eq:w}, eq",
                a0 = inout(reg) w0 => _,
                a1 = inout(reg) w1 => _,
                a2 = inout(reg) w2 => _,
                a3 = inout(reg) w3 => _,
                b0 = in(reg) y0,
                b1 = in(reg) y1,
                b2 = in(reg) y2,
                b3 = in(reg) y3,
                eq = lateout(reg) eq,
                options(pure, nomem, nostack),
            );
        }
        eq != 0
    }

    #[cfg(target_arch = "x86_64")]
    {
        let eq: u8;
        // SAFETY: Register-only constant-time `xor`/`or`/`test`/`sete`; zero secret-dependent branches.
        unsafe {
            core::arch::asm!(
                "xor {a0}, {b0}",
                "xor {a1}, {b1}",
                "xor {a2}, {b2}",
                "xor {a3}, {b3}",
                "or {a0}, {a1}",
                "or {a2}, {a3}",
                "or {a0}, {a2}",
                "test {a0}, {a0}",
                "sete {eq}",
                a0 = inout(reg) w0 => _,
                a1 = inout(reg) w1 => _,
                a2 = inout(reg) w2 => _,
                a3 = inout(reg) w3 => _,
                b0 = in(reg) y0,
                b1 = in(reg) y1,
                b2 = in(reg) y2,
                b3 = in(reg) y3,
                eq = lateout(reg_byte) eq,
                options(pure, nomem, nostack),
            );
        }
        eq != 0
    }

    #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64")))]
    {
        let diff = (w0 ^ y0) | (w1 ^ y1) | (w2 ^ y2) | (w3 ^ y3);
        diff == 0
    }
}

#[cfg(target_arch = "aarch64")]
#[inline(always)]
fn ctz_u64(mut x: u64) -> u32 {
    // SAFETY: Register-only AArch64 `rbit` + `clz` computes exact trailing zeros without branches.
    unsafe {
        core::arch::asm!(
            "rbit {x}, {x}",
            "clz {x}, {x}",
            x = inout(reg) x,
            options(pure, nomem, nostack),
        );
    }
    x as u32
}

#[cfg(not(target_arch = "aarch64"))]
#[inline(always)]
fn ctz_u64(x: u64) -> u32 {
    x.trailing_zeros()
}

/// Exact unsigned 64-bit Binary Stein's GCD (`aarch64` `rbit`/`clz` inline ASM).
pub fn gcd_u64_asm(mut a: u64, mut b: u64) -> u64 {
    if a == 0 {
        return b;
    }
    if b == 0 {
        return a;
    }
    let shift = ctz_u64(a | b);
    a >>= ctz_u64(a);
    loop {
        b >>= ctz_u64(b);
        if a > b {
            core::mem::swap(&mut a, &mut b);
        }
        b -= a;
        if b == 0 {
            return a << shift;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ref_wupz_xor_fold(bytes: &[u8]) -> u64 {
        let mut a0 = 0u64;
        let mut a1 = 0u64;
        let mut a2 = 0u64;
        let mut a3 = 0u64;
        let (chunks64, rem64) = bytes.as_chunks::<64>();
        for c in chunks64 {
            a0 ^= read_le_u64(&c[0..8]) ^ read_le_u64(&c[32..40]);
            a1 ^= read_le_u64(&c[8..16]) ^ read_le_u64(&c[40..48]);
            a2 ^= read_le_u64(&c[16..24]) ^ read_le_u64(&c[48..56]);
            a3 ^= read_le_u64(&c[24..32]) ^ read_le_u64(&c[56..64]);
        }
        let mut acc = (a0 ^ a1) ^ (a2 ^ a3);
        let (chunks8, rem) = rem64.as_chunks::<8>();
        for c in chunks8 {
            acc ^= read_le_u64(c);
        }
        if !rem.is_empty() {
            let mut tail = [0u8; 8];
            tail[..rem.len()].copy_from_slice(rem);
            acc ^= u64::from_le_bytes(tail);
        }
        acc
    }

    fn ref_wupz_popcount(bytes: &[u8]) -> u32 {
        let mut total = 0u32;
        for &b in bytes {
            total = total.wrapping_add(b.count_ones());
        }
        total
    }

    fn ref_gcd_u64(mut a: u64, mut b: u64) -> u64 {
        while b != 0 {
            (a, b) = (b, a % b);
        }
        a
    }

    fn xorshift64(state: &mut u64) -> u64 {
        let mut x = *state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        *state = x;
        x
    }

    #[test]
    fn backend_tag_matches_architecture() {
        let tag = asm_backend_tag();
        #[cfg(target_arch = "aarch64")]
        assert_eq!(tag, "aarch64-neon-inline-asm");
        #[cfg(target_arch = "x86_64")]
        assert_eq!(tag, "x86_64-inline-asm");
    }

    #[test]
    fn edge_case_lengths_match_reference() {
        for len in [0usize, 1, 7, 8, 15, 31, 32, 33, 63, 64, 65, 137, 255, 1024] {
            let mut buf = vec![0u8; len];
            for (i, b) in buf.iter_mut().enumerate() {
                *b = ((i * 73 + 19) & 0xff) as u8;
            }
            assert_eq!(wupz_xor_fold_asm(&buf), ref_wupz_xor_fold(&buf), "len={len}");
            assert_eq!(wupz_popcount_asm(&buf), ref_wupz_popcount(&buf), "len={len}");
        }
    }

    #[test]
    fn differential_fuzz_1000_vectors() {
        let mut seed = 0x62a6_9c3f_d6cd_ea62u64;
        let mut buf = [0u8; 300];
        for step in 0..1000usize {
            let len = (xorshift64(&mut seed) as usize) % (buf.len() + 1);
            for b in &mut buf[..len] {
                *b = xorshift64(&mut seed) as u8;
            }
            assert_eq!(
                wupz_xor_fold_asm(&buf[..len]),
                ref_wupz_xor_fold(&buf[..len]),
                "xor step={step}"
            );
            assert_eq!(
                wupz_popcount_asm(&buf[..len]),
                ref_wupz_popcount(&buf[..len]),
                "popcnt step={step}"
            );

            let mut d1 = [0u8; 32];
            let mut d2 = [0u8; 32];
            for (i, x) in d1.iter_mut().enumerate() {
                let v = xorshift64(&mut seed) as u8;
                *x = v;
                d2[i] = v;
            }
            assert!(ct_eq_32_asm(&d1, &d2));
            let flip_idx = (xorshift64(&mut seed) as usize) % 32;
            let flip_bit = 1u8 << ((xorshift64(&mut seed) as u32) % 8);
            d2[flip_idx] ^= flip_bit;
            assert!(!ct_eq_32_asm(&d1, &d2));

            let ga = xorshift64(&mut seed);
            let gb = xorshift64(&mut seed);
            assert_eq!(gcd_u64_asm(ga, gb), ref_gcd_u64(ga, gb));
        }

        // Corner GCD cases
        assert_eq!(gcd_u64_asm(0, 0), 0);
        assert_eq!(gcd_u64_asm(0, 42), 42);
        assert_eq!(gcd_u64_asm(42, 0), 42);
        assert_eq!(gcd_u64_asm(305, 2), 1);
        assert_eq!(gcd_u64_asm(52_040_500_000, 52_040_500_000), 52_040_500_000);
    }
}
