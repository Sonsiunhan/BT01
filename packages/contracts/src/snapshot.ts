import { z } from "zod";
import {
  MatchBoardSchema,
  MatchModeSchema,
  MatchPauseCategorySchema,
  MatchPauseReasonSchema,
  MatchPlayerSchema,
  MatchReplacementStatusSchema,
  MatchResultReasonSchema,
  MatchSideSchema,
  MatchStatusSchema,
} from "./match.js";
import { RoomRoleSchema } from "./mode.js";

const CompactMatchSnapshotBase = z.object({
  matchId: z.string().uuid(),
  roomId: z.string().min(1),
  mode: MatchModeSchema,
  status: MatchStatusSchema,
  players: z.array(MatchPlayerSchema),
  board: MatchBoardSchema,
  pieceCounts: z.object({
    BLUE: z.object({ R: z.number().int(), P: z.number().int(), S: z.number().int() }),
    RED: z.object({ R: z.number().int(), P: z.number().int(), S: z.number().int() }),
  }),
  currentTurn: MatchSideSchema.nullable(),
  winner: MatchSideSchema.nullable(),
  resultReason: MatchResultReasonSchema,
  clocksMs: z.object({
    BLUE: z.number().int().nonnegative(),
    RED: z.number().int().nonnegative(),
  }),
  runningSide: MatchSideSchema.nullable(),
  serverTime: z.number().int().positive(),
  sequence: z.number().int().nonnegative(),
  stateVersion: z.number().int().nonnegative(),
  countdownEndsAt: z.number().int().positive().nullable().optional(),
  startedAt: z.number().int().positive().nullable().optional(),
  endedAt: z.number().int().positive().nullable().optional(),
  pauseReason: MatchPauseReasonSchema.nullable().optional(),
  pauseCategory: MatchPauseCategorySchema.nullable().optional(),
  pausedAt: z.number().int().positive().nullable().optional(),
  pausePhase: z.enum(["COUNTDOWN", "PLAYING"]).nullable().optional(),
  pauseElapsedMs: z.number().int().nonnegative().optional(),
  resumeEndsAt: z.number().int().positive().nullable().optional(),
  replacementStatus: MatchReplacementStatusSchema.optional(),
});

export const CompactMatchSnapshotSchema = CompactMatchSnapshotBase.strict();
export type CompactMatchSnapshot = z.infer<typeof CompactMatchSnapshotSchema>;

export const WatermarkSchema = z.object({
  lastCommittedSequence: z.number().int().nonnegative(),
  lastCommittedStateVersion: z.number().int().nonnegative(),
  timestamp: z.number().int().positive(),
});
export type Watermark = z.infer<typeof WatermarkSchema>;

export const SetupDescriptorSchema = z.object({
  rulesVersion: z.string().min(1),
  seed: z.number().int().nonnegative(),
});
export type SetupDescriptor = z.infer<typeof SetupDescriptorSchema>;

export const FullSyncSnapshotSchema = CompactMatchSnapshotBase.extend({
  setupDescriptor: SetupDescriptorSchema,
  watermark: WatermarkSchema,
});
export type FullSyncSnapshot = z.infer<typeof FullSyncSnapshotSchema>;

export const ClockPulseSchema = z
  .object({
    matchId: z.string().uuid(),
    stateVersion: z.number().int().nonnegative(),
    referenceSequence: z.number().int().nonnegative(),
    serverTime: z.number().int().positive(),
    clocksMs: z.object({
      BLUE: z.number().int().nonnegative(),
      RED: z.number().int().nonnegative(),
    }),
    runningSide: MatchSideSchema.nullable(),
    pauseElapsedMs: z.number().int().nonnegative().optional(),
    pulseSequence: z.number().int().positive(),
  })
  .strict();
export type ClockPulse = z.infer<typeof ClockPulseSchema>;

export const ViewerContextSchema = z.object({
  role: RoomRoleSchema,
  viewerSide: MatchSideSchema.nullable(),
  isHost: z.boolean(),
  allowedActions: z.array(z.string()),
});
export type ViewerContext = z.infer<typeof ViewerContextSchema>;
