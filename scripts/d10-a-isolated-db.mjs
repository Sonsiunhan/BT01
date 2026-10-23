// D10-A disposable PostgreSQL integration runner.
// It creates a localhost-only cluster, pushes the schema, runs the account
// cross-stream test, and tears the cluster down. No shared DATABASE_URL is read.
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const directory = await mkdtemp(join(tmpdir(), "ottv2-d10a-test-"));
const bin = process.env.OTT_TEST_PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const pg = (name) => join(bin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
const probe = createServer();
await new Promise((done, fail) => { probe.once("error", fail); probe.listen(0, "127.0.0.1", done); });
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const database = `ottv2_d10a_test_${Date.now()}`;
const url = `postgresql://d10a_test@127.0.0.1:${port}/${database}`;
const env = { ...process.env, NODE_ENV: "test", OTT_D10A_TEST_DATABASE_URL: url };
delete env.DATABASE_URL; delete env.TEST_DATABASE_URL;
const evidence = { scope: "D10-A", host: "127.0.0.1", port, database, directory, postgres: "18", productionMutation: false, schemaPush: "NOT_RUN", tests: "NOT_RUN", stopped: false };
function run(command, args, cwd = root, runEnv = env) {
  const result = spawnSync(command, args, { cwd, env: runEnv, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`D10-A test command failed: ${result.status}`);
}
let started = false;
try {
  run(pg("initdb"), ["-D", directory, "-U", "d10a_test", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
  run(pg("pg_ctl"), ["-D", directory, "-l", join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
  started = true;
  run(pg("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "d10a_test", database]);
  run(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], root, { ...env, DATABASE_URL: url });
  evidence.schemaPush = "PASS";
  const report = join(root, "docs/tournament-initialization/account/d10/d10a-database-tests.json");
  await mkdir(join(root, "docs/tournament-initialization/account/d10"), { recursive: true });
  run(process.execPath, ["../../node_modules/vitest/vitest.mjs", "run", "--config", "vitest.config.ts", "--no-file-parallelism", "test/integration/d10-a-cross-stream.integration.test.ts", "--reporter=json", `--outputFile=${report}`], join(root, "apps/server"));
  evidence.tests = "PASS";
} catch (error) {
  evidence.failure = error.message;
  process.exitCode = 1;
} finally {
  if (started) {
    try { run(pg("pg_ctl"), ["-D", directory, "-m", "fast", "-w", "stop"]); evidence.stopped = true; }
    catch (error) { evidence.stopFailure = error.message; process.exitCode = 1; }
  }
  await mkdir(join(root, "docs/tournament-initialization/account/d10"), { recursive: true });
  await writeFile(join(root, "docs/tournament-initialization/account/d10/d10a-database-environment.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
