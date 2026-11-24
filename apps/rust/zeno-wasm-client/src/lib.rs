#![cfg_attr(all(target_arch = "wasm32", not(test), feature = "standalone-wasm"), no_std)]
//! Zero-dependency `#![no_std]` Client-Side Rust WebAssembly Micro-Kernel (`zeno-client.wasm`).
//!
//! - Zero JS glue (`wasm-bindgen` not required), zero heap allocator, zero `f32`/`f64` floats.
//! - Uses a fixed 1 KiB linear-memory scratch buffer so browsers & Node pass UTF-8/byte inputs
//!   safely with strict bounds validation.
//! - Designed for W3C CSP Level 3 `'wasm-unsafe-eval'` without enabling JS `eval()`.

use core::cell::UnsafeCell;

const SCRATCH_CAP: usize = 1024;
const WUPZ_ABI_VERSION: u32 = 1120; // v1.12.0

#[repr(transparent)]
struct ScratchBuf(UnsafeCell<[u8; SCRATCH_CAP]>);

// SAFETY: WebAssembly linear memory executes single-threaded in the client runtime without
// shared-memory atomics; host access uses explicit scratch pointer helpers.
unsafe impl Sync for ScratchBuf {}

static SCRATCH: ScratchBuf = ScratchBuf(UnsafeCell::new([0u8; SCRATCH_CAP]));

#[cfg(all(target_arch = "wasm32", not(test), feature = "standalone-wasm"))]
#[panic_handler]
fn wasm_panic(_info: &core::panic::PanicInfo<'_>) -> ! {
    core::arch::wasm32::unreachable()
}

fn scratch_slice(offset: u32, len: u32) -> Option<&'static [u8]> {
    let start = offset as usize;
    let count = len as usize;
    let end = start.checked_add(count)?;
    if end > SCRATCH_CAP {
        return None;
    }
    // SAFETY: Bounds [start..end] verified strictly <= SCRATCH_CAP on static linear buffer;
    // WASM execution is single-threaded per invocation.
    let buf: &[u8; SCRATCH_CAP] = unsafe { &*SCRATCH.0.get() };
    Some(&buf[start..end])
}

#[unsafe(no_mangle)]
pub extern "C" fn zeno_wasm_version() -> u32 {
    WUPZ_ABI_VERSION
}

#[unsafe(no_mangle)]
pub extern "C" fn zeno_scratch_ptr() -> *mut u8 {
    SCRATCH.0.get().cast::<u8>()
}

#[unsafe(no_mangle)]
pub extern "C" fn zeno_scratch_len() -> u32 {
    SCRATCH_CAP as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn zeno_gcd_u64(mut a: u64, mut b: u64) -> u64 {
    while b != 0 {
        (a, b) = (b, a % b);
    }
    a
}

#[unsafe(no_mangle)]
pub extern "C" fn zeno_wupz_xor_fold(offset: u32, len: u32) -> u64 {
    let Some(bytes) = scratch_slice(offset, len) else {
        return 0;
    };
    let mut a0 = 0u64;
    let mut a1 = 0u64;
    let mut a2 = 0u64;
    let mut a3 = 0u64;
    let (chunks64, rem64) = bytes.as_chunks::<64>();
    for c in chunks64 {
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
    let (chunks8, rem) = rem64.as_chunks::<8>();
    for c in chunks8 {
        acc ^= u64::from_le_bytes([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]]);
    }
    if !rem.is_empty() {
        let mut tail = [0u8; 8];
        tail[..rem.len()].copy_from_slice(rem);
        acc ^= u64::from_le_bytes(tail);
    }
    acc
}

#[unsafe(no_mangle)]
pub extern "C" fn zeno_wupz_popcount(offset: u32, len: u32) -> u32 {
    let Some(bytes) = scratch_slice(offset, len) else {
        return 0;
    };
    let mut total = 0u32;
    let (chunks8, rem) = bytes.as_chunks::<8>();
    for c in chunks8 {
        let w = u64::from_le_bytes([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]]);
        total = total.wrapping_add(w.count_ones());
    }
    for &b in rem {
        total = total.wrapping_add(b.count_ones());
    }
    total
}

#[unsafe(no_mangle)]
pub extern "C" fn zeno_ct_eq_32(off_a: u32, off_b: u32) -> i32 {
    let (Some(a), Some(b)) = (scratch_slice(off_a, 32), scratch_slice(off_b, 32)) else {
        return -1;
    };
    let mut diff = 0u8;
    let mut i = 0usize;
    while i < 32 {
        diff |= a[i] ^ b[i];
        i += 1;
    }
    if diff == 0 { 1 } else { 0 }
}

/// Exact zero-float integer FX conversion (`currency_id`: 0=USD, 1=JPY, 2=EUR, 3=GBP, 4=HUF).
#[unsafe(no_mangle)]
pub extern "C" fn zeno_fx_convert_micro(amount_micro: u64, currency_id: u32) -> u64 {
    let (p, q): (u128, u128) = match currency_id {
        0 => (1, 1),    // USD
        1 => (305, 2),  // JPY 152.50
        2 => (23, 25),  // EUR 0.92
        3 => (79, 100), // GBP 0.79
        4 => (737, 2),  // HUF 368.50
        _ => return 0,
    };
    let scaled = (u128::from(amount_micro)).saturating_mul(p) / q;
    u64::try_from(scaled).unwrap_or(0)
}

#[unsafe(no_mangle)]
pub extern "C" fn zeno_sanpo_yoshi_family(total_micro: u64) -> u64 {
    ((u128::from(total_micro) * 3) / 10) as u64
}

#[unsafe(no_mangle)]
pub extern "C" fn zeno_sanpo_yoshi_foken(total_micro: u64) -> u64 {
    ((u128::from(total_micro) * 2) / 10) as u64
}

#[unsafe(no_mangle)]
pub extern "C" fn zeno_sanpo_yoshi_operating(total_micro: u64) -> u64 {
    let family = zeno_sanpo_yoshi_family(total_micro);
    let foken = zeno_sanpo_yoshi_foken(total_micro);
    total_micro.saturating_sub(family.saturating_add(foken))
}

/// Exact integer FOKEN Net Utility in milli-hours (`1.000 h = 1000`):
/// `net = avoided - (added + 1.5 * debt) = avoided - added - (3 * debt) / 2`.
#[unsafe(no_mangle)]
pub extern "C" fn zeno_foken_net_milli_hours(
    avoided_milli: i64,
    added_milli: i64,
    debt_milli: i64,
) -> i64 {
    let net = i128::from(avoided_milli)
        - i128::from(added_milli)
        - (i128::from(debt_milli) * 3) / 2;
    i64::try_from(net).unwrap_or(0)
}

const B58_ALPHABET: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

fn b58_val(byte: u8) -> Option<u32> {
    let mut idx = 0usize;
    while idx < B58_ALPHABET.len() {
        if B58_ALPHABET[idx] == byte {
            return Some(idx as u32);
        }
        idx += 1;
    }
    None
}

/// Validate a Solana Ed25519 Base58 public key written into SCRATCH[offset..offset+len].
/// Returns `1` for valid non-zero 32-byte pubkey, `0` for invalid input/format.
#[unsafe(no_mangle)]
pub extern "C" fn zeno_validate_solana_b58(offset: u32, len: u32) -> i32 {
    if !(32..=44).contains(&len) {
        return 0;
    }
    let Some(bytes) = scratch_slice(offset, len) else {
        return 0;
    };

    let mut leading_ones = 0usize;
    while leading_ones < bytes.len() && bytes[leading_ones] == b'1' {
        leading_ones += 1;
    }

    let mut out = [0u8; 32];
    for &ch in &bytes[leading_ones..] {
        let Some(val) = b58_val(ch) else {
            return 0;
        };
        let mut carry = val;
        let mut i = 32usize;
        while i > 0 {
            i -= 1;
            carry += u32::from(out[i]) * 58;
            out[i] = (carry & 0xff) as u8;
            carry >>= 8;
        }
        if carry != 0 {
            return 0;
        }
    }

    let mut non_zero_start = 0usize;
    while non_zero_start < 32 && out[non_zero_start] == 0 {
        non_zero_start += 1;
    }
    if non_zero_start < leading_ones {
        return 0;
    }

    let mut all_zero = true;
    for &b in &out {
        if b != 0 {
            all_zero = false;
            break;
        }
    }
    if all_zero { 0 } else { 1 }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_scratch(offset: usize, data: &[u8]) {
        assert!(offset + data.len() <= SCRATCH_CAP);
        // SAFETY: Host unit test exclusively accesses SCRATCH sequentially or per slot.
        unsafe {
            let ptr = zeno_scratch_ptr().add(offset);
            core::ptr::copy_nonoverlapping(data.as_ptr(), ptr, data.len());
        }
    }

    #[test]
    fn fx_sanpo_foken_gcd_exact() {
        assert_eq!(zeno_wasm_version(), 1120);
        assert_eq!(zeno_scratch_len(), 1024);
        assert_eq!(zeno_gcd_u64(305, 2), 1);
        assert_eq!(zeno_gcd_u64(52_040_500_000, 52_040_500_000), 52_040_500_000);

        assert_eq!(zeno_fx_convert_micro(100_000_000, 0), 100_000_000);
        assert_eq!(zeno_fx_convert_micro(100_000_000, 1), 15_250_000_000);
        assert_eq!(zeno_fx_convert_micro(100_000_000, 2), 92_000_000);
        assert_eq!(zeno_fx_convert_micro(100_000_000, 3), 79_000_000);
        assert_eq!(zeno_fx_convert_micro(100_000_000, 4), 36_850_000_000);
        assert_eq!(zeno_fx_convert_micro(100_000_000, 99), 0);

        let total = 49_000_000;
        let fam = zeno_sanpo_yoshi_family(total);
        let fok = zeno_sanpo_yoshi_foken(total);
        let ops = zeno_sanpo_yoshi_operating(total);
        assert_eq!(fam, 14_700_000);
        assert_eq!(fok, 9_800_000);
        assert_eq!(ops, 24_500_000);
        assert_eq!(fam + fok + ops, total);

        assert_eq!(zeno_foken_net_milli_hours(100_000, 10_000, 2_000), 87_000);
    }

    #[test]
    fn scratch_solana_wupz_and_oob_safety() {
        let valid = b"HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS";
        write_scratch(0, valid);
        assert_eq!(zeno_validate_solana_b58(0, valid.len() as u32), 1);

        let all_zero = b"11111111111111111111111111111111";
        write_scratch(64, all_zero);
        assert_eq!(zeno_validate_solana_b58(64, all_zero.len() as u32), 0);

        let bad_chars = b"0OIlHpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkb";
        write_scratch(128, bad_chars);
        assert_eq!(zeno_validate_solana_b58(128, bad_chars.len() as u32), 0);

        // WUPZ XOR fold & popcount + constant-time 32B compare
        let a = [0xAAu8; 32];
        let mut b = [0xAAu8; 32];
        write_scratch(256, &a);
        write_scratch(320, &b);
        assert_eq!(zeno_wupz_popcount(256, 32), 32 * 4);
        assert_eq!(zeno_ct_eq_32(256, 320), 1);
        b[31] ^= 0x01;
        write_scratch(320, &b);
        assert_eq!(zeno_ct_eq_32(256, 320), 0);

        let non_linear: [u8; 65] = core::array::from_fn(|i| ((i * i * 17 + i * 73 + 19) & 0xff) as u8);
        write_scratch(512, &non_linear);
        let expected_w0 = u64::from_le_bytes(non_linear[0..8].try_into().unwrap())
            ^ u64::from_le_bytes(non_linear[32..40].try_into().unwrap());
        let expected_w1 = u64::from_le_bytes(non_linear[8..16].try_into().unwrap())
            ^ u64::from_le_bytes(non_linear[40..48].try_into().unwrap());
        let expected_w2 = u64::from_le_bytes(non_linear[16..24].try_into().unwrap())
            ^ u64::from_le_bytes(non_linear[48..56].try_into().unwrap());
        let expected_w3 = u64::from_le_bytes(non_linear[24..32].try_into().unwrap())
            ^ u64::from_le_bytes(non_linear[56..64].try_into().unwrap());
        let expected = expected_w0 ^ expected_w1 ^ expected_w2 ^ expected_w3 ^ u64::from(non_linear[64]);
        assert_eq!(zeno_wupz_xor_fold(512, 65), expected);
        assert_ne!(zeno_wupz_xor_fold(512, 65), 0);

        // Out-of-bounds protection
        assert_eq!(zeno_ct_eq_32(1000, 0), -1);
        assert_eq!(zeno_wupz_xor_fold(1020, 16), 0);
        assert_eq!(zeno_wupz_popcount(1020, 16), 0);
        assert_eq!(zeno_validate_solana_b58(1020, 32), 0);
    }
}
