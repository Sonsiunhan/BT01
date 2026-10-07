import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const base = process.env.OTT_PREVIEW_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch();
const evidence = {};
try {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  await page.route("http://localhost:3001/**", (route) => route.fulfill({ status: 401, json: { message: "Bạn cần đăng nhập.", code: "UNAUTHORIZED" } }));
  await page.goto(`${base}/offline`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.reload();
  await page.getByRole("button", { name: "Bắt đầu ván" }).click();
  await page.locator(".board-piece-token img").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    const urls = (await Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).map((request) => request.url)))).flat();
    return urls.filter((url) => /white-glove.*\.png$/.test(url)).length === 6;
  });
  const warm = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).map((request) => request.url)))).flat();
  });
  evidence.cachedPNGs = warm.filter((url) => /white-glove.*\.png$/.test(url)).length;
  evidence.cachedFonts = warm.filter((url) => /\/fonts\/.*\.ttf$/.test(url)).length;
  evidence.cachedUrls = warm;
  if (evidence.cachedPNGs !== 6) throw new Error("Original PNG artwork did not finish caching");
  if (!evidence.cachedFonts) throw new Error("Local TTF fonts are not cached by the service worker");
  await page.close();
  await context.setOffline(true);
  const cold = await context.newPage();
  const servedBySW = [];
  cold.on("response", (response) => { if (response.fromServiceWorker()) servedBySW.push(response.url()); });
  await cold.goto(`${base}/offline`);
  await cold.locator(".board-piece-token img").first().waitFor();
  await cold.evaluate(() => document.fonts.ready);
  evidence.originalImagesLoaded = await cold.locator(".board-piece-token img").evaluateAll((nodes) => nodes.length === 18 && nodes.every((node) => node.complete && node.naturalWidth > 0));
  evidence.swAssetResponses = servedBySW.filter((url) => /white-glove.*\.png$|\/fonts\/.*\.ttf$/.test(url));
  if (!evidence.originalImagesLoaded || !evidence.swAssetResponses.some((url) => url.endsWith(".ttf"))) throw new Error("Cold offline artwork/font load failed");
  console.log("V9 production-build offline cold reload PASS: original PNG artwork and local fonts served by SW in a new offline page.");
} catch (error) { evidence.failure = error.message; console.error(error.message); process.exitCode = 1; }
finally {
  await browser.close();
  await writeFile(process.env.OTT_OFFLINE_EVIDENCE ?? "docs/robot-lab-visual-reference/v9-offline-assets.json", JSON.stringify(evidence, null, 2));
}
