import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.OTT_WEB_URL ?? "http://localhost:3000";
const outputDir = "docs/robot-lab-visual-reference";
await mkdir(outputDir, { recursive: true });
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const browser = await chromium.launch({ headless: true });

try {
  for (const theme of ["dark", "light"]) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      const context = await browser.newContext({ viewport, colorScheme: theme });
      await context.addInitScript((choice) => localStorage.setItem("ottv2.theme", choice), theme);
      const page = await context.newPage();
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await page.locator(".home-lobby-hero").waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(400);
      const initial = await page.evaluate(() => {
        const main = document.querySelector(".home-lobby-main");
        const profile = document.querySelector(".home-profile-panel");
        const root = document.documentElement;
        return {
          theme: root.dataset.theme,
          robot: Boolean(document.querySelector('[data-robot="full-body"]')),
          orb: Boolean(document.querySelector(".home-lobby-hero .hero-orb")),
          tilt: Boolean(document.querySelector(".home-lobby-hero.b3-pointer-surface")),
          direct: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(),
          botCards: Boolean(document.querySelector(".mode-bot-online")),
          mainWidth: main?.getBoundingClientRect().width ?? 0,
          profileWidth: profile?.getBoundingClientRect().width ?? 0,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      const size = `${viewport.width}x${viewport.height}`;
      assert(initial.theme === theme, `${theme}/${size}: theme mismatch`);
      assert(initial.robot, `${theme}/${size}: full-body Robot Lab host missing`);
      assert(!initial.orb, `${theme}/${size}: legacy hero orb still rendered`);
      assert(!initial.tilt, `${theme}/${size}: legacy pointer surface still rendered`);
      assert(initial.direct === "Chơi trực tiếp", `${theme}/${size}: direct tab not active initially`);
      assert(!initial.botCards, `${theme}/${size}: Bot cards visible in Direct tab`);
      assert(initial.mainWidth > initial.profileWidth * 1.45, `${theme}/${size}: main/profile ratio is not Robot Lab 1.8 layout`);
      assert(!initial.overflow, `${theme}/${size}: horizontal overflow`);
      await page.screenshot({ path: `${outputDir}/v2-home-${theme}-${viewport.width}-direct.png`, fullPage: false });
      await page.getByRole("tab", { name: "Đấu chương trình" }).click();
      await page.getByRole("link", { name: "Bot Online Đấu bot qua phòng custom" }).waitFor({ state: "visible" });
      assert(await page.getByRole("link", { name: /ĐẤU BOT ONLINE/ }).getAttribute("href") === "/dau-chuong-trinh/online", `${theme}/${size}: Bot Online CTA route mismatch`);
      assert(await page.getByRole("button", { name: "Xếp hạng" }).count() === 0, `${theme}/${size}: Ranked selector leaked into Bot tab`);
      await page.screenshot({ path: `${outputDir}/v2-home-${theme}-${viewport.width}-bot.png`, fullPage: false });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator(".home-lobby-hero").waitFor({ state: "visible", timeout: 10_000 });
      assert(await page.getByRole("tab", { name: "Đấu chương trình" }).getAttribute("aria-selected") === "true", `${theme}/${size}: selected tab did not persist`);
      await page.screenshot({ path: `${outputDir}/v2-home-${theme}-${viewport.width}.png`, fullPage: false });
      await page.goto(`${baseURL}/phong-online`, { waitUntil: "domcontentloaded" });
      await page.locator(".room-browser-full").waitFor({ state: "visible", timeout: 10_000 });
      const rooms = await page.evaluate(() => {
        const existing = document.querySelector(".room-browser-full .room-grid-items");
        const grid = existing ?? Object.assign(document.createElement("div"), { className: "room-grid-items" });
        if (!existing) { grid.style.position = "absolute"; grid.style.width = "100px"; document.querySelector(".room-browser-full")?.appendChild(grid); }
        const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
        if (!existing) grid.remove();
        return { columns, hasData: Boolean(existing), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      const expectedColumns = viewport.width >= 1200 ? 3 : 2;
      assert(rooms.columns === expectedColumns, `${theme}/${size}: room browser expected ${expectedColumns} columns, got ${rooms.columns}`);
      assert(!rooms.overflow, `${theme}/${size}: room browser horizontal overflow`);
      await context.close();
    }
  }
  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: "dark" });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(baseURL, { waitUntil: "domcontentloaded" });
  await mobilePage.locator(".home-lobby-hero").waitFor({ state: "visible", timeout: 10_000 });
  const mobileOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert(!mobileOverflow, "375x812: horizontal overflow");
  await mobile.close();
} finally { await browser.close(); }

if (failures.length) { console.error(`V2 browser gate failed:\n- ${failures.join("\n- ")}`); process.exitCode = 1; }
else console.log("V2 browser gate passed: Robot Lab Home tabs, host, 1.8 layout, CTA routing, persistence and responsive overflow.");
