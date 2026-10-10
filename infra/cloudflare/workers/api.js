/**
 * ZENO Edge API Worker — Cloudflare Edge Gateway
 * Double-entry verification, Foken gate pre-filtering, and streaming interpolation
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check & Beacon
    if (url.pathname === "/healthz" || url.pathname === "/beacon.json") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "zeno.vaked.dev",
          edgeColo: request.cf?.colo || "EDGE",
          constellation: "vaked.dev",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
          },
        }
      );
    }

    // Foken Gate Pre-Filter endpoint: /api/v1/gate
    if (url.pathname === "/api/v1/gate" && request.method === "POST") {
      try {
        const body = await request.json();
        const verdict = evaluateFokenInvoice(body);
        return new Response(JSON.stringify(verdict), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err.message, verdict: "FAIL" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback: proxy to static assets or return 404
    return new Response(
      JSON.stringify({ error: "Endpoint not found", path: url.pathname }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  },
};

function evaluateFokenInvoice(invoice) {
  const invId = invoice.invoiceId || "unknown";

  // Required top-level fields
  const required = ["invoiceId", "version", "contributor", "work", "artifact", "valuation", "ipAssignment"];
  for (const f of required) {
    if (!invoice[f]) {
      return { invoiceId: invId, verdict: "FAIL", reason: `missing field '${f}'` };
    }
  }

  // Contributor address check
  if (!/^0x[0-9a-fA-F]{40}$/.test(invoice.contributor)) {
    return { invoiceId: invId, verdict: "FAIL", reason: "invalid contributor address format" };
  }

  // Artifact check
  if (!invoice.artifact.provenanceHash?.startsWith("sha256://")) {
    return { invoiceId: invId, verdict: "FAIL", reason: "artifact provenance must start with sha256://" };
  }

  // Valuation
  const fokens = invoice.valuation.selfAssessedFokens;
  if (typeof fokens !== "number" || fokens <= 0 || !Number.isInteger(fokens)) {
    return { invoiceId: invId, verdict: "FAIL", reason: "selfAssessedFokens must be a positive integer" };
  }

  // IP Assignment
  const ip = invoice.ipAssignment;
  if (!ip.statement?.includes("IRREVOCABLE ASSIGNMENT") || !ip.signature?.startsWith("0x")) {
    return { invoiceId: invId, verdict: "FAIL", reason: "missing/unsigned IP assignment — no IP, no mint" };
  }

  // Net Utility Formula
  const nu = invoice.netUtility;
  if (!nu || typeof nu.futureWorkAvoidedHours !== "number") {
    return { invoiceId: invId, verdict: "REVIEW", reason: "missing/invalid netUtility figures" };
  }

  const net = nu.futureWorkAvoidedHours - (nu.workAddedHours + 1.5 * nu.maintenanceDebtHours);
  if (net <= 0) {
    return {
      invoiceId: invId,
      verdict: "FAIL",
      reason: `net-negative utility (${net}): work added exceeds future work avoided`,
      netUtility: net,
    };
  }

  return {
    invoiceId: invId,
    verdict: "PASS",
    reason: `eligible for human vote (net utility = ${net})`,
    netUtility: net,
  };
}
