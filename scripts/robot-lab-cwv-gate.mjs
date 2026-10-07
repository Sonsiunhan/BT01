import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.OTT_WEB_URL ?? "http://127.0.0.1:4173";
const output = "docs/robot-lab-visual-reference/cwv-report.json";
const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
const routes = [
  ["home", "/"],
  ["rooms", "/phong-online"],
  ["queue", "/queue"],
  ["waiting", "/phong/demo"],
  ["manual-game", "/game/demo"],
  ["bot-workbench", "/bot-lab"],
  ["bot-online", "/dau-chuong-trinh/online"],
  ["bot-offline", "/dau-chuong-trinh/offline"],
  ["friends", "/friends"],
  ["history", "/history"],
  ["profile", "/profile/demo"],
  ["settings", "/settings?tab=appearance"],
  ["login", "/dang-nhap"],
  ["register", "/dang-ky"],
  ["recovery", "/quen-mat-khau"],
  ["spectator", "/spectate/demo"],
  ["missing", "/robot-lab-missing"],
];
const selectedRoutes = process.env.CWV_ROUTES ? new Set(process.env.CWV_ROUTES.split(",").map((value) => value.trim()).filter(Boolean)) : null;
const routeMatrix = selectedRoutes ? routes.filter(([name]) => selectedRoutes.has(name)) : routes;

const browser = await chromium.launch({ headless: true });
const samples = [];
const failures = [];

async function installFixtureRoutes(page) {
  await page.route("**/*", async (route) => {
    const request = new URL(route.request().url());
    if (request.port !== "3001") return route.continue();
    const path = request.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/health") return json({ status: "ok", service: "fixture", version: "cwv", protocolVersion: "0.1", timestamp: new Date().toISOString(), components: { application: { status: "ok" }, database: { status: "ok" }, realtime: { status: "ok" } } });
    if (path === "/auth/me") return json({ code: "UNAUTHORIZED", message: "Fixture Guest" }, 401);
    if (path === "/rooms" || path === "/rooms/referee/invites") return json({ rooms: [], invites: [] });
    if (path.endsWith("/events")) return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": cwv\\n\\n" });
    if (path.startsWith("/social/")) return json({ friends: [], requests: [], invites: [] });
    if (path.startsWith("/history")) return json({ matches: [], nextCursor: null, hasMore: false, summary: { elo: 1000, wins: 0, losses: 0, total: 0, winRate: 0 } });
    if (path === "/bot-library") return json({ bots: [], usedBytes: 0, quotaBytes: 262144 });
    if (path === "/bot-library/sdk") return json({ sdkVersion: "1.0.0", schemaVersion: "1.0", allowlist: ["json", "math"], template: "def choose_move(state, memory):\\n    return state['legal_moves'][0], memory\\n", limits: { sourceBytes: 65536, memoryBytes: 65536, perTurnMs: 100, wholeMatchMs: 120000 } });
    if (path.startsWith("/guest/")) return json({ code: "UNAUTHORIZED", message: "Fixture Guest" }, 401);
    return json({});
  });
}

async function collectVitals(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const result = { lcp: null, cls: 0, clsEntries: [], inp: null, longTaskCount: 0 };
    let lcpObserver;
    let clsObserver;
    let inpObserver;
    let longTaskObserver;
    try {
      lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) result.lcp = entries.at(-1).startTime;
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    try {
      clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) {
          result.cls += entry.value;
          result.clsEntries.push({ value: entry.value, sources: entry.sources?.map((source) => ({ tag: source.node?.tagName, className: source.node?.className })) ?? [] });
        }
      });
      // CLS starts at the warmed route boundary above; do not include the
      // deliberate boot-screen handoff or pre-shell buffered entries.
      clsObserver.observe({ type: "layout-shift", buffered: false });
    } catch {}
    try {
      inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) result.inp = Math.max(result.inp ?? 0, entry.duration);
      });
      inpObserver.observe({ type: "event", buffered: true, durationThreshold: 16 });
    } catch {}
    try {
      longTaskObserver = new PerformanceObserver((list) => { result.longTaskCount += list.getEntries().length; });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    } catch {}
    setTimeout(() => { lcpObserver?.disconnect(); clsObserver?.disconnect(); inpObserver?.disconnect(); longTaskObserver?.disconnect(); resolve(result); }, 250);
  }));
}

try {
  for (const theme of ["dark", "light"]) {
    for (const viewport of viewports) {
      for (const [name, route] of routeMatrix) {
        const context = await browser.newContext({ viewport, colorScheme: theme, reducedMotion: "no-preference", serviceWorkers: "block" });
        await context.addInitScript((choice) => localStorage.setItem("ottv2.theme", choice), theme);
        const page = await context.newPage();
        const consoleErrors = [];
        const requestFailures = [];
        page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
        page.on("requestfailed", (request) => { if (request.url().includes(":3001")) requestFailures.push(request.failure()?.errorText ?? "unknown"); });
        await installFixtureRoutes(page);
        await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        // The app intentionally renders a short boot screen while the shell/auth
        // boundary mounts. Start route CWV after the real page shell exists so
        // this local gate measures route hydration/reflow, not the deliberate
        // boot-to-app handoff (production CrUX remains the release source).
        await page.locator("main").waitFor({ state: "attached", timeout: 10000 });
        await page.evaluate(() => document.fonts.ready);
        const vitalsPromise = collectVitals(page);
        await page.locator("body").press("Tab").catch(() => {});
        await page.mouse.click(8, 8).catch(() => {});
        const vitals = await vitalsPromise;
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        const expectedAuthNoise = consoleErrors.filter((message) => message.includes("401 (Unauthorized)"));
        const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes("401 (Unauthorized)"));
        const expectedAbortNoise = requestFailures.filter((message) => message === "net::ERR_ABORTED");
        const unexpectedRequestFailures = requestFailures.filter((message) => message !== "net::ERR_ABORTED");
        const sample = { name, route, theme, viewport: viewport.name, width: viewport.width, ...vitals, overflow, consoleErrors: unexpectedConsoleErrors, requestFailures: unexpectedRequestFailures, expectedAuthNoise: expectedAuthNoise.length, expectedAbortNoise: expectedAbortNoise.length };
        samples.push(sample);
        if (overflow || unexpectedConsoleErrors.length || unexpectedRequestFailures.length || (vitals.lcp !== null && vitals.lcp >= 2500) || vitals.cls >= 0.1 || (vitals.inp !== null && vitals.inp >= 200)) failures.push(sample);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  environment: "LOCAL_VITE_FIXTURE",
  note: "Local regression evidence only; not a production CrUX or real-user CWV claim.",
  thresholds: { lcpMs: 2500, cls: 0.1, inpMs: 200 },
  sampleCount: samples.length,
  failures,
  samples,
  status: failures.length ? "FAIL" : "PASS_LOCAL_CWV_FIXTURE_SCOPE",
};
await mkdir("docs/robot-lab-visual-reference", { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
if (failures.length) {
  console.error(`CWV gate failed: ${failures.length}/${samples.length} samples exceeded a threshold or emitted errors.`);
  process.exitCode = 1;
} else {
  console.log(`CWV gate passed locally: ${samples.length} route/theme/viewport samples; evidence=${output}`);
}
