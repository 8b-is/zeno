package dev.vaked.zeno.wallet

import android.app.PendingIntent
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import dev.vaked.zeno.MainActivity
import dev.vaked.zeno.R

/**
 * Quick Settings tile: one swipe from anywhere → AEON Pay pay-code.
 *
 * Uses the same `zeno://pay` deep link as App Links, so the tile, the QR
 * scanner and the notification shade all converge on one route (RFC-005/006).
 */
class AeonPayTileService : TileService() {

    companion object {
        private const val TILE_URI = "zeno://pay/cnt_0x71c8?mode=paycode&bank=ZENO"
    }

    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            state = Tile.STATE_INACTIVE
            label = "AEON Pay"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                subtitle = "Show pay-code"
            }
            icon = Icon.createWithResource(this@AeonPayTileService, R.drawable.ic_launcher_foreground)
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()
        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(TILE_URI)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val pending = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            startActivityAndCollapse(pending)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
