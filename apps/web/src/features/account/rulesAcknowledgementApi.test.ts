import { afterEach, describe, expect, it, vi } from "vitest";
import { rulesAcknowledgementApi } from "./rulesAcknowledgementApi";

const payload = {
  contractId: "contract-1", tournamentId: "tournament-1", configVersionId: "version-2",
  versionNumber: 2, effectiveAt: "2026-10-23T00:00:00.000Z", regulationsFull: "Điều lệ", rulesQuickSummary: "Tóm tắt",
  required: true, satisfied: false, evidence: null,
};

afterEach(() => vi.restoreAllMocks());

describe("D08-C typed acknowledgement API", () => {
  it("loads the server-authoritative status without accepting a client identity", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    await expect(rulesAcknowledgementApi.getStatus("contract/1", "tournament/1")).resolves.toMatchObject({ configVersionId: "version-2" });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/contracts/contract%2F1/tournaments/tournament%2F1/rules-ack"), expect.objectContaining({ method: "GET", credentials: "include" }));
    expect(JSON.stringify(fetchMock.mock.calls[0]?.[1])).not.toContain("userId");
  });

  it("posts only the exact version returned by the server", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    await rulesAcknowledgementApi.acknowledge("contract-1", "tournament-1", "version-2");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/contracts/contract-1/tournaments/tournament-1/rules-ack"), expect.objectContaining({
      method: "POST", body: JSON.stringify({ configVersionId: "version-2" }), credentials: "include",
    }));
  });

  it("rejects a malformed response instead of inventing acknowledgement state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ satisfied: true }), { status: 200 }));
    await expect(rulesAcknowledgementApi.getStatus("contract-1", "tournament-1")).rejects.toThrow();
  });
});
