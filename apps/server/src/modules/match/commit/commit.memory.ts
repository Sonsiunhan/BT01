import type { CompactMatchSnapshot, DomainEventEnvelope } from "@ottv2/contracts";
import { commandPayloadConflicts } from "./commit.port.js";
import type {
  BotPrivateCheckpoint,
  BotPrivateCheckpointPort,
  CommandOutcome,
  CommitPort,
  CommitTransitionInput,
  CommitTransitionResult,
  ReadOutcomeQuery,
  RestoredMatchState,
} from "./commit.port.js";
import { CommandLedger } from "./command-ledger.js";

export class InMemoryCommitPort implements CommitPort, BotPrivateCheckpointPort {
  private readonly states = new Map<string, CompactMatchSnapshot | Record<string, unknown>>();
  private readonly versions = new Map<string, number>();
  private readonly sequences = new Map<string, number>();
  private readonly domainEvents = new Map<string, DomainEventEnvelope[]>();
  private readonly privateCheckpoints = new Map<string, Map<string, BotPrivateCheckpoint>>();
  readonly ledger: CommandLedger;
  private readonly now: () => number;

  constructor(ledger = new CommandLedger(), now: () => number = Date.now) {
    this.ledger = ledger;
    this.now = now;
  }

  commitTransitionSync(input: CommitTransitionInput): CommitTransitionResult {
    const targetId = input.commandKey.targetId;

    // Fast-path: Check if command was already committed idempotently
    const existing = this.ledger.get(input.commandKey);
    if (existing) {
      if (commandPayloadConflicts(existing, input.commandKey)) {
        return { outcome: "CONFLICT", conflictReason: "COMMAND_ID_REUSED", stateVersion: existing.stateVersion, sequence: existing.sequence, existingOutcome: existing };
      }
      return {
        outcome: existing.outcome,
        stateVersion: existing.stateVersion,
        sequence: existing.sequence,
        existingOutcome: existing,
      };
    }

    // CAS check on target version
    if (!this.versions.has(targetId)) {
      this.versions.set(targetId, input.expectedVersion);
    }
    const currentVersion = this.versions.get(targetId)!;
    if (input.expectedVersion !== currentVersion) {
      return {
        outcome: "CONFLICT",
        conflictReason: "STALE_VERSION",
        stateVersion: currentVersion,
      };
    }

    // Advance version and sequence
    const nextVersion = currentVersion + 1;
    const currentSeq = this.sequences.get(targetId) ?? 0;
    const nextSeq = currentSeq + (input.domainEvents.length > 0 ? input.domainEvents.length : 1);

    this.versions.set(targetId, nextVersion);
    this.sequences.set(targetId, nextSeq);
    this.states.set(targetId, input.nextState);

    // Save domain events
    if (input.domainEvents.length > 0) {
      const existingEvents = this.domainEvents.get(targetId) ?? [];
      existingEvents.push(...input.domainEvents);
      this.domainEvents.set(targetId, existingEvents);
    }

    // Save private checkpoint if provided
    if (input.privateCheckpoint) {
      this.saveCheckpointSync(input.privateCheckpoint);
    }

    // Record outcome in Command Ledger
    const outcome: CommandOutcome = {
      commandId: input.commandKey.commandId,
      principalId: input.commandKey.principalId,
      outcome: "COMMITTED",
      stateVersion: nextVersion,
      sequence: nextSeq,
      ackPayload: input.nextState,
      committedAt: this.now(),
      ...(input.commandKey.payloadHash ? { payloadHash: input.commandKey.payloadHash } : {}),
    };
    this.ledger.record(outcome, input.commandKey);

    return {
      outcome: "COMMITTED",
      stateVersion: nextVersion,
      sequence: nextSeq,
    };
  }

  async commitTransition(input: CommitTransitionInput): Promise<CommitTransitionResult> {
    return this.commitTransitionSync(input);
  }

  async readOutcome(query: ReadOutcomeQuery): Promise<CommandOutcome | null> {
    return (
      (query.targetId && query.operation ? this.ledger.get({
        principalId: query.principalId,
        commandId: query.commandId,
        targetId: query.targetId,
        operation: query.operation,
      }) : undefined) ??
      null
    );
  }

  async restoreMatch(matchId: string): Promise<RestoredMatchState | null> {
    const state = this.states.get(matchId) as CompactMatchSnapshot | undefined;
    if (!state) return null;

    const version = this.versions.get(matchId) ?? 0;
    const sequence = this.sequences.get(matchId) ?? 0;
    const checkpoints = this.privateCheckpoints.get(matchId);

    return {
      snapshot: state,
      setupDescriptor: {
        rulesVersion: "rps-v2",
        seed: 0,
      },
      watermark: {
        lastCommittedSequence: sequence,
        lastCommittedStateVersion: version,
        timestamp: this.now(),
      },
      ...(checkpoints ? { privateCheckpoints: Object.fromEntries(checkpoints) } : {}),
    };
  }

  saveCheckpointSync(checkpoint: BotPrivateCheckpoint): void {
    const matchCheckpoints = this.privateCheckpoints.get(checkpoint.matchId) ?? new Map<string, BotPrivateCheckpoint>();
    matchCheckpoints.set(checkpoint.botId, checkpoint);
    this.privateCheckpoints.set(checkpoint.matchId, matchCheckpoints);
  }

  async saveCheckpoint(checkpoint: BotPrivateCheckpoint): Promise<void> {
    this.saveCheckpointSync(checkpoint);
  }

  async readCheckpoint(matchId: string, botId: string): Promise<BotPrivateCheckpoint | null> {
    return this.privateCheckpoints.get(matchId)?.get(botId) ?? null;
  }

  clear(targetId?: string): void {
    if (targetId) {
      this.versions.delete(targetId);
      this.sequences.delete(targetId);
      this.states.delete(targetId);
      this.domainEvents.delete(targetId);
      this.ledger.clear(targetId);
    } else {
      this.versions.clear();
      this.sequences.clear();
      this.states.clear();
      this.domainEvents.clear();
      this.ledger.clear();
    }
  }

  // Test / helper methods
  setInitialVersion(targetId: string, version: number, sequence = 0): void {
    this.versions.set(targetId, version);
    this.sequences.set(targetId, sequence);
  }

  getCurrentVersion(targetId: string): number {
    return this.versions.get(targetId) ?? 0;
  }

  getCurrentSequence(targetId: string): number {
    return this.sequences.get(targetId) ?? 0;
  }
}
