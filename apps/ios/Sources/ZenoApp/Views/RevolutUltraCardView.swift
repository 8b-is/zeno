import SwiftUI

/// Revolut Ultra Brushed Platinum Card View for iOS
/// Renders authentic metal finish with 3D tilt and multi-currency converter.
public struct RevolutUltraCardView: View {
    @ObservedObject var state = ZenoState.shared
    @State private var dragOffset = CGSize.zero
    @State private var sourceAmount = "100000"
    @State private var sourceCurrency = "HUF"
    @State private var targetCurrency = "JPY"

    private let fxRates: [String: Double] = [
        "HUF": 0.4285,
        "EUR": 163.50,
        "USD": 152.80,
        "JPY": 1.00
    ]

    public init() {}

    private var convertedTargetValue: String {
        let val = Double(sourceAmount) ?? 0.0
        let srcRate = fxRates[sourceCurrency] ?? 1.0
        let tgtRate = fxRates[targetCurrency] ?? 1.0
        let jpy = val * srcRate
        let target = jpy / tgtRate
        if targetCurrency == "JPY" || targetCurrency == "HUF" {
            return "¥\(Int(target)) \(targetCurrency)"
        }
        return String(format: "%.2f %@", target, targetCurrency)
    }

    public var body: some View {
        VStack(spacing: 20) {
            // Platinum Metal Card
            ZStack {
                // Brushed Metal Gradient
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.94, green: 0.95, blue: 0.96),
                                Color(red: 0.80, green: 0.82, blue: 0.86),
                                Color(red: 0.60, green: 0.64, blue: 0.70),
                                Color(red: 0.85, green: 0.87, blue: 0.90),
                                Color(red: 0.97, green: 0.98, blue: 0.98)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 210)
                    .shadow(color: .black.opacity(0.6), radius: 18, y: 10)

                // Specular Light Shimmer
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        LinearGradient(
                            colors: [Color.clear, Color.white.opacity(0.4), Color.clear],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 210)

                // Card Details
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        HStack(spacing: 6) {
                            Text("R")
                                .font(.system(size: 16, weight: .black))
                                .foregroundColor(.white)
                                .frame(width: 24, height: 24)
                                .background(Color(red: 0.07, green: 0.08, blue: 0.11))
                                .cornerRadius(4)
                            Text("Revolut")
                                .font(.system(.title3, design: .default))
                                .fontWeight(.bold)
                                .foregroundColor(.black)
                            Text("ULTRA")
                                .font(.system(size: 10, weight: .heavy))
                                .tracking(2)
                                .foregroundColor(Color(white: 0.3))
                        }
                        Spacer()
                        // EMV Gold Chip
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(
                                    LinearGradient(colors: [Color(red: 0.90, green: 0.78, blue: 0.35), Color(red: 0.70, green: 0.55, blue: 0.15)], startPoint: .topLeading, endPoint: .bottomTrailing)
                                )
                                .frame(width: 32, height: 24)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 3).stroke(Color.black.opacity(0.3), lineWidth: 0.5)
                                )
                            Image(systemName: "wave.3.right")
                                .foregroundColor(.black.opacity(0.7))
                        }
                    }

                    Spacer()

                    VStack(alignment: .leading, spacing: 4) {
                        Text("•••• •••• •••• 8421")
                            .font(.system(.title3, design: .monospaced))
                            .fontWeight(.bold)
                            .tracking(3)
                            .foregroundColor(.black)
                        Text("EXP 09/31 · PLATINUM 5412")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(Color(white: 0.3))
                    }

                    Spacer()

                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("8B-IS CREW · HUE · AYE · TAISHA · OMNI")
                                .font(.system(size: 11, weight: .heavy, design: .monospaced))
                                .foregroundColor(.black)
                            Text("8B-IS TEAM & FAMILY COLLABORATION <3")
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundColor(Color(white: 0.35))
                        }
                        Spacer()
                        Text("PLATINUM 22.5g")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.black)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Color.white.opacity(0.5))
                            .cornerRadius(4)
                    }
                }
                .padding(22)
                .frame(height: 210)
            }
            .rotation3DEffect(
                .degrees(Double(dragOffset.width / 15)),
                axis: (x: 0, y: 1, z: 0)
            )
            .rotation3DEffect(
                .degrees(-Double(dragOffset.height / 15)),
                axis: (x: 1, y: 0, z: 0)
            )
            .gesture(
                DragGesture()
                    .onChanged { gesture in
                        dragOffset = gesture.translation
                    }
                    .onEnded { _ in
                        withAnimation(.spring()) {
                            dragOffset = .zero
                        }
                    }
            )

            // FX Converter Box
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("MULTI-CURRENCY ENGINE (0% FX)")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(Color(red: 0.91, green: 0.69, blue: 0.36))
                    Spacer()
                    Text("Interbank Zero Markup")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.teal)
                }

                HStack(spacing: 12) {
                    TextField("Amount", text: $sourceAmount)
#if os(iOS)
                        .keyboardType(.numberPad)
#endif
                        .font(.system(.body, design: .monospaced))
                        .padding(10)
                        .background(Color(white: 0.12))
                        .cornerRadius(6)

                    Picker("Currency", selection: $sourceCurrency) {
                        Text("🇭🇺 HUF").tag("HUF")
                        Text("🇪🇺 EUR").tag("EUR")
                        Text("🇺🇸 USD").tag("USD")
                        Text("🇯🇵 JPY").tag("JPY")
                    }
                    .pickerStyle(.menu)
                    .padding(8)
                    .background(Color(white: 0.12))
                    .cornerRadius(6)
                }

                HStack {
                    Text("Converted:")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.gray)
                    Spacer()
                    Text(convertedTargetValue)
                        .font(.system(.headline, design: .monospaced))
                        .fontWeight(.bold)
                        .foregroundColor(Color(red: 0.91, green: 0.69, blue: 0.36))
                }
            }
            .padding(14)
            .background(Color(white: 0.08))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.1), lineWidth: 1)
            )

            // Auto-Compound Cashback Button
            Button(action: {
                let compounded = state.compoundCashback()
                if compounded > 0 {
                    AudioService.shared.playUltraShimmer()
                }
            }) {
                HStack {
                    Text("✧ Auto-Compound Cashback (¥\(Int(state.accumulatedCashbackJPY))) into Vault")
                        .fontWeight(.bold)
                }
                .font(.system(.subheadline, design: .monospaced))
                .foregroundColor(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(red: 0.91, green: 0.69, blue: 0.36))
                .cornerRadius(8)
            }
        }
        .padding()
    }
}
