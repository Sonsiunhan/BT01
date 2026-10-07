/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: "ott-public-offline-manifest",
    apply: "build",
    generateBundle(_options, bundle) {
      const assets = Object.values(bundle).map(output => output.fileName)
        .filter(name => /^assets\/[a-zA-Z0-9_.-]+\.(?:js|css|png|svg|woff2?|ttf)$/.test(name))
        .map(name => `/${name}`).sort();
      this.emitFile({ type: "asset", fileName: "offline-assets.json", source: JSON.stringify({ assets }) });
    },
  }],
  server: { port: 3000 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
