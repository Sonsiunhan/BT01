import type { CompactMatchSnapshot, DomainEventEnvelope } from "@ottv2/contracts";

export interface CommandKey {
  principalId: string;
  commandId: string;
  targetId: string;
  operation: string;
  payloadHash?: string;
}

export interface BotPrivateCheckpoint {
  matchId: string;
  botId: string;
  revisionId: string;
  memory: unknown;
  turnNumber: number;
  seed?: number;
}

export interface CommitTransitionInput {
  commandKey: CommandKey;
  expectedVersion: number;
  nextState: CompactMatchSnapshot | Record<string, unknown>;
  domainEvents: DomainEventEnvelope[];
  privateCheckpoint?: BotPrivateCheckpoint | null;
}

export interface CommandOutcome {
  commandId: string;
  principalId: string;
  outcome: "COMMITTED" | "CONFLICT" | "UNKNOWN";
  stateVersion: number;
  sequence: number;
  ackPayload: unknown;
  committedAt: number;
  expiresAt?: number;
  isTombstone?: boolean;
}

export interface CommitTransitionResult {
  outcome: "COMMITTED" | "CONFLICT" | "UNKNOWN";
  stateVersion?: number;
  sequence?: number;
  conflictReason?: string;
  existingOutcome?: CommandOutcome;
}

export interface ReadOutcomeQuery {
  principalId: string;
  commandId: string;
  targetId?: string;
  operation?: string;
}

export interface RestoredMatchState {
  snapshot: CompactMatchSnapshot;
  setupDescriptor: {
    rulesVersion: string;
    seed: number;
  };
  watermark: {
    lastCommittedSequence: number;
    lastCommittedStateVersion: number;
    timestamp: number;
  };
  privateCheckpoints?: Record<string, BotPrivateCheckpoint>;
}

export interface CommitPort {
  commitTransition(input: CommitTransitionInput): Promise<CommitTransitionResult>;
  readOutcome(query: ReadOutcomeQuery): Promise<CommandOutcome | null>;
  restoreMatch(matchId: string): Promise<RestoredMatchState | null>;
}

export interface BotPrivateCheckpointPort {
  saveCheckpoint(checkpoint: BotPrivateCheckpoint): Promise<void>;
  readCheckpoint(matchId: string, botId: string): Promise<BotPrivateCheckpoint | null>;
}
