package dev.vaked.zeno.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import dev.vaked.zeno.audio.ZenoAudioEngine
import dev.vaked.zeno.ui.theme.BgElevated
import dev.vaked.zeno.ui.theme.ColorGold
import dev.vaked.zeno.ui.theme.ColorTeal
import dev.vaked.zeno.ui.theme.ColorViolet
import dev.vaked.zeno.ui.theme.TextDim
import java.net.URLEncoder
import java.security.SecureRandom

/**
 * AEON Pay · Alipay-style QR "Asia first" rail for Android — RFC-005.
 * Mirrors apps/core/zeno_core/qr_pay.py: zeno://pay URI, receive/pay-code
 * modes, fixed amount, and a 3-D Secure risk gate (>= ¥1.00 challenged).
 */
private const val THREE_DS_THRESHOLD_UJPY = 1_000_000L
private const val AEON_ACCOUNT_ID = "cnt_0x71c8"
private const val AEON_MEMO = "aeon-pay:zeno"

private enum class QrMode(val wire: String, val label: String) {
    RECEIVE("receive", "受け取る · Receive"),
    PAYCODE("paycode", "支払う · Pay-Code")
}

private enum class AuthState { IDLE, CHALLENGED, AUTHORIZED, DENIED }

private fun nowSeconds(): Long = System.currentTimeMillis() / 1000L

private fun randomNonce(): String {
    val bytes = ByteArray(12)
    SecureRandom().nextBytes(bytes)
    val sb = StringBuilder(bytes.size * 2)
    for (b in bytes) sb.append("%02x".format(b.toInt() and 0xFF))
    return sb.toString()
}

private fun buildPayUri(
    accountId: String,
    mode: String,
    amountUJPY: Long,
    memo: String,
    nonce: String,
    ts: Long
): String {
    val encodedMemo = URLEncoder.encode(memo, "UTF-8")
    return "zeno://pay/$accountId?mode=$mode&bank=ZENO&amount=$amountUJPY" +
        "&memo=$encodedMemo&ts=$ts&nonce=$nonce"
}

@Composable
fun AeonPayQrCard(
    modifier: Modifier = Modifier,
    initialAmountJPY: Int? = null,
    initialMode: String? = null,
) {
    var mode by remember {
        mutableStateOf(if (initialMode == "paycode") QrMode.PAYCODE else QrMode.RECEIVE)
    }
    var amountText by remember {
        mutableStateOf((initialAmountJPY?.takeIf { it > 0 } ?: 500).toString())
    }
    var nonce by remember { mutableStateOf(randomNonce()) }
    var stamp by remember { mutableStateOf(nowSeconds()) }
    var authState by remember { mutableStateOf(AuthState.IDLE) }
    var challengeCode by remember { mutableStateOf<String?>(null) }
    var otpInput by remember { mutableStateOf("") }
    var attempts by remember { mutableStateOf(0) }

    // Deep links (zeno://pay/... or https://zeno.vaked.dev/pay/...) and the
    // Quick Settings tile inject mode/amount here without recreating the card.
    LaunchedEffect(initialAmountJPY, initialMode) {
        if (initialAmountJPY != null && initialAmountJPY > 0) {
            amountText = initialAmountJPY.toString()
        }
        mode = if (initialMode == "paycode") QrMode.PAYCODE else QrMode.RECEIVE
        nonce = randomNonce()
        stamp = nowSeconds()
        authState = AuthState.IDLE
        challengeCode = null
        otpInput = ""
        attempts = 0
    }

    val amountJPY = amountText.toLongOrNull() ?: 0L
    val amountUJPY = amountJPY * 1_000_000L
    val uri = remember(mode, amountUJPY, nonce, stamp) {
        buildPayUri(AEON_ACCOUNT_ID, mode.wire, amountUJPY, AEON_MEMO, nonce, stamp)
    }

    fun newChallenge() {
        challengeCode = "%06d".format(SecureRandom().nextInt(1_000_000))
        otpInput = ""
        attempts = 0
        authState = AuthState.CHALLENGED
    }

    fun authorize() {
        if (amountUJPY >= THREE_DS_THRESHOLD_UJPY) {
            newChallenge()
        } else {
            authState = AuthState.AUTHORIZED
            ZenoAudioEngine.playUltraShimmer()
        }
    }

    fun verifyChallenge() {
        if (otpInput == challengeCode) {
            authState = AuthState.AUTHORIZED
            challengeCode = null
            ZenoAudioEngine.playUltraShimmer()
        } else {
            attempts += 1
            otpInput = ""
            if (attempts >= 3) {
                authState = AuthState.DENIED
                challengeCode = null
            }
        }
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = 16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F121C)),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "AEON Pay · 亜細亜",
                        color = ColorGold,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "銭 · 禅 · 善 — sovereign QR rails",
                        color = TextDim,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Box(
                    modifier = Modifier
                        .background(ColorViolet.copy(alpha = 0.18f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = "RFC-005",
                        color = ColorViolet,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Mode toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QrMode.entries.forEach { candidate ->
                    val selected = candidate == mode
                    Button(
                        onClick = {
                            mode = candidate
                            authState = AuthState.IDLE
                            nonce = randomNonce()
                            stamp = nowSeconds()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (selected) ColorGold else Color(0xFF1E2230)
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = candidate.label,
                            color = if (selected) Color.Black else Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }

            // Amount
            OutlinedTextField(
                value = amountText,
                onValueChange = { value ->
                    if (value.length <= 9 && value.all(Char::isDigit)) {
                        amountText = value
                        authState = AuthState.IDLE
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Amount (JPY)", color = TextDim, fontSize = 11.sp) },
                leadingIcon = { Text("¥", color = ColorGold, fontSize = 16.sp) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedBorderColor = ColorGold,
                    unfocusedBorderColor = Color(0xFF2A2F42)
                )
            )

            // QR
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .padding(horizontal = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                ZenoQrCanvas(content = uri, modifier = Modifier.fillMaxSize())
            }

            Text(
                text = uri,
                color = TextDim,
                fontSize = 8.sp,
                fontFamily = FontFamily.Monospace,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            // Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        nonce = randomNonce()
                        stamp = nowSeconds()
                        authState = AuthState.IDLE
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ColorTeal)
                ) {
                    Text("⟳ Refresh", fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
                Button(
                    onClick = { authorize() },
                    modifier = Modifier.weight(1.4f),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = ColorGold)
                ) {
                    Text(
                        text = "🔒 Authorize ¥$amountJPY",
                        color = Color.Black,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Status
            val (statusText, statusColor) = when (authState) {
                AuthState.IDLE -> "Scan with AEON Pay / Alipay · 3DS above ¥1.00" to TextDim
                AuthState.CHALLENGED -> "Awaiting 3-D Secure challenge…" to ColorViolet
                AuthState.AUTHORIZED ->
                    "✓ Settled · debit asset:fiat:boj_escrow → credit $AEON_ACCOUNT_ID" to ColorTeal
                AuthState.DENIED -> "✕ Challenge failed after 3 attempts" to Color(0xFFFF6B6B)
            }
            Text(
                text = statusText,
                color = statusColor,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }

    if (authState == AuthState.CHALLENGED && challengeCode != null) {
        AlertDialog(
            onDismissRequest = {
                authState = AuthState.IDLE
                challengeCode = null
            },
            containerColor = BgElevated,
            title = {
                Text(
                    text = "3-D Secure · 認証",
                    color = ColorGold,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "A ¥$amountJPY payment requires strong customer authentication.",
                        color = TextDim,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "Demo OTP: ${challengeCode.orEmpty()}",
                        color = ColorTeal,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    OutlinedTextField(
                        value = otpInput,
                        onValueChange = { value ->
                            otpInput = value.filter(Char::isDigit).take(6)
                        },
                        label = { Text("6-digit code", color = TextDim, fontSize = 11.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = ColorGold,
                            unfocusedBorderColor = Color(0xFF2A2F42)
                        )
                    )
                    if (attempts > 0) {
                        Text(
                            text = "Attempt $attempts of 3",
                            color = Color(0xFFFF6B6B),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { verifyChallenge() }) {
                    Text("Verify", color = ColorGold, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    authState = AuthState.IDLE
                    challengeCode = null
                }) {
                    Text("Cancel", color = TextDim)
                }
            }
        )
    }
}

@Composable
private fun ZenoQrCanvas(content: String, modifier: Modifier = Modifier) {
    val matrix = remember(content) {
        runCatching {
            QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, 0, 0)
        }.getOrNull()
    }

    Box(
        modifier = modifier
            .background(Color.White, RoundedCornerShape(14.dp))
            .padding(14.dp),
        contentAlignment = Alignment.Center
    ) {
        if (matrix == null) {
            Text("QR unavailable", color = Color.Black, fontSize = 12.sp)
        } else {
            val modules = matrix.width
            Canvas(modifier = Modifier.fillMaxSize()) {
                val cell = size.width / modules
                for (y in 0 until modules) {
                    for (x in 0 until modules) {
                        if (matrix.get(x, y)) {
                            drawRect(
                                color = Color(0xFF07080B),
                                topLeft = Offset(x * cell, y * cell),
                                size = Size(cell, cell)
                            )
                        }
                    }
                }
            }
        }
    }
}
