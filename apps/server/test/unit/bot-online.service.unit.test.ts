import { describe, expect, it, vi } from "vitest";
import { BotOutputValidationError, DEFAULT_BOT_LIMITS, decideLimitWinner, type IsolatedRuntimeAdapter } from "@ottv2/bot-sdk";

import { BotLibraryService } from "../../src/modules/bot-library/bot-library.service.js";
import { BotOnlineService, InMemoryBotOnlineStatePersistence } from "../../src/modules/bot-online/bot-online.service.js";
import { MatchManager } from "../../src/modules/match/match.manager.js";
import { RoomManager } from "../../src/modules/room/room.manager.js";
import { createWasmtimeCpythonAdapter } from "../../src/modules/bot-online/wasmtime.adapter.js";

const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
const blue = { userId: "r10-blue", username: "blue", displayName: "Bot Xanh", principal: "ACCOUNT" as const };
const red = { userId: "r10-red", username: "red", displayName: "Bot Đỏ", principal: "ACCOUNT" as const };
const hasPinnedRuntime = Boolean(process.env.R10_WASMTIME_PATH && process.env.R10_CPYTHON_WASI_DIR && process.env.R10_WASMTIME_SHA256 && process.env.R10_CPYTHON_WASM_SHA256);

function adapter(): IsolatedRuntimeAdapter {
  return {
    profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
    async execute(request) {
      const move = request.state.legalMoves[0];
      if (!move) throw new Error("no legal move");
      return { move, memory: request.memory };
    },
  };
}

async function fixture() {
  let now = 1_000;
  const rooms = new RoomManager();
  const room = await rooms.create(blue, { name: "R10 Bot", visibility: "PUBLIC", timerSeconds: 30, playMode: "BOT", spectatorsEnabled: false });
  await rooms.join(red, room.roomId, {});
  const currentRoom = rooms.search(room.roomId, blue.userId);
  const matches = new MatchManager(() => now, 30_000);
  const library = new BotLibraryService(undefined, { adapter: adapter() });
  const blueBot = await library.createBot(blue.userId, "Bot Xanh", source);
  const redBot = await library.createBot(red.userId, "Bot Đỏ", source);
  await library.testRevision(blue.userId, blueBot.bot.id, blueBot.revision.id);
  await library.testRevision(red.userId, redBot.bot.id, redBot.revision.id);
  const state = new InMemoryBotOnlineStatePersistence();
  const botOnline = new BotOnlineService(library, matches, { adapter: adapter(), persistence: state, now: () => now });
  return { rooms, currentRoom, matches, library, blueBot, redBot, botOnline, state, advance: (ms: number) => { now += ms; } };
}

describe("R10 Bot Online authoritative lifecycle", () => {
  it("reuses a saved candidate on retry after unavailable preflight without duplicating revisions", async () => {
    const f = await fixture();
    await f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    const candidate = source + "# changed strategy\n";
    vi.spyOn(f.library, "testRevision").mockRejectedValueOnce(new Error("preflight unavailable"));
    await expect(f.botOnline.upload(f.currentRoom, blue, f.blueBot.bot.id, candidate)).rejects.toThrow("preflight unavailable");
    expect(f.botOnline.snapshot(f.currentRoom, blue.userId).players.find(row => row.owner)?.pendingRevisionId).toBeNull();
    const result = await f.botOnline.upload(f.currentRoom, blue, f.blueBot.bot.id, candidate);
    expect(result.players.find(row => row.owner)?.pendingRevisionNumber).toBe(2);
    expect((await f.library.list(blue.userId)).bots[0]?.revisions).toHaveLength(2);
  });
  it("rechecks match authority after delayed durable reference writes", async () => {
    const f = await fixture();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const original = f.library.retainMatchRevisions.bind(f.library);
    const retain = vi.spyOn(f.library, "retainMatchRevisions").mockImplementation(async (...args) => { await original(...args); await gate; });
    const selecting = f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await vi.waitFor(() => expect(retain).toHaveBeenCalled());
    f.matches.ready(f.currentRoom, blue, true); f.matches.ready(f.currentRoom, red, true);
    release();
    await expect(selecting).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.botOnline.snapshot(f.currentRoom, blue.userId).players.find(row => row.side === "BLUE")?.activeRevisionId).toBe("pending");
  });
  it("does not accept selection or pending revision when durable references fail", async () => {
    const f = await fixture();
    const retain = vi.spyOn(f.library, "retainMatchRevisions").mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id)).rejects.toThrow("storage unavailable");
    expect(f.botOnline.snapshot(f.currentRoom, blue.userId).players.find(row => row.side === "BLUE")?.activeRevisionId).toBe("pending");
    retain.mockRestore();
    await f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    vi.spyOn(f.library, "retainMatchRevisions").mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(f.botOnline.upload(f.currentRoom, blue, f.blueBot.bot.id, source + "# candidate\n")).rejects.toThrow("storage unavailable");
    expect(f.botOnline.snapshot(f.currentRoom, blue.userId).players.find(row => row.side === "BLUE")?.pendingRevisionId).toBeNull();
  });
  it("does not let a rejected old invocation abort or unlock the rematch invocation", async () => {
    const f = await fixture();
    const completions: Array<{ resolve: () => void; reject: () => void }> = [];
    const held: IsolatedRuntimeAdapter = { ...adapter(), execute(request) { return new Promise((resolve, reject) => { completions.push({ resolve: () => resolve({ move: request.state.legalMoves[0]!, memory: null }), reject: () => reject(new BotOutputValidationError("old fault")) }); }); } };
    const service = new BotOnlineService(f.library, f.matches, { adapter: held, persistence: f.state });
    await service.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await service.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    service.ready(f.currentRoom, blue, true); service.ready(f.currentRoom, red, true);
    service.stop(f.currentRoom.roomId); f.advance(3_001);
    const oldTurn = service.tick(f.currentRoom);
    await vi.waitFor(() => expect(completions).toHaveLength(1));
    const finished = f.matches.surrender(f.currentRoom, blue, f.matches.ensure(f.currentRoom).stateVersion);
    const requested = f.matches.rematch(f.currentRoom, blue, finished.stateVersion);
    f.matches.rematch(f.currentRoom, red, requested.stateVersion);
    service.snapshot(f.currentRoom);
    service.ready(f.currentRoom, blue, true); service.ready(f.currentRoom, red, true);
    service.stop(f.currentRoom.roomId); f.advance(3_001);
    const newTurn = service.tick(f.currentRoom);
    await vi.waitFor(() => expect(completions).toHaveLength(2));
    completions[0]!.reject(); await oldTurn;
    expect(service.snapshot(f.currentRoom).runtimeState).toBe("THINKING");
    await service.tick(f.currentRoom);
    expect(completions).toHaveLength(2);
    completions[1]!.resolve(); await newTurn;
    expect(service.snapshot(f.currentRoom).moves).toHaveLength(1);
    expect(service.snapshot(f.currentRoom).winner).toBeNull();
  });
  it("excludes idle/pause wall time from the whole-match compute budget", async () => {
    const f = await fixture();
    let supervisorNow = 0;
    const service = new BotOnlineService(f.library, f.matches, { adapter: adapter(), persistence: f.state, now: () => supervisorNow });
    await service.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await service.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    service.ready(f.currentRoom, blue, true);
    service.ready(f.currentRoom, red, true);
    service.stop(f.currentRoom.roomId);
    f.advance(3_001);
    await service.tick(f.currentRoom);
    supervisorNow = 60_000;
    await service.tick(f.currentRoom);
    await service.tick(f.currentRoom);
    expect(service.snapshot(f.currentRoom).moves).toHaveLength(3);
    expect(service.snapshot(f.currentRoom).winner).toBeNull();
  });
  it("rejects selection when the match starts during preflight", async () => {
    const f = await fixture();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const original = f.library.testRevision.bind(f.library);
    const spy = vi.spyOn(f.library, "testRevision").mockImplementation(async (...args) => { const result = await original(...args); await gate; return result; });
    const selecting = f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    f.matches.ready(f.currentRoom, blue, true);
    f.matches.ready(f.currentRoom, red, true);
    release();
    await expect(selecting).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.state.load(f.currentRoom.roomId)?.slots).toEqual([]);
  });

  it("does not apply a candidate whose preflight finishes after the match", async () => {
    const f = await fixture();
    await f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await f.botOnline.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    f.botOnline.ready(f.currentRoom, blue, true);
    f.botOnline.ready(f.currentRoom, red, true);
    f.botOnline.stop(f.currentRoom.roomId);
    f.advance(3_001);
    await f.botOnline.tick(f.currentRoom);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const original = f.library.testRevision.bind(f.library);
    const spy = vi.spyOn(f.library, "testRevision").mockImplementation(async (...args) => { const result = await original(...args); await gate; return result; });
    const uploading = f.botOnline.upload(f.currentRoom, blue, f.blueBot.bot.id, source + "# candidate\n");
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    f.matches.surrender(f.currentRoom, blue, f.matches.ensure(f.currentRoom).stateVersion);
    release();
    await expect(uploading).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.state.load(f.currentRoom.roomId)?.slots.every((slot) => slot.pendingRevisionId === null)).toBe(true);
  });

  it("admits one tick while pending activation is awaiting library storage", async () => {
    const f = await fixture();
    await f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await f.botOnline.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    await f.botOnline.upload(f.currentRoom, blue, f.blueBot.bot.id, source + "# candidate\n");
    f.botOnline.ready(f.currentRoom, blue, true);
    f.botOnline.ready(f.currentRoom, red, true);
    f.botOnline.stop(f.currentRoom.roomId);
    f.advance(3_001);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const original = f.library.list.bind(f.library);
    const spy = vi.spyOn(f.library, "list").mockImplementation(async (...args) => { await gate; return original(...args); });
    const first = f.botOnline.tick(f.currentRoom);
    const second = f.botOnline.tick(f.currentRoom);
    expect(spy).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(f.botOnline.snapshot(f.currentRoom).moves).toHaveLength(1);
  });
  it("requires tested revisions, keeps the board read-only/public payload source-free, then commits one legal Bot move", async () => {
    const f = await fixture();
    const invalid = await f.library.createBot(blue.userId, "Invalid", "def no_entry():\n    pass\n");
    await expect(f.botOnline.select(f.currentRoom, blue, invalid.bot.id, invalid.revision.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await f.botOnline.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    await f.botOnline.ready(f.currentRoom, blue, true);
    await f.botOnline.ready(f.currentRoom, red, true);
    f.botOnline.stop(f.currentRoom.roomId);
    f.advance(3_001);
    await f.botOnline.tick(f.currentRoom);
    const snapshot = f.botOnline.snapshot(f.currentRoom, blue.userId);
    expect(snapshot.sequence).toBeGreaterThan(0);
    expect(snapshot.moves).toHaveLength(1);
    expect(snapshot.players.find((player) => player.owner)).toMatchObject({ side: "BLUE", activeRevisionNumber: 1 });
    expect(JSON.stringify(snapshot)).not.toContain(source);
    expect(JSON.stringify(snapshot)).not.toContain("memory");
    expect(snapshot.board.b1).toMatchObject({ side: "BLUE" });
  });

  it("replaces one pending revision, activates it only at the next owned turn, and never applies after terminal state", async () => {
    const f = await fixture();
    await f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await f.botOnline.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    const first = await f.botOnline.upload(f.currentRoom, blue, f.blueBot.bot.id, source + "# candidate\n");
    expect(first.players.find((player) => player.side === "BLUE")?.pendingRevisionNumber).toBe(2);
    const second = await f.botOnline.upload(f.currentRoom, blue, f.blueBot.bot.id, source + "\n# latest\n");
    expect(second.players.find((player) => player.side === "BLUE")?.pendingRevisionNumber).toBe(3);
    await f.botOnline.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    await f.botOnline.ready(f.currentRoom, blue, true);
    await f.botOnline.ready(f.currentRoom, red, true);
    f.botOnline.stop(f.currentRoom.roomId);
    f.advance(3_001);
    await f.botOnline.tick(f.currentRoom);
    expect(f.matches.ensure(f.currentRoom).publicTimeline).toEqual(expect.arrayContaining([expect.objectContaining({ type: "BOT_REVISION_APPLIED", side: "BLUE", revisionNumber: 3 })]));
    // Terminal matches reject a late upload rather than silently changing result/revision.
    const match = f.matches.ensure(f.currentRoom);
    f.matches.surrender(f.currentRoom, blue, match.stateVersion);
    await expect(f.botOnline.upload(f.currentRoom, blue, f.blueBot.bot.id, source)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("restores revision references and private memory checkpoint without exposing source", async () => {
    const f = await fixture();
    await f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await f.botOnline.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    const restored = new BotOnlineService(f.library, f.matches, { adapter: adapter(), persistence: f.state });
    const snapshot = restored.snapshot(f.currentRoom, blue.userId);
    expect(snapshot.sessionId).toBeTruthy();
    expect(snapshot.players.map((player) => player.activeRevisionId)).toEqual(expect.arrayContaining([f.blueBot.revision.id, f.redBot.revision.id]));
    expect(snapshot).not.toHaveProperty("source");
    expect(snapshot).not.toHaveProperty("privateLog");
  });

  it("fails closed when a restored Bot checkpoint is ahead of the authoritative match", async () => {
    const f = await fixture();
    await f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await f.botOnline.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    await f.botOnline.ready(f.currentRoom, blue, true);
    await f.botOnline.ready(f.currentRoom, red, true);
    f.botOnline.stop(f.currentRoom.roomId);
    f.advance(3_001);
    await f.botOnline.tick(f.currentRoom);

    const match = f.matches.ensure(f.currentRoom);
    const checkpoint = f.state.load(f.currentRoom.roomId);
    expect(checkpoint).not.toBeNull();
    f.state.save({
      ...checkpoint!,
      lastCommittedStateVersion: match.stateVersion + 1,
      lastCommittedSequence: match.sequence + 1,
    });

    const restored = new BotOnlineService(f.library, f.matches, { adapter: adapter(), persistence: f.state });
    await restored.tick(f.currentRoom);
    const snapshot = restored.snapshot(f.currentRoom, blue.userId);
    expect(snapshot.runtimeState).toBe("UNAVAILABLE");
    expect(snapshot.sequence).toBe(match.sequence);
    expect(snapshot.stateVersion).toBe(match.stateVersion);
  });

  it.skipIf(!hasPinnedRuntime)("commits a Bot move through the real pinned Wasmtime/CPython-WASI adapter", async () => {
    const f = await fixture();
    const service = new BotOnlineService(f.library, f.matches, {
      adapter: createWasmtimeCpythonAdapter({
        wasmtimePath: process.env.R10_WASMTIME_PATH!,
        cpythonDir: process.env.R10_CPYTHON_WASI_DIR!,
        wasmtimeSha256: process.env.R10_WASMTIME_SHA256!,
        cpythonWasmSha256: process.env.R10_CPYTHON_WASM_SHA256!,
        limits: DEFAULT_BOT_LIMITS,
      }),
      persistence: f.state,
      now: () => 4_000,
    });
    await service.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await service.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    await service.ready(f.currentRoom, blue, true);
    await service.ready(f.currentRoom, red, true);
    service.stop(f.currentRoom.roomId);
    f.advance(3_001);
    await service.tick(f.currentRoom);
    const snapshot = service.snapshot(f.currentRoom, blue.userId);
    expect(snapshot.runtimeState).toBe("READY");
    expect(snapshot.moves).toHaveLength(1);
    expect(snapshot.sequence).toBeGreaterThan(0);
    expect(JSON.stringify(snapshot)).not.toContain(source);
  });

  it("fails closed when no isolated provider is injected and does not fault a Bot as a loss", async () => {
    const f = await fixture();
    const safeOnly = new BotOnlineService(f.library, f.matches, { persistence: f.state });
    await safeOnly.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await safeOnly.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    await safeOnly.ready(f.currentRoom, blue, true);
    await safeOnly.ready(f.currentRoom, red, true);
    safeOnly.stop(f.currentRoom.roomId);
    f.advance(3_001);
    await safeOnly.tick(f.currentRoom);
    const snapshot = safeOnly.snapshot(f.currentRoom, blue.userId);
    expect(snapshot.runtimeState).toBe("UNAVAILABLE");
    expect(snapshot.winner).toBeNull();
    expect(snapshot.moves).toHaveLength(0);
  });

  it("records a public N/P/M adjudication and applies the published exact-tie rule", async () => {
    const f = await fixture();
    await f.botOnline.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await f.botOnline.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    await f.botOnline.ready(f.currentRoom, blue, true);
    await f.botOnline.ready(f.currentRoom, red, true);
    f.botOnline.stop(f.currentRoom.roomId);
    f.advance(3_001);
    await f.botOnline.tick(f.currentRoom);
    const decision = decideLimitWinner({ N: 9, P: 4, M: 8 }, { N: 9, P: 4, M: 8 });
    expect(decision).toMatchObject({ winner: "RED", reason: "LIMIT_EXACT_TIE" });
    const finished = f.matches.finishBotLimit(f.currentRoom, decision.winner, {
      BLUE: decision.BLUE,
      RED: decision.RED,
      reason: decision.reason,
      trigger: "MAX_PLIES",
      faultSide: null,
    });
    expect(finished).toMatchObject({ status: "FINISHED", winner: "RED", resultReason: "BOT_LIMIT_EXACT_TIE" });
    expect(finished.botAdjudication).toEqual({ BLUE: { N: 9, P: 4, M: 8 }, RED: { N: 9, P: 4, M: 8 }, reason: "LIMIT_EXACT_TIE", trigger: "MAX_PLIES", faultSide: null });
  });

  it("cancels an in-flight turn on referee pause without committing a late result", async () => {
    const f = await fixture();
    const slowAdapter: IsolatedRuntimeAdapter = { ...adapter(), async execute(request) { await new Promise((resolve) => setTimeout(resolve, 15)); const move = request.state.legalMoves[0]; if (!move) throw new Error("no legal move"); return { move, memory: request.memory }; } };
    const service = new BotOnlineService(f.library, f.matches, { adapter: slowAdapter, persistence: f.state });
    await service.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await service.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    await service.ready(f.currentRoom, blue, true);
    await service.ready(f.currentRoom, red, true);
    service.stop(f.currentRoom.roomId);
    f.advance(3_001);
    const running = service.tick(f.currentRoom);
    service.pause(f.currentRoom.roomId);
    await running;
    const snapshot = service.snapshot(f.currentRoom, blue.userId);
    expect(snapshot.moves).toHaveLength(0);
    expect(snapshot.winner).toBeNull();
  });

  it("fences a rematch as a new match and resets private moves, pending revision and memory state", async () => {
    const f = await fixture();
    const seenMemory: unknown[] = [];
    const memoryAdapter: IsolatedRuntimeAdapter = { ...adapter(), async execute(request) {
      seenMemory.push(request.memory);
      const move = request.state.legalMoves[0];
      if (!move) throw new Error("no legal move");
      return { move, memory: { turn: seenMemory.length } };
    } };
    const service = new BotOnlineService(f.library, f.matches, { adapter: memoryAdapter, persistence: f.state, now: () => 1_000 });
    await service.select(f.currentRoom, blue, f.blueBot.bot.id, f.blueBot.revision.id);
    await service.select(f.currentRoom, red, f.redBot.bot.id, f.redBot.revision.id);
    await service.ready(f.currentRoom, blue, true);
    await service.ready(f.currentRoom, red, true);
    service.stop(f.currentRoom.roomId);
    f.advance(3_001);
    await service.tick(f.currentRoom);
    expect(seenMemory[0]).toBeNull();
    const beforeRematch = await service.upload(f.currentRoom, red, f.redBot.bot.id, source + "\n# pending\n");
    expect(beforeRematch.players.find((player) => player.side === "RED")?.pendingRevisionNumber).toBe(2);
    const finished = f.matches.surrender(f.currentRoom, blue, f.matches.ensure(f.currentRoom).stateVersion);
    expect(finished.status).toBe("FINISHED");

    const requested = f.matches.rematch(f.currentRoom, blue, finished.stateVersion);
    const rematch = f.matches.rematch(f.currentRoom, red, requested.stateVersion);
    expect(rematch.matchId).not.toBe(finished.matchId);
    expect(rematch.status).toBe("WAITING_READY");
    const snapshot = service.snapshot(f.currentRoom, blue.userId);
    expect(snapshot.moves).toEqual([]);
    expect(snapshot.players.every((player) => player.pendingRevisionId === null)).toBe(true);

    await service.ready(f.currentRoom, blue, true);
    await service.ready(f.currentRoom, red, true);
    service.stop(f.currentRoom.roomId);
    f.advance(3_001);
    await service.tick(f.currentRoom);
    expect(seenMemory[1]).toBeNull();
    expect(service.snapshot(f.currentRoom, blue.userId).runtimeState).toBe("READY");
  });
});
