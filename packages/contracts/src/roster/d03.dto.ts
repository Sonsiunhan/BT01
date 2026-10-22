import { z } from "zod";

/**
 * D03 — Roster CSV/XLSX Preview Contracts
 * Authoritative BA/SA Section 7.5 (I5 — Roster, import và account reuse)
 */

export const RosterRowSchema = z.object({
  unit_code: z.string().trim().min(1, "unit_code is required"),
  student_or_member_id: z.string().trim().min(1, "student_or_member_id is required"),
  full_name: z.string().trim().min(1, "full_name is required"),
  username: z.string().trim().min(1, "username is required"),
  email: z.string().trim().email("email is invalid").optional().or(z.literal("")),
});

export type RosterRow = z.infer<typeof RosterRowSchema>;

export const RosterPreviewRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  data: z.record(z.string(), z.unknown()),
  person_key: z.string().optional(),
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type RosterPreviewRow = z.infer<typeof RosterPreviewRowSchema>;

export const RosterPreviewRequestSchema = z.object({
  fileName: z.string().trim().min(1, "fileName is required"),
  fileContent: z.string().min(1, "fileContent is required"),
  allowedUnits: z.array(z.string().trim()).optional(),
  maxRows: z.number().int().positive().optional(),
});

export type RosterPreviewRequest = z.infer<typeof RosterPreviewRequestSchema>;

export const RosterPreviewResponseSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  errorRows: z.number().int().nonnegative(),
  warningRows: z.number().int().nonnegative(),
  batchCapacity: z.number().int().positive(),
  fileName: z.string().optional(),
  fileType: z.enum(["CSV", "XLSX"]).optional(),
  rows: z.array(RosterPreviewRowSchema),
});

export type RosterPreviewResponse = z.infer<typeof RosterPreviewResponseSchema>;
