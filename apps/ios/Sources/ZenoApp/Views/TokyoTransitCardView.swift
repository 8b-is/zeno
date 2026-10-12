import SwiftUI
#if canImport(PassKit)
import PassKit
#endif

/// Mobile PASMO & Suica Card View for iOS
/// Supports Apple Wallet integration, FeliCa gate tap simulation, and tactile haptics.
public struct TokyoTransitCardView: View {
    @ObservedObject var state = ZenoState.shared
    @State private var rippleActive = false
    @State private var gateStatusText = "タッチしてください (TOUCH CARD)"
    @State private var gateStatusColor = Color(red: 0.38, green: 0.90, blue: 0.79) // Teal

    public init() {}

    public var body: some View {
        VStack(spacing: 20) {
            // Card Selector
            HStack(spacing: 12) {
                Button(action: {
                    state.activeICType = .pasmo
                }) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color(red: 0.92, green: 0.33, blue: 0.51))
                            .frame(width: 8, height: 8)
                        Text("Mobile PASMO")
                            .font(.system(.subheadline, design: .monospaced))
                            .fontWeight(state.activeICType == .pasmo ? .bold : .regular)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(state.activeICType == .pasmo ? Color(white: 0.15) : Color(white: 0.08))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(state.activeICType == .pasmo ? Color(red: 0.91, green: 0.69, blue: 0.36) : Color.clear, lineWidth: 1)
                    )
                }

                Button(action: {
                    state.activeICType = .suica
                }) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color(red: 0.0, green: 0.60, blue: 0.27))
                            .frame(width: 8, height: 8)
                        Text("Mobile Suica")
                            .font(.system(.subheadline, design: .monospaced))
                            .fontWeight(state.activeICType == .suica ? .bold : .regular)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(state.activeICType == .suica ? Color(white: 0.15) : Color(white: 0.08))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(state.activeICType == .suica ? Color(red: 0.91, green: 0.69, blue: 0.36) : Color.clear, lineWidth: 1)
                    )
                }
            }

            // Visual Card
            ZStack {
                // Card Background Gradient
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        state.activeICType == .pasmo ?
                        LinearGradient(colors: [Color(red: 0.76, green: 0.16, blue: 0.34), Color(red: 0.92, green: 0.33, blue: 0.51)], startPoint: .topLeading, endPoint: .bottomTrailing) :
                        LinearGradient(colors: [Color(red: 0.0, green: 0.41, blue: 0.17), Color(red: 0.0, green: 0.60, blue: 0.27)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .frame(height: 200)
                    .shadow(color: .black.opacity(0.5), radius: 16, y: 8)

                // Card Glass Overlay
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        RadialGradient(colors: [Color.white.opacity(0.2), Color.clear], center: .topTrailing, startRadius: 10, endRadius: 200)
                    )
                    .frame(height: 200)

                // Card Content
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        HStack(spacing: 8) {
                            Text(state.activeICType == .pasmo ? "PASMO" : "Suica")
                                .font(.system(.title2, design: .monospaced))
                                .fontWeight(.heavy)
                            Text("FeliCa NFC-F")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(Color.black.opacity(0.3))
                                .cornerRadius(4)
                        }
                        Spacer()
                        Image(systemName: "wave.3.right")
                            .font(.title3)
                            .opacity(0.85)
                    }

                    Spacer()

                    VStack(alignment: .leading, spacing: 2) {
                        Text("RESIDUAL BALANCE (残高)")
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .opacity(0.85)
                        Text("¥\(state.activeICType == .pasmo ? state.pasmoBalanceJPY : state.suicaBalanceJPY)")
                            .font(.system(size: 34, weight: .heavy, design: .monospaced))
                    }

                    Spacer()

                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("PÉTER LÓDRI · 8B-IS")
                                .font(.system(size: 12, weight: .bold, design: .monospaced))
                            Text(state.activeICType == .pasmo ? "PA-0382-7719-2041" : "JE-8821-4402-9103")
                                .font(.system(size: 10, design: .monospaced))
                                .opacity(0.8)
                        }
                        Spacer()
                        HStack(spacing: 4) {
                            Circle()
                                .fill(Color(red: 0.38, green: 0.90, blue: 0.79))
                                .frame(width: 6, height: 6)
                            Text("端末連動中")
                                .font(.system(size: 10, design: .monospaced))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.black.opacity(0.35))
                        .cornerRadius(12)
                    }
                }
                .padding(20)
                .frame(height: 200)

                // Ripple Animation
                if rippleActive {
                    Circle()
                        .stroke(Color.white.opacity(0.6), lineWidth: 3)
                        .scaleEffect(rippleActive ? 2.5 : 0.1)
                        .opacity(rippleActive ? 0.0 : 1.0)
                        .animation(.easeOut(duration: 0.6), value: rippleActive)
                }
            }

            // Ticket Gate LED Screen
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("TOKYO TICKET GATE (自動改札機)")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(.gray)
                    Spacer()
                    Text("● ONLINE")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(gateStatusColor)
                }
                Text(gateStatusText)
                    .font(.system(.headline, design: .monospaced))
                    .fontWeight(.bold)
                    .foregroundColor(gateStatusColor)
            }
            .padding(14)
            .background(Color(red: 0.02, green: 0.03, blue: 0.05))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color(red: 0.38, green: 0.90, blue: 0.79).opacity(0.3), lineWidth: 1)
            )

            // Tap-to-ride Action Buttons
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                GateButton(route: "山手線", desc: "渋谷 ➔ 新宿", fare: 180, badge: "JR", badgeColor: .green) {
                    performTap(fare: 180, label: "山手線 (Shibuya to Shinjuku)")
                }
                GateButton(route: "銀座線", desc: "浅草 ➔ 銀座", fare: 210, badge: "Metro", badgeColor: .orange) {
                    performTap(fare: 210, label: "銀座線 (Asakusa to Ginza)")
                }
                GateButton(route: "7-Eleven", desc: "おにぎり・緑茶", fare: 340, badge: "7-11", badgeColor: .teal) {
                    performTap(fare: 340, label: "コンビニ決済 (Onigiri & Tea)")
                }
                GateButton(route: "のぞみ号", desc: "東京 ➔ 新大阪", fare: 14720, badge: "新幹線", badgeColor: .blue) {
                    performTap(fare: 14720, label: "東海道新幹線 (Tokyo to Osaka)")
                }
            }

            // Recharge Button
            Button(action: {
                state.rechargeIC()
                AudioService.shared.playFeliCa()
                triggerHaptic()
                gateStatusText = "[ チャージ完了 ] +¥3,000"
                gateStatusColor = Color(red: 0.38, green: 0.90, blue: 0.79)
            }) {
                HStack {
                    Image(systemName: "bolt.fill")
                    Text("Recharge +¥3,000 from Revolut Ultra (0% FX)")
                        .fontWeight(.bold)
                }
                .font(.system(.subheadline, design: .monospaced))
                .foregroundColor(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(red: 0.38, green: 0.90, blue: 0.79))
                .cornerRadius(8)
            }
        }
        .padding()
    }

    private func performTap(fare: Int, label: String) {
        if state.tapTransitGate(fare: fare, label: label) {
            AudioService.shared.playFeliCa()
            triggerHaptic()
            rippleActive = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                rippleActive = false
            }
            let bal = state.activeICType == .pasmo ? state.pasmoBalanceJPY : state.suicaBalanceJPY
            gateStatusText = "[ 進入可 ] -¥\(fare) · 残高 ¥\(bal)"
            gateStatusColor = Color(red: 0.38, green: 0.90, blue: 0.79)
        } else {
            AudioService.shared.playFeliCaError()
            triggerErrorHaptic()
            gateStatusText = "[ 残高不足 ] チャージしてください"
            gateStatusColor = Color(red: 1.0, green: 0.33, blue: 0.44)
        }
    }

    private func triggerHaptic() {
        #if os(iOS)
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        #endif
    }

    private func triggerErrorHaptic() {
        #if os(iOS)
        let notification = UINotificationFeedbackGenerator()
        notification.notificationOccurred(.error)
        #endif
    }
}

struct GateButton: View {
    let route: String
    let desc: String
    let fare: Int
    let badge: String
    let badgeColor: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(badge)
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(badgeColor)
                        .foregroundColor(.white)
                        .cornerRadius(3)
                    Text(route)
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                    Spacer()
                    Text("-¥\(fare)")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(Color(red: 0.91, green: 0.69, blue: 0.36))
                }
                Text(desc)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.gray)
            }
            .padding(10)
            .background(Color(white: 0.08))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
        }
    }
}
