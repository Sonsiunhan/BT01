import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// This helper can only provision an explicitly named, local acceptance DB.
// It cannot migrate the configured dev database or any remote database.
const configured = new URL(process.env.DATABASE_URL ?? 'postgresql://missing@invalid/missing');
if (!['127.0.0.1', 'localhost'].includes(configured.hostname) || configured.pathname !== '/ottv2_dev') throw new Error('Expected verified local ottv2_dev connection; no database was changed.');
const name = `ottv2_r20_acceptance_${Date.now()}`;
const adminUrl = new URL(configured); adminUrl.pathname = '/postgres'; adminUrl.search = '';
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.href } } });
try { await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`); }
catch { throw new Error('Cannot provision the disposable local acceptance database; no existing database was migrated. A dedicated test datasource with provisioning permission is required.'); }
finally { await admin.$disconnect(); }
const testUrl = new URL(configured); testUrl.pathname = `/${name}`;
const env = { ...process.env, DATABASE_URL: testUrl.href, NODE_ENV: 'test' };
console.log(JSON.stringify({ host: testUrl.hostname, database: name, productionMutation: false, retainedForInspection: true }));
const root = path.resolve('.');
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Acceptance command failed (exit ${result.status}); test database retained: ${name}`);
}
run(['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma']);
run([path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.config.ts', 'test/integration'], path.join(root, 'apps/server'));
