package dev.vaked.zeno.transit

import android.nfc.TagLostException
import android.nfc.tech.NfcF
import dev.vaked.zeno.native.NativeBridge
import org.json.JSONObject

/**
 * NFC I/O shell for physical Japanese transit IC cards.
 *
 * Every protocol decision (frame layout, adaptive header offset, history
 * parsing, date bit-packing, fare deltas) lives in the Rust native core
 * (`apps/rust/zeno-native`, `cargo test`); Kotlin only moves bytes between
 * the NFC controller and Rust, and renders the result.
 */
data class IcEntry(
    val date: String,
    val kind: String,
    val stationHex: String,
    val deltaJPY: Int?,
    val balanceJPY: Int,
)

data class IcReadResult(
    val idmHex: String = "",
    val systemCodeHex: String = "",
    val balanceJPY: Int? = null,
    val entries: List<IcEntry> = emptyList(),
    val error: String? = null,
    val partial: Boolean = false,
)

object PhysicalIcReader {
    const val SYSTEM_CODE_JAPAN_IC = 0x0003
    const val SERVICE_HISTORY = 0x090f
    private const val HISTORY_BLOCKS = 20
    private const val MAX_BLOCKS_PER_READ = 15

    private class Box {
        var data: ByteArray = ByteArray(0)
    }

    fun read(tag: NfcF): IcReadResult {
        val idm = tag.manufacturer
        val idmHex = idm.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
        val scBytes = tag.systemCode
        val systemCode =
            if (scBytes.size >= 2) ((scBytes[0].toInt() and 0xFF) shl 8) or (scBytes[1].toInt() and 0xFF) else -1
        if (systemCode != SYSTEM_CODE_JAPAN_IC) {
            return IcReadResult(
                idmHex = idmHex,
                systemCodeHex = "0x%04x".format(systemCode),
                error = "交通系IC（system 0x0003）ではありません",
            )
        }
        val box = Box()
        val partial = try {
            tag.connect()
            runCatching { tag.transceive(NativeBridge.buildPollFrame()) }
            readAll(tag, idm, box)
            false
        } catch (lost: TagLostException) {
            box.data.isNotEmpty()
        } catch (e: Exception) {
            return IcReadResult(
                idmHex = idmHex,
                systemCodeHex = "0x%04x".format(systemCode),
                error = "読取失敗: " + (e.message ?: e.javaClass.simpleName),
            )
        } finally {
            runCatching { tag.close() }
        }

        return try {
            android.util.Log.i(
                "ZenoIc",
                "raw=" + box.data.take(32).joinToString("") { "%02x".format(it.toInt() and 0xFF) },
            )
            val json = NativeBridge.parseHistoryJson(box.data)
                ?: throw java.io.IOException(NativeBridge.lastError())
            val obj = JSONObject(json)
            val entriesJson = obj.getJSONArray("entries")
            val entries = (0 until entriesJson.length()).map { i ->
                val item = entriesJson.getJSONObject(i)
                IcEntry(
                    date = item.getString("date"),
                    kind = item.getString("kind"),
                    stationHex = item.getString("stationHex"),
                    deltaJPY = if (item.isNull("delta")) null else item.getInt("delta"),
                    balanceJPY = item.getInt("balance"),
                )
            }
            IcReadResult(
                idmHex = idmHex,
                systemCodeHex = "0x%04x".format(systemCode),
                balanceJPY = if (obj.isNull("balance")) null else obj.getInt("balance"),
                entries = entries,
                partial = partial,
            )
        } catch (e: Exception) {
            IcReadResult(
                idmHex = idmHex,
                systemCodeHex = "0x%04x".format(systemCode),
                error = "読取失敗: " + (e.message ?: e.javaClass.simpleName),
                partial = partial,
            )
        }
    }

    private fun readAll(tag: NfcF, idm: ByteArray, box: Box) {
        var block = 0
        while (block < HISTORY_BLOCKS) {
            val count = minOf(MAX_BLOCKS_PER_READ, HISTORY_BLOCKS - block)
            val chunk = readChunk(tag, idm, block, count)
            if (chunk == null) {
                var cursor = block
                while (cursor < block + count) {
                    val single = readChunk(tag, idm, cursor, 1) ?: return
                    box.data += single
                    cursor++
                }
            } else {
                box.data += chunk
            }
            block += count
        }
    }

    private fun readChunk(tag: NfcF, idm: ByteArray, block: Int, count: Int): ByteArray? {
        val frame = NativeBridge.buildReadFrame(idm, block, count)
        var response: ByteArray? = null
        var attempts = 0
        while (response == null && attempts < READ_ATTEMPTS) {
            response = try {
                tag.transceive(frame)
            } catch (lost: TagLostException) {
                throw lost
            } catch (e: java.io.IOException) {
                attempts++
                null
            }
        }
        val resp = response ?: return null
        return NativeBridge.extractBlocks(resp, count)
    }

    private const val READ_ATTEMPTS = 3
}
