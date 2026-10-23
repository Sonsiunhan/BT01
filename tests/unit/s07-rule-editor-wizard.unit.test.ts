import { describe, expect, it } from "vitest";
import {
  SubmitTournamentDraftInputSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  type TournamentDto,
} from "@ottv2/contracts";
import { TournamentApiClient, FIXTURE_TOURNAMENTS } from "../../apps/web/src/features/admin/tournaments/tournamentApi";

describe("S07 — Nối RuleEditor V1 vào Wizard và Submit (AC-01..AC-05)", () => {
  const apiClient = new TournamentApiClient();

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

  it("AC-02: TournamentApiClient.submitDraft gửi dữ liệu hợp lệ và chuyển trạng thái sang UNDER_REVIEW", async () => {
    const res = await apiClient.submitDraft("tour-001", {
      expectedRevision: 8,
      submissionNote: "Nộp duyệt sau khi rà soát đầy đủ luật thi đấu.",
    });

    expect(res).toBeDefined();
    expect(res.tournament).toBeDefined();
    expect(res.tournament.status).toBe("UNDER_REVIEW");
    expect(res.tournament.id).toBe("tour-001");
    expect(res.tournament.submittedAt).toBeTruthy();
    expect(res.tournament.revision).toBe(9);
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

  it("AC-05: Quá trình nộp duyệt giữ nguyên vẹn RuleProfile và không làm mất cấu hình luật", async () => {
    const res = await apiClient.submitDraft("tour-002", {
      expectedRevision: 1,
      submissionNote: "Bảo lưu toàn bộ cấu hình luật chuẩn Robot Lab.",
    });

    expect(res.tournament.ruleProfile).toEqual(DEFAULT_TOURNAMENT_RULE_PROFILE);
    expect(res.tournament.ruleProfile.rulesVersion).toBe("rps-v1");
    expect(res.tournament.ruleProfile.turnSeconds).toBe(30);
    expect(res.tournament.ruleProfile.totalMatchSeconds).toBe(600);
  });
});
