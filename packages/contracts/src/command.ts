import { z } from "zod";
import { ProtocolVersionV2Schema } from "./version.js";
import { MatchCoordinateSchema } from "./match.js";

export const CommandEnvelopeSchema = z.object({
  protocolVersion: ProtocolVersionV2Schema,
  commandId: z.string().uuid(),
  targetId: z.string().min(1).optional(),
  matchId: z.string().uuid().optional(),
  roomId: z.string().min(1).optional(),
  queueId: z.string().uuid().optional(),
  stateVersion: z.number().int().nonnegative().optional(),
  roomVersion: z.number().int().nonnegative().optional(),
  queueVersion: z.number().int().nonnegative().optional(),
  payload: z.unknown(),
});
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;

export const MatchMoveCommandPayloadSchema = z
  .object({
    from: MatchCoordinateSchema,
    to: MatchCoordinateSchema,
  })
  .strict();
export type MatchMoveCommandPayload = z.infer<typeof MatchMoveCommandPayloadSchema>;

export const MatchMoveCommandSchema = z.object({
  protocolVersion: ProtocolVersionV2Schema,
  commandId: z.string().uuid(),
  matchId: z.string().uuid(),
  stateVersion: z.number().int().nonnegative(),
  payload: MatchMoveCommandPayloadSchema,
});
export type MatchMoveCommand = z.infer<typeof MatchMoveCommandSchema>;

export const AckOutcomeSchema = z.enum(["COMMITTED", "CONFLICT", "UNKNOWN"]);
export type AckOutcome = z.infer<typeof AckOutcomeSchema>;

export const AckEnvelopeSchema = z.object({
  protocolVersion: ProtocolVersionV2Schema,
  commandId: z.string().uuid(),
  outcome: AckOutcomeSchema,
  targetId: z.string().min(1),
  stateVersion: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
  data: z.unknown().default({}),
});
export type AckEnvelope = z.infer<typeof AckEnvelopeSchema>;
