import SwiftUI

/// Main Tab Navigation View for ZENO iOS App
public struct ContentView: View {
    @ObservedObject var state = ZenoState.shared

    public init() {}

    public var body: some View {
        TabView {
            // Tokyo Foundation Tab
            NavigationView {
                ScrollView {
                    TokyoTransitCardView()
                }
                .navigationTitle("東京基盤 (Transit)")
                .background(Color(red: 0.03, green: 0.03, blue: 0.04).ignoresSafeArea())
            }
            .tabItem {
                Label("Transit & IC", systemImage: "tram.fill")
            }

            // Revolut Ultra & FX Tab
            NavigationView {
                ScrollView {
                    RevolutUltraCardView()
                }
                .navigationTitle("Revolut Ultra")
                .background(Color(red: 0.03, green: 0.03, blue: 0.04).ignoresSafeArea())
            }
            .tabItem {
                Label("Ultra FX", systemImage: "creditcard.fill")
            }

            // Accounts & Kintsugi Ledger Tab
            NavigationView {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Header Balances
                        VStack(alignment: .leading, spacing: 6) {
                            Text("SOVEREIGN VAULT BALANCE")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundColor(.gray)
                            Text("¥\(String(format: "%.4f", state.contributorBalanceJPY))")
                                .font(.system(size: 32, weight: .heavy, design: .monospaced))
                                .foregroundColor(Color(red: 0.91, green: 0.69, blue: 0.36))
                            Text("ID: cnt_0x71c8 · 8b-is Crew: Hue · Aye · Taisha · Omni")
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(.teal)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(white: 0.08))
                        .cornerRadius(12)

                        // Ledger Table
                        Text("金継ぎ台帳 (Kintsugi Ledger)")
                            .font(.system(.headline, design: .monospaced))
                            .foregroundColor(Color(red: 0.91, green: 0.69, blue: 0.36))
                            .padding(.top, 8)

                        ForEach(state.ledgerBlocks) { block in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text("#\(block.index)")
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .foregroundColor(Color(red: 0.91, green: 0.69, blue: 0.36))
                                    Spacer()
                                    Text("SEALED")
                                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.teal.opacity(0.2))
                                        .foregroundColor(.teal)
                                        .cornerRadius(4)
                                }
                                Text(block.memo)
                                    .font(.system(size: 12, design: .monospaced))
                                Text(block.seal.prefix(16) + "...")
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor(.gray)
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(white: 0.06))
                            .cornerRadius(8)
                        }
                    }
                    .padding()
                }
                .navigationTitle("口座一覧 (Accounts)")
                .background(Color(red: 0.03, green: 0.03, blue: 0.04).ignoresSafeArea())
            }
            .tabItem {
                Label("Ledger", systemImage: "book.closed.fill")
            }

            // Stripe & ACP Agentic Commerce Tab
            NavigationView {
                ScrollView {
                    StripeAgenticCommerceView()
                }
                .navigationTitle("決済連携 (Stripe)")
                .background(Color(red: 0.03, green: 0.03, blue: 0.04).ignoresSafeArea())
            }
            .tabItem {
                Label("Stripe/ACP", systemImage: "network")
            }
        }
        .accentColor(Color(red: 0.91, green: 0.69, blue: 0.36)) // Gold accent
        .preferredColorScheme(.dark)
    }
}
