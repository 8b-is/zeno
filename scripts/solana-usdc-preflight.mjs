#!/usr/bin/env node
/**
 * ZENO US -> Solana Mainnet-Beta Read-Only Preflight & Unsigned SPL-USDC Intent Builder.
 *
 * Uses ZenoEngine (BigInt zero-float Base58 + micro-USD arithmetic) and queries public
 * Solana JSON-RPC read-only methods to check recipient SOL balance, SPL-USDC ATA presence,
 * and latest blockhash. Never handles private keys or fabricates on-chain signatures.
 */
import ZenoEngine from "../zeno-engine.js";

const { StablecoinReserveEngine, SOLANA_MAINNET, MICRO_USD } = ZenoEngine;
const DEFAULT_RECIPIENT = "HpQPzh6Y6h4AdrqePmCdVPMipWT9fnMBEguNMtkbmQwS";
const DEFAULT_AMOUNT_USD = "5";
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

function parseStrictUsdMicro(input) {
  const clean = String(input ?? "").trim().replace(/^\$/, "");
  if (!/^(?:\d+)(?:\.\d{1,6})?$/.test(clean)) {
    throw new Error(`Invalid non-negative USD amount (up to 6 decimals): ${input}`);
  }
  const [whole, frac = ""] = clean.split(".");
  const micro = BigInt(whole) * MICRO_USD + BigInt(frac.padEnd(6, "0"));
  if (micro <= 0n) {
    throw new Error("USD amount must be > 0");
  }
  return micro;
}

async function rpcCall(method, params) {
  const res = await fetch(SOLANA_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

async function main() {
  const recipient = (process.argv[2] || DEFAULT_RECIPIENT).trim();
  const amountUsd = (process.argv[3] || DEFAULT_AMOUNT_USD).trim();

  const pubkey = StablecoinReserveEngine.decodeSolanaPubkey(recipient);
  const amountMicro = parseStrictUsdMicro(amountUsd);
  const intent = StablecoinReserveEngine.buildSolanaPayUsdcIntent({
    recipient,
    amountMicro,
    label: "ZENO Family Trust",
    memo: `ZENO Micro-Test $${amountUsd}`,
  });

  const pubkeyPrefixHex = Array.from(pubkey.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");

  let rpcStatus = "ok";
  let solLamports = null;
  let usdcAtaCount = null;
  let usdcBalanceRaw = "0";
  let needsAtaRentCreation = null;
  let slot = null;
  let latestBlockhash = null;
  let rpcError = null;

  try {
    const [balRes, ataRes, bhRes] = await Promise.all([
      rpcCall("getBalance", [recipient]),
      rpcCall("getTokenAccountsByOwner", [
        recipient,
        { mint: SOLANA_MAINNET.USDC_MINT },
        { encoding: "jsonParsed" },
      ]),
      rpcCall("getLatestBlockhash", [{ commitment: "finalized" }]),
    ]);
    solLamports = balRes?.value ?? 0;
    slot = balRes?.context?.slot ?? null;
    const atas = Array.isArray(ataRes?.value) ? ataRes.value : [];
    usdcAtaCount = atas.length;
    needsAtaRentCreation = usdcAtaCount === 0;
    let totalRaw = 0n;
    for (const acc of atas) {
      const amtStr = acc?.account?.data?.parsed?.info?.tokenAmount?.amount || "0";
      if (/^\d+$/.test(amtStr)) totalRaw += BigInt(amtStr);
    }
    usdcBalanceRaw = totalRaw.toString();
    latestBlockhash = bhRes?.value?.blockhash || null;
  } catch (err) {
    rpcStatus = "unreachable";
    rpcError = err.message;
  }

  const report = {
    genesisReserveMode: "SIMULATED_LOCAL_SEED_NOT_ONCHAIN_CUSTODY",
    status: intent.status,
    network: intent.network,
    rpcStatus,
    rpcError,
    slot,
    latestBlockhash,
    recipient,
    pubkeyPrefixHex,
    usdcMint: SOLANA_MAINNET.USDC_MINT,
    solLamports,
    usdcAtaCount,
    usdcBalanceRaw,
    needsAtaRentCreation,
    estimatedAtaRentSol: needsAtaRentCreation ? "0.00203928" : "0",
    amountMicro: intent.amountMicro,
    amountDecimal: intent.amountDecimal,
    solanaPayUri: intent.solanaPayUri,
    cliCommand: intent.cliCommand,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("Preflight failed:", err.message);
  process.exit(1);
});
