package dev.vaked.zeno

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.vaked.zeno.audio.ZenoAudioEngine
import dev.vaked.zeno.ui.components.AddToGoogleWalletButton
import dev.vaked.zeno.ui.components.AeonPayQrCard
import dev.vaked.zeno.ui.components.ConstellationCard
import dev.vaked.zeno.ui.components.FeliCaCard
import dev.vaked.zeno.ui.components.RevolutUltraCard
import dev.vaked.zeno.ui.components.StripeAgenticCommerceCard
import dev.vaked.zeno.ui.theme.BgSumi
import dev.vaked.zeno.ui.theme.ColorGold
import dev.vaked.zeno.ui.theme.ColorTeal
import dev.vaked.zeno.ui.theme.ColorViolet
import dev.vaked.zeno.ui.theme.ZenoTheme
import dev.vaked.zeno.wallet.GoogleWalletController

class MainActivity : ComponentActivity() {

    private data class DeepLink(val tab: Int, val amountJPY: Int?, val mode: String?)

    private lateinit var walletController: GoogleWalletController

    /** Set from zeno://pay/... or https://zeno.vaked.dev/pay/... (also the QS tile). */
    private var pendingDeepLink by mutableStateOf<DeepLink?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        walletController = GoogleWalletController(this)
        walletController.refreshAvailability()
        handleDeepLink(intent)

        val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator

        setContent {
            ZenoTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = BgSumi
                ) {
                    var selectedTab by remember { mutableIntStateOf(0) }
                    var deepAmountJPY by remember { mutableStateOf<Int?>(null) }
                    var deepMode by remember { mutableStateOf<String?>(null) }

                    LaunchedEffect(pendingDeepLink) {
                        val link = pendingDeepLink ?: return@LaunchedEffect
                        selectedTab = link.tab
                        deepAmountJPY = link.amountJPY
                        deepMode = link.mode
                        pendingDeepLink = null
                    }
                    var isPasmo by remember { mutableStateOf(true) }
                    var pasmoBalance by remember { mutableIntStateOf(4820) }
                    var suicaBalance by remember { mutableIntStateOf(6450) }
                    var accumulatedCashback by remember { mutableDoubleStateOf(14280.0) }

                    Scaffold(
                        bottomBar = {
                            NavigationBar(
                                containerColor = Color(0xFF0D0F17)
                            ) {
                                NavigationBarItem(
                                    selected = selectedTab == 0,
                                    onClick = { selectedTab = 0 },
                                    label = { Text("Transit") },
                                    icon = { Text("🚇") }
                                )
                                NavigationBarItem(
                                    selected = selectedTab == 1,
                                    onClick = { selectedTab = 1 },
                                    label = { Text("AEON Pay") },
                                    icon = { Text("💠") },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = ColorViolet,
                                        selectedTextColor = ColorViolet,
                                        indicatorColor = ColorViolet.copy(alpha = 0.15f)
                                    )
                                )
                                NavigationBarItem(
                                    selected = selectedTab == 2,
                                    onClick = { selectedTab = 2 },
                                    label = { Text("Ultra FX") },
                                    icon = { Text("💳") }
                                )
                                NavigationBarItem(
                                    selected = selectedTab == 3,
                                    onClick = { selectedTab = 3 },
                                    label = { Text("Ledger") },
                                    icon = { Text("📜") }
                                )
                                NavigationBarItem(
                                    selected = selectedTab == 4,
                                    onClick = { selectedTab = 4 },
                                    label = { Text("Stripe/ACP") },
                                    icon = { Text("⚡") }
                                )
                                NavigationBarItem(
                                    selected = selectedTab == 5,
                                    onClick = { selectedTab = 5 },
                                    label = { Text("星座") },
                                    icon = { Text("🌌") },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = ColorTeal,
                                        selectedTextColor = ColorTeal,
                                        indicatorColor = ColorTeal.copy(alpha = 0.15f)
                                    )
                                )
                            }
                        }
                    ) { innerPadding ->
                        val scrollState = rememberScrollState()
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(innerPadding)
                                .verticalScroll(scrollState)
                                .padding(16.dp)
                        ) {
                            when (selectedTab) {
                                0 -> {
                                    // Tokyo Transit Tab
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Button(
                                            onClick = { isPasmo = true },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = if (isPasmo) ColorGold else Color(0xFF1E2230)
                                            )
                                        ) {
                                            Text("Mobile PASMO", color = if (isPasmo) Color.Black else Color.White)
                                        }
                                        Button(
                                            onClick = { isPasmo = false },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = if (!isPasmo) ColorGold else Color(0xFF1E2230)
                                            )
                                        ) {
                                            Text("Mobile Suica", color = if (!isPasmo) Color.Black else Color.White)
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(16.dp))

                                    FeliCaCard(
                                        isPasmo = isPasmo,
                                        balanceJPY = if (isPasmo) pasmoBalance else suicaBalance,
                                        cardNumber = if (isPasmo) "PA-0382-7719-2041" else "JE-8821-4402-9103",
                                        onTapGate = {
                                            val fare = 180
                                            val current = if (isPasmo) pasmoBalance else suicaBalance
                                            if (current >= fare) {
                                                if (isPasmo) pasmoBalance -= fare else suicaBalance -= fare
                                                accumulatedCashback += fare * 0.03
                                                ZenoAudioEngine.playFeliCa()
                                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                                    vibrator.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE))
                                                }
                                            } else {
                                                ZenoAudioEngine.playFeliCaError()
                                            }
                                        }
                                    )

                                    Spacer(modifier = Modifier.height(16.dp))

                                    Button(
                                        onClick = {
                                            if (isPasmo) pasmoBalance += 3000 else suicaBalance += 3000
                                            accumulatedCashback += 3000 * 0.03
                                            ZenoAudioEngine.playFeliCa()
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = ColorTeal)
                                    ) {
                                        Text("Recharge +¥3,000 from Revolut Ultra (0% FX)", color = Color.Black)
                                    }

                                    Spacer(modifier = Modifier.height(16.dp))

                                    AddToGoogleWalletButton(
                                        controller = walletController,
                                        accountId = "cnt_0x71c8",
                                        holder = "8b-is Crew",
                                        balanceJPY = if (isPasmo) pasmoBalance else suicaBalance,
                                    )
                                }
                                1 -> {
                                    // AEON Pay · Alipay-style QR (Asia first) — RFC-005
                                    AeonPayQrCard(
                                        initialAmountJPY = deepAmountJPY,
                                        initialMode = deepMode,
                                    )
                                }
                                2 -> {
                                    // Revolut Ultra Tab
                                    RevolutUltraCard()
                                    Spacer(modifier = Modifier.height(20.dp))
                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = CardDefaults.cardColors(containerColor = Color(0xFF131724))
                                    ) {
                                        Column(modifier = Modifier.padding(16.dp)) {
                                            Text(
                                                "CASHBACK ACCUMULATION",
                                                color = ColorGold,
                                                fontWeight = FontWeight.Bold,
                                                fontFamily = FontFamily.Monospace,
                                                fontSize = 11.sp
                                            )
                                            Text(
                                                "¥${accumulatedCashback.toInt()}",
                                                fontSize = 28.sp,
                                                fontWeight = FontWeight.Black,
                                                color = Color.White,
                                                fontFamily = FontFamily.Monospace
                                            )
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Button(
                                                onClick = {
                                                    accumulatedCashback = 0.0
                                                    ZenoAudioEngine.playUltraShimmer()
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = ColorGold)
                                            ) {
                                                Text("✧ Auto-Compound into ZENO Vault", color = Color.Black)
                                            }
                                        }
                                    }
                                }
                                3 -> {
                                    // Ledger Tab
                                    Text(
                                        "金継ぎ台帳 (Kintsugi Ledger)",
                                        color = ColorGold,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Text(
                                        "Powered by 8b-is Family Research · Immutable SHA-256 blocks",
                                        color = Color.Gray,
                                        fontSize = 12.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                                4 -> {
                                    // Stripe & ACP Agentic Commerce Tab
                                    StripeAgenticCommerceCard()
                                }
                                5 -> {
                                    // Constellation & KOMRESS-ULTRA ZKP1 — RFC-007
                                    ConstellationCard()
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    @Deprecated("Google Wallet SDK returns via the legacy activity-result path")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == GoogleWalletController.REQUEST_CODE_SAVE_PASS) {
            walletController.onSaveResult(resultCode, data)
        }
    }

    /**
     * Routes both App Link (https://zeno.vaked.dev/pay/...) and custom scheme
     * (zeno://pay/...) URIs to the AEON Pay tab, carrying amount + mode.
     */
    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        val isZenoScheme = data.scheme == "zeno" && data.host == "pay"
        val isAppLink = data.scheme == "https" &&
            data.host == "zeno.vaked.dev" &&
            (data.path?.startsWith("/pay") == true)
        if (!isZenoScheme && !isAppLink) return

        val mode = data.getQueryParameter("mode")
        val amountUJPY = data.getQueryParameter("amount")?.toLongOrNull()
        val amountJPY = when {
            amountUJPY == null || amountUJPY <= 0L -> null
            amountUJPY < 1_000_000L -> 1 // sub-yen amount still means "fixed amount"
            else -> (amountUJPY / 1_000_000L).toInt()
        }
        pendingDeepLink = DeepLink(tab = 1, amountJPY = amountJPY, mode = mode)
    }
}
