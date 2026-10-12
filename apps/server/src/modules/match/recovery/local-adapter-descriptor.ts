export interface LocalMatchDescriptor {
  descriptorVersion: string;
  matchId: string;
  rulesVersion: string;
  setupVersion: string;
  initialBoard: unknown;
  currentBoard: unknown;
  stateVersion: number;
  sequence: number;
  turn: "BLUE" | "RED";
  clocksMs: { BLUE: number; RED: number };
  status: "PLAYING" | "PAUSED" | "FINISHED" | "ABORTED";
  botConfig?: {
    botId: string;
    revisionId: string;
    kitAvailable: boolean;
    requiredKitVersion?: string | undefined;
  } | undefined;
  persistedAt: number;
}

export interface LocalRestoreResult {
  restored: boolean;
  status: "PAUSED" | "PLAYING" | "ERROR" | "FINISHED" | "ABORTED";
  requiresKitDownload: boolean;
  descriptor?: LocalMatchDescriptor | undefined;
  errorMessage?: string | undefined;
}

export class LocalAdapterDescriptor {
  static readonly CURRENT_DESCRIPTOR_VERSION = "ott-local-v1";

  /**
   * Serializes active local match state into durable local descriptor.
   */
  static serialize(context: {
    matchId: string;
    rulesVersion?: string;
    setupVersion?: string;
    initialBoard: unknown;
    currentBoard: unknown;
    stateVersion: number;
    sequence: number;
    turn: "BLUE" | "RED";
    clocksMs: { BLUE: number; RED: number };
    status: "PLAYING" | "PAUSED" | "FINISHED" | "ABORTED";
    botConfig?: {
      botId: string;
      revisionId: string;
      kitAvailable: boolean;
      requiredKitVersion?: string;
    };
    now?: number;
  }): LocalMatchDescriptor {
    return {
      descriptorVersion: LocalAdapterDescriptor.CURRENT_DESCRIPTOR_VERSION,
      matchId: context.matchId,
      rulesVersion: context.rulesVersion ?? "rps-v1",
      setupVersion: context.setupVersion ?? "v1",
      initialBoard: context.initialBoard,
      currentBoard: context.currentBoard,
      stateVersion: context.stateVersion,
      sequence: context.sequence,
      turn: context.turn,
      clocksMs: { ...context.clocksMs },
      status: context.status,
      ...(context.botConfig ? { botConfig: { ...context.botConfig } } : {}),
      persistedAt: context.now ?? Date.now(),
    };
  }

  /**
   * Deserializes and restores local session state.
   * INVARIANT (FRS-L06 §4, L-05.11):
   * 1. Cold restore ALWAYS enters PAUSED state to allow player re-orientation.
   * 2. If bot kit is missing, flags requiresKitDownload without falling back to server execution.
   */
  static restore(rawJson: string | object): LocalRestoreResult {
    let descriptor: LocalMatchDescriptor;
    try {
      descriptor = typeof rawJson === "string" ? JSON.parse(rawJson) : (rawJson as LocalMatchDescriptor);
    } catch {
      return {
        restored: false,
        status: "ERROR",
        requiresKitDownload: false,
        errorMessage: "Dữ liệu phiên ngoại tuyến bị hỏng, không thể đọc JSON.",
      };
    }

    if (!descriptor.matchId || !descriptor.currentBoard) {
      return {
        restored: false,
        status: "ERROR",
        requiresKitDownload: false,
        errorMessage: "Thiếu dữ liệu trận đấu hoặc bàn cờ trong bản lưu cục bộ.",
      };
    }

    // Check if local bot kit is required and available
    const requiresKitDownload = descriptor.botConfig !== undefined && !descriptor.botConfig.kitAvailable;

    // Cold restore rule: Match resumes in PAUSED state
    const restoredStatus = descriptor.status === "FINISHED" || descriptor.status === "ABORTED"
      ? descriptor.status
      : "PAUSED";

    return {
      restored: true,
      status: restoredStatus,
      requiresKitDownload,
      descriptor: {
        ...descriptor,
        status: restoredStatus,
      },
    };
  }
}
