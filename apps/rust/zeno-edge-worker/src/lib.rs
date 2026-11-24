//! Cloudflare Workers Rust (`workers-rs 0.9`) Edge Worker backed directly by
//! `#![no_std]`, `#![forbid(unsafe_code)]`, zero-float `zeno-us-core` and `zeno-issuer-angel`.

pub mod api {
    use serde::Deserialize;
    use serde_json::{json, Value};
    use zeno_issuer_angel::StableAsset;
    use zeno_us_core::{
        decode_solana_pubkey, evaluate_foken_gate_pq, FokenInvoiceInput, FokenNetUtility,
        PrivacyTier, RevenueSplitMicro, StableNetwork, SubscriptionPlan, UsNeoBankCore,
        FINCEN_CTR_THRESHOLD_MICRO, FINCEN_TRAVEL_RULE_MICRO, MICRO_USD,
    };

    const SEED_USDC_MICRO: u64 = 31_240_500_000;
    const SEED_USDT_MICRO: u64 = 20_800_000_000;
    const SEED_PUBKEY_HEX: &str =
        "0471c8364f3b8844892cfa7d2fa9f430589acee94071c8364f3b8844892cfa7d2f";

    pub fn seeded_core() -> Option<UsNeoBankCore> {
        let mut core = UsNeoBankCore::new();
        core.open_us_account("$you", SEED_PUBKEY_HEX, "zeno-rust-edge-seed", PrivacyTier::Institutional)
            .ok()?;
        core.mint_from_stablecoin("$you", StableAsset::Usdc, SEED_USDC_MICRO, "base", "0xseed_usdc", 1_764_000_000)
            .ok()?;
        core.mint_from_stablecoin("$you", StableAsset::Usdt, SEED_USDT_MICRO, "solana", "0xseed_usdt", 1_764_000_001)
            .ok()?;
        Some(core)
    }

    pub fn health_json() -> Value {
        json!({
            "status": "online",
            "surface": "ZENO US Rust Edge Worker",
            "runtime": "cloudflare-workers-rs-0.9",
            "version": "1.13.0",
            "zeroFloatPQ": true,
            "pythonAllowed": false,
            "backendCrate": "apps/rust/zeno-us-core",
            "uiWasmSurface": "https://zeno.vaked.dev/us-rust",
        })
    }

    pub fn architecture_json() -> Value {
        json!({
            "surface": "ZENO US Rust Edge Worker",
            "jurisdiction": "US-first",
            "runtime": "workers-rs-wasm32",
            "coreCrate": "apps/rust/zeno-us-core",
            "coreForbidsUnsafe": true,
            "zeroFloatPQ": true,
            "pythonAllowed": false,
            "endpoints": [
                "/healthz",
                "/api/us/architecture",
                "/api/us/reserve-proof",
                "/api/us/networks",
                "/api/us/pricing",
                "/api/us/compliance",
                "/api/us/solana-validate",
                "/api/us/foken"
            ],
        })
    }

    pub fn reserve_proof_json() -> Value {
        let Some(core) = seeded_core() else {
            return json!({ "error": "seed_invariant_failure" });
        };
        let Ok(snap) = core.proof_of_reserve() else {
            return json!({ "error": "por_failure" });
        };
        let chain_head_hex: String = snap
            .chain_head_trace
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        let wupz_seal_hex: String = snap
            .wupz_seal
            .bytes
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        json!({
            "asset": "USD",
            "backing": ["USDC", "USDT"],
            "usdcReserveMicro": snap.usdc_reserve_micro,
            "usdtReserveMicro": snap.usdt_reserve_micro,
            "totalReservesMicro": snap.total_reserves_micro,
            "totalLiabilitiesMicro": snap.total_liabilities_micro,
            "coverageRatioPQ": format!("{}/{}", snap.coverage_ratio.numerator(), snap.coverage_ratio.denominator()),
            "trit": snap.trit,
            "gate": "0x62",
            "chainHeadTrace": chain_head_hex,
            "wupzSealHex": wupz_seal_hex,
            "isSimulatedGenesisSeed": true,
            "mode": "simulated_local_por_until_us_custody_live",
        })
    }

    pub fn networks_json() -> Value {
        let nets = [
            (StableNetwork::Solana, "Solana Mainnet", Some("mainnet-beta")),
            (StableNetwork::Base, "Base L2", None),
            (StableNetwork::Ethereum, "Ethereum L1", None),
            (StableNetwork::Arbitrum, "Arbitrum One", None),
            (StableNetwork::Polygon, "Polygon PoS", None),
            (StableNetwork::Optimism, "OP Mainnet", None),
            (StableNetwork::Tron, "Tron TRC-20", Some("tron-mainnet")),
        ];
        let items: Vec<Value> = nets
            .into_iter()
            .map(|(n, name, str_id)| {
                let chain_id: Value = match str_id {
                    Some(s) => Value::String(s.to_string()),
                    None => n.chain_id().map(Value::from).unwrap_or(Value::Null),
                };
                json!({
                    "id": n.code(),
                    "name": name,
                    "chainId": chain_id,
                    "usdcContract": n.contract_address(StableAsset::Usdc),
                    "usdtContract": n.contract_address(StableAsset::Usdt),
                })
            })
            .collect();
        json!({
            "assetBacking": ["USDC", "USDT"],
            "count": items.len(),
            "networks": items,
        })
    }

    pub fn pricing_json() -> Value {
        let plans = [
            (SubscriptionPlan::Free, "Free"),
            (SubscriptionPlan::Plus, "ZENO Plus"),
            (SubscriptionPlan::UltraQuant, "ZENO Ultra Quant"),
            (SubscriptionPlan::Institutional, "Institutional"),
        ];
        let plan_docs: Vec<Value> = plans
            .into_iter()
            .map(|(p, label)| {
                let split = RevenueSplitMicro::split_sanpo_yoshi(p.monthly_fee_micro())
                    .unwrap_or(RevenueSplitMicro {
                        total_micro: 0,
                        operating_micro: 0,
                        family_trust_micro: 0,
                        foken_commons_micro: 0,
                    });
                json!({
                    "id": p.code(),
                    "name": label,
                    "monthlyFeeMicro": p.monthly_fee_micro(),
                    "autoTradeBps": p.auto_trade_fee_bps(),
                    "bridgeBps": p.bridge_fee_bps(),
                    "includedApiCalls": p.included_api_calls(),
                    "sanpoYoshiSplitMicro": {
                        "operating": split.operating_micro,
                        "familyTrustUsdc": split.family_trust_micro,
                        "fokenCommons": split.foken_commons_micro,
                    }
                })
            })
            .collect();
        json!({
            "version": "1.13.0",
            "currency": "USD",
            "sanpoYoshiRevenueSplitPQ": {
                "operating": "1/2",
                "familyTrustUsdc": "3/10",
                "fokenCommons": "1/5",
            },
            "plans": plan_docs,
        })
    }

    pub fn compliance_json() -> Value {
        json!({
            "version": "1.13.0",
            "formalCertification": false,
            "runtime": "workers-rs-rust-core",
            "finCenBsaOfac": {
                "travelRuleThresholdMicro": FINCEN_TRAVEL_RULE_MICRO,
                "ctrThresholdMicro": FINCEN_CTR_THRESHOLD_MICRO,
                "ofacAddressScreening": true,
            },
        })
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct SolanaValidatePayload {
        recipient: String,
        #[serde(default = "default_amount_micro")]
        amount_micro: u64,
        #[serde(default = "default_memo")]
        memo: String,
    }

    fn default_amount_micro() -> u64 {
        5 * MICRO_USD
    }

    fn default_memo() -> String {
        "zeno-rust-worker".to_string()
    }

    pub fn solana_validate_json(body: &str) -> (u16, Value) {
        let Ok(req) = serde_json::from_str::<SolanaValidatePayload>(body) else {
            return (400, json!({ "error": "invalid_json_payload" }));
        };
        let recipient = req.recipient.trim();
        let Ok(pubkey) = decode_solana_pubkey(recipient) else {
            return (400, json!({ "error": "invalid_solana_base58_address" }));
        };
        let Some(core) = seeded_core() else {
            return (500, json!({ "error": "core_seed_failure" }));
        };
        match core.prepare_solana_usdc_payout("$you", recipient, req.amount_micro, req.memo.trim(), 1_764_000_002) {
            Ok(intent) => {
                let pubkey_hex: String = pubkey.iter().map(|b| format!("{b:02x}")).collect();
                let seal_hex: String = intent.wupz_seal.bytes.iter().map(|b| format!("{b:02x}")).collect();
                (
                    200,
                    json!({
                        "valid": true,
                        "status": intent.status,
                        "network": intent.network,
                        "mint": intent.mint,
                        "recipient": intent.recipient_solana,
                        "recipientPubkeyHex": pubkey_hex,
                        "amountMicro": intent.amount_micro,
                        "amountExact": intent.amount_exact,
                        "solanaPayUri": intent.solana_pay_uri,
                        "cliCommand": intent.spl_token_cli_cmd,
                        "wupzSealHex": seal_hex,
                    }),
                )
            }
            Err(_) => (422, json!({ "error": "payout_intent_rejected" })),
        }
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FokenUtilityPayload {
        future_work_avoided_hours: i64,
        work_added_hours: i64,
        maintenance_debt_hours: i64,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FokenEvalPayload {
        invoice_id: String,
        contributor: String,
        provenance_hash: String,
        self_assessed_fokens: u64,
        ip_statement: String,
        ip_signature: String,
        net_utility: FokenUtilityPayload,
    }

    pub fn foken_eval_json(body: &str) -> (u16, Value) {
        let Ok(req) = serde_json::from_str::<FokenEvalPayload>(body) else {
            return (400, json!({ "error": "invalid_json_payload" }));
        };
        if req.net_utility.future_work_avoided_hours < 0
            || req.net_utility.work_added_hours < 0
            || req.net_utility.maintenance_debt_hours < 0
        {
            return (422, json!({ "verdict": "FAIL", "reason": "NEGATIVE_HOURS_FORBIDDEN" }));
        }
        let input = FokenInvoiceInput {
            invoice_id: req.invoice_id.trim(),
            contributor: req.contributor.trim(),
            provenance_hash: req.provenance_hash.trim(),
            self_assessed_fokens: req.self_assessed_fokens,
            ip_statement: req.ip_statement.trim(),
            ip_signature: req.ip_signature.trim(),
            net_utility: FokenNetUtility {
                future_work_avoided_hours: req.net_utility.future_work_avoided_hours as u64,
                work_added_hours: req.net_utility.work_added_hours as u64,
                maintenance_debt_hours: req.net_utility.maintenance_debt_hours as u64,
            },
        };
        match evaluate_foken_gate_pq(&input) {
            Ok(v) if v.passed => (
                200,
                json!({
                    "verdict": "PASS",
                    "netUtilityPQ": format!("{}/{}", v.net_utility_pq.numerator(), v.net_utility_pq.denominator()),
                    "fokensAwarded": v.fokens_awarded,
                    "usdMicroAwarded": v.usd_equivalent_micro,
                    "trit": v.trit,
                    "reason": v.reason,
                }),
            ),
            Ok(v) => (
                422,
                json!({
                    "verdict": "FAIL",
                    "trit": v.trit,
                    "reason": v.reason,
                }),
            ),
            Err(_) => (422, json!({ "verdict": "FAIL", "reason": "FOKEN_GATE_REJECTED" })),
        }
    }
}

#[cfg(target_arch = "wasm32")]
mod edge {
    use crate::api;
    use serde_json::{json, Value};
    use worker::{event, Context, Env, Headers, Method, Request, Response, Result};

    const MAX_BODY_BYTES: usize = 16_384;

    fn json_response(status: u16, doc: &Value, allow_header: Option<&str>) -> Result<Response> {
        let mut resp = Response::from_json(doc)?.with_status(status);
        let headers: &mut Headers = resp.headers_mut();
        headers.set("x-content-type-options", "nosniff")?;
        headers.set("x-frame-options", "DENY")?;
        headers.set("referrer-policy", "strict-origin-when-cross-origin")?;
        headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload")?;
        headers.set("cross-origin-opener-policy", "same-origin")?;
        headers.set("cross-origin-resource-policy", "same-origin")?;
        headers.set("x-robots-tag", "noai, noimageai")?;
        headers.set("cache-control", "no-store")?;
        headers.set("x-zeno-runtime", "workers-rs-rust-wasm")?;
        if let Some(allowed) = allow_header {
            headers.set("allow", allowed)?;
        }
        Ok(resp)
    }

    async fn read_bounded_body(req: &mut Request) -> std::result::Result<String, (u16, Value)> {
        if let Ok(Some(cl)) = req.headers().get("content-length")
            && let Ok(n) = cl.parse::<usize>()
            && n > MAX_BODY_BYTES
        {
            return Err((413, json!({ "error": "payload_too_large" })));
        }
        let text = req
            .text()
            .await
            .map_err(|_| (400, json!({ "error": "invalid_request_body" })))?;
        if text.len() > MAX_BODY_BYTES {
            return Err((413, json!({ "error": "payload_too_large" })));
        }
        Ok(text)
    }

    #[event(fetch)]
    async fn fetch(mut req: Request, _env: Env, _ctx: Context) -> Result<Response> {
        let method = req.method();
        let path_raw = req.path();
        let trimmed = path_raw.trim_end_matches('/');
        let path = if trimmed.is_empty() { "/" } else { trimmed };
        let is_read = method == Method::Get || method == Method::Head;

        match path {
            "/" | "/healthz" => {
                if !is_read {
                    return json_response(405, &json!({ "error": "method_not_allowed" }), Some("GET, HEAD"));
                }
                json_response(200, &api::health_json(), None)
            }
            "/api/us/architecture" => {
                if !is_read {
                    return json_response(405, &json!({ "error": "method_not_allowed" }), Some("GET, HEAD"));
                }
                json_response(200, &api::architecture_json(), None)
            }
            "/api/us/reserve-proof" => {
                if !is_read {
                    return json_response(405, &json!({ "error": "method_not_allowed" }), Some("GET, HEAD"));
                }
                json_response(200, &api::reserve_proof_json(), None)
            }
            "/api/us/networks" => {
                if !is_read {
                    return json_response(405, &json!({ "error": "method_not_allowed" }), Some("GET, HEAD"));
                }
                json_response(200, &api::networks_json(), None)
            }
            "/api/us/pricing" => {
                if !is_read {
                    return json_response(405, &json!({ "error": "method_not_allowed" }), Some("GET, HEAD"));
                }
                json_response(200, &api::pricing_json(), None)
            }
            "/api/us/compliance" => {
                if !is_read {
                    return json_response(405, &json!({ "error": "method_not_allowed" }), Some("GET, HEAD"));
                }
                json_response(200, &api::compliance_json(), None)
            }
            "/api/us/solana-validate" => {
                if method != Method::Post {
                    return json_response(405, &json!({ "error": "method_not_allowed" }), Some("POST"));
                }
                match read_bounded_body(&mut req).await {
                    Ok(body) => {
                        let (status, doc) = api::solana_validate_json(&body);
                        json_response(status, &doc, None)
                    }
                    Err((status, doc)) => json_response(status, &doc, None),
                }
            }
            "/api/us/foken" => {
                if method != Method::Post {
                    return json_response(405, &json!({ "error": "method_not_allowed" }), Some("POST"));
                }
                match read_bounded_body(&mut req).await {
                    Ok(body) => {
                        let (status, doc) = api::foken_eval_json(&body);
                        json_response(status, &doc, None)
                    }
                    Err((status, doc)) => json_response(status, &doc, None),
                }
            }
            _ => json_response(404, &json!({ "error": "not_found", "path": path }), None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::api;

    #[test]
    fn reserve_proof_and_pricing_match_zeno_us_core() {
        let por = api::reserve_proof_json();
        assert_eq!(por["coverageRatioPQ"], "1/1");
        assert_eq!(por["trit"], 0);
        assert_eq!(por["usdcReserveMicro"], 31_240_500_000u64);
        assert_eq!(por["usdtReserveMicro"], 20_800_000_000u64);

        let nets = api::networks_json();
        assert_eq!(nets["count"], 7);

        let pricing = api::pricing_json();
        assert_eq!(pricing["sanpoYoshiRevenueSplitPQ"]["familyTrustUsdc"], "3/10");
        assert_eq!(pricing["plans"].as_array().map(Vec::len), Some(4));
    }

    #[test]
    fn solana_validation_and_foken_gate_enforce_invariants() {
        let (st, ok_doc) = api::solana_validate_json(
            r#"{"recipient":"HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS","amountMicro":5000000,"memo":"edge-test"}"#,
        );
        assert_eq!(st, 200);
        assert_eq!(ok_doc["valid"], true);
        assert_eq!(ok_doc["amountExact"], "5");
        assert!(ok_doc["recipientPubkeyHex"].as_str().is_some_and(|s| s.starts_with("f9dfbe49")));

        let (bad_st, _) = api::solana_validate_json(r#"{"recipient":"0OIlInvalid"}"#);
        assert_eq!(bad_st, 400);

        let (pass_st, pass_doc) = api::foken_eval_json(
            r#"{
                "invoiceId":"inv-rust-worker-1",
                "contributor":"0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
                "provenanceHash":"sha256://0abcabf86830af11bb5e8cd74dc9c9d00abcabf86830af11bb5e8cd74dc9c9d0",
                "selfAssessedFokens":400,
                "ipStatement":"IRREVOCABLE ASSIGNMENT TO UNIVERSAL TREASURY",
                "ipSignature":"0x4f8a3c9b71c8364f3b88",
                "netUtility":{"futureWorkAvoidedHours":120,"workAddedHours":10,"maintenanceDebtHours":2}
            }"#,
        );
        assert_eq!(pass_st, 200);
        assert_eq!(pass_doc["verdict"], "PASS");
        assert_eq!(pass_doc["netUtilityPQ"], "107/1");

        let (neg_st, _) = api::foken_eval_json(
            r#"{
                "invoiceId":"inv-neg",
                "contributor":"0x71C8364f3B8844892cfa7D2Fa9f430589aCEE940",
                "provenanceHash":"sha256://0abcabf86830af11bb5e8cd74dc9c9d00abcabf86830af11bb5e8cd74dc9c9d0",
                "selfAssessedFokens":10,
                "ipStatement":"IRREVOCABLE ASSIGNMENT",
                "ipSignature":"0x4f8a3c9b71c8364f3b88",
                "netUtility":{"futureWorkAvoidedHours":10,"workAddedHours":1,"maintenanceDebtHours":-2}
            }"#,
        );
        assert_eq!(neg_st, 422);
    }
}
