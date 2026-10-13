import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

for (const render of ["true", "1"]) {
  test(`Render ${render} skips migration without loading Prisma or connecting to a database`, () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./db-deploy.mjs", import.meta.url))], {
      env: { ...process.env, RENDER: render, DATABASE_URL: "invalid-no-database-allowed" },
      encoding: "utf8", windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /database migrations skipped/);
    assert.equal(result.stderr, "");
  });
}
