import { afterEach, describe, expect, it, vi } from "vitest";
import { RuleVersionApiClient } from "./ruleVersionApi";

const version = {
  id: "version-1",
  tournamentId: "tour-1",
  versionNumber: 1,
  profileRef: { draftId: "draft-1", revision: 3 },
  profileDigest: "a".repeat(64),
  reason: "Phát hành luật vòng loại",
  effectiveAt: "2026-11-01T01:00:00.000Z",
  createdAt: "2026-10-22T01:00:00.000Z",
  immutable: true,
};

afterEach(() => vi.restoreAllMocks());

describe("RuleVersionApiClient", () => {
  it("lists and parses immutable versions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [version], nextCursor: null, configRevision: 3 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new RuleVersionApiClient().list("tour/1");
    expect(result.items[0]?.immutable).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/tournaments/tour%2F1/rule-versions", expect.objectContaining({ method: "GET", credentials: "include" }));
  });

  it("loads a field-level diff", async () => {
    const body = { baseVersionId: "version-0", targetVersionId: "version-1", changes: [{ path: "ruleProfile.turnSeconds", before: 30, after: 45, impact: "NEW_MATCHES_ONLY" }], sameDigest: false, oldMatchesUnaffected: true };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new RuleVersionApiClient().diff("tour-1", "version-1", "version-0");
    expect(result.changes[0]?.after).toBe(45);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/version-1/diff?against=version-0"), expect.any(Object));
  });

  it("publishes reason, effective time, digest and revision through the versioning route", async () => {
    const input = { expectedRevision: 3, profileRef: { draftId: "draft-1", revision: 3 }, profileDigest: "a".repeat(64), reason: "Phát hành luật vòng loại", effectiveAt: "2026-11-01T01:00:00.000Z", idempotencyKey: "rules-tour-1-3-aaaaaaaaaaaa" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ outcome: "PUBLISHED", version }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new RuleVersionApiClient().publish("tour-1", input);
    expect(result.outcome).toBe("PUBLISHED");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/tournaments/tour-1/rule-versions/publish", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
  });
});

