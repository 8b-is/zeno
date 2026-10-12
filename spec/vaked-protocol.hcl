# ==============================================================================
# VAKED Sovereign Protocol Specification (HCL / HashiCorp Configuration)
# Version: 1.2.0
# Maintainer: 8b-is Family Research Company <3
# Roots: 銭 (Zeni) · 禅 (Zen) · 善 (Sanpo Yoshi) · 金継ぎ (Kintsugi) · 間 (Ma)
# Security Review: PASS (HSTS Preload, Strict Headers, Merkle SHA-256)
# ==============================================================================

protocol "vaked" {
  version     = "1.2.0"
  status      = "ACTIVE_SOVEREIGN"
  network_id  = "vaked-mainnet"
  spec_rfc    = "RFC-001-KINTSUGI"
  description = "Continuous-time micro-streaming neo-bank with proof-of-contribution valuation gate and autonomous agent accounts."

  constellation {
    hub         = "https://koan.vaked.dev/"
    stipple     = "https://weave.vaked.dev/"
    visuals     = "https://art.vaked.dev/"
    audio_lane  = "https://music.vaked.dev/"
    proposals   = "https://proposal.vaked.dev/"
    journal     = "https://pocoo.vaked.dev/"
    bank        = "https://zeno.vaked.dev/"
    frequency   = "432Hz"
  }
}

governance "8b_is" {
  entity_type       = "Family Research Company"
  creators          = "https://8b.is"
  crew              = ["Hue", "Aye", "Taisha", "Omni"]
  family            = ["Alexandra", "Chris"]
  mission           = "Autonomous multi-reasoner development, high-frequency human & agentic coordination, and sovereign financial infrastructure."
  stewards          = "8b-is Crew: Hue, Aye, Taisha, Omni"
  guild_id          = "cnt_0x71c8"
  treasury_anchor   = "https://8b.is"
}

ledger "kintsugi" {
  hash_algorithm      = "SHA-256"
  accounting_paradigm = "DOUBLE_ENTRY_APPEND_ONLY"
  merkle_roots        = true
  golden_witness      = true
  immutable_history   = true

  rule "sanpo_yoshi" {
    description = "三方よし (Good for seller, good for buyer, good for society)"
    enforce_treasury_dividend = true
  }

  rule "no_debt_minting" {
    description = "Liquidity emerges strictly from fiat backing or verified Foken proof-of-contribution."
    allow_fractional_reserve = false
  }
}

transit "felica_nfc_f" {
  standard            = "JIS X 6319-4"
  frequency_hz        = 13560000 # 13.56 MHz
  settlement_time_sec = 0.10     # 100ms ticket gate clearance
  
  card "momo_pasmo" {
    service_code = "0x008B"
    color_hex    = "#EA5582"
    cashback_pct = 3.0
  }

  card "mobile_suica" {
    service_code = "0x0099"
    color_hex    = "#009944"
    cashback_pct = 3.0
  }

  audio_chime {
    primary_freq_hz   = 1760.0 # A6
    secondary_freq_hz = 2349.3 # D7
    waveform          = "sine"
  }
}

settlement "revolut_ultra" {
  tier               = "PLATINUM_SOVEREIGN"
  card_weight_grams  = 22.5
  fx_markup_pct      = 0.0 # 0% Interbank exchange
  supported_pairs    = ["HUF/JPY", "EUR/JPY", "USD/JPY", "HUF/EUR"]
  
  privileges {
    airport_lounges    = "DragonPass / LoungeKey 1,400+ worldwide"
    medical_cover_eur  = 10000000
    wework_coworking   = "Tokyo Shibuya Scramble Square & Roppongi"
    financial_times    = "FT.com Premium Digital + Nikkei Asia"
    vpn_mesh           = "NordVPN Complete Encrypted Transit"
    fitness_credits    = "ClassPass Tokyo Boutique & Recovery"
  }

  cashback {
    worldwide_base_pct = 1.2
    tokyo_transit_pct  = 3.0
    auto_compound      = true
    compound_target    = "cnt_0x71c8"
  }
}

security_review "sec_review_v1_1" {
  auditor            = "8b-is Security Sentinel"
  timestamp          = "2026-10-12T12:40:00Z"
  status             = "VERIFIED_PASS"
  
  headers {
    hsts               = "max-age=31536000; includeSubDomains; preload"
    x_content_type     = "nosniff"
    referrer_policy    = "strict-origin-when-cross-origin"
    permissions_policy = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  }

  dns_resolution {
    dnssec_enabled     = true
    cloudflare_proxied = true
    tls_version        = "TLSv1.3"
    cipher_suite       = "AEAD-CHACHA20-POLY1305-SHA256"
  }
}
