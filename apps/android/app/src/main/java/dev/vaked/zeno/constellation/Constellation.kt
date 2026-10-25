package dev.vaked.zeno.constellation

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * ZENO × 8b-is Constellation registry (RFC-007).
 * Mirrors `constellation.json` served by `https://zeno.vaked.dev/api/constellation`.
 * Trit values follow the Sovereign Ontology {-1, 0, +1}.
 */
data class ConstellationProject(
    val id: String,
    val name: String,
    val kanji: String,
    val url: String,
    val trit: Int,
    val lane: String,
    val role: String,
    val netHours: Double,
)

data class ConstellationPack(
    val id: String,
    val blocks: Int,
    val rawBytes: Int,
    val sealedBytes: Int,
    val savingsPercent: Double,
    val wupzFold: String,
    val sha256Sealed: String,
    val containerUrl: String,
    val companionUrl: String,
)

data class ConstellationDoc(
    val version: String,
    val projects: List<ConstellationProject>,
    val packs: List<ConstellationPack>,
    val totalNetHours: Double,
) {
    val verified: Int get() = projects.count { it.trit == 1 }
    val witnessed: Int get() = projects.count { it.trit == 0 }
    val refused: Int get() = projects.count { it.trit == -1 }
}

object ConstellationRepository {
    private const val ENDPOINT = "https://zeno.vaked.dev/api/constellation"

    suspend fun load(): ConstellationDoc = withContext(Dispatchers.IO) {
        runCatching { fetch() }.getOrElse { fallback }
    }

    private fun fetch(): ConstellationDoc {
        val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 8000
            setRequestProperty("accept", "application/json")
        }
        try {
            if (connection.responseCode !in 200..299) return fallback
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            return parse(JSONObject(body))
        } finally {
            connection.disconnect()
        }
    }

    private fun parse(root: JSONObject): ConstellationDoc {
        val projectsJson = root.getJSONArray("projects")
        val projects = (0 until projectsJson.length()).map { index ->
            val item = projectsJson.getJSONObject(index)
            ConstellationProject(
                id = item.getString("id"),
                name = item.getString("name"),
                kanji = item.optString("kanji", ""),
                url = item.getString("url"),
                trit = item.getInt("trit"),
                lane = item.optString("lane", ""),
                role = item.optString("role", ""),
                netHours = item.optDouble("netHours", 0.0),
            )
        }
        val packsJson = root.getJSONArray("packs")
        val packs = (0 until packsJson.length()).map { index ->
            val item = packsJson.getJSONObject(index)
            ConstellationPack(
                id = item.getString("id"),
                blocks = item.optInt("blocks"),
                rawBytes = item.optInt("rawBytes"),
                sealedBytes = item.optInt("sealedBytes"),
                savingsPercent = item.optDouble("savingsPercent", 0.0),
                wupzFold = item.optString("wupzFold", ""),
                sha256Sealed = item.optString("sha256Sealed", ""),
                containerUrl = item.optString("containerUrl", ""),
                companionUrl = item.optString("companionUrl", ""),
            )
        }
        val totals = root.optJSONObject("totals")
        return ConstellationDoc(
            version = root.optString("version", "1.0.0"),
            projects = projects,
            packs = packs,
            totalNetHours = totals?.optDouble("netHours", 0.0) ?: projects.sumOf { it.netHours },
        )
    }

    /** Offline fallback — keep in sync with `constellation.json`. */
    val fallback = ConstellationDoc(
        version = "1.0.0",
        projects = listOf(
            ConstellationProject(
                "sovereign-library", "Sovereign Library", "主権図書館",
                "https://github.com/8b-is/sovereign-library", 1, "canon",
                "5-book constitutional shelf and the {-1, 0, +1} ontology spine", 162.0,
            ),
            ConstellationProject(
                "kompress-ultra", "KOMRESS-ULTRA · OMNI", "金継ぎ圧縮",
                "https://pocoo.vaked.dev/demos/book/architect-neo-trinity-bible-oppenheimer-tibetan-ontology-omni.html",
                1, "compression",
                "7-block volume, 5 languages + 1bitLang, sealed as a ZKP1 pack", 207.5,
            ),
            ConstellationProject(
                "fandom-mcp", "fandom-mcp", "典拠",
                "https://github.com/8b-is/fandom-mcp", 1, "protocol",
                "MCP surface that serves the canon to agents", 100.0,
            ),
            ConstellationProject(
                "pocoo", "Poo · Micro-journal", "ぷー",
                "https://pocoo.vaked.dev/", 0, "publishing",
                "Where the sealed volumes and companion posts are shelved", 8.0,
            ),
            ConstellationProject(
                "zeno", "ZENO", "銭 · 禅 · 善",
                "https://zeno.vaked.dev/", 1, "bank",
                "This surface — the Kintsugi ledger that values the rest", 120.0,
            ),
        ),
        packs = listOf(
            ConstellationPack(
                "architect-neo-trinity-tibetan-omni", 7, 11108, 5448, 50.95,
                "0x44dcbd34fd19d0b1",
                "8fb9cc110652cf07f75afb2609ea82f834a3a106f53a8de7596b24309549f7f0",
                "https://pocoo.vaked.dev/demos/book/architect-neo-trinity-tibetan-omni.zkp1",
                "https://pocoo.vaked.dev/demos/book/architect-neo-trinity-bible-oppenheimer-tibetan-ontology-omni.html",
            ),
        ),
        totalNetHours = 1205.0,
    )
}
