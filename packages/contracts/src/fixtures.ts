import {
  AckEnvelopeSchema,
  type AckEnvelope,
} from "./command.js";
import {
  CompactMatchSnapshotSchema,
  FullSyncSnapshotSchema,
  ClockPulseSchema,
  ViewerContextSchema,
  type CompactMatchSnapshot,
  type FullSyncSnapshot,
  type ClockPulse,
  type ViewerContext,
} from "./snapshot.js";
import {
  DomainEventEnvelopeSchema,
  type DomainEventEnvelope,
  type EventScope,
} from "./events.js";
import {
  BotMoveResponseDtoSchema,
  type BotMoveResponseDto,
} from "./bot-abi.js";
import { projectViewerResponse } from "./projection.js";
import type { MatchCoordinate, MatchSide, MatchStatus } from "./match.js";
import type { RoomRole } from "./mode.js";

const canonicalEmptyBoard = Object.fromEntries(
  Array.from({ length: 81 }, (_, i) => [
    `${String.fromCharCode(97 + (i % 9))}${Math.floor(i / 9) + 1}`,
    null,
  ])
);

export function createMoveAckFixture(options: {
  commandId: string;
  matchId: string;
  stateVersion: number;
  sequence: number;
  data?: unknown;
}): AckEnvelope {
  return AckEnvelopeSchema.parse({
    protocolVersion: "0.2",
    commandId: options.commandId,
    outcome: "COMMITTED",
    targetId: options.matchId,
    stateVersion: options.stateVersion,
    sequence: options.sequence,
    data: options.data ?? { success: true },
  });
}

export function createCompactSnapshotFixture(options: {
  matchId: string;
  roomId: string;
  status?: MatchStatus;
  currentTurn?: MatchSide | null;
  serverTime?: number;
  sequence?: number;
  stateVersion?: number;
}): CompactMatchSnapshot {
  const status = options.status ?? "PLAYING";
  const currentTurn = options.currentTurn ?? "BLUE";

  return CompactMatchSnapshotSchema.parse({
    matchId: options.matchId,
    roomId: options.roomId,
    mode: "UNRANKED",
    status,
    players: [
      { userId: "u1", username: "blue_user", displayName: "Blue", side: "BLUE", ready: true, connected: true },
      { userId: "u2", username: "red_user", displayName: "Red", side: "RED", ready: true, connected: true },
    ],
    board: canonicalEmptyBoard,
    pieceCounts: {
      BLUE: { R: 6, P: 6, S: 6 },
      RED: { R: 6, P: 6, S: 6 },
    },
    currentTurn,
    winner: null,
    resultReason: null,
    clocksMs: { BLUE: 30000, RED: 30000 },
    runningSide: status === "PLAYING" ? currentTurn : null,
    serverTime: options.serverTime ?? Date.now(),
    sequence: options.sequence ?? 1,
    stateVersion: options.stateVersion ?? 1,
    countdownEndsAt: null,
    startedAt: null,
    endedAt: null,
    pauseReason: null,
    pauseCategory: null,
    pausedAt: null,
    pausePhase: null,
    pauseElapsedMs: 0,
    resumeEndsAt: null,
    replacementStatus: "IDLE",
  });
}

export function createFullSyncSnapshotFixture(options: {
  matchId: string;
  roomId: string;
  seed?: number;
  rulesVersion?: string;
  sequence?: number;
  stateVersion?: number;
}): FullSyncSnapshot {
  const compact = createCompactSnapshotFixture(options);
  const sequence = options.sequence ?? compact.sequence;
  const stateVersion = options.stateVersion ?? compact.stateVersion;

  return FullSyncSnapshotSchema.parse({
    ...compact,
    setupDescriptor: {
      rulesVersion: options.rulesVersion ?? "rps-v2",
      seed: options.seed ?? 1411200,
    },
    watermark: {
      lastCommittedSequence: sequence,
      lastCommittedStateVersion: stateVersion,
      timestamp: compact.serverTime,
    },
  });
}

export function createClockPulseFixture(options: {
  matchId: string;
  stateVersion: number;
  serverTime?: number;
  clocksMs?: { BLUE: number; RED: number };
  runningSide?: MatchSide | null;
  pulseSequence?: number;
}): ClockPulse {
  return ClockPulseSchema.parse({
    matchId: options.matchId,
    stateVersion: options.stateVersion,
    referenceSequence: options.stateVersion,
    serverTime: options.serverTime ?? Date.now(),
    clocksMs: options.clocksMs ?? { BLUE: 29000, RED: 30000 },
    runningSide: options.runningSide ?? "BLUE",
    pauseElapsedMs: 0,
    pulseSequence: options.pulseSequence ?? 1,
  });
}

export function createViewerResponseFixture(options: {
  role: RoomRole;
  side?: MatchSide | null;
  isHost?: boolean;
  matchStatus?: string;
  currentTurn?: MatchSide | null;
}): ViewerContext {
  const viewer = projectViewerResponse({
    principalId: "viewer_1",
    role: options.role,
    side: options.side ?? null,
    isHost: options.isHost ?? false,
    matchStatus: options.matchStatus ?? "PLAYING",
    currentTurn: options.currentTurn ?? "BLUE",
  });
  return ViewerContextSchema.parse(viewer);
}

export function createDomainEventFixture(
  scope: EventScope,
  options: {
    matchId?: string;
    roomId?: string;
    queueId?: string;
    type: string;
    sequence: number;
    stateVersion: number;
    payload?: unknown;
  }
): DomainEventEnvelope {
  const targetId = options.matchId ?? options.roomId ?? options.queueId ?? "target_1";
  return DomainEventEnvelopeSchema.parse({
    protocolVersion: "0.2",
    messageId: "11111111-1111-4111-8111-111111111111",
    type: options.type,
    timestamp: Date.now(),
    scope,
    targetId,
    sequence: options.sequence,
    stateVersion: options.stateVersion,
    payload: options.payload ?? {},
  });
}

export function createBotMoveResponseFixture(options: {
  from: MatchCoordinate;
  to: MatchCoordinate;
  memory?: unknown;
}): BotMoveResponseDto {
  return BotMoveResponseDtoSchema.parse({
    move: {
      from: options.from,
      to: options.to,
    },
    memory: options.memory ?? {},
  });
}
