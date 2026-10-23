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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll("\\\\", "/");
          if (normalized.includes("/apps/web/src/features/admin/tournaments/")) return "admin-tournaments";
          if (normalized.includes("/apps/web/src/features/admin/")) return "admin-pages";
          if (normalized.includes("/apps/web/src/pages/")) return "app-pages";
        },
      },
    },
  },
  // Local P16/browser QA uses the server-authoritative API rather than a
  // Vite fallback document. Production can still set VITE_API_BASE_URL.
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
