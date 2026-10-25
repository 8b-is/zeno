//! JNI surface for the ZENO native core. Kotlin moves bytes and pixels;
//! every protocol decision lives in Rust (`felica`).

use jni::objects::{JByteArray, JClass, JString};
use jni::sys::{jbyte, jbyteArray, jint, jstring};
use jni::JNIEnv;

mod felica;

thread_local! {
    static LAST_ERROR: std::cell::RefCell<String> = std::cell::RefCell::new(String::new());
}

fn set_error(message: String) {
    LAST_ERROR.with(|slot| *slot.borrow_mut() = message);
}

fn read_bytes(env: &mut JNIEnv, array: &JByteArray) -> Result<Vec<u8>, String> {
    let len = env
        .get_array_length(array)
        .map_err(|e| e.to_string())?
        .max(0) as usize;
    let mut buf = vec![0i8; len];
    env.get_byte_array_region(array, 0, &mut buf)
        .map_err(|e| e.to_string())?;
    Ok(buf.iter().map(|b| *b as u8).collect())
}

fn write_bytes(env: &mut JNIEnv, data: &[u8]) -> jbyteArray {
    let out = match env.new_byte_array(data.len() as i32) {
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
    let frame = felica::build_read_frame(&idm, block as u8, count as u8);
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
    match felica::extract_blocks(&resp, count as usize) {
        Ok(blocks) => write_bytes(&mut env, &blocks),
        Err(message) => {
            set_error(message);
            std::ptr::null_mut()
        }
    }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_vaked_zeno_native_NativeBridge_lastError(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let message = LAST_ERROR.with(|slot| slot.borrow().clone());
    match env.new_string(message) {
        Ok(value) => value.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
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
    let mut json = String::from("{\"balance\":");
    match parsed.balance {
        Some(balance) => json.push_str(&balance.to_string()),
        None => json.push_str("null"),
    }
    json.push_str(",\"entries\":[");
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
