import { z } from "zod";
import { RosterRowSchema } from "./d03.dto.js";

/**
 * D04-A — Roster Import Commit & Idempotency Boundary Contracts
 * Authoritative BA/SA Section 7.5 (I5 — Roster, import và account reuse)
 */

export const RosterCommitRowSchema = RosterRowSchema.extend({
  seedRating: z.number().int().optional(),
});

export type RosterCommitRow = z.infer<typeof RosterCommitRowSchema>;

export const RosterCommitRequestSchema = z
  .object({
    tournamentId: z.string().min(1, "tournamentId is required"),
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    fileName: z.string().trim().optional(),
    fileContent: z.string().optional(),
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
  })
  .refine(
    (data) => (data.rows && data.rows.length > 0) || (Boolean(data.fileContent) && Boolean(data.fileName)),
    {
      message: "Yêu cầu phải có danh sách dòng (rows) hoặc tệp dữ liệu (fileContent và fileName).",
    },
  );

export type RosterCommitRequest = z.infer<typeof RosterCommitRequestSchema>;

export const RosterCommitRowOutcomeSchema = z.object({
  rowNumber: z.number().int().positive(),
  person_key: z.string(),
  username: z.string(),
  displayName: z.string(),
  unitCode: z.string(),
  status: z.enum(["IMPORTED", "LINKED_EXISTING", "REJECTED"]),
  enrollmentId: z.string().optional(),
  userId: z.string().optional(),
  message: z.string().optional(),
});

export type RosterCommitRowOutcome = z.infer<typeof RosterCommitRowOutcomeSchema>;

export const RosterCommitResponseSchema = z.object({
  success: z.boolean(),
  tournamentId: z.string(),
  totalRows: z.number().int().nonnegative(),
  importedCount: z.number().int().nonnegative(),
  idempotencyKey: z.string().optional(),
  committedAt: z.string(),
  outcomes: z.array(RosterCommitRowOutcomeSchema),
});

export type RosterCommitResponse = z.infer<typeof RosterCommitResponseSchema>;
