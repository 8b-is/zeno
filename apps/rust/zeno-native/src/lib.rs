//! JNI surface for the ZENO native core. Kotlin moves bytes and pixels;
//! every protocol decision lives in Rust (`felica`).

use jni::objects::{JByteArray, JClass, JString};
use jni::sys::{jboolean, jbyte, jbyteArray, jint, jlong, jstring, JNI_FALSE, JNI_TRUE};
use jni::JNIEnv;

mod felica;

const MAX_JNI_BYTES: usize = 16_384;

thread_local! {
    static LAST_ERROR: std::cell::RefCell<String> = const { std::cell::RefCell::new(String::new()) };
}

fn set_error(message: String) {
    LAST_ERROR.with(|slot| *slot.borrow_mut() = message);
}

fn read_bytes(env: &mut JNIEnv, array: &JByteArray) -> Result<Vec<u8>, String> {
    let raw_len = env.get_array_length(array).map_err(|e| e.to_string())?;
    if raw_len < 0 {
        return Err("negative byte array length".into());
    }
    let len = raw_len as usize;
    if len > MAX_JNI_BYTES {
        return Err(format!("byte array exceeds max {} bytes", MAX_JNI_BYTES));
    }
    let mut buf = vec![0i8; len];
    env.get_byte_array_region(array, 0, &mut buf)
        .map_err(|e| e.to_string())?;
    Ok(buf.iter().map(|b| *b as u8).collect())
}

fn write_bytes(env: &mut JNIEnv, data: &[u8]) -> jbyteArray {
    let Ok(len_i32) = i32::try_from(data.len()) else {
        return std::ptr::null_mut();
    };
    let out = match env.new_byte_array(len_i32) {
        Ok(array) => array,
        Err(_) => return std::ptr::null_mut(),
    };
    let signed: Vec<jbyte> = data.iter().map(|b| *b as jbyte).collect();
    if env.set_byte_array_region(&out, 0, &signed).is_err() {
        return std::ptr::null_mut();
    }
    out.into_raw()
}

fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_buildPollFrame(
    mut env: JNIEnv,
    _class: JClass,
) -> jbyteArray {
    write_bytes(&mut env, &felica::build_poll_frame())
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_buildReadFrame(
    mut env: JNIEnv,
    _class: JClass,
    idm: JByteArray,
    block: jint,
    count: jint,
) -> jbyteArray {
    let idm = match read_bytes(&mut env, &idm) {
        Ok(bytes) => bytes,
        Err(message) => {
            set_error(message);
            return std::ptr::null_mut();
        }
    };
    let Ok(block_u8) = u8::try_from(block) else {
        set_error("block index out of u8 range".into());
        return std::ptr::null_mut();
    };
    let Ok(count_u8) = u8::try_from(count) else {
        set_error("block count out of u8 range".into());
        return std::ptr::null_mut();
    };
    if idm.len() != 8 || usize::from(count_u8) > felica::MAX_BLOCKS_PER_READ || block_u8.checked_add(count_u8).is_none() {
        set_error("invalid FeliCa read frame bounds".into());
        return std::ptr::null_mut();
    }
    let frame = felica::build_read_frame(&idm, block_u8, count_u8);
    write_bytes(&mut env, &frame)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_extractBlocks(
    mut env: JNIEnv,
    _class: JClass,
    resp: JByteArray,
    count: jint,
) -> jbyteArray {
    let resp = match read_bytes(&mut env, &resp) {
        Ok(bytes) => bytes,
        Err(message) => {
            set_error(message);
            return std::ptr::null_mut();
        }
    };
    let Ok(count_usize) = usize::try_from(count) else {
        set_error("negative block count".into());
        return std::ptr::null_mut();
    };
    if count_usize > felica::MAX_BLOCKS_PER_READ {
        set_error("block count exceeds MAX_BLOCKS_PER_READ".into());
        return std::ptr::null_mut();
    }
    match felica::extract_blocks(&resp, count_usize) {
        Ok(blocks) => write_bytes(&mut env, &blocks),
        Err(message) => {
            set_error(message);
            std::ptr::null_mut()
        }
    }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_lastError(
    env: JNIEnv,
    _class: JClass,
) -> jstring {
    let message = LAST_ERROR.with(|slot| slot.borrow().clone());
    match env.new_string(message) {
        Ok(value) => value.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push_str(&format!("{:02x}", b));
    }
    out
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_parseHistoryJson(
    mut env: JNIEnv,
    _class: JClass,
    raw: JByteArray,
) -> jstring {
    let raw = match read_bytes(&mut env, &raw) {
        Ok(bytes) => bytes,
        Err(message) => {
            set_error(message);
            return std::ptr::null_mut();
        }
    };
    let parsed = felica::parse_history(&raw);
    let seal = zeno_issuer_angel::WupzWitnessSeal::seal(&raw);
    let genesis = [0u8; 32];
    let merchant_frame = zeno_issuer_angel::OneCompressionFrame::ingest_merchant_frame(&genesis, 2)
        .ok();
    let base_trace = merchant_frame
        .map(|f| f.kintsugi_trace)
        .unwrap_or(genesis);
    let card_trace = zeno_issuer_angel::kintsugi_trace_chain(&base_trace, &seal.bytes);

    let mut json = String::from("{\"balance\":");
    match parsed.balance {
        Some(balance) => json.push_str(&balance.to_string()),
        None => json.push_str("null"),
    }
    json.push_str(",\"merchantId\":\"");
    json.push_str(zeno_issuer_angel::GOOGLE_PAY_MERCHANT_ID);
    json.push_str("\",\"ratio\":\"372/359\",\"qtBfp64\":\"85/256\",\"wupzSealHex\":\"");
    json.push_str(&hex_encode(&seal.bytes));
    json.push_str("\",\"kintsugiTraceHex\":\"");
    json.push_str(&hex_encode(&card_trace));
    json.push_str("\",\"entries\":[");
    for (index, entry) in parsed.entries.iter().enumerate() {
        if index > 0 {
            json.push(',');
        }
        json.push_str("{\"date\":\"");
        json.push_str(&escape(&entry.date));
        json.push_str("\",\"kind\":\"");
        json.push_str(&escape(&entry.kind));
        json.push_str("\",\"stationHex\":\"");
        json.push_str(&escape(&entry.station_hex));
        json.push_str("\",\"delta\":");
        match entry.delta {
            Some(delta) => json.push_str(&delta.to_string()),
            None => json.push_str("null"),
        }
        json.push_str(",\"balance\":");
        json.push_str(&entry.balance.to_string());
        json.push('}');
    }
    json.push_str("]}");
    match env.new_string(json) {
        Ok(value) => value.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Deterministic ARM64 NEON + `zeno-us-core` hardware verification summary.
pub fn build_asm_self_test_json() -> String {
    let backend = zeno_asm::asm_backend_tag();
    let sample = b"ZENO_ARM64_NEON_KINTSUGI_0X62_WITNESS_BLOCK_64BYTES_VERIFIED!!!!";
    let xor_fold = zeno_asm::wupz_xor_fold_asm(sample);
    let popcnt = zeno_asm::wupz_popcount_asm(sample);
    let gcd_305_2 = zeno_asm::gcd_u64_asm(305, 2);
    let d = [0x62u8; 32];
    let mut d_diff = d;
    d_diff[31] ^= 0x01;
    let ct_eq_ok = zeno_asm::ct_eq_32_asm(&d, &d) && !zeno_asm::ct_eq_32_asm(&d, &d_diff);
    let solana_b58_ok =
        zeno_us_core::decode_solana_pubkey("HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS").is_ok();
    let ok = gcd_305_2 == 1 && ct_eq_ok && solana_b58_ok;
    format!(
        "{{\"backend\":\"{}\",\"xorFoldHex\":\"{:016x}\",\"popcount\":{},\"gcd305_2\":{},\"ctEqOk\":{},\"solanaB58Ok\":{},\"ok\":{}}}",
        escape(backend),
        xor_fold,
        popcnt,
        gcd_305_2,
        ct_eq_ok,
        solana_b58_ok,
        ok
    )
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_asmBackendTag(
    env: JNIEnv,
    _class: JClass,
) -> jstring {
    match env.new_string(zeno_asm::asm_backend_tag()) {
        Ok(value) => value.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_asmWupzXorFold(
    mut env: JNIEnv,
    _class: JClass,
    data: JByteArray,
) -> jlong {
    match read_bytes(&mut env, &data) {
        Ok(bytes) => zeno_asm::wupz_xor_fold_asm(&bytes) as jlong,
        Err(msg) => {
            set_error(msg);
            0
        }
    }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_asmWupzPopcount(
    mut env: JNIEnv,
    _class: JClass,
    data: JByteArray,
) -> jint {
    match read_bytes(&mut env, &data) {
        Ok(bytes) => zeno_asm::wupz_popcount_asm(&bytes) as jint,
        Err(msg) => {
            set_error(msg);
            -1
        }
    }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_asmGcdU64(
    _env: JNIEnv,
    _class: JClass,
    a: jlong,
    b: jlong,
) -> jlong {
    if a < 0 || b < 0 {
        set_error("negative gcd input rejected".into());
        return 0;
    }
    zeno_asm::gcd_u64_asm(a as u64, b as u64) as jlong
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_asmCtEq32(
    mut env: JNIEnv,
    _class: JClass,
    a: JByteArray,
    b: JByteArray,
) -> jboolean {
    let Ok(bytes_a) = read_bytes(&mut env, &a) else {
        return JNI_FALSE;
    };
    let Ok(bytes_b) = read_bytes(&mut env, &b) else {
        return JNI_FALSE;
    };
    let (Ok(arr_a), Ok(arr_b)) = (<[u8; 32]>::try_from(bytes_a.as_slice()), <[u8; 32]>::try_from(bytes_b.as_slice())) else {
        set_error("ct_eq_32 requires exact 32-byte arrays".into());
        return JNI_FALSE;
    };
    if zeno_asm::ct_eq_32_asm(&arr_a, &arr_b) { JNI_TRUE } else { JNI_FALSE }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_validateSolanaBase58(
    mut env: JNIEnv,
    _class: JClass,
    address: JString,
) -> jboolean {
    let Ok(jstr) = env.get_string(&address) else {
        return JNI_FALSE;
    };
    let Ok(s) = jstr.to_str() else {
        return JNI_FALSE;
    };
    if s.len() > 64 {
        return JNI_FALSE;
    }
    if zeno_us_core::decode_solana_pubkey(s.trim()).is_ok() { JNI_TRUE } else { JNI_FALSE }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_asmSelfTestJson(
    env: JNIEnv,
    _class: JClass,
) -> jstring {
    match env.new_string(build_asm_self_test_json()) {
        Ok(value) => value.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

#[cfg(test)]
mod tests {
    use super::build_asm_self_test_json;

    #[test]
    fn asm_jni_self_test_reports_ok_and_ct_eq() {
        let report = build_asm_self_test_json();
        assert!(report.contains("\"ok\":true"), "self test failed: {report}");
        assert!(report.contains("\"ctEqOk\":true"));
        assert!(report.contains("\"solanaB58Ok\":true"));
        assert!(report.contains("\"gcd305_2\":1"));
    }
}
