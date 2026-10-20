#!/usr/bin/env node
/**
 * scripts/network/kill-restart-rehearsal.mjs
 *
 * Implements FRS-L06 / L-05.03 Kill/Restart Rehearsal across 3 Commit Boundaries:
 * Boundary 1: Pre-commit kill (Rollback completely, NO mixed state, retry as fresh)
 * Boundary 2: Post-commit pre-ACK kill (Transaction committed, error before ACK, retry returns COMMITTED idempotently without duplicate writes)
 * Boundary 3: Post-ACK kill (All ACKed moves preserved, full state recovered, outage downtime not penalized)
 */

export class KillRestartRehearsalError extends Error {
  constructor(boundary, message, details = {}) {
    super(`[Boundary ${boundary}] ${message}`);
    this.name = "KillRestartRehearsalError";
    this.boundary = boundary;
    this.details = details;
  }
}

/**
 * In-memory simulated PostgreSQL store for reliable, deterministic boundary rehearsal.
 */
export function createRehearsalDb() {
  const store = {
    match: new Map(),
    matchCheckpoint: new Map(),
    matchEvent: [],
    botPrivateCheckpoint: new Map(),
    commandLedgerEntry: new Map(),
    matchSettlement: new Map(),
    roomContext: new Map(),
  };

  const createTx = () => ({
    match: {
      upsert: async ({ where, create, update }) => {
        const existing = store.match.get(where.id);
        const data = existing ? { ...existing, ...update } : { ...create };
        store.match.set(where.id, data);
        return data;
      },
      findUnique: async ({ where }) => store.match.get(where.id) ?? null,
    },
    matchCheckpoint: {
      upsert: async ({ where, create, update }) => {
        const existing = store.matchCheckpoint.get(where.matchId);
        const data = existing ? { ...existing, ...update } : { ...create };
        store.matchCheckpoint.set(where.matchId, data);
        return data;
      },
      findFirst: async ({ where }) => {
        const found = Array.from(store.matchCheckpoint.values())
          .filter((c) => !where.roomId || c.roomId === where.roomId)
          .sort((a, b) => b.stateVersion - a.stateVersion);
        return found[0] ?? null;
      },
      findUnique: async ({ where }) => store.matchCheckpoint.get(where.matchId) ?? null,
    },
    matchEvent: {
      create: async ({ data }) => {
        store.matchEvent.push(data);
        return data;
      },
      createMany: async ({ data }) => {
        store.matchEvent.push(...data);
        return { count: data.length };
      },
    },
    botPrivateCheckpoint: {
      upsert: async ({ where, create, update }) => {
        const key = `${where.matchId_botId.matchId}:${where.matchId_botId.botId}`;
        const existing = store.botPrivateCheckpoint.get(key);
        const data = existing ? { ...existing, ...update } : { ...create };
        store.botPrivateCheckpoint.set(key, data);
        return data;
      },
    },
    commandLedgerEntry: {
      upsert: async ({ where, create, update }) => {
        const k = where.principalId_targetId_operation_commandId;
        const key = `${k.principalId}:${k.targetId}:${k.operation}:${k.commandId}`;
        const existing = store.commandLedgerEntry.get(key);
        const data = existing ? { ...existing, ...update } : { ...create };
        store.commandLedgerEntry.set(key, data);
        return data;
      },
    },
    roomContext: {
      upsert: async ({ where, create, update }) => {
        const existing = store.roomContext.get(where.id);
        const data = existing ? { ...existing, ...update } : { ...create };
        store.roomContext.set(where.id, data);
        return data;
      },
    },
  });

  const prisma = {
    $transaction: async (callback) => {
      // Snapshot store before transaction to guarantee 100% rollback on crash
      const snapshot = {
        match: new Map(store.match),
        matchCheckpoint: new Map(store.matchCheckpoint),
        matchEvent: [...store.matchEvent],
        botPrivateCheckpoint: new Map(store.botPrivateCheckpoint),
        commandLedgerEntry: new Map(store.commandLedgerEntry),
        matchSettlement: new Map(store.matchSettlement),
        roomContext: new Map(store.roomContext),
      };

      try {
        const tx = createTx();
        return await callback(tx);
      } catch (err) {
        // Rollback on failpoint / crash
        store.match = snapshot.match;
        store.matchCheckpoint = snapshot.matchCheckpoint;
        store.matchEvent = snapshot.matchEvent;
        store.botPrivateCheckpoint = snapshot.botPrivateCheckpoint;
        store.commandLedgerEntry = snapshot.commandLedgerEntry;
        store.matchSettlement = snapshot.matchSettlement;
        store.roomContext = snapshot.roomContext;
        throw err;
      }
    },
    commandLedgerEntry: {
      findUnique: async ({ where }) => {
        const k = where.principalId_targetId_operation_commandId;
        const key = `${k.principalId}:${k.targetId}:${k.operation}:${k.commandId}`;
        return store.commandLedgerEntry.get(key) ?? null;
      },
    },
    matchCheckpoint: {
      findUnique: async ({ where }) => store.matchCheckpoint.get(where.matchId) ?? null,
    },
    roomContext: {
      findUnique: async ({ where }) => store.roomContext.get(where.id) ?? null,
    },
    match: {
      findUnique: async ({ where }) => store.match.get(where.id) ?? null,
      update: async ({ where, data }) => {
        const match = store.match.get(where.id);
        if (match) {
          const updated = { ...match, ...data };
          store.match.set(where.id, updated);
          return updated;
        }
        return null;
      },
    },
  };

  return { store, prisma };
}

/**
 * Rehearsal Boundary 1: Pre-Commit Kill
 * Server process terminated before transaction commit.
 * Invariant: Complete rollback, ZERO mixed state, client retry proceeds as fresh command.
 */
export async function rehearseBoundary1PreCommitKill(commitPort, mockDb) {
  const commandKey = {
    principalId: "user-b1",
    targetId: "room-b1",
    operation: "MOVE",
    commandId: "cmd-b1-precommit",
  };

  // 1. Arm failpoint BEFORE_TX (simulating crash before transaction commit)
  commitPort.setFailpoint("BEFORE_TX");

  const preCommitResult = await commitPort.commitTransition({
    commandKey,
    expectedVersion: 0,
    nextState: { matchId: "match-b1", status: "PLAYING" },
    domainEvents: [
      { id: "ev-b1", type: "MOVE_ACCEPTED", sequence: 1, targetId: "room-b1", stateVersion: 1, timestamp: Date.now() },
    ],
  });

  // Verify: Pre-commit failure returned UNKNOWN
  if (preCommitResult.outcome !== "UNKNOWN") {
    throw new KillRestartRehearsalError(1, `Expected UNKNOWN outcome on pre-commit crash, got ${preCommitResult.outcome}`);
  }

  // Verify: Zero mixed state left in database
  if (mockDb.store.match.has("match-b1")) {
    throw new KillRestartRehearsalError(1, "Pre-commit crash leaked uncommitted Match record into database");
  }
  if (mockDb.store.matchCheckpoint.has("match-b1")) {
    throw new KillRestartRehearsalError(1, "Pre-commit crash leaked uncommitted MatchCheckpoint record into database");
  }
  if (mockDb.store.matchEvent.length > 0) {
    throw new KillRestartRehearsalError(1, "Pre-commit crash leaked uncommitted events into database");
  }

  // 2. Disarm failpoint and simulate process restart (clearing transient crash memory)
  commitPort.setFailpoint(null);
  commitPort.clear();

  // 3. Retry command: Should execute and commit cleanly
  const retryResult = await commitPort.commitTransition({
    commandKey,
    expectedVersion: 0,
    nextState: { matchId: "match-b1", status: "PLAYING" },
    domainEvents: [
      { id: "ev-b1", type: "MOVE_ACCEPTED", sequence: 1, targetId: "room-b1", stateVersion: 1, timestamp: Date.now() },
    ],
  });

  if (retryResult.outcome !== "COMMITTED" || retryResult.stateVersion !== 1) {
    throw new KillRestartRehearsalError(1, `Expected retry to commit to stateVersion 1, got outcome=${retryResult.outcome}, version=${retryResult.stateVersion}`);
  }

  return {
    boundary: 1,
    name: "Pre-commit kill",
    passed: true,
    initialOutcome: preCommitResult.outcome,
    retryOutcome: retryResult.outcome,
    stateVersion: retryResult.stateVersion,
  };
}

/**
 * Rehearsal Boundary 2: Post-Commit, Pre-ACK Kill
 * Transaction committed in DB, but process dies before returning ACK response.
 * Invariant: DB holds committed state; retry returns original outcome without re-executing writes.
 */
export async function rehearseBoundary2PostCommitPreAckKill(commitPort, mockDb) {
  const commandKey = {
    principalId: "user-b2",
    targetId: "room-b2",
    operation: "MOVE",
    commandId: "cmd-b2-postcommit-preack",
  };

  // 1. Arm failpoint AFTER_COMMIT_BEFORE_ACK
  commitPort.setFailpoint("AFTER_COMMIT_BEFORE_ACK");
  const initialEventsCount = mockDb.store.matchEvent.length;

  let crashedError = null;
  try {
    await commitPort.commitTransition({
      commandKey,
      expectedVersion: 0,
      nextState: { matchId: "match-b2", status: "PLAYING" },
      domainEvents: [
        { id: "ev-b2", type: "MOVE_ACCEPTED", sequence: 1, targetId: "room-b2", stateVersion: 1, timestamp: Date.now() },
      ],
    });
  } catch (err) {
    crashedError = err;
  }

  if (!crashedError || !crashedError.message.includes("FAILPOINT_AFTER_COMMIT_BEFORE_ACK")) {
    throw new KillRestartRehearsalError(2, `Expected crash error before ACK, got ${crashedError ? crashedError.message : "success"}`);
  }

  // Invariant 1: Transaction in database WAS committed!
  const committedMatch = mockDb.store.match.get("match-b2");
  const committedCheckpoint = mockDb.store.matchCheckpoint.get("match-b2");
  if (!committedMatch || !committedCheckpoint) {
    throw new KillRestartRehearsalError(2, "Post-commit crash failed to preserve committed database state");
  }

  // 2. Simulate server restart: clear failpoint and transient memory
  commitPort.setFailpoint(null);
  commitPort.clear();

  // Snapshot database record counts before retry: verify event was actually committed
  const matchEventCountBeforeRetry = mockDb.store.matchEvent.length;
  if (matchEventCountBeforeRetry !== initialEventsCount + 1) {
    throw new KillRestartRehearsalError(
      2,
      `Expected event to be committed before retry: expected ${initialEventsCount + 1}, found ${matchEventCountBeforeRetry}`
    );
  }

  // 3. Client retries with exact same commandKey
  const retryResult = await commitPort.commitTransition({
    commandKey,
    expectedVersion: 0,
    nextState: { matchId: "match-b2", status: "PLAYING" },
    domainEvents: [
      { id: "ev-b2", type: "MOVE_ACCEPTED", sequence: 1, targetId: "room-b2", stateVersion: 1, timestamp: Date.now() },
    ],
  });

  // Invariant 2: Idempotent return of original outcome
  if (retryResult.outcome !== "COMMITTED" || retryResult.stateVersion !== 1) {
    throw new KillRestartRehearsalError(2, `Expected retry to return original COMMITTED outcome, got ${retryResult.outcome}`);
  }

  // Invariant 3: Zero duplicate events written
  const matchEventCountAfterRetry = mockDb.store.matchEvent.length;
  if (matchEventCountAfterRetry !== matchEventCountBeforeRetry) {
    throw new KillRestartRehearsalError(
      2,
      `Retry duplicated events! Count before retry=${matchEventCountBeforeRetry}, after=${matchEventCountAfterRetry}`
    );
  }

  return {
    boundary: 2,
    name: "Post-commit, pre-ACK kill",
    passed: true,
    recoveredFromCrash: true,
    retryOutcome: retryResult.outcome,
    stateVersion: retryResult.stateVersion,
    duplicateEventsGenerated: 0,
  };
}

/**
 * Rehearsal Boundary 3: Post-ACK Kill
 * Command committed and ACKed; server dies abruptly after ACK.
 * Invariant: Recovery nạp đúng checkpoint, không mất bất kỳ nước đi nào, đồng hồ không trừ outage time.
 */
export async function rehearseBoundary3PostAckKill(commitPort, recoveryManager, mockDb) {
  const roomId = "room-b3";
  const matchId = "match-b3";
  const commandKey = {
    principalId: "user-b3",
    targetId: roomId,
    operation: "MOVE",
    commandId: "cmd-b3-acked",
  };

  // 1. Commit and successfully ACK move
  commitPort.setFailpoint(null);
  const ackedResult = await commitPort.commitTransition({
    commandKey,
    expectedVersion: 0,
    nextState: {
      matchId,
      roomId,
      status: "PLAYING",
      rulesVersion: "rps-v1",
      clocksMs: { BLUE: 170_000, RED: 180_000 },
      replacementExpiresAt: 999_999_000,
      initialBoard: { a1: { side: "BLUE", type: "R" } },
    },
    domainEvents: [
      { id: "ev-b3-1", type: "MOVE_ACCEPTED", sequence: 1, targetId: roomId, stateVersion: 1, timestamp: Date.now() },
    ],
  });

  if (ackedResult.outcome !== "COMMITTED") {
    throw new KillRestartRehearsalError(3, `Initial commit failed with ${ackedResult.outcome}`);
  }

  // Populate RoomContext in DB
  mockDb.store.roomContext.set(roomId, {
    id: roomId,
    generation: 1,
    stateVersion: 1,
    activeMatchId: matchId,
    previousSetup: { a1: { side: "BLUE", type: "R" } },
    config: { timerSeconds: 30 },
    memberships: [
      { userId: "player-blue", role: "PLAYER", side: "BLUE", principal: "ACCOUNT", connected: true },
      { userId: "player-red", role: "PLAYER", side: "RED", principal: "ACCOUNT", connected: true },
    ],
  });

  // 2. Simulate complete process termination post-ACK
  commitPort.clear(); // Clear all in-memory cache to simulate fresh process start

  // 3. Startup & Recovery: MatchRecoveryManager executes
  const recoveryResult = await recoveryManager.recoverActiveRoomAndMatch(roomId);

  if (!recoveryResult.recovered) {
    throw new KillRestartRehearsalError(3, `Recovery failed: abortReason=${recoveryResult.abortReason}`);
  }

  // Invariant 1: State version and sequence are completely preserved (ZERO lost moves)
  if (recoveryResult.matchState.stateVersion !== 1) {
    throw new KillRestartRehearsalError(3, `State version mismatch after recovery: expected 1, got ${recoveryResult.matchState.stateVersion}`);
  }

  // Invariant 2: Clocks restored from committed remaining time, NO outage deduction
  if (recoveryResult.matchState.clocksMs.BLUE !== 170_000 || recoveryResult.matchState.clocksMs.RED !== 180_000) {
    throw new KillRestartRehearsalError(3, `Clocks mutated during outage: BLUE=${recoveryResult.matchState.clocksMs.BLUE}`);
  }

  // Invariant 3: Memberships reconnected with connected: false
  const blueMember = recoveryResult.roomContext.memberships.find((m) => m.userId === "player-blue");
  if (!blueMember || blueMember.connected !== false) {
    throw new KillRestartRehearsalError(3, "Recovered membership did not reset connected flag to false");
  }

  // Invariant 4: Target deadline preserved
  if (recoveryResult.matchState.replacementExpiresAt !== 999_999_000) {
    throw new KillRestartRehearsalError(3, `Deadline altered after recovery: got ${recoveryResult.matchState.replacementExpiresAt}`);
  }

  return {
    boundary: 3,
    name: "Post-ACK kill & recovery",
    passed: true,
    recoveredStateVersion: recoveryResult.matchState.stateVersion,
    clocksPreservedWithoutOutagePenalty: true,
    membershipsDisconnectedUntilReconnect: true,
    zeroAckedMovesLost: true,
  };
}

/**
 * Main rehearsal execution runner
 */
export async function runAllKillRestartRehearsals() {
  console.log("================================================================================");
  console.log("  L06-W4: Kill/Restart Rehearsal Across 3 Commit Boundaries (L-05.03, L-05.12)");
  console.log("================================================================================");

  // Dynamic import of modules to work across workspaces
  const { PrismaCommitPort } = await import("../../apps/server/src/modules/match/commit/commit.prisma.js");
  const { MatchRecoveryManager } = await import("../../apps/server/src/modules/match/recovery/match-recovery.manager.js");

  const mockDb = createRehearsalDb();
  const commitPort = new PrismaCommitPort(mockDb.prisma, undefined, () => Date.now());
  const recoveryManager = new MatchRecoveryManager(mockDb.prisma);

  const report = {
    executedAt: new Date().toISOString(),
    boundaries: [],
    overallVerdict: "PENDING",
  };

  try {
    console.log("\n[1/3] Executing Boundary 1: Pre-commit kill...");
    const r1 = await rehearseBoundary1PreCommitKill(commitPort, mockDb);
    console.log(`  ✓ Boundary 1 PASS: Rollback complete, 0 mixed state, clean retry.`);
    report.boundaries.push(r1);

    console.log("\n[2/3] Executing Boundary 2: Post-commit, pre-ACK kill...");
    const r2 = await rehearseBoundary2PostCommitPreAckKill(commitPort, mockDb);
    console.log(`  ✓ Boundary 2 PASS: DB committed, retry idempotently returned original outcome, 0 duplicate events.`);
    report.boundaries.push(r2);

    console.log("\n[3/3] Executing Boundary 3: Post-ACK kill & recovery...");
    const r3 = await rehearseBoundary3PostAckKill(commitPort, recoveryManager, mockDb);
    console.log(`  ✓ Boundary 3 PASS: Zero lost moves, clocks preserved without penalty, role bindings recovered.`);
    report.boundaries.push(r3);

    report.overallVerdict = "PASS";
    console.log("\n================================================================================");
    console.log("  VERDICT: PASS (All 3 commit boundaries verified 100% resilient)");
    console.log("================================================================================");
    return report;
  } catch (err) {
    report.overallVerdict = "FAIL";
    report.error = err.message;
    console.error(`\n  ✗ REHEARSAL FAILED: ${err.message}`);
    throw err;
  }
}

// Auto-run if invoked directly via CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllKillRestartRehearsals()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
