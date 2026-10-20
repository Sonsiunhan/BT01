import { CompactMatchSnapshotSchema, type CompactMatchSnapshot, type ViewerContext } from "./snapshot.js";
import type { MatchSide } from "./match.js";
import type { RoomRole } from "./mode.js";

const SENSITIVE_KEY_PATTERNS = [
  /source/i,
  /memory/i,
  /token/i,
  /secret/i,
  /password/i,
  /stack/i,
  /internallogs/i,
  /diagnostics/i,
];

const CANARY_VALUE_PATTERNS = [
  /__CANARY_/i,
  /CANARY_TOKEN/i,
  /SECRET_KEY/i,
];

export interface CanaryScanResult {
  clean: boolean;
  leaks: string[];
}

export function canaryScan(data: unknown): CanaryScanResult {
  const leaks: string[] = [];

  function scan(node: unknown, path: string) {
    if (!node || typeof node !== "object") {
      if (typeof node === "string") {
        for (const pattern of CANARY_VALUE_PATTERNS) {
          if (pattern.test(node)) {
            leaks.push(path ? `${path} contains canary token: ${node}` : node);
          }
        }
      }
      return;
    }


    if (Array.isArray(node)) {
      node.forEach((item, index) => scan(item, `${path}[${index}]`));
      return;
    }

    const obj = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      for (const pattern of SENSITIVE_KEY_PATTERNS) {
        if (pattern.test(key)) {
          leaks.push(key);
        }
      }
      scan(value, currentPath);
    }
  }

  scan(data, "");
  return {
    clean: leaks.length === 0,
    leaks,
  };
}

export function projectPublicSnapshot(rawState: Record<string, unknown>): CompactMatchSnapshot {
  const candidate = {
    matchId: rawState.matchId,
    roomId: rawState.roomId,
    mode: rawState.mode,
    status: rawState.status,
    players: rawState.players,
    board: rawState.board,
    pieceCounts: rawState.pieceCounts,
    currentTurn: rawState.currentTurn,
    winner: rawState.winner,
    resultReason: rawState.resultReason,
    clocksMs: rawState.clocksMs,
    runningSide: rawState.runningSide ?? (rawState.status === "PLAYING" ? rawState.currentTurn : null),
    serverTime: rawState.serverTime ?? Date.now(),
    sequence: rawState.sequence,
    stateVersion: rawState.stateVersion,
    countdownEndsAt: rawState.countdownEndsAt ?? null,
    startedAt: rawState.startedAt ?? null,
    endedAt: rawState.endedAt ?? null,
    pauseReason: rawState.pauseReason ?? null,
    pauseCategory: rawState.pauseCategory ?? null,
    pausedAt: rawState.pausedAt ?? null,
    pausePhase: rawState.pausePhase ?? null,
    pauseElapsedMs: rawState.pauseElapsedMs ?? 0,
    resumeEndsAt: rawState.resumeEndsAt ?? null,
    replacementStatus: rawState.replacementStatus ?? "IDLE",
  };

  return CompactMatchSnapshotSchema.parse(candidate);
}

export interface ViewerResponseInput {
  principalId: string;
  role: RoomRole;
  side?: MatchSide | null;
  isHost: boolean;
  matchStatus?: string;
  currentTurn?: MatchSide | null;
}

export function projectViewerResponse(input: ViewerResponseInput): ViewerContext {
  const allowedActions: string[] = [];

  if (input.role === "PLAYER") {
    if (input.matchStatus === "WAITING_READY") {
      allowedActions.push("READY");
    }
    if (input.matchStatus === "PLAYING") {
      allowedActions.push("SURRENDER");
      if (input.side && input.side === input.currentTurn) {
        allowedActions.push("MOVE");
      }
    }
    if (input.matchStatus === "FINISHED") {
      allowedActions.push("REMATCH");
    }
  }

  if (input.role === "REFEREE") {
    if (input.matchStatus === "PLAYING") {
      allowedActions.push("STOP");
    }
    if (input.matchStatus === "PAUSED") {
      allowedActions.push("RESUME", "HOLD");
    }
  }

  if (input.isHost) {
    allowedActions.push("MANAGE_ROOM", "INVITE");
  }

  return {
    role: input.role,
    viewerSide: input.side ?? null,
    isHost: input.isHost,
    allowedActions,
  };
}
