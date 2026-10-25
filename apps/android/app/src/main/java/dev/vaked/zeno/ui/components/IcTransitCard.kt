package dev.vaked.zeno.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.vaked.zeno.transit.TransitCapability
import dev.vaked.zeno.transit.TransitCapability.Companion as Pkg
import dev.vaked.zeno.ui.theme.BgElevated
import dev.vaked.zeno.ui.theme.ColorGold
import dev.vaked.zeno.ui.theme.ColorTeal
import dev.vaked.zeno.ui.theme.TextDim
import dev.vaked.zeno.ui.theme.TextMain

/**
 * IC カード · Samsung Wallet 導線.
 *
 * Suica / PASMO cannot be minted by an app. This card probes the device, states
 * honestly whether Osaifu-Keitai is available, and routes to the issuer (or to
 * Samsung Wallet) when it is. On unsupported hardware it says so and offers the
 * routes that do work in Tokyo today: ZENO QR, AEON Pay, physical IC.
 */
@Composable
fun IcTransitCard(
    onOpenAeonPay: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var capability by remember { mutableStateOf(TransitCapability.probe(context)) }
    var showDetail by remember { mutableStateOf(false) }

    val accent = if (capability.osaifuKeitai) ColorTeal else Color(0xFFFF8A5B)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(BgElevated)
            .border(1.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                "IC カード · SAMSUNG WALLET",
                color = accent,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace
            )
            Text(
                if (capability.osaifuKeitai) "OSAIFU-KEITAI" else "UNSUPPORTED",
                color = accent,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        }

        if (!capability.osaifuKeitai && capability.contactlessEmv) {
            Text(
                "CONTACTLESS EMV READY · 東京メトロ / 都営地下鉄の改札でタッチ可",
                color = ColorTeal,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        }

        Text(
            capability.headline,
            color = TextMain,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            capability.body,
            color = TextDim,
            fontSize = 11.sp,
            lineHeight = 16.sp
        )

        capability.actionsFor(onOpenAeonPay).forEach { action ->
            Button(
                onClick = { action.invoke(context) },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (action.primary) accent else Color(0xFF232838)
                )
            ) {
                Text(
                    action.label,
                    color = if (action.primary) Color.Black else TextMain,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        OutlinedButton(
            onClick = {
                capability = TransitCapability.probe(context)
                showDetail = !showDetail
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                if (showDetail) "端末診断を閉じる" else "端末診断 (probe)",
                color = ColorGold,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace
            )
        }

        if (showDetail) {
            Text(
                capability.detail,
                color = TextDim,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                lineHeight = 15.sp
            )
            Text(
                "診断結果は端末内のみ。外部送信・保存はしません。",
                color = Color(0xFF6D6A80),
                fontSize = 9.sp
            )
        }
    }
}

private data class TransitAction(
    val label: String,
    val primary: Boolean = false,
    val invoke: (Context) -> Unit,
)

private fun TransitCapability.actionsFor(onOpenAeonPay: () -> Unit): List<TransitAction> = buildList {
    if (hasFeliCaHardware && hasMfcClient) {
        if (hasMobilePasmo) add(TransitAction("Mobile PASMO を開いて IC カードを発行", primary = true) { open(it, Pkg.PACKAGE_MOBILE_PASMO) })
        if (hasMobileSuica) add(TransitAction("Mobile Suica を開いて IC カードを発行", primary = !hasMobilePasmo) { open(it, Pkg.PACKAGE_MOBILE_SUICA) })
        if (!hasMobilePasmo && !hasMobileSuica) {
            add(TransitAction("Mobile PASMO を入手 (Play)", primary = true) { play(it, Pkg.PACKAGE_MOBILE_PASMO) })
            add(TransitAction("Mobile Suica を入手 (Play)") { play(it, Pkg.PACKAGE_MOBILE_SUICA) })
        }
        if (hasSamsungWallet) add(TransitAction("Samsung Wallet を開く") { open(it, Pkg.PACKAGE_SAMSUNG_WALLET) })
    } else {
        if (contactlessEmv) {
            add(TransitAction("Samsung Wallet に銀行カードを追加 (改札タッチ)", primary = true) { open(it, Pkg.PACKAGE_SAMSUNG_WALLET) })
        }
        add(TransitAction("ZENO QR で支払う (AEON Pay)", primary = !contactlessEmv) { onOpenAeonPay() })
        add(TransitAction("Mobile PASMO で対応状況を確認") { open(it, Pkg.PACKAGE_MOBILE_PASMO) })
        if (!contactlessEmv) {
            add(TransitAction("Samsung Wallet を開く") { open(it, Pkg.PACKAGE_SAMSUNG_WALLET) })
        }
    }
}

private fun open(context: Context, pkg: String) {
    val launch = context.packageManager.getLaunchIntentForPackage(pkg)
    if (launch != null) {
        context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } else {
        play(context, pkg)
    }
}

private fun play(context: Context, pkg: String) {
    val intent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("https://play.google.com/store/apps/details?id=" + pkg),
    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
}
