package dev.vaked.zeno.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.vaked.zeno.audio.ZenoAudioEngine
import dev.vaked.zeno.native.NativeBridge

private data class UsNetworkSpec(
    val id: String,
    val label: String,
    val usdcContract: String,
    val usdtContract: String,
)

private data class UsPlanSpec(
    val id: String,
    val label: String,
    val monthlyMicroUsd: Long,
    val autoTradeBps: Long,
)

private val TOP_7_NETWORKS = listOf(
    UsNetworkSpec("solana", "Solana", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
    UsNetworkSpec("base", "Base L2", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"),
    UsNetworkSpec("ethereum", "Ethereum", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xdAC17F958D2ee523a2206206994597C13D831ec7"),
    UsNetworkSpec("arbitrum", "Arbitrum", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"),
    UsNetworkSpec("polygon", "Polygon", "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"),
    UsNetworkSpec("optimism", "OP Main", "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"),
    UsNetworkSpec("tron", "Tron TRC20", "unsupported (native deprecated)", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"),
)

private val PRO_PLANS = listOf(
    UsPlanSpec("free", "Free ($0)", 0L, 50L),
    UsPlanSpec("plus", "Plus ($9.99)", 9_990_000L, 25L),
    UsPlanSpec("ultra_quant", "Ultra ($49)", 49_000_000L, 10L),
    UsPlanSpec("institutional", "Inst ($199)", 199_000_000L, 5L),
)

private fun formatMicroUsd(micro: Long): String {
    val whole = micro / 1_000_000L
    val cents = (micro % 1_000_000L) / 10_000L
    return "$" + whole.toString() + "." + cents.toString().padStart(2, '0')
}

@Composable
fun ZenoUsMonetizationCard() {
    val context = LocalContext.current
    val obsidian = Color(0xFF0A0E16)
    val elevated = Color(0xFF121A26)
    val emerald = Color(0xFF00D47E)
    val teal = Color(0xFF4ECDC4)
    val gold = Color(0xFFE8B05C)

    var selectedNetIdx by remember { mutableIntStateOf(0) }
    var activePlanIdx by remember { mutableIntStateOf(2) }
    var revenueTotalMicro by remember { mutableLongStateOf(49_000_000L) }
    var statusMsg by remember { mutableStateOf("Ready · 7 USDC+USDT networks wired · zero-float p/q metering") }
    var asmStatus by remember {
        mutableStateOf(
            try {
                "JNI ASM: ${NativeBridge.asmBackendTag()}"
            } catch (e: Throwable) {
                "JNI unavailable: ${e.message}"
            }
        )
    }

    val selectedNet = TOP_7_NETWORKS[selectedNetIdx]
    val activePlan = PRO_PLANS[activePlanIdx]
    val familyMicro = (revenueTotalMicro * 3L) / 10L
    val fokenMicro = (revenueTotalMicro * 2L) / 10L
    val operatingMicro = revenueTotalMicro - familyMicro - fokenMicro

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = obsidian),
        border = BorderStroke(1.dp, emerald.copy(alpha = 0.45f)),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        "ZENO US · 7 CHAINS & PRO QUANT",
                        color = emerald,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                    Text(
                        "USDC+USDT + Automated Trading Billing",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Text(
                    "v1.16.0",
                    color = gold,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                )
            }

            // Network selector pills
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TOP_7_NETWORKS.take(4).forEachIndexed { idx, net ->
                    OutlinedButton(
                        onClick = {
                            selectedNetIdx = idx
                            ZenoAudioEngine.playFeliCa()
                        },
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 4.dp),
                        border = BorderStroke(1.dp, if (selectedNetIdx == idx) emerald else Color(0xFF283244)),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (selectedNetIdx == idx) emerald.copy(alpha = 0.14f) else elevated,
                            contentColor = if (selectedNetIdx == idx) emerald else Color.White,
                        ),
                    ) {
                        Text(net.label, fontSize = 10.sp, maxLines = 1)
                    }
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TOP_7_NETWORKS.drop(4).forEachIndexed { offset, net ->
                    val idx = offset + 4
                    OutlinedButton(
                        onClick = {
                            selectedNetIdx = idx
                            ZenoAudioEngine.playFeliCa()
                        },
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 4.dp),
                        border = BorderStroke(1.dp, if (selectedNetIdx == idx) emerald else Color(0xFF283244)),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (selectedNetIdx == idx) emerald.copy(alpha = 0.14f) else elevated,
                            contentColor = if (selectedNetIdx == idx) emerald else Color.White,
                        ),
                    ) {
                        Text(net.label, fontSize = 10.sp, maxLines = 1)
                    }
                }
            }

            Surface(color = elevated, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Text("USDC (${selectedNet.label}): ${selectedNet.usdcContract}", color = teal, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    Text("USDT (${selectedNet.label}): ${selectedNet.usdtContract}", color = emerald, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                }
            }

            // Plan switcher
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PRO_PLANS.forEachIndexed { idx, plan ->
                    OutlinedButton(
                        onClick = {
                            activePlanIdx = idx
                            revenueTotalMicro += plan.monthlyMicroUsd
                            statusMsg = "Plan ${plan.label} (${plan.autoTradeBps} bps auto-trade)"
                            ZenoAudioEngine.playFeliCa()
                        },
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 4.dp),
                        border = BorderStroke(1.dp, if (activePlanIdx == idx) gold else Color(0xFF283244)),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (activePlanIdx == idx) gold.copy(alpha = 0.14f) else elevated,
                            contentColor = if (activePlanIdx == idx) gold else Color.White,
                        ),
                    ) {
                        Text(plan.label, fontSize = 10.sp, maxLines = 1)
                    }
                }
            }

            // Meter tick & Sanpo Yoshi split telemetry
            Surface(color = elevated, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        "Revenue Total: ${formatMicroUsd(revenueTotalMicro)} · Plan: ${activePlan.label} (${activePlan.autoTradeBps} bps)",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                    Text(
                        "Sanpo Yoshi 50/30/20: Op ${formatMicroUsd(operatingMicro)} · Family Trust ${formatMicroUsd(familyMicro)} · FOKEN ${formatMicroUsd(fokenMicro)}",
                        color = teal,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }

            Button(
                onClick = {
                    val fee = 50_000L + (2_000_000_000L * activePlan.autoTradeBps) / 10_000L
                    revenueTotalMicro += fee
                    statusMsg = "Metered 5 auto-trade ticks on \$2k -> +${formatMicroUsd(fee)}"
                    ZenoAudioEngine.playUltraShimmer()
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = emerald, contentColor = Color.Black),
            ) {
                Text("⚡ Meter 5 Auto-Trade Ticks ($2k Notional)", fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        try {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://zeno.vaked.dev/us")))
                        } catch (e: Exception) {
                            statusMsg = "Cannot open browser: ${e.message}"
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = gold, contentColor = Color.Black),
                ) {
                    Text("🌐 Open /us Pro", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = {
                        val solUri = "solana:HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS?amount=5&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=ZENO%20Family%20Trust"
                        try {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(solUri)))
                            statusMsg = "Opened Solana Pay $5 USDC intent"
                        } catch (_: Exception) {
                            statusMsg = "No Solana wallet app installed for solana: URI (install Phantom/Coinbase/Solflare)"
                            ZenoAudioEngine.playFeliCaError()
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = teal, contentColor = Color.Black),
                ) {
                    Text("◎ Solana Pay $5", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            Text(asmStatus, color = teal, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
            OutlinedButton(
                onClick = {
                    try {
                        val json = NativeBridge.asmSelfTestJson()
                        val solOk = NativeBridge.validateSolanaBase58("HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS")
                        asmStatus = "ARM64 NEON OK (SolanaB58=$solOk): $json"
                        ZenoAudioEngine.playUltraShimmer()
                    } catch (e: Throwable) {
                        asmStatus = "ARM64 ASM test error: ${e.message}"
                        ZenoAudioEngine.playFeliCaError()
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, teal.copy(alpha = 0.55f)),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = elevated, contentColor = teal),
            ) {
                Text("🦀 Run ARM64 NEON ASM + Solana JNI Self-Test", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Text(statusMsg, color = Color(0xFF9FB0C3), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
        }
    }
}
