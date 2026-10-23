import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { BotLibraryService } from "../../apps/server/src/modules/bot-library/bot-library.service.js";
import { createWasmtimeCpythonAdapter } from "../../apps/server/src/modules/bot-online/wasmtime.adapter.js";
import { BotReadinessService } from "../../apps/server/src/modules/tournament-bot-readiness/bot-readiness.service.js";
import { TournamentStateStore } from "../../apps/server/src/modules/tournament-foundation/tournament-store.js";

const runtimeRoot = resolve(process.env.OTT_V2_RUNTIME_ARTIFACTS ?? "D:/BT01/.worktrees/w1-runtime-artifacts");
const wasmtimePath = join(runtimeRoot, "wasmtime.exe");
const cpythonDir = join(runtimeRoot, "cpython");
const runtimeAvailable = existsSync(wasmtimePath) && existsSync(join(cpythonDir, "python.wasm"));
const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";

/**
 * This is deliberately an integration test, not a mocked adapter check.  It
 * crosses the Wasmtime/CPython process boundary and then validates N06
 * receipts after canonical engine acceptance.  CI skips only when the pinned
 * artifacts are not provisioned; a skipped test is never evidence of runtime
 * proof.
 */
describe("N08 — isolated runtime proof", () => {
  it.skipIf(!runtimeAvailable)("accepts Human–Python Bot and Bot–Bot turns through the pinned Wasmtime runtime", async () => {
    const adapter = createWasmtimeCpythonAdapter({
      wasmtimePath,
      cpythonDir,
      wasmtimeSha256: "51165ae46e2e4ca71b52efff33432d9e58db41bf236cb7c768adb03f653a7152",
      cpythonWasmSha256: "d24bd98d3071af6b17d51d53a08700b9acef59172a0afcb6adb733645c2a1715",
      workDir: join(tmpdir(), "ottv2-n08-runtime-proof"),
    });
    const store = new TournamentStateStore();
    const library = new BotLibraryService(undefined, { adapter });
    const readiness = new BotReadinessService(store, library);
    const alpha = await library.createBot("player-alpha", "Alpha runtime", source);
    const beta = await library.createBot("player-beta", "Beta runtime", source);
    readiness.seedEnrollment({ tournamentId: "runtime-tournament", enrollmentId: "enrollment-alpha", userId: "player-alpha", personKey: "A" });
    readiness.seedEnrollment({ tournamentId: "runtime-tournament", enrollmentId: "enrollment-beta", userId: "player-beta", personKey: "B" });

    const first = await readiness.selectBot({ userId: "player-alpha", roles: ["PLAYER"] }, "runtime-tournament", "enrollment-alpha", {
      botId: alpha.bot.id,
      revisionId: alpha.revision.id,
      expectedEnrollmentRevision: 0,
      idempotencyKey: "runtime-alpha",
    });
    const second = await readiness.selectBot({ userId: "player-beta", roles: ["PLAYER"] }, "runtime-tournament", "enrollment-beta", {
      botId: beta.bot.id,
      revisionId: beta.revision.id,
      expectedEnrollmentRevision: 0,
      idempotencyKey: "runtime-beta",
    });
    await expect(readiness.executeJob(first.job.jobId)).resolves.toMatchObject({ state: "SUCCEEDED", status: "READY" });
    await expect(readiness.executeJob(second.job.jobId)).resolves.toMatchObject({ state: "SUCCEEDED", status: "READY" });

    const ta = { userId: "ta-runtime", roles: ["TOURNAMENT_ADMIN"] as const };
    await expect(readiness.runProof(ta, "runtime-tournament", "OFFLINE_HUMAN_PYTHON", ["enrollment-alpha"])).resolves.toMatchObject({
      status: "PASSED",
      acceptedTurns: 1,
      receiptIds: [expect.any(String)],
    });
    await expect(readiness.runProof(ta, "runtime-tournament", "OFFLINE_BOT_VS_BOT", ["enrollment-alpha", "enrollment-beta"])).resolves.toMatchObject({
      status: "PASSED",
      acceptedTurns: 2,
      receiptIds: [expect.any(String), expect.any(String)],
    });
  }, 90_000);
});
