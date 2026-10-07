import { createBotTurnState, DEFAULT_BOT_LIMITS, validateBotSource, type BotTurnState } from "@ottv2/bot-sdk";
import { createInitialState } from "@ottv2/game-rules";
import type { BotMove, JsonValue } from "@ottv2/bot-sdk";
import { executeOfflineIsolated, OfflineCompartmentError } from "./offlineCompartment";
import { getOfflineKitStatus } from "../local/offlineKit";

export class BotOfflineRunnerError extends Error { constructor(public readonly code: string, message: string) { super(message); } }

// Local fixture acceptance does not authorize production runtime activation.
// Keep fail-closed until the complete runtime and release gates are approved.
export type OfflineRuntimeStatus = { ready: boolean; verifying: boolean; message: string; verifiedAt?: string; memoryRoundTrip?: boolean };

// The release gate is opened only after a real pinned-kit + opaque-origin
// iframe/Worker attestation. Never replace this with a static ready flag.
export const OFFLINE_RUNTIME_STATUS: OfflineRuntimeStatus = {
  ready: false,
  verifying: false,
  message: "Python Offline chưa được xác minh trong sandbox của trình duyệt này. Hãy tải kit rồi kiểm tra lại.",
};

const TRUSTED_PROBE_SOURCE = `# ottv2-memory-schema: ottv2-offline-attestation-v1\ndef choose_move(state, memory):\n    current = memory if isinstance(memory, dict) else {}\n    return state["legal_moves"][0], {"schema": "ottv2-offline-attestation-v1", "counter": int(current.get("counter", 0)) + 1}\n`;
let verificationFlight: Promise<OfflineRuntimeStatus> | null = null;

function blockRuntime(message: string): OfflineRuntimeStatus {
  OFFLINE_RUNTIME_STATUS.ready = false;
  OFFLINE_RUNTIME_STATUS.verifying = false;
  OFFLINE_RUNTIME_STATUS.message = message;
  delete OFFLINE_RUNTIME_STATUS.verifiedAt;
  delete OFFLINE_RUNTIME_STATUS.memoryRoundTrip;
  return OFFLINE_RUNTIME_STATUS;
}

/** Verify the real browser sandbox with a fixed, non-player probe. */
export async function verifyOfflineRuntime(signal?: AbortSignal): Promise<OfflineRuntimeStatus> {
  if (OFFLINE_RUNTIME_STATUS.ready) return OFFLINE_RUNTIME_STATUS;
  if (verificationFlight) return verificationFlight;
  verificationFlight = (async () => {
    OFFLINE_RUNTIME_STATUS.verifying = true;
    OFFLINE_RUNTIME_STATUS.message = "Đang xác minh Offline kit và sandbox cô lập…";
    try {
      const kit = await getOfflineKitStatus();
      if (!kit.ready) throw new BotOfflineRunnerError("OFFLINE_KIT_MISSING", kit.message);
      const validation = validateBotSource(TRUSTED_PROBE_SOURCE);
      if (!validation.ok) throw new BotOfflineRunnerError(validation.code, validation.message);
      const state = createBotTurnState(createInitialState(), "BLUE", [], { BLUE: 30_000, RED: 30_000 }, 1);
      const first = await executeOfflineIsolated({ source: TRUSTED_PROBE_SOURCE, state, memory: null, seed: 0, phase: "PREFLIGHT" }, signal, true);
      const firstMemory = first.memory as Record<string, unknown> | null;
      if (!firstMemory || firstMemory.schema !== "ottv2-offline-attestation-v1" || firstMemory.counter !== 1) throw new BotOfflineRunnerError("MEMORY_ROUND_TRIP_FAILED", "Sandbox không giữ được memory attestation hợp lệ.");
      const second = await executeOfflineIsolated({ source: TRUSTED_PROBE_SOURCE, state, memory: firstMemory as JsonValue, seed: 1, phase: "PREFLIGHT" }, signal, true);
      const secondMemory = second.memory as Record<string, unknown> | null;
      if (!secondMemory || secondMemory.schema !== firstMemory.schema || secondMemory.counter !== 2) throw new BotOfflineRunnerError("MEMORY_ROUND_TRIP_FAILED", "Sandbox không xác minh được memory tương thích giữa các lượt.");
      if (!first.isolationProof.parentDenied || !first.isolationProof.storageDenied || !first.isolationProof.cookieDenied || !first.isolationProof.memoryMaximumEnforced || !first.isolationProof.networkDenied || !first.isolationProof.storageAbsent || first.isolationProof.memoryMaximumPages !== DEFAULT_BOT_LIMITS.wasmMemoryPages) throw new BotOfflineRunnerError("OFFLINE_SANDBOX_NOT_VERIFIED", "Probe sandbox không đạt đủ bằng chứng cô lập.");
      OFFLINE_RUNTIME_STATUS.ready = true;
      OFFLINE_RUNTIME_STATUS.verifying = false;
      OFFLINE_RUNTIME_STATUS.message = "Offline sandbox đã được xác minh; Bot chỉ chạy trong iframe opaque-origin + Worker cô lập.";
      OFFLINE_RUNTIME_STATUS.verifiedAt = new Date().toISOString();
      OFFLINE_RUNTIME_STATUS.memoryRoundTrip = true;
      return OFFLINE_RUNTIME_STATUS;
    } catch (error) {
      return blockRuntime(error instanceof BotOfflineRunnerError ? error.message : "Không thể xác minh Offline sandbox; hệ thống giữ fail-closed.");
    } finally { verificationFlight = null; }
  })();
  return verificationFlight;
}

export function invalidateOfflineRuntime(message = "Offline kit hoặc sandbox đã thay đổi; cần xác minh lại trước khi chạy."): void { blockRuntime(message); }

export async function runOfflineBotTurn(input: { source: string; state: BotTurnState; memory: unknown; signal?: AbortSignal; preflight?: boolean }): Promise<{ move: BotMove; memory: unknown; computeMs: number }> {
  const validation = validateBotSource(input.source);
  if (!validation.ok) throw new BotOfflineRunnerError(validation.code, validation.message);
  if (input.signal?.aborted) throw new BotOfflineRunnerError("ABORTED", "Lượt tính đã được dừng ở ranh giới an toàn.");
  if (!OFFLINE_RUNTIME_STATUS.ready) throw new BotOfflineRunnerError("OFFLINE_SANDBOX_NOT_VERIFIED", OFFLINE_RUNTIME_STATUS.message);
  const kit = await getOfflineKitStatus();
  if (!kit.ready) { invalidateOfflineRuntime(kit.message); throw new BotOfflineRunnerError("OFFLINE_KIT_MISSING", kit.message); }
  try {
    return await executeOfflineIsolated({ source: input.source, state: input.state, memory: input.memory as JsonValue ?? null, seed: 42 }, input.signal, input.preflight);
  } catch (error) {
    const code = error instanceof OfflineCompartmentError ? error.code : "BOT_WORKER_FAILED";
    if (["OFFLINE_KIT_MISSING", "RUNTIME_HASH_MISMATCH", "FRAME_ISOLATION_FAILED", "RUNTIME_ISOLATION_FAILED"].includes(code)) invalidateOfflineRuntime("Offline kit hoặc sandbox không còn đạt kiểm chứng; đã khóa chạy để bảo toàn an toàn.");
    throw new BotOfflineRunnerError(code, code === "TURN_TIMEOUT" ? "Bot vượt ngân sách mỗi lượt." : code === "ABORTED" ? "Lượt tính đã được hủy an toàn." : "Bot không hoàn tất lượt tính an toàn. Kiểm tra chiến thuật và Offline kit.");
  }
}
