import SwiftUI

/// 星座 (Constellation) — the 8b-is projects ZENO values, plus the
/// KOMRESS-ULTRA ZKP1 receipt (RFC-007).
public struct ConstellationView: View {
    @State private var doc: ConstellationDoc = .fallback
    @State private var loading = true

    private let gold = Color(red: 0.91, green: 0.69, blue: 0.36)
    private let teal = Color(red: 0.38, green: 0.90, blue: 0.79)
    private let violet = Color(red: 0.71, green: 0.55, blue: 1.0)
    private let panel = Color(white: 0.07)

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                summary
                registry
                receipt
                if loading {
                    Text("syncing with /api/constellation…")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.gray)
                }
            }
            .padding()
        }
        .task {
            doc = await ConstellationAPI.load()
            loading = false
        }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("星座 · CONSTELLATION × 金継ぎ圧縮")
                .font(.system(size: 15, weight: .heavy, design: .monospaced))
                .foregroundColor(teal)
            Text("net = futureWorkAvoided − (workAdded + 1.5 × maintenanceDebt)")
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.gray)

            HStack(spacing: 10) {
                stat("\(doc.projects.count)", "projects", teal)
                stat("+\(String(format: "%.1f", doc.totals.netHours)) h", "net utility", gold)
                stat("\(doc.verified)/\(doc.witnessed)/\(doc.refused)", "+1 / 0 / −1", violet)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(panel)
        .cornerRadius(12)
    }

    private var registry: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("星座台帳 (Constellation Registry)")
                .font(.system(.headline, design: .monospaced))
                .foregroundColor(gold)

            ForEach(doc.projects) { project in
                Link(destination: URL(string: project.url) ?? URL(string: "https://zeno.vaked.dev")!) {
                    HStack(alignment: .top, spacing: 10) {
                        Text(tritLabel(project.trit))
                            .font(.system(size: 11, weight: .heavy, design: .monospaced))
                            .foregroundColor(tritColor(project.trit))
                            .frame(width: 26, alignment: .leading)

                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(project.kanji) \(project.name)")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.white)
                            Text("\(project.lane) · \(String(format: "+%.1f", project.netHours)) h")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.gray)
                            Text(project.role)
                                .font(.system(size: 10))
                                .foregroundColor(Color(white: 0.62))
                                .lineLimit(2)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(tritColor(project.trit))
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(white: 0.05))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(tritColor(project.trit).opacity(0.28), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var receipt: some View {
        if let pack = doc.packs.first {
            VStack(alignment: .leading, spacing: 10) {
                Text("⟦ ZKP1 · KintsugiPack Receipt ⟧")
                    .font(.system(.headline, design: .monospaced))
                    .foregroundColor(violet)

                VStack(alignment: .leading, spacing: 4) {
                    receiptLine("Container", "\(pack.id).zkp1")
                    receiptLine("Blocks", "\(pack.blocks) ontological")
                    receiptLine("Payload", "\(pack.rawBytes) B → \(pack.sealedBytes) B (\(String(format: "%.2f", pack.savingsPercent))%)")
                    receiptLine("wupz fold", pack.wupzFold)
                    receiptLine("SHA-256 raw", String(pack.sha256Raw.prefix(16)) + "…")
                    receiptLine("SHA-256 seal", String(pack.sha256Sealed.prefix(16)) + "…")
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.black.opacity(0.55))
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8).stroke(violet.opacity(0.3), lineWidth: 1)
                )

                HStack(spacing: 8) {
                    if let url = URL(string: pack.containerUrl) {
                        Link("⬇ ZKP1 container", destination: url)
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    }
                    if let url = URL(string: pack.companionUrl) {
                        Link("📖 Companion post", destination: url)
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    }
                }
                .foregroundColor(teal)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(panel)
            .cornerRadius(12)
        }
    }

    private func stat(_ value: String, _ label: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.system(size: 15, weight: .heavy, design: .monospaced))
                .foregroundColor(color)
            Text(label.uppercased())
                .font(.system(size: 8, weight: .bold, design: .monospaced))
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func receiptLine(_ key: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Text(key)
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.gray)
                .frame(width: 92, alignment: .leading)
            Text(value)
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(Color(white: 0.85))
        }
    }

    private func tritLabel(_ trit: Int) -> String {
        switch trit {
        case 1: return "+1"
        case 0: return "0"
        default: return "−1"
        }
    }

    private func tritColor(_ trit: Int) -> Color {
        switch trit {
        case 1: return teal
        case 0: return gold
        default: return Color(red: 1.0, green: 0.30, blue: 0.42)
        }
    }
}
