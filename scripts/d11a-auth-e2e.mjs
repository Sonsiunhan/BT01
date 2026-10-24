// D11-A executable authorization/integration evidence runner.
// Uses only a localhost disposable PostgreSQL cluster and real browser/API sessions.
// It never reads or mutates the caller's DATABASE_URL and never writes production code.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const root = resolve(".");
const pgBin = process.env.OTT_TEST_PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const pg = (name) => join(pgBin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
const directory = await mkdtemp(join(tmpdir(), "ottv2-d11a-auth-"));
const evidencePath = join(root, "docs/tournament-initialization/account/d11/d11a-executable-evidence.json");

async function freePort() {
  const probe = createServer();
  await new Promise((resolvePromise, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolvePromise);
  });
  const port = probe.address().port;
  await new Promise((resolvePromise) => probe.close(resolvePromise));
  return port;
}

const pgPort = await freePort();
const serverPort = await freePort();
const webPort = await freePort();
const database = `ottv2_d11a_${Date.now()}`;
const databaseUrl = `postgresql://d11a_test@127.0.0.1:${pgPort}/${database}`;
const serverUrl = `http://127.0.0.1:${serverPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const baseEnv = { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", LOG_LEVEL: "warn" };
delete baseEnv.DATABASE_URL;
delete baseEnv.TEST_DATABASE_URL;

const evidence = {
  scope: "D11-A",
  purpose: "F01/F02 authorization and integration reproduction",
  browser: "NOT_RUN",
  postgres: "18",
  host: "127.0.0.1",
  pgPort,
  serverPort,
  webPort,
  database,
  directory,
  productionMutation: false,
  sharedDatabaseTouched: false,
  schemaPush: "NOT_RUN",
  apiProbes: "NOT_RUN",
  e2e: "NOT_RUN",
  stopped: false,
};

function runSync(command, args, cwd = root, env = baseEnv) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd"),
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`);
}

function start(command, args, env) {
  const child = spawn(command, args, { cwd: root, env, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
  child.once("error", (error) => process.stderr.write(`[${command}] spawn error: ${error.message}\n`));
  child.stdout.on("data", (chunk) => process.stdout.write(`[${command}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${command}] ${chunk}`));
  return child;
}

function stopChild(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }
  child.kill("SIGTERM");
}

const pnpmRunner = process.platform === "win32" ? process.execPath : "corepack";
const pnpmPrefix = process.platform === "win32"
  ? [join(process.execPath, "..", "node_modules", "corepack", "dist", "corepack.js")]
  : [];

async function waitFor(url, timeoutMs = 45_000) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
}

async function rawApi(path, options = {}) {
  const response = await fetch(`${serverUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-ott-request": "1",
      origin: webUrl,
      ...(options.headers ?? {}),
    },
  });
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { body, cookie: cookieFrom(response), status: response.status, response };
}

async function api(path, options = {}) {
  const result = await rawApi(path, options);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result;
}

async function registerAccount(username, password) {
  const result = await api("/auth/register", {
    method: "POST",
    body: JSON.stringify({ fullName: username, displayName: username, username, password }),
  });
  return { id: result.body.user.id, username, password, cookie: result.cookie };
}

const pgEnv = { ...baseEnv, DATABASE_URL: databaseUrl };
let pgStarted = false;
let server;
let web;
let db;

try {
  runSync(pg("initdb"), ["-D", directory, "-U", "d11a_test", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
  runSync(pg("pg_ctl"), ["-D", directory, "-l", join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${pgPort}`, "-w", "start"]);
  pgStarted = true;
  runSync(pg("createdb"), ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "d11a_test", database]);
  runSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], root, pgEnv);
  evidence.schemaPush = "PASS";

  server = start(pnpmRunner, [...pnpmPrefix, "pnpm", "--filter", "@ottv2/server", "dev"], {
    ...pgEnv,
    PORT: String(serverPort),
    CORS_ORIGINS: webUrl,
    REALTIME_ADAPTER: "disabled",
  });
  await waitFor(`${serverUrl}/health`);
  web = start(pnpmRunner, [...pnpmPrefix, "pnpm", "--filter", "@ottv2/web", "dev", "--host", "127.0.0.1", "--port", String(webPort)], {
    ...baseEnv,
    VITE_API_PROXY_TARGET: serverUrl,
    VITE_API_BASE_URL: serverUrl,
  });
  await waitFor(`${webUrl}/`);

  const suffix = Date.now().toString(36).slice(-6);
  const password = "D11A-Test-Password-123!";
  const admin = await registerAccount(`d11a_admin_${suffix}`, password);
  const ta = await registerAccount(`d11a_ta_${suffix}`, password);
  const player = await registerAccount(`d11a_player_${suffix}`, password);
  const referee = await registerAccount(`d11a_ref_${suffix}`, password);

  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await db.user.update({ where: { id: admin.id }, data: { role: "SYSTEM_ADMIN" } });
  await db.user.update({ where: { id: ta.id }, data: { role: "TOURNAMENT_ADMIN" } });

  const now = new Date();
  const validFrom = new Date(now.getTime() - 86_400_000).toISOString();
  const validTo = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const unitResult = await api("/api/admin/units", {
    method: "POST",
    headers: { cookie: admin.cookie },
    body: JSON.stringify({
      unitCode: `D11A${suffix.toUpperCase()}`,
      unitName: "D11-A Disposable Test Unit",
      unitType: "KHOA",
      contactName: "D11-A",
      contactEmail: "d11a@example.test",
    }),
  });
  const policyEnvelope = {
    allowedModes: ["HUMAN_ONLINE"],
    turnSecondsMin: 30,
    turnSecondsMax: 120,
    totalMatchSecondsMin: 60,
    totalMatchSecondsMax: 3600,
    turnLimitMin: 10,
    turnLimitMax: 200,
    allowedNoProgressPlies: [40, 60],
    allowedRepetitionThresholds: [3],
    allowedTieBreakPolicies: ["RANDOM_SEEDED"],
  };
  const technicalCaps = {
    botSourceMaxBytes: 65536,
    botRuntimeTimeoutMs: 1000,
    botMemoryLimitMb: 64,
    maxConcurrentMatchesPerTournament: 16,
    rosterImportMaxRows: 2000,
  };
  const contractResult = await api("/api/admin/contracts", {
    method: "POST",
    headers: { cookie: admin.cookie },
    body: JSON.stringify({
      contractCode: `D11A_${suffix.toUpperCase()}`,
      unitId: unitResult.body.unit.id,
      validFrom,
      validTo,
      maxTournamentsTotal: 5,
      maxParticipantsPerTournament: 32,
      maxParticipantsTotal: 100,
      allowedModes: ["HUMAN_ONLINE"],
      policyEnvelope,
      technicalCaps,
      status: "ACTIVE",
      initialTaUserIds: [ta.id],
    }),
  });

  const p14Accounts = { admin, ta, player, referee };
  const p14 = {};
  for (const [label, account] of Object.entries(p14Accounts)) {
    const result = await rawApi("/api/admin/audit-logs", { headers: { cookie: account.cookie } });
    p14[label] = { status: result.status };
  }
  const guestAudit = await rawApi("/api/admin/audit-logs");
  p14.guest = { status: guestAudit.status };

  const admission = await api("/api/tournaments/admission/check", {
    method: "POST",
    headers: { cookie: admin.cookie },
    body: JSON.stringify({ principalType: "USER", principalId: admin.id, roles: ["PLAYER"], action: "ONLINE_QUEUE_JOIN" }),
  });

  if (admission.body?.decision?.allowed !== false || admission.body?.decision?.reasonCode !== "ADMIN_CANNOT_PLAY_ONLINE") {
    throw new Error(`D11-A admission assertion failed: ${JSON.stringify(admission.body)}`);
  }

  evidence.apiProbes = {
    contractCreated: Boolean(contractResult.body?.contract?.id),
    taBindingCreated: Boolean(contractResult.body?.contract?.taBindings?.some((binding) => binding.userId === ta.id && binding.status === "ACTIVE")),
    p14,
    admission: {
      status: admission.status,
      allowed: admission.body?.decision?.allowed,
      reasonCode: admission.body?.decision?.reasonCode,
      manipulatedPayloadRoles: ["PLAYER"],
    },
  };

  const fixture = {
    admin: { id: admin.id, username: admin.username, password: admin.password },
    ta: { id: ta.id, username: ta.username, password: ta.password },
    player: { id: player.id, username: player.username, password: player.password },
    referee: { id: referee.id, username: referee.username, password: referee.password },
  };
  const e2eEnv = {
    ...baseEnv,
    E2E_BASE_URL: webUrl,
    D11A_SERVER_URL: serverUrl,
    D11A_FIXTURE_JSON: JSON.stringify(fixture),
  };
  runSync(pnpmRunner, [...pnpmPrefix, "pnpm", "exec", "playwright", "test", "tests/e2e/d11-a-auth-integration.spec.ts", "--reporter=list"], root, e2eEnv);
  evidence.browser = "PASS";
  evidence.e2e = "PASS";
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await db?.$disconnect().catch(() => undefined);
  stopChild(server);
  stopChild(web);
  if (pgStarted) {
    try {
      runSync(pg("pg_ctl"), ["-D", directory, "-m", "fast", "-w", "stop"]);
      evidence.stopped = true;
    } catch (error) {
      evidence.stopFailure = error instanceof Error ? error.message : String(error);
      process.exitCode = 1;
    }
  }
  await mkdir(join(root, "docs/tournament-initialization/account/d11"), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence));
}
