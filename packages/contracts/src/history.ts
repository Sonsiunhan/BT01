import { z } from "zod";

import { MatchBoardSchema, MatchBotAdjudicationSchema } from "./match.js";

export const HistoryModeSchema = z.enum(["RANKED", "UNRANKED", "GUEST", "AI", "OFFLINE", "BOT_ONLINE", "BOT_OFFLINE"]);
export const HistoryModeFilterSchema = z.enum(["ALL", ...HistoryModeSchema.options]);
export const HistoryResultFilterSchema = z.enum(["ALL", "WIN", "LOSS"]);
export const HistoryRangeFilterSchema = z.enum(["7D", "30D", "ALL"]);
export const HistorySourceSchema = z.enum(["ACCOUNT", "LOCAL"]);
export const HistoryReplayMoveSchema = z.object({
  sequence: z.number().int().nonnegative(),
  stateVersion: z.number().int().nonnegative(),
  side: z.enum(["BLUE", "RED"]),
  from: z.string().regex(/^[a-i][1-9]$/),
  to: z.string().regex(/^[a-i][1-9]$/),
  capturedPieceId: z.string().min(1).nullable(),
  committedAt: z.string().datetime(),
});
export const HistoryTimelineEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  type: z.enum(["MATCH_STARTED", "PIECE_MOVE_ACCEPTED", "MATCH_PAUSED", "MATCH_RESUMED", "REFEREE_REPLACED", "BOT_REVISION_APPLIED", "MATCH_FINISHED", "MATCH_ABORTED"]),
  timestamp: z.string().datetime(),
  side: z.enum(["BLUE", "RED"]).nullable().optional(),
  reason: z.string().nullable().optional(),
  revisionNumber: z.number().int().positive().optional(),
});
export const HistoryReplaySchema = z.object({
  available: z.boolean(),
  moves: z.array(HistoryReplayMoveSchema),
  timeline: z.array(HistoryTimelineEventSchema),
  legacyFinalBoardOnly: z.boolean(),
});

export const HistoryQuerySchema = z.object({
  mode: HistoryModeFilterSchema.default("ALL"),
  result: HistoryResultFilterSchema.default("ALL"),
  range: HistoryRangeFilterSchema.default("ALL"),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(20),
});

export const HistoryPlayerSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  side: z.enum(["BLUE", "RED"]),
  isViewer: z.boolean(),
  isWinner: z.boolean().nullable(),
  ratingBefore: z.number().int().nonnegative().nullable(),
  ratingAfter: z.number().int().nonnegative().nullable(),
  ratingDelta: z.number().int().nullable(),
});

export const HistoryMatchCardSchema = z.object({
  matchId: z.string().uuid(),
  roomId: z.string().length(6),
  mode: HistoryModeSchema,
  status: z.enum(["FINISHED", "ABORTED"]),
  result: z.enum(["WIN", "LOSS", "ABORTED"]),
  resultReason: z.enum(["EXTINCTION", "GOAL_REACHED", "TIMEOUT", "SURRENDER", "DISCONNECT_TIMEOUT", "SERVER_INTERRUPTION", "BOT_AUTHOR_FAULT", "BOT_INFRASTRUCTURE", "BOT_LIMIT_CRITERIA", "BOT_LIMIT_EXACT_TIE"]).nullable(),
  winner: z.enum(["BLUE", "RED"]).nullable(),
  viewer: HistoryPlayerSchema,
  opponent: HistoryPlayerSchema.nullable(),
  timerSeconds: z.number().int().positive(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().nonnegative(),
  ratingDelta: z.number().int().nullable(),
  finalBoard: MatchBoardSchema.nullable(),
  source: HistorySourceSchema.optional(),
  replayAvailable: z.boolean().optional(),
  moveCount: z.number().int().nonnegative().optional(),
  botAdjudication: MatchBotAdjudicationSchema.optional(),
});

export const HistorySummarySchema = z.object({
  elo: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(100),
});

export const HistoryListResponseSchema = z.object({
  matches: z.array(HistoryMatchCardSchema),
  nextCursor: z.string().uuid().nullable(),
  hasMore: z.boolean(),
  summary: HistorySummarySchema,
});

export const HistoryDetailResponseSchema = z.object({
  match: HistoryMatchCardSchema.extend({
    players: z.array(HistoryPlayerSchema).min(1).max(2),
    replay: HistoryReplaySchema.optional(),
  }),
});

export const HistoryAuditResponseSchema = z.object({
  match: HistoryMatchCardSchema,
  replay: HistoryReplaySchema,
  exportedAt: z.string().datetime(),
  retention: z.object({ sourceUntil: z.string().datetime().nullable(), logsUntil: z.string().datetime().nullable() }),
});

export type HistoryMode = z.infer<typeof HistoryModeSchema>;
export type HistoryResultFilter = z.infer<typeof HistoryResultFilterSchema>;
export type HistoryRangeFilter = z.infer<typeof HistoryRangeFilterSchema>;
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
export type HistoryPlayer = z.infer<typeof HistoryPlayerSchema>;
export type HistoryMatchCard = z.infer<typeof HistoryMatchCardSchema>;
export type HistoryListResponse = z.infer<typeof HistoryListResponseSchema>;
export type HistoryDetailResponse = z.infer<typeof HistoryDetailResponseSchema>;
export type HistoryReplayMove = z.infer<typeof HistoryReplayMoveSchema>;
export type HistoryTimelineEvent = z.infer<typeof HistoryTimelineEventSchema>;
export type HistoryReplay = z.infer<typeof HistoryReplaySchema>;
export type HistoryAuditResponse = z.infer<typeof HistoryAuditResponseSchema>;
