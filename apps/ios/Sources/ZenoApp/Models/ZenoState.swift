import Foundation
import Combine

/// ZENO Core State — 墨と金 (Sumi to Kin)
/// Reactive state modeling Tokyo Transit (FeliCa), Revolut Ultra, and Kintsugi Ledger.
@MainActor
public final class ZenoState: ObservableObject {
    public static let shared = ZenoState()

    // Accounts
    @Published public var contributorBalanceJPY: Double = 50_000.0
    @Published public var pasmoBalanceJPY: Int = 4_820
    @Published public var suicaBalanceJPY: Int = 6_450
    @Published public var activeICType: ICType = .pasmo

    // Revolut Ultra & Cashback
    @Published public var accumulatedCashbackJPY: Double = 14_280.0
    @Published public var compoundedTotalJPY: Double = 48_650.0

    // Streaming
    @Published public var streamingRateJPYPerSec: Double = 55.0
    @Published public var totalStreamedJPY: Double = 0.0

    // Kintsugi Ledger Blocks
    @Published public var ledgerBlocks: [LedgerBlock] = [
        LedgerBlock(
            index: 1,
            memo: "Genesis Endowment & BOJ Escrow Allocation",
            seal: "8f5a2d1e0c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a90",
            timestamp: Date().addingTimeInterval(-7200)
        ),
        LedgerBlock(
            index: 2,
            memo: "Foken Proof-of-Contribution Mint (100 FOKEN) — 8b-is Guild",
            seal: "d0c1b2a3f4e5d6c7b8a908f5a2d1e0c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9",
            timestamp: Date().addingTimeInterval(-3600)
        )
    ]

    public enum ICType: String, CaseIterable, Identifiable {
        case pasmo = "Mobile PASMO"
        case suica = "Mobile Suica"
        public var id: String { rawValue }
    }

    public struct LedgerBlock: Identifiable {
        public let id = UUID()
        public let index: Int
        public let memo: String
        public let seal: String
        public let timestamp: Date
    }

    private var timer: AnyCancellable?

    public init() {
        startStreamingTimer()
    }

    private func startStreamingTimer() {
        timer = Timer.publish(every: 0.1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self = self else { return }
                let delta = self.streamingRateJPYPerSec * 0.1
                self.contributorBalanceJPY += delta
                self.totalStreamedJPY += delta
            }
    }

    /// Simulate FeliCa Transit Tap
    public func tapTransitGate(fare: Int, label: String) -> Bool {
        let currentBalance = activeICType == .pasmo ? pasmoBalanceJPY : suicaBalanceJPY
        guard currentBalance >= fare else {
            return false
        }

        if activeICType == .pasmo {
            pasmoBalanceJPY -= fare
        } else {
            suicaBalanceJPY -= fare
        }

        // Accrue 3% Tokyo transit cashback
        let earnedCB = Double(fare) * 0.03
        accumulatedCashbackJPY += earnedCB

        // Seal into Kintsugi Ledger
        let newBlock = LedgerBlock(
            index: ledgerBlocks.count + 1,
            memo: "FeliCa [\(activeICType.rawValue)]: \(label) (-¥\(fare)) +¥\(String(format: "%.1f", earnedCB)) CB",
            seal: UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased(),
            timestamp: Date()
        )
        ledgerBlocks.insert(newBlock, at: 0)
        return true
    }

    /// Recharge IC from Revolut Ultra (0% FX)
    public func rechargeIC(amount: Int = 3000) {
        if activeICType == .pasmo {
            pasmoBalanceJPY += amount
        } else {
            suicaBalanceJPY += amount
        }

        let earnedCB = Double(amount) * 0.03
        accumulatedCashbackJPY += earnedCB

        let newBlock = LedgerBlock(
            index: ledgerBlocks.count + 1,
            memo: "Revolut Ultra Top-Up: +¥\(amount) to \(activeICType.rawValue) (0% FX) · Earned ¥\(String(format: "%.0f", earnedCB)) CB",
            seal: UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased(),
            timestamp: Date()
        )
        ledgerBlocks.insert(newBlock, at: 0)
    }

    /// Auto-Compound Cashback into Contributor Vault
    public func compoundCashback() -> Double {
        let toCompound = floor(accumulatedCashbackJPY)
        guard toCompound > 0 else { return 0 }

        contributorBalanceJPY += toCompound
        compoundedTotalJPY += toCompound
        accumulatedCashbackJPY -= toCompound

        let newBlock = LedgerBlock(
            index: ledgerBlocks.count + 1,
            memo: "Cashback Compounded: +¥\(Int(toCompound)) to ZENO Contributor Vault (cnt_0x71c8)",
            seal: UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased(),
            timestamp: Date()
        )
        ledgerBlocks.insert(newBlock, at: 0)
        return toCompound
    }
}
