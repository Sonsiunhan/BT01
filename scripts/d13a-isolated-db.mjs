// D13-A disposable PostgreSQL evidence runner.
// It never reads or mutates the configured DATABASE_URL and removes its
// temporary cluster after the focused integration test completes.
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const directory = await mkdtemp(join(tmpdir(), "ottv2-d13a-test-"));
const bin = process.env.OTT_TEST_PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const pg = (name) => join(bin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
const probe = createServer();
await new Promise((done, fail) => { probe.once("error", fail); probe.listen(0, "127.0.0.1", done); });
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const database = `ottv2_d13a_test_${Date.now()}`;
const url = `postgresql://d13a_test@127.0.0.1:${port}/${database}`;
const env = { ...process.env, NODE_ENV: "test", OTT_D13A_TEST_DATABASE_URL: url };
delete env.DATABASE_URL;
delete env.TEST_DATABASE_URL;
const evidence = {
  host: "127.0.0.1",
  port,
  database,
  postgres: "18",
  productionMutation: false,
  configuredDatabaseRead: false,
  schemaPush: "NOT_RUN",
  tests: "NOT_RUN",
  stopped: false,
  cleaned: false,
};

function run(command, args, cwd = root, runEnv = env) {
  const result = spawnSync(command, args, { cwd, env: runEnv, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`D13-A test command failed: ${result.status}`);
}

let started = false;
try {
  run(pg("initdb"), ["-D", directory, "-U", "d13a_test", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
  run(pg("pg_ctl"), ["-D", directory, "-l", join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
  started = true;
  run(pg("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "d13a_test", database]);
  run(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], root, { ...env, DATABASE_URL: url });
  evidence.schemaPush = "PASS_DISPOSABLE_ONLY";
  const report = join(root, "docs/tournament-initialization/account/d13/d13a-postgres-tests.json");
  run(process.execPath, ["../../node_modules/vitest/vitest.mjs", "run", "--config", "vitest.config.ts", "--no-file-parallelism", "test/integration/d13a-roster-activation.integration.test.ts", "--reporter=json", `--outputFile=${report}`], join(root, "apps/server"));
  evidence.tests = "PASS";
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  if (started) {
    try { run(pg("pg_ctl"), ["-D", directory, "-m", "fast", "-w", "stop"]); evidence.stopped = true; }
    catch (error) { evidence.stopFailure = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
  }
  try { await rm(directory, { recursive: true, force: true }); evidence.cleaned = true; }
  catch (error) { evidence.cleanupFailure = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
  await mkdir(join(root, "docs/tournament-initialization/account/d13"), { recursive: true });
  await writeFile(join(root, "docs/tournament-initialization/account/d13/d13a-database-environment.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence));
}
