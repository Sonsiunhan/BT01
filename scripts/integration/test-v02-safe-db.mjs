import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

// Integration-only harness: fresh cluster, no .env, no default/shared datasource.
const root = resolve(".");
if (existsSync(join(root, ".env"))) throw new Error("Refusing checkout with .env");
const evidenceDir = join(root, "docs/integration/test-v0.2");
mkdirSync(evidenceDir, { recursive: true });
const directory = await mkdtemp(join(tmpdir(), "ottv2-test-v02-pg-"));
const probe = createServer();
await new Promise((ok, fail) => { probe.once("error", fail); probe.listen(0, "127.0.0.1", ok); });
const port = probe.address().port;
await new Promise(ok => probe.close(ok));
const database = "ottv2_test_merge_" + Date.now();
const binaries = process.env.OTT_TEST_PG_BIN ?? "C:/Program Files/PostgreSQL/17/bin";
const pg = name => join(binaries, name + (process.platform === "win32" ? ".exe" : ""));
const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: `postgresql://ottv2_merge@127.0.0.1:${port}/${database}` };
for (const key of Object.keys(env)) if (/^(R10_|BOT_|R3_PROVIDER_|TEST_DATABASE_URL$|RENDER$)/.test(key)) delete env[key];
const evidence = { measuredAt: new Date().toISOString(), host: "127.0.0.1", port, database, directory, productionMutation: false, retainedForInspection: true, migration: "NOT_RUN", rootTests: "NOT_RUN", serverTests: "NOT_RUN", stopped: false };
let started = false;
function run(command, args, cwd = root, name = "cluster") {
  const result = spawnSync(command, args, { cwd, env, windowsHide: true, encoding: "utf8", ...(name.startsWith("pg-") ? { stdio: "inherit" } : {}), timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(evidenceDir, name + ".log"), (result.stdout ?? "") + (result.stderr ?? ""));
  if (name === "root-tests") evidence.rootTests = result.status === 0 ? "PASS" : "FAIL";
  if (name === "server-tests") evidence.serverTests = result.status === 0 ? "PASS" : "FAIL";
  console.log(name + ": " + result.status);
  if (result.error || result.status !== 0) throw new Error(name + " failed: " + (result.error?.code ?? result.status));
}
try {
  run(pg("initdb"), ["-D", directory, "-U", "ottv2_merge", "--auth=trust", "--encoding=UTF8", "--locale=C"], root, "initdb");
  started = true;
  run(pg("pg_ctl"), ["-D", directory, "-l", join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"], root, "pg-start");
  started = true;
  run(pg("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "ottv2_merge", database], root, "createdb");
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.prisma"], root, "migration");
  evidence.migration = "PASS";
  run(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--maxWorkers=2", "--reporter=json", "--outputFile=docs/integration/test-v0.2/root-tests.json"], root, "root-tests");
  evidence.rootTests = "PASS";
  run(process.execPath, [join(root, "node_modules/vitest/vitest.mjs"), "run", "--config", "vitest.config.ts", "--maxWorkers=2", "--reporter=json", "--outputFile=../../docs/integration/test-v0.2/server-tests.json"], join(root, "apps/server"), "server-tests");
  evidence.serverTests = "PASS";
} catch (error) { evidence.failure = error.message; process.exitCode = 1; }
finally {
  if (started) { try { run(pg("pg_ctl"), ["-D", directory, "-m", "fast", "-w", "stop"], root, "pg-stop"); evidence.stopped = true; } catch (error) { evidence.stopFailure = error.message; process.exitCode = 1; } }
  writeFileSync(join(evidenceDir, "isolated-db.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence));
}
