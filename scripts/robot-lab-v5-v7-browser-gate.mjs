import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.OTT_WEB_URL ?? "http://localhost:3000";
const apiOrigin = process.env.OTT_API_URL ?? "http://localhost:3001";
const outputDir = "docs/robot-lab-visual-reference";
await mkdir(outputDir, { recursive: true });

const user = {
  id: "u-v5-v7",
  fullName: "Minh Nguyễn",
  displayName: "Minh",
  username: "minh",
  theme: "dark",
  avatarPreset: "robot",
  privacy: { presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" },
  stats: { elo: 1240, rankedWins: 24, rankedLosses: 15, quickWins: 7, quickLosses: 4 },
  botStats: { wins: 9, losses: 3 },
};
const digest = "a".repeat(64);
const now = "2026-10-05T00:00:00.000Z";
const botRevision = { id: "rev-1", revisionNumber: 1, status: "PASSED", sdkVersion: "1.0.0", schemaVersion: "1.0", sourceDigest: digest, sourceBytes: 96, validationMessage: null, preflightMs: 42, createdAt: now, updatedAt: now, memoryPolicy: "RESET_ON_NEW_REVISION", availability: ["ONLINE", "OFFLINE"], activeForMatchId: null, pendingForMatchId: null, sourceExpiresAt: null };
const bot = { id: "bot-1", name: "Bot Xanh · Mẫu", createdAt: now, updatedAt: now, usedBytes: 96, revisions: [botRevision] };
const board = {};
for (const file of "abcdefghi") {
  board[`${file}1`] = { id: `blue-${file}`, side: "BLUE", type: file === "b" || file === "e" || file === "h" ? "P" : file === "c" || file === "f" ? "S" : "R" };
  board[`${file}9`] = { id: `red-${file}`, side: "RED", type: file === "b" || file === "e" || file === "h" ? "P" : file === "c" || file === "f" ? "S" : "R" };
}
const matchId = "11111111-1111-4111-8111-111111111111";
const blue = { userId: "u-v5-v7", username: "minh", displayName: "Minh", side: "BLUE", isViewer: true, isWinner: true, ratingBefore: 1240, ratingAfter: 1248, ratingDelta: 8 };
const red = { userId: "u-opponent", username: "anh", displayName: "Minh Anh", side: "RED", isViewer: false, isWinner: false, ratingBefore: 1250, ratingAfter: 1242, ratingDelta: -8 };
const historyMatch = { matchId, roomId: "RBT204", mode: "BOT_ONLINE", status: "FINISHED", result: "WIN", resultReason: "EXTINCTION", winner: "BLUE", viewer: blue, opponent: red, timerSeconds: 180, startedAt: now, endedAt: now, durationSeconds: 94, ratingDelta: 8, finalBoard: board, source: "ACCOUNT", replayAvailable: true, moveCount: 2, botAdjudication: undefined };
const replay = { available: true, moves: [{ sequence: 0, stateVersion: 1, side: "BLUE", from: "b1", to: "b2", capturedPieceId: null, committedAt: now }, { sequence: 1, stateVersion: 2, side: "RED", from: "b9", to: "b8", capturedPieceId: null, committedAt: now }], timeline: [{ sequence: 0, type: "MATCH_STARTED", timestamp: now }, { sequence: 1, type: "PIECE_MOVE_ACCEPTED", timestamp: now, side: "BLUE" }, { sequence: 2, type: "MATCH_FINISHED", timestamp: now, reason: "Extinction" }], legacyFinalBoardOnly: false };
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const json = (route, payload, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });

async function inspect(page, label) {
  const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  assert(!result.overflow, `${label}: horizontal overflow (${result.width} > ${result.viewport})`);
}

async function installFixtures(page) {
  const isApi = (route) => route.request().url().startsWith(apiOrigin);
  await page.route("**/auth/me", (route) => isApi(route) ? json(route, { user }) : route.continue());
  await page.route("**/health", (route) => isApi(route) ? json(route, { status: "ok", components: { application: { status: "ok" }, database: { status: "ok" }, realtime: { status: "ok" } } }) : route.continue());
  await page.route("**/bot-library**", (route) => {
    if (!isApi(route)) return route.continue();
    if (route.request().url().includes("/sdk")) return json(route, { sdkVersion: "1.0.0", schemaVersion: "1.0", allowlist: ["state", "legal_moves", "memory"], template: "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n", limits: { sourceBytes: 65536, memoryBytes: 1048576, perTurnMs: 250, wholeMatchMs: 30000 } });
    return json(route, { bots: [bot], quotaBytes: 262144, usedBytes: 96 });
  });
  await page.route("**/history**", (route) => {
    const url = route.request().url();
    if (!isApi(route)) return route.continue();
    if (url.includes("/audit")) return json(route, { match: historyMatch, replay, exportedAt: now, retention: { sourceUntil: now, logsUntil: now } });
    if (/\/history\/[^/?]+(?:\?|$)/.test(url)) return json(route, { match: { ...historyMatch, players: [blue, red], replay } });
    return json(route, { matches: [historyMatch], nextCursor: null, hasMore: false, summary: { elo: 1240, wins: 24, losses: 15, total: 39, winRate: 61.5 } });
  });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ["dark", "light"]) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      const context = await browser.newContext({ viewport, colorScheme: theme });
      await context.addInitScript((choice) => localStorage.setItem("ottv2.theme", choice), theme);
      const page = await context.newPage();
      await installFixtures(page);

      await page.goto(`${baseURL}/bot-lab`, { waitUntil: "domcontentloaded" });
      await page.locator(".robot-lab-bot-workbench").waitFor({ state: "visible", timeout: 10000 });
      assert(await page.locator(".bot-workbench-grid > .bot-workbench-panel").count() === 3, `${theme}/${viewport.width}: Workbench 3 regions missing`);
      await inspect(page, `workbench ${theme}/${viewport.width}`);
      await page.screenshot({ path: `${outputDir}/v5-workbench-${theme}-${viewport.width}.png`, fullPage: false });

      await page.goto(`${baseURL}/dau-chuong-trinh/online`, { waitUntil: "domcontentloaded" });
      await page.locator(".robot-lab-bot-online").waitFor({ state: "visible", timeout: 10000 });
      assert(await page.locator(".bot-online-grid > .bot-online-panel").count() === 3, `${theme}/${viewport.width}: Bot Online 3 panels missing`);
      await inspect(page, `bot-online ${theme}/${viewport.width}`);
      await page.screenshot({ path: `${outputDir}/v5-bot-online-${theme}-${viewport.width}.png`, fullPage: false });

      await page.goto(`${baseURL}/dau-chuong-trinh/offline`, { waitUntil: "domcontentloaded" });
      await page.locator(".robot-lab-bot-offline").waitFor({ state: "visible", timeout: 10000 });
      assert(await page.locator(".bot-offline-slot").count() === 2, `${theme}/${viewport.width}: Bot Offline slots missing`);
      await inspect(page, `bot-offline ${theme}/${viewport.width}`);
      await page.screenshot({ path: `${outputDir}/v5-bot-offline-${theme}-${viewport.width}.png`, fullPage: false });

      await page.goto(`${baseURL}/lich-su`, { waitUntil: "domcontentloaded" });
      await page.locator(".robot-lab-history-page").waitFor({ state: "visible", timeout: 10000 });
      await page.locator(".history-card").first().waitFor({ state: "visible", timeout: 10000 });
      assert(await page.locator(".history-card").count() === 1, `${theme}/${viewport.width}: history fixture card missing`);
      await inspect(page, `history ${theme}/${viewport.width}`);
      await page.screenshot({ path: `${outputDir}/v7-history-${theme}-${viewport.width}.png`, fullPage: false });
      await context.close();
    }
  }

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: "dark" });
  const mobilePage = await mobile.newPage();
  await installFixtures(mobilePage);
  for (const [path, selector, label] of [["/bot-lab", ".robot-lab-bot-workbench", "workbench dark/375"], ["/lich-su", ".robot-lab-history-page", "history dark/375"]]) {
    await mobilePage.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
    await mobilePage.locator(selector).waitFor({ state: "visible", timeout: 10000 });
    await inspect(mobilePage, label);
  }
  await mobile.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`V5/V7 browser gate failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("V5/V7 browser gate passed: Bot Workbench/Online/Offline and History were checked at desktop themes plus mobile overflow smoke. API responses were intercepted fixtures; this is visual evidence, not production-runtime proof.");
}
