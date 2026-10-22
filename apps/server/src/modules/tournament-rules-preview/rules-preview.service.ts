import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  TournamentRulePreviewCapabilitiesVersion,
  TournamentRulePreviewSchemaVersion,
  type RulePreviewIssue,
  type TournamentRulePreviewRequest,
  type TournamentRulePreviewResponse,
  type TournamentEngineRuleProfile,
} from "@ottv2/contracts";
import {
  createInitialState,
  createRuleProgress,
  getGoalCandidates,
  getLegalMoves,
  hasBasicGoalReachability,
  validateRuleProfileForPreview,
  type DirectionVector,
  type MovementPattern,
  type RuleProfile,
  type Side,
} from "@ottv2/game-rules";

import type { AuthContext } from "../auth/auth.service.js";
import { AppError } from "../../shared/errors/app-error.js";

export type TournamentPreviewScope = Readonly<{
  tournamentId: string;
  contractId: string;
  ownerTaUserId: string;
  revision: number;
  activeContractBinding: boolean;
}>;

export interface TournamentPreviewScopeReader {
  read(tournamentId: string, userId: string): Promise<TournamentPreviewScope | null>;
}

export class PrismaTournamentPreviewScopeReader implements TournamentPreviewScopeReader {
  constructor(private readonly db: PrismaClient) {}

  async read(tournamentId: string, userId: string): Promise<TournamentPreviewScope | null> {
    const row = await this.db.tournament.findUnique({
      // Scope the lookup by the authenticated owner so a foreign tournament
      // cannot be confirmed merely by the preview endpoint's status code.
      where: { id: tournamentId, ownerTaUserId: userId },
      select: {
        id: true,
        contractId: true,
        ownerTaUserId: true,
        revision: true,
        contract: {
          select: {
            taBindings: {
              where: { userId, status: "ACTIVE" },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!row) return null;
    return {
      tournamentId: row.id,
      contractId: row.contractId,
      ownerTaUserId: row.ownerTaUserId,
      revision: row.revision,
      activeContractBinding: row.contract.taBindings.length > 0,
    };
  }
}

const SUPPORTED_RULE_VERSIONS = new Set(["rps-v1", "rps-v2", "rps-custom-v1"]);
const SUPPORTED_ENGINE_PROFILE_VERSION = "rps-custom-v1";
const SIDES: readonly Side[] = ["BLUE", "RED"];

function issue(path: string, code: RulePreviewIssue["code"], message: string): RulePreviewIssue {
  return { path, code, messageKey: "rules." + code, message };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  const record = value as Record<string, unknown>;
  return "{" + Object.keys(record).sort().map((key) => JSON.stringify(key) + ":" + stableJson(record[key])).join(",") + "}";
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function rotateVector(vector: DirectionVector): DirectionVector {
  return { fileDelta: -vector.fileDelta, rankDelta: -vector.rankDelta };
}

function normalizePattern(pattern: MovementPattern, relative: boolean): MovementPattern {
  if (pattern.kind === "RAY") {
    return {
      ...pattern,
      directions: relative ? pattern.directions.map(rotateVector) : pattern.directions.map((direction) => ({ ...direction })),
    };
  }
  return {
    ...pattern,
    offsets: relative ? pattern.offsets.map(rotateVector) : pattern.offsets.map((offset) => ({ ...offset })),
  };
}

function normalizeMovementProfiles(
  input: TournamentEngineRuleProfile,
  sameMovementForBothSides: boolean,
): RuleProfile["movementProfiles"] {
  const relative = input.directionSystem === "RELATIVE";
  const blue = input.movementProfiles.BLUE;
  const red = sameMovementForBothSides ? blue : input.movementProfiles.RED;
  return {
    BLUE: {
      R: blue.R.map((pattern) => normalizePattern(pattern as MovementPattern, false)),
      P: blue.P.map((pattern) => normalizePattern(pattern as MovementPattern, false)),
      S: blue.S.map((pattern) => normalizePattern(pattern as MovementPattern, false)),
    },
    RED: {
      R: red.R.map((pattern) => normalizePattern(pattern as MovementPattern, relative)),
      P: red.P.map((pattern) => normalizePattern(pattern as MovementPattern, relative)),
      S: red.S.map((pattern) => normalizePattern(pattern as MovementPattern, relative)),
    },
  };
}

function normalizeProfile(input: TournamentRulePreviewRequest["profile"]): RuleProfile {
  const profile = input.profile;
  type NormalizedGoalProfile =
    | { mode: "STATIC"; cell: string }
    | { mode: "CYCLE"; cells: string[]; roundInterval: number }
    | { mode: "SEEDED"; candidateCells: string[]; roundInterval: number; policyVersion: string };
  const normalizedGoals: Partial<Record<Side, NormalizedGoalProfile>> = {};
  for (const side of SIDES) {
    const goal = profile.goalProfiles?.[side];
    if (goal?.mode === "STATIC") normalizedGoals[side] = { mode: "STATIC", cell: goal.cell };
    if (goal?.mode === "CYCLE") normalizedGoals[side] = { mode: "CYCLE", cells: [...goal.cells], roundInterval: goal.roundInterval };
    if (goal?.mode === "SEEDED") normalizedGoals[side] = { mode: "SEEDED", candidateCells: [...goal.candidateCells], roundInterval: goal.roundInterval, policyVersion: goal.policyVersion };
  }
  return {
    version: profile.version,
    directionSystem: "ABSOLUTE",
    board: profile.board,
    initialTurn: profile.initialTurn,
    pieceCounts: profile.pieceCounts,
    layout: profile.layout as RuleProfile["layout"],
    movementProfiles: normalizeMovementProfiles(profile, input.sameMovementForBothSides),
    winConditions: profile.winConditions,
    ...(profile.goalProfiles === undefined ? {} : { goalProfiles: normalizedGoals }),
    ...(profile.seedContext === undefined ? {} : { seedContext: { ...profile.seedContext } }),
  } as RuleProfile;
}

function normalizedContractProfile(profile: RuleProfile): TournamentEngineRuleProfile {
  return {
    version: profile.version,
    directionSystem: "ABSOLUTE",
    board: { ...profile.board },
    initialTurn: profile.initialTurn ?? "BLUE",
    pieceCounts: {
      BLUE: { ...profile.pieceCounts.BLUE },
      RED: { ...profile.pieceCounts.RED },
    },
    layout: profile.layout.map((entry) => ({ ...entry })),
    movementProfiles: {
      BLUE: {
        R: profile.movementProfiles.BLUE.R.map((pattern) => ({ ...pattern, ...(pattern.kind === "RAY" ? { directions: pattern.directions.map((v) => ({ ...v })) } : { offsets: pattern.offsets.map((v) => ({ ...v })) }) })),
        P: profile.movementProfiles.BLUE.P.map((pattern) => ({ ...pattern, ...(pattern.kind === "RAY" ? { directions: pattern.directions.map((v) => ({ ...v })) } : { offsets: pattern.offsets.map((v) => ({ ...v })) }) })),
        S: profile.movementProfiles.BLUE.S.map((pattern) => ({ ...pattern, ...(pattern.kind === "RAY" ? { directions: pattern.directions.map((v) => ({ ...v })) } : { offsets: pattern.offsets.map((v) => ({ ...v })) }) })),
      },
      RED: {
        R: profile.movementProfiles.RED.R.map((pattern) => ({ ...pattern, ...(pattern.kind === "RAY" ? { directions: pattern.directions.map((v) => ({ ...v })) } : { offsets: pattern.offsets.map((v) => ({ ...v })) }) })),
        P: profile.movementProfiles.RED.P.map((pattern) => ({ ...pattern, ...(pattern.kind === "RAY" ? { directions: pattern.directions.map((v) => ({ ...v })) } : { offsets: pattern.offsets.map((v) => ({ ...v })) }) })),
        S: profile.movementProfiles.RED.S.map((pattern) => ({ ...pattern, ...(pattern.kind === "RAY" ? { directions: pattern.directions.map((v) => ({ ...v })) } : { offsets: pattern.offsets.map((v) => ({ ...v })) }) })),
      },
    },
    winConditions: [...(profile.winConditions ?? [])],
    ...(profile.goalProfiles === undefined ? {} : {
      goalProfiles: {
        ...(profile.goalProfiles.BLUE ? { BLUE: { ...profile.goalProfiles.BLUE } } : {}),
        ...(profile.goalProfiles.RED ? { RED: { ...profile.goalProfiles.RED } } : {}),
      },
    }),
    ...(profile.seedContext === undefined ? {} : { seedContext: { ...profile.seedContext } }),
  } as TournamentEngineRuleProfile;
}

function requireTournamentAdmin(context: AuthContext): void {
  if (context.principal !== "ACCOUNT") {
    throw new AppError("UNAUTHORIZED", "Bạn cần đăng nhập bằng tài khoản Tournament Admin.", 401, false, "FATAL_SESSION");
  }
  if ((context.user as unknown as { role?: string }).role !== "TOURNAMENT_ADMIN") {
    throw new AppError("UNAUTHORIZED", "Chỉ Tournament Admin của giải mới có thể kiểm tra luật.", 403, false, "INVALID");
  }
}

export class TournamentRulesPreviewService {
  constructor(private readonly scopes: TournamentPreviewScopeReader) {}

  async preview(
    context: AuthContext,
    tournamentId: string,
    input: TournamentRulePreviewRequest,
  ): Promise<TournamentRulePreviewResponse> {
    requireTournamentAdmin(context);
    const scope = await this.scopes.read(tournamentId, context.user.id);
    if (!scope) throw new AppError("NOT_FOUND", "Không tìm thấy giải đấu.", 404, false, "INVALID");
    if (scope.ownerTaUserId !== context.user.id || !scope.activeContractBinding) {
      throw new AppError("UNAUTHORIZED", "Bạn không có quyền trên giải đấu này.", 403, false, "INVALID");
    }
    if (scope.revision !== input.expectedConfigRevision) {
      throw new AppError("CONFLICT", "Bản nháp đã cũ. Hãy tải lại cấu hình giải trước khi xem preview.", 409, false, "INVALID", {
        tournamentId,
        expectedRevision: input.expectedConfigRevision,
        currentRevision: scope.revision,
      });
    }

    const errors: RulePreviewIssue[] = [];
    if (input.profile.engineProfileVersion !== SUPPORTED_ENGINE_PROFILE_VERSION) {
      errors.push(issue("profile.engineProfileVersion", "UNSUPPORTED_VERSION", "Phiên bản engine profile chưa được hỗ trợ."));
    }
    if (!SUPPORTED_RULE_VERSIONS.has(input.profile.profile.version)) {
      errors.push(issue("profile.profile.version", "UNSUPPORTED_VERSION", "Phiên bản luật chưa được đăng ký."));
    }
    const engineProfile = normalizeProfile(input.profile);
    const structuralIssues = validateRuleProfileForPreview(engineProfile);
    errors.push(...structuralIssues.map((entry) => issue(entry.path, entry.code as RulePreviewIssue["code"], entry.message)));
    const normalizedProfile = normalizedContractProfile(engineProfile);
    const profileDigest = digest(normalizedProfile);
    const structuralPass = errors.length === 0;
    let legalMovesBySide: TournamentRulePreviewResponse["legalMovesBySide"] = { BLUE: [], RED: [] };
    let initialNonTerminal: "PASS" | "FAIL" | "NOT_CHECKED" = "NOT_CHECKED";
    let initialLegalMoves: "PASS" | "FAIL" | "NOT_CHECKED" = "NOT_CHECKED";
    let goalReachability: "PASS" | "FAIL" | "NOT_CHECKED" = "NOT_CHECKED";
    const publicSeedContext = engineProfile.seedContext?.policyVersion === "goal-prng-v1"
      ? { seed: engineProfile.seedContext.seed, matchKey: engineProfile.seedContext.matchKey, policyVersion: "goal-prng-v1" as const }
      : null;
    let progress: TournamentRulePreviewResponse["progress"] = {
      acceptedPlies: 0,
      roundIndex: 0,
      activeGoalBySide: { BLUE: null, RED: null },
      seedContext: publicSeedContext,
    };
    let goalReachabilityBySide: TournamentRulePreviewResponse["goalReachabilityBySide"] = { BLUE: [], RED: [] };

    if (structuralPass) {
      const state = createInitialState({ profile: engineProfile });
      const initialProgress = createRuleProgress(engineProfile);
      progress = {
        acceptedPlies: initialProgress.acceptedPlies,
        roundIndex: initialProgress.roundIndex,
        activeGoalBySide: { ...initialProgress.activeGoalBySide },
        seedContext: publicSeedContext,
      };
      legalMovesBySide = {
        BLUE: getLegalMoves(state, "BLUE").map(({ from, to }) => ({ from, to })),
        RED: getLegalMoves(state, "RED").map(({ from, to }) => ({ from, to })),
      };
      const bothHaveMoves = legalMovesBySide.BLUE.length > 0 && legalMovesBySide.RED.length > 0;
      initialNonTerminal = state.status === "PLAYING" && bothHaveMoves ? "PASS" : "FAIL";
      initialLegalMoves = bothHaveMoves ? "PASS" : "FAIL";
      if (!bothHaveMoves) {
        for (const side of SIDES) {
          if (legalMovesBySide[side].length === 0) errors.push(issue("layout", "INITIAL_NO_LEGAL_MOVES", side + " không có nước đi hợp lệ ban đầu."));
        }
      }
      if (engineProfile.winConditions?.includes("GOAL_REACHED")) {
        for (const side of SIDES) {
          const cells = getGoalCandidates(engineProfile, side);
          goalReachabilityBySide[side] = cells.map((cell) => ({
            cell,
            status: hasBasicGoalReachability(engineProfile, side, cell) ? "PASS" : "FAIL",
          }));
        }
        const bothReach = SIDES.every((side) => goalReachabilityBySide[side].every((entry) => entry.status === "PASS"));
        goalReachability = bothReach ? "PASS" : "FAIL";
        for (const side of SIDES) {
          if (goalReachabilityBySide[side].some((entry) => entry.status === "FAIL")) errors.push(issue("goalProfiles." + side, "GOAL_UNREACHABLE", "Có ô đích không có đường đi cơ bản từ bố cục ban đầu."));
        }
      } else {
        goalReachability = "PASS";
      }
    }

    const response: TournamentRulePreviewResponse = {
      tournamentId,
      contractId: scope.contractId,
      expectedConfigRevision: input.expectedConfigRevision,
      draftRevision: input.draftRevision,
      schemaVersion: TournamentRulePreviewSchemaVersion,
      engineProfileVersion: input.profile.engineProfileVersion,
      capabilitiesVersion: TournamentRulePreviewCapabilitiesVersion,
      profileDigest,
      normalizedProfile: structuralPass ? normalizedProfile : null,
      valid: errors.length === 0,
      errors,
      warnings: [],
      checks: {
        structural: structuralPass ? "PASS" : "FAIL",
        initialNonTerminal,
        initialLegalMoves,
        goalReachability,
        runtime: "NOT_CHECKED",
      },
      progress,
      goalReachabilityBySide,
      legalMovesBySide,
      runtimeStatus: "NOT_CHECKED",
    };
    return response;
  }
}
