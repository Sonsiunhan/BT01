import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultRuleEditorValue } from "./ruleEditorDefaults";
import { RulePreviewApiClient } from "./rulePreviewApi";
import { createRulePreviewRequest } from "./ruleEditorTypes";

const response = {
  tournamentId: "tour-1",
  contractId: "contract-1",
  expectedConfigRevision: 4,
  draftRevision: 9,
  schemaVersion: "tournament-rule-profile.v1",
  engineProfileVersion: "rps-engine-v1",
  capabilitiesVersion: "rules-preview.v1",
  profileDigest: "a".repeat(64),
  normalizedProfile: null,
  valid: false,
  errors: [],
  warnings: [],
  checks: { structural: "FAIL", initialNonTerminal: "NOT_CHECKED", initialLegalMoves: "NOT_CHECKED", goalReachability: "NOT_CHECKED", runtime: "NOT_CHECKED" },
  progress: { acceptedPlies: 0, roundIndex: 0, activeGoalBySide: { BLUE: null, RED: null }, seedContext: null },
  goalReachabilityBySide: { BLUE: [], RED: [] },
  legalMovesBySide: { BLUE: [], RED: [] },
  runtimeStatus: "NOT_CHECKED",
};

afterEach(() => vi.restoreAllMocks());

describe("RulePreviewApiClient", () => {
  it("posts the stable preview request to the real endpoint and parses the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const request = createRulePreviewRequest(createDefaultRuleEditorValue(), 4, 9);
    const result = await new RulePreviewApiClient().preview("tour/1", request);

    expect(result).toMatchObject({ tournamentId: "tour-1", capabilitiesVersion: "rules-preview.v1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/tournaments/tour%2F1/rule-profile/validate-preview",
      expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify(request) }),
    );
  });

  it("rejects a response that does not match the contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ valid: true }), { status: 200 })));
    const request = createRulePreviewRequest(createDefaultRuleEditorValue(), 4, 9);
    await expect(new RulePreviewApiClient().preview("tour-1", request)).rejects.toThrow();
  });
});
