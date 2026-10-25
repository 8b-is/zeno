package dev.vaked.zeno.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.vaked.zeno.constellation.ConstellationProject
import dev.vaked.zeno.constellation.ConstellationRepository
import dev.vaked.zeno.ui.theme.BgElevated
import dev.vaked.zeno.ui.theme.ColorGold
import dev.vaked.zeno.ui.theme.ColorTeal
import dev.vaked.zeno.ui.theme.ColorViolet
import dev.vaked.zeno.ui.theme.TextDim
import dev.vaked.zeno.ui.theme.TextMain

/**
 * 星座 (Constellation) — the 8b-is projects ZENO values through the Foken
 * gate, plus the KOMRESS-ULTRA ZKP1 receipt (RFC-007).
 */
@Composable
fun ConstellationCard(modifier: Modifier = Modifier) {
    var doc by remember { mutableStateOf(ConstellationRepository.fallback) }
    var syncing by remember { mutableStateOf(true) }
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(Unit) {
        doc = ConstellationRepository.load()
        syncing = false
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = BgElevated)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    "星座 (CONSTELLATION) × 金継ぎ圧縮",
                    color = ColorTeal,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    "net = futureWorkAvoided − (workAdded + 1.5 × maintenanceDebt)",
                    color = TextDim,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Stat("${doc.projects.size}", "projects", ColorTeal)
                    Stat("+%.1f h".format(doc.totalNetHours), "net utility", ColorGold)
                    Stat("${doc.verified}/${doc.witnessed}/${doc.refused}", "+1 / 0 / −1", ColorViolet)
                }
                if (syncing) {
                    Text(
                        "syncing with /api/constellation…",
                        color = TextDim,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        Text(
            "星座台帳 (Constellation Registry)",
            color = ColorGold,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace
        )

        doc.projects.forEach { project ->
            ProjectRow(project) { uriHandler.openUri(project.url) }
        }

        doc.packs.firstOrNull()?.let { pack ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = BgElevated)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        "⟦ ZKP1 · KintsugiPack Receipt ⟧",
                        color = ColorViolet,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    ReceiptLine("Blocks", "${pack.blocks} ontological · 5 languages + 1bitLang")
                    ReceiptLine("Payload", "${pack.rawBytes} B → ${pack.sealedBytes} B (%.2f%% savings)".format(pack.savingsPercent))
                    ReceiptLine("wupz fold", pack.wupzFold)
                    ReceiptLine("SHA-256 seal", pack.sha256Sealed.take(16) + "…")
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        LinkText("⬇ ZKP1 container") { uriHandler.openUri(pack.containerUrl) }
                        LinkText("📖 Companion post") { uriHandler.openUri(pack.companionUrl) }
                    }
                }
            }
        }
    }
}

@Composable
private fun Stat(value: String, label: String, color: Color) {
    Column {
        Text(value, color = color, fontSize = 15.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
        Text(label.uppercase(), color = TextDim, fontSize = 8.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun ProjectRow(project: ConstellationProject, onClick: () -> Unit) {
    val tritColor = when (project.trit) {
        1 -> ColorTeal
        0 -> ColorGold
        else -> Color(0xFFFF4D6A)
    }
    val tritLabel = when (project.trit) {
        1 -> "+1"
        0 -> "0"
        else -> "−1"
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF131724))
            .border(1.dp, tritColor.copy(alpha = 0.28f), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            tritLabel,
            color = tritColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.width(26.dp)
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "${project.kanji} ${project.name}",
                color = TextMain,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                "${project.lane} · +%.1f h".format(project.netHours),
                color = TextDim,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
            Text(
                project.role,
                color = Color(0xFF9E9CB3),
                fontSize = 10.sp,
                maxLines = 2
            )
        }
    }
}

@Composable
private fun ReceiptLine(key: String, value: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            key,
            color = TextDim,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.width(92.dp)
        )
        Text(value, color = TextMain, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun LinkText(label: String, onClick: () -> Unit) {
    Text(
        label,
        color = ColorTeal,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        fontFamily = FontFamily.Monospace,
        modifier = Modifier.clickable(onClick = onClick)
    )
}
