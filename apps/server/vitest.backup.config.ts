import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: Object.fromEntries(["contracts", "game-rules", "bot-sdk"].map(name => [`@ottv2/${name}`, fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))])) },
  test: { environment: "node", include: ["test/**/*.test.ts"], testTimeout: 20000, restoreMocks: true, clearMocks: true },
});
