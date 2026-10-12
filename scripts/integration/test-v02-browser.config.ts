import { fileURLToPath } from "node:url";
import { defineConfig } from "playwright/test";
import base from "../../playwright.config";
export default defineConfig({
  ...base,
  testDir: fileURLToPath(new URL("../../tests/e2e", import.meta.url)),
  globalSetup: fileURLToPath(new URL("./test-v02-browser-guard.mjs", import.meta.url)),
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: fileURLToPath(new URL("../../docs/integration/test-v0.2/browser-tests.json", import.meta.url)) }]],
  outputDir: fileURLToPath(new URL("../../test-results/test-v02-integration", import.meta.url)),
  webServer: { command: "corepack pnpm --filter @ottv2/web dev --host 127.0.0.1 --port 4173", url: "http://127.0.0.1:4173", reuseExistingServer: false },
  use: { ...base.use, baseURL: "http://127.0.0.1:4173", channel: "chrome", serviceWorkers: "block" },
});
