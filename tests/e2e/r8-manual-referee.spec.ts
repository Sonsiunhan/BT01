import { expect, test, type Page } from "playwright/test";

type Side = "BLUE" | "RED";
type MatchStatus = "PLAYING" | "PAUSED" | "RESUMING";
const roomId = "R8REF1";

function board() {
  const value: Record<string, { id: string; side: Side; type: "R" | "P" | "S" } | null> = {};
  for (let rank = 1; rank <= 9; rank += 1) for (const file of "abcdefghi") value[`${file}${rank}`] = null;
  for (const [index, [coordinate, type]] of [["a1", "S"], ["b1", "R"], ["c1", "P"], ["d1", "S"], ["e1", "R"], ["f1", "P"], ["g1", "S"], ["h1", "R"], ["i1", "P"]] as const) value[coordinate] = { id: `blue-${index}`, side: "BLUE", type };
  for (const [index, [coordinate, type]] of [["a9", "P"], ["b9", "R"], ["c9", "S"], ["d9", "P"], ["e9", "R"], ["f9", "S"], ["g9", "P"], ["h9", "R"], ["i9", "S"]] as const) value[coordinate] = { id: `red-${index}`, side: "RED", type };
  return value;
}

function snapshot(status: MatchStatus, category: "TECHNICAL_ISSUE" | "RULE_QUESTION" | "OTHER" | null = null) {
  const paused = status === "PAUSED" || status === "RESUMING";
  return {
    matchId: "88888888-8888-4888-8888-888888888888", roomId, mode: "UNRANKED", status,
    players: [{ userId: "blue-user", username: "blue_user", displayName: "Người chơi Xanh", side: "BLUE", ready: true, connected: true }, { userId: "red-user", username: "red_user", displayName: "Người chơi Đỏ", side: "RED", ready: true, connected: true }],
    board: board(), pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } }, currentTurn: "BLUE", winner: null, resultReason: null,
    clocksMs: { BLUE: 296000, RED: 300000 }, timerSeconds: 300, countdownEndsAt: null, startedAt: Date.now() - 4000, endedAt: null,
    sequence: 4, stateVersion: 4, rating: null, refereeEnabled: true, refereeUserId: "ref-user", refereeConnected: true,
    pauseReason: paused ? "REFEREE" : null, pauseCategory: paused ? category ?? "TECHNICAL_ISSUE" : null, pausedAt: paused ? Date.now() - 12000 : null, pausedByUserId: paused ? "ref-user" : null,
    pausePhase: paused ? "PLAYING" : null, pauseElapsedMs: paused ? 12000 : 0, resumeEndsAt: status === "RESUMING" ? Date.now() + 2800 : null,
  };
}

async function prepare(page: Page, role: "REFEREE" | "PLAYER", status: MatchStatus, category: "TECHNICAL_ISSUE" | "RULE_QUESTION" | "OTHER" | null = null) {
  await page.addInitScript(() => { class SilentEventSource { onmessage: ((event: MessageEvent) => void) | null = null; onerror: ((event: Event) => void) | null = null; close() {} } Object.defineProperty(window, "EventSource", { configurable: true, value: SilentEventSource }); });
  await page.route("http://localhost:3001/auth/me", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: role === "REFEREE" ? "ref-user" : "blue-user", username: "tester", displayName: role === "REFEREE" ? "Trọng tài" : "Người chơi Xanh", theme: "system", stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 } } }) }));
  await page.route("http://localhost:3001/guest/session", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ principal: "ACCOUNT", displayName: "Người kiểm thử" }) }));
  await page.route(`http://localhost:3001/matches/${roomId}?*`, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ match: snapshot(status, category), viewerSide: role === "REFEREE" ? null : "BLUE" }) }));
  await page.route(`http://localhost:3001/rooms/${roomId}`, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ room: { roomId, name: "Phòng R8", players: 2, playerCapacity: 2, waitingPlayerRating: null, mode: "UNRANKED", playMode: "MANUAL", visibility: "PRIVATE", timerSeconds: 300, spectators: 1, spectatorsEnabled: true, spectatorCapacity: 10, refereeEnabled: true, refereeUserId: "ref-user", refereeConnected: true, status: "PLAYING", hostUserId: "blue-user", isMember: role === "PLAYER", requiresPassword: false, role, isReferee: role === "REFEREE", referee: { userId: "ref-user", username: "ref_user", displayName: "Trọng tài", connected: true }, members: [] } }) }));
  await page.route(`http://localhost:3001/matches/${roomId}/events**`, async (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: "" }));
}

test("R8 referee can stop with a public reason and sees the authoritative pause overlay", async ({ page }) => {
  await prepare(page, "REFEREE", "PLAYING");
  let stopBody: unknown;
  await page.route(`http://localhost:3001/matches/${roomId}/referee/stop`, async (route) => { stopBody = route.request().postDataJSON(); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ match: snapshot("PAUSED", "RULE_QUESTION") }) }); });
  await page.goto(`/game/${roomId}`);
  await page.getByRole("button", { name: "Dừng trận" }).click();
  await page.getByRole("radio", { name: "Thắc mắc luật" }).click();
  await page.getByRole("button", { name: "Xác nhận dừng" }).click();
  await expect(page.getByRole("dialog", { name: "Trận đấu đã dừng" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeVisible();
  expect(stopBody).toEqual({ category: "RULE_QUESTION" });
});

test("R8 player sees a nondismissible wait state and no referee controls", async ({ page }) => {
  await prepare(page, "PLAYER", "PAUSED", "TECHNICAL_ISSUE");
  await page.goto(`/game/${roomId}`);
  await expect(page.getByRole("dialog", { name: "Trận đấu đã dừng" })).toBeVisible();
  await expect(page.getByText(/Trọng tài đang xử lý/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dừng trận" })).toHaveCount(0);
});

test("R8 referee can hold the three-second resume preparation", async ({ page }) => {
  await prepare(page, "REFEREE", "RESUMING");
  await page.route(`http://localhost:3001/matches/${roomId}/referee/hold`, async (route) => await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ match: snapshot("PAUSED", "TECHNICAL_ISSUE") }) }));
  await page.goto(`/game/${roomId}`);
  await expect(page.getByRole("heading", { name: "Chuẩn bị tiếp tục" })).toBeVisible();
  await page.getByRole("button", { name: "Giữ dừng" }).click();
  await expect(page.getByRole("dialog", { name: "Trận đấu đã dừng" })).toBeVisible();
});

test("R8 pause surface remains usable at the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, "REFEREE", "PAUSED", "TECHNICAL_ISSUE");
  await page.goto(`/game/${roomId}`);
  const dialog = page.getByRole("dialog", { name: "Trận đấu đã dừng" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Tiếp tục" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Tiếp tục" })).toHaveCSS("min-height", "44px");
});
