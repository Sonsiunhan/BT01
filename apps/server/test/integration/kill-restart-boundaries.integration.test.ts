import { describe, expect, it } from "vitest";
import { PrismaCommitPort } from "../../src/modules/match/commit/commit.prisma.js";
import { MatchRecoveryManager } from "../../src/modules/match/recovery/match-recovery.manager.js";
import {
  createRehearsalDb,
  rehearseBoundary1PreCommitKill,
  rehearseBoundary2PostCommitPreAckKill,
  rehearseBoundary3PostAckKill,
  runAllKillRestartRehearsals,
} from "../../../../scripts/network/kill-restart-rehearsal.mjs";
import {
  createSafeBackup,
  rehearseRestore,
  rehearseRollbackCompatibility,
  runAllBackupRestoreRehearsals,
} from "../../../../scripts/network/backup-restore-rehearsal.mjs";

describe("L06-W4: Kill/Restart Across 3 Commit Boundaries (L-05.03)", () => {
  it("Boundary 1 (Pre-commit kill): rolls back completely with 0 mixed state and allows clean retry", async () => {
    const mockDb = createRehearsalDb();
    const commitPort = new PrismaCommitPort(mockDb.prisma as any, undefined, () => Date.now());

    const result = await rehearseBoundary1PreCommitKill(commitPort, mockDb);

    expect(result.boundary).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.initialOutcome).toBe("UNKNOWN");
    expect(result.retryOutcome).toBe("COMMITTED");
    expect(result.stateVersion).toBe(1);
  });

  it("Boundary 2 (Post-commit pre-ACK kill): transaction commits, retry returns COMMITTED without duplicate writes", async () => {
    const mockDb = createRehearsalDb();
    const commitPort = new PrismaCommitPort(mockDb.prisma as any, undefined, () => Date.now());

    const result = await rehearseBoundary2PostCommitPreAckKill(commitPort, mockDb);

    expect(result.boundary).toBe(2);
    expect(result.passed).toBe(true);
    expect(result.recoveredFromCrash).toBe(true);
    expect(result.retryOutcome).toBe("COMMITTED");
    expect(result.duplicateEventsGenerated).toBe(0);
    expect(result.stateVersion).toBe(1);
  });

  it("Boundary 3 (Post-ACK kill): process restarted, MatchRecoveryManager restores state without outage penalty", async () => {
    const mockDb = createRehearsalDb();
    const commitPort = new PrismaCommitPort(mockDb.prisma as any, undefined, () => Date.now());
    const recoveryManager = new MatchRecoveryManager(mockDb.prisma as any);

    const result = await rehearseBoundary3PostAckKill(commitPort, recoveryManager, mockDb);

    expect(result.boundary).toBe(3);
    expect(result.passed).toBe(true);
    expect(result.clocksPreservedWithoutOutagePenalty).toBe(true);
    expect(result.membershipsDisconnectedUntilReconnect).toBe(true);
    expect(result.zeroAckedMovesLost).toBe(true);
    expect(result.recoveredStateVersion).toBe(1);
  });

  it("Full Kill/Restart rehearsal suite passes cleanly", async () => {
    const report = await runAllKillRestartRehearsals();
    expect(report.overallVerdict).toBe("PASS");
    expect(report.boundaries.length).toBe(3);
  });
});

describe("L06-W4: Backup/Restore & Rollback Rehearsal on Disposable DB (L-05.12)", () => {
  it("Safe backup enforces 0600 mode and strips credentials/secrets", async () => {
    const mockDb = createRehearsalDb();
    const commitPort = new PrismaCommitPort(mockDb.prisma as any, undefined, () => Date.now());
    const recoveryManager = new MatchRecoveryManager(mockDb.prisma as any);
    await rehearseBoundary3PostAckKill(commitPort, recoveryManager, mockDb);

    const backup = await createSafeBackup(mockDb.store);
    expect(backup.tables.match.length).toBeGreaterThan(0);
    expect(backup.tables.matchCheckpoint.length).toBeGreaterThan(0);
    expect(backup.tables.commandLedgerEntry.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(backup);
    expect(serialized).not.toMatch(/postgresql:\/\/[^:]+:[^@]+@/i);
    expect(serialized).not.toMatch(/"password"\s*:/i);
  });

  it("Restore rehearsal recovers 100% records across all 7 persistence models on disposable target DB", async () => {
    const sourceDb = createRehearsalDb();
    const commitPort = new PrismaCommitPort(sourceDb.prisma as any, undefined, () => Date.now());
    const recoveryManager = new MatchRecoveryManager(sourceDb.prisma as any);
    await rehearseBoundary3PostAckKill(commitPort, recoveryManager, sourceDb);

    const backup = await createSafeBackup(sourceDb.store);
    const targetDb = createRehearsalDb();

    const restoreResult = await rehearseRestore(backup, targetDb.store, {
      targetDbUrl: "postgresql://disposable_user:disposable_pass@localhost:5432/ottv2_test_disposable",
    });

    expect(restoreResult.restored).toBe(true);
    expect(restoreResult.verifiedRecordCounts.matches).toBe(backup.tables.match.length);
    expect(restoreResult.verifiedRecordCounts.checkpoints).toBe(backup.tables.matchCheckpoint.length);
    expect(restoreResult.verifiedRecordCounts.ledgerEntries).toBe(backup.tables.commandLedgerEntry.length);
  });

  it("Rollback rehearsal confirms legacy readers successfully read expand-only records without data loss", async () => {
    const sourceDb = createRehearsalDb();
    const commitPort = new PrismaCommitPort(sourceDb.prisma as any, undefined, () => Date.now());
    const recoveryManager = new MatchRecoveryManager(sourceDb.prisma as any);
    await rehearseBoundary3PostAckKill(commitPort, recoveryManager, sourceDb);

    const backup = await createSafeBackup(sourceDb.store);
    const targetDb = createRehearsalDb();
    await rehearseRestore(backup, targetDb.store);

    const rollbackResult = await rehearseRollbackCompatibility(targetDb.store);
    expect(rollbackResult.rollbackCompatible).toBe(true);
    expect(rollbackResult.legacyMatchesRead).toBeGreaterThan(0);
    expect(rollbackResult.legacyCheckpointsRead).toBeGreaterThan(0);
  });

  it("Full Backup/Restore & Rollback rehearsal suite passes cleanly", async () => {
    const report = await runAllBackupRestoreRehearsals();
    expect(report.overallVerdict).toBe("PASS");
    expect(report.phases.length).toBe(3);
  });
});
