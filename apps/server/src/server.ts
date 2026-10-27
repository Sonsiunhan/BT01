import { existsSync } from "node:fs";

const envFile = new URL("../../../.env", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile?.(envFile);

import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { PrismaDatabase } from "./plugins/prisma.js";
import { bootstrapDatabaseAndAdmin } from "./modules/auth/bootstrap-admin.js";

const env = loadEnv();
const database = new PrismaDatabase();
await bootstrapDatabaseAndAdmin(database.client);
const app = await buildApp({ env, database });
let closing = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "server shutdown requested");
  try {
    await app.close();
    process.exitCode = 0;
  } catch (error) {
    app.log.error({ err: error }, "server shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.fatal({ err: error }, "server startup failed");
  await app.close();
  process.exitCode = 1;
}
