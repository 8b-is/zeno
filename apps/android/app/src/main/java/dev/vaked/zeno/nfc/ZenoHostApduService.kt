package dev.vaked.zeno.nfc

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

/**
 * Host-based Card Emulation (HCE) for Tokyo Contactless Transit & Payment.
 * Responds to ISO/IEC 7816-4 and FeliCa command APDUs from station gates.
 */
class ZenoHostApduService : HostApduService() {

    companion object {
        // Status Word: 0x9000 (Success)
        private val SW_SUCCESS = byteArrayOf(0x90.toByte(), 0x00.toByte())
        // Status Word: 0x6A82 (File Not Found)
        private val SW_FILE_NOT_FOUND = byteArrayOf(0x6A.toByte(), 0x82.toByte())

        // FeliCa Polling Response Mock
        private val FELICA_RESPONSE = byteArrayOf(
            0x12.toByte(), 0x01.toByte(),
            0x01.toByte(), 0x20.toByte(), 0x30.toByte(), 0x40.toByte(), // IDm
            0x50.toByte(), 0x60.toByte(), 0x70.toByte(), 0x80.toByte(),
            0x00.toByte(), 0x03.toByte(), // PMm
            0x00.toByte(), 0x00.toByte()
        )
    }

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        if (commandApdu == null) return SW_FILE_NOT_FOUND

        // SELECT AID command (0x00, 0xA4, 0x04, 0x00)
        if (commandApdu.size >= 4 &&
            commandApdu[0] == 0x00.toByte() &&
            commandApdu[1] == 0xA4.toByte() &&
            commandApdu[2] == 0x04.toByte()
        ) {
            // Emulate successful FeliCa / Suica transit handshake
            return FELICA_RESPONSE + SW_SUCCESS
        }

        return SW_SUCCESS
    }

    override fun onDeactivated(reason: Int) {
        // Transit gate interaction finished or connection lost
    }
}
