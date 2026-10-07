import { chromium } from "playwright";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { default: AxeBuilder } = await import(pathToFileURL(require.resolve("@axe-core/playwright")).href);
const baseURL = process.env.OTT_WEB_URL ?? "http://127.0.0.1:3000";
const apiOrigin = process.env.OTT_API_URL ?? "http://localhost:3001";
const outputDir = "docs/robot-lab-visual-reference";
await mkdir(outputDir, { recursive: true });
const failures = [];
const evidence = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const browser = await chromium.launch();
const routes = [
  ["/cai-dat?tab=appearance", ".robot-lab-settings-page", "settings"],
  ["/cai-dat?tab=diagnostics", ".robot-lab-settings-page", "diagnostics"],
  ["/cai-dat?tab=local-data", ".robot-lab-settings-page", "local-data"],
  ["/dang-nhap", ".robot-lab-auth-layout", "login"],
  ["/dang-ky", ".robot-lab-auth-layout", "register"],
  ["/quen-mat-khau", ".robot-lab-auth-layout", "recovery"],
  ["/guest", ".robot-lab-auth-layout", "guest"],
  ["/v9-missing-page", ".robot-lab-fallback-panel", "404"],
];
try {
  for (const theme of ["dark", "light"]) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 375, height: 812 }, { width: 768, height: 1024 }]) {
      const context = await browser.newContext({ viewport, colorScheme: theme, serviceWorkers: "block" });
      await context.addInitScript((theme) => localStorage.setItem("ottv2.theme", theme), theme);
      const page = await context.newPage();
      page.on("pageerror", (error) => failures.push(`${theme}/${viewport.width}: ${error.message}`));
      await page.route(`${apiOrigin}/**`, (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/health") return route.fulfill({ json: { status: "ok", service: "ottv2-server", version: "test", protocolVersion: "0.1", timestamp: new Date().toISOString(), components: { application: { status: "ok" }, database: { status: "ok" }, realtime: { status: "ok" } } } });
        return route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." } } });
      });
      for (const [path, selector, label] of routes) {
        await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
        await page.locator(selector).waitFor();
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert(!overflow, `${label}/${theme}/${viewport.width}: overflow`);
        assert(await page.evaluate(() => document.documentElement.dataset.theme) === theme, `${label}: theme choice overwritten`);
        const accessibility = await new AxeBuilder({ page }).include(selector).analyze();
        const severe = accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact));
        assert(!severe.length, `${label}/${theme}/${viewport.width}: axe ${severe.map((item) => item.id).join(",")}`);
        if (viewport.width >= 1366) await page.screenshot({ path: `${outputDir}/v9-${label}-${theme}-${viewport.width}.png`, fullPage: true });
        evidence.push({ label, theme, viewport, overflow, seriousCritical: severe });
      }
      await page.goto(`${baseURL}/cai-dat?tab=appearance`);
      await page.getByRole("tabpanel", { name: "Giao diện" }).waitFor();
      await page.getByRole("tab", { name: "Giao diện" }).focus();
      await page.keyboard.press("ArrowRight");
      assert(await page.getByRole("tab", { name: "Âm thanh" }).evaluate((node) => node === document.activeElement), "Settings roving focus");
      await page.getByRole("tab", { name: "Dữ liệu" }).click();
      await page.getByRole("button", { name: "Xóa dữ liệu trên thiết bị", exact: true }).click();
      await page.getByRole("dialog", { name: "Xóa dữ liệu trên thiết bị?" }).waitFor();
      await page.keyboard.press("Escape");
      assert(await page.getByRole("button", { name: "Xóa dữ liệu trên thiết bị", exact: true }).evaluate((node) => node === document.activeElement), "Delete cancel restores focus");

      await page.goto(`${baseURL}/offline`);
      await page.getByRole("button", { name: /Bắt đầu/ }).click();
      await page.locator(".board-piece-token img").first().waitFor();
      const artwork = await page.locator(".board-piece-token img").evaluateAll((nodes) => nodes.map((node) => ({ loaded: node.complete && node.naturalWidth > 0, filter: getComputedStyle(node).filter, source: node.getAttribute("data-artwork"), type: node.getAttribute("data-gesture") })));
      assert(artwork.length === 18 && artwork.every((item) => item.loaded && item.filter === "none" && item.source === "robot-lab-demo"), `Original artwork not rendered: ${theme}/${viewport.width}`);
      assert(new Set(artwork.map((item) => item.type)).size === 3, "Three distinct reference gestures missing");
      if (viewport.width === 1440) await page.screenshot({ path: `${outputDir}/gesture-correction-game-${theme}.png`, fullPage: true });
      await context.close();
    }
  }
  const reduced = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await reduced.newPage();
  await page.goto(`${baseURL}/dang-nhap`);
  await page.locator(".auth-companion").hover();
  assert(await page.locator(".auth-robot").evaluate((node) => getComputedStyle(node).transform) === "none", "Reduced Motion robot hover moves");
  await reduced.close();
} finally { await browser.close(); }
await writeFile(`${outputDir}/v9-browser-report.json`, JSON.stringify({ fixtures: "API 401/health only; not real-service acceptance or Python runtime proof", evidence, failures }, null, 2));
if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
else console.log("V9 browser gate PASS: eight routes × two themes × four viewports, keyboard/confirmation, original gesture loading and Reduced Motion.");
