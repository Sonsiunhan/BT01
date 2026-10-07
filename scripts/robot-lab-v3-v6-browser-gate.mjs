import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.OTT_WEB_URL ?? "http://localhost:3000";
const outputDir = "docs/robot-lab-visual-reference";
await mkdir(outputDir, { recursive: true });

const queue = {
  queueId: "00000000-0000-4000-8000-000000000005",
  mode: "RANKED",
  status: "QUEUED",
  player: { userId: "u1", username: "minh", displayName: "Minh", elo: 1240 },
  opponent: null,
  range: 100,
  elapsedMs: 23_000,
  joinedAt: Date.now() - 23_000,
  roomId: null,
  matchId: null,
};

const friend = { userId: "u2", username: "minh-anh", displayName: "Minh Anh", elo: 1180, rankedWins: 12, rankedLosses: 8, presence: "ONLINE", isFriend: true, requestStatus: null };
const request = { requestId: "11111111-1111-4111-8111-111111111111", user: { ...friend, isFriend: false, requestStatus: "PENDING" }, direction: "incoming", status: "PENDING", createdAt: "2026-10-02T09:00:00.000Z" };

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const json = (route, payload, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });

async function installFixtures(page) {
  await page.route("**/matchmaking/queue", async (route) => {
    if (route.request().method() === "POST") return json(route, { queue });
    return route.continue();
  });
  await page.route("**/matchmaking/queue/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/events")) return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": fixture\n\n" });
    if (route.request().method() === "DELETE") return json(route, { queue: { ...queue, status: "CANCELLED" } });
    return json(route, { queue });
  });
  await page.route("**/social/friends*", (route) => json(route, { friends: [friend] }));
  await page.route("**/social/requests*", (route) => json(route, { requests: [request] }));
  await page.route("**/social/invites*", (route) => json(route, { invites: [] }));
  await page.route("**/rooms/referee/invites*", (route) => json(route, { invites: [] }));
  await page.route("**/social/presence/events*", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": fixture\n\n" }));
}

async function inspect(page, label) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  assert(!result.overflow, `${label}: horizontal overflow (${result.width} > ${result.viewport})`);
  return result;
}

const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ["dark", "light"]) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      const context = await browser.newContext({ viewport, colorScheme: theme });
      await context.addInitScript((choice) => localStorage.setItem("ottv2.theme", choice), theme);
      const page = await context.newPage();
      await installFixtures(page);

      await page.goto(`${baseURL}/queue`, { waitUntil: "domcontentloaded" });
      await page.locator(".queue-visual-shell").waitFor({ state: "visible", timeout: 10_000 });
      assert(await page.locator('[data-robot="queue-host"]').count() === 1, `${theme}/${viewport.width}: queue Robot Lab host missing`);
      assert(await page.getByRole("button", { name: "Huỷ tìm trận" }).count() === 1, `${theme}/${viewport.width}: explicit queue cancel missing`);
      assert(await page.getByText("00:23").count() === 1, `${theme}/${viewport.width}: useful elapsed time missing`);
      await inspect(page, `queue ${theme}/${viewport.width}`);
      await page.screenshot({ path: `${outputDir}/v3-queue-${theme}-${viewport.width}.png`, fullPage: false });

      await page.goto(`${baseURL}/ban-be`, { waitUntil: "domcontentloaded" });
      await page.locator(".friends-visual-shell").waitFor({ state: "visible", timeout: 10_000 });
      assert(await page.getByRole("tab", { name: /BẠN BÈ/ }).count() === 1, `${theme}/${viewport.width}: Friends tab missing`);
      assert(await page.getByRole("tab", { name: /LỜI MỜI/ }).count() === 1, `${theme}/${viewport.width}: incoming tab missing`);
      assert(await page.getByRole("tab", { name: /ĐÃ GỬI/ }).count() === 1, `${theme}/${viewport.width}: sent tab missing`);
      assert(await page.getByRole("tab", { name: /TÌM NGƯỜI CHƠI/ }).count() === 1, `${theme}/${viewport.width}: search tab missing`);
      assert(await page.getByText("Minh Anh").count() >= 1, `${theme}/${viewport.width}: friend identity missing`);
      await inspect(page, `friends ${theme}/${viewport.width}`);
      await page.screenshot({ path: `${outputDir}/v6-friends-${theme}-${viewport.width}.png`, fullPage: false });
      await context.close();
    }
  }

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: "dark" });
  const mobilePage = await mobile.newPage();
  await installFixtures(mobilePage);
  await mobilePage.goto(`${baseURL}/queue`, { waitUntil: "domcontentloaded" });
  await mobilePage.locator(".queue-visual-shell").waitFor({ state: "visible", timeout: 10_000 });
  await inspect(mobilePage, "queue dark/375");
  await mobilePage.goto(`${baseURL}/ban-be`, { waitUntil: "domcontentloaded" });
  await mobilePage.locator(".friends-visual-shell").waitFor({ state: "visible", timeout: 10_000 });
  await inspect(mobilePage, "friends dark/375");
  await mobile.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`V3/V6 browser gate failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("V3/V6 browser gate passed: Queue/Waiting visual contract hooks and Friends tabs were checked at desktop themes plus 375px overflow smoke. API responses were intercepted fixtures; this is visual evidence, not production-runtime proof.");
}
