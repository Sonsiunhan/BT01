import { z } from "zod";
import { ComparatorSideMetricsSchema } from "./tournament-rule-versioning.js";

// ============================================================================
// 1. Canonical Actors, Roles & Candidate Policy Defaults (Section 2 & 15)
// ============================================================================

export const TournamentRoleSchema = z.enum([
  "ADMIN",
  "TOURNAMENT_ADMIN",
  "REFEREE",
  "STAFF",
  "PLAYER",
  "GUEST",
]);
export type TournamentRole = z.infer<typeof TournamentRoleSchema>;

/**
 * Candidate policy defaults per BA+SA v1.0 Section 15 & Delivery Plan Section 8.
 * Tagged with g0ApprovalStatus: "G0_PENDING_CONFIRMATION" until Gate G0 is signed off.
 */
export const CANDIDATE_POLICY_DEFAULTS_V1 = {
  g0ApprovalStatus: "G0_PENDING_CONFIRMATION" as const,
  scoringFormulaPreset: "ELO_WEIGHTED_V1" as const,
  initialScore: 1000,
  initialElo: 1000,
  kFactor: 32,
  scoreFloor: 0,
  tieBreakOrder: [
    "TOURNAMENT_SCORE",
    "TOURNAMENT_ELO",
    "WINS",
    "FEWER_LOSSES",
    "EARLIER_LAST_FINISHED_AT",
    "PERSON_KEY_ASC",
  ] as const,
  manualAdjudicationDeadlineSeconds: 300,
  manualAdjudicationFallbackPolicy: "RANDOM_SEEDED" as const,
  rosterImportMaxRows: 2000,
  rosterImportMaxBytes: 2 * 1024 * 1024,
  invitationTtlHours: 72,
  claimTokenTtlHours: 168,
  defaultContractTechnicalCaps: {
    botSourceMaxBytes: 65536,
    botRuntimeTimeoutMs: 1000,
    botMemoryLimitMb: 64,
    maxConcurrentMatchesPerTournament: 16,
    rosterImportMaxRows: 2000,
  },
} as const;

// ============================================================================
// 2. Unit & Tenant Contracts (P06: F01..F06)
// ============================================================================

export const UnitTypeSchema = z.enum(["KHOA", "VIEN", "CLB", "DOAN_HOI", "DOI_TAC", "KHAC"]);
export type UnitType = z.infer<typeof UnitTypeSchema>;

export const UnitStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);
export type UnitStatus = z.infer<typeof UnitStatusSchema>;

export const UnitCodeSchema = z
  .string()
  .trim()
  .min(2, "Mã đơn vị phải có từ 2 đến 32 ký tự.")
  .max(32, "Mã đơn vị không vượt quá 32 ký tự.")
  .regex(/^[A-Z0-9_-]+$/, "Mã đơn vị chỉ gồm chữ in hoa A-Z, chữ số 0-9, gạch ngang (-) hoặc gạch dưới (_).");

export const UnitSchema = z.object({
  id: z.string().min(1),
  unitCode: UnitCodeSchema, // F01
  unitName: z.string().trim().min(2).max(120), // F02
  unitType: UnitTypeSchema, // F03
  contactName: z.string().trim().min(2).max(80), // F04
  contactEmail: z.string().trim().email().max(120), // F05
  status: UnitStatusSchema, // F06
  referencedContractsCount: z.number().int().nonnegative().default(0),
  referencedTournamentsCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UnitDto = z.infer<typeof UnitSchema>;

export const CreateUnitInputSchema = z.object({
  unitCode: UnitCodeSchema,
  unitName: z.string().trim().min(2, "Tên đơn vị phải có ít nhất 2 ký tự.").max(120),
  unitType: UnitTypeSchema,
  contactName: z.string().trim().min(2, "Tên người liên hệ phải có ít nhất 2 ký tự.").max(80),
  contactEmail: z.string().trim().email("Email liên hệ không hợp lệ.").max(120),
  status: UnitStatusSchema.default("ACTIVE"),
});
export type CreateUnitInput = z.infer<typeof CreateUnitInputSchema>;

export const UpdateUnitInputSchema = z.object({
  unitName: z.string().trim().min(2).max(120).optional(),
  unitType: UnitTypeSchema.optional(),
  contactName: z.string().trim().min(2).max(80).optional(),
  contactEmail: z.string().trim().email().max(120).optional(),
  status: UnitStatusSchema.optional(),
});
export type UpdateUnitInput = z.infer<typeof UpdateUnitInputSchema>;

// ============================================================================
// 3. Tournament Contract, Policy Envelope, Technical Caps & TA Bindings (P07: F07..F16)
// ============================================================================

export const ContractStatusSchema = z.enum(["DRAFT", "ACTIVE", "EXPIRED", "REVOKED"]);
export type ContractStatus = z.infer<typeof ContractStatusSchema>;

export const AllowedModeSchema = z.enum(["HUMAN_ONLINE", "BOT_VS_BOT"]);
export type AllowedMode = z.infer<typeof AllowedModeSchema>;

export const TieBreakPolicySchema = z.enum([
  "RANDOM_SEEDED",
  "BLUE_ADVANTAGE",
  "RED_ADVANTAGE",
  "REPLAY_ONCE_THEN_SEEDED",
  "MANUAL_REFEREE",
]);
export type TieBreakPolicy = z.infer<typeof TieBreakPolicySchema>;

export const ContractPolicyEnvelopeSchema = z
  .object({
    allowedModes: z.array(AllowedModeSchema).min(1),
    turnSecondsMin: z.number().int().min(5).max(600),
    turnSecondsMax: z.number().int().min(5).max(600),
    totalMatchSecondsMin: z.number().int().min(30).max(7200),
    totalMatchSecondsMax: z.number().int().min(30).max(7200),
    turnLimitMin: z.number().int().min(10).max(1000),
    turnLimitMax: z.number().int().min(10).max(1000),
    allowedNoProgressPlies: z.array(z.number().int().min(10).max(400)).min(1),
    allowedRepetitionThresholds: z.array(z.number().int().min(2).max(10)).min(1),
    allowedTieBreakPolicies: z.array(TieBreakPolicySchema).min(1),
  })
  .superRefine((val, ctx) => {
    if (val.turnSecondsMin > val.turnSecondsMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["turnSecondsMin"],
        message: "turnSecondsMin không được lớn hơn turnSecondsMax.",
      });
    }
    if (val.totalMatchSecondsMin > val.totalMatchSecondsMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalMatchSecondsMin"],
        message: "totalMatchSecondsMin không được lớn hơn totalMatchSecondsMax.",
      });
    }
    if (val.turnLimitMin > val.turnLimitMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["turnLimitMin"],
        message: "turnLimitMin không được lớn hơn turnLimitMax.",
      });
    }
  });
export type ContractPolicyEnvelope = z.infer<typeof ContractPolicyEnvelopeSchema>;

export const ContractTechnicalCapsSchema = z.object({
  botSourceMaxBytes: z.number().int().min(1024).max(65536).default(65536),
  botRuntimeTimeoutMs: z.number().int().min(100).max(5000).default(1000),
  botMemoryLimitMb: z.number().int().min(16).max(256).default(64),
  maxConcurrentMatchesPerTournament: z.number().int().min(1).max(64).default(16),
  rosterImportMaxRows: z.number().int().min(10).max(10000).default(2000),
});
export type ContractTechnicalCaps = z.infer<typeof ContractTechnicalCapsSchema>;

export const ContractTaBindingStatusSchema = z.enum(["ACTIVE", "REVOKED"]);
export type ContractTaBindingStatus = z.infer<typeof ContractTaBindingStatusSchema>;

export const ContractTaBindingSchema = z.object({
  id: z.string().min(1),
  contractId: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  status: ContractTaBindingStatusSchema,
  grantedByUserId: z.string().min(1),
  grantedAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable().default(null),
  revokeReason: z.string().nullable().default(null),
});
export type ContractTaBindingDto = z.infer<typeof ContractTaBindingSchema>;

export const ContractCodeSchema = z
  .string()
  .trim()
  .min(3, "Mã hợp đồng phải có từ 3 đến 40 ký tự.")
  .max(40, "Mã hợp đồng không vượt quá 40 ký tự.")
  .regex(/^[A-Z0-9_-]+$/, "Mã hợp đồng chỉ gồm chữ in hoa A-Z, chữ số 0-9, gạch ngang (-) hoặc gạch dưới (_).");

export const TournamentContractSchema = z.object({
  id: z.string().min(1),
  contractCode: ContractCodeSchema, // F07
  unitId: z.string().min(1), // F08
  unitCode: z.string().min(1).optional(),
  unitName: z.string().min(1).optional(),
  status: ContractStatusSchema, // F16
  validFrom: z.string().datetime(), // F09
  validTo: z.string().datetime(), // F10
  maxTournamentsTotal: z.number().int().min(1).max(1000), // F11
  quotaReservedCount: z.number().int().nonnegative().default(0),
  quotaConsumedCount: z.number().int().nonnegative().default(0),
  quotaRemainingCount: z.number().int().nonnegative().default(0),
  maxParticipantsPerTournament: z.number().int().min(2).max(2000), // F12
  maxParticipantsTotal: z.number().int().min(2).max(50000), // F13
  currentParticipantsTotal: z.number().int().nonnegative().default(0),
  allowedModes: z.array(AllowedModeSchema).min(1), // F14
  policyEnvelope: ContractPolicyEnvelopeSchema, // F15
  technicalCaps: ContractTechnicalCapsSchema, // F15
  taBindings: z.array(ContractTaBindingSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TournamentContractDto = z.infer<typeof TournamentContractSchema>;

export const CreateTournamentContractInputSchema = z
  .object({
    contractCode: ContractCodeSchema,
    unitId: z.string().min(1, "Vui lòng chọn đơn vị chủ quản."),
    validFrom: z.string().datetime(),
    validTo: z.string().datetime(),
    maxTournamentsTotal: z.number().int().min(1).max(1000),
    maxParticipantsPerTournament: z.number().int().min(2).max(2000),
    maxParticipantsTotal: z.number().int().min(2).max(50000),
    allowedModes: z.array(AllowedModeSchema).min(1),
    policyEnvelope: ContractPolicyEnvelopeSchema,
    technicalCaps: ContractTechnicalCapsSchema.default(
      CANDIDATE_POLICY_DEFAULTS_V1.defaultContractTechnicalCaps
    ),
    status: z.enum(["DRAFT", "ACTIVE"]).default("ACTIVE"),
    initialTaUserIds: z.array(z.string().min(1)).default([]),
  })
  .superRefine((val, ctx) => {
    if (Date.parse(val.validFrom) >= Date.parse(val.validTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validTo"],
        message: "Thời điểm hết hiệu lực (validTo) phải lớn hơn thời điểm bắt đầu (validFrom).",
      });
    }
    if (val.maxParticipantsPerTournament > val.maxParticipantsTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxParticipantsPerTournament"],
        message: "Số người tối đa mỗi giải không được vượt quá tổng người tối đa toàn hợp đồng.",
      });
    }
    for (const mode of val.allowedModes) {
      if (!val.policyEnvelope.allowedModes.includes(mode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allowedModes"],
          message: `Chế độ ${mode} phải nằm trong policyEnvelope.allowedModes.`,
        });
      }
    }
  });
export type CreateTournamentContractInput = z.infer<typeof CreateTournamentContractInputSchema>;

export const UpdateTournamentContractInputSchema = z.object({
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  maxTournamentsTotal: z.number().int().min(1).max(1000).optional(),
  maxParticipantsPerTournament: z.number().int().min(2).max(2000).optional(),
  maxParticipantsTotal: z.number().int().min(2).max(50000).optional(),
  allowedModes: z.array(AllowedModeSchema).min(1).optional(),
  policyEnvelope: ContractPolicyEnvelopeSchema.optional(),
  technicalCaps: ContractTechnicalCapsSchema.optional(),
  status: ContractStatusSchema.optional(),
  statusReason: z.string().trim().min(2).max(500).optional(),
});
export type UpdateTournamentContractInput = z.infer<typeof UpdateTournamentContractInputSchema>;

export const GrantContractTaInputSchema = z.object({
  userId: z.string().min(1, "Vui lòng nhập userId của Quản trị giải (TA)."),
  username: z.string().trim().optional(),
  displayName: z.string().trim().optional(),
});
export type GrantContractTaInput = z.infer<typeof GrantContractTaInputSchema>;

export const RevokeContractTaInputSchema = z.object({
  reason: z.string().trim().min(3, "Vui lòng nhập lý do thu hồi quyền TA.").max(500),
});
export type RevokeContractTaInput = z.infer<typeof RevokeContractTaInputSchema>;

// ============================================================================
// 4. Tournament Lifecycle, Core Config & Conditional Field Normalization (P02, P03: F17..F45, F60..F66)
// ============================================================================

export const TournamentStatusSchema = z.enum([
  "DRAFT",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
  "REJECTED",
  "APPROVED",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "ENDED",
  "CANCELLED",
  "ARCHIVED",
]);
export type TournamentStatus = z.infer<typeof TournamentStatusSchema>;

export const AudienceScopeSchema = z.enum([
  "INTERNAL_UNIT",
  "INVITED_LIST",
  "PUBLIC_REGISTERED",
]);
export type AudienceScope = z.infer<typeof AudienceScopeSchema>;

export const RegistrationIntakeModeSchema = z.enum(["IMPORT_ONLY", "INVITE_ONLY"]);
export type RegistrationIntakeMode = z.infer<typeof RegistrationIntakeModeSchema>;

export const SpectatorPolicySchema = z.enum(["PUBLIC_WATCH", "ROSTER_ONLY", "STAFF_ONLY", "DISABLED"]);
export type SpectatorPolicy = z.infer<typeof SpectatorPolicySchema>;

export const ChatPolicySchema = z.enum(["ENABLED", "SPECTATOR_MUTED", "DISABLED"]);
export type ChatPolicy = z.infer<typeof ChatPolicySchema>;

export const LeaderboardVisibilitySchema = z.enum(["LIVE_PUBLIC", "ROSTER_ONLY", "HIDDEN_UNTIL_END"]);
export type LeaderboardVisibility = z.infer<typeof LeaderboardVisibilitySchema>;

export const FinalizationModeSchema = z.enum(["AUTO_FINAL", "TA_CONFIRMATION"]);
export type FinalizationMode = z.infer<typeof FinalizationModeSchema>;

export const PairingMethodSchema = z.enum([
  "SWISS_SCORE_ADJACENT",
  "RANDOM_ELIGIBLE",
  "SEEDED_BRACKET",
  "ROUND_ROBIN",
]);
export type PairingMethod = z.infer<typeof PairingMethodSchema>;

export const TournamentFormatSchema = z.enum([
  "ARENA_CONTINUOUS",
  "SWISS_ROUNDS",
  "SINGLE_ELIMINATION",
  "ROUND_ROBIN",
]);
export type TournamentFormat = z.infer<typeof TournamentFormatSchema>;

export const TournamentCoreConfigSchema = z.object({
  // Section A: Identity & Scope (F17..F25)
  tournamentCode: z
    .string()
    .trim()
    .min(3, "Mã giải phải có từ 3 đến 40 ký tự.")
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, "Mã giải chỉ gồm A-Z, 0-9, -, _."), // F17
  tournamentName: z.string().trim().min(3, "Tên giải phải có ít nhất 3 ký tự.").max(160), // F18
  shortDescription: z.string().trim().max(1000).default(""), // F19
  organizersText: z.string().trim().min(2).max(240), // F20
  competitionMode: AllowedModeSchema, // F21
  audienceScope: AudienceScopeSchema, // F22
  allowedUnitCodes: z.array(z.string().min(1)).default([]), // F23 (Conditional on INTERNAL_UNIT)
  registrationIntakeMode: RegistrationIntakeModeSchema.default("IMPORT_ONLY"), // F24
  maxParticipants: z.number().int().min(2).max(2000), // F25
  minParticipantsToStart: z.number().int().min(2).max(2000).default(2), // F26

  // Section B: Schedule & Time Windows (F27..F33)
  timezone: z.string().trim().min(2).max(64).default("Asia/Ho_Chi_Minh"), // F27
  registrationOpenAt: z.string().datetime().nullable().default(null), // F28
  registrationCloseAt: z.string().datetime().nullable().default(null), // F29
  checkinRequired: z.boolean().default(false), // F30
  checkinOpenAt: z.string().datetime().nullable().default(null), // F31 (Conditional on checkinRequired=true)
  checkinCloseAt: z.string().datetime().nullable().default(null), // F32 (Conditional on checkinRequired=true)
  scheduledStartAt: z.string().datetime(), // F33
  scheduledEndAt: z.string().datetime(), // F34

  // Section C: Format, Pairing & Competition Limits (F35..F41)
  format: TournamentFormatSchema.default("ARENA_CONTINUOUS"), // F35
  pairingMethod: PairingMethodSchema.default("SWISS_SCORE_ADJACENT"), // F36
  maxMatchesPerPlayer: z.number().int().min(1).max(200).nullable().default(null), // F37
  maxPairMeetings: z.number().int().min(1).max(20).default(2), // F38
  rematchCooldownMinutes: z.number().int().min(0).max(1440).default(5), // F39
  maxConcurrentMatches: z.number().int().min(1).max(64).default(8), // F40
  byeScorePoints: z.number().min(0).max(100).default(0), // F41

  // Section D: Room, Spectator, Leaderboard & Finalization (F42..F45, F60..F66)
  spectatorPolicy: SpectatorPolicySchema.default("ROSTER_ONLY"), // F42
  chatPolicy: ChatPolicySchema.default("SPECTATOR_MUTED"), // F43
  leaderboardVisibility: LeaderboardVisibilitySchema.default("LIVE_PUBLIC"), // F44
  topNExportCount: z.number().int().min(1).max(500).default(10), // F45
  finalizationMode: FinalizationModeSchema.default("AUTO_FINAL"), // F60
  scoringFormulaPreset: z.literal("ELO_WEIGHTED_V1").default("ELO_WEIGHTED_V1"), // F61
  initialScore: z.number().int().min(0).max(5000).default(1000), // F62
  initialElo: z.number().int().min(100).max(5000).default(1000), // F63
  kFactor: z.number().int().min(8).max(64).default(32), // F64
  scoreFloor: z.number().int().min(0).max(1000).default(0), // F65
  botDeadlineAt: z.string().datetime().nullable().default(null), // F66 (Conditional on BOT_VS_BOT)
  refereeRequired: z.boolean().optional(),
  minReadyOnlineReferees: z.number().int().min(1).max(20).optional(),
});
export type TournamentCoreConfig = z.infer<typeof TournamentCoreConfigSchema>;

/**
 * T071: Server-side normalization of conditional fields when parent toggles change.
 * - If audienceScope !== "INTERNAL_UNIT", clears allowedUnitCodes to [].
 * - If checkinRequired === false, clears checkinOpenAt and checkinCloseAt to null.
 * - If competitionMode === "HUMAN_ONLINE", clears botDeadlineAt to null.
 */
export function normalizeTournamentCoreConfig(
  config: TournamentCoreConfig
): TournamentCoreConfig {
  return {
    ...config,
    allowedUnitCodes:
      config.audienceScope === "INTERNAL_UNIT" ? [...new Set(config.allowedUnitCodes)] : [],
    checkinOpenAt: config.checkinRequired ? config.checkinOpenAt : null,
    checkinCloseAt: config.checkinRequired ? config.checkinCloseAt : null,
    botDeadlineAt:
      config.competitionMode === "HUMAN_ONLINE" ? null : config.botDeadlineAt,
  };
}

/**
 * Validates schedule relationships and conditional fields for a normalized TournamentCoreConfig.
 */
export function validateTournamentCoreConfigSemantics(
  config: TournamentCoreConfig,
  options?: { requireFutureStartAt?: boolean; serverNowIso?: string }
): Array<{ field: string; message: string }> {
  const issues: Array<{ field: string; message: string }> = [];
  const startMs = Date.parse(config.scheduledStartAt);
  const endMs = Date.parse(config.scheduledEndAt);

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
    issues.push({
      field: "scheduledEndAt",
      message: "Thời gian kết thúc giải (scheduledEndAt) phải sau thời gian bắt đầu (scheduledStartAt).",
    });
  }

  if (options?.requireFutureStartAt) {
    const nowMs = options.serverNowIso ? Date.parse(options.serverNowIso) : Date.now();
    if (startMs <= nowMs) {
      issues.push({
        field: "scheduledStartAt",
        message: "Lịch bắt đầu giải (scheduledStartAt) đã qua so với thời gian hiện tại của máy chủ.",
      });
    }
  }

  if (config.minParticipantsToStart > config.maxParticipants) {
    issues.push({
      field: "minParticipantsToStart",
      message: "Số người tối thiểu để mở giải không được lớn hơn số người tối đa.",
    });
  }

  if (config.audienceScope === "INTERNAL_UNIT" && config.allowedUnitCodes.length === 0) {
    issues.push({
      field: "allowedUnitCodes",
      message: "Phạm vi INTERNAL_UNIT yêu cầu chọn ít nhất 1 mã đơn vị hợp lệ.",
    });
  }

  if (config.checkinRequired) {
    if (!config.checkinOpenAt || !config.checkinCloseAt) {
      issues.push({
        field: "checkinOpenAt",
        message: "Bắt buộc nhập thời gian mở và đóng check-in khi bật checkinRequired.",
      });
    } else {
      const ciOpen = Date.parse(config.checkinOpenAt);
      const ciClose = Date.parse(config.checkinCloseAt);
      if (ciOpen >= ciClose || ciClose > startMs) {
        issues.push({
          field: "checkinCloseAt",
          message: "Thời gian đóng check-in phải sau giờ mở check-in và không trễ hơn giờ bắt đầu giải.",
        });
      }
    }
  }

  if (
    (config.competitionMode === "BOT_VS_BOT") &&
    config.botDeadlineAt
  ) {
    const botDeadlineMs = Date.parse(config.botDeadlineAt);
    if (botDeadlineMs > startMs) {
      issues.push({
        field: "botDeadlineAt",
        message: "Hạn chót nộp Bot (botDeadlineAt) không được trễ hơn giờ bắt đầu giải.",
      });
    }
  }

  return issues;
}

// ============================================================================
// 5. RuleProfile & ConfigVersioning (P04: F46..F59)
// ============================================================================

export const SetupParityModeSchema = z.enum([
  "STANDARD_CANONICAL",
  "SEEDED_SYMMETRIC",
  "MIRRORED_SWAP",
]);
export type SetupParityMode = z.infer<typeof SetupParityModeSchema>;

export const TimeoutResultPolicySchema = z.enum([
  "LOSS_FOR_TIMED_OUT_SIDE",
  "ADJUDICATE_MATERIAL_THEN_TIE_BREAK",
]);
export type TimeoutResultPolicy = z.infer<typeof TimeoutResultPolicySchema>;

export const DisconnectGracePolicySchema = z.enum([
  "FORFEIT_AFTER_GRACE",
  "PAUSE_AND_NOTIFY_REFEREE",
]);
export type DisconnectGracePolicy = z.infer<typeof DisconnectGracePolicySchema>;

export const TournamentRuleProfileSchema = z.object({
  // F46..F59
  rulesVersion: z.string().trim().min(1).default("rps-v1"), // F46
  setupParityMode: SetupParityModeSchema.default("STANDARD_CANONICAL"), // F47
  turnSeconds: z.number().int().min(5).max(600).default(30), // F48
  totalMatchSeconds: z.number().int().min(30).max(7200).default(600), // F49
  turnLimit: z.number().int().min(10).max(1000).default(120), // F50
  noProgressPlies: z.number().int().min(10).max(400).default(60), // F51
  repetitionThreshold: z.number().int().min(2).max(10).default(3), // F52
  timeoutResultPolicy: TimeoutResultPolicySchema.default("LOSS_FOR_TIMED_OUT_SIDE"), // F53
  disconnectGraceSeconds: z.number().int().min(0).max(300).default(30), // F54
  disconnectGracePolicy: DisconnectGracePolicySchema.default("FORFEIT_AFTER_GRACE"), // F55
  tieBreakPolicy: TieBreakPolicySchema.default("RANDOM_SEEDED"), // F56
  manualAdjudicationDeadlineSeconds: z
    .number()
    .int()
    .min(30)
    .max(3600)
    .default(CANDIDATE_POLICY_DEFAULTS_V1.manualAdjudicationDeadlineSeconds), // F57
  manualAdjudicationFallbackPolicy: z
    .enum(["RANDOM_SEEDED", "BLUE_ADVANTAGE", "RED_ADVANTAGE", "REPLAY_ONCE_THEN_SEEDED"])
    .default(CANDIDATE_POLICY_DEFAULTS_V1.manualAdjudicationFallbackPolicy), // F58
  allowSpectatorDelaySeconds: z.number().int().min(0).max(300).default(0), // F59
});
export type TournamentRuleProfile = z.infer<typeof TournamentRuleProfileSchema>;

/**
 * Checks whether a RuleProfile is strictly within a ContractPolicyEnvelope (BR-09, BR-10, T017, T061).
 */
export function evaluateRuleProfileEnvelope(
  ruleProfile: TournamentRuleProfile,
  envelope: ContractPolicyEnvelope
): { withinEnvelope: boolean; violations: Array<{ field: string; message: string }> } {
  const violations: Array<{ field: string; message: string }> = [];

  if (
    ruleProfile.turnSeconds < envelope.turnSecondsMin ||
    ruleProfile.turnSeconds > envelope.turnSecondsMax
  ) {
    violations.push({
      field: "turnSeconds",
      message: `Thời gian mỗi lượt (${ruleProfile.turnSeconds}s) nằm ngoài trần hợp đồng [${envelope.turnSecondsMin}..${envelope.turnSecondsMax}].`,
    });
  }

  if (
    ruleProfile.totalMatchSeconds < envelope.totalMatchSecondsMin ||
    ruleProfile.totalMatchSeconds > envelope.totalMatchSecondsMax
  ) {
    violations.push({
      field: "totalMatchSeconds",
      message: `Tổng thời gian trận (${ruleProfile.totalMatchSeconds}s) nằm ngoài trần hợp đồng [${envelope.totalMatchSecondsMin}..${envelope.totalMatchSecondsMax}].`,
    });
  }

  if (
    ruleProfile.turnLimit < envelope.turnLimitMin ||
    ruleProfile.turnLimit > envelope.turnLimitMax
  ) {
    violations.push({
      field: "turnLimit",
      message: `Giới hạn số lượt (${ruleProfile.turnLimit}) nằm ngoài trần hợp đồng [${envelope.turnLimitMin}..${envelope.turnLimitMax}].`,
    });
  }

  if (!envelope.allowedNoProgressPlies.includes(ruleProfile.noProgressPlies)) {
    violations.push({
      field: "noProgressPlies",
      message: `Ngưỡng không tiến triển (${ruleProfile.noProgressPlies}) không nằm trong tập cho phép [${envelope.allowedNoProgressPlies.join(", ")}].`,
    });
  }

  if (!envelope.allowedRepetitionThresholds.includes(ruleProfile.repetitionThreshold)) {
    violations.push({
      field: "repetitionThreshold",
      message: `Ngưỡng lặp nước đi (${ruleProfile.repetitionThreshold}) không nằm trong tập cho phép [${envelope.allowedRepetitionThresholds.join(", ")}].`,
    });
  }

  if (!envelope.allowedTieBreakPolicies.includes(ruleProfile.tieBreakPolicy)) {
    violations.push({
      field: "tieBreakPolicy",
      message: `Chính sách xử lý hòa (${ruleProfile.tieBreakPolicy}) không nằm trong tập cho phép [${envelope.allowedTieBreakPolicies.join(", ")}].`,
    });
  }

  return {
    withinEnvelope: violations.length === 0,
    violations,
  };
}

export const TournamentConfigVersionSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  coreConfigSnapshot: TournamentCoreConfigSchema,
  ruleProfileSnapshot: TournamentRuleProfileSchema,
  effectiveAt: z.string().datetime(),
  publishedByUserId: z.string().min(1),
  changeSummary: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type TournamentConfigVersionDto = z.infer<typeof TournamentConfigVersionSchema>;

// ============================================================================
// 6. Tournament Aggregate & Draft Commands (P02, P03, P08)
// ============================================================================

export const ApprovedTournamentSnapshotSchema = z.object({
  approvedAt: z.string().datetime(),
  approvedByUserId: z.string().min(1),
  approvalNote: z.string().nullable().default(null),
  fieldNotes: z.record(z.string(), z.string()).default({}),
  contractId: z.string().min(1),
  contractCode: z.string().min(1),
  unitId: z.string().min(1),
  coreConfig: TournamentCoreConfigSchema,
  ruleProfile: TournamentRuleProfileSchema,
  configVersionId: z.string().min(1),
  configVersionNumber: z.number().int().positive(),
});
export type ApprovedTournamentSnapshot = z.infer<typeof ApprovedTournamentSnapshotSchema>;

export const TournamentDtoSchema = z.object({
  id: z.string().min(1),
  contractId: z.string().min(1),
  contractCode: z.string().min(1),
  unitId: z.string().min(1),
  ownerTaUserId: z.string().min(1),
  status: TournamentStatusSchema,
  revision: z.number().int().positive(),
  coreConfig: TournamentCoreConfigSchema,
  ruleProfile: TournamentRuleProfileSchema,
  activeConfigVersionId: z.string().nullable().default(null),
  activeConfigVersionNumber: z.number().int().nonnegative().default(0),
  approvedSnapshot: ApprovedTournamentSnapshotSchema.nullable().default(null),
  everApproved: z.boolean().default(false),
  quotaRefunded: z.boolean().default(false),
  submittedAt: z.string().datetime().nullable().default(null),
  approvedAt: z.string().datetime().nullable().default(null),
  rejectedAt: z.string().datetime().nullable().default(null),
  changesRequestedAt: z.string().datetime().nullable().default(null),
  lastReviewNote: z.string().nullable().default(null),
  lastReviewFieldNotes: z.record(z.string(), z.string()).default({}),
  startedAt: z.string().datetime().nullable().default(null),
  pausedAt: z.string().datetime().nullable().default(null),
  pauseReason: z.string().nullable().default(null),
  endedAt: z.string().datetime().nullable().default(null),
  cancelledAt: z.string().datetime().nullable().default(null),
  cancelReason: z.string().nullable().default(null),
  finalizedAt: z.string().datetime().nullable().default(null),
  copiedFromTournamentId: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TournamentDto = z.infer<typeof TournamentDtoSchema>;

export const DEFAULT_TOURNAMENT_RULE_PROFILE: TournamentRuleProfile = {
  rulesVersion: "rps-v1",
  setupParityMode: "STANDARD_CANONICAL",
  turnSeconds: 30,
  totalMatchSeconds: 600,
  turnLimit: 120,
  noProgressPlies: 60,
  repetitionThreshold: 3,
  timeoutResultPolicy: "LOSS_FOR_TIMED_OUT_SIDE",
  disconnectGraceSeconds: 30,
  disconnectGracePolicy: "FORFEIT_AFTER_GRACE",
  tieBreakPolicy: "RANDOM_SEEDED",
  manualAdjudicationDeadlineSeconds:
    CANDIDATE_POLICY_DEFAULTS_V1.manualAdjudicationDeadlineSeconds,
  manualAdjudicationFallbackPolicy:
    CANDIDATE_POLICY_DEFAULTS_V1.manualAdjudicationFallbackPolicy,
  allowSpectatorDelaySeconds: 0,
};

export const CreateTournamentDraftInputSchema = z.object({
  contractId: z.string().min(1),
  coreConfig: TournamentCoreConfigSchema,
  ruleProfile: TournamentRuleProfileSchema.default(DEFAULT_TOURNAMENT_RULE_PROFILE),
});
export type CreateTournamentDraftInput = z.infer<typeof CreateTournamentDraftInputSchema>;

export const PatchTournamentDraftInputSchema = z.object({
  expectedRevision: z.number().int().positive(),
  coreConfig: TournamentCoreConfigSchema.partial().optional(),
  ruleProfile: TournamentRuleProfileSchema.partial().optional(),
});
export type PatchTournamentDraftInput = z.infer<typeof PatchTournamentDraftInputSchema>;

export const SubmitTournamentDraftInputSchema = z.object({
  expectedRevision: z.number().int().positive(),
  submissionNote: z.string().trim().max(500).optional(),
});
export type SubmitTournamentDraftInput = z.infer<typeof SubmitTournamentDraftInputSchema>;

// ============================================================================
// 7. Approvals & Separate Post-Approval ChangeRequests (P08: BR-06, BR-07, T022, T024)
// ============================================================================

export const ApprovalDecisionTypeSchema = z.enum([
  "APPROVE",
  "REJECT",
  "REQUEST_CHANGES",
]);
export type ApprovalDecisionType = z.infer<typeof ApprovalDecisionTypeSchema>;

export const ApprovalDecisionInputSchema = z
  .object({
    decision: ApprovalDecisionTypeSchema,
    expectedRevision: z.number().int().positive(),
    note: z.string().trim().max(1000).optional(),
    fieldNotes: z.record(z.string(), z.string().trim().min(1).max(500)).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      (val.decision === "REJECT" || val.decision === "REQUEST_CHANGES") &&
      (!val.note || val.note.trim().length < 3)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "Bắt buộc nhập lý do (ít nhất 3 ký tự) khi Từ chối hoặc Yêu cầu chỉnh sửa.",
      });
    }
  });
export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionInputSchema>;

export const ChangeRequestStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "CANCELLED",
]);
export type ChangeRequestStatus = z.infer<typeof ChangeRequestStatusSchema>;

export const ChangeRequestFieldDiffSchema = z.object({
  fieldPath: z.string().min(1),
  label: z.string().min(1),
  beforeValue: z.unknown(),
  afterValue: z.unknown(),
  requiresAdminApproval: z.boolean(),
});
export type ChangeRequestFieldDiff = z.infer<typeof ChangeRequestFieldDiffSchema>;

export const TournamentChangeRequestSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  tournamentCode: z.string().min(1),
  tournamentName: z.string().min(1),
  contractId: z.string().min(1),
  requestedByTaUserId: z.string().min(1),
  status: ChangeRequestStatusSchema,
  reason: z.string().min(3).max(1000),
  proposedCoreConfigPatch: TournamentCoreConfigSchema.partial().optional(),
  proposedRuleProfilePatch: TournamentRuleProfileSchema.partial().optional(),
  effectiveAt: z.string().datetime(),
  diffs: z.array(ChangeRequestFieldDiffSchema),
  reviewedByAdminUserId: z.string().nullable().default(null),
  reviewNote: z.string().nullable().default(null),
  reviewedAt: z.string().datetime().nullable().default(null),
  appliedConfigVersionId: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TournamentChangeRequestDto = z.infer<typeof TournamentChangeRequestSchema>;

export const CreateTournamentChangeRequestInputSchema = z.object({
  reason: z.string().trim().min(3, "Vui lòng nhập lý do thay đổi (ít nhất 3 ký tự).").max(1000),
  effectiveAt: z.string().datetime(),
  proposedCoreConfigPatch: TournamentCoreConfigSchema.partial().optional(),
  proposedRuleProfilePatch: TournamentRuleProfileSchema.partial().optional(),
});
export type CreateTournamentChangeRequestInput = z.infer<
  typeof CreateTournamentChangeRequestInputSchema
>;

export const PublishWithinEnvelopeRuleUpdateInputSchema = z.object({
  expectedRevision: z.number().int().positive(),
  effectiveAt: z.string().datetime(),
  changeSummary: z.string().trim().min(3).max(500),
  ruleProfilePatch: TournamentRuleProfileSchema.partial(),
});
export type PublishWithinEnvelopeRuleUpdateInput = z.infer<
  typeof PublishWithinEnvelopeRuleUpdateInputSchema
>;

// ============================================================================
// 7.1. Lifecycle Operation Inputs (L07: T027..T030)
// ============================================================================

export const PauseModeSchema = z.enum([
  "ADMISSION_PAUSE_ONLY",
  "FULL_MATCH_STOP",
]);
export type PauseMode = z.infer<typeof PauseModeSchema>;

export const PauseTournamentInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Vui lòng nhập lý do tạm dừng giải đấu (ít nhất 3 ký tự).")
    .max(1000),
  pauseMode: PauseModeSchema.optional().default("ADMISSION_PAUSE_ONLY"),
  expectedRevision: z.number().int().positive().optional(),
});
export type PauseTournamentInput = z.infer<typeof PauseTournamentInputSchema>;

export const ResumeTournamentInputSchema = z.object({
  expectedRevision: z.number().int().positive().optional(),
});
export type ResumeTournamentInput = z.infer<typeof ResumeTournamentInputSchema>;

export const CancelTournamentInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Bắt buộc nhập lý do hủy giải đấu (ít nhất 3 ký tự).")
    .max(1000),
  expectedRevision: z.number().int().positive().optional(),
});
export type CancelTournamentInput = z.infer<typeof CancelTournamentInputSchema>;

export const FinalizeTournamentInputSchema = z.object({
  expectedRevision: z.number().int().positive().optional(),
});
export type FinalizeTournamentInput = z.infer<typeof FinalizeTournamentInputSchema>;

// ============================================================================
// 8. Readiness Aggregate (P03: T025, T026)
// ============================================================================

export const ReadinessItemStatusSchema = z.enum(["PASS", "WARN", "BLOCKED"]);
export type ReadinessItemStatus = z.infer<typeof ReadinessItemStatusSchema>;

export const ReadinessChecklistItemSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  status: ReadinessItemStatusSchema,
  detail: z.string().min(1),
  blockerCode: z.string().optional(),
});
export type ReadinessChecklistItem = z.infer<typeof ReadinessChecklistItemSchema>;

export const TournamentReadinessSnapshotSchema = z.object({
  tournamentId: z.string().min(1),
  status: TournamentStatusSchema,
  canOpenScheduled: z.boolean(),
  canStartRunning: z.boolean(),
  canFinalize: z.boolean(),
  eligibleParticipantsCount: z.number().int().nonnegative(),
  minParticipantsRequired: z.number().int().positive(),
  activeStaffCount: z.number().int().nonnegative(),
  activeRefereeCount: z.number().int().nonnegative(),
  pendingManualAdjudicationsCount: z.number().int().nonnegative(),
  activeRuleVersionNumber: z.number().int().nonnegative(),
  checklist: z.array(ReadinessChecklistItemSchema),
  blockers: z.array(z.string()),
  evaluatedAt: z.string().datetime(),
  readinessState: z.enum(["NOT_READY", "READY"]).optional(),
});
export type TournamentReadinessSnapshot = z.infer<typeof TournamentReadinessSnapshotSchema>;

// ============================================================================
// 9. Roster Enrollments & Staff Assignments (P09..P13, P17: F67..F82)
// ============================================================================

export const EnrollmentEligibilityStatusSchema = z.enum([
  "ELIGIBLE",
  "PENDING_CLAIM",
  "CHECKIN_PENDING",
  "BOT_NOT_READY",
  "DISQUALIFIED",
  "WITHDRAWN",
]);
export type EnrollmentEligibilityStatus = z.infer<typeof EnrollmentEligibilityStatusSchema>;

export const TournamentEnrollmentSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  contractId: z.string().min(1),
  personKey: z.string().min(1), // F67
  userId: z.string().nullable().default(null),
  displayName: z.string().min(1), // F68
  unitCode: z.string().min(1), // F69
  email: z.string().email().nullable().default(null), // F70
  seedRating: z.number().int().default(1000), // F71
  eligibilityStatus: EnrollmentEligibilityStatusSchema, // F72
  checkedInAt: z.string().datetime().nullable().default(null),
  pinnedBotRevisionId: z.string().nullable().default(null),
  botReadinessStatus: z.enum(["NOT_REQUIRED", "READY", "INVALID", "MISSING"]).default("NOT_REQUIRED"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TournamentEnrollmentDto = z.infer<typeof TournamentEnrollmentSchema>;

export const StaffRoleTypeSchema = z.enum(["REFEREE", "STAFF"]);
export type StaffRoleType = z.infer<typeof StaffRoleTypeSchema>;

export const StaffAssignmentStatusSchema = z.enum(["INVITED", "ACTIVE", "DECLINED", "REVOKED"]);
export type StaffAssignmentStatus = z.infer<typeof StaffAssignmentStatusSchema>;

export const TournamentStaffAssignmentSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  userId: z.string().min(1),
  role: StaffRoleTypeSchema,
  status: StaffAssignmentStatusSchema,
  assignedRooms: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TournamentStaffAssignmentDto = z.infer<typeof TournamentStaffAssignmentSchema>;

// ============================================================================
// 10. Admission Gate C32 & Match Version Pinning (L06: BR-15, T005, T062, T075)
// ============================================================================

export const AdmissionActionTypeSchema = z.enum([
  "ONLINE_QUEUE_JOIN",
  "ONLINE_ROOM_CREATE",
  "ONLINE_ROOM_JOIN_PLAYER",
  "ONLINE_SEAT_UPGRADE_TO_PLAYER",
  "ONLINE_RECONNECT_EXISTING_MATCH",
  "SPECTATE_ROOM",
  "REFEREE_ENTER_ROOM",
  "OFFLINE_LOCAL_MATCH",
]);
export type AdmissionActionType = z.infer<typeof AdmissionActionTypeSchema>;

export const AdmissionCheckInputSchema = z.object({
  principalType: z.enum(["USER", "GUEST"]),
  principalId: z.string().min(1),
  roles: z.array(TournamentRoleSchema).default([]),
  action: AdmissionActionTypeSchema,
  tournamentId: z.string().optional(),
  roomId: z.string().optional(),
  matchId: z.string().optional(),
});
export type AdmissionCheckInput = z.infer<typeof AdmissionCheckInputSchema>;

export const AdmissionDecisionSchema = z.object({
  allowed: z.boolean(),
  reasonCode: z
    .enum([
      "ALLOWED",
      "ADMIN_CANNOT_PLAY_ONLINE",
      "GUEST_BLOCKED_DURING_TOURNAMENT_WINDOW",
      "OUTSIDE_USER_BLOCKED_DURING_TOURNAMENT_WINDOW",
      "TOURNAMENT_PAUSED_NO_NEW_ADMISSION",
      "PARTICIPANT_NOT_ELIGIBLE",
      "REFEREE_OUT_OF_SCOPE",
      "SPECTATOR_RESTRICTED_BY_POLICY",
    ])
    .default("ALLOWED"),
  message: z.string().min(1),
  activeTournamentIds: z.array(z.string()).default([]),
});
export type AdmissionDecision = z.infer<typeof AdmissionDecisionSchema>;

// ============================================================================
// 11. Manual Adjudication & Score/Elo Replay Ledger (L08: BR-31..BR-35, T059, T060, T072, T073, T081)
// ============================================================================

export const ManualAdjudicationStatusSchema = z.enum([
  "WAITING",
  "DECIDED",
  "FALLBACK_APPLIED",
  "CANCELLED",
]);
export type ManualAdjudicationStatus = z.infer<typeof ManualAdjudicationStatusSchema>;

export const ManualAdjudicationVerdictSideSchema = z.enum(["BLUE", "RED"]);
export type ManualAdjudicationVerdictSide = z.infer<typeof ManualAdjudicationVerdictSideSchema>;

export const ManualAdjudicationRequestSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  matchId: z.string().min(1),
  roomId: z.string().min(1),
  blueParticipantId: z.string().min(1),
  redParticipantId: z.string().min(1),
  status: ManualAdjudicationStatusSchema,
  frozenSnapshot: z.record(z.string(), z.unknown()),
  deadlineAt: z.string().datetime(),
  fallbackPolicy: z.enum([
    "RANDOM_SEEDED",
    "BLUE_ADVANTAGE",
    "RED_ADVANTAGE",
    "REPLAY_ONCE_THEN_SEEDED",
  ]),
  winnerSide: ManualAdjudicationVerdictSideSchema.nullable().default(null),
  decidedByUserId: z.string().nullable().default(null),
  decisionReason: z.string().nullable().default(null),
  decidedAt: z.string().datetime().nullable().default(null),
  finishSequence: z.number().int().positive().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ManualAdjudicationRequestDto = z.infer<typeof ManualAdjudicationRequestSchema>;

const SafeBoardCellSchema = z.object({
  row: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  side: z.enum(["BLUE", "RED"]).nullable(),
  pieceType: z.enum(["R", "P", "S"]).nullable(),
});

export const ManualAdjudicationBoardSchema = z.object({
  rows: z.number().int().positive(),
  columns: z.number().int().positive(),
  cells: z.array(SafeBoardCellSchema),
});
export type ManualAdjudicationBoard = z.infer<typeof ManualAdjudicationBoardSchema>;

export const ManualAdjudicationTieIndicatorsSchema = z.object({
  blue: ComparatorSideMetricsSchema,
  red: ComparatorSideMetricsSchema,
});
export type ManualAdjudicationTieIndicators = z.infer<typeof ManualAdjudicationTieIndicatorsSchema>;

export const ManualAdjudicationViewSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  matchId: z.string().min(1),
  roomId: z.string().min(1),
  blueParticipant: z.object({ id: z.string().min(1), label: z.string().min(1) }),
  redParticipant: z.object({ id: z.string().min(1), label: z.string().min(1) }),
  status: ManualAdjudicationStatusSchema,
  board: ManualAdjudicationBoardSchema.nullable(),
  sideToMove: z.enum(["BLUE", "RED"]).nullable(),
  tieIndicators: ManualAdjudicationTieIndicatorsSchema.nullable(),
  ruleVersion: z.string().min(1).nullable(),
  deadlineAt: z.string().datetime(),
  fallbackPolicy: z.enum(["RANDOM_SEEDED", "BLUE_ADVANTAGE", "RED_ADVANTAGE", "REPLAY_ONCE_THEN_SEEDED"]),
  winnerSide: ManualAdjudicationVerdictSideSchema.nullable(),
  reason: z.string().nullable(),
  resolutionSource: z.enum(["MANUAL", "FALLBACK_POLICY"]).nullable(),
  decidedByUserId: z.string().nullable(),
  finishedAtIso: z.string().datetime().nullable(),
  finishSequence: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ManualAdjudicationViewDto = z.infer<typeof ManualAdjudicationViewSchema>;

export const SubmitManualAdjudicationVerdictInputSchema = z.object({
  winnerSide: ManualAdjudicationVerdictSideSchema,
  reason: z.string().trim().min(3, "Bắt buộc nhập lý do phán quyết (ít nhất 3 ký tự).").max(1000),
});
export type SubmitManualAdjudicationVerdictInput = z.infer<
  typeof SubmitManualAdjudicationVerdictInputSchema
>;

export const TournamentScoreLedgerEntrySchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  matchId: z.string().min(1),
  finishSequence: z.number().int().positive(),
  blueParticipantId: z.string().min(1),
  redParticipantId: z.string().min(1),
  winnerSide: z.enum(["BLUE", "RED"]),
  resolutionSource: z.enum(["NORMAL_FINISH", "MANUAL_ADJUDICATION", "FALLBACK_POLICY"]),
  blueEloBefore: z.number().int(),
  blueEloAfter: z.number().int(),
  blueScoreBefore: z.number().int(),
  blueScoreAfter: z.number().int(),
  redEloBefore: z.number().int(),
  redEloAfter: z.number().int(),
  redScoreBefore: z.number().int(),
  redScoreAfter: z.number().int(),
  finishedAt: z.string().datetime(),
});
export type TournamentScoreLedgerEntryDto = z.infer<typeof TournamentScoreLedgerEntrySchema>;

export const TournamentStandingRowSchema = z.object({
  rank: z.number().int().positive(),
  participantId: z.string().min(1),
  personKey: z.string().min(1),
  displayName: z.string().min(1),
  unitCode: z.string().min(1),
  tournamentScore: z.number().int().nonnegative(),
  tournamentElo: z.number().int(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  matchesPlayed: z.number().int().nonnegative(),
  lastFinishedSequence: z.number().int().nonnegative(),
  lastFinishedAt: z.string().datetime().nullable(),
});
export type TournamentStandingRowDto = z.infer<typeof TournamentStandingRowSchema>;

export const TournamentLeaderboardSnapshotSchema = z.object({
  tournamentId: z.string().min(1),
  formulaPreset: z.literal("ELO_WEIGHTED_V1"),
  lastFinishSequence: z.number().int().nonnegative(),
  standings: z.array(TournamentStandingRowDtoSchemaProxy()),
  topNExport: z.array(TournamentStandingRowDtoSchemaProxy()),
  computedAt: z.string().datetime(),
});
function TournamentStandingRowDtoSchemaProxy() {
  return TournamentStandingRowSchema;
}
export type TournamentLeaderboardSnapshotDto = z.infer<typeof TournamentLeaderboardSnapshotSchema>;

// ============================================================================
// 12. Audit Log Contract (P14: BR-41, BR-42, T077)
// ============================================================================

export const AuditLogRecordSchema = z.object({
  id: z.string().min(1),
  actorUserId: z.string().min(1),
  actorRole: TournamentRoleSchema,
  action: z.string().min(1),
  targetType: z.enum([
    "UNIT",
    "CONTRACT",
    "CONTRACT_TA_BINDING",
    "TOURNAMENT",
    "CHANGE_REQUEST",
    "RULE_VERSION",
    "ADJUDICATION",
    "ROSTER",
    "STAFF",
    "SUPPORT",
  ]),
  targetId: z.string().min(1),
  beforeSnapshot: z.record(z.string(), z.unknown()).nullable().default(null),
  afterSnapshot: z.record(z.string(), z.unknown()).nullable().default(null),
  reason: z.string().nullable().default(null),
  correlationId: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
});
export type AuditLogRecordDto = z.infer<typeof AuditLogRecordSchema>;
