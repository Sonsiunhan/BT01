import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default mergeConfig(base, defineConfig({
  resolve: {
    alias: {
      zod: fileURLToPath(new URL("./apps/server/node_modules/zod/index.js", import.meta.url)),
    },
  },
}));
