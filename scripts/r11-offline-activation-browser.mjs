import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const origin = process.env.OTT_PREVIEW_URL ?? "http://127.0.0.1:4176";
assert.equal(new URL(origin).hostname, "127.0.0.1", "Local acceptance only");
const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
const context = await browser.newContext({ serviceWorkers: "allow" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(String(error)));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
const evidence = { measuredAt: new Date().toISOString(), origin, fixedAttestationOnly: true, playerCodeExecuted: false, status: "FAIL", errors, cases: [] };
try {
  await page.route("**/api/**", route => route.fulfill({ status: 401, json: { code: "UNAUTHORIZED", message: "Local acceptance" } }));
  await page.route("http://localhost:3001/**", route => route.fulfill({ status: 401, json: { code: "UNAUTHORIZED", message: "Local acceptance" } }));
  await page.goto(`${origin}/dau-chuong-trinh/offline`);
  await page.getByRole("heading", { name: "Bot Offline", exact: true }).waitFor();
  const kitButton = page.getByRole("button", { name: /Tải Offline kit|Kiểm tra lại kit/, exact: true });
  await kitButton.click();
  await page.getByText("Offline kit đã sẵn sàng và sandbox đã được xác minh; Bot Offline không cần server.", { exact: true }).waitFor({ timeout: 60000 });
  assert.equal(await page.getByText("Python Offline chưa được xác minh trong sandbox của trình duyệt này.", { exact: false }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Chạy", exact: true }).isDisabled(), true, "Run remains gated until both slots are Ready");
  assert.equal(await page.getByRole("button", { name: "Từng nước", exact: true }).isDisabled(), true, "Step remains gated until both slots are Ready");
  evidence.cases.push({ name: "builtProductDynamicAttestationUnlocksRuntimeGate", pass: true });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Bot Offline", exact: true }).waitFor();
  await page.getByText("Offline sandbox đã được xác minh; Bot chỉ chạy trong iframe opaque-origin + Worker cô lập.", { exact: true }).waitFor({ timeout: 120000 });
  assert.equal(await page.getByRole("button", { name: "Chạy", exact: true }).isDisabled(), true, "Cold Offline Run remains gated until both slots are Ready");
  evidence.cases.push({ name: "coldReloadReattestsFromCachedKitWithoutNetwork", pass: true });
  evidence.status = "PASS_FIXED_ATTESTATION_SCOPE";
} catch (error) {
  evidence.failure = String(error.stack ?? error);
  evidence.visibleText = (await page.locator("body").innerText().catch(() => "")).slice(0, 5000);
  process.exitCode = 1;
} finally {
  evidence.errors = errors;
  await writeFile("docs/robot-lab-visual-reference/r11-offline-activation-browser.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
  await browser.close();
}
