import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { PrismaDatabase } from "../../src/plugins/prisma.js";
import { MatchManager } from "../../src/modules/match/match.manager.js";
import { RoomManager } from "../../src/modules/room/room.manager.js";
import { BotLibraryService, type BotLibraryDatabase } from "../../src/modules/bot-library/bot-library.service.js";

try { process.loadEnvFile?.(fileURLToPath(new URL("../../../../.env", import.meta.url))); } catch { /* local .env is optional in CI */ }

// Integration fixtures create/delete users. Never mutate the default dev or a
// shared/production datasource just because a broad test command was invoked.
const explicitTarget = process.env.DATABASE_URL;
const target = explicitTarget ? new URL(explicitTarget) : null;
const disposable = Boolean(target && ["localhost", "127.0.0.1"].includes(target.hostname) && /^\/ottv2_(?:test|r20_acceptance)_/.test(target.pathname));
const prisma = new PrismaClient();
const env = {
  NODE_ENV: "test" as const,
  HOST: "127.0.0.1",
  PORT: 3001,
  LOG_LEVEL: "silent" as const,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://missing:missing@127.0.0.1:5432/missing",
  CORS_ORIGINS: "http://localhost:8000",
  REALTIME_ADAPTER: "disabled" as const,
  corsOrigins: ["http://localhost:8000"],
};

function sessionCookie(response: { headers: Record<string, string | string[] | undefined> }): string {
  const raw = response.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  expect(first).toBeTruthy();
  return first!.split(";", 1)[0];
}

let app: Awaited<ReturnType<typeof buildApp>>;
const createdUsernames: string[] = [];
let sequence = 0;
function account() {
  const username = `w2test${Date.now().toString().slice(-6)}${sequence++}`.slice(0, 20);
  createdUsernames.push(username.toLowerCase());
  return { fullName: "Wave Two Player", displayName: "Wave Player", username, password: "correct-horse-battery" };
}

describe.skipIf(!disposable)("W2 auth/profile flow — explicit disposable local database required", () => {
  beforeAll(async () => {
    app = await buildApp({ env, database: new PrismaDatabase(prisma) });
  });

  afterAll(async () => {
    if (createdUsernames.length) await prisma.user.deleteMany({ where: { usernameNormalized: { in: createdUsernames } } });
    await app.close();
    await prisma.$disconnect();
  });

  it("validates registration and reveals a non-persisted Recovery Code once", async () => {
    const invalid = await app.inject({ method: "POST", url: "/auth/register", payload: { fullName: "A", displayName: "A", username: "bad", password: "short" } });
    expect(invalid.statusCode).toBe(400);
    const input = account();
    const response = await app.inject({ method: "POST", url: "/auth/register", payload: input });
    expect(response.statusCode).toBe(201);
    const body = response.json() as { user: { username: string }; recoveryCode: string };
    expect(body.user.username).toBe(input.username);
    expect(body.recoveryCode).toMatch(/^OTTV2-/);
    const row = await prisma.user.findUniqueOrThrow({ where: { usernameNormalized: input.username.toLowerCase() } });
    expect(row.passwordHash).not.toBe(input.password);
    expect(row.recoveryCodeHash).not.toBe(body.recoveryCode);
    expect(row.recoveryUsedAt).toBeNull();
  });

  it("persists private Bot source across app restart and denies another account", async () => {
    const ownerInput = account();
    const otherInput = account();
    const owner = await app.inject({ method: "POST", url: "/auth/register", payload: ownerInput });
    const other = await app.inject({ method: "POST", url: "/auth/register", payload: otherInput });
    const ownerCookie = sessionCookie(owner);
    const otherCookie = sessionCookie(other);
    const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n# PRIVATE_FIXTURE\n";
    const created = await app.inject({ method: "POST", url: "/bot-library/bots", headers: { cookie: ownerCookie }, payload: { name: "Durable fixture", source } });
    expect(created.statusCode).toBe(201);
    const { bot, revision } = created.json();
    const sourceUrl = `/bot-library/bots/${bot.id}/revisions/${revision.id}/source`;
    expect((await app.inject({ method: "GET", url: "/bot-library", headers: { cookie: ownerCookie } })).body).not.toContain("PRIVATE_FIXTURE");
    const denied = await app.inject({ method: "GET", url: sourceUrl, headers: { cookie: otherCookie } });
    expect(denied.statusCode).toBeGreaterThanOrEqual(400);
    expect(denied.body).not.toContain("PRIVATE_FIXTURE");
    await app.close();
    app = await buildApp({ env, database: new PrismaDatabase(prisma) });
    const recovered = await app.inject({ method: "GET", url: sourceUrl, headers: { cookie: ownerCookie } });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json().source).toBe(source);
    await prisma.botRevision.update({ where: { id: revision.id }, data: { activeForMatchId: "acceptance-active-fixture" } });
    expect((await app.inject({ method: "DELETE", url: `/bot-library/bots/${bot.id}/revisions/${revision.id}`, headers: { cookie: ownerCookie } })).statusCode).toBe(409);
    await prisma.botRevision.update({ where: { id: revision.id }, data: { activeForMatchId: null } });
    expect((await app.inject({ method: "DELETE", url: `/bot-library/bots/${bot.id}/revisions/${revision.id}`, headers: { cookie: ownerCookie } })).statusCode).toBe(204);
  });

  it("persists Guest identity and private staging across app restart without a fake User", async () => {
    const first = await app.inject({ method: "POST", url: "/guest/session", payload: { clientId: "acceptance-guest-profile", displayName: "Khách acceptance" } });
    const cookie = sessionCookie(first);
    const other = await app.inject({ method: "POST", url: "/guest/session", payload: { clientId: "acceptance-guest-profile", displayName: "Khách acceptance" } });
    const otherCookie = sessionCookie(other);
    const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n# GUEST_PRIVATE_ACCEPTANCE\n";
    const staged = await app.inject({ method: "POST", url: "/guest/bot-library/stage", headers: { cookie }, payload: { name: "Guest fixture", source } });
    expect(staged.statusCode).toBe(200);
    const { bot, revision } = staged.json();
    const owner = await prisma.botLibrary.findUniqueOrThrow({ where: { id: bot.id } });
    expect(owner.ownerUserId).toBeNull();
    expect(owner.ownerGuestId).toMatch(/^guest:/);
    expect(await prisma.user.findUnique({ where: { id: owner.ownerGuestId! } })).toBeNull();
    expect(revision.sourceExpiresAt).toBeTruthy();
    const repeated = await app.inject({ method: "POST", url: "/guest/bot-library/stage", headers: { cookie }, payload: { name: "Guest fixture", source } });
    expect(repeated.json().revision.id).toBe(revision.id);
    expect((await app.inject({ method: "GET", url: "/guest/bot-library", headers: { cookie: otherCookie } })).json().bots).toEqual([]);
    const testUrl = `/guest/bot-library/bots/${bot.id}/revisions/${revision.id}/test`;
    expect((await app.inject({ method: "POST", url: testUrl, headers: { cookie: otherCookie } })).statusCode).toBe(401);
    await app.close();
    app = await buildApp({ env, database: new PrismaDatabase(prisma) });
    const resumed = await app.inject({ method: "POST", url: "/guest/session", headers: { cookie }, payload: { clientId: "acceptance-guest-profile", displayName: "Tên giả mới" } });
    expect(resumed.statusCode).toBe(200);
    expect(resumed.headers["set-cookie"]).toBeUndefined();
    expect(resumed.json().displayName).toBe("Khách acceptance");
    expect((await app.inject({ method: "GET", url: "/guest/bot-library", headers: { cookie } })).body).not.toContain("GUEST_PRIVATE_ACCEPTANCE");
    expect((await app.inject({ method: "POST", url: testUrl, headers: { cookie } })).statusCode).toBe(503);
    const library = new BotLibraryService(prisma as unknown as BotLibraryDatabase);
    await library.retainMatchRevisions("guest-acceptance-active", [revision.id]);
    await library.clearGuestStaging(owner.ownerGuestId!);
    expect(await prisma.botRevision.findUnique({ where: { id: revision.id } })).not.toBeNull();
    await prisma.botRevision.update({ where: { id: revision.id }, data: { sourceExpiresAt: new Date(Date.now() - 1000) } });
    await library.pruneExpiredGuestSources();
    expect(await prisma.botRevision.findUnique({ where: { id: revision.id } })).not.toBeNull();
    await library.retainMatchRevisions("guest-acceptance-active", []);
    await library.pruneExpiredGuestSources();
    expect(await prisma.botRevision.findUnique({ where: { id: revision.id } })).toBeNull();
    expect((await library.list(owner.ownerGuestId!)).usedBytes).toBe(0);
    await prisma.guestSession.update({ where: { id: owner.ownerGuestId! }, data: { revokedAt: new Date() } });
    expect((await app.inject({ method: "GET", url: "/guest/bot-library", headers: { cookie } })).statusCode).toBe(401);
  });

  it.skipIf(!process.env.R10_WASMTIME_PATH)("runs two Guests through real Online preflight, queue, custom room, turns and private revision update", async () => {
    let now = Date.now();
    const matches = new MatchManager(() => now);
    const rooms = new RoomManager();
    const runtimeApp = await buildApp({ database: new PrismaDatabase(new PrismaClient()), rooms, matches, env: { ...env, BOT_WASMTIME_PATH: process.env.R10_WASMTIME_PATH, BOT_CPYTHON_WASI_DIR: process.env.R10_CPYTHON_WASI_DIR, BOT_WASMTIME_SHA256: process.env.R10_WASMTIME_SHA256, BOT_CPYTHON_WASM_SHA256: process.env.R10_CPYTHON_WASM_SHA256 } });
    try {
      const cookies: string[] = [];
      const ids: Array<{ botId: string; revisionId: string }> = [];
      for (const side of ["Xanh", "Đỏ"]) {
        const session = await runtimeApp.inject({ method: "POST", url: "/guest/session", payload: { clientId: `acceptance-${side}`, displayName: `Khách ${side}` } });
        const cookie = sessionCookie(session); cookies.push(cookie);
        const staged = await runtimeApp.inject({ method: "POST", url: "/guest/bot-library/stage", headers: { cookie }, payload: { name: "Bot fixture", source: "def choose_move(state, memory):\n    return state['legal_moves'][0], {'old_revision': True}\n" } });
        expect(staged.statusCode).toBe(200);
        const { bot, revision } = staged.json(); ids.push({ botId: bot.id, revisionId: revision.id });
        const preflight = await runtimeApp.inject({ method: "POST", url: `/guest/bot-library/bots/${bot.id}/revisions/${revision.id}/test`, headers: { cookie } });
        expect(preflight.statusCode).toBe(200);
        expect(preflight.json().revision.status).toBe("PASSED");
        expect(preflight.json().legalPreview).toHaveLength(2);
      }
      expect((await runtimeApp.inject({ method: "POST", url: "/matchmaking/queue", headers: { cookie: cookies[0] }, payload: { mode: "BOT" } })).statusCode).toBe(400);
      expect((await runtimeApp.inject({ method: "POST", url: "/matchmaking/queue", headers: { cookie: cookies[1] }, payload: { mode: "BOT", ...ids[0] } })).statusCode).toBe(401);
      const queued = await runtimeApp.inject({ method: "POST", url: "/matchmaking/queue", headers: { cookie: cookies[0] }, payload: { mode: "BOT", ...ids[0] } });
      expect(queued.statusCode).toBe(200);
      expect((await runtimeApp.inject({ method: "DELETE", url: `/matchmaking/queue/${queued.json().queue.queueId}`, headers: { cookie: cookies[0] } })).json().queue.status).toBe("CANCELLED");
      const firstQueue = await runtimeApp.inject({ method: "POST", url: "/matchmaking/queue", headers: { cookie: cookies[0] }, payload: { mode: "BOT", ...ids[0] } });
      const secondQueue = await runtimeApp.inject({ method: "POST", url: "/matchmaking/queue", headers: { cookie: cookies[1] }, payload: { mode: "BOT", ...ids[1] } });
      expect(secondQueue.json().queue.status).toBe("MATCHED");
      const firstMatched = await runtimeApp.inject({ method: "GET", url: `/matchmaking/queue/${firstQueue.json().queue.queueId}`, headers: { cookie: cookies[0] } });
      expect(firstMatched.json().queue.status).toBe("MATCHED");
      const pairedRoom = secondQueue.json().queue.roomId;
      expect(firstMatched.json().queue.roomId).toBe(pairedRoom);
      for (const cookie of cookies) expect([200, 204]).toContain((await runtimeApp.inject({ method: "POST", url: `/rooms/${pairedRoom}/leave`, headers: { cookie } })).statusCode);
      const created = await runtimeApp.inject({ method: "POST", url: "/rooms", headers: { cookie: cookies[0] }, payload: { name: "Guest runtime acceptance", visibility: "PUBLIC", timerSeconds: 300, playMode: "BOT", spectatorsEnabled: false } });
      expect(created.statusCode).toBe(201);
      const roomId = created.json().room.roomId;
      expect((await runtimeApp.inject({ method: "POST", url: `/rooms/${roomId}/join`, headers: { cookie: cookies[1] }, payload: {} })).statusCode).toBe(200);
      for (let side = 0; side < 2; side++) {
        const selected = await runtimeApp.inject({ method: "POST", url: `/bot-online/${roomId}/select`, headers: { cookie: cookies[side] }, payload: ids[side] });
        expect(selected.statusCode).toBe(200);
        expect(selected.body).not.toContain("choose_move");
      }
      const accountInput = account();
      const registered = await runtimeApp.inject({ method: "POST", url: "/auth/register", payload: accountInput });
      const combinedCookie = `${cookies[0]}; ${sessionCookie(registered)}`;
      // Admission assertion cannot switch the new account to Guest or create
      // an orphan account-owned room with Guest-owned staged bot IDs.
      expect((await runtimeApp.inject({ method: "POST", url: "/rooms", headers: { cookie: combinedCookie, "x-expected-principal": "GUEST" }, payload: { name: "Must not be created", visibility: "PUBLIC", timerSeconds: 300, playMode: "BOT", spectatorsEnabled: false } })).statusCode).toBe(409);
      expect((await runtimeApp.inject({ method: "POST", url: "/matchmaking/queue", headers: { cookie: combinedCookie, "x-expected-principal": "GUEST" }, payload: { mode: "BOT", ...ids[0] } })).statusCode).toBe(409);
      expect((await runtimeApp.inject({ method: "GET", url: `/bot-online/${roomId}`, headers: { cookie: combinedCookie } })).json().snapshot.players.find((row: any) => row.owner)?.userId).toMatch(/^guest:/);
      for (const cookie of [combinedCookie, cookies[1]!]) expect((await runtimeApp.inject({ method: "POST", url: `/bot-online/${roomId}/ready`, headers: { cookie }, payload: { ready: true } })).statusCode).toBe(200);
      now += 3001;
      const step = await runtimeApp.inject({ method: "POST", url: `/bot-online/${roomId}/step`, headers: { cookie: combinedCookie }, payload: {} });
      expect(step.statusCode).toBe(200);
      expect(step.json().snapshot.moves.length).toBeGreaterThan(0);
      const upload = await runtimeApp.inject({ method: "POST", url: `/bot-online/${roomId}/upload`, headers: { cookie: combinedCookie }, payload: { botId: ids[0]!.botId, source: "def choose_move(state, memory):\n    if memory and memory.get('old_revision'):\n        raise ValueError('revision memory must reset')\n    return state['legal_moves'][0], {'changed': True}\n" } });
      expect(upload.statusCode).toBe(200);
      expect(upload.json().snapshot.players.find((row: any) => row.owner)?.pendingRevisionId).toBeTruthy();
      expect(upload.body).not.toContain("changed");
      // Real pinned WASI must commit the new own-turn revision without the
      // old revision's private memory; a mocked reset is not sufficient.
      for (let turn = 0; turn < 2; turn++) {
        const advanced = await runtimeApp.inject({ method: "POST", url: `/bot-online/${roomId}/step`, headers: { cookie: combinedCookie }, payload: {} });
        expect(advanced.statusCode).toBe(200);
      }
      const activated = (await runtimeApp.inject({ method: "GET", url: `/bot-online/${roomId}`, headers: { cookie: combinedCookie } })).json().snapshot;
      expect(activated.players.find((row: any) => row.owner)?.activeRevisionNumber).toBe(2);
      expect(activated.moves.length).toBeGreaterThanOrEqual(3);
      expect(activated.status).toBe("PLAYING");
      expect(JSON.stringify(activated)).not.toContain("old_revision");
      expect(JSON.stringify(activated)).not.toContain("changed");
    } finally { await runtimeApp.close(); }
  }, 60_000);

  it("persists an allowed avatar preset and exposes it in the public profile", async () => {
    const input = account();
    const registered = await app.inject({ method: "POST", url: "/auth/register", payload: input });
    const cookie = sessionCookie(registered);
    const updated = await app.inject({ method: "PATCH", url: "/profiles/me", headers: { cookie }, payload: { avatarPreset: "fox" } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().user.avatarPreset).toBe("fox");
    const publicResponse = await app.inject({ method: "GET", url: `/profiles/${input.username}` });
    expect(publicResponse.json().profile.avatarPreset).toBe("fox");
  });

  it("imports Guest Bot summaries with explicit account consent, dedupe and no ranked effects", async () => {
    const registered = await app.inject({ method: "POST", url: "/auth/register", payload: account() });
    const cookie = sessionCookie(registered);
    const other = sessionCookie(await app.inject({ method: "POST", url: "/auth/register", payload: account() }));
    const record = { localId: "guest-bot-online:00000000-0000-4000-8000-000000000001:BLUE", mode: "BOT_ONLINE", result: "WIN", playerName: "Khách Xanh", opponentName: "Khách Đỏ", timerSeconds: 300, durationSeconds: 5, endedAt: new Date().toISOString(), scoreDelta: 0 };
    expect((await app.inject({ method: "POST", url: "/guest/history/bot-import", payload: { records: [record] } })).statusCode).toBe(401);
    const imported = await app.inject({ method: "POST", url: "/guest/history/bot-import", headers: { cookie }, payload: { records: [record, record] } });
    expect(imported.statusCode).toBe(200);
    expect(imported.json()).toEqual({ importedCount: 1, skippedCount: 1 });
    expect((await app.inject({ method: "POST", url: "/guest/history/bot-import", headers: { cookie }, payload: { records: [record] } })).json()).toEqual({ importedCount: 0, skippedCount: 1 });
    expect((await app.inject({ method: "POST", url: "/guest/history/bot-import", headers: { cookie }, payload: { records: [{ ...record, source: "PRIVATE_PYTHON" }] } })).statusCode).toBe(400);
    const saved = await app.inject({ method: "GET", url: "/guest/history/bot-imports", headers: { cookie } });
    expect(saved.json().records).toEqual([record]);
    expect(saved.body).not.toContain("PRIVATE_PYTHON");
    expect((await app.inject({ method: "GET", url: "/guest/history/bot-imports", headers: { cookie: other } })).json().records).toEqual([]);
    expect((await app.inject({ method: "GET", url: "/guest/history/bot-imports" })).statusCode).toBe(401);
    const history = (await app.inject({ method: "GET", url: "/history", headers: { cookie } })).json();
    expect(history.summary).toMatchObject({ elo: 1000, wins: 0, losses: 0, total: 0 });
  });

  it("allows multiple sessions and revokes only the logged-out session", async () => {
    const input = account();
    const registered = await app.inject({ method: "POST", url: "/auth/register", payload: input });
    const firstCookie = sessionCookie(registered);
    const second = await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username.toUpperCase(), password: input.password, remember: false } });
    const secondCookie = sessionCookie(second);
    await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie: firstCookie } });
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: firstCookie } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: secondCookie } })).statusCode).toBe(200);
  });

  it("resets password with a one-time code and revokes previous sessions", async () => {
    const input = account();
    const registered = await app.inject({ method: "POST", url: "/auth/register", payload: input });
    const oldCookie = sessionCookie(registered);
    const code = (registered.json() as { recoveryCode: string }).recoveryCode;
    const recovered = await app.inject({ method: "POST", url: "/auth/recover", payload: { username: input.username, recoveryCode: code, newPassword: "new-correct-password" } });
    expect(recovered.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: oldCookie } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username, password: "new-correct-password", remember: false } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/auth/recover", payload: { username: input.username, recoveryCode: code, newPassword: "third-password" } })).statusCode).toBe(401);
  });

  it("keeps private fields private in the public profile response", async () => {
    const input = account();
    await app.inject({ method: "POST", url: "/auth/register", payload: input });
    const self = await app.inject({ method: "GET", url: "/profiles/me", headers: { cookie: sessionCookie(await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username, password: input.password } })) } });
    expect(self.statusCode).toBe(200);
    expect(self.json().user).toHaveProperty("fullName");
    const publicResponse = await app.inject({ method: "GET", url: `/profiles/${input.username}` });
    expect(publicResponse.statusCode).toBe(200);
    const publicProfile = publicResponse.json().profile as Record<string, unknown>;
    expect(publicProfile).toMatchObject({ username: input.username, displayName: input.displayName });
    expect(publicProfile).not.toHaveProperty("fullName");
    expect(publicProfile).not.toHaveProperty("passwordHash");
    expect(publicProfile).not.toHaveProperty("recoveryCodeHash");
  });

  it("exposes relationship data while keeping presence private from non-friends", async () => {
    const viewerInput = account();
    const targetInput = account();
    const viewerRegistration = await app.inject({ method: "POST", url: "/auth/register", payload: viewerInput });
    const targetRegistration = await app.inject({ method: "POST", url: "/auth/register", payload: targetInput });
    const viewerCookie = sessionCookie(viewerRegistration);
    const targetCookie = sessionCookie(targetRegistration);
    const targetId = targetRegistration.json().user.id as string;

    const anonymous = await app.inject({ method: "GET", url: `/profiles/${targetInput.username}` });
    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.json().profile).toMatchObject({ userId: targetId, friendCount: 0, recentForm: [], isFriend: false, requestStatus: null });
    expect(anonymous.json().profile).not.toHaveProperty("presence");

    const sent = await app.inject({ method: "POST", url: `/social/requests/${targetId}`, headers: { cookie: viewerCookie } });
    expect(sent.statusCode).toBe(201);
    const requestId = sent.json().requestId as string;
    expect((await app.inject({ method: "POST", url: `/social/requests/${requestId}/accept`, headers: { cookie: targetCookie } })).statusCode).toBe(204);
    await app.inject({ method: "GET", url: "/social/friends", headers: { cookie: targetCookie } });

    const friendView = await app.inject({ method: "GET", url: `/profiles/${targetInput.username}`, headers: { cookie: viewerCookie } });
    expect(friendView.statusCode).toBe(200);
    expect(friendView.json().profile).toMatchObject({ isFriend: true, friendCount: 1, presence: "ONLINE" });
  });

  it("persists presence privacy and enforces block/unblock in both directions", async () => {
    const viewerInput = account();
    const targetInput = account();
    const viewerRegistration = await app.inject({ method: "POST", url: "/auth/register", payload: viewerInput });
    const targetRegistration = await app.inject({ method: "POST", url: "/auth/register", payload: targetInput });
    const viewerCookie = sessionCookie(viewerRegistration);
    const targetCookie = sessionCookie(targetRegistration);
    const targetId = targetRegistration.json().user.id as string;
    const viewerId = viewerRegistration.json().user.id as string;

    const hidden = await app.inject({ method: "PATCH", url: "/profiles/me", headers: { cookie: targetCookie }, payload: { presenceVisibility: "NOBODY" } });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json().user.privacy.presenceVisibility).toBe("NOBODY");
    const hiddenSearch = await app.inject({ method: "GET", url: `/social/search?q=${targetInput.username}`, headers: { cookie: viewerCookie } });
    expect(hiddenSearch.json().results[0]).not.toHaveProperty("presence");

    const sent = await app.inject({ method: "POST", url: `/social/requests/${targetId}`, headers: { cookie: viewerCookie } });
    const requestId = sent.json().requestId as string;
    await app.inject({ method: "POST", url: `/social/requests/${requestId}/accept`, headers: { cookie: targetCookie } });
    await app.inject({ method: "GET", url: "/social/friends", headers: { cookie: targetCookie } });
    const hiddenFriendView = await app.inject({ method: "GET", url: `/profiles/${targetInput.username}`, headers: { cookie: viewerCookie } });
    expect(hiddenFriendView.json().profile).toMatchObject({ isFriend: true });
    expect(hiddenFriendView.json().profile).not.toHaveProperty("presence");

    const unhidden = await app.inject({ method: "PATCH", url: "/profiles/me", headers: { cookie: targetCookie }, payload: { presenceVisibility: "FRIENDS" } });
    expect(unhidden.json().user.privacy.presenceVisibility).toBe("FRIENDS");
    const visibleFriendView = await app.inject({ method: "GET", url: `/profiles/${targetInput.username}`, headers: { cookie: viewerCookie } });
    expect(visibleFriendView.json().profile).toHaveProperty("presence");

    expect((await app.inject({ method: "POST", url: `/social/blocks/${targetId}`, headers: { cookie: viewerCookie } })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/social/search?q=${viewerInput.username}`, headers: { cookie: targetCookie } })).json().results).toHaveLength(0);
    expect((await app.inject({ method: "POST", url: `/social/requests/${viewerId}`, headers: { cookie: targetCookie } })).statusCode).toBe(403);
    const blockedProfile = await app.inject({ method: "GET", url: `/profiles/${targetInput.username}`, headers: { cookie: viewerCookie } });
    expect(blockedProfile.json().profile).toMatchObject({ isFriend: false, requestStatus: null });

    expect((await app.inject({ method: "DELETE", url: `/social/blocks/${targetId}`, headers: { cookie: viewerCookie } })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/social/search?q=${targetInput.username}`, headers: { cookie: viewerCookie } })).json().results).toHaveLength(1);
  });

  it("keeps the current session on password change and progressively throttles failures", async () => {
    const input = account();
    const registered = await app.inject({ method: "POST", url: "/auth/register", payload: input });
    const currentCookie = sessionCookie(registered);
    const secondLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username, password: input.password } });
    const otherCookie = sessionCookie(secondLogin);
    const changed = await app.inject({ method: "POST", url: "/auth/password", headers: { cookie: currentCookie }, payload: { currentPassword: input.password, newPassword: "changed-correct-password" } });
    expect(changed.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: currentCookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: otherCookie } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username, password: input.password } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username, password: "changed-correct-password" } })).statusCode).toBe(200);

    const throttleInput = account();
    await app.inject({ method: "POST", url: "/auth/register", payload: throttleInput });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: throttleInput.username, password: "wrong-password" } })).statusCode).toBe(401);
    }
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: throttleInput.username, password: "wrong-password" } })).statusCode).toBe(429);
  });
});
