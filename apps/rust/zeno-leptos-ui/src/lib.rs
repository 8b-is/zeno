//! Full Client-Side Rust UI (`Leptos 0.8` CSR) for ZENO US (`/us-rust`).
//!
//! - Zero IEEE-754 floating-point types anywhere in financial calculations.
//! - Zero inline styles; styled exclusively by obsidian/emerald/gold classes in `/us.css`.
//! - Reuses `#![no_std]` arithmetic exports from `zeno-wasm-client`.

use leptos::prelude::*;
use zeno_wasm_client::{
    zeno_foken_net_milli_hours, zeno_fx_convert_micro, zeno_gcd_u64, zeno_sanpo_yoshi_family,
    zeno_sanpo_yoshi_foken, zeno_sanpo_yoshi_operating, zeno_wasm_version,
};

const MICRO_USD: u64 = 1_000_000;
const SEED_USDC_MICRO: u64 = 31_240_500_000;
const SEED_USDT_MICRO: u64 = 20_800_000_000;
const STEP_500_MICRO: u64 = 500 * MICRO_USD;
const SOLANA_USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const B58_ALPHABET: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/// Format unsigned micro-USD (`1 USD = 1_000_000 µUSD`) cleanly with zero floats.
pub fn format_micro_usd(micro: u64) -> String {
    format_micro_currency(micro, "$")
}

/// Format unsigned micro-units (`10^6`) with thousands separators and 2 decimal digits.
pub fn format_micro_currency(micro: u64, symbol: &str) -> String {
    let rounded_cents = micro / 10_000;
    let whole = rounded_cents / 100;
    let cents = rounded_cents % 100;
    let whole_str = format_with_commas(whole);
    format!("{symbol}{whole_str}.{cents:02}")
}

fn format_with_commas(mut n: u64) -> String {
    if n == 0 {
        return "0".to_string();
    }
    let mut digits = Vec::new();
    let mut count = 0usize;
    while n > 0 {
        if count > 0 && count.is_multiple_of(3) {
            digits.push(b',');
        }
        digits.push(b'0' + (n % 10) as u8);
        n /= 10;
        count += 1;
    }
    digits.reverse();
    String::from_utf8(digits).unwrap_or_else(|_| "0".to_string())
}

/// Strict non-negative USD parser up to 6 fractional digits (`$`, `,`, spaces stripped after validation).
pub fn parse_usd_micro(input: &str) -> Option<u64> {
    let trimmed = input.trim().trim_start_matches('$').trim();
    if trimmed.is_empty() {
        return None;
    }
    let clean: String = trimmed.chars().filter(|&c| c != ',').collect();
    if let Some((whole_str, frac_str)) = clean.split_once('.') {
        if whole_str.is_empty()
            || !whole_str.bytes().all(|b| b.is_ascii_digit())
            || frac_str.is_empty()
            || frac_str.len() > 6
            || !frac_str.bytes().all(|b| b.is_ascii_digit())
        {
            return None;
        }
        let whole: u64 = whole_str.parse().ok()?;
        let mut frac_padded = String::from(frac_str);
        while frac_padded.len() < 6 {
            frac_padded.push('0');
        }
        let frac: u64 = frac_padded.parse().ok()?;
        let total = whole.checked_mul(MICRO_USD)?.checked_add(frac)?;
        if total == 0 { None } else { Some(total) }
    } else {
        if !clean.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        let whole: u64 = clean.parse().ok()?;
        let total = whole.checked_mul(MICRO_USD)?;
        if total == 0 { None } else { Some(total) }
    }
}

/// Validate a canonical 32-byte non-zero Solana Ed25519 Base58 public key with zero floats.
pub fn is_valid_solana_b58(addr: &str) -> bool {
    let bytes = addr.trim().as_bytes();
    if !(32..=44).contains(&bytes.len()) {
        return false;
    }
    let mut leading_ones = 0usize;
    while leading_ones < bytes.len() && bytes[leading_ones] == b'1' {
        leading_ones += 1;
    }
    let mut out = [0u8; 32];
    for &ch in &bytes[leading_ones..] {
        let Some(pos) = B58_ALPHABET.iter().position(|&b| b == ch) else {
            return false;
        };
        let mut carry = pos as u32;
        for slot in out.iter_mut().rev() {
            carry += u32::from(*slot) * 58;
            *slot = (carry & 0xff) as u8;
            carry >>= 8;
        }
        if carry != 0 {
            return false;
        }
    }
    let mut non_zero_start = 0usize;
    while non_zero_start < 32 && out[non_zero_start] == 0 {
        non_zero_start += 1;
    }
    if non_zero_start < leading_ones {
        return false;
    }
    out.iter().any(|&b| b != 0)
}

fn format_exact_decimal(micro: u64) -> String {
    let whole = micro / MICRO_USD;
    let frac = micro % MICRO_USD;
    if frac == 0 {
        return whole.to_string();
    }
    let frac_s = format!("{frac:06}");
    let trimmed = frac_s.trim_end_matches('0');
    format!("{whole}.{trimmed}")
}

fn url_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for &b in input.as_bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

pub fn build_solana_pay_uri(recipient: &str, amount_micro: u64, memo: &str) -> String {
    let amt = format_exact_decimal(amount_micro);
    format!(
        "solana:{recipient}?amount={amt}&spl-token={SOLANA_USDC_MINT}&label=ZENO%20Family%20Trust&memo={}",
        url_encode(memo)
    )
}

#[component]
pub fn ZenoRustApp() -> impl IntoView {
    let (usdc_micro, set_usdc_micro) = signal(SEED_USDC_MICRO);
    let (usdt_micro, set_usdt_micro) = signal(SEED_USDT_MICRO);
    let (liab_micro, set_liab_micro) = signal(SEED_USDC_MICRO + SEED_USDT_MICRO);

    let (sol_recipient, set_sol_recipient) =
        signal("HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS".to_string());
    let (sol_amount, set_sol_amount) = signal("5.00".to_string());
    let (sol_memo, set_sol_memo) = signal("zeno-rust-leptos-test".to_string());

    let (fx_usd_input, set_fx_usd_input) = signal("100.00".to_string());
    let (fx_currency_id, set_fx_currency_id) = signal(1u32); // JPY default

    let (plan_fee_micro, set_plan_fee_micro) = signal(49_000_000u64); // Ultra Quant $49
    let (foken_avoided, set_foken_avoided) = signal(120i64);
    let (foken_added, set_foken_added) = signal(10i64);
    let (foken_debt, set_foken_debt) = signal(2i64);

    let total_reserves = move || usdc_micro.get().saturating_add(usdt_micro.get());
    let coverage_pq = move || {
        let res = total_reserves();
        let liab = liab_micro.get();
        if liab == 0 {
            return "1/1".to_string();
        }
        let g = zeno_gcd_u64(res, liab).max(1);
        format!("{}/{}", res / g, liab / g)
    };
    let trit_badge = move || {
        let res = total_reserves();
        let liab = liab_micro.get();
        if res == liab {
            "Coverage 1/1 · trit 0"
        } else if res > liab {
            "Over-backed · trit +1"
        } else {
            "Under-backed · trit -1"
        }
    };

    let sol_valid = move || is_valid_solana_b58(&sol_recipient.get());
    let sol_amount_micro = move || parse_usd_micro(&sol_amount.get());
    let sol_uri = move || {
        let rec = sol_recipient.get();
        let clean = rec.trim();
        if !is_valid_solana_b58(clean) {
            return "Enter a valid 32-byte Solana Base58 pubkey".to_string();
        }
        let Some(amt) = sol_amount_micro() else {
            return "Enter a valid USDC amount (> 0)".to_string();
        };
        build_solana_pay_uri(clean, amt, sol_memo.get().trim())
    };
    let sol_cli = move || {
        let rec = sol_recipient.get();
        let clean = rec.trim();
        if !is_valid_solana_b58(clean) {
            return "—".to_string();
        }
        let Some(amt) = sol_amount_micro() else {
            return "—".to_string();
        };
        format!(
            "spl-token transfer {SOLANA_USDC_MINT} {} {clean} --fund-recipient --allow-unfunded-recipient",
            format_exact_decimal(amt)
        )
    };

    let fx_quote_text = move || {
        let Some(usd_micro) = parse_usd_micro(&fx_usd_input.get()) else {
            return "Invalid USD amount".to_string();
        };
        let cid = fx_currency_id.get();
        let out_micro = zeno_fx_convert_micro(usd_micro, cid);
        let (sym, rate_pq) = match cid {
            1 => ("¥", "305/2"),
            2 => ("€", "23/25"),
            3 => ("£", "79/100"),
            4 => ("Ft ", "737/2"),
            _ => ("$", "1/1"),
        };
        format!("{} (Rate p/q = {rate_pq} · 0 bps)", format_micro_currency(out_micro, sym))
    };

    let sanpo_operating = move || format_micro_usd(zeno_sanpo_yoshi_operating(plan_fee_micro.get()));
    let sanpo_family = move || format_micro_usd(zeno_sanpo_yoshi_family(plan_fee_micro.get()));
    let sanpo_foken = move || format_micro_usd(zeno_sanpo_yoshi_foken(plan_fee_micro.get()));

    let foken_net_text = move || {
        let a_milli = foken_avoided.get().saturating_mul(1000);
        let w_milli = foken_added.get().saturating_mul(1000);
        let d_milli = foken_debt.get().saturating_mul(1000);
        let net_milli = zeno_foken_net_milli_hours(a_milli, w_milli, d_milli);
        let sign = if net_milli < 0 { "-" } else { "" };
        let abs = net_milli.unsigned_abs();
        let verdict = if net_milli > 0 { "PASS" } else { "FAIL" };
        format!("{verdict} · {sign}{}.{:03} net hrs", abs / 1000, abs % 1000)
    };

    view! {
        <header class="us-header">
            <div class="us-brand">
                <div class="us-logo" aria-hidden="true">"🦀"</div>
                <div>
                    <div class="us-brand-title">
                        <span>"ZENO US"</span>
                        <span class="us-flag-pill">"100% RUST · LEPTOS 0.8 WASM"</span>
                    </div>
                    <div class="us-brand-sub">
                        {format!("Zero-Float Reactive Client · ABI v{} · Obsidian/Emerald · Strict CSP", zeno_wasm_version())}
                    </div>
                </div>
            </div>
            <div class="us-header-actions">
                <span class="pill-btn por-ok">{move || format!("● PoR {}", coverage_pq())}</span>
                <a href="/us" class="pill-btn">"MIT JS+WASM UI"</a>
                <a href="/rust-wasm-spec" target="_blank" rel="noopener noreferrer" class="pill-btn gold-pill">"Rust+ASM Spec"</a>
                <a href="/" class="pill-btn">"← Constellation"</a>
            </div>
        </header>

        <main id="rust-main-stage" class="us-shell">
            <aside class="us-rail" aria-label="Rust WASM telemetry">
                <div class="rail-meta">
                    <div><strong>"UI Runtime:"</strong> " Leptos 0.8 CSR"</div>
                    <div><strong>"Math Core:"</strong> " zeno-wasm-client"</div>
                    <div><strong>"ASM Crate:"</strong> " zeno-asm (ARM64/x86)"</div>
                    <div><strong>"Telemetry:"</strong> " 0 cookies · 0 floats"</div>
                    <div><a href="/us">"← Open Standard /us UI"</a></div>
                </div>
            </aside>

            <div>
                <section class="panel kintsugi mb-md">
                    <div class="panel-head">
                        <div>
                            <div class="panel-title">"USDC + USDT 1:1 Sovereign Reserve Ledger (Rust Signals)"</div>
                            <div class="panel-sub">"Integer micro-USD & reduced p/q invariant running purely in compiled Rust WASM"</div>
                        </div>
                        <span class="tag-badge emerald">{trit_badge}</span>
                    </div>

                    <div class="reserve-stats">
                        <div class="stat-box">
                            <div class="stat-label">"USDC Reserve"</div>
                            <div class="stat-val text-teal">{move || format_micro_usd(usdc_micro.get())}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">"USDT Reserve"</div>
                            <div class="stat-val text-emerald">{move || format_micro_usd(usdt_micro.get())}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">"Total Reserves"</div>
                            <div class="stat-val">{move || format_micro_usd(total_reserves())}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">"Liabilities (1:1)"</div>
                            <div class="stat-val text-gold">{move || format_micro_usd(liab_micro.get())}</div>
                        </div>
                    </div>

                    <div class="btn-row mt-md">
                        <button class="btn-primary" type="button" on:click=move |_| {
                            set_usdc_micro.update(|v| *v = v.saturating_add(STEP_500_MICRO));
                            set_liab_micro.update(|v| *v = v.saturating_add(STEP_500_MICRO));
                        }>"+ $500 USDC Mint"</button>
                        <button class="btn-secondary" type="button" on:click=move |_| {
                            set_usdt_micro.update(|v| *v = v.saturating_add(STEP_500_MICRO));
                            set_liab_micro.update(|v| *v = v.saturating_add(STEP_500_MICRO));
                        }>"+ $500 USDT Mint"</button>
                        <button class="btn-secondary" type="button" on:click=move |_| {
                            if usdc_micro.get_untracked() >= STEP_500_MICRO {
                                set_usdc_micro.update(|v| *v -= STEP_500_MICRO);
                                set_usdt_micro.update(|v| *v = v.saturating_add(STEP_500_MICRO));
                            }
                        }>"⇄ Swap $500 USDC→USDT"</button>
                        <button class="btn-secondary" type="button" on:click=move |_| {
                            set_usdc_micro.set(SEED_USDC_MICRO);
                            set_usdt_micro.set(SEED_USDT_MICRO);
                            set_liab_micro.set(SEED_USDC_MICRO + SEED_USDT_MICRO);
                        }>"↺ Reset Parity"</button>
                    </div>
                </section>

                <section class="panel kintsugi mb-md">
                    <div class="panel-head">
                        <div>
                            <div class="panel-title">"Solana Mainnet SPL-USDC Payout Builder (Unsigned)"</div>
                            <div class="panel-sub">"Canonical 32-byte Ed25519 Base58 validation compiled in Rust WASM"</div>
                        </div>
                        <span class=move || if sol_valid() { "tag-badge emerald" } else { "tag-badge crimson" }>
                            {move || if sol_valid() { "VALID SOLANA ED25519" } else { "INVALID BASE58" }}
                        </span>
                    </div>

                    <div class="field-grid">
                        <div class="field">
                            <label for="rust-sol-recipient">"Recipient Solana Pubkey"</label>
                            <input
                                id="rust-sol-recipient"
                                class="input mono"
                                type="text"
                                prop:value=move || sol_recipient.get()
                                on:input=move |ev| set_sol_recipient.set(event_target_value(&ev))
                            />
                        </div>
                        <div class="field">
                            <label for="rust-sol-amount">"USDC Amount"</label>
                            <input
                                id="rust-sol-amount"
                                class="input mono"
                                type="text"
                                prop:value=move || sol_amount.get()
                                on:input=move |ev| set_sol_amount.set(event_target_value(&ev))
                            />
                        </div>
                        <div class="field">
                            <label for="rust-sol-memo">"Memo"</label>
                            <input
                                id="rust-sol-memo"
                                class="input"
                                type="text"
                                prop:value=move || sol_memo.get()
                                on:input=move |ev| set_sol_memo.set(event_target_value(&ev))
                            />
                        </div>
                    </div>

                    <div class="cli-code-box mt-md">{sol_uri}</div>
                    <div class="cli-code-box mt-sm">{sol_cli}</div>
                </section>

                <section class="panel">
                    <div class="panel-head">
                        <div>
                            <div class="panel-title">"Zero-Float p/q FX · Sanpo Yoshi 50/30/20 · FOKEN Gate"</div>
                            <div class="panel-sub">"Direct calls to #![no_std] zeno-wasm-client Rust functions"</div>
                        </div>
                        <span class="tag-badge gold">{foken_net_text}</span>
                    </div>

                    <div class="field-grid">
                        <div class="field">
                            <label for="rust-fx-usd">"FX Input (USD)"</label>
                            <input
                                id="rust-fx-usd"
                                class="input mono"
                                type="text"
                                prop:value=move || fx_usd_input.get()
                                on:input=move |ev| set_fx_usd_input.set(event_target_value(&ev))
                            />
                        </div>
                        <div class="field">
                            <label for="rust-fx-cur">"Target Pocket"</label>
                            <select
                                id="rust-fx-cur"
                                class="select"
                                on:change=move |ev| {
                                    if let Ok(id) = event_target_value(&ev).parse::<u32>() {
                                        set_fx_currency_id.set(id);
                                    }
                                }
                            >
                                <option value="1" selected>"JPY (305/2)"</option>
                                <option value="2">"EUR (23/25)"</option>
                                <option value="3">"GBP (79/100)"</option>
                                <option value="4">"HUF (737/2)"</option>
                            </select>
                        </div>
                        <div class="field">
                            <label for="rust-plan-fee">"Subscription Plan (Sanpo Yoshi)"</label>
                            <select
                                id="rust-plan-fee"
                                class="select"
                                on:change=move |ev| {
                                    if let Ok(micro) = event_target_value(&ev).parse::<u64>() {
                                        set_plan_fee_micro.set(micro);
                                    }
                                }
                            >
                                <option value="9990000">"ZENO Plus ($9.99/mo)"</option>
                                <option value="49000000" selected>"ZENO Ultra Quant ($49.00/mo)"</option>
                                <option value="199000000">"Institutional ($199.00/mo)"</option>
                            </select>
                        </div>
                    </div>

                    <div class="reserve-stats mt-md">
                        <div class="stat-box">
                            <div class="stat-label">"FX Quote"</div>
                            <div class="stat-val text-teal">{fx_quote_text}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">"Operating (50%)"</div>
                            <div class="stat-val">{sanpo_operating}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">"Family Trust USDC (30%)"</div>
                            <div class="stat-val text-emerald">{sanpo_family}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">"FOKEN Commons (20%)"</div>
                            <div class="stat-val text-gold">{sanpo_foken}</div>
                        </div>
                    </div>

                    <div class="field-grid mt-md">
                        <div class="field">
                            <label for="rust-foken-avoided">"Future Work Avoided (hrs)"</label>
                            <input
                                id="rust-foken-avoided"
                                class="input mono"
                                type="number"
                                prop:value=move || foken_avoided.get().to_string()
                                on:input=move |ev| {
                                    if let Ok(v) = event_target_value(&ev).parse::<i64>() {
                                        set_foken_avoided.set(v);
                                    }
                                }
                            />
                        </div>
                        <div class="field">
                            <label for="rust-foken-added">"Work Added (hrs)"</label>
                            <input
                                id="rust-foken-added"
                                class="input mono"
                                type="number"
                                prop:value=move || foken_added.get().to_string()
                                on:input=move |ev| {
                                    if let Ok(v) = event_target_value(&ev).parse::<i64>() {
                                        set_foken_added.set(v);
                                    }
                                }
                            />
                        </div>
                        <div class="field">
                            <label for="rust-foken-debt">"Maintenance Debt (hrs)"</label>
                            <input
                                id="rust-foken-debt"
                                class="input mono"
                                type="number"
                                prop:value=move || foken_debt.get().to_string()
                                on:input=move |ev| {
                                    if let Ok(v) = event_target_value(&ev).parse::<i64>() {
                                        set_foken_debt.set(v);
                                    }
                                }
                            />
                        </div>
                    </div>
                </section>
            </div>
        </main>

        <footer class="us-footer" role="contentinfo">
            <div class="footer-kicker">"the constellation · lovetta lane"</div>
            <div class="mt-sm">"ZENO US Leptos 0.8 Rust WASM Client · 8b-is Family Research <3"</div>
            <div class="mt-sm mono">"Support: aye@8b.is · Phone: +1 808-400-8428 · WhatsApp R&D (Japan · Hue): +1 757-614-7542 · 56 Broad St STE 14135, Boston, MA 02109-4301, United States"</div>
            <div class="us-footer-links">
                <a href="https://koan.vaked.dev/">"✧ koan.vaked.dev"</a>
                <a href="https://zeno.vaked.dev/">"zeno.vaked.dev"</a>
                <a href="https://art.vaked.dev/">"art.vaked.dev"</a>
                <a href="https://pocoo.vaked.dev/">"pocoo.vaked.dev"</a>
                <a href="https://8b.is" target="_blank" rel="noopener noreferrer">"8b.is"</a>
            </div>
        </footer>
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() {
    leptos::mount::mount_to_body(ZenoRustApp);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn micro_usd_formatting_and_parsing_zero_float() {
        assert_eq!(format_micro_usd(31_240_500_000), "$31,240.50");
        assert_eq!(format_micro_usd(0), "$0.00");
        assert_eq!(format_micro_usd(100_000_000), "$100.00");

        assert_eq!(parse_usd_micro("$12,840.50"), Some(12_840_500_000));
        assert_eq!(parse_usd_micro("5.00"), Some(5_000_000));
        assert_eq!(parse_usd_micro("-5"), None);
        assert_eq!(parse_usd_micro("0"), None);
        assert_eq!(parse_usd_micro("1.1234567"), None);
    }

    #[test]
    fn solana_base58_and_uri_generation() {
        let peter = "HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS";
        assert!(is_valid_solana_b58(peter));
        assert!(!is_valid_solana_b58("11111111111111111111111111111111"));
        assert!(!is_valid_solana_b58("0OIlInvalid"));

        let uri = build_solana_pay_uri(peter, 5_000_000, "zeno test");
        assert_eq!(
            uri,
            "solana:HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS?amount=5&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=ZENO%20Family%20Trust&memo=zeno%20test"
        );
    }
}
