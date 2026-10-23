import { z } from "zod";
import { MatchPieceSchema, MatchSideSchema } from "./match.js";

/** Bot ABI coordinates support the bounded rule-profile board (5..15). */
export const BotCoordinateSchema = z.string().regex(/^[a-o](?:1[0-5]|[1-9])$/);
export const BotBoardSchema = z.record(BotCoordinateSchema, MatchPieceSchema.nullable());

export const BotStateDtoSchema = z.object({
  side: MatchSideSchema,
  board: BotBoardSchema,
  legalMoves: z.array(z.object({ from: BotCoordinateSchema, to: BotCoordinateSchema })),
  dimensions: z.object({ rows: z.number().int().min(1).max(15), cols: z.number().int().min(1).max(15) }),
  goals: z.object({ BLUE: BotCoordinateSchema.nullable(), RED: BotCoordinateSchema.nullable() }),
  rules: z.object({ version: z.string().min(1), winConditions: z.array(z.enum(["EXTINCTION", "GOAL_REACHED"])) }),
  turnNumber: z.number().int().positive(),
  clocksMs: z.object({ BLUE: z.number(), RED: z.number() }),
  publicHistory: z.array(z.object({ sequence: z.number(), from: BotCoordinateSchema, to: BotCoordinateSchema })).optional(),
});
export type BotStateDto = z.infer<typeof BotStateDtoSchema>;

export const BotMoveResponseDtoSchema = z.object({
  move: z.object({ from: BotCoordinateSchema, to: BotCoordinateSchema }),
  memory: z.unknown(),
});
export type BotMoveResponseDto = z.infer<typeof BotMoveResponseDtoSchema>;

export const TrustedInvocationDtoSchema = z.object({
  matchId: z.string().uuid(),
  stateVersion: z.number().int().nonnegative(),
  invocationId: z.string().uuid(),
  turnToken: z.string().min(1),
  activeRevision: z.string().min(1),
  budgets: z.object({ computeMs: z.number().int().positive(), memoryMb: z.number().int().positive() }),
});
export type TrustedInvocationDto = z.infer<typeof TrustedInvocationDtoSchema>;

export const TrustedResultDtoSchema = z.object({
  invocationId: z.string().uuid(),
  move: z.object({ from: BotCoordinateSchema, to: BotCoordinateSchema }),
  memory: z.unknown(),
  computeMs: z.number().int().nonnegative(),
});
export type TrustedResultDto = z.infer<typeof TrustedResultDtoSchema>;

export const BotReceiptPhaseSchema = z.enum(["PREFLIGHT", "TURN"]);
export const BotReceiptOutcomeSchema = z.enum(["ACCEPTED", "REJECTED", "CANCELLED", "FAILED"]);
export const BotExecutionReceiptSchema = z.object({
  receiptId: z.uuid(),
  ownerId: z.string().min(1),
  botId: z.string().min(1),
  revisionId: z.string().min(1),
  sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  ruleVersion: z.string().min(1),
  sdkVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  runtimeVersion: z.string().min(1),
  policyVersion: z.string().min(1),
  phase: BotReceiptPhaseSchema,
  matchId: z.uuid(),
  stateVersion: z.number().int().nonnegative(),
  invocationId: z.uuid(),
  timestamp: z.string().datetime({ offset: true }),
  outcome: BotReceiptOutcomeSchema,
  computeMs: z.number().int().nonnegative(),
  errorCode: z.string().min(1).optional(),
});
export type BotExecutionReceipt = z.infer<typeof BotExecutionReceiptSchema>;
