import { chromium } from "playwright";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { default: AxeBuilder } = await import(pathToFileURL(require.resolve("@axe-core/playwright")).href);
const base = process.env.OTT_WEB_URL ?? "http://127.0.0.1:3000";
const user = { id: "v9-account", fullName: "Minh Nguyễn", displayName: "Minh", username: "minh", theme: "dark", avatarPreset: "robot", privacy: { presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" }, stats: { elo: 1240, rankedWins: 24, rankedLosses: 15, quickWins: 7, quickLosses: 4 }, botStats: { wins: 9, losses: 3 } };
const browser = await chromium.launch();
const evidence = [];
const assert = (ok, message) => { if (!ok) throw new Error(message); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("ottv2.theme", "light"));
  const page = await context.newPage();
  await page.route("http://localhost:3001/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/me") return route.fulfill({ json: { user } });
    if (path === "/auth/register") return route.fulfill({ json: { user, recoveryCode: "ABCD-EFGH" } });
    if (path === "/social/blocks") return route.fulfill({ json: { users: [] } });
    return route.fulfill({ status: 503, json: { message: "Dịch vụ đang bận.", code: "UNAVAILABLE" } });
  });
  for (const tab of ["account", "privacy", "blocked"]) {
    await page.goto(`${base}/cai-dat?tab=${tab}`);
    await page.getByRole("tabpanel").waitFor();
    if (tab === "blocked") await page.getByText("Bạn chưa chặn người chơi nào.").waitFor();
    assert(await page.evaluate(() => document.documentElement.dataset.theme) === "light", "Account GET overwrote stored Light");
    const axe = await new AxeBuilder({ page }).include(".robot-lab-settings-page").analyze();
    assert(!axe.violations.some((item) => ["serious", "critical"].includes(item.impact)), `Account tab ${tab} accessibility`);
    evidence.push({ tab, themeRetained: true, seriousCritical: 0 });
  }
  await page.goto(`${base}/dang-nhap`);
  await page.screenshot({ path: "docs/robot-lab-visual-reference/v9-login-final-light.png", fullPage: true });
  const robot = page.locator(".auth-robot");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  const idle = await robot.evaluate((node) => ({ transform: getComputedStyle(node).transform, transition: getComputedStyle(node).transitionDuration, animation: getComputedStyle(node).animationName }));
  await page.locator(".auth-companion").hover();
  await page.waitForTimeout(200);
  const hover = await robot.evaluate((node) => getComputedStyle(node).transform);
  assert(idle.transform === "none" && idle.animation === "none" && idle.transition === "0.16s" && hover === "matrix(1, 0, 0, 1, 0, -4)", "Robot motion differs from approved idle/160ms/-4px contract");
  evidence.push({ motion: { idle, hover } });
  await page.goto(`${base}/dang-ky`);
  for (const [label, value] of [["Họ và tên", "Người Chơi"], ["Tên hiển thị", "Minh"], ["Username", "player"]]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.locator("#register-password").fill("password1");
  await page.locator("#register-confirm-password").fill("password1");
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await page.getByRole("heading", { name: "Mã khôi phục" }).waitFor();
  assert(await page.getByRole("link", { name: "Tôi đã lưu mã" }).getAttribute("aria-disabled") === "true", "Recovery acknowledgment missing");
  await page.getByRole("button", { name: "Sao chép mã" }).click();
  await page.locator(".toast").waitFor();
  const overlap = await page.evaluate(() => {
    const toast = document.querySelector(".toast").getBoundingClientRect();
    return [...document.querySelectorAll(".auth-card .button")].some((node) => {
      const rect = node.getBoundingClientRect();
      return toast.left < rect.right && toast.right > rect.left && toast.top < rect.bottom && toast.bottom > rect.top;
    });
  });
  assert(!overlap, "Toast covers authentication CTA");
  const toastAxe = await new AxeBuilder({ page }).include(".robot-lab-auth-layout").include(".toast-viewport").analyze();
  assert(!toastAxe.violations.some((item) => ["serious", "critical"].includes(item.impact)), "Recovery/toast accessibility");
  evidence.push({ recoveryAcknowledgment: true, toastDoesNotCoverCTA: true, seriousCritical: 0 });
  await context.close();
  console.log("V9 interaction PASS: account tabs, stored theme retained, measured robot motion, recovery acknowledgment and toast placement.");
} catch (error) { evidence.push({ failure: error.message }); console.error(error.message); process.exitCode = 1; }
finally { await browser.close(); await writeFile("docs/robot-lab-visual-reference/v9-interaction-report.json", JSON.stringify({ fixtures: true, evidence }, null, 2)); }
