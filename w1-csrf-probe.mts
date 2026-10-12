import { buildApp } from "./apps/server/src/app.ts";
import { loadEnv } from "./apps/server/src/config/env.ts";

const env = loadEnv({ NODE_ENV: "test", DATABASE_URL: "postgresql://unused@127.0.0.1:1/w1", CORS_ORIGINS: "https://frontend.example.com" });
const app = await buildApp({ env, database: { check: async () => 0, close: async () => {} } });
const cases = [
  ["valid-origin", { origin: "https://frontend.example.com", "x-ott-request": "1" }, 204],
  ["missing-header", { origin: "https://frontend.example.com" }, 403],
  ["evil-origin", { origin: "https://evil.example.com", "x-ott-request": "1" }, 403],
  ["null-origin", { origin: "null", "x-ott-request": "1" }, 403],
  ["missing-origin-and-referer", { "x-ott-request": "1" }, 403],
  ["allowlisted-referer-fallback", { referer: "https://frontend.example.com/rooms/1", "x-ott-request": "1" }, 204],
  ["invalid-origin-cannot-use-valid-referer", { origin: "https://evil.example.com", referer: "https://frontend.example.com/rooms/1", "x-ott-request": "1" }, 403],
] as const;
const results = [];
try {
  for (const [name, headers, expected] of cases) {
    const response = await app.inject({ method: "POST", url: "/auth/logout", headers });
    results.push({ name, expected, actual: response.statusCode, pass: response.statusCode === expected });
  }
} finally {
  await app.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.pass)) process.exitCode = 1;
