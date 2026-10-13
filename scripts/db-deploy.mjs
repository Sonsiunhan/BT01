import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The approved Render rollout explicitly excludes database migrations.
// Guard old dashboard build commands as well as the updated Blueprint.
if (process.env.RENDER === "true" || process.env.RENDER === "1") {
  console.log("Render deployment: database migrations skipped by deployment policy.");
} else {
  const root = new URL("../", import.meta.url);
  const child = spawnSync(process.execPath, [
    `--env-file-if-exists=${fileURLToPath(new URL(".env", root))}`,
    fileURLToPath(new URL("node_modules/prisma/build/index.js", root)),
    "migrate", "deploy", "--schema", fileURLToPath(new URL("prisma/schema.prisma", root)),
  ], { stdio: "inherit", windowsHide: true });
  if (child.error) console.error("Database migration process could not start.");
  process.exitCode = child.status ?? 1;
}
