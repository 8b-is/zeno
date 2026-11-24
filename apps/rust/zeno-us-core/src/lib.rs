#![no_std]
#![forbid(unsafe_code)]
//! ZENO US Private Core (`zeno-us-core`)
//!
//! Pure `#![no_std]` + `alloc` Rust backend with **zero floating-point math**:
//! - Exact integer micro-USD (`1 USD = 1_000_000 µUSD`) & `p/q` `Rational` arithmetic
//! - Segregated `USDC + USDT` 1:1 reserve backing (no debt minting)
//! - Replay-protected deposit `tx_hash` & Foken `invoice_id` registries
//! - Cumulative daily-cap & per-tx tier enforcement (anti split-tx bypass)
//! - Canonical posting-authenticated Kintsugi SHA-256 + `0x62` WUPZ seals
//! - Domain-separated blinded SHA-256 identity commitments (zero raw PII)

extern crate alloc;

use alloc::collections::{BTreeMap, BTreeSet};
use alloc::format;
use alloc::string::{String, ToString};
use alloc::vec;
use alloc::vec::Vec;
use zeno_issuer_angel::{
    kintsugi_trace_chain, sha256, KernelError, KOMPRESS_GATE_0X62, Rational, StableAsset,
    StableReserveState, WupzWitnessSeal,
};

pub const MICRO_USD: u64 = 1_000_000;
pub const SECONDS_PER_DAY: u64 = 86_400;
pub const MAX_FOKENS_PER_NET_HOUR: u64 = 100;
pub const MAX_FOKENS_PER_INVOICE: u64 = 250_000;
pub const MAX_PUBKEY_HEX_LEN: usize = 130;
pub const MAX_SALT_LEN: usize = 128;
pub const MAX_CHAIN_LEN: usize = 32;
pub const MAX_ID_LEN: usize = 128;
pub const MAX_MEMO_LEN: usize = 256;
pub const SOLANA_USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
pub const SOLANA_USDT_MINT: &str = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
pub const SOLANA_TOKEN_PROGRAM: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
pub const VAKED_POLYGON_ERC20: &str = "0x2Ae7DA713A2c8527AF70825C0F79632AF2e2ae4A";
pub const VAKED_MAX_SUPPLY: u64 = 21_000_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrivacyTier {
    SovereignLite,
    VerifiedUs,
    Institutional,
}

impl PrivacyTier {
    pub const fn per_tx_cap_micro(self) -> u64 {
        match self {
            Self::SovereignLite => 1_000 * MICRO_USD,
            Self::VerifiedUs => 25_000 * MICRO_USD,
            Self::Institutional => 250_000 * MICRO_USD,
        }
    }

    pub const fn daily_cap_micro(self) -> u64 {
        match self {
            Self::SovereignLite => 3_000 * MICRO_USD,
            Self::VerifiedUs => 100_000 * MICRO_USD,
            Self::Institutional => 1_000_000 * MICRO_USD,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FxCurrency {
    Usd,
    Jpy,
    Eur,
    Gbp,
    Huf,
}

impl FxCurrency {
    pub const fn code(self) -> &'static str {
        match self {
            Self::Usd => "USD",
            Self::Jpy => "JPY",
            Self::Eur => "EUR",
            Self::Gbp => "GBP",
            Self::Huf => "HUF",
        }
    }

    /// Exact reduced `p/q` rational interbank rate relative to 1 USD (0 bps markup).
    pub fn rate_pq(self) -> Result<Rational, KernelError> {
        match self {
            Self::Usd => Ok(Rational::ONE),
            Self::Jpy => Rational::new(305, 2),   // 152.50 JPY / USD
            Self::Eur => Rational::new(23, 25),   // 0.92 EUR / USD
            Self::Gbp => Rational::new(79, 100),  // 0.79 GBP / USD
            Self::Huf => Rational::new(737, 2),   // 368.50 HUF / USD
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FxQuote {
    pub target: FxCurrency,
    pub amount_micro_in: u64,
    pub amount_micro_out: u64,
    pub rate: Rational,
    pub fee_bps: u16,
}

pub fn convert_fx(amount_micro_usd: u64, target: FxCurrency) -> Result<FxQuote, UsCoreError> {
    if amount_micro_usd == 0 {
        return Err(UsCoreError::InvalidAmount);
    }
    let rate = target.rate_pq()?;
    let num = i128::from(rate.numerator());
    let den = i128::from(rate.denominator());
    let out_i128 = i128::from(amount_micro_usd)
        .checked_mul(num)
        .ok_or(UsCoreError::Overflow)?
        / den;
    let amount_micro_out = u64::try_from(out_i128).map_err(|_| UsCoreError::Overflow)?;
    if amount_micro_out == 0 {
        return Err(UsCoreError::InvalidAmount);
    }
    Ok(FxQuote {
        target,
        amount_micro_in: amount_micro_usd,
        amount_micro_out,
        rate,
        fee_bps: 0,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UsCoreError {
    Kernel(KernelError),
    InvalidCashtag,
    AccountExists,
    AccountNotFound,
    InvalidCommitmentInputs,
    InputTooLong,
    ExceedsPrivacyTierCap,
    ExceedsDailyCap,
    ReplayDetected,
    InsufficientBalance,
    InvalidAmount,
    SelfTransferForbidden,
    DoubleEntryViolation,
    FokenGateRejected(&'static str),
    InvalidSolanaAddress,
    InsufficientLiquidUsdcReserve,
    UnsupportedNetworkAsset,
    InvalidNetworkAddress,
    ZeroUsageUnits,
    InternalInvariant,
    Overflow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StableNetwork {
    Solana,
    Base,
    Ethereum,
    Arbitrum,
    Polygon,
    Optimism,
    Tron,
}

impl StableNetwork {
    pub const fn code(self) -> &'static str {
        match self {
            Self::Solana => "solana",
            Self::Base => "base",
            Self::Ethereum => "ethereum",
            Self::Arbitrum => "arbitrum",
            Self::Polygon => "polygon",
            Self::Optimism => "optimism",
            Self::Tron => "tron",
        }
    }

    pub const fn chain_id(self) -> Option<u64> {
        match self {
            Self::Solana | Self::Tron => None,
            Self::Base => Some(8453),
            Self::Ethereum => Some(1),
            Self::Arbitrum => Some(42161),
            Self::Polygon => Some(137),
            Self::Optimism => Some(10),
        }
    }

    pub const fn contract_address(self, asset: StableAsset) -> Option<&'static str> {
        match (self, asset) {
            (Self::Solana, StableAsset::Usdc) => Some(SOLANA_USDC_MINT),
            (Self::Solana, StableAsset::Usdt) => Some(SOLANA_USDT_MINT),
            (Self::Base, StableAsset::Usdc) => Some("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
            (Self::Base, StableAsset::Usdt) => Some("0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"),
            (Self::Ethereum, StableAsset::Usdc) => Some("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
            (Self::Ethereum, StableAsset::Usdt) => Some("0xdAC17F958D2ee523a2206206994597C13D831ec7"),
            (Self::Arbitrum, StableAsset::Usdc) => Some("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
            (Self::Arbitrum, StableAsset::Usdt) => Some("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"),
            (Self::Polygon, StableAsset::Usdc) => Some("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"),
            (Self::Polygon, StableAsset::Usdt) => Some("0xc2132D05D31c914a87C6611C10748AEb04B58e8F"),
            (Self::Optimism, StableAsset::Usdc) => Some("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"),
            (Self::Optimism, StableAsset::Usdt) => Some("0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"),
            (Self::Tron, StableAsset::Usdc) => None, // Native TRON USDC deprecated
            (Self::Tron, StableAsset::Usdt) => Some("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"),
        }
    }
}

/// Validate a recipient/deposit address on any of the top 7 USDC+USDT settlement networks.
pub fn validate_network_address(
    network: StableNetwork,
    asset: StableAsset,
    address: &str,
) -> Result<&'static str, UsCoreError> {
    let contract = network
        .contract_address(asset)
        .ok_or(UsCoreError::UnsupportedNetworkAsset)?;
    match network {
        StableNetwork::Solana => {
            let _ = decode_solana_pubkey(address)?;
        }
        StableNetwork::Base
        | StableNetwork::Ethereum
        | StableNetwork::Arbitrum
        | StableNetwork::Polygon
        | StableNetwork::Optimism => {
            let b = address.as_bytes();
            if b.len() != 42 || &b[0..2] != b"0x" || !b[2..].iter().all(|c| c.is_ascii_hexdigit()) {
                return Err(UsCoreError::InvalidNetworkAddress);
            }
            if b[2..].iter().all(|&c| c == b'0') {
                return Err(UsCoreError::InvalidNetworkAddress);
            }
        }
        StableNetwork::Tron => {
            let b = address.as_bytes();
            if b.len() != 34
                || b[0] != b'T'
                || !b.iter().all(|c| BASE58_ALPHABET.contains(c))
            {
                return Err(UsCoreError::InvalidNetworkAddress);
            }
        }
    }
    Ok(contract)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubscriptionPlan {
    Free,
    Plus,
    UltraQuant,
    Institutional,
}

impl SubscriptionPlan {
    pub const fn code(self) -> &'static str {
        match self {
            Self::Free => "free",
            Self::Plus => "plus",
            Self::UltraQuant => "ultra_quant",
            Self::Institutional => "institutional",
        }
    }

    pub const fn monthly_fee_micro(self) -> u64 {
        match self {
            Self::Free => 0,
            Self::Plus => 9_990_000,         // $9.99/mo
            Self::UltraQuant => 49_000_000,  // $49.00/mo
            Self::Institutional => 199_000_000, // $199.00/mo
        }
    }

    pub const fn auto_trade_fee_bps(self) -> u64 {
        match self {
            Self::Free => 50,
            Self::Plus => 25,
            Self::UltraQuant => 10,
            Self::Institutional => 5,
        }
    }

    pub const fn bridge_fee_bps(self) -> u64 {
        match self {
            Self::Free => 25,
            Self::Plus => 15,
            Self::UltraQuant => 5,
            Self::Institutional => 2,
        }
    }

    pub const fn included_api_calls(self) -> u64 {
        match self {
            Self::Free => 500,
            Self::Plus => 10_000,
            Self::UltraQuant => 100_000,
            Self::Institutional => 1_000_000,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UsageMeterKind {
    ApiCallOverage,
    AutoTradeTick,
    CrossChainBridge,
    DisposableCardMint,
}

impl UsageMeterKind {
    pub const fn code(self) -> &'static str {
        match self {
            Self::ApiCallOverage => "API_CALL_OVERAGE",
            Self::AutoTradeTick => "AUTO_TRADE_TICK",
            Self::CrossChainBridge => "CROSS_CHAIN_BRIDGE",
            Self::DisposableCardMint => "DISPOSABLE_CARD_MINT",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RevenueSplitMicro {
    pub total_micro: u64,
    pub operating_micro: u64,
    pub family_trust_micro: u64,
    pub foken_commons_micro: u64,
}

impl RevenueSplitMicro {
    /// Exact integer Sanpo Yoshi 50/30/20 split with zero rounding loss.
    pub fn split_sanpo_yoshi(total_micro: u64) -> Result<Self, UsCoreError> {
        let total = u128::from(total_micro);
        let family_trust = u64::try_from((total * 3) / 10).map_err(|_| UsCoreError::Overflow)?;
        let foken_commons = u64::try_from((total * 2) / 10).map_err(|_| UsCoreError::Overflow)?;
        let operating = total_micro - family_trust - foken_commons;
        Ok(Self {
            total_micro,
            operating_micro: operating,
            family_trust_micro: family_trust,
            foken_commons_micro: foken_commons,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MonetizationReceipt {
    pub plan: SubscriptionPlan,
    pub fee_micro: u64,
    pub split: RevenueSplitMicro,
    pub wupz_seal: WupzWitnessSeal,
}

const BASE58_ALPHABET: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/// Decode a canonical 32-byte Solana Ed25519 public key from Base58 (`#![no_std]`, zero floats).
/// Rejects wrong lengths, non-Base58 characters, overflow, and the all-zero system address.
pub fn decode_solana_pubkey(address: &str) -> Result<[u8; 32], UsCoreError> {
    let bytes = address.as_bytes();
    if bytes.len() < 32 || bytes.len() > 44 {
        return Err(UsCoreError::InvalidSolanaAddress);
    }
    let leading_ones = bytes.iter().take_while(|&&b| b == b'1').count();
    let mut raw = [0u8; 33];
    let mut raw_len: usize = 0;

    for &b in bytes {
        let mut digit = BASE58_ALPHABET
            .iter()
            .position(|&c| c == b)
            .ok_or(UsCoreError::InvalidSolanaAddress)? as u16;
        for byte_slot in raw[..raw_len].iter_mut().rev() {
            digit += u16::from(*byte_slot) * 58;
            *byte_slot = (digit & 0xff) as u8;
            digit >>= 8;
        }
        while digit > 0 {
            if raw_len >= raw.len() {
                return Err(UsCoreError::InvalidSolanaAddress);
            }
            for idx in (0..raw_len).rev() {
                raw[idx + 1] = raw[idx];
            }
            raw[0] = (digit & 0xff) as u8;
            raw_len += 1;
            digit >>= 8;
        }
    }

    // Strip any extra high zero while counting big-endian significant bytes
    let first_non_zero = raw[..raw_len]
        .iter()
        .position(|&v| v != 0)
        .unwrap_or(raw_len);
    let sig_len = raw_len - first_non_zero;
    if leading_ones + sig_len != 32 {
        return Err(UsCoreError::InvalidSolanaAddress);
    }

    let mut out = [0u8; 32];
    if sig_len > 0 {
        out[leading_ones..].copy_from_slice(&raw[first_non_zero..raw_len]);
    }
    if out.iter().all(|&b| b == 0) {
        return Err(UsCoreError::InvalidSolanaAddress);
    }
    Ok(out)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FamilyTrustBackingSnapshot {
    pub liquid_usdc_micro: u64,
    pub liquid_usdt_micro: u64,
    pub foken_net_utility_half_hours: u64,
    pub foken_constellation_projects: u16,
    pub vaked_presence_stamps: u64,
    pub vaked_contract: &'static str,
    pub vaked_usd_backing_weight: Rational,
    pub foken_usd_backing_weight: Rational,
    pub liquid_usd_backing_weight: Rational,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SolanaUsdcPayoutIntent {
    pub status: &'static str,
    pub network: &'static str,
    pub mint: &'static str,
    pub token_program: &'static str,
    pub from_cashtag: String,
    pub recipient_solana: String,
    pub recipient_pubkey: [u8; 32],
    pub amount_micro: u64,
    pub amount_exact: String,
    pub memo: String,
    pub solana_pay_uri: String,
    pub spl_token_cli_cmd: String,
    pub wupz_seal: WupzWitnessSeal,
}

fn format_micro_exact(amount_micro: u64) -> String {
    let whole = amount_micro / MICRO_USD;
    let frac = amount_micro % MICRO_USD;
    if frac == 0 {
        return format!("{}", whole);
    }
    let padded = format!("{:06}", frac);
    let trimmed = padded.trim_end_matches('0');
    format!("{}.{}", whole, trimmed)
}

fn url_encode_ascii(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for &b in input.as_bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}

impl SolanaUsdcPayoutIntent {
    pub fn to_compact_json(&self) -> String {
        let mut seal_hex = String::with_capacity(64);
        for byte in self.wupz_seal.bytes {
            seal_hex.push_str(&format!("{:02x}", byte));
        }
        format!(
            "{{\"status\":\"{}\",\"network\":\"{}\",\"mint\":\"{}\",\"tokenProgram\":\"{}\",\"fromCashtag\":\"{}\",\"recipient\":\"{}\",\"amountMicro\":{},\"amountExact\":\"{}\",\"solanaPayUri\":\"{}\",\"cliCommand\":\"{}\",\"wupzSealHex\":\"{}\"}}",
            self.status,
            self.network,
            self.mint,
            self.token_program,
            self.from_cashtag,
            self.recipient_solana,
            self.amount_micro,
            self.amount_exact,
            self.solana_pay_uri,
            self.spl_token_cli_cmd,
            seal_hex
        )
    }
}

impl From<KernelError> for UsCoreError {
    fn from(err: KernelError) -> Self {
        match err {
            KernelError::InvalidAmount => Self::InvalidAmount,
            KernelError::InsufficientBalance => Self::InsufficientBalance,
            KernelError::Overflow => Self::Overflow,
            KernelError::ReplayDetected => Self::ReplayDetected,
            other => Self::Kernel(other),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FokenNetUtility {
    pub future_work_avoided_hours: u64,
    pub work_added_hours: u64,
    pub maintenance_debt_hours: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FokenInvoiceInput<'a> {
    pub invoice_id: &'a str,
    pub contributor: &'a str,
    pub provenance_hash: &'a str,
    pub self_assessed_fokens: u64,
    pub ip_statement: &'a str,
    pub ip_signature: &'a str,
    pub net_utility: FokenNetUtility,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FokenVerdict {
    pub passed: bool,
    pub net_utility_pq: Rational,
    pub fokens_awarded: u64,
    pub usd_equivalent_micro: u64,
    pub trit: i8,
    pub reason: &'static str,
}

pub fn evaluate_foken_gate_pq(invoice: &FokenInvoiceInput<'_>) -> Result<FokenVerdict, UsCoreError> {
    if invoice.invoice_id.is_empty() || invoice.invoice_id.len() > MAX_ID_LEN {
        return Err(UsCoreError::FokenGateRejected("INVALID_INVOICE_ID"));
    }
    let contrib_bytes = invoice.contributor.as_bytes();
    if contrib_bytes.len() != 42
        || &contrib_bytes[0..2] != b"0x"
        || !contrib_bytes[2..].iter().all(|b| b.is_ascii_hexdigit())
    {
        return Err(UsCoreError::FokenGateRejected("INVALID_CONTRIBUTOR_ADDRESS"));
    }
    if !invoice.provenance_hash.starts_with("sha256://") {
        return Err(UsCoreError::FokenGateRejected("INVALID_PROVENANCE_HASH"));
    }
    let prov_hex = &invoice.provenance_hash.as_bytes()[9..];
    if prov_hex.len() != 64 || !prov_hex.iter().all(|b| b.is_ascii_hexdigit()) {
        return Err(UsCoreError::FokenGateRejected("INVALID_PROVENANCE_HEX"));
    }
    if invoice.self_assessed_fokens == 0 || invoice.self_assessed_fokens > MAX_FOKENS_PER_INVOICE {
        return Err(UsCoreError::FokenGateRejected("INVALID_SELF_ASSESSED_FOKENS"));
    }
    if !invoice.ip_statement.contains("IRREVOCABLE ASSIGNMENT") {
        return Err(UsCoreError::FokenGateRejected("MISSING_IP_ASSIGNMENT"));
    }
    let sig_bytes = invoice.ip_signature.as_bytes();
    if sig_bytes.len() < 18
        || sig_bytes.len() > 260
        || &sig_bytes[0..2] != b"0x"
        || !sig_bytes[2..].iter().all(|b| b.is_ascii_hexdigit())
    {
        return Err(UsCoreError::FokenGateRejected("INVALID_IP_SIGNATURE"));
    }

    let avoided = Rational::new(
        i64::try_from(invoice.net_utility.future_work_avoided_hours)
            .map_err(|_| UsCoreError::Overflow)?,
        1,
    )?;
    let added = Rational::new(
        i64::try_from(invoice.net_utility.work_added_hours).map_err(|_| UsCoreError::Overflow)?,
        1,
    )?;
    let debt = Rational::new(
        i64::try_from(invoice.net_utility.maintenance_debt_hours)
            .map_err(|_| UsCoreError::Overflow)?,
        1,
    )?;
    let three_halves = Rational::new(3, 2)?;
    let weighted_debt = three_halves.checked_mul(debt)?;
    let cost = added.checked_add(weighted_debt)?;
    let net_utility_pq = avoided.checked_sub(cost)?;

    if net_utility_pq <= Rational::ZERO {
        return Ok(FokenVerdict {
            passed: false,
            net_utility_pq,
            fokens_awarded: 0,
            usd_equivalent_micro: 0,
            trit: -1,
            reason: "NET_UTILITY_NOT_POSITIVE",
        });
    }

    // Proportional ceiling: <= 100 FOKEN per net-utility hour
    let max_by_utility = i128::from(net_utility_pq.numerator())
        .checked_mul(i128::from(MAX_FOKENS_PER_NET_HOUR))
        .ok_or(UsCoreError::Overflow)?
        / i128::from(net_utility_pq.denominator());
    if i128::from(invoice.self_assessed_fokens) > max_by_utility {
        return Err(UsCoreError::FokenGateRejected(
            "EXCEEDS_NET_UTILITY_VALUATION_CAP",
        ));
    }

    let usd_equivalent_micro = invoice
        .self_assessed_fokens
        .checked_mul(MICRO_USD)
        .ok_or(UsCoreError::Overflow)?;

    Ok(FokenVerdict {
        passed: true,
        net_utility_pq,
        fokens_awarded: invoice.self_assessed_fokens,
        usd_equivalent_micro,
        trit: 1,
        reason: "FOKEN_GATE_PASS",
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UsPrivacyAccount {
    pub cashtag: String,
    pub identity_commitment: [u8; 32],
    pub pubkey_hex: String,
    pub tier: PrivacyTier,
    pub balance_micro: u64,
    pub daily_day_epoch: u64,
    pub daily_volume_micro: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DoubleEntryPosting {
    pub account: String,
    pub amount_micro: i128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KintsugiTx {
    pub seq: u64,
    pub kind: &'static str,
    pub postings: Vec<DoubleEntryPosting>,
    pub memo: String,
    pub seal: WupzWitnessSeal,
    pub chain_trace: [u8; 32],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReserveProofSnapshot {
    pub usdc_reserve_micro: u64,
    pub usdt_reserve_micro: u64,
    pub total_reserves_micro: u64,
    pub total_liabilities_micro: u64,
    pub coverage_ratio: Rational,
    pub trit: i8,
    pub chain_head_trace: [u8; 32],
    pub wupz_seal: WupzWitnessSeal,
}

impl ReserveProofSnapshot {
    pub fn to_compact_json(&self) -> String {
        let mut trace_hex = String::with_capacity(64);
        for byte in self.chain_head_trace {
            trace_hex.push_str(&format!("{:02x}", byte));
        }
        let mut seal_hex = String::with_capacity(64);
        for byte in self.wupz_seal.bytes {
            seal_hex.push_str(&format!("{:02x}", byte));
        }
        format!(
            "{{\"asset\":\"USD\",\"backing\":[\"USDC\",\"USDT\"],\"usdcReserveMicro\":{},\"usdtReserveMicro\":{},\"totalReservesMicro\":{},\"totalLiabilitiesMicro\":{},\"coverageRatioNum\":{},\"coverageRatioDen\":{},\"coverageRatioPQ\":\"{}/{}\",\"trit\":{},\"gate\":\"0x{:02x}\",\"chainHeadTrace\":\"{}\",\"wupzSealHex\":\"{}\"}}",
            self.usdc_reserve_micro,
            self.usdt_reserve_micro,
            self.total_reserves_micro,
            self.total_liabilities_micro,
            self.coverage_ratio.numerator(),
            self.coverage_ratio.denominator(),
            self.coverage_ratio.numerator(),
            self.coverage_ratio.denominator(),
            self.trit,
            KOMPRESS_GATE_0X62,
            trace_hex,
            seal_hex
        )
    }
}

pub struct UsNeoBankCore {
    reserves: StableReserveState,
    accounts: BTreeMap<String, UsPrivacyAccount>,
    account_plans: BTreeMap<String, SubscriptionPlan>,
    revenue_operating_micro: u64,
    revenue_family_trust_micro: u64,
    revenue_foken_commons_micro: u64,
    seen_deposits: BTreeSet<(String, String)>,
    seen_invoices: BTreeSet<String>,
    txs: Vec<KintsugiTx>,
    chain_head: [u8; 32],
}

impl Default for UsNeoBankCore {
    fn default() -> Self {
        Self::new()
    }
}

impl UsNeoBankCore {
    pub const fn new() -> Self {
        Self {
            reserves: StableReserveState::new(0, 0, 0),
            accounts: BTreeMap::new(),
            account_plans: BTreeMap::new(),
            revenue_operating_micro: 0,
            revenue_family_trust_micro: 0,
            revenue_foken_commons_micro: 0,
            seen_deposits: BTreeSet::new(),
            seen_invoices: BTreeSet::new(),
            txs: Vec::new(),
            chain_head: [0u8; 32],
        }
    }

    fn validate_cashtag(cashtag: &str) -> Result<(), UsCoreError> {
        let bytes = cashtag.as_bytes();
        if bytes.len() < 3 || bytes.len() > 21 || bytes[0] != b'$' {
            return Err(UsCoreError::InvalidCashtag);
        }
        for &b in &bytes[1..] {
            let ok = b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_';
            if !ok {
                return Err(UsCoreError::InvalidCashtag);
            }
        }
        Ok(())
    }

    fn validate_bounded(value: &str, max_len: usize) -> Result<(), UsCoreError> {
        if value.is_empty() {
            return Err(UsCoreError::InvalidCommitmentInputs);
        }
        if value.len() > max_len {
            return Err(UsCoreError::InputTooLong);
        }
        Ok(())
    }

    fn push_lp_field(buf: &mut Vec<u8>, bytes: &[u8]) -> Result<(), UsCoreError> {
        let len = u32::try_from(bytes.len()).map_err(|_| UsCoreError::Overflow)?;
        buf.extend_from_slice(&len.to_be_bytes());
        buf.extend_from_slice(bytes);
        Ok(())
    }

    fn asset_account_id(asset: StableAsset) -> &'static str {
        match asset {
            StableAsset::Usdc => "asset:stable:usdc_reserve",
            StableAsset::Usdt => "asset:stable:usdt_reserve",
        }
    }

    fn asset_code(asset: StableAsset) -> &'static str {
        match asset {
            StableAsset::Usdc => "USDC",
            StableAsset::Usdt => "USDT",
        }
    }

    fn check_and_next_daily_volume(
        acct: &UsPrivacyAccount,
        amount_micro: u64,
        now_unix_sec: u64,
    ) -> Result<(u64, u64), UsCoreError> {
        if amount_micro > acct.tier.per_tx_cap_micro() {
            return Err(UsCoreError::ExceedsPrivacyTierCap);
        }
        let day_epoch = now_unix_sec / SECONDS_PER_DAY;
        let current_vol = if day_epoch > acct.daily_day_epoch {
            0
        } else {
            acct.daily_volume_micro
        };
        let next_vol = current_vol
            .checked_add(amount_micro)
            .ok_or(UsCoreError::Overflow)?;
        if next_vol > acct.tier.daily_cap_micro() {
            return Err(UsCoreError::ExceedsDailyCap);
        }
        Ok((day_epoch, next_vol))
    }

    /// Build canonical domain-separated Kintsugi seal authenticating `seq`, `kind`, `memo`,
    /// and every `(account, amount_micro)` posting before mutating state.
    fn prepare_tx(
        &self,
        kind: &'static str,
        postings: Vec<DoubleEntryPosting>,
        memo: String,
    ) -> Result<KintsugiTx, UsCoreError> {
        if postings.len() < 2 {
            return Err(UsCoreError::DoubleEntryViolation);
        }
        let sum = postings
            .iter()
            .try_fold(0i128, |acc, p| acc.checked_add(p.amount_micro))
            .ok_or(UsCoreError::Overflow)?;
        if sum != 0 {
            return Err(UsCoreError::DoubleEntryViolation);
        }

        let seq = u64::try_from(self.txs.len())
            .map_err(|_| UsCoreError::Overflow)?
            .checked_add(1)
            .ok_or(UsCoreError::Overflow)?;

        let mut frame = Vec::new();
        frame.extend_from_slice(b"ZENO:TX:V1:");
        frame.push(KOMPRESS_GATE_0X62);
        frame.extend_from_slice(&seq.to_be_bytes());
        Self::push_lp_field(&mut frame, kind.as_bytes())?;
        Self::push_lp_field(&mut frame, memo.as_bytes())?;
        let posting_count = u32::try_from(postings.len()).map_err(|_| UsCoreError::Overflow)?;
        frame.extend_from_slice(&posting_count.to_be_bytes());
        for p in &postings {
            Self::push_lp_field(&mut frame, p.account.as_bytes())?;
            frame.extend_from_slice(&p.amount_micro.to_be_bytes());
        }

        let seal = WupzWitnessSeal::seal(&frame);
        let chain_trace = kintsugi_trace_chain(&self.chain_head, &seal.bytes);

        Ok(KintsugiTx {
            seq,
            kind,
            postings,
            memo,
            seal,
            chain_trace,
        })
    }

    pub fn open_us_account(
        &mut self,
        cashtag: &str,
        pubkey_hex: &str,
        identity_salt: &str,
        tier: PrivacyTier,
    ) -> Result<&UsPrivacyAccount, UsCoreError> {
        Self::validate_cashtag(cashtag)?;
        Self::validate_bounded(pubkey_hex, MAX_PUBKEY_HEX_LEN)?;
        Self::validate_bounded(identity_salt, MAX_SALT_LEN)?;
        if !pubkey_hex.bytes().all(|b| b.is_ascii_hexdigit()) || pubkey_hex.len() % 2 != 0 {
            return Err(UsCoreError::InvalidCommitmentInputs);
        }
        if self.accounts.contains_key(cashtag) {
            return Err(UsCoreError::AccountExists);
        }

        let mut preimage = Vec::new();
        preimage.extend_from_slice(b"ZENO:ID:V1:");
        Self::push_lp_field(&mut preimage, cashtag.as_bytes())?;
        Self::push_lp_field(&mut preimage, pubkey_hex.as_bytes())?;
        Self::push_lp_field(&mut preimage, identity_salt.as_bytes())?;
        let identity_commitment = sha256(&preimage);

        let account = UsPrivacyAccount {
            cashtag: cashtag.to_string(),
            identity_commitment,
            pubkey_hex: pubkey_hex.to_string(),
            tier,
            balance_micro: 0,
            daily_day_epoch: 0,
            daily_volume_micro: 0,
        };
        self.accounts.insert(cashtag.to_string(), account);
        self.accounts
            .get(cashtag)
            .ok_or(UsCoreError::InternalInvariant)
    }

    pub fn mint_from_stablecoin(
        &mut self,
        cashtag: &str,
        asset: StableAsset,
        amount_micro: u64,
        chain: &str,
        tx_hash: &str,
        now_unix_sec: u64,
    ) -> Result<&KintsugiTx, UsCoreError> {
        if amount_micro == 0 {
            return Err(UsCoreError::InvalidAmount);
        }
        Self::validate_bounded(chain, MAX_CHAIN_LEN)?;
        Self::validate_bounded(tx_hash, MAX_ID_LEN)?;

        let deposit_key = (chain.to_string(), tx_hash.to_string());
        if self.seen_deposits.contains(&deposit_key) {
            return Err(UsCoreError::ReplayDetected);
        }

        let acct = self
            .accounts
            .get(cashtag)
            .ok_or(UsCoreError::AccountNotFound)?;
        let (next_day, next_vol) =
            Self::check_and_next_daily_volume(acct, amount_micro, now_unix_sec)?;
        let next_bal = acct
            .balance_micro
            .checked_add(amount_micro)
            .ok_or(UsCoreError::Overflow)?;

        let mut next_reserves = self.reserves;
        next_reserves.mint_backed(asset, amount_micro)?;

        let amt_i128 = i128::from(amount_micro);
        let postings = vec![
            DoubleEntryPosting {
                account: Self::asset_account_id(asset).to_string(),
                amount_micro: amt_i128,
            },
            DoubleEntryPosting {
                account: format!("usd:{}", cashtag),
                amount_micro: -amt_i128,
            },
        ];
        let memo = format!(
            "MINT_1_TO_1:{}:{}:{}->{}",
            Self::asset_code(asset),
            chain,
            tx_hash,
            cashtag
        );
        let tx = self.prepare_tx("MINT_1_TO_1", postings, memo)?;

        // Commit atomically after all invariants & seals succeed
        self.seen_deposits.insert(deposit_key);
        self.reserves = next_reserves;
        let acct_mut = self
            .accounts
            .get_mut(cashtag)
            .ok_or(UsCoreError::InternalInvariant)?;
        acct_mut.balance_micro = next_bal;
        acct_mut.daily_day_epoch = next_day;
        acct_mut.daily_volume_micro = next_vol;
        self.chain_head = tx.chain_trace;
        self.txs.push(tx);
        self.txs.last().ok_or(UsCoreError::InternalInvariant)
    }

    pub fn redeem_to_stablecoin(
        &mut self,
        cashtag: &str,
        asset: StableAsset,
        amount_micro: u64,
        destination: &str,
        now_unix_sec: u64,
    ) -> Result<&KintsugiTx, UsCoreError> {
        if amount_micro == 0 {
            return Err(UsCoreError::InvalidAmount);
        }
        Self::validate_bounded(destination, MAX_ID_LEN)?;

        let acct = self
            .accounts
            .get(cashtag)
            .ok_or(UsCoreError::AccountNotFound)?;
        let (next_day, next_vol) =
            Self::check_and_next_daily_volume(acct, amount_micro, now_unix_sec)?;
        if acct.balance_micro < amount_micro {
            return Err(UsCoreError::InsufficientBalance);
        }
        let next_bal = acct.balance_micro - amount_micro;

        let mut next_reserves = self.reserves;
        next_reserves.redeem_backed(asset, amount_micro)?;

        let amt_i128 = i128::from(amount_micro);
        let postings = vec![
            DoubleEntryPosting {
                account: format!("usd:{}", cashtag),
                amount_micro: amt_i128,
            },
            DoubleEntryPosting {
                account: Self::asset_account_id(asset).to_string(),
                amount_micro: -amt_i128,
            },
        ];
        let memo = format!(
            "REDEEM_1_TO_1:{}->{}:{}",
            cashtag,
            Self::asset_code(asset),
            destination
        );
        let tx = self.prepare_tx("REDEEM_1_TO_1", postings, memo)?;

        self.reserves = next_reserves;
        let acct_mut = self
            .accounts
            .get_mut(cashtag)
            .ok_or(UsCoreError::InternalInvariant)?;
        acct_mut.balance_micro = next_bal;
        acct_mut.daily_day_epoch = next_day;
        acct_mut.daily_volume_micro = next_vol;
        self.chain_head = tx.chain_trace;
        self.txs.push(tx);
        self.txs.last().ok_or(UsCoreError::InternalInvariant)
    }

    pub fn send_cashtag(
        &mut self,
        from_tag: &str,
        to_tag: &str,
        amount_micro: u64,
        memo: &str,
        now_unix_sec: u64,
    ) -> Result<&KintsugiTx, UsCoreError> {
        if amount_micro == 0 {
            return Err(UsCoreError::InvalidAmount);
        }
        if memo.len() > MAX_MEMO_LEN {
            return Err(UsCoreError::InputTooLong);
        }
        if from_tag == to_tag {
            return Err(UsCoreError::SelfTransferForbidden);
        }

        let sender = self
            .accounts
            .get(from_tag)
            .ok_or(UsCoreError::AccountNotFound)?;
        let recipient = self
            .accounts
            .get(to_tag)
            .ok_or(UsCoreError::AccountNotFound)?;

        let (next_day, next_vol) =
            Self::check_and_next_daily_volume(sender, amount_micro, now_unix_sec)?;
        if sender.balance_micro < amount_micro {
            return Err(UsCoreError::InsufficientBalance);
        }
        let next_sender_bal = sender.balance_micro - amount_micro;
        let next_recipient_bal = recipient
            .balance_micro
            .checked_add(amount_micro)
            .ok_or(UsCoreError::Overflow)?;

        let amt_i128 = i128::from(amount_micro);
        let postings = vec![
            DoubleEntryPosting {
                account: format!("usd:{}", from_tag),
                amount_micro: amt_i128,
            },
            DoubleEntryPosting {
                account: format!("usd:{}", to_tag),
                amount_micro: -amt_i128,
            },
        ];
        let full_memo = if memo.is_empty() {
            format!("P2P_ZENOTAG:{}->{}", from_tag, to_tag)
        } else {
            format!("P2P_ZENOTAG:{}->{}:{}", from_tag, to_tag, memo)
        };
        let tx = self.prepare_tx("P2P_ZENOTAG", postings, full_memo)?;

        let sender_mut = self
            .accounts
            .get_mut(from_tag)
            .ok_or(UsCoreError::InternalInvariant)?;
        sender_mut.balance_micro = next_sender_bal;
        sender_mut.daily_day_epoch = next_day;
        sender_mut.daily_volume_micro = next_vol;
        let recipient_mut = self
            .accounts
            .get_mut(to_tag)
            .ok_or(UsCoreError::InternalInvariant)?;
        recipient_mut.balance_micro = next_recipient_bal;
        self.chain_head = tx.chain_trace;
        self.txs.push(tx);
        self.txs.last().ok_or(UsCoreError::InternalInvariant)
    }

    pub fn swap_reserve_peg(
        &mut self,
        from: StableAsset,
        to: StableAsset,
        amount_micro: u64,
    ) -> Result<&KintsugiTx, UsCoreError> {
        let mut next_reserves = self.reserves;
        next_reserves.atomic_swap(from, to, amount_micro)?;

        let amt_i128 = i128::from(amount_micro);
        let postings = vec![
            DoubleEntryPosting {
                account: Self::asset_account_id(to).to_string(),
                amount_micro: amt_i128,
            },
            DoubleEntryPosting {
                account: Self::asset_account_id(from).to_string(),
                amount_micro: -amt_i128,
            },
        ];
        let memo = format!(
            "ATOMIC_PEG_SWAP_1_TO_1:{}->{}",
            Self::asset_code(from),
            Self::asset_code(to)
        );
        let tx = self.prepare_tx("ATOMIC_PEG_SWAP_1_TO_1", postings, memo)?;

        self.reserves = next_reserves;
        self.chain_head = tx.chain_trace;
        self.txs.push(tx);
        self.txs.last().ok_or(UsCoreError::InternalInvariant)
    }

    pub fn balance_micro(&self, cashtag: &str) -> Result<u64, UsCoreError> {
        self.accounts
            .get(cashtag)
            .map(|a| a.balance_micro)
            .ok_or(UsCoreError::AccountNotFound)
    }

    /// Evaluate a Foken proof-of-contribution invoice in exact `p/q` rationals with
    /// invoice replay protection and settle 1:1 `USDC` or `USDT` reserve-backed USD.
    pub fn mint_foken_backed_usd(
        &mut self,
        cashtag: &str,
        backing_asset: StableAsset,
        invoice: &FokenInvoiceInput<'_>,
        now_unix_sec: u64,
    ) -> Result<(&KintsugiTx, FokenVerdict), UsCoreError> {
        if self.seen_invoices.contains(invoice.invoice_id) {
            return Err(UsCoreError::ReplayDetected);
        }
        let verdict = evaluate_foken_gate_pq(invoice)?;
        if !verdict.passed {
            return Err(UsCoreError::FokenGateRejected(verdict.reason));
        }

        let inv_key = invoice.invoice_id.to_string();
        let _ = self.mint_from_stablecoin(
            cashtag,
            backing_asset,
            verdict.usd_equivalent_micro,
            "foken-gate",
            invoice.invoice_id,
            now_unix_sec,
        )?;
        self.seen_invoices.insert(inv_key);
        let tx_ref = self.txs.last().ok_or(UsCoreError::InternalInvariant)?;
        Ok((tx_ref, verdict))
    }

    pub fn proof_of_reserve(&self) -> Result<ReserveProofSnapshot, UsCoreError> {
        let total_reserves = self.reserves.total_reserves_micro()?;
        let coverage_ratio = self.reserves.coverage_ratio()?;
        let trit = self.reserves.verify_full_backing()?;
        let (trace, seal) = self.reserves.seal_proof_of_reserve(&self.chain_head)?;
        Ok(ReserveProofSnapshot {
            usdc_reserve_micro: self.reserves.usdc_micro,
            usdt_reserve_micro: self.reserves.usdt_micro,
            total_reserves_micro: total_reserves,
            total_liabilities_micro: self.reserves.liabilities_micro,
            coverage_ratio,
            trit,
            chain_head_trace: trace,
            wupz_seal: seal,
        })
    }

    /// Strict 3-tier Family Trust backing audit separating Tier-1 liquid USDC+USDT reserves (`1/1`)
    /// from Tier-2 off-chain FOKEN contribution weight (`0/1`) and Tier-3 Polygon PoS VAKED stamps (`0/1`).
    pub fn family_trust_backing(
        &self,
        foken_net_utility_half_hours: u64,
        foken_constellation_projects: u16,
        vaked_presence_stamps: u64,
    ) -> Result<FamilyTrustBackingSnapshot, UsCoreError> {
        Ok(FamilyTrustBackingSnapshot {
            liquid_usdc_micro: self.reserves.usdc_micro,
            liquid_usdt_micro: self.reserves.usdt_micro,
            foken_net_utility_half_hours,
            foken_constellation_projects,
            vaked_presence_stamps,
            vaked_contract: VAKED_POLYGON_ERC20,
            vaked_usd_backing_weight: Rational::ZERO,
            foken_usd_backing_weight: Rational::ZERO,
            liquid_usd_backing_weight: Rational::ONE,
        })
    }

    /// Prepare an UNSIGNED Solana SPL-USDC payout intent (`status: "UNSIGNED_AWAITING_SOLANA_SIGNER"`).
    /// Read-only preparation: never mutates ledger balances or simulates an on-chain transaction hash.
    pub fn prepare_solana_usdc_payout(
        &self,
        cashtag: &str,
        recipient_solana: &str,
        amount_micro: u64,
        memo: &str,
        now_unix_sec: u64,
    ) -> Result<SolanaUsdcPayoutIntent, UsCoreError> {
        if amount_micro == 0 {
            return Err(UsCoreError::InvalidAmount);
        }
        Self::validate_bounded(memo, MAX_MEMO_LEN)?;
        let recipient_pubkey = decode_solana_pubkey(recipient_solana)?;

        let acct = self
            .accounts
            .get(cashtag)
            .ok_or(UsCoreError::AccountNotFound)?;
        let _ = Self::check_and_next_daily_volume(acct, amount_micro, now_unix_sec)?;
        if acct.balance_micro < amount_micro {
            return Err(UsCoreError::InsufficientBalance);
        }
        if self.reserves.usdc_micro < amount_micro {
            return Err(UsCoreError::InsufficientLiquidUsdcReserve);
        }

        let amount_exact = format_micro_exact(amount_micro);
        let label_enc = url_encode_ascii("ZENO Family Trust");
        let memo_enc = url_encode_ascii(memo);
        let solana_pay_uri = format!(
            "solana:{}?amount={}&spl-token={}&label={}&memo={}",
            recipient_solana, amount_exact, SOLANA_USDC_MINT, label_enc, memo_enc
        );
        let spl_token_cli_cmd = format!(
            "spl-token transfer {} {} {} --fund-recipient --allow-unfunded-recipient",
            SOLANA_USDC_MINT, amount_exact, recipient_solana
        );

        let mut frame = Vec::new();
        frame.extend_from_slice(b"ZENO:SOLPAY:V1:");
        frame.push(KOMPRESS_GATE_0X62);
        Self::push_lp_field(&mut frame, cashtag.as_bytes())?;
        frame.extend_from_slice(&recipient_pubkey);
        frame.extend_from_slice(&amount_micro.to_be_bytes());
        Self::push_lp_field(&mut frame, SOLANA_USDC_MINT.as_bytes())?;
        Self::push_lp_field(&mut frame, memo.as_bytes())?;
        frame.extend_from_slice(&self.chain_head);
        let wupz_seal = WupzWitnessSeal::seal(&frame);

        Ok(SolanaUsdcPayoutIntent {
            status: "UNSIGNED_AWAITING_SOLANA_SIGNER",
            network: "solana-mainnet-beta",
            mint: SOLANA_USDC_MINT,
            token_program: SOLANA_TOKEN_PROGRAM,
            from_cashtag: cashtag.to_string(),
            recipient_solana: recipient_solana.to_string(),
            recipient_pubkey,
            amount_micro,
            amount_exact,
            memo: memo.to_string(),
            solana_pay_uri,
            spl_token_cli_cmd,
            wupz_seal,
        })
    }

    fn apply_revenue_charge(
        &mut self,
        cashtag: &str,
        kind: &'static str,
        fee_micro: u64,
        memo: String,
        now_unix_sec: u64,
        plan_update: Option<SubscriptionPlan>,
    ) -> Result<(RevenueSplitMicro, WupzWitnessSeal), UsCoreError> {
        let split = RevenueSplitMicro::split_sanpo_yoshi(fee_micro)?;
        let acct = self
            .accounts
            .get(cashtag)
            .ok_or(UsCoreError::AccountNotFound)?;
        let (next_day, next_vol) =
            Self::check_and_next_daily_volume(acct, fee_micro, now_unix_sec)?;
        if acct.balance_micro < fee_micro {
            return Err(UsCoreError::InsufficientBalance);
        }
        let next_bal = acct.balance_micro - fee_micro;
        let next_op = self
            .revenue_operating_micro
            .checked_add(split.operating_micro)
            .ok_or(UsCoreError::Overflow)?;
        let next_ft = self
            .revenue_family_trust_micro
            .checked_add(split.family_trust_micro)
            .ok_or(UsCoreError::Overflow)?;
        let next_fc = self
            .revenue_foken_commons_micro
            .checked_add(split.foken_commons_micro)
            .ok_or(UsCoreError::Overflow)?;

        let mut postings = vec![DoubleEntryPosting {
            account: format!("usd:{}", cashtag),
            amount_micro: i128::from(fee_micro),
        }];
        if split.operating_micro > 0 {
            postings.push(DoubleEntryPosting {
                account: "revenue:operating".to_string(),
                amount_micro: -i128::from(split.operating_micro),
            });
        }
        if split.family_trust_micro > 0 {
            postings.push(DoubleEntryPosting {
                account: "revenue:family_trust".to_string(),
                amount_micro: -i128::from(split.family_trust_micro),
            });
        }
        if split.foken_commons_micro > 0 {
            postings.push(DoubleEntryPosting {
                account: "revenue:foken_commons".to_string(),
                amount_micro: -i128::from(split.foken_commons_micro),
            });
        }

        let tx = self.prepare_tx(kind, postings, memo)?;
        let seal = tx.seal;

        let acct_mut = self
            .accounts
            .get_mut(cashtag)
            .ok_or(UsCoreError::InternalInvariant)?;
        acct_mut.balance_micro = next_bal;
        acct_mut.daily_day_epoch = next_day;
        acct_mut.daily_volume_micro = next_vol;
        self.revenue_operating_micro = next_op;
        self.revenue_family_trust_micro = next_ft;
        self.revenue_foken_commons_micro = next_fc;
        if let Some(p) = plan_update {
            self.account_plans.insert(cashtag.to_string(), p);
        }
        self.chain_head = tx.chain_trace;
        self.txs.push(tx);
        Ok((split, seal))
    }

    pub fn plan_for(&self, cashtag: &str) -> SubscriptionPlan {
        self.account_plans
            .get(cashtag)
            .copied()
            .unwrap_or(SubscriptionPlan::Free)
    }

    pub fn revenue_totals_micro(&self) -> (u64, u64, u64) {
        (
            self.revenue_operating_micro,
            self.revenue_family_trust_micro,
            self.revenue_foken_commons_micro,
        )
    }

    /// Subscribe `$cashtag` to a ZENO tier and settle any monthly fee via zero-sum Sanpo Yoshi split.
    pub fn subscribe_plan(
        &mut self,
        cashtag: &str,
        plan: SubscriptionPlan,
        now_unix_sec: u64,
    ) -> Result<MonetizationReceipt, UsCoreError> {
        if !self.accounts.contains_key(cashtag) {
            return Err(UsCoreError::AccountNotFound);
        }
        let fee_micro = plan.monthly_fee_micro();
        if fee_micro == 0 {
            self.account_plans.insert(cashtag.to_string(), plan);
            let split = RevenueSplitMicro::split_sanpo_yoshi(0)?;
            let seal = WupzWitnessSeal::seal(b"ZENO:SUB:FREE:0x62");
            return Ok(MonetizationReceipt {
                plan,
                fee_micro: 0,
                split,
                wupz_seal: seal,
            });
        }
        let memo = format!("SUBSCRIPTION:{}:{}", plan.code(), cashtag);
        let (split, wupz_seal) = self.apply_revenue_charge(
            cashtag,
            "SUBSCRIPTION_BILLING",
            fee_micro,
            memo,
            now_unix_sec,
            Some(plan),
        )?;
        Ok(MonetizationReceipt {
            plan,
            fee_micro,
            split,
            wupz_seal,
        })
    }

    /// Bill automated trading ticks, cross-chain bridge bps, API overage, or disposable cards
    /// using integer micro-USD arithmetic and strict Sanpo Yoshi 50/30/20 allocation.
    pub fn bill_metered_usage(
        &mut self,
        cashtag: &str,
        kind: UsageMeterKind,
        units: u64,
        notional_micro: u64,
        now_unix_sec: u64,
    ) -> Result<MonetizationReceipt, UsCoreError> {
        if units == 0 {
            return Err(UsCoreError::ZeroUsageUnits);
        }
        if !self.accounts.contains_key(cashtag) {
            return Err(UsCoreError::AccountNotFound);
        }
        let plan = self.plan_for(cashtag);
        let base_fee: u64 = match kind {
            UsageMeterKind::ApiCallOverage => units.checked_mul(500).ok_or(UsCoreError::Overflow)?,
            UsageMeterKind::AutoTradeTick => {
                let tick_fee = units.checked_mul(10_000).ok_or(UsCoreError::Overflow)?;
                let bps_fee = u64::try_from(
                    u128::from(notional_micro) * u128::from(plan.auto_trade_fee_bps()) / 10_000,
                )
                .map_err(|_| UsCoreError::Overflow)?;
                tick_fee.checked_add(bps_fee).ok_or(UsCoreError::Overflow)?
            }
            UsageMeterKind::CrossChainBridge => {
                let bps_fee = u64::try_from(
                    u128::from(notional_micro) * u128::from(plan.bridge_fee_bps()) / 10_000,
                )
                .map_err(|_| UsCoreError::Overflow)?;
                let min_fee = units.checked_mul(50_000).ok_or(UsCoreError::Overflow)?;
                if bps_fee > min_fee { bps_fee } else { min_fee }
            }
            UsageMeterKind::DisposableCardMint => {
                units.checked_mul(250_000).ok_or(UsCoreError::Overflow)?
            }
        };
        if base_fee == 0 {
            return Err(UsCoreError::InvalidAmount);
        }
        let memo = format!("USAGE:{}:{}:units={}", kind.code(), plan.code(), units);
        let (split, wupz_seal) = self.apply_revenue_charge(
            cashtag,
            "METERED_USAGE_FEE",
            base_fee,
            memo,
            now_unix_sec,
            None,
        )?;
        Ok(MonetizationReceipt {
            plan,
            fee_micro: base_fee,
            split,
            wupz_seal,
        })
    }

    pub fn verify_invariants(&self) -> bool {
        let mut expected_prev = [0u8; 32];
        for tx in &self.txs {
            let sum = tx
                .postings
                .iter()
                .try_fold(0i128, |acc, p| acc.checked_add(p.amount_micro));
            if sum != Some(0) {
                return false;
            }
            let mut frame = Vec::new();
            frame.extend_from_slice(b"ZENO:TX:V1:");
            frame.push(KOMPRESS_GATE_0X62);
            frame.extend_from_slice(&tx.seq.to_be_bytes());
            if Self::push_lp_field(&mut frame, tx.kind.as_bytes()).is_err()
                || Self::push_lp_field(&mut frame, tx.memo.as_bytes()).is_err()
            {
                return false;
            }
            let Ok(cnt) = u32::try_from(tx.postings.len()) else {
                return false;
            };
            frame.extend_from_slice(&cnt.to_be_bytes());
            for p in &tx.postings {
                if Self::push_lp_field(&mut frame, p.account.as_bytes()).is_err() {
                    return false;
                }
                frame.extend_from_slice(&p.amount_micro.to_be_bytes());
            }
            let expected_seal = WupzWitnessSeal::seal(&frame);
            if tx.seal != expected_seal {
                return false;
            }
            let expected_trace = kintsugi_trace_chain(&expected_prev, &expected_seal.bytes);
            if tx.chain_trace != expected_trace {
                return false;
            }
            expected_prev = tx.chain_trace;
        }
        let mut total_balances: u64 = 0;
        for acct in self.accounts.values() {
            match total_balances.checked_add(acct.balance_micro) {
                Some(v) => total_balances = v,
                None => return false,
            }
        }
        for rev in [
            self.revenue_operating_micro,
            self.revenue_family_trust_micro,
            self.revenue_foken_commons_micro,
        ] {
            match total_balances.checked_add(rev) {
                Some(v) => total_balances = v,
                None => return false,
            }
        }
        if total_balances != self.reserves.liabilities_micro {
            return false;
        }
        matches!(self.reserves.verify_full_backing(), Ok(trit) if trit >= 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY_1_SEC: u64 = 1_764_000_000;
    const VALID_PROV: &str =
        "sha256://0abcabf86830af11bb5e8cd74dc9c9d00abcabf86830af11bb5e8cd74dc9c9d0";
    const VALID_SIG: &str = "0x4f8a3c9b71c8364f3b8844";

    #[test]
    fn rust_us_core_enforces_usdc_usdt_1_to_1_zero_float_pq() {
        let mut core = UsNeoBankCore::new();
        core.open_us_account("$alice", "04aabbccdd", "salt_a", PrivacyTier::VerifiedUs)
            .unwrap();
        core.open_us_account("$bob", "04eeff0011", "salt_b", PrivacyTier::SovereignLite)
            .unwrap();

        core.mint_from_stablecoin(
            "$alice",
            StableAsset::Usdc,
            1_500 * MICRO_USD,
            "base",
            "0x1",
            DAY_1_SEC,
        )
        .unwrap();
        core.mint_from_stablecoin(
            "$bob",
            StableAsset::Usdt,
            500 * MICRO_USD,
            "solana",
            "0x2",
            DAY_1_SEC + 1,
        )
        .unwrap();

        core.send_cashtag("$alice", "$bob", 300 * MICRO_USD, "coffee", DAY_1_SEC + 2)
            .unwrap();
        assert_eq!(core.balance_micro("$alice").unwrap(), 1_200 * MICRO_USD);
        assert_eq!(core.balance_micro("$bob").unwrap(), 800 * MICRO_USD);

        core.swap_reserve_peg(StableAsset::Usdc, StableAsset::Usdt, 400 * MICRO_USD)
            .unwrap();
        core.redeem_to_stablecoin(
            "$alice",
            StableAsset::Usdc,
            200 * MICRO_USD,
            "0xDest",
            DAY_1_SEC + 3,
        )
        .unwrap();

        let por = core.proof_of_reserve().unwrap();
        assert_eq!(por.usdc_reserve_micro, 900 * MICRO_USD);
        assert_eq!(por.usdt_reserve_micro, 900 * MICRO_USD);
        assert_eq!(por.total_reserves_micro, 1_800 * MICRO_USD);
        assert_eq!(por.total_liabilities_micro, 1_800 * MICRO_USD);
        assert_eq!(por.coverage_ratio, Rational::ONE);
        assert_eq!(por.trit, 0);
        assert!(core.verify_invariants());

        let json = por.to_compact_json();
        assert!(json.contains("\"coverageRatioPQ\":\"1/1\""));
        assert!(json.contains("\"gate\":\"0x62\""));
    }

    #[test]
    fn rust_us_core_blocks_replay_split_tx_daily_cap_and_oversized_inputs() {
        let mut core = UsNeoBankCore::new();
        core.open_us_account("$lite", "04aabbccdd", "salt_l", PrivacyTier::SovereignLite)
            .unwrap();
        core.open_us_account("$peer", "04eeff0011", "salt_p", PrivacyTier::VerifiedUs)
            .unwrap();

        // Duplicate (chain, tx_hash) replay blocked
        core.mint_from_stablecoin(
            "$lite",
            StableAsset::Usdc,
            1_000 * MICRO_USD,
            "base",
            "0xtx1",
            DAY_1_SEC,
        )
        .unwrap();
        assert_eq!(
            core.mint_from_stablecoin(
                "$lite",
                StableAsset::Usdc,
                1_000 * MICRO_USD,
                "base",
                "0xtx1",
                DAY_1_SEC + 1,
            ),
            Err(UsCoreError::ReplayDetected)
        );

        // Split-tx daily cap enforcement: SovereignLite daily cap is $3,000
        core.mint_from_stablecoin(
            "$lite",
            StableAsset::Usdc,
            1_000 * MICRO_USD,
            "base",
            "0xtx2",
            DAY_1_SEC + 2,
        )
        .unwrap();
        core.mint_from_stablecoin(
            "$lite",
            StableAsset::Usdc,
            1_000 * MICRO_USD,
            "base",
            "0xtx3",
            DAY_1_SEC + 3,
        )
        .unwrap();
        assert_eq!(
            core.mint_from_stablecoin(
                "$lite",
                StableAsset::Usdc,
                1_000 * MICRO_USD,
                "base",
                "0xtx4",
                DAY_1_SEC + 4,
            ),
            Err(UsCoreError::ExceedsDailyCap)
        );

        // Next UTC day allows fresh daily volume
        core.send_cashtag(
            "$lite",
            "$peer",
            500 * MICRO_USD,
            "day2",
            DAY_1_SEC + SECONDS_PER_DAY,
        )
        .unwrap();

        // Oversized memo rejected
        let huge_memo = "x".repeat(MAX_MEMO_LEN + 1);
        assert_eq!(
            core.send_cashtag("$lite", "$peer", 10 * MICRO_USD, &huge_memo, DAY_1_SEC + SECONDS_PER_DAY),
            Err(UsCoreError::InputTooLong)
        );
        assert!(core.verify_invariants());
    }

    #[test]
    fn rust_us_core_domain_separates_identity_commitments_and_verifies_tx_seals() {
        let mut c1 = UsNeoBankCore::new();
        let a1 = c1
            .open_us_account("$bob", "aabb", "cc:dd", PrivacyTier::SovereignLite)
            .unwrap()
            .identity_commitment;

        let mut c2 = UsNeoBankCore::new();
        let a2 = c2
            .open_us_account("$bob", "aabbcc", "dd", PrivacyTier::SovereignLite)
            .unwrap()
            .identity_commitment;
        assert_ne!(a1, a2);

        // Tampering with posting amount breaks verify_invariants()
        c1.mint_from_stablecoin("$bob", StableAsset::Usdc, 100 * MICRO_USD, "base", "0x1", DAY_1_SEC)
            .unwrap();
        assert!(c1.verify_invariants());
        c1.txs[0].postings[0].amount_micro = 999 * MICRO_USD as i128;
        c1.txs[0].postings[1].amount_micro = -(999 * MICRO_USD as i128);
        assert!(!c1.verify_invariants());
    }

    #[test]
    fn rust_us_core_exact_pq_fx_quotes_zero_float() {
        let jpy = convert_fx(100 * MICRO_USD, FxCurrency::Jpy).unwrap();
        assert_eq!(jpy.rate, Rational::new(305, 2).unwrap());
        assert_eq!(jpy.amount_micro_out, 15_250 * MICRO_USD);
        assert_eq!(jpy.fee_bps, 0);

        let eur = convert_fx(100 * MICRO_USD, FxCurrency::Eur).unwrap();
        assert_eq!(eur.rate, Rational::new(23, 25).unwrap());
        assert_eq!(eur.amount_micro_out, 92 * MICRO_USD);

        // Rounding to 0 must be rejected rather than silently returning 0
        assert_eq!(
            convert_fx(1, FxCurrency::Eur),
            Err(UsCoreError::InvalidAmount)
        );
    }

    #[test]
    fn rust_us_core_foken_gate_pq_mints_1_to_1_and_blocks_replay_and_overclaim() {
        let mut core = UsNeoBankCore::new();
        core.open_us_account("$omni", "04aabbccdd", "salt_omni", PrivacyTier::VerifiedUs)
            .unwrap();

        let valid = FokenInvoiceInput {
            invoice_id: "01933b70-9831-7bc8-8123-018b1509a001",
            contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
            provenance_hash: VALID_PROV,
            self_assessed_fokens: 400,
            ip_statement: "IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
            ip_signature: VALID_SIG,
            net_utility: FokenNetUtility {
                future_work_avoided_hours: 120,
                work_added_hours: 10,
                maintenance_debt_hours: 2,
            },
        };

        let (_tx, verdict) = core
            .mint_foken_backed_usd("$omni", StableAsset::Usdc, &valid, DAY_1_SEC)
            .unwrap();
        assert!(verdict.passed);
        assert_eq!(verdict.net_utility_pq, Rational::new(107, 1).unwrap());
        assert_eq!(verdict.usd_equivalent_micro, 400 * MICRO_USD);
        assert!(core.verify_invariants());

        // Invoice replay rejected
        assert_eq!(
            core.mint_foken_backed_usd("$omni", StableAsset::Usdc, &valid, DAY_1_SEC + 1),
            Err(UsCoreError::ReplayDetected)
        );

        // Overclaiming FOKEN on 1h net utility (> 100 FKN/hr) rejected
        let overclaim = FokenInvoiceInput {
            invoice_id: "01933b70-overclaim",
            self_assessed_fokens: 500,
            net_utility: FokenNetUtility {
                future_work_avoided_hours: 1,
                work_added_hours: 0,
                maintenance_debt_hours: 0,
            },
            ..valid
        };
        assert_eq!(
            core.mint_foken_backed_usd("$omni", StableAsset::Usdt, &overclaim, DAY_1_SEC + 2),
            Err(UsCoreError::FokenGateRejected("EXCEEDS_NET_UTILITY_VALUATION_CAP"))
        );

        // Short provenance hash rejected
        let bad_prov = FokenInvoiceInput {
            invoice_id: "01933b70-badprov",
            provenance_hash: "sha256://short",
            ..valid
        };
        assert_eq!(
            core.mint_foken_backed_usd("$omni", StableAsset::Usdt, &bad_prov, DAY_1_SEC + 3),
            Err(UsCoreError::FokenGateRejected("INVALID_PROVENANCE_HEX"))
        );
    }

    #[test]
    fn rust_us_core_validates_solana_base58_and_builds_unsigned_200_usdc_payout_intent() {
        let user_coinbase = "HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS";
        let pk = decode_solana_pubkey(user_coinbase).unwrap();
        assert_eq!(pk[0..4], [0xf9, 0xdf, 0xbe, 0x49]);
        assert!(decode_solana_pubkey(SOLANA_USDC_MINT).is_ok());
        assert!(decode_solana_pubkey(SOLANA_USDT_MINT).is_ok());
        assert_eq!(decode_solana_pubkey("0OIl"), Err(UsCoreError::InvalidSolanaAddress));
        assert_eq!(
            decode_solana_pubkey("11111111111111111111111111111111"),
            Err(UsCoreError::InvalidSolanaAddress)
        );
        assert_eq!(
            decode_solana_pubkey("too_short_solana_addr"),
            Err(UsCoreError::InvalidSolanaAddress)
        );

        let mut core = UsNeoBankCore::new();
        core.open_us_account("$peter", "04aabbccdd", "salt_peter", PrivacyTier::VerifiedUs)
            .unwrap();
        core.mint_from_stablecoin(
            "$peter",
            StableAsset::Usdc,
            500 * MICRO_USD,
            "solana",
            "5SolanaFundedCustodyDeposit1111",
            DAY_1_SEC,
        )
        .unwrap();

        let trust = core.family_trust_backing(4812, 19, 37).unwrap();
        assert_eq!(trust.liquid_usdc_micro, 500 * MICRO_USD);
        assert_eq!(trust.liquid_usd_backing_weight, Rational::ONE);
        assert_eq!(trust.foken_usd_backing_weight, Rational::ZERO);
        assert_eq!(trust.vaked_usd_backing_weight, Rational::ZERO);
        assert_eq!(trust.vaked_contract, VAKED_POLYGON_ERC20);

        let intent = core
            .prepare_solana_usdc_payout(
                "$peter",
                user_coinbase,
                200 * MICRO_USD,
                "ZENO Family Trust Test 1",
                DAY_1_SEC + 1,
            )
            .unwrap();
        assert_eq!(intent.status, "UNSIGNED_AWAITING_SOLANA_SIGNER");
        assert_eq!(intent.mint, SOLANA_USDC_MINT);
        assert_eq!(intent.amount_micro, 200 * MICRO_USD);
        assert_eq!(intent.amount_exact, "200");
        assert!(intent.solana_pay_uri.starts_with(
            "solana:HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS?amount=200&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        ));
        assert!(intent.spl_token_cli_cmd.contains("200 HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS"));
        let json = intent.to_compact_json();
        assert!(json.contains("\"status\":\"UNSIGNED_AWAITING_SOLANA_SIGNER\""));

        // Intent preparation is read-only; no fake debit until real on-chain settlement
        assert_eq!(core.balance_micro("$peter").unwrap(), 500 * MICRO_USD);
        assert!(core.verify_invariants());

        // Insufficient liquid USDC blocks payout
        assert_eq!(
            core.prepare_solana_usdc_payout(
                "$peter",
                user_coinbase,
                600 * MICRO_USD,
                "too much",
                DAY_1_SEC + 2,
            ),
            Err(UsCoreError::InsufficientBalance)
        );
    }

    #[test]
    fn fuzz_solana_base58_and_us_core_state_machine_invariants() {
        fn next_u64(state: &mut u64) -> u64 {
            *state ^= *state >> 12;
            *state ^= *state << 25;
            *state ^= *state >> 27;
            state.wrapping_mul(0x2545_f491_4f6c_dd1d)
        }

        let mut rng: u64 = 0x8b15_2026_u64 << 16 | 0x0062;
        let user_coinbase = "HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS";

        // 1) Base58 fuzz (2,000 iterations)
        for i in 0..2000u64 {
            let len = (next_u64(&mut rng) % 65) as usize;
            let mut s = String::with_capacity(len);
            for _ in 0..len {
                if i % 9 == 0 {
                    s.push('1');
                } else if i % 11 == 0 {
                    s.push('z');
                } else if i % 13 == 0 {
                    let ascii = b' ' + (next_u64(&mut rng) % 95) as u8;
                    s.push(ascii as char);
                } else {
                    let idx = (next_u64(&mut rng) % 58) as usize;
                    s.push(BASE58_ALPHABET[idx] as char);
                }
            }
            match decode_solana_pubkey(&s) {
                Ok(pk) => {
                    assert!(s.len() >= 32 && s.len() <= 44);
                    assert!(pk.iter().any(|&b| b != 0));
                }
                Err(UsCoreError::InvalidSolanaAddress) => {}
                Err(other) => panic!("Unexpected error variant from Base58 fuzz: {:?}", other),
            }
        }

        // 2) Stateful ledger + FOKEN + Solana payout fuzz (500 operations)
        let mut core = UsNeoBankCore::new();
        let tags = ["$alice", "$bob", "$peter", "$omni"];
        let tiers = [
            PrivacyTier::SovereignLite,
            PrivacyTier::VerifiedUs,
            PrivacyTier::Institutional,
            PrivacyTier::VerifiedUs,
        ];
        for (tag, tier) in tags.iter().zip(tiers.iter()) {
            core.open_us_account(tag, "04aabbccdd", "salt_fuzz", *tier).unwrap();
        }

        let mut sec = DAY_1_SEC;
        for step in 0..500u64 {
            if step % 25 == 0 {
                sec += SECONDS_PER_DAY;
            }
            let op = next_u64(&mut rng) % 7;
            let t1 = tags[(next_u64(&mut rng) % 4) as usize];
            let t2 = tags[(next_u64(&mut rng) % 4) as usize];
            let asset = if next_u64(&mut rng) % 2 == 0 {
                StableAsset::Usdc
            } else {
                StableAsset::Usdt
            };
            let amt = (next_u64(&mut rng) % 5_000 + 1) * (MICRO_USD / 10);

            match op {
                0 => {
                    let chain = if next_u64(&mut rng) % 2 == 0 { "solana" } else { "base" };
                    let tx_id = format!("tx_{}", step % 150); // triggers replays intentionally
                    let _ = core.mint_from_stablecoin(t1, asset, amt, chain, &tx_id, sec);
                }
                1 => {
                    let _ = core.send_cashtag(t1, t2, amt, "fuzz", sec);
                }
                2 => {
                    let other = if asset == StableAsset::Usdc {
                        StableAsset::Usdt
                    } else {
                        StableAsset::Usdc
                    };
                    let _ = core.swap_reserve_peg(asset, other, amt);
                }
                3 => {
                    let _ = core.redeem_to_stablecoin(t1, asset, amt, user_coinbase, sec);
                }
                4 => {
                    let inv_id = format!("inv_{}", step % 120); // triggers replay intentionally
                    let avoided = next_u64(&mut rng) % 250;
                    let added = next_u64(&mut rng) % 60;
                    let debt = next_u64(&mut rng) % 30;
                    let fokens = (next_u64(&mut rng) % 800) + 1;
                    let inv = FokenInvoiceInput {
                        invoice_id: &inv_id,
                        contributor: "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
                        provenance_hash: VALID_PROV,
                        self_assessed_fokens: fokens,
                        ip_statement: "IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
                        ip_signature: VALID_SIG,
                        net_utility: FokenNetUtility {
                            future_work_avoided_hours: avoided,
                            work_added_hours: added,
                            maintenance_debt_hours: debt,
                        },
                    };
                    let _ = core.mint_foken_backed_usd(t1, asset, &inv, sec);
                }
                5 => {
                    let pay_amt = if step % 2 == 0 { 5 * MICRO_USD } else { 200 * MICRO_USD };
                    let _ = core.prepare_solana_usdc_payout(t1, user_coinbase, pay_amt, "test", sec);
                }
                _ => {
                    let _ = core.prepare_solana_usdc_payout(t1, "bad_addr", 5 * MICRO_USD, "bad", sec);
                }
            }

            assert!(core.verify_invariants(), "Invariant failed at step {}", step);
            let por = core.proof_of_reserve().unwrap();
            assert!(por.coverage_ratio >= Rational::ONE);
        }
    }

    #[test]
    fn rust_us_core_multinetwork_and_monetization_sanpo_yoshi_split() {
        let coinbase_sol = "HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS";
        let evm_addr = "0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940";
        let tron_addr = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

        for net in [
            StableNetwork::Base,
            StableNetwork::Ethereum,
            StableNetwork::Arbitrum,
            StableNetwork::Polygon,
            StableNetwork::Optimism,
        ] {
            assert!(validate_network_address(net, StableAsset::Usdc, evm_addr).is_ok());
            assert!(validate_network_address(net, StableAsset::Usdt, evm_addr).is_ok());
            assert!(net.chain_id().is_some());
        }
        assert!(validate_network_address(StableNetwork::Solana, StableAsset::Usdc, coinbase_sol).is_ok());
        assert!(validate_network_address(StableNetwork::Solana, StableAsset::Usdt, coinbase_sol).is_ok());
        assert!(validate_network_address(StableNetwork::Tron, StableAsset::Usdt, tron_addr).is_ok());
        assert_eq!(
            validate_network_address(StableNetwork::Tron, StableAsset::Usdc, tron_addr),
            Err(UsCoreError::UnsupportedNetworkAsset)
        );
        assert_eq!(
            validate_network_address(StableNetwork::Base, StableAsset::Usdc, "0x0000000000000000000000000000000000000000"),
            Err(UsCoreError::InvalidNetworkAddress)
        );

        let mut core = UsNeoBankCore::new();
        core.open_us_account("$quant", "04aabbccdd", "salt_q", PrivacyTier::VerifiedUs)
            .unwrap();
        core.mint_from_stablecoin(
            "$quant",
            StableAsset::Usdc,
            1_000 * MICRO_USD,
            "base",
            "0xdeposit_quant_1",
            DAY_1_SEC,
        )
        .unwrap();

        // Subscribe to UltraQuant ($49.00/mo) -> 10 bps auto trade fee
        let sub = core
            .subscribe_plan("$quant", SubscriptionPlan::UltraQuant, DAY_1_SEC + 1)
            .unwrap();
        assert_eq!(sub.fee_micro, 49_000_000);
        assert_eq!(sub.split.family_trust_micro, 14_700_000); // 30%
        assert_eq!(sub.split.foken_commons_micro, 9_800_000); // 20%
        assert_eq!(sub.split.operating_micro, 24_500_000);    // 50%

        // Bill 5 auto-trade ticks on $2,000 notional: 5 * $0.01 ($0.05) + 10 bps * $2,000 ($2.00) = $2.05
        let usage = core
            .bill_metered_usage(
                "$quant",
                UsageMeterKind::AutoTradeTick,
                5,
                2_000 * MICRO_USD,
                DAY_1_SEC + 2,
            )
            .unwrap();
        assert_eq!(usage.fee_micro, 2_050_000);
        assert_eq!(
            usage.split.operating_micro
                + usage.split.family_trust_micro
                + usage.split.foken_commons_micro,
            usage.fee_micro
        );
        let (op, ft, fc) = core.revenue_totals_micro();
        assert_eq!(op + ft + fc, 51_050_000);
        assert_eq!(core.balance_micro("$quant").unwrap(), 948_950_000);
        assert!(core.verify_invariants());
    }
}
