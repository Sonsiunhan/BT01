import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.OTT_WEB_URL ?? "http://localhost:3000";
const outputDir = "docs/robot-lab-visual-reference";
await mkdir(outputDir, { recursive: true });

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const expected = {
  dark: { bg: "#0b1421", surface: "#142134" },
  light: { bg: "#eaf0f5", surface: "#fdfefe" },
};

const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ["dark", "light"]) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      const context = await browser.newContext({ viewport, colorScheme: theme });
      await context.addInitScript((choice) => localStorage.setItem("ottv2.theme", choice), theme);
      const page = await context.newPage();
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await page.locator(".app-header").waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(800);

    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const header = document.querySelector(".app-header");
      const nav = [...document.querySelectorAll(".main-nav a")].map((link) => link.textContent?.trim());
      const styles = getComputedStyle(root);
      return {
        theme: root.dataset.theme,
        bg: styles.getPropertyValue("--bg-root").trim().toLowerCase(),
        surface: styles.getPropertyValue("--surface-1").trim().toLowerCase(),
        motion: styles.getPropertyValue("--motion-fast").trim(),
        wordmark: Boolean(document.querySelector('[data-brand="robot-lab-wordmark"]')),
        nav,
        fontReady: document.fonts.check('700 16px "Be Vietnam Pro"'),
        headerOverflow: header ? header.scrollWidth > header.clientWidth : true,
      };
    });
      const size = `${viewport.width}x${viewport.height}`;
      assert(result.theme === theme, `${theme}/${size}: expected data-theme=${theme}, got ${result.theme}`);
      assert(result.bg === expected[theme].bg, `${theme}/${size}: unexpected --bg-root ${result.bg}`);
      assert(result.surface === expected[theme].surface, `${theme}/${size}: unexpected --surface-1 ${result.surface}`);
      assert(result.motion === "190ms", `${theme}/${size}: expected 190ms motion, got ${result.motion}`);
      assert(result.wordmark, `${theme}/${size}: Robot Lab wordmark missing`);
      assert(result.nav.join("|") === "Sảnh|Xưởng Bot|Đấu trường|Bạn bè|Lịch sử|Hồ sơ", `${theme}/${size}: main nav mismatch (${result.nav.join("|")})`);
      assert(result.fontReady, `${theme}/${size}: Be Vietnam Pro was not ready`);
      assert(!result.headerOverflow, `${theme}/${size}: header overflows`);
      await page.screenshot({ path: `${outputDir}/v1-shell-${theme}-${viewport.width}.png`, fullPage: false });
      await context.close();
    }
  }

  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await reduced.addInitScript(() => localStorage.setItem("ottv2.theme", "dark"));
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(baseURL, { waitUntil: "domcontentloaded" });
  await reducedPage.locator(".app-header").waitFor({ state: "visible", timeout: 10_000 });
  const reducedMarker = await reducedPage.evaluate(() => document.documentElement.dataset.reducedMotion);
  assert(reducedMarker === "true", `reduced-motion marker expected true, got ${reducedMarker}`);
  await reduced.close();
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`V1 browser gate failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("V1 browser gate passed: dark/light shell, six-nav Robot Lab brand, local font, motion and reduced-motion checks.");
}
