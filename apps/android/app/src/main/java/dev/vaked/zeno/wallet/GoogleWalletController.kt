package dev.vaked.zeno.wallet

import android.app.Activity
import android.content.Intent
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.pay.Pay
import com.google.android.gms.pay.PayApiAvailabilityStatus
import com.google.android.gms.pay.PayClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * "Add to Google Wallet" bridge — RFC-006.
 *
 * The pass is built and signed server-side by
 * `GET https://zeno.vaked.dev/api/wallet/google-pass` (Cloudflare Worker,
 * WebCrypto RS256), then handed to Google Wallet's Android SDK via
 * [PayClient.savePassesJwt]. Mirrors apps/wallet/google_wallet.py.
 *
 * The SDK signs with the app's SHA-1 only for the unsigned `savePasses` path.
 * We use the pre-signed JWT path so web and Android share one issuer pipeline.
 *
 * If the issuer is not configured, the endpoint returns `mode: "unconfigured"`
 * with the exact claims preview; we surface that instead of pretending a pass
 * was issued.
 */
class GoogleWalletController(private val activity: ComponentActivity) {

    companion object {
        const val REQUEST_CODE_SAVE_PASS = 1000
        private const val TAG = "ZenoGoogleWallet"
        private const val BASE_URL = "https://zeno.vaked.dev/api/wallet/google-pass"
    }

    private val client: PayClient = Pay.getClient(activity)

    var available by mutableStateOf(false)
        private set
    var busy by mutableStateOf(false)
        private set
    var status by mutableStateOf<String?>(null)
        private set

    fun refreshAvailability() {
        client.getPayApiAvailabilityStatus(PayClient.RequestType.SAVE_PASSES)
            .addOnSuccessListener { state ->
                available = state == PayApiAvailabilityStatus.AVAILABLE
                if (!available && status == null) {
                    status = "Google Wallet API unavailable on this device/region."
                }
            }
            .addOnFailureListener { e ->
                available = false
                status = "Google Play services too old for Google Wallet: ${e.message}"
            }
    }

    fun addPass(accountId: String, holder: String, balanceJPY: Int) {
        if (busy) return
        busy = true
        status = "Preparing Google Wallet pass…"

        activity.lifecycleScope.launch {
            try {
                val payload = fetchPass(accountId, holder, balanceJPY)
                when (payload.optString("mode")) {
                    "live" -> {
                        val jwt = payload.optString("jwt")
                        if (jwt.isBlank()) {
                            status = "Server returned live mode without a JWT."
                        } else {
                            status = "Opening Google Wallet…"
                            client.savePassesJwt(jwt, activity, REQUEST_CODE_SAVE_PASS)
                        }
                    }
                    "unconfigured" -> {
                        val missing = payload.optJSONArray("missing")
                            ?.let { arr -> (0 until arr.length()).joinToString(", ") { arr.optString(it) } }
                            ?: "issuer credentials"
                        status = "Google Wallet issuer not configured ($missing)."
                    }
                    else -> status = "Unexpected response from wallet endpoint."
                }
            } catch (e: Exception) {
                Log.w(TAG, "pass request failed", e)
                status = "Google Wallet request failed: ${e.message}"
            } finally {
                busy = false
            }
        }
    }

    /** Called from Activity.onActivityResult for [REQUEST_CODE_SAVE_PASS]. */
    fun onSaveResult(resultCode: Int, data: Intent?) {
        status = when (resultCode) {
            Activity.RESULT_OK -> "Pass saved to Google Wallet ✓"
            Activity.RESULT_CANCELED -> "Save cancelled."
            PayClient.SavePassesResult.SAVE_ERROR -> {
                val msg = data?.getStringExtra(PayClient.EXTRA_API_ERROR_MESSAGE)
                "Google Wallet error: ${msg ?: "unknown"}"
            }
            else -> "Unexpected Google Wallet result ($resultCode)."
        }
    }

    private suspend fun fetchPass(accountId: String, holder: String, balanceJPY: Int): JSONObject =
        withContext(Dispatchers.IO) {
            val query = buildString {
                append("?account=").append(URLEncoder.encode(accountId, "UTF-8"))
                append("&holder=").append(URLEncoder.encode(holder, "UTF-8"))
                append("&balance_ujpy=").append(balanceJPY.toLong() * 1_000_000L)
            }
            val conn = (URL(BASE_URL + query).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 15_000
                setRequestProperty("accept", "application/json")
            }
            try {
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
                if (body.isBlank()) error("empty response (HTTP $code)")
                JSONObject(body)
            } finally {
                conn.disconnect()
            }
        }
}
