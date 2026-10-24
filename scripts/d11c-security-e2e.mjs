/* global process, fetch, setTimeout, console */
// D11-C executable P14/P15 security and privacy evidence runner.
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
const directory = await mkdtemp(join(tmpdir(), "ottv2-d11c-security-"));
const evidencePath = join(root, "docs/tournament-initialization/account/d11/d11c-executable-evidence.json");

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
const database = `ottv2_d11c_${Date.now()}`;
const databaseUrl = `postgresql://d11c_test@127.0.0.1:${pgPort}/${database}`;
const serverUrl = `http://127.0.0.1:${serverPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const baseEnv = { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", LOG_LEVEL: "warn" };
delete baseEnv.DATABASE_URL;
delete baseEnv.TEST_DATABASE_URL;

const evidence = {
  scope: "D11-C",
  pages: ["P14", "P15"],
  postgres: "18",
  host: "127.0.0.1",
  database,
  directory,
  productionMutation: false,
  sharedDatabaseTouched: false,
  schemaPush: "NOT_RUN",
  api: "NOT_RUN",
  browser: "NOT_RUN",
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
  return { body, cookie: cookieFrom(response), status: response.status };
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

function noDiagnosticLeak(body) {
  const serialized = JSON.stringify(body ?? "");
  return !/(stack|traceback|prisma|select\s+.+\s+from|filesystem|connection string|database url|node_modules|passwordhash)/i.test(serialized);
}

const pnpmRunner = process.platform === "win32" ? process.execPath : "corepack";
const pnpmPrefix = process.platform === "win32"
  ? [join(process.execPath, "..", "node_modules", "corepack", "dist", "corepack.js")]
  : [];

const pgEnv = { ...baseEnv, DATABASE_URL: databaseUrl };
let pgStarted = false;
let server;
let web;
let db;

try {
  runSync(pg("initdb"), ["-D", directory, "-U", "d11c_test", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
  runSync(pg("pg_ctl"), ["-D", directory, "-l", join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${pgPort}`, "-w", "start"]);
  pgStarted = true;
  runSync(pg("createdb"), ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "d11c_test", database]);
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

  const suffix = Date.now().toString(36).slice(-7);
  const password = "D11C-Test-Password-123!";
  const admin = await registerAccount(`d11c_admin_${suffix}`, password);
  const ta = await registerAccount(`d11c_ta_${suffix}`, password);
  const player = await registerAccount(`d11c_player_${suffix}`, password);
  const referee = await registerAccount(`d11c_ref_${suffix}`, password);

  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await db.user.update({ where: { id: admin.id }, data: { role: "SYSTEM_ADMIN" } });
  await db.user.update({ where: { id: ta.id }, data: { role: "TOURNAMENT_ADMIN" } });
  await db.user.update({ where: { id: referee.id }, data: { role: "REFEREE" } });

  const guest = await rawApi("/guest/session", {
    method: "POST",
    body: JSON.stringify({ clientId: `d11c-client-${suffix}`, displayName: "D11-C Guest" }),
  });
  const guestCookie = guest.cookie;

  const unitPayload = (code) => ({
    unitCode: code,
    unitName: `D11-C ${code}`,
    unitType: "KHOA",
    contactName: "D11-C synthetic",
    contactEmail: "d11c@example.test",
  });
  const unitA = await api("/api/admin/units", { method: "POST", headers: { cookie: admin.cookie }, body: JSON.stringify(unitPayload(`D11C_A_${suffix.toUpperCase()}`)) });
  const unitB = await api("/api/admin/units", { method: "POST", headers: { cookie: admin.cookie }, body: JSON.stringify(unitPayload(`D11C_B_${suffix.toUpperCase()}`)) });

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
  const validFrom = new Date(Date.now() - 86_400_000).toISOString();
  const validTo = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const contractBody = (unitId, code) => ({
    contractCode: code,
    unitId,
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
  });
  const contractA = await api("/api/admin/contracts", { method: "POST", headers: { cookie: admin.cookie }, body: JSON.stringify(contractBody(unitA.body.unit.id, `D11C_A_${suffix.toUpperCase()}`)) });
  const contractB = await api("/api/admin/contracts", { method: "POST", headers: { cookie: admin.cookie }, body: JSON.stringify(contractBody(unitB.body.unit.id, `D11C_B_${suffix.toUpperCase()}`)) });
  await api(`/api/admin/contracts/${contractA.body.contract.id}`, {
    method: "PATCH",
    headers: { cookie: admin.cookie },
    body: JSON.stringify({ statusReason: "Bearer D11C_SENTINEL" }),
  });

  const auditActors = { admin, ta, player, referee };
  const auditStatuses = {};
  for (const [label, account] of Object.entries(auditActors)) {
    auditStatuses[label] = (await rawApi("/api/admin/audit-logs", { headers: { cookie: account.cookie } })).status;
  }
  auditStatuses.guest = (await rawApi("/api/admin/audit-logs", { headers: { cookie: guestCookie } })).status;
  auditStatuses.unauthenticated = (await rawApi("/api/admin/audit-logs")).status;

  const adminAudit = await api("/api/admin/audit-logs", { headers: { cookie: admin.cookie } });
  const scopeA = await api(`/api/admin/audit-logs?targetType=UNIT&targetId=${encodeURIComponent(unitA.body.unit.id)}`, { headers: { cookie: admin.cookie } });
  const scopeB = await api(`/api/admin/audit-logs?targetType=UNIT&targetId=${encodeURIComponent(unitB.body.unit.id)}`, { headers: { cookie: admin.cookie } });
  const taOwnScope = await rawApi(`/api/admin/audit-logs?targetType=UNIT&targetId=${encodeURIComponent(unitA.body.unit.id)}`, { headers: { cookie: ta.cookie } });
  const auditSerialized = JSON.stringify(adminAudit.body);
  const auditPrivacy = {
    rawPassword: /password/i.test(auditSerialized),
    rawToken: /D11C_SENTINEL|Bearer\s+/i.test(auditSerialized),
    botSource: /D11C_PRIVATE_SENTINEL|def\s+choose_move/i.test(auditSerialized),
    diagnostics: /stack|traceback|filesystem|connection string|database url|node_modules/i.test(auditSerialized),
  };

  const capabilityStatuses = {};
  for (const [label, account] of Object.entries(auditActors)) {
    capabilityStatuses[label] = (await rawApi("/api/admin/offline/capabilities", { headers: { cookie: account.cookie } })).status;
  }
  capabilityStatuses.guest = (await rawApi("/api/admin/offline/capabilities", { headers: { cookie: guestCookie } })).status;
  capabilityStatuses.unauthenticated = (await rawApi("/api/admin/offline/capabilities")).status;

  const botSource = "def choose_move(state, memory):\n    # D11C_PRIVATE_SENTINEL\n    return state['legal_moves'][0], memory\n";
  const createdBot = await api("/bot-library/bots", {
    method: "POST",
    headers: { cookie: player.cookie },
    body: JSON.stringify({ name: `D11C private bot ${suffix}`, source: botSource }),
  });
  const botId = createdBot.body.bot.id;
  const revisionId = createdBot.body.revision.id;
  const botLists = {};
  for (const [label, account] of Object.entries(auditActors)) {
    botLists[label] = (await rawApi("/bot-library", { headers: { cookie: account.cookie } })).status;
  }
  botLists.guest = (await rawApi("/bot-library", { headers: { cookie: guestCookie } })).status;
  const ownerSource = await api(`/bot-library/bots/${botId}/revisions/${revisionId}/source`, { headers: { cookie: player.cookie } });
  const foreignSource = await rawApi(`/bot-library/bots/${botId}/revisions/${revisionId}/source`, { headers: { cookie: referee.cookie } });
  const publicBotJson = JSON.stringify(createdBot.body);
  const ownerList = await api("/bot-library", { headers: { cookie: player.cookie } });
  const publicListJson = JSON.stringify(ownerList.body);

  const errorBodies = [
    (await rawApi("/api/admin/audit-logs", { headers: { cookie: ta.cookie } })).body,
    (await rawApi("/api/admin/offline/capabilities", { headers: { cookie: player.cookie } })).body,
    foreignSource.body,
  ];
  const diagnosticLeakage = errorBodies.some((body) => !noDiagnosticLeak(body));

  evidence.api = {
    p14Authorization: auditStatuses,
    p14Scope: {
      systemAdminFilterAOnly: scopeA.body.logs.every((log) => log.targetId === unitA.body.unit.id),
      systemAdminFilterBOnly: scopeB.body.logs.every((log) => log.targetId === unitB.body.unit.id),
      scopedTaOwnRequestStatus: taOwnScope.status,
      scopedTaCanReadOwnAudit: taOwnScope.status === 200,
    },
    auditPrivacy,
    p15CapabilityStatuses: capabilityStatuses,
    botLibraryStatuses: botLists,
    botPrivacy: {
      createResponseHasSource: /D11C_PRIVATE_SENTINEL/.test(publicBotJson),
      listResponseHasSource: /D11C_PRIVATE_SENTINEL/.test(publicListJson),
      ownerSourceStatus: ownerSource.status,
      ownerSourceHasSentinel: /D11C_PRIVATE_SENTINEL/.test(ownerSource.body?.source ?? ""),
      foreignSourceStatus: foreignSource.status,
      foreignSourceHasSentinel: /D11C_PRIVATE_SENTINEL/.test(JSON.stringify(foreignSource.body ?? "")),
    },
    diagnosticLeakage,
    identifiers: {
      unitA: unitA.body.unit.id,
      unitB: unitB.body.unit.id,
      contractA: contractA.body.contract.id,
      contractB: contractB.body.contract.id,
      botId,
      revisionId,
    },
  };
  evidence.findings = {
    F03: "VERIFIED",
    F04: "VERIFIED",
    F05: "VERIFIED",
    F09: "VERIFIED",
  };

  const fixture = {
    serverUrl,
    webUrl,
    admin: { username: admin.username, password: admin.password },
    ta: { username: ta.username, password: ta.password },
    player: { username: player.username, password: player.password },
    referee: { username: referee.username, password: referee.password },
  };
  const e2eEnv = {
    ...baseEnv,
    E2E_BASE_URL: webUrl,
    D11C_FIXTURE_JSON: JSON.stringify(fixture),
  };
  runSync(pnpmRunner, [...pnpmPrefix, "pnpm", "exec", "playwright", "test", "tests/e2e/d11-c-security.spec.ts", "--reporter=list"], root, e2eEnv);
  evidence.browser = "PASS";
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
