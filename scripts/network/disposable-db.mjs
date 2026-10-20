#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { createConnection } from "node:net";

export class GuardError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(`[${code}] ${message}`);
    this.name = "GuardError";
    this.code = code;
    this.details = details;
  }
}

export const ALLOWED_DEFAULT_TEST_HOSTS = Object.freeze([
  "127.0.0.1",
  "localhost",
  "::1",
]);

export const DISPOSABLE_MARKER_REGEX = /(?:test|disposable|acceptance|tmp|temp)/i;

/**
 * Sanitizes a URL or URL string so no credentials or secrets are exposed.
 * @param {URL | string} inputUrl
 * @returns {{ host: string, port: number, database: string, protocol: string, productionMutation: boolean, disposable: boolean }}
 */
export function getSanitizedIdentifier(inputUrl) {
  const parsed = typeof inputUrl === "string" ? new URL(inputUrl) : inputUrl;
  const dbName = parsed.pathname.replace(/^\//, "");
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : 5432;

  return {
    host: parsed.hostname,
    port,
    database: dbName,
    protocol: parsed.protocol.replace(/:$/, ""),
    productionMutation: false,
    disposable: DISPOSABLE_MARKER_REGEX.test(dbName),
  };
}

/**
 * Validates TEST_DATABASE_URL against strict safety guard rules:
 * 1. Must be provided and valid postgresql/postgres URL.
 * 2. Must not match or collide with DATABASE_URL.
 * 3. Host must be in allowed test hosts list (e.g. localhost/127.0.0.1).
 * 4. Database name must contain an explicit disposable/test marker.
 *
 * @param {string | undefined} testDbUrl
 * @param {{ databaseUrl?: string, allowedHosts?: string[] }} [options]
 * @returns {{ url: URL, sanitizedIdentifier: ReturnType<typeof getSanitizedIdentifier> }}
 */
export function validateDisposableDbUrl(testDbUrl, options = {}) {
  if (!testDbUrl || typeof testDbUrl !== "string" || !testDbUrl.trim()) {
    throw new GuardError(
      "GUARD_REJECT_MISSING_URL",
      "TEST_DATABASE_URL is required to execute durable test workloads."
    );
  }

  let parsedTestUrl;
  try {
    parsedTestUrl = new URL(testDbUrl.trim());
  } catch (err) {
    throw new GuardError(
      "GUARD_REJECT_INVALID_URL",
      `TEST_DATABASE_URL is not a valid URL: ${err.message}`
    );
  }

  if (
    parsedTestUrl.protocol !== "postgresql:" &&
    parsedTestUrl.protocol !== "postgres:"
  ) {
    throw new GuardError(
      "GUARD_REJECT_INVALID_PROTOCOL",
      `TEST_DATABASE_URL must use postgresql: or postgres: protocol, got "${parsedTestUrl.protocol}"`
    );
  }

  // Check 1: Must not match or collide with DATABASE_URL
  const configuredDatabaseUrl =
    options.databaseUrl ?? process.env.DATABASE_URL;
  if (configuredDatabaseUrl) {
    try {
      const parsedConfigured = new URL(configuredDatabaseUrl.trim());
      const testHost = parsedTestUrl.hostname.toLowerCase();
      const confHost = parsedConfigured.hostname.toLowerCase();
      const testPort = parsedTestUrl.port || "5432";
      const confPort = parsedConfigured.port || "5432";
      const testDb = parsedTestUrl.pathname.replace(/^\//, "");
      const confDb = parsedConfigured.pathname.replace(/^\//, "");

      const isExactMatch =
        parsedTestUrl.href === parsedConfigured.href;
      const isEquivalentEndpoint =
        (testHost === confHost ||
          (["127.0.0.1", "localhost"].includes(testHost) &&
            ["127.0.0.1", "localhost"].includes(confHost))) &&
        testPort === confPort &&
        testDb === confDb;

      if (isExactMatch || isEquivalentEndpoint) {
        throw new GuardError(
          "GUARD_REJECT_IDENTICAL_URL",
          "TEST_DATABASE_URL must not match or target the same endpoint as DATABASE_URL. Accidental mutation of primary database is prohibited.",
          { host: testHost, database: testDb }
        );
      }
    } catch (err) {
      if (err instanceof GuardError) throw err;
      // If DATABASE_URL is invalid, ignore URL parse error on it
    }
  }

  // Check 2: Host must be allowed (disallows remote/production hosts)
  const allowedHosts = options.allowedHosts ?? ALLOWED_DEFAULT_TEST_HOSTS;
  const currentHost = parsedTestUrl.hostname.toLowerCase();
  if (!allowedHosts.includes(currentHost)) {
    throw new GuardError(
      "GUARD_REJECT_DISALLOWED_HOST",
      `Host "${currentHost}" is not in the allowed disposable test hosts list (${allowedHosts.join(", ")}). Tests cannot run against remote or unapproved database servers.`,
      { host: currentHost, allowedHosts }
    );
  }

  // Check 3: Database name must contain an explicit disposable marker
  const dbName = parsedTestUrl.pathname.replace(/^\//, "");
  if (!dbName || !DISPOSABLE_MARKER_REGEX.test(dbName)) {
    throw new GuardError(
      "GUARD_REJECT_MISSING_MARKER",
      `Database name "${dbName}" lacks required disposable marker (e.g. "test", "disposable", "acceptance"). Non-disposable databases cannot be mutated.`,
      { database: dbName }
    );
  }

  return {
    url: parsedTestUrl,
    sanitizedIdentifier: getSanitizedIdentifier(parsedTestUrl),
  };
}

/**
 * Checks if a TCP port is open and listening.
 * @param {string} host
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export function checkTcpConnectivity(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let resolved = false;

    const finalize = (status) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(status);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finalize(true));
    socket.once("error", () => finalize(false));
    socket.once("timeout", () => finalize(false));
  });
}

/**
 * Generates a unique, non-colliding disposable database name.
 * @param {string} [prefix]
 * @returns {string}
 */
export function generateDisposableDbName(prefix = "ottv2_test") {
  const nonce = randomBytes(4).toString("hex");
  const timestamp = Date.now();
  return `${prefix}_${timestamp}_${nonce}`;
}

/**
 * Probes and validates environment readiness.
 * Tests the 3 canonical guard rejection cases to verify guard invariants.
 * @returns {{ passed: boolean, cases: Array<{ name: string, code: string, passed: boolean }> }}
 */
export function runGuardSelfCheck() {
  const results = [];

  // Case 1: TEST_DATABASE_URL matches DATABASE_URL
  try {
    validateDisposableDbUrl(
      "postgresql://user:pass@127.0.0.1:5432/ottv2_test",
      { databaseUrl: "postgresql://user:pass@127.0.0.1:5432/ottv2_test" }
    );
    results.push({
      name: "Case 1: Matches DATABASE_URL",
      code: "FAILED_TO_REJECT",
      passed: false,
    });
  } catch (err) {
    results.push({
      name: "Case 1: Matches DATABASE_URL",
      code: err.code,
      passed: err.code === "GUARD_REJECT_IDENTICAL_URL",
    });
  }

  // Case 2: Host not allowed (e.g. remote render/aws host)
  try {
    validateDisposableDbUrl(
      "postgresql://user:pass@production-db.internal:5432/ottv2_test"
    );
    results.push({
      name: "Case 2: Disallowed remote host",
      code: "FAILED_TO_REJECT",
      passed: false,
    });
  } catch (err) {
    results.push({
      name: "Case 2: Disallowed remote host",
      code: err.code,
      passed: err.code === "GUARD_REJECT_DISALLOWED_HOST",
    });
  }

  // Case 3: Missing disposable marker in database name
  try {
    validateDisposableDbUrl(
      "postgresql://user:pass@127.0.0.1:5432/production_live_db"
    );
    results.push({
      name: "Case 3: Missing disposable marker",
      code: "FAILED_TO_REJECT",
      passed: false,
    });
  } catch (err) {
    results.push({
      name: "Case 3: Missing disposable marker",
      code: err.code,
      passed: err.code === "GUARD_REJECT_MISSING_MARKER",
    });
  }

  const allPassed = results.every((r) => r.passed);
  return { passed: allPassed, cases: results };
}

/**
 * Main execution / verification workflow.
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "verify";

  console.log(`[disposable-db] Running command: "${command}"`);

  // 1. Run guard self check (verifies 3 canonical rejection cases)
  const selfCheck = runGuardSelfCheck();
  console.log("[disposable-db] Guard 3-Case Rejection Verification:");
  for (const c of selfCheck.cases) {
    console.log(
      `  - ${c.name}: ${c.passed ? "REJECTED_AS_EXPECTED" : "UNEXPECTED"} (${c.code})`
    );
  }

  if (!selfCheck.passed) {
    console.error("[disposable-db] Guard verification FAILED!");
    process.exit(1);
  }

  // 2. Validate current environment TEST_DATABASE_URL if provided
  const rawTestUrl = process.env.TEST_DATABASE_URL;
  if (!rawTestUrl) {
    console.log(
      "[disposable-db] TEST_DATABASE_URL is not set. Guard rules verified, durable execution blocked pending environment configuration (Blocker B1)."
    );
    return;
  }

  const { sanitizedIdentifier, url } = validateDisposableDbUrl(rawTestUrl);
  console.log(
    `[disposable-db] TEST_DATABASE_URL validated: host=${sanitizedIdentifier.host}, port=${sanitizedIdentifier.port}, db=${sanitizedIdentifier.database}`
  );
  console.log(
    `[disposable-db] Sanitized identifier: ${JSON.stringify(sanitizedIdentifier)}`
  );

  // 3. Check connectivity to target host
  const isConnected = await checkTcpConnectivity(
    sanitizedIdentifier.host,
    sanitizedIdentifier.port
  );

  if (!isConnected) {
    console.log(
      `[disposable-db] Target host ${sanitizedIdentifier.host}:${sanitizedIdentifier.port} is not reachable (ECONNREFUSED).`
    );
    console.log(
      "[disposable-db] Status: Guard passed all safety checks. Live DB migration is BLOCKED by Blocker B1 (no PostgreSQL daemon running on host)."
    );
    return;
  }

  // 4. If connected, attempt provisioning
  if (command === "provision") {
    const root = resolve(".");
    const disposableName = generateDisposableDbName();
    const adminUrl = new URL(url.href);
    adminUrl.pathname = "/postgres";
    adminUrl.search = "";

    console.log(`[disposable-db] Provisioning fresh database: ${disposableName}...`);
    try {
      const { PrismaClient } = await import("@prisma/client");
      const admin = new PrismaClient({
        datasources: { db: { url: adminUrl.href } },
      });
      await admin.$executeRawUnsafe(`CREATE DATABASE "${disposableName}"`);
      await admin.$disconnect();
      console.log(`[disposable-db] Database "${disposableName}" created.`);

      const targetUrl = new URL(url.href);
      targetUrl.pathname = `/${disposableName}`;

      console.log("[disposable-db] Running prisma migrate deploy...");
      const result = spawnSync(
        process.execPath,
        [
          "node_modules/prisma/build/index.js",
          "migrate",
          "deploy",
          "--schema",
          "prisma/schema.prisma",
        ],
        {
          cwd: root,
          env: { ...process.env, DATABASE_URL: targetUrl.href, NODE_ENV: "test" },
          stdio: "inherit",
        }
      );

      if (result.status !== 0) {
        throw new Error(`Prisma migrate deploy failed with code ${result.status}`);
      }

      console.log(
        `[disposable-db] Successfully migrated disposable database: ${disposableName}`
      );
    } catch (err) {
      console.error(`[disposable-db] Provisioning failed: ${err.message}`);
      process.exit(1);
    }
  }
}

// Run CLI when executed directly
const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (isDirectExecution) {
  void main();
}
