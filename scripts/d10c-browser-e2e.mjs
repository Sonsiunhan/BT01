// D10-C browser acceptance runner.
// Starts a localhost-only disposable PostgreSQL cluster, a real Fastify API,
// a real Vite frontend, and runs Playwright against the HTTP/browser path.
// It never reads or mutates DATABASE_URL from the caller environment.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const root = resolve(".");
const pgBin = process.env.OTT_TEST_PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const pg = (name) => join(pgBin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
const directory = await mkdtemp(join(tmpdir(), "ottv2-d10c-browser-"));

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
const database = `ottv2_d10c_${Date.now()}`;
const databaseUrl = `postgresql://d10c_test@127.0.0.1:${pgPort}/${database}`;
const serverUrl = `http://127.0.0.1:${serverPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const baseEnv = { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", LOG_LEVEL: "warn" };
delete baseEnv.DATABASE_URL;
delete baseEnv.TEST_DATABASE_URL;

const evidence = {
  scope: "D10-C",
  browser: "Playwright",
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
  e2e: "NOT_RUN",
  dbAssertions: "NOT_RUN",
  stopped: false,
};

function runSync(command, args, cwd = root, env = baseEnv) {
  const result = spawnSync(command, args, { cwd, env, shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd"), stdio: "inherit", windowsHide: true });
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

// Invoke Corepack through node on Windows so spawnSync forwards the actual
// Playwright exit status and output instead of a generic .cmd-shell failure.
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

async function api(path, options = {}) {
  const response = await fetch(`${serverUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", "x-ott-request": "1", origin: webUrl, ...(options.headers ?? {}) },
  });
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  return { body, cookie: cookieFrom(response), response };
}

async function registerAccount(username, password, role) {
  const { body, cookie } = await api("/auth/register", {
    method: "POST",
    body: JSON.stringify({ fullName: username, displayName: username, username, password }),
  });
  return { id: body.user.id, username, password, role, cookie };
}

const pgEnv = { ...baseEnv, DATABASE_URL: databaseUrl };
let pgStarted = false;
let server;
let web;
let db;

try {
  runSync(pg("initdb"), ["-D", directory, "-U", "d10c_test", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
  runSync(pg("pg_ctl"), ["-D", directory, "-l", join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${pgPort}`, "-w", "start"]);
  pgStarted = true;
  runSync(pg("createdb"), ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "d10c_test", database]);
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

  const admin = await registerAccount("d10c_admin", "D10C-Admin-123!", "SYSTEM_ADMIN");
  const ta = await registerAccount("d10c_ta", "D10C-TA-123!", "TOURNAMENT_ADMIN");
  const participant = await registerAccount("d10c_player", "D10C-Player-123!", "USER");
  const referee = await registerAccount("d10c_referee", "D10C-Referee-123!", "USER");

  process.env.DATABASE_URL = databaseUrl;
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await db.user.update({ where: { id: admin.id }, data: { role: "SYSTEM_ADMIN" } });
  await db.user.update({ where: { id: ta.id }, data: { role: "TOURNAMENT_ADMIN" } });

  const now = new Date();
  const validFrom = new Date(now.getTime() - 86_400_000).toISOString();
  const validTo = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const unitResult = await api("/api/admin/units", {
    method: "POST",
    headers: { cookie: admin.cookie },
    body: JSON.stringify({ unitCode: "D10C", unitName: "D10-C Test Unit", unitType: "KHOA", contactName: "D10-C", contactEmail: "d10c@example.test" }),
  });
  const unit = unitResult.body.unit;
  const policyEnvelope = {
    allowedModes: ["HUMAN_ONLINE"], turnSecondsMin: 30, turnSecondsMax: 120,
    totalMatchSecondsMin: 60, totalMatchSecondsMax: 3600, turnLimitMin: 10,
    turnLimitMax: 200, allowedNoProgressPlies: [40, 60], allowedRepetitionThresholds: [3],
    allowedTieBreakPolicies: ["RANDOM_SEEDED"],
  };
  const technicalCaps = { botSourceMaxBytes: 65536, botRuntimeTimeoutMs: 1000, botMemoryLimitMb: 64, maxConcurrentMatchesPerTournament: 16, rosterImportMaxRows: 2000 };
  const contractResult = await api("/api/admin/contracts", {
    method: "POST",
    headers: { cookie: admin.cookie },
    body: JSON.stringify({ contractCode: "D10C_CONTRACT", unitId: unit.id, validFrom, validTo, maxTournamentsTotal: 5, maxParticipantsPerTournament: 32, maxParticipantsTotal: 100, allowedModes: ["HUMAN_ONLINE"], policyEnvelope, technicalCaps, status: "ACTIVE", initialTaUserIds: [ta.id] }),
  });
  const contract = contractResult.body.contract;
  const future = new Date(now.getTime() + 86_400_000);
  const coreConfig = {
    tournamentCode: "D10C_BROWSER", tournamentName: "D10-C Browser Acceptance", shortDescription: "D10-C",
    organizersText: "D10-C Test", competitionMode: "HUMAN_ONLINE", audienceScope: "INTERNAL_UNIT",
    allowedUnitCodes: ["D10C"], registrationIntakeMode: "IMPORT_ONLY", maxParticipants: 32, minParticipantsToStart: 2,
    timezone: "Asia/Ho_Chi_Minh", registrationOpenAt: validFrom, registrationCloseAt: null, checkinRequired: false,
    checkinOpenAt: null, checkinCloseAt: null, scheduledStartAt: future.toISOString(), scheduledEndAt: new Date(future.getTime() + 86_400_000).toISOString(),
    format: "ARENA_CONTINUOUS", pairingMethod: "SWISS_SCORE_ADJACENT", maxMatchesPerPlayer: null, maxPairMeetings: 2,
    rematchCooldownMinutes: 5, maxConcurrentMatches: 8, byeScorePoints: 0, spectatorPolicy: "ROSTER_ONLY",
    chatPolicy: "SPECTATOR_MUTED", leaderboardVisibility: "LIVE_PUBLIC", topNExportCount: 10, finalizationMode: "AUTO_FINAL",
    scoringFormulaPreset: "ELO_WEIGHTED_V1", initialScore: 1000, initialElo: 1000, kFactor: 32, scoreFloor: 0,
    botDeadlineAt: null,
  };
  const draftResult = await api("/api/tournaments/drafts", {
    method: "POST",
    headers: { cookie: ta.cookie },
    body: JSON.stringify({ contractId: contract.id, coreConfig }),
  });
  const draft = draftResult.body.tournament;

  await db.unit.create({ data: { id: unit.id, unitCode: unit.unitCode, unitName: unit.unitName, unitType: unit.unitType, contactName: unit.contactName, contactEmail: unit.contactEmail } });
  await db.tournamentContract.create({ data: {
    id: contract.id, contractCode: contract.contractCode, unitId: unit.id, status: "ACTIVE", validFrom: new Date(validFrom), validTo: new Date(validTo),
    maxTournamentsTotal: 5, quotaReservedCount: 1, quotaConsumedCount: 0, maxParticipantsPerTournament: 32, maxParticipantsTotal: 100,
    allowedModes: ["HUMAN_ONLINE"], policyEnvelope, technicalCaps,
  } });
  await db.tournamentContractTaBinding.create({ data: { contractId: contract.id, userId: ta.id, username: ta.username, displayName: ta.username, status: "ACTIVE", grantedByUserId: admin.id } });
  const configVersionId = randomUUID();
  const regulations = { rulesAckRequired: true, regulationsFull: "Điều lệ D10-C dùng cho kiểm thử trình duyệt.", rulesQuickSummary: "Xác nhận phiên bản hiện hành." };
  await db.tournament.create({ data: {
    id: draft.id, tournamentCode: draft.coreConfig.tournamentCode, contractId: contract.id, unitId: unit.id, ownerTaUserId: ta.id,
    status: "DRAFT", revision: draft.revision, coreConfig: draft.coreConfig, ruleProfile: draft.ruleProfile,
    activeConfigVersionId: configVersionId, activeConfigVersionNumber: 1,
  } });
  await db.tournamentConfigVersionRecord.create({ data: {
    id: configVersionId, tournamentId: draft.id, versionNumber: 1, coreConfigSnapshot: { ...draft.coreConfig, ...regulations },
    ruleProfileSnapshot: draft.ruleProfile, effectiveAt: new Date(now.getTime() - 60_000), publishedByUserId: admin.id, changeSummary: "D10-C browser fixture",
  } });
  await db.tournamentEnrollmentRecord.create({ data: {
    tournamentId: draft.id, contractId: contract.id, personKey: "D10C:PLAYER-001", userId: participant.id, displayName: participant.username,
    unitCode: "D10C", email: "d10c-player@example.test", eligibilityStatus: "ELIGIBLE", checkedInAt: new Date(), botReadinessStatus: "NOT_REQUIRED",
  } });

  const fixture = { admin: { id: admin.id, username: admin.username, password: admin.password }, ta: { id: ta.id, username: ta.username, password: ta.password }, participant: { id: participant.id, username: participant.username, password: participant.password }, referee: { id: referee.id, username: referee.username, password: referee.password }, tournamentId: draft.id, contractId: contract.id };
  const e2eEnv = { ...baseEnv, E2E_BASE_URL: webUrl, D10C_SERVER_URL: serverUrl, D10C_FIXTURE_JSON: JSON.stringify(fixture), PLAYWRIGHT_JSON_OUTPUT_NAME: join(root, "docs/tournament-initialization/account/d10/d10c-playwright-report.json") };
  runSync(pnpmRunner, [...pnpmPrefix, "pnpm", "exec", "playwright", "test", "tests/e2e/d10-c-real-account.spec.ts", "--reporter=list"], root, e2eEnv);
  evidence.e2e = "PASS";

  const roster = await db.tournamentEnrollmentRecord.findMany({ where: { tournamentId: draft.id } });
  const imported = roster.filter((row) => row.personKey === "D10C:NEW-001");
  const ledger = await db.commandLedgerEntry.findMany({ where: { targetId: draft.id, operation: "ROSTER_IMPORT_COMMIT" } });
  const claim = imported[0] ? await db.commandLedgerEntry.findMany({ where: { targetId: imported[0].id, operation: "ROSTER_ACTIVATION_CLAIM", outcome: "CLAIMED" } }) : [];
  const credential = imported[0] ? await db.commandLedgerEntry.findMany({ where: { targetId: imported[0].id, operation: "ROSTER_CREDENTIAL_SETUP", outcome: "ACTIVE" } }) : [];
  const staff = await db.tournamentStaffAssignmentRecord.findMany({ where: { tournamentId: draft.id } });
  const ack = await db.tournamentRulesAcknowledgement.findMany({ where: { tournamentId: draft.id, userId: participant.id } });
  const support = await db.supportRecoveryTicket.findMany({ where: { targetUserId: participant.id } });
  const audit = await db.tournamentAuditLogRecord.findMany({ where: { targetId: draft.id } });
  if (roster.length !== 2 || imported.length !== 1 || imported[0].userId === null || ledger.length !== 1 || claim.length !== 1 || credential.length !== 1 || staff.length !== 1 || staff[0].status !== "REVOKED" || ack.length !== 1 || ack[0].configVersionId !== configVersionId || support.length !== 1 || support[0].status !== "RESOLVED" || audit.length === 0) {
    throw new Error(`D10-C authoritative DB assertion failed: ${JSON.stringify({ roster: roster.length, imported: imported.length, importedUser: imported[0]?.userId ?? null, ledger: ledger.length, claim: claim.length, credential: credential.length, staff: staff.map((row) => row.status), ack: ack.map((row) => ({ configVersionId: row.configVersionId, satisfied: row.satisfied })), support: support.map((row) => row.status), audit: audit.length })}`);
  }
  evidence.dbAssertions = "PASS";
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await db?.$disconnect().catch(() => undefined);
  stopChild(server);
  stopChild(web);
  if (pgStarted) {
    try { runSync(pg("pg_ctl"), ["-D", directory, "-m", "fast", "-w", "stop"]); evidence.stopped = true; }
    catch (error) { evidence.stopFailure = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
  }
  await mkdir(join(root, "docs/tournament-initialization/account/d10"), { recursive: true });
  await writeFile(join(root, "docs/tournament-initialization/account/d10/d10c-browser-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence));
}
