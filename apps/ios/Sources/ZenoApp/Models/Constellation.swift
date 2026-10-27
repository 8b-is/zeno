import Foundation

/// ZENO × 8b-is Constellation registry (RFC-007).
/// Mirrors `constellation.json` served by `/api/constellation`.
public struct ConstellationDoc: Codable, Sendable {
    public let version: String
    public let projects: [ConstellationProject]
    public let packs: [ConstellationPack]
    public let totals: Totals

    public struct Totals: Codable, Sendable {
        public let projects: Int
        public let netHours: Double
        public let sealedBytes: Int
    }

    public var verified: Int { projects.filter { $0.trit == 1 }.count }
    public var witnessed: Int { projects.filter { $0.trit == 0 }.count }
    public var refused: Int { projects.filter { $0.trit == -1 }.count }

    /// Offline fallback so the tab is never empty when the edge API is
    /// unreachable. Keep the first entries in sync with `constellation.json`.
    public static let fallback = ConstellationDoc(
        version: "1.0.0",
        projects: [
            ConstellationProject(
                id: "sovereign-library", name: "Sovereign Library", kanji: "主権図書館",
                url: "https://github.com/8b-is/sovereign-library", trit: 1, lane: "canon",
                role: "5-book constitutional shelf and the {-1, 0, +1} ontology spine",
                netHours: 162
            ),
            ConstellationProject(
                id: "kompress-ultra", name: "KOMRESS-ULTRA · OMNI", kanji: "金継ぎ圧縮",
                url: "https://pocoo.vaked.dev/demos/book/architect-neo-trinity-bible-oppenheimer-tibetan-ontology-omni.html",
                trit: 1, lane: "compression",
                role: "7-block volume, 5 languages + 1bitLang, sealed as a ZKP1 pack",
                netHours: 207.5
            ),
            ConstellationProject(
                id: "fandom-mcp", name: "fandom-mcp", kanji: "典拠",
                url: "https://github.com/8b-is/fandom-mcp", trit: 1, lane: "protocol",
                role: "MCP surface that serves the canon to agents",
                netHours: 100
            ),
            ConstellationProject(
                id: "pocoo", name: "Poo · Micro-journal", kanji: "ぷー",
                url: "https://pocoo.vaked.dev/", trit: 0, lane: "publishing",
                role: "Where the sealed volumes and companion posts are shelved",
                netHours: 8
            ),
            ConstellationProject(
                id: "zeno", name: "ZENO", kanji: "銭 · 禅 · 善",
                url: "https://zeno.vaked.dev/", trit: 1, lane: "bank",
                role: "This surface — the Kintsugi ledger that values the rest",
                netHours: 120
            ),
            ConstellationProject(
                id: "aurora", name: "AURORA · Conscious AI", kanji: "暁光",
                url: "https://aurora.vaked.dev/", trit: 1, lane: "consciousness",
                role: "MEM|8 32B wave grid, Chenrezig dyad, p/q rationals & via agy cortex",
                netHours: 246
            ),
            ConstellationProject(
                id: "alexiai", name: "ALEXIAI · gaia-mlx-quant", kanji: "慈愛",
                url: "https://github.com/8b-is/alexiai", trit: 1, lane: "quant",
                role: "no_std Rust/C99/Go/Swift BitNet b1.58 & 64-trit quantum bitplane engine",
                netHours: 234
            ),
            ConstellationProject(
                id: "wupz", name: "wupz · Linker + Packer", kanji: "圧縮連結",
                url: "https://wupz.vaked.dev/", trit: 1, lane: "toolchain",
                role: "Incremental zero-alloc SIMD linker-compressor (Zig + Rust) & 32B seals",
                netHours: 189
            ),
            ConstellationProject(
                id: "zen-ultra-cooker", name: "zenUltraCooker · Omni", kanji: "禅釜",
                url: "https://github.com/8b-is/zenUltraCooker", trit: 1, lane: "appliance",
                role: "Cross-platform Android/iOS sovereign appliance & Stripe/GPay/Apple Pay",
                netHours: 138
            ),
            ConstellationProject(
                id: "go-setup", name: "b8-go / 1b-go Toolchain", kanji: "一ビット",
                url: "https://github.com/8b-is/go-setup", trit: 1, lane: "toolchain",
                role: "Apple Silicon M1 / 8b M1 64GB unified-memory Go toolchain & 1b-go alias",
                netHours: 90
            ),
            ConstellationProject(
                id: "peter-applications", name: "apply.vaked.dev · SOTA Hub", kanji: "応募",
                url: "https://apply.vaked.dev/", trit: 1, lane: "career",
                role: "7 live *.vaked.dev Worker portfolios (teamLab, Sakana, PFN, TIER IV, Woven, Taiko)",
                netHours: 126
            ),
            ConstellationProject(
                id: "zoneinn-bonfire", name: "ZoneInn Bonfire · Spatial", kanji: "篝火",
                url: "https://github.com/8b-is/zoneinn-bonfire", trit: 1, lane: "spatial",
                role: "Android/Web spatial hearth & peer discovery over the vaked constellation",
                netHours: 102
            ),
        ],
        packs: [
            ConstellationPack(
                id: "architect-neo-trinity-tibetan-omni",
                title: "KOMRESS-ULTRA · OMNI (Tibetan Buddhism)",
                containerUrl: "https://pocoo.vaked.dev/demos/book/architect-neo-trinity-tibetan-omni.zkp1",
                companionUrl: "https://pocoo.vaked.dev/demos/book/architect-neo-trinity-bible-oppenheimer-tibetan-ontology-omni.html",
                blocks: 7, rawBytes: 11108, sealedBytes: 5448, savingsPercent: 50.95,
                wupzFold: "0x44dcbd34fd19d0b1",
                sha256Raw: "c513660ef75bf3215b25e4c2a166d000100e7d876d278a222888f00f136c7591",
                sha256Sealed: "8fb9cc110652cf07f75afb2609ea82f834a3a106f53a8de7596b24309549f7f0"
            )
        ],
        totals: Totals(projects: 18, netHours: 2330, sealedBytes: 5448)
    )
}

public struct ConstellationProject: Codable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let kanji: String
    public let url: String
    public let trit: Int
    public let lane: String
    public let role: String
    public let netHours: Double
}

public struct ConstellationPack: Codable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let containerUrl: String
    public let companionUrl: String
    public let blocks: Int
    public let rawBytes: Int
    public let sealedBytes: Int
    public let savingsPercent: Double
    public let wupzFold: String
    public let sha256Raw: String
    public let sha256Sealed: String
}

public enum ConstellationAPI {
    public static let endpoint = URL(string: "https://zeno.vaked.dev/api/constellation")!

    public static func load() async -> ConstellationDoc {
        var request = URLRequest(url: endpoint)
        request.timeoutInterval = 8
        request.cachePolicy = .reloadRevalidatingCacheData
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return .fallback
            }
            return try JSONDecoder().decode(ConstellationDoc.self, from: data)
        } catch {
            return .fallback
        }
    }
}
