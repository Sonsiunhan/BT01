import { z } from "zod";

// DTO definitions for D02 – Bootstrap / TA (Tournament Admin) Account & Management

export const BootstrapTaRequestSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .optional()
  .default({});

export type BootstrapTaRequest = z.infer<typeof BootstrapTaRequestSchema>;

export const BootstrapTaResponseSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    fullName: z.string(),
    displayName: z.string(),
    username: z.string(),
    theme: z.enum(["light", "dark", "system"]),
    avatarPreset: z.string(),
    privacy: z.object({
      presenceVisibility: z.string(),
      friendListVisibility: z.literal("PRIVATE"),
      fullNameVisibility: z.literal("PRIVATE"),
    }),
    stats: z.object({
      elo: z.number(),
      rankedWins: z.number(),
      rankedLosses: z.number(),
      quickWins: z.number(),
      quickLosses: z.number(),
    }),
    botStats: z.object({
      wins: z.number(),
      losses: z.number(),
    }),
  }),
});

export type BootstrapTaResponse = z.infer<typeof BootstrapTaResponseSchema>;

export const CreateTaAccountRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(100),
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(32).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores and hyphens"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
});

export type CreateTaAccountRequest = z.infer<typeof CreateTaAccountRequestSchema>;

export const TaAccountSummarySchema = z.object({
  id: z.string().min(1),
  fullName: z.string(),
  displayName: z.string(),
  username: z.string(),
  role: z.literal("TOURNAMENT_ADMIN"),
  createdAt: z.string().datetime().or(z.date()),
});

export type TaAccountSummary = z.infer<typeof TaAccountSummarySchema>;

export const BindTaContractRequestSchema = z.object({
  contractId: z.string().min(1, "contractId is required"),
  notes: z.string().max(500).optional(),
});

export type BindTaContractRequest = z.infer<typeof BindTaContractRequestSchema>;

export const BindTaContractResponseSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  userId: z.string(),
  status: z.enum(["ACTIVE", "REVOKED"]),
  grantedAt: z.string().datetime().or(z.date()),
});

export type BindTaContractResponse = z.infer<typeof BindTaContractResponseSchema>;

export const RevokeTaResponseSchema = z.object({
  success: z.boolean(),
  userId: z.string(),
  message: z.string(),
});

export type RevokeTaResponse = z.infer<typeof RevokeTaResponseSchema>;
