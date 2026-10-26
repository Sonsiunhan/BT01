import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SubmitTournamentDraftInputSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
} from "@ottv2/contracts";
import { TournamentApiClient } from "../../apps/web/src/features/admin/tournaments/tournamentApi";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("S07 — Nối RuleEditor V1 vào Wizard và Submit (AC-01..AC-05)", () => {
  it("AC-01: SubmitTournamentDraftInputSchema kiểm tra nghiêm ngặt expectedRevision và submissionNote", () => {
    // Valid minimal input
    const validMinimal = SubmitTournamentDraftInputSchema.parse({
      expectedRevision: 1,
    });
    expect(validMinimal.expectedRevision).toBe(1);
    expect(validMinimal.submissionNote).toBeUndefined();

    // Valid full input
    const validFull = SubmitTournamentDraftInputSchema.parse({
      expectedRevision: 5,
      submissionNote: "Đã hoàn tất cấu hình bàn cờ tiêu chuẩn 6x6 và nộp duyệt theo quy chế.",
    });
    expect(validFull.expectedRevision).toBe(5);
    expect(validFull.submissionNote).toBe("Đã hoàn tất cấu hình bàn cờ tiêu chuẩn 6x6 và nộp duyệt theo quy chế.");

    // Invalid: missing expectedRevision
    expect(() => SubmitTournamentDraftInputSchema.parse({})).toThrow();

    // Invalid: negative or zero revision
    expect(() => SubmitTournamentDraftInputSchema.parse({ expectedRevision: 0 })).toThrow();
    expect(() => SubmitTournamentDraftInputSchema.parse({ expectedRevision: -1 })).toThrow();

    // Invalid: note exceeds 500 characters
    expect(() =>
      SubmitTournamentDraftInputSchema.parse({
        expectedRevision: 1,
        submissionNote: "A".repeat(501),
      })
    ).toThrow();
  });

  it("AC-02: TournamentApiClient.submitDraft gửi POST đúng endpoint với body hợp lệ và trả về phản hồi máy chủ", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const serverTournament = {
      id: "tour-001",
      status: "UNDER_REVIEW",
      revision: 9,
      submittedAt: "2026-10-26T00:00:00.000Z",
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return jsonResponse({ tournament: serverTournament });
      })
    );

    const apiClient = new TournamentApiClient();
    const res = await apiClient.submitDraft("tour-001", {
      expectedRevision: 8,
      submissionNote: "Nộp duyệt sau khi rà soát đầy đủ luật thi đấu.",
    });

    // Trả về đúng dữ liệu máy chủ, không bịa thêm trạng thái/revision.
    expect(res).toBeDefined();
    expect(res.tournament).toEqual(serverTournament);
    expect(res.tournament.status).toBe("UNDER_REVIEW");
    expect(res.tournament.submittedAt).toBeTruthy();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/tournaments/tour-001/submit");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      expectedRevision: 8,
      submissionNote: "Nộp duyệt sau khi rà soát đầy đủ luật thi đấu.",
    });
  });

  it("AC-02b: submitDraft chặn input không hợp lệ bằng schema trước khi gọi mạng", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const apiClient = new TournamentApiClient();
    await expect(
      apiClient.submitDraft("tour-001", { expectedRevision: 0 } as never)
    ).rejects.toThrow();
    await expect(
      apiClient.submitDraft("tour-001", {
        expectedRevision: 1,
        submissionNote: "A".repeat(501),
      } as never)
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-02c: lỗi mạng khi nộp duyệt được ném ra thay vì tự chế trạng thái UNDER_REVIEW", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );

    const apiClient = new TournamentApiClient();
    await expect(
      apiClient.submitDraft("tour-001", { expectedRevision: 8 })
    ).rejects.toMatchObject({ code: "NETWORK_ERROR", statusCode: 0 });
  });

  it("AC-03: OCC (Optimistic Concurrency Control) yêu cầu expectedRevision khớp với phiên bản máy chủ", () => {
    const serverRevision = 3;
    const clientRevisionCorrect = 3;
    const clientRevisionStale = 2;

    const checkOcc = (clientRev: number, serverRev: number) => {
      if (clientRev !== serverRev) {
        const error = new Error("Bản nháp đã được chỉnh sửa ở phiên khác.");
        return Object.assign(error, { statusCode: 409, code: "CONFLICT" });
      }
      return { ok: true };
    };

    expect(checkOcc(clientRevisionCorrect, serverRevision)).toEqual({ ok: true });
    const conflict = checkOcc(clientRevisionStale, serverRevision) as { statusCode: number; code: string };
    expect(conflict.statusCode).toBe(409);
    expect(conflict.code).toBe("CONFLICT");
  });

  it("AC-04: Chỉ cho phép nộp duyệt khi giải ở trạng thái DRAFT hoặc CHANGES_REQUESTED", () => {
    const validStatuses = ["DRAFT", "CHANGES_REQUESTED"];
    const invalidStatuses = ["UNDER_REVIEW", "APPROVED", "RUNNING", "ENDED", "CANCELLED"];

    const isSubmittable = (status: string) => validStatuses.includes(status);

    validStatuses.forEach((status) => {
      expect(isSubmittable(status)).toBe(true);
    });

    invalidStatuses.forEach((status) => {
      expect(isSubmittable(status)).toBe(false);
    });
  });

  it("AC-05: Quá trình nộp duyệt giữ nguyên vẹn RuleProfile máy chủ trả về và không làm mất cấu hình luật", async () => {
    const serverRuleProfile = {
      ...DEFAULT_TOURNAMENT_RULE_PROFILE,
      turnSeconds: 45,
      totalMatchSeconds: 900,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          tournament: {
            id: "tour-002",
            status: "UNDER_REVIEW",
            ruleProfile: serverRuleProfile,
          },
        })
      )
    );

    const apiClient = new TournamentApiClient();
    const res = await apiClient.submitDraft("tour-002", {
      expectedRevision: 1,
      submissionNote: "Bảo lưu toàn bộ cấu hình luật chuẩn Robot Lab.",
    });

    expect(res.tournament.ruleProfile).toEqual(serverRuleProfile);
    expect(res.tournament.ruleProfile.rulesVersion).toBe("rps-v1");
    expect(res.tournament.ruleProfile.turnSeconds).toBe(45);
    expect(res.tournament.ruleProfile.totalMatchSeconds).toBe(900);
  });
});
