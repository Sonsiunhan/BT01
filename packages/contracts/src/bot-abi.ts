import { z } from "zod";
import {
  MatchBoardSchema,
  MatchCoordinateSchema,
  MatchSideSchema,
} from "./match.js";

export const BotStateDtoSchema = z.object({
  side: MatchSideSchema,
  board: MatchBoardSchema,
  legalMoves: z.array(
    z.object({
      from: MatchCoordinateSchema,
      to: MatchCoordinateSchema,
    })
  ),
  turnNumber: z.number().int().positive(),
  clocksMs: z.object({
    BLUE: z.number(),
    RED: z.number(),
  }),
  publicHistory: z
    .array(
      z.object({
        sequence: z.number(),
        from: MatchCoordinateSchema,
        to: MatchCoordinateSchema,
      })
    )
    .optional(),
});
export type BotStateDto = z.infer<typeof BotStateDtoSchema>;

export const BotMoveResponseDtoSchema = z.object({
  move: z.object({
    from: MatchCoordinateSchema,
    to: MatchCoordinateSchema,
  }),
  memory: z.unknown(),
});
export type BotMoveResponseDto = z.infer<typeof BotMoveResponseDtoSchema>;

export const TrustedInvocationDtoSchema = z.object({
  matchId: z.string().uuid(),
  stateVersion: z.number().int().nonnegative(),
  invocationId: z.string().uuid(),
  turnToken: z.string().min(1),
  activeRevision: z.string().min(1),
  budgets: z.object({
    computeMs: z.number().int().positive(),
    memoryMb: z.number().int().positive(),
  }),
});
export type TrustedInvocationDto = z.infer<typeof TrustedInvocationDtoSchema>;

export const TrustedResultDtoSchema = z.object({
  invocationId: z.string().uuid(),
  move: z.object({
    from: MatchCoordinateSchema,
    to: MatchCoordinateSchema,
  }),
  memory: z.unknown(),
  computeMs: z.number().int().nonnegative(),
});
export type TrustedResultDto = z.infer<typeof TrustedResultDtoSchema>;
