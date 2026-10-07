import { expect, test, type Page } from "playwright/test";

type Side = "BLUE" | "RED";
const roomId = "R7ABC1";

function initialBoard() {
  const board: Record<string, { id: string; side: Side; type: "R" | "P" | "S" } | null> = {};
  for (let rank = 1; rank <= 9; rank += 1) for (const file of "abcdefghi") board[`${file}${rank}`] = null;
  const blue = [["a1", "S", 3], ["b1", "R", 1], ["c1", "P", 1], ["d1", "S", 1], ["e1", "R", 2], ["f1", "P", 2], ["g1", "S", 2], ["h1", "R", 3], ["i1", "P", 3]] as const;
  const red = [["a9", "P", 1], ["b9", "R", 1], ["c9", "S", 1], ["d9", "P", 2], ["e9", "R", 2], ["f9", "S", 2], ["g9", "P", 3], ["h9", "R", 3], ["i9", "S", 3]] as const;
  for (const [coordinate, type, ordinal] of blue) board[coordinate] = { id: `blue-${type.toLowerCase()}-${ordinal}`, side: "BLUE", type };
  for (const [coordinate, type, ordinal] of red) board[coordinate] = { id: `red-${type.toLowerCase()}-${ordinal}`, side: "RED", type };
  return board;
}

function waitingMatch(status: "WAITING_READY" | "COUNTDOWN" = "WAITING_READY") {
  return {
    matchId: "77777777-7777-4777-8777-777777777777", roomId, mode: "UNRANKED", status,
    players: [
      { userId: "blue-user", username: "blue_user", displayName: "Người chơi Xanh", side: "BLUE", ready: true, connected: true },
      { userId: "red-user", username: "red_user", displayName: "Người chơi Đỏ", side: "RED", ready: true, connected: true },
    ], board: initialBoard(), pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } }, currentTurn: null, winner: null, resultReason: null,
    clocksMs: { BLUE: 300000, RED: 300000 }, timerSeconds: 300, countdownEndsAt: status === "COUNTDOWN" ? Date.now() + 3000 : null,
    startedAt: null, endedAt: null, sequence: 0, stateVersion: 0, rating: null, refereeEnabled: true, refereeUserId: "ref-user", refereeConnected: true,
  };
}

async function prepare(page: Page, role: "REFEREE" | "PLAYER") {
  await page.addInitScript(() => {
    class SilentEventSource { onmessage: ((event: MessageEvent) => void) | null = null; onerror: ((event: Event) => void) | null = null; close() {} }
    Object.defineProperty(window, "EventSource", { configurable: true, value: SilentEventSource });
  });
  await page.route("http://localhost:3001/auth/me", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: role === "REFEREE" ? "ref-user" : "blue-user", username: role === "REFEREE" ? "ref_user" : "blue_user", displayName: role === "REFEREE" ? "Trọng tài" : "Người chơi Xanh", theme: "system", stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 } } }) }));
  await page.route("http://localhost:3001/guest/session", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ principal: "ACCOUNT", displayName: "Người kiểm thử" }) }));
  await page.route(`http://localhost:3001/matches/${roomId}?*`, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ match: waitingMatch(), viewerSide: role === "REFEREE" ? null : "BLUE" }) }));
  await page.route(`http://localhost:3001/rooms/${roomId}`, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ room: { roomId, name: "Phòng R7", players: 2, playerCapacity: 2, waitingPlayerRating: null, mode: "UNRANKED", playMode: "MANUAL", visibility: "PRIVATE", timerSeconds: 300, spectators: 2, spectatorsEnabled: true, spectatorCapacity: 10, refereeEnabled: true, refereeUserId: "ref-user", refereeConnected: true, status: "WAITING", hostUserId: "blue-user", isMember: role === "PLAYER", requiresPassword: false, role, isReferee: role === "REFEREE", referee: { userId: "ref-user", username: "ref_user", displayName: "Trọng tài", connected: true }, members: [] } }) }));
  await page.route(`http://localhost:3001/matches/${roomId}/events**`, async (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: "" }));
}

test("R7 queue search stage is explicit and calm in the browser", async ({ page }) => {
  const queueId = "00000000-0000-4000-8000-000000000007";
  await page.addInitScript(() => {
    class SilentEventSource { onmessage: ((event: MessageEvent) => void) | null = null; onerror: ((event: Event) => void) | null = null; onopen: (() => void) | null = null; constructor() { window.setTimeout(() => this.onopen?.(), 0); } close() {} }
    Object.defineProperty(window, "EventSource", { configurable: true, value: SilentEventSource });
  });
  const queued = { queueId, mode: "RANKED", status: "QUEUED", player: { userId: "self-user", username: "tester", displayName: "Người kiểm thử", elo: 1000 }, opponent: null, range: 100, elapsedMs: 0, joinedAt: Date.now(), roomId: null, matchId: null };
  await page.route("http://localhost:3001/matchmaking/queue", async (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ queue: queued }) }));
  await page.route(`http://localhost:3001/matchmaking/queue/${queueId}/events**`, async (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: "" }));
  await page.goto("/queue");
  await expect(page.getByText("GIAI ĐOẠN TÌM TRẬN")).toBeVisible();
  await expect(page.getByText("ĐANG TÌM", { exact: true })).toBeVisible();
  await expect(page.locator(".scanner-ring")).toHaveCount(0);
});

test("R7 referee Start is role-gated in the waiting room", async ({ page }) => {
  await prepare(page, "REFEREE");
  await page.route(`http://localhost:3001/matches/${roomId}/referee/start`, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ match: waitingMatch("COUNTDOWN") }) }));
  await page.goto(`/game/${roomId}`);
  await expect(page.getByRole("heading", { name: "Sẵn sàng vào trận" })).toBeVisible();
  const start = page.getByRole("button", { name: "Bắt đầu trận" });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByText(/Bắt đầu sau/)).toBeVisible();
});

test("R7 player view never exposes referee Start", async ({ page }) => {
  await prepare(page, "PLAYER");
  await page.goto(`/game/${roomId}`);
  await expect(page.getByRole("heading", { name: "Sẵn sàng vào trận" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bắt đầu trận" })).toHaveCount(0);
  await expect(page.getByText(/Chờ trọng tài bấm/)).toBeVisible();
});
