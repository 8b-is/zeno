import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { execFileSync } from "node:child_process";

import worker from "./deploy/worker.js";

const ISSUER = "3388000000012345678";
const ACCOUNT = "cnt_0x71c8";
const HOLDER = "8b-is Crew";
const BALANCE_UJPY = 4820 * 1_000_000;

function makeServiceAccount() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    client_email: "svc@example.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    privateKeyObject: privateKey,
  };
}

async function call(path, env = {}) {
  const res = await worker.fetch(new Request("https://zeno.vaked.dev" + path), env, {});
  return { res, body: await res.json() };
}

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
}

/** Recursively sort object keys so Python and JS payloads compare structurally. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonical(value[key]);
        return acc;
      }, {});
  }
  return value;
}

test("unconfigured issuer returns claims preview and never a JWT", async () => {
  const { res, body } = await call(`/api/wallet/google-pass?account=${ACCOUNT}`);

  assert.equal(res.status, 200);
  assert.equal(body.mode, "unconfigured");
  assert.deepEqual(body.missing, ["GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SA_JSON"]);
  assert.equal(body.jwt, undefined);
  assert.equal(body.saveUrl, undefined);
  assert.equal(body.claims.aud, "google");
  assert.equal(body.claims.typ, "savetowallet");
  assert.equal(body.claims.payload.genericObjects[0].barcode.value, `zeno://pay/${ACCOUNT}?bank=ZENO`);
});

test("live mode signs a verifiable RS256 JWT under the size limit", async () => {
  const sa = makeServiceAccount();
  const { res, body } = await call(
    `/api/wallet/google-pass?account=${ACCOUNT}&holder=${encodeURIComponent(HOLDER)}&balance_ujpy=${BALANCE_UJPY}`,
    { GOOGLE_WALLET_ISSUER_ID: ISSUER, GOOGLE_WALLET_SA_JSON: JSON.stringify({ client_email: sa.client_email, private_key: sa.private_key }) },
  );

  assert.equal(res.status, 200);
  assert.equal(body.mode, "live");
  assert.equal(body.overLengthLimit, false);
  assert.ok(body.jwtLength <= 1800, `JWT ${body.jwtLength} exceeds 1800`);

  const [header, payload, signature] = body.jwt.split(".");
  assert.deepEqual(decodeSegment(header), { alg: "RS256", typ: "JWT" });

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${header}.${payload}`);
  const valid = verifier.verify(sa.privateKeyObject, Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  assert.equal(valid, true, "JWT signature must verify against the issuer key");

  assert.equal(body.saveUrl, "https://pay.google.com/gp/v/save/" + body.jwt);

  const obj = decodeSegment(payload).payload.genericObjects[0];
  assert.equal(obj.classId, `${ISSUER}.zeno_aeon_pay`);
  assert.equal(obj.id, `${ISSUER}.zeno_${ACCOUNT}`);
  assert.equal(obj.header.defaultValue.value, "¥4,820");
});

test("invalid balances are rejected rather than silently coerced", async () => {
  for (const bad of ["-1", "1.5", "nope", "99999999999999999999"]) {
    const { res, body } = await call(`/api/wallet/google-pass?balance_ujpy=${bad}`);
    assert.equal(res.status, 400, `balance_ujpy=${bad} must 400`);
    assert.equal(body.error, "invalid_balance");
  }
});

test("account ids are sanitized into a legal Google object id", async () => {
  const sa = makeServiceAccount();
  const { body } = await call(
    `/api/wallet/google-pass?account=${encodeURIComponent("a/b c!")}`,
    { GOOGLE_WALLET_ISSUER_ID: ISSUER, GOOGLE_WALLET_SA_JSON: JSON.stringify({ client_email: sa.client_email, private_key: sa.private_key }) },
  );
  const obj = decodeSegment(body.jwt.split(".")[1]).payload.genericObjects[0];
  assert.equal(obj.id, `${ISSUER}.zeno_a_b_c`);
});

test("App Links assetlinks.json is served for dev.vaked.zeno", async () => {
  const { res, body } = await call("/.well-known/assetlinks.json");
  assert.equal(res.status, 200);
  assert.equal(body[0].target.package_name, "dev.vaked.zeno");
  assert.match(body[0].target.sha256_cert_fingerprints[0], /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
});

test("Worker and Python builders produce identical claims (parity)", async (t) => {
  let pythonClaims;
  try {
    const out = execFileSync(
      "uv",
      [
        "run",
        "python",
        "-c",
        [
          "import sys, json",
          "sys.path.insert(0, 'apps/wallet')",
          "import google_wallet as gw",
          "c = gw.build_claims(",
          "    'svc@example.iam.gserviceaccount.com',",
          "    gw.build_generic_class('" + ISSUER + "'),",
          "    gw.build_generic_object('" + ISSUER + "', '" + ACCOUNT + "', '" + HOLDER + "', " + BALANCE_UJPY + "),",
          ")",
          "c.pop('iat')",
          "print(json.dumps(c, sort_keys=True))",
        ].join("\n"),
      ],
      { encoding: "utf8" },
    );
    pythonClaims = JSON.parse(out);
  } catch (err) {
    t.skip(`uv/python unavailable: ${err.message}`);
    return;
  }

  const sa = makeServiceAccount();
  const { body } = await call(
    `/api/wallet/google-pass?account=${ACCOUNT}&holder=${encodeURIComponent(HOLDER)}&balance_ujpy=${BALANCE_UJPY}`,
    { GOOGLE_WALLET_ISSUER_ID: ISSUER, GOOGLE_WALLET_SA_JSON: JSON.stringify({ client_email: sa.client_email, private_key: sa.private_key }) },
  );

  const jsClaims = decodeSegment(body.jwt.split(".")[1]);
  delete jsClaims.iat;

  assert.deepEqual(canonical(jsClaims), canonical(pythonClaims));
});
