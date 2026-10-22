import { describe, expect, it } from "vitest";
import {
  TournamentRulePreviewRequestSchema,
  TournamentRulePreviewSchemaVersion,
  type TournamentRulePreviewRequest,
} from "@ottv2/contracts";
import type { AuthContext } from "../../apps/server/src/modules/auth/auth.service.js";
import {
  TournamentRulesPreviewService,
  type TournamentPreviewScope,
  type TournamentPreviewScopeReader,
} from "../../apps/server/src/modules/tournament-rules-preview/rules-preview.service.js";

const ray = {
  kind: "RAY" as const,
  directions: [{ fileDelta: 1, rankDelta: 0 }, { fileDelta: -1, rankDelta: 0 }],
  minDistance: 1,
  maxDistance: 2,
  canJump: false,
};

function request(overrides: Record<string, unknown> = {}): TournamentRulePreviewRequest {
  return TournamentRulePreviewRequestSchema.parse({
    expectedConfigRevision: 3,
    draftRevision: 7,
    profile: {
      schemaVersion: TournamentRulePreviewSchemaVersion,
      engineProfileVersion: "rps-custom-v1",
      sameMovementForBothSides: false,
      profile: {
        version: "rps-custom-v1",
        directionSystem: "ABSOLUTE",
        board: { rows: 5, cols: 15 },
        initialTurn: "BLUE",
        pieceCounts: { BLUE: { R: 1, P: 0, S: 0 }, RED: { R: 1, P: 0, S: 0 } },
        layout: [
          { id: "blue-r-1", side: "BLUE", type: "R", coordinate: "n5" },
          { id: "red-r-1", side: "RED", type: "R", coordinate: "b1" },
        ],
        movementProfiles: {
          BLUE: { R: [ray], P: [ray], S: [ray] },
          RED: { R: [ray], P: [ray], S: [ray] },
        },
        winConditions: ["GOAL_REACHED"],
        goalProfiles: { BLUE: { mode: "STATIC", cell: "o5" }, RED: { mode: "STATIC", cell: "a1" } },
      },
    },
    ...overrides,
  });
}

function context(role = "TOURNAMENT_ADMIN"): AuthContext {
  return { principal: "ACCOUNT", user: { id: "ta-1", role } } as unknown as AuthContext;
}

function scope(overrides: Partial<TournamentPreviewScope> = {}): TournamentPreviewScope {
  return { tournamentId: "t-1", contractId: "c-1", ownerTaUserId: "ta-1", revision: 3, activeContractBinding: true, ...overrides };
}

describe("N02 TournamentRulesPreviewService", () => {
  it("uses the real engine, returns both-side golden moves and a stable digest without mutation", async () => {
    const reader: TournamentPreviewScopeReader = { read: async () => scope() };
    const service = new TournamentRulesPreviewService(reader);
    const input = request();
    const before = JSON.stringify(input);
    const first = await service.preview(context(), "t-1", input);
    const second = await service.preview(context(), "t-1", input);
    expect(first.valid).toBe(true);
    expect(first.legalMovesBySide.BLUE).toContainEqual({ from: "n5", to: "o5" });
    expect(first.legalMovesBySide.RED).toContainEqual({ from: "b1", to: "a1" });
    expect(first.profileDigest).toBe(second.profileDigest);
    expect(JSON.stringify(input)).toBe(before);
    expect(first.checks.runtime).toBe("NOT_CHECKED");
  });

  it("reports unsupported CYCLE and stale revision before preview side effects", async () => {
    let reads = 0;
    const reader: TournamentPreviewScopeReader = { read: async () => { reads += 1; return scope(); } };
    const service = new TournamentRulesPreviewService(reader);
    const cycle = request({
      profile: {
        ...request().profile,
        profile: {
          ...request().profile.profile,
          goalProfiles: { BLUE: { mode: "CYCLE", cells: ["o5"], roundInterval: 1 }, RED: { mode: "STATIC", cell: "a1" } },
        },
      },
    });
    const unsupported = await service.preview(context(), "t-1", cycle);
    expect(unsupported.valid).toBe(false);
    expect(unsupported.errors.map((error) => error.code)).toContain("UNSUPPORTED_CAPABILITY");
    await expect(service.preview(context(), "t-1", request({ expectedConfigRevision: 99 }))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(reads).toBe(2);
  });

  it("rejects forged actor role and non-owner scope", async () => {
    const service = new TournamentRulesPreviewService({ read: async () => scope({ ownerTaUserId: "other" }) });
    await expect(service.preview(context("USER"), "t-1", request())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(service.preview(context(), "t-1", request())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
