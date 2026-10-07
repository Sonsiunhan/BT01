import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.OTT_WEB_URL ?? "http://localhost:3000";
const outputDir = "docs/robot-lab-visual-reference";
await mkdir(outputDir, { recursive: true });

const user = {
  id: "u-v4-v8",
  fullName: "Minh Nguyễn",
  displayName: "Minh",
  username: "minh",
  theme: "dark",
  avatarPreset: "robot",
  privacy: { presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" },
  stats: { elo: 1240, rankedWins: 24, rankedLosses: 15, quickWins: 7, quickLosses: 4 },
  botStats: { wins: 9, losses: 3 },
};

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const json = (route, payload, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });

async function inspect(page, label) {
  const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  assert(!result.overflow, `${label}: horizontal overflow (${result.width} > ${result.viewport})`);
}

async function installFixtures(page) {
  await page.route("**/auth/me", (route) => json(route, { user }));
}

const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ["dark", "light"]) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      const context = await browser.newContext({ viewport, colorScheme: theme });
      await context.addInitScript((choice) => localStorage.setItem("ottv2.theme", choice), theme);
      const page = await context.newPage();
      await installFixtures(page);

      await page.goto(`${baseURL}/room/w1-demo`, { waitUntil: "domcontentloaded" });
      await page.locator(".robot-lab-game-room").waitFor({ state: "visible", timeout: 10_000 });
      assert(await page.locator(".robot-lab-board-panel").count() === 1, `${theme}/${viewport.width}: board panel missing`);
      assert(await page.locator(".robot-lab-board-panel .board-square").count() === 81, `${theme}/${viewport.width}: canonical 9x9 board missing`);
      assert(await page.getByRole("button", { name: "XANH" }).count() === 1, `${theme}/${viewport.width}: fixture view controls missing`);
      await inspect(page, `game ${theme}/${viewport.width}`);
      await page.screenshot({ path: `${outputDir}/v4-game-${theme}-${viewport.width}.png`, fullPage: false });

      await page.goto(`${baseURL}/ho-so`, { waitUntil: "domcontentloaded" });
      await page.locator(".robot-lab-profile-shell").waitFor({ state: "visible", timeout: 10_000 });
      assert(await page.getByRole("heading", { name: "Minh" }).count() >= 1, `${theme}/${viewport.width}: profile identity missing`);
      assert(await page.getByText("ĐẤU BOT · KHÔNG XẾP HẠNG").count() === 1, `${theme}/${viewport.width}: Bot split missing`);
      await inspect(page, `profile ${theme}/${viewport.width}`);
      await page.screenshot({ path: `${outputDir}/v8-profile-${theme}-${viewport.width}.png`, fullPage: false });
      await context.close();
    }
  }

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: "dark" });
  const mobilePage = await mobile.newPage();
  await installFixtures(mobilePage);
  await mobilePage.goto(`${baseURL}/room/w1-demo`, { waitUntil: "domcontentloaded" });
  await mobilePage.locator(".robot-lab-game-room").waitFor({ state: "visible", timeout: 10_000 });
  await inspect(mobilePage, "game dark/375");
  await mobilePage.goto(`${baseURL}/ho-so`, { waitUntil: "domcontentloaded" });
  await mobilePage.locator(".robot-lab-profile-shell").waitFor({ state: "visible", timeout: 10_000 });
  await inspect(mobilePage, "profile dark/375");
  await mobile.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`V4/V8 browser gate failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("V4/V8 browser gate passed: Game/Board and Profile Robot Lab hooks were checked at desktop themes plus 375px overflow smoke. API responses were intercepted fixtures; this is visual evidence, not production-runtime proof.");
}
