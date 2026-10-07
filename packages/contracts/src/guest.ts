import { z } from "zod";

export const GuestMatchRecordSchema = z.object({
  localId: z.string().uuid(),
  mode: z.literal("GUEST"),
  result: z.enum(["WIN", "LOSS", "DRAW"]),
  playerName: z.string().trim().min(2).max(20),
  opponentName: z.string().trim().min(2).max(20),
  timerSeconds: z.number().int().positive().max(3600),
  durationSeconds: z.number().int().nonnegative().max(86400),
  endedAt: z.string().datetime(),
  scoreDelta: z.number().int().min(-100).max(100),
});

export const GuestHistoryImportRequestSchema = z.object({
  records: z.array(GuestMatchRecordSchema).max(100),
});

export const GuestHistoryImportResponseSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});

export const GuestSessionRequestSchema = z.object({
  clientId: z.string().trim().min(8).max(120),
  displayName: z.string().trim().min(2).max(20),
});

export const GuestSessionResponseSchema = z.object({
  principal: z.enum(["GUEST", "ACCOUNT"]),
  displayName: z.string().trim().min(2).max(20),
});

export type GuestMatchRecord = z.infer<typeof GuestMatchRecordSchema>;
export type GuestHistoryImportRequest = z.infer<typeof GuestHistoryImportRequestSchema>;
export type GuestHistoryImportResponse = z.infer<typeof GuestHistoryImportResponseSchema>;
export type GuestSessionRequest = z.infer<typeof GuestSessionRequestSchema>;
export type GuestSessionResponse = z.infer<typeof GuestSessionResponseSchema>;

// Device-supplied archive, never a canonical ranked match or rating input.
export const GuestBotMatchRecordSchema = GuestMatchRecordSchema.extend({
  localId: z.string().regex(/^guest-bot-online:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(BLUE|RED)$/i),
  mode: z.literal("BOT_ONLINE"),
  scoreDelta: z.literal(0),
}).strict();
export const GuestBotHistoryImportRequestSchema = z.object({ records: z.array(GuestBotMatchRecordSchema).min(1).max(100) }).strict();
export const GuestBotHistoryArchiveSchema = z.object({ records: z.array(GuestBotMatchRecordSchema).max(100) });
export type GuestBotMatchRecord = z.infer<typeof GuestBotMatchRecordSchema>;
export type GuestBotHistoryArchive = z.infer<typeof GuestBotHistoryArchiveSchema>;
