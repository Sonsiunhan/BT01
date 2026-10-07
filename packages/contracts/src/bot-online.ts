import { z } from "zod";

import { MatchBoardSchema, MatchModeSchema, MatchResultReasonSchema, MatchSideSchema, MatchStatusSchema } from "./match.js";

/** Public, source-free view of a Bot Online slot. */
export const BotOnlinePlayerSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  side: MatchSideSchema,
  botName: z.string().min(1),
  botId: z.string().min(1).nullable().optional(),
  activeRevisionId: z.string().min(1),
  activeRevisionNumber: z.number().int().positive(),
  pendingRevisionId: z.string().min(1).nullable(),
  pendingRevisionNumber: z.number().int().positive().nullable(),
  thinking: z.boolean(),
  connected: z.boolean(),
  owner: z.boolean(),
});

export const BotOnlineLimitSchema = z.object({
  perTurnMs: z.number().int().positive(),
  wholeMatchMs: z.number().int().positive(),
  maxTurns: z.number().int().positive(),
  deterministicSeed: z.boolean(),
});

export const BotOnlineMoveSchema = z.object({
  sequence: z.number().int().nonnegative(),
  side: MatchSideSchema,
  from: z.string().regex(/^[a-i][1-9]$/),
  to: z.string().regex(/^[a-i][1-9]$/),
  captured: z.string().regex(/^[RPS]$/).nullable(),
});

/**
 * Observer payload. It deliberately contains no Python source, memory,
 * private logs, seed or runtime diagnostics. Owners receive those through a
 * separate private response which is never placed in SSE/spectator payloads.
 */
export const BotOnlineSnapshotSchema = z.object({
  sessionId: z.uuid(),
  roomId: z.string().length(6),
  mode: MatchModeSchema,
  status: MatchStatusSchema,
  board: MatchBoardSchema,
  currentTurn: MatchSideSchema.nullable(),
  winner: MatchSideSchema.nullable(),
  resultReason: MatchResultReasonSchema,
  sequence: z.number().int().nonnegative(),
  stateVersion: z.number().int().nonnegative(),
  players: z.array(BotOnlinePlayerSchema).length(2),
  moves: z.array(BotOnlineMoveSchema).max(120),
  limits: BotOnlineLimitSchema,
  revisionNotice: z.string().max(240).nullable(),
  runtimeState: z.enum(["READY", "THINKING", "PAUSED", "UNAVAILABLE", "FAILED"]).default("READY"),
});

export const BotOnlineSelectRequestSchema = z.object({
  botId: z.string().min(1),
  revisionId: z.string().min(1),
});

export const BotOnlineUploadRequestSchema = z.object({
  botId: z.string().min(1),
  source: z.string().min(1),
});

export const BotOnlineStepRequestSchema = z.object({
  stateVersion: z.number().int().nonnegative().optional(),
});

export type BotOnlinePlayer = z.infer<typeof BotOnlinePlayerSchema>;
export type BotOnlineSnapshot = z.infer<typeof BotOnlineSnapshotSchema>;
export type BotOnlineSelectRequest = z.infer<typeof BotOnlineSelectRequestSchema>;
export type BotOnlineUploadRequest = z.infer<typeof BotOnlineUploadRequestSchema>;
export type BotOnlineStepRequest = z.infer<typeof BotOnlineStepRequestSchema>;
