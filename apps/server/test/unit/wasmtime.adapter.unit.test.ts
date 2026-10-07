import { describe, expect, it } from "vitest";
import { createInitialState, getLegalDestinations, type Coordinate, type RuleState } from "@ottv2/game-rules";
import { DEFAULT_BOT_LIMITS, RuntimeCancelledError } from "@ottv2/bot-sdk";
import { createWasmtimeCpythonAdapter, WasmtimeBusyError } from "../../src/modules/bot-online/wasmtime.adapter.js";
import { BotLibraryService } from "../../src/modules/bot-library/bot-library.service.js";

const wasmtimePath = process.env.R10_WASMTIME_PATH;
const cpythonDir = process.env.R10_CPYTHON_WASI_DIR;
const wasmtimeSha256 = process.env.R10_WASMTIME_SHA256;
const cpythonWasmSha256 = process.env.R10_CPYTHON_WASM_SHA256;
const hasPinnedRuntime = Boolean(wasmtimePath && cpythonDir && wasmtimeSha256 && cpythonWasmSha256);

describe("R10 Wasmtime/CPython-WASI adapter", () => {
  it.skipIf(!hasPinnedRuntime)("admits one invocation across phases and releases capacity after cancellation", async () => {
    const adapter = createWasmtimeCpythonAdapter({ wasmtimePath: wasmtimePath!, cpythonDir: cpythonDir!, wasmtimeSha256: wasmtimeSha256!, cpythonWasmSha256: cpythonWasmSha256! });
    const state = createInitialState();
    const ruleState: RuleState = { ...state, status: "PLAYING", winner: null, resultReason: null };
    const legalMoves = Object.keys(state.board).flatMap((from) => getLegalDestinations(ruleState, "BLUE", from as Coordinate).map((to) => ({ from: from as Coordinate, to })));
    const request = { source: "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n", state: { sdkVersion: DEFAULT_BOT_LIMITS.sdkVersion, schemaVersion: "1", side: "BLUE" as const, board: state.board, legalMoves, turnNumber: 0, clocksMs: { BLUE: 300_000, RED: 300_000 }, history: [] }, memory: null, seed: 7 };
    const signal = { aborted: false };
    const running = adapter.execute(request, signal);
    const queued = adapter.execute({ ...request, phase: "PREFLIGHT" }, { aborted: false });
    await expect(adapter.execute({ ...request, phase: "PREFLIGHT" }, { aborted: false })).rejects.toBeInstanceOf(WasmtimeBusyError);
    await expect(adapter.execute(request, { aborted: false })).rejects.toBeInstanceOf(WasmtimeBusyError);
    signal.aborted = true;
    await expect(running).rejects.toBeInstanceOf(RuntimeCancelledError);
    expect((await queued).move).toEqual(legalMoves[0]);
    expect((await adapter.execute(request, { aborted: false })).move).toEqual(legalMoves[0]);
  });
  it.skipIf(!hasPinnedRuntime)("runs library preflight through the actual pinned runtime for both sides", async () => {
    const adapter = createWasmtimeCpythonAdapter({ wasmtimePath: wasmtimePath!, cpythonDir: cpythonDir!, wasmtimeSha256: wasmtimeSha256!, cpythonWasmSha256: cpythonWasmSha256! });
    const library = new BotLibraryService(undefined, { adapter });
    const fixture = await library.createBot("fixture-owner", "Real preflight", "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n");
    const result = await library.testRevision("fixture-owner", fixture.bot.id, fixture.revision.id);
    expect(result.revision.status).toBe("PASSED");
    expect(result.legalPreview).toHaveLength(2);
    const illegal = await library.createRevision("fixture-owner", fixture.bot.id, "def choose_move(state, memory):\n    return {'from': 'a1', 'to': 'i9'}, memory\n");
    expect((await library.testRevision("fixture-owner", fixture.bot.id, illegal.revision.id)).revision.status).toBe("FAILED");
  });

  it.skipIf(!hasPinnedRuntime)("rejects stdlib capability escape, non-finite memory and excessive compute in real preflight", async () => {
    const adapter = createWasmtimeCpythonAdapter({ wasmtimePath: wasmtimePath!, cpythonDir: cpythonDir!, wasmtimeSha256: wasmtimeSha256!, cpythonWasmSha256: cpythonWasmSha256! });
    const library = new BotLibraryService(undefined, { adapter });
    const sources = [
      "from typing import get_type_hints\ndef choose_move(state, memory):\n    get_type_hints(choose_move)\n    return state['legal_moves'][0], memory\n",
      "def choose_move(state, memory):\n    return state['legal_moves'][0], float('nan')\n",
      "def choose_move(state, memory):\n    total = 0\n    for value in range(100000000):\n        total += value\n    return state['legal_moves'][0], total\n",
      "def choose_move(state, memory):\n    try:\n        while True:\n            pass\n    except Exception:\n        while True:\n            pass\n",
      "import math\ndef choose_move(state, memory):\n    value = math.factorial(10000000)\n    return state['legal_moves'][0], None\n",
    ];
    for (const [index, source] of sources.entries()) {
      const fixture = await library.createBot("fixture-owner", `Rejected ${index}`, source);
      const result = await library.testRevision("fixture-owner", fixture.bot.id, fixture.revision.id);
      expect(result.revision.status).toBe("FAILED");
      expect(result.privateLog.join(" ")).not.toContain("Traceback");
    }
  });
  it.skipIf(!hasPinnedRuntime)("executes a real player turn in the pinned isolated runtime", async () => {
    const state = createInitialState();
    const ruleState: RuleState = { ...state, status: "PLAYING", winner: null, resultReason: null };
    const legalMoves = Object.keys(state.board).flatMap((from) => getLegalDestinations(ruleState, "BLUE", from as Coordinate).map((to) => ({ from: from as Coordinate, to })));
    const adapter = createWasmtimeCpythonAdapter({
      wasmtimePath: wasmtimePath!,
      cpythonDir: cpythonDir!,
      wasmtimeSha256: wasmtimeSha256!,
      cpythonWasmSha256: cpythonWasmSha256!,
      limits: DEFAULT_BOT_LIMITS,
    });
    const result = await adapter.execute({
      source: "def choose_move(state, memory):\n    return state['legal_moves'][0], {'turns': memory['turns'] + 1}\n",
      state: {
        sdkVersion: DEFAULT_BOT_LIMITS.sdkVersion,
        schemaVersion: DEFAULT_BOT_LIMITS.schemaVersion,
        side: "BLUE",
        board: state.board,
        legalMoves,
        turnNumber: 0,
        clocksMs: { BLUE: 300_000, RED: 300_000 },
        history: [],
      },
      memory: { turns: 0 },
      seed: 7,
    }, { aborted: false });
    expect(result.move).toEqual(legalMoves[0]);
    expect(result.memory).toEqual({ turns: 1 });
  });

  it.skipIf(!hasPinnedRuntime)("cancels an in-flight guest without returning a late result", async () => {
    const adapter = createWasmtimeCpythonAdapter({ wasmtimePath: wasmtimePath!, cpythonDir: cpythonDir!, wasmtimeSha256: wasmtimeSha256!, cpythonWasmSha256: cpythonWasmSha256!, limits: DEFAULT_BOT_LIMITS });
    const signal = { aborted: false };
    const invocation = adapter.execute({
      source: "def choose_move(state, memory):\n    while True:\n        pass\n",
      state: { sdkVersion: DEFAULT_BOT_LIMITS.sdkVersion, schemaVersion: DEFAULT_BOT_LIMITS.schemaVersion, side: "BLUE", board: createInitialState().board, legalMoves: [], turnNumber: 0, clocksMs: { BLUE: 300_000, RED: 300_000 }, history: [] },
      memory: null,
      seed: 7,
    }, signal);
    setTimeout(() => { signal.aborted = true; }, 20);
    await expect(invocation).rejects.toBeInstanceOf(RuntimeCancelledError);
  });
});

