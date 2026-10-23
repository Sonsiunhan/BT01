// D13-B entry point reuses the established D12 disposable PostgreSQL,
// Fastify, Vite and Playwright harness without overwriting D12 evidence.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const playwrightReportPath = resolve("docs/tournament-initialization/account/d13/d13b-playwright-report.json");
process.env.D12A_SCOPE = "D13-B";
process.env.D12A_EVIDENCE_PATH = "docs/tournament-initialization/account/d13/d13b-executable-evidence.json";
process.env.D12A_PLAYWRIGHT_SPEC = "tests/e2e/d13-b-integration.spec.ts";
process.env.D12A_FIXTURE_ENV_NAME = "D13B_FIXTURE_JSON";
process.env.D12A_EVIDENCE_PATH = resolve(process.env.D12A_EVIDENCE_PATH);
process.env.D13B_PLAYWRIGHT_REPORT_PATH = playwrightReportPath;

let runnerError;
try {
  await import("./d12a-security-e2e.mjs");
} catch (error) {
  runnerError = error;
}

try {
  const parsed = JSON.parse(await readFile(playwrightReportPath, "utf8"));
  const redact = (value) => {
    if (typeof value === "string") {
      return value
        .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[REDACTED_TOKEN_OR_HASH]")
        .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[REDACTED_DATABASE_URL]")
        .replace(/D13B-(?:Recovered|Replay|Activation)-Password-[A-Za-z0-9!._-]+/g, "[REDACTED_TEST_CREDENTIAL]");
    }
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redact(child)]));
    return value;
  };
  await writeFile(playwrightReportPath, `${JSON.stringify(redact(parsed), null, 2)}\n`, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

if (runnerError) throw runnerError;
