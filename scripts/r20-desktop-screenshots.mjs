import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = "http://127.0.0.1:4173";
const outputDir = path.resolve("docs/r20-desktop-baselines");
const routes = [
  ["home", "/"],
  ["bot-workbench", "/bot-lab"],
  ["bot-online", "/dau-chuong-trinh/online"],
  ["bot-offline", "/dau-chuong-trinh/offline"],
  ["history", "/history"],
  ["friends", "/friends"],
  ["settings", "/settings?tab=appearance"],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const consoleErrors = [];
const apiResponses = [];
const failedRequests = [];
const notFoundResponses = [];
let expectedGuestAuth401 = 0;
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("requestfailed", (request) => { if (request.url().includes(":3001")) failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? "unknown" }); });
page.on("response", (response) => {
  const url = response.url();
  if (response.status() === 404) notFoundResponses.push(url);
  if (url.includes(":3001")) {
    if (response.status() === 401 && new URL(url).pathname === "/auth/me") expectedGuestAuth401 += 1;
    apiResponses.push({ url, status: response.status(), contentType: response.headers()["content-type"] ?? "" });
  }
});

// The web app defaults to localhost:3001 in development, while CI/Render
// harnesses may resolve that same origin as 127.0.0.1. Match the API by
// pathname instead of pinning one host so this evidence harness remains
// deterministic without making production requests.
await page.route("**/*", async (route) => {
  const requestUrl = new URL(route.request().url());
  const pathname = requestUrl.pathname;
  const sameOriginApi = pathname === "/auth/me" || pathname === "/health" || pathname.startsWith("/rooms") || pathname.startsWith("/bot-library") || pathname.startsWith("/social/") || pathname.startsWith("/history") || pathname.startsWith("/guest/");
  if (!/^https?:$/.test(requestUrl.protocol) || (requestUrl.port !== "3001" && !sameOriginApi)) return route.continue();
  if (pathname === "/auth/me") {
    if (page.url().includes("/bot-lab")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "r20-user", fullName: "Người chơi Robot Lab", displayName: "Robot Lab", username: "robot_lab", theme: "light", avatarPreset: "robot", privacy: { presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" }, stats: { elo: 1200, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 }, botStats: { wins: 0, losses: 0 } } }) });
    return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }) });
  }
  if (pathname === "/guest/session" || pathname === "/guest/history/bot-imports") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "Guest fixture" }) });
  if (pathname === "/health") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", service: "ottv2-server", version: "r20-harness", protocolVersion: "0.1", timestamp: new Date().toISOString(), components: { application: { status: "ok" }, database: { status: "ok" }, realtime: { status: "ok" } } }) });
  if (pathname === "/rooms") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rooms: [] }) });
  if (pathname === "/rooms/referee/invites") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ invites: [] }) });
  if (pathname === "/bot-library") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bots: [], usedBytes: 0, quotaBytes: 262144 }) });
  if (pathname === "/bot-library/sdk") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sdkVersion: "1.0.0", schemaVersion: "1.0", allowlist: ["json", "math"], template: "def choose_move(state, memory):\\n    return state['legal_moves'][0], memory\\n", limits: { sourceBytes: 65536, memoryBytes: 65536, perTurnMs: 100, wholeMatchMs: 120000 } }) });
  if (pathname === "/social/presence/events") return route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  if (pathname.endsWith("/events")) return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": r20-harness\\n\\n" });
  if (pathname.startsWith("/social/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ friends: [], requests: [], invites: [] }) });
  if (pathname.startsWith("/history")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: [], nextCursor: null, hasMore: false, summary: { elo: 1000, wins: 0, losses: 0, total: 0, winRate: 0 } }) });
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
});

await mkdir(outputDir, { recursive: true });
const manifest = [];
for (const [name, route] of routes) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(name === "bot-workbench" ? 1000 : 450);
  const file = path.join(outputDir, `${name}-1440x900.png`);
  await page.screenshot({ path: file, fullPage: true });
  manifest.push({ name, route, file: path.relative(process.cwd(), file), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), viewportWidth: await page.evaluate(() => document.documentElement.clientWidth), title: await page.title() });
}

const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes("status of 401 (Unauthorized)"));
const expectedNavigationAborts = failedRequests.filter(({ failure }) => failure === "net::ERR_ABORTED");
const unexpectedFailedRequests = failedRequests.filter(({ failure }) => failure !== "net::ERR_ABORTED");
await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), viewport: "1440x900", consoleErrors: unexpectedConsoleErrors, notFoundResponses, expectedGuestAuth401, requestFailures: unexpectedFailedRequests, expectedNavigationAborts, apiResponses, pages: manifest }, null, 2));
await browser.close();
console.log(JSON.stringify({ consoleErrors: unexpectedConsoleErrors, notFoundResponses, expectedGuestAuth401, requestFailures: unexpectedFailedRequests, expectedNavigationAborts, apiResponses, pages: manifest }, null, 2));
