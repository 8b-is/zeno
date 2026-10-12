package dev.vaked.zeno.nfc

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

/**
 * Host-based Card Emulation (HCE) for the ZENO loyalty pass only.
 *
 * Responds solely to SELECT of ZENO's own proprietary AID (ISO 7816-5 'F0' range).
 * It deliberately does NOT emulate Suica, PASMO, FeliCa transit, EMV payment, or any
 * third-party credential: those require issuer agreements, and impersonating them
 * would be both non-functional (gates use FeliCa NFC-F, not ISO-DEP) and unlawful.
 * Every other command is rejected so this service never answers on behalf of
 * another application.
 */
class ZenoHostApduService : HostApduService() {

    companion object {
        /** Proprietary AID: F0 + ASCII "ZENO8B". Must match res/xml/apduservice.xml. */
        val ZENO_AID = byteArrayOf(
            0xF0.toByte(), 0x5A, 0x45, 0x4E, 0x4F, 0x38, 0x42
        )
        private val SW_SUCCESS = byteArrayOf(0x90.toByte(), 0x00)
        private val SW_FILE_NOT_FOUND = byteArrayOf(0x6A.toByte(), 0x82.toByte())
        private val SW_INS_NOT_SUPPORTED = byteArrayOf(0x6D.toByte(), 0x00)

        /** Pass identifier returned on successful SELECT (ASCII "ZENO-PASS-V1"). */
        private val ZENO_PASS_ID = "ZENO-PASS-V1".toByteArray(Charsets.US_ASCII)
    }

    private var selected = false

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        if (commandApdu == null || commandApdu.size < 4) return SW_INS_NOT_SUPPORTED

        val isSelectByAid = commandApdu[0] == 0x00.toByte() &&
            commandApdu[1] == 0xA4.toByte() &&
            commandApdu[2] == 0x04.toByte()

        if (isSelectByAid) {
            val lc = if (commandApdu.size > 4) commandApdu[4].toInt() and 0xFF else 0
            val aid = if (commandApdu.size >= 5 + lc) commandApdu.copyOfRange(5, 5 + lc) else ByteArray(0)
            selected = aid.contentEquals(ZENO_AID)
            return if (selected) ZENO_PASS_ID + SW_SUCCESS else SW_FILE_NOT_FOUND
        }

        // No other commands are implemented; never return blanket success.
        return SW_INS_NOT_SUPPORTED
    }

    override fun onDeactivated(reason: Int) {
        selected = false
    }
}
