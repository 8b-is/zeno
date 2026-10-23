package dev.vaked.zeno.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.vaked.zeno.ui.theme.TextDim
import dev.vaked.zeno.wallet.GoogleWalletController

/**
 * "Add to Google Wallet" — the Android counterpart of the Apple .pkpass
 * button. Availability is checked through the Google Wallet SDK; the signed
 * pass JWT comes from the ZENO Worker (see GoogleWalletController).
 */
@Composable
fun AddToGoogleWalletButton(
    controller: GoogleWalletController,
    accountId: String,
    holder: String,
    balanceJPY: Int,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(Unit) { controller.refreshAvailability() }

    Column(modifier = modifier.fillMaxWidth()) {
        Button(
            onClick = { controller.addPass(accountId, holder, balanceJPY) },
            enabled = !controller.busy,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A73E8)),
        ) {
            Text(
                text = if (controller.busy) "Preparing pass…" else "G   Add to Google Wallet",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
            )
        }

        controller.status?.let { message ->
            Text(
                text = message,
                color = if (message.contains("not configured") || message.contains("failed") || message.contains("error")) {
                    Color(0xFFFF8A80)
                } else {
                    TextDim
                },
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        if (!controller.available) {
            Text(
                text = "Google Wallet API unavailable on this device/region — the .pkpass and QR rails still work.",
                color = TextDim,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        Spacer(Modifier.height(4.dp))
    }
}
