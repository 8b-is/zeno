package dev.vaked.zeno.transit

import android.nfc.tech.NfcF

/**
 * Read-only reader for physical Japanese transit IC cards (Suica, PASMO and the
 * nationwide mutual-use family).
 *
 * Wire facts (cross-checked against Metrodroid, GPL-3.0, transit/suica):
 *  - system code `0x0003` on every Japan IC card
 *  - history service `0x090f`, 20 blocks of 16 bytes, block 0 = newest
 *  - per block: [0] console type, [1] process type, [4..5] date (7b year from
 *    2000, 4b month, 5b day), [6..7] entry line/station BE, [8..9] exit
 *    line/station BE, [10..11] balance after the tap **little-endian**,
 *    [15] region code
 *  - fare for record i = balance(i+1) - balance(i); a charge shows as a
 *    negative fare (balance went up)
 *
 * This is strictly read-only (`readWithoutEncryption`); nothing is written,
 * nothing leaves the device, and the IDm is shown truncated.
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
    private const val CMD_READ_WITHOUT_ENCRYPTION = 0x06
    private const val RESP_READ_WITHOUT_ENCRYPTION = 0x07
    private const val BLOCK_SIZE = 16
    private const val HISTORY_BLOCKS = 20
    private const val MAX_BLOCKS_PER_READ = 15
    private const val READ_ATTEMPTS = 3

    fun read(tag: NfcF): IcReadResult {
        val idm = tag.manufacturer
        val idmHex = idm.joinToString("") { hex(it) }
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
        return try {
            tag.connect()
            val polledIdm = poll(tag) ?: idm
            var partial = false
            val raw = try {
                readHistoryBlocks(tag, polledIdm).also {
                    android.util.Log.i(
                        "ZenoIc",
                        "raw=" + it.take(32).joinToString("") { b -> "%02x".format(b.toInt() and 0xFF) },
                    )
                }
            } catch (lost: android.nfc.TagLostException) {
                partial = true
                partialBuffer
            }
            parseHistory(idmHex, "0x%04x".format(systemCode), raw).copy(partial = partial)
        } catch (e: Exception) {
            IcReadResult(
                idmHex = idmHex,
                systemCodeHex = "0x%04x".format(systemCode),
                error = "読取失敗: " + (e.message ?: e.javaClass.simpleName),
            )
        } finally {
            runCatching { tag.close() }
        }
    }

    /**
     * FeliCa READ_WO_ENCRYPTION (0x06) built by hand: Android's public NfcF API
     * does not expose it, so the frame goes over [NfcF.transceive].
     * Response: len, 0x07, IDm(8), statusFlag1, statusFlag2, then 16 B per block.
     */
    private var partialBuffer: ByteArray = ByteArray(0)

    private fun readHistoryBlocks(tag: NfcF, idm: ByteArray): ByteArray {
        var out = ByteArray(0)
        var block = 0
        while (block < HISTORY_BLOCKS) {
            val count = minOf(MAX_BLOCKS_PER_READ, HISTORY_BLOCKS - block)
            try {
                val chunk = readChunk(tag, idm, block, count)
                if (chunk == null) {
                    for (b in block until block + count) {
                        val single = readChunk(tag, idm, b, 1) ?: break
                        out += single
                    }
                } else {
                    out += chunk
                }
            } catch (lost: android.nfc.TagLostException) {
                partialBuffer = out
                throw lost
            }
            block += count
        }
        partialBuffer = ByteArray(0)
        return out
    }

    /**
     * FeliCa POLLING (0x00) with the Japan-IC system code. Suica/PASMO expect a
     * dedicated poll before service commands; Android's wildcard poll alone
     * makes the first READ time out ("Tag was lost").
     */
    private fun poll(tag: NfcF): ByteArray? {
        val cmd = byteArrayOf(
            0x06, 0x00,
            (SYSTEM_CODE_JAPAN_IC shr 8).toByte(),
            (SYSTEM_CODE_JAPAN_IC and 0xFF).toByte(),
            0x00, 0x00,
        )
        return try {
            val resp = tag.transceive(cmd)
            if (resp.size >= 10 && (resp[1].toInt() and 0xFF) == 0x01) resp.copyOfRange(2, 10) else null
        } catch (e: java.io.IOException) {
            null
        }
    }

    /** Block data for [count] blocks from [block]; null on a recoverable card error. */
    private fun readChunk(tag: NfcF, idm: ByteArray, block: Int, count: Int): ByteArray? {
        val body = ByteArray(4 + 2 * count)
        body[0] = 0x01
        body[1] = (SERVICE_HISTORY and 0xFF).toByte()
        body[2] = (SERVICE_HISTORY shr 8).toByte()
        body[3] = count.toByte()
        for (i in 0 until count) {
            body[4 + i * 2] = 0x80.toByte()
            body[5 + i * 2] = (block + i).toByte()
        }
        val cmd = ByteArray(2 + idm.size + body.size)
        cmd[0] = cmd.size.toByte()
        cmd[1] = CMD_READ_WITHOUT_ENCRYPTION.toByte()
        idm.copyInto(cmd, 2)
        body.copyInto(cmd, 2 + idm.size)

        var lastError: java.io.IOException? = null
        var resp: ByteArray? = null
        for (attempt in 0 until READ_ATTEMPTS) {
            try {
                resp = tag.transceive(cmd)
                lastError = null
                break
            } catch (e: java.io.IOException) {
                lastError = e
            }
        }
        if (resp == null) {
            if (count == 1) throw lastError ?: java.io.IOException("no response")
            return null
        }
        if (resp.size < 12 || (resp[1].toInt() and 0xFF) != RESP_READ_WITHOUT_ENCRYPTION) {
            val code = if (resp.size > 1) resp[1].toInt() and 0xFF else -1
            throw java.io.IOException("resp code 0x%02x len %d".format(code, resp.size))
        }
        val sf1 = resp[10].toInt() and 0xFF
        val sf2 = resp[11].toInt() and 0xFF
        if (sf1 != 0x00 || sf2 != 0x00) {
            if (count == 1) throw java.io.IOException("sf 0x%02x/0x%02x".format(sf1, sf2))
            return null
        }
        val offset = resp.size - count * BLOCK_SIZE
        if (offset < 10 || offset > 16) {
            throw java.io.IOException("unexpected frame len %d for %d blocks".format(resp.size, count))
        }
        return resp.copyOfRange(offset, offset + count * BLOCK_SIZE)
    }

    /** Pure parser over concatenated 16-byte history blocks (block 0 = newest). */
    fun parseHistory(idmHex: String, systemCodeHex: String, raw: ByteArray): IcReadResult {
        val blocks = raw.size / BLOCK_SIZE
        val parsed = (0 until blocks).map { i -> raw.copyOfRange(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE) }
        val used = parsed.takeWhile { be(it, 4, 2) != 0 }
        if (used.isEmpty()) {
            return IcReadResult(idmHex, systemCodeHex, balanceJPY = null, entries = emptyList())
        }

        val entries = used.mapIndexed { index, block ->
            val console = block[0].toInt() and 0xFF
            val process = block[1].toInt() and 0xFF
            val dateRaw = be(block, 4, 2)
            val year = 2000 + (dateRaw shr 9)
            val month = (dateRaw shr 5) and 0x0F
            val day = dateRaw and 0x1F
            val balance = le(block, 10, 2)
            val previous = used.getOrNull(index + 1)?.let { le(it, 10, 2) }
            val fare = previous?.let { it - balance }
            IcEntry(
                date = "%04d-%02d-%02d".format(year, month, day),
                kind = kindName(console, process),
                stationHex = "%02x-%02x".format(block[6].toInt() and 0xFF, block[7].toInt() and 0xFF),
                deltaJPY = fare,
                balanceJPY = balance,
            )
        }
        return IcReadResult(
            idmHex = idmHex,
            systemCodeHex = systemCodeHex,
            balanceJPY = entries.first().balanceJPY,
            entries = entries,
        )
    }

    private fun kindName(console: Int, process: Int): String = when {
        process == 0x02 -> "チャージ"
        process == 0x48 -> "ボーナスチャージ"
        console == 0xc7 || console == 0xc8 -> "物販"
        console == 0x05 -> "バス"
        console == 0x16 -> "改札"
        process == 0x01 -> "改札(出場)"
        process == 0x04 -> "精算"
        process == 0x07 -> "新規発行"
        else -> "その他 0x%02x/0x%02x".format(console, process)
    }

    private fun be(block: ByteArray, offset: Int, length: Int): Int {
        var value = 0
        for (i in 0 until length) value = (value shl 8) or (block[offset + i].toInt() and 0xFF)
        return value
    }

    private fun le(block: ByteArray, offset: Int, length: Int): Int {
        var value = 0
        for (i in length - 1 downTo 0) value = (value shl 8) or (block[offset + i].toInt() and 0xFF)
        return value
    }

    private fun hex(byte: Byte) = "%02x".format(byte.toInt() and 0xFF)
}
