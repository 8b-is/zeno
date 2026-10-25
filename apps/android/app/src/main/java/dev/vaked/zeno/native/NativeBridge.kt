package dev.vaked.zeno.native

/**
 * JNI surface of the Rust native core (`apps/rust/zeno-native`).
 * Kotlin moves bytes and pixels only; every FeliCa protocol decision lives
 * in Rust and is unit-tested there (`cargo test`).
 */
object NativeBridge {
    init {
        System.loadLibrary("zeno_native")
    }

    external fun buildPollFrame(): ByteArray

    external fun buildReadFrame(idm: ByteArray, block: Int, count: Int): ByteArray

    /** Null on a recoverable card error; see [lastError] for the reason. */
    external fun extractBlocks(resp: ByteArray, count: Int): ByteArray?

    external fun lastError(): String

    /** JSON: {"balance":N|null,"entries":[{date,kind,stationHex,delta,balance}]} */
    external fun parseHistoryJson(raw: ByteArray): String
}
