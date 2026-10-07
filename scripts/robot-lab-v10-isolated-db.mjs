import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

// Never reads .env or falls back to the dev/production database. A fresh
// localhost-only cluster owns all fixtures and is stopped, but retained.
const root = resolve('.');
const binaries = process.env.OTT_TEST_PG_BIN ?? 'C:/Program Files/PostgreSQL/17/bin';
const extension = process.platform === 'win32' ? '.exe' : '';
const directory = await mkdtemp(join(tmpdir(), 'ottv2-r20-pg-'));
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const database = `ottv2_r20_acceptance_${Date.now()}`;
const env = { ...process.env, DATABASE_URL: `postgresql://ottv2_acceptance@127.0.0.1:${port}/${database}`, NODE_ENV: 'test' };
const evidence = { measuredAt: new Date().toISOString(), postgres: '17', host: '127.0.0.1', port, database, directory, productionMutation: false, retainedForInspection: true, migration: 'NOT_RUN', tests: 'NOT_RUN', stopped: false };
let started = false;
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Acceptance command failed (${result.status}): ${command}`);
}
const pg = name => join(binaries, name + extension);
try {
  run(pg('initdb'), ['-D', directory, '-U', 'ottv2_acceptance', '--auth=trust', '--encoding=UTF8', '--locale=C']);
  run(pg('pg_ctl'), ['-D', directory, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  run(pg('createdb'), ['-h', '127.0.0.1', '-p', String(port), '-U', 'ottv2_acceptance', database]);
  run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma']);
  evidence.migration = 'PASS';
  // Each real-runtime suite constructs its own supervisor. Run such files
  // serially, matching the production single-admission runtime capacity;
  // concurrent test supervisors would measure host contention as bot CPU.
  run(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.config.ts', ...(process.env.R10_WASMTIME_PATH ? ['--no-file-parallelism'] : []), '--reporter=json', '--outputFile=../../docs/robot-lab-visual-reference/v10-server-acceptance.json'], join(root, 'apps/server'));
  const report = JSON.parse(await readFile(join(root, 'docs/robot-lab-visual-reference/v10-server-acceptance.json'), 'utf8'));
  evidence.testCounts = { passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests };
  evidence.tests = report.numPendingTests ? 'PASS_WITH_EXPLICIT_RUNTIME_SKIPS' : 'PASS_ZERO_SKIPS';
  if (process.env.OTT_GUEST_BROWSER_GATE === '1') {
    run(process.execPath, ['apps/server/node_modules/tsx/dist/cli.mjs', 'scripts/guest-bot-online-browser.mjs']);
    evidence.guestBrowser = 'PASS';
  }
} catch (error) { evidence.failure = String(error.message); process.exitCode = 1; }
finally {
  if (started) {
    try { run(pg('pg_ctl'), ['-D', directory, '-m', 'fast', '-w', 'stop']); evidence.stopped = true; }
    catch (error) { evidence.stopFailure = String(error.message); process.exitCode = 1; }
  }
  await writeFile(join(root, 'docs/robot-lab-visual-reference/v10-isolated-db.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
