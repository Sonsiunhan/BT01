import { describe, expect, it } from "vitest";
import {
  TournamentRulePreviewRequestSchema,
  TournamentRulePreviewResponseSchema,
  TournamentRulePreviewSchemaVersion,
  TournamentRulePreviewCapabilitiesVersion,
} from "@ottv2/contracts";

const ray = {
  kind: "RAY" as const,
  directions: [{ fileDelta: 1, rankDelta: 0 }, { fileDelta: -1, rankDelta: 0 }],
  minDistance: 1,
  maxDistance: 2,
  canJump: false,
};

const profile = {
  version: "rps-custom-v1",
  directionSystem: "ABSOLUTE" as const,
  board: { rows: 5, cols: 15 },
  initialTurn: "BLUE" as const,
  pieceCounts: { BLUE: { R: 1, P: 0, S: 0 }, RED: { R: 1, P: 0, S: 0 } },
  layout: [
    { id: "blue-r-1", side: "BLUE" as const, type: "R" as const, coordinate: "n5" },
    { id: "red-r-1", side: "RED" as const, type: "R" as const, coordinate: "b1" },
  ],
  movementProfiles: {
    BLUE: { R: [ray], P: [ray], S: [ray] },
    RED: { R: [ray], P: [ray], S: [ray] },
  },
  winConditions: ["GOAL_REACHED" as const],
  goalProfiles: {
    BLUE: { mode: "STATIC" as const, cell: "o5" },
    RED: { mode: "STATIC" as const, cell: "a1" },
  },
};

describe("N02 typed rule-preview contracts", () => {
  it("accepts the widget request and keeps context revisions typed", () => {
    const parsed = TournamentRulePreviewRequestSchema.parse({
      expectedConfigRevision: 3,
      draftRevision: 7,
      profile: {
        schemaVersion: TournamentRulePreviewSchemaVersion,
        engineProfileVersion: "rps-custom-v1",
        sameMovementForBothSides: false,
        profile,
      },
    });
    expect(parsed.draftRevision).toBe(7);
    expect(parsed.profile.profile.board).toEqual({ rows: 5, cols: 15 });
  });

  it("parses unsupported goal modes for a typed capability error instead of silently coercing", () => {
    const result = TournamentRulePreviewRequestSchema.safeParse({
      expectedConfigRevision: 1,
      draftRevision: 1,
      profile: {
        schemaVersion: TournamentRulePreviewSchemaVersion,
        engineProfileVersion: "rps-custom-v1",
        profile: {
          ...profile,
          goalProfiles: {
            BLUE: { mode: "CYCLE", cells: ["o5"], roundInterval: 1 },
            RED: profile.goalProfiles.RED,
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("requires stable response capabilities and digest shape", () => {
    const parsed = TournamentRulePreviewResponseSchema.parse({
      tournamentId: "t-1",
      contractId: "c-1",
      expectedConfigRevision: 1,
      draftRevision: 1,
      schemaVersion: TournamentRulePreviewSchemaVersion,
      engineProfileVersion: "rps-custom-v1",
      capabilitiesVersion: TournamentRulePreviewCapabilitiesVersion,
      profileDigest: "a".repeat(64),
      normalizedProfile: null,
      valid: false,
      errors: [{ path: "profile.profile.version", code: "UNSUPPORTED_VERSION", messageKey: "rules.UNSUPPORTED_VERSION", message: "Không hỗ trợ." }],
      warnings: [],
      checks: { structural: "FAIL", initialNonTerminal: "NOT_CHECKED", initialLegalMoves: "NOT_CHECKED", goalReachability: "NOT_CHECKED", runtime: "NOT_CHECKED" },
      progress: {
        acceptedPlies: 0,
        roundIndex: 0,
        activeGoalBySide: { BLUE: null, RED: null },
        seedContext: null,
      },
      goalReachabilityBySide: { BLUE: [], RED: [] },
      legalMovesBySide: { BLUE: [], RED: [] },
      runtimeStatus: "NOT_CHECKED",
    });
    expect(parsed.capabilitiesVersion).toBe(TournamentRulePreviewCapabilitiesVersion);
  });
});
