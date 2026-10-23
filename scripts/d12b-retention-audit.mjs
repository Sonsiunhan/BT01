/* D12-B executable retention/audit evidence.
 *
 * This runner owns only D12-B evidence. It provisions a disposable localhost
 * PostgreSQL cluster, applies the existing Prisma schema there, runs the real
 * D12-B integration test against that database, and removes the cluster.
 * It never reads DATABASE_URL and never starts the application against a
 * shared or production database.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const pgBin = process.env.OTT_TEST_PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const pg = (name) => join(pgBin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
const evidencePath = join(root, "docs/tournament-initialization/account/d12/d12b-executable-evidence.json");
const directory = await mkdtemp(join(tmpdir(), "ottv2-d12b-retention-"));

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
const database = `ottv2_d12b_${Date.now()}`;
const databaseUrl = `postgresql://d12b_test@127.0.0.1:${pgPort}/${database}`;
const baseEnv = { ...process.env, NODE_ENV: "test", LOG_LEVEL: "warn" };
delete baseEnv.DATABASE_URL;
delete baseEnv.TEST_DATABASE_URL;
const pgEnv = { ...baseEnv, DATABASE_URL: databaseUrl };
const pnpmRunner = process.platform === "win32" ? process.execPath : "corepack";
const pnpmPrefix = process.platform === "win32"
  ? [join(process.execPath, "..", "node_modules", "corepack", "dist", "corepack.js")]
  : [];

let pgStarted = false;
let testExitCode = 1;
let evidence = {
  scope: "D12-B",
  postgres: "18",
  host: "127.0.0.1",
  pgPort,
  database,
  productionMutation: false,
  sharedDatabaseTouched: false,
  schemaPush: "NOT RUN",
  integrationTest: "NOT RUN",
  disposableDatabaseStopped: false,
  disposableDatabaseRemoved: false,
};

function runSync(command, args, env = baseEnv) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd"),
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`);
}

try {
  runSync(pg("initdb"), ["-D", directory, "-U", "d12b_test", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
  runSync(pg("pg_ctl"), ["-D", directory, "-l", join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${pgPort}`, "-w", "start"]);
  pgStarted = true;
  runSync(pg("createdb"), ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "d12b_test", database]);
  runSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], pgEnv);
  evidence.schemaPush = "PASS";

  const test = spawnSync(pnpmRunner, [
    ...pnpmPrefix,
    "pnpm",
    "--filter",
    "@ottv2/server",
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.config.ts",
    "test/integration/d12b-retention-audit.integration.test.ts",
  ], {
    cwd: root,
    env: {
      ...pgEnv,
      OTT_D12B_TEST_DATABASE_URL: databaseUrl,
      OTT_D12B_EVIDENCE_PATH: evidencePath,
    },
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });
  if (test.error) throw test.error;
  testExitCode = test.status ?? 1;
  evidence.integrationTest = testExitCode === 0 ? "PASS" : `FAIL (${testExitCode})`;
} catch (error) {
  evidence.runnerError = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  if (pgStarted) {
    const stop = spawnSync(pg("pg_ctl"), ["-D", directory, "-m", "fast", "-w", "stop"], { stdio: "inherit", windowsHide: true });
    evidence.disposableDatabaseStopped = stop.status === 0;
  }
  try {
    await rm(directory, { recursive: true, force: true });
    evidence.disposableDatabaseRemoved = true;
  } catch (error) {
    evidence.cleanupError = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  }

  try {
    const testEvidence = JSON.parse(await readFile(evidencePath, "utf8"));
    evidence = { ...testEvidence, ...evidence };
  } catch {
    await mkdir(join(root, "docs/tournament-initialization/account/d12"), { recursive: true });
  }
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (testExitCode !== 0) process.exitCode = 1;
  console.log(JSON.stringify({ scope: "D12-B", integrationTest: evidence.integrationTest, disposableDatabaseStopped: evidence.disposableDatabaseStopped, disposableDatabaseRemoved: evidence.disposableDatabaseRemoved }));
}
