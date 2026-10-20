import { z } from "zod";
import { ProtocolVersionV2Schema } from "./version.js";

export const EventScopeSchema = z.enum(["MATCH", "ROOM", "QUEUE"]);
export type EventScope = z.infer<typeof EventScopeSchema>;

export const DomainEventEnvelopeSchema = z.object({
  protocolVersion: ProtocolVersionV2Schema,
  messageId: z.string().uuid(),
  type: z.string().min(1),
  timestamp: z.number().int().positive(),
  scope: EventScopeSchema,
  targetId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  stateVersion: z.number().int().nonnegative(),
  payload: z.unknown(),
});
export type DomainEventEnvelope = z.infer<typeof DomainEventEnvelopeSchema>;

export function formatEventCursor(
  scope: string,
  targetGeneration: string,
  sequence: number
): string {
  return `${scope}:${targetGeneration}:${sequence}`;
}

export function parseEventCursor(
  cursor: string
): { scope: string; targetGeneration: string; sequence: number } | null {
  if (typeof cursor !== "string") {
    return null;
  }
  const parts = cursor.split(":");
  if (parts.length !== 3) {
    return null;
  }
  const [scope, targetGeneration, seqStr] = parts;
  if (!scope || !targetGeneration || !seqStr) {
    return null;
  }
  const sequence = Number(seqStr);
  if (!Number.isInteger(sequence) || sequence < 0) {
    return null;
  }
  return {
    scope,
    targetGeneration,
    sequence,
  };
}
