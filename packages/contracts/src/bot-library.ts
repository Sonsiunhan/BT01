import { z } from "zod";

export const BotRevisionStatusSchema = z.enum(["READY", "INVALID", "TESTING", "PASSED", "FAILED"]);
export const BotMemoryPolicySchema = z.enum(["RESET_ON_NEW_REVISION", "PRESERVE_IF_COMPATIBLE"]);
export const BotAvailabilitySchema = z.enum(["ONLINE", "OFFLINE"]);

export const BotRevisionSchema = z.object({
  id: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  status: BotRevisionStatusSchema,
  sdkVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  sourceBytes: z.number().int().nonnegative(),
  validationCode: z.string().nullable().optional(),
  validationMessage: z.string().nullable().optional(),
  preflightMs: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  memoryPolicy: BotMemoryPolicySchema,
  availability: z.array(BotAvailabilitySchema).min(1),
  activeForMatchId: z.string().nullable().optional(),
  pendingForMatchId: z.string().nullable().optional(),
  sourceExpiresAt: z.string().datetime().nullable().optional(),
});
export type BotRevision = z.infer<typeof BotRevisionSchema>;

export const BotLibraryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  usedBytes: z.number().int().nonnegative(),
  revisions: z.array(BotRevisionSchema),
});
export type BotLibraryItem = z.infer<typeof BotLibraryItemSchema>;

export const BotLibraryListResponseSchema = z.object({
  bots: z.array(BotLibraryItemSchema),
  quotaBytes: z.number().int().positive(),
  usedBytes: z.number().int().nonnegative(),
});
export type BotLibraryListResponse = z.infer<typeof BotLibraryListResponseSchema>;

export const BotLibraryCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  source: z.string().min(1),
});
export type BotLibraryCreateRequest = z.infer<typeof BotLibraryCreateRequestSchema>;

export const BotRevisionCreateRequestSchema = z.object({ source: z.string().min(1) });
export type BotRevisionCreateRequest = z.infer<typeof BotRevisionCreateRequestSchema>;

export const BotSdkDocsResponseSchema = z.object({
  sdkVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  allowlist: z.array(z.string()),
  template: z.string(),
  limits: z.object({ sourceBytes: z.number().int().positive(), memoryBytes: z.number().int().positive(), perTurnMs: z.number().int().positive(), wholeMatchMs: z.number().int().positive() }),
});
export type BotSdkDocsResponse = z.infer<typeof BotSdkDocsResponseSchema>;

export const BotSourceResponseSchema = z.object({
  botId: z.string().min(1),
  revisionId: z.string().min(1),
  source: z.string(),
});
export type BotSourceResponse = z.infer<typeof BotSourceResponseSchema>;

export const BotRevisionTestResponseSchema = z.object({
  revision: BotRevisionSchema,
  legalPreview: z.array(z.string()),
  privateLog: z.array(z.string()),
});
export type BotRevisionTestResponse = z.infer<typeof BotRevisionTestResponseSchema>;
