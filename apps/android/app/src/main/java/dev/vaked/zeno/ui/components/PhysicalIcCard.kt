package dev.vaked.zeno.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.vaked.zeno.transit.IcReadResult
import dev.vaked.zeno.ui.theme.BgElevated
import dev.vaked.zeno.ui.theme.ColorGold
import dev.vaked.zeno.ui.theme.ColorTeal
import dev.vaked.zeno.ui.theme.TextDim
import dev.vaked.zeno.ui.theme.TextMain

/**
 * 物理ICカード読取 — read-only balance + last-20-use history from a physical
 * Suica / PASMO (system 0x0003, history service 0x090f). Nothing is written to
 * the card and nothing leaves the device.
 */
@Composable
fun PhysicalIcCard(
    reading: Boolean,
    result: IcReadResult?,
    onToggleRead: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(BgElevated)
            .border(1.dp, ColorGold.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                "物理ICカード · READ ONLY",
                color = ColorGold,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace
            )
            Text(
                "Suica / PASMO 相互利用",
                color = TextDim,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        }

        Button(
            onClick = onToggleRead,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (reading) Color(0xFF232838) else ColorGold
            )
        ) {
            Text(
                if (reading) "カードを背面にかざしてください… (tap to cancel)" else "物理ICカードを読む (残高 + 履歴20件)",
                color = if (reading) TextMain else Color.Black,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        result?.error?.let { error ->
            Text(error, color = Color(0xFFFF8A5B), fontSize = 11.sp)
        }

        result?.let { read ->
            if (read.error == null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("残高 (BALANCE)", color = TextDim, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                        Text(
                            "¥%,d".format(read.balanceJPY ?: 0),
                            color = ColorTeal,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    Column(horizontalAlignment = androidx.compose.ui.Alignment.End) {
                        Text("IDm", color = TextDim, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                        Text(
                            read.idmHex.take(8) + "…",
                            color = TextMain,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            "system " + read.systemCodeHex,
                            color = TextDim,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                read.entries.take(20).forEach { entry ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            "${entry.date} ${entry.kind}",
                            color = TextMain,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            entry.deltaJPY?.let { delta ->
                                if (delta < 0) "+¥%,d".format(-delta) else "−¥%,d".format(delta)
                            } ?: "—",
                            color = if ((entry.deltaJPY ?: 0) < 0) ColorTeal else ColorGold,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            "¥%,d".format(entry.balanceJPY),
                            color = TextDim,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            modifier = Modifier.widthIn(min = 72.dp)
                        )
                    }
                }

                Text(
                    "読取は readWithoutEncryption のみ（書込なし）。表示は端末内だけで、保存・送信はしません。",
                    color = Color(0xFF6D6A80),
                    fontSize = 9.sp
                )
            }
        }
    }
}
