import { writeFile } from "node:fs/promises";
import { buildApp } from "./apps/server/src/app.ts";
import { loadEnv } from "./apps/server/src/config/env.ts";
import { AppError } from "./apps/server/src/shared/errors/app-error.ts";

const env = loadEnv({ NODE_ENV: "test", DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/w3_never_connect", CORS_ORIGINS: "https://frontend.example.com" });
const app = await buildApp({ env, database: { check: async () => 0, close: async () => {} } });
app.get("/w3-canary", async () => {
  throw new AppError("UNAUTHORIZED", "Không được phép.", 403, false, "INVALID", {
    reason: "ACCESS_DENIED",
    secret: "W3_PRIVATE_CANARY",
    source: "private bot source",
    stack: "private stack",
  });
});

const cases: Array<Record<string, unknown>> = [];
try {
  const allowed = await app.inject({ method: "POST", url: "/auth/logout", headers: { origin: "https://frontend.example.com", "x-ott-request": "1" } });
  cases.push({ id: "SEC-10-CSRF-POS", pass: allowed.statusCode === 204, status: allowed.statusCode });
  const missing = await app.inject({ method: "POST", url: "/auth/logout", headers: { origin: "https://frontend.example.com" } });
  cases.push({ id: "SEC-10-CSRF-NEG", pass: missing.statusCode === 403, status: missing.statusCode });
  const evil = await app.inject({ method: "POST", url: "/auth/logout", headers: { origin: "https://evil.example.com", "x-ott-request": "1" } });
  cases.push({ id: "SEC-10-CSRF-EVIL", pass: evil.statusCode === 403 && evil.json().details?.reason === "CSRF_ORIGIN_NOT_ALLOWED", status: evil.statusCode, reason: evil.json().details?.reason });
  const canary = await app.inject({ method: "GET", url: "/w3-canary" });
  cases.push({ id: "SEC-06-REDACTION", pass: !canary.body.includes("W3_PRIVATE_CANARY") && !canary.body.includes("private bot source"), status: canary.statusCode, body: canary.json() });
} finally {
  await app.close();
}

await writeFile("w3-security-probes.json", JSON.stringify({ source: "codex/security-network-repair", environment: "Fastify inject + dummy DatabasePort; no real DB", cases }, null, 2));
console.log(JSON.stringify(cases, null, 2));
