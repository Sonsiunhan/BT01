import { describe, expect, it } from "vitest";
import type { DraftFormData } from "./tournamentTypes";
import { validateDraftForSubmit } from "./wizardSubmitValidation";

function validDraft(overrides?: Partial<DraftFormData>): DraftFormData {
  const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
  return {
    tournamentId: "tour-1",
    name: "Giải Kiểm Thử Hợp Lệ",
    slug: "GIAI_KT_HOP_LE",
    description: "",
    contractId: "HD-1",
    organizerUnitId: "KHOA_CNTT",
    visibility: "PRIVATE",
    timeModel: "FIXED_WINDOW",
    timezone: "Asia/Ho_Chi_Minh",
    rosterOpenAt: "",
    rosterCloseAt: "",
    startAt: future(7),
    endAt: future(8),
    competitionMode: "HUMAN_ONLINE",
    pairingStrategy: "ARENA",
    minParticipants: 4,
    maxParticipants: 32,
    checkinRequired: false,
    organizersText: "Ban Tổ chức Test",
    allowedUnitCodes: ["KHOA_CNTT"],
    ...overrides,
  };
}

describe("validateDraftForSubmit", () => {
  it("bản nháp đủ dữ liệu → không có lỗi", () => {
    expect(validateDraftForSubmit(validDraft())).toEqual({});
  });

  it("thiếu tên/slug/hợp đồng/đơn vị → báo đúng từng trường", () => {
    const errors = validateDraftForSubmit(validDraft({ name: "", slug: "", contractId: "", organizerUnitId: "" }));
    expect(Object.keys(errors).sort()).toEqual(["contractId", "name", "organizerUnitId", "slug"]);
  });

  it("lịch kết thúc trước bắt đầu, thời gian trong quá khứ → báo lỗi", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const errors = validateDraftForSubmit(validDraft({ startAt: past, endAt: new Date(Date.now() - 2 * 86400000).toISOString() }));
    expect(errors.startAt).toMatch(/tương lai/);
    expect(errors.endAt).toMatch(/sau thời gian bắt đầu/);
  });

  it("lịch trình tạm do hệ thống điền (scheduleProvisional) → chặn nộp duyệt", () => {
    const errors = validateDraftForSubmit(validDraft({ scheduleProvisional: true }));
    expect(errors.startAt).toMatch(/giá trị tạm/);
    expect(errors.endAt).toMatch(/giá trị tạm/);
  });

  it("sau khi người dùng tự chọn lịch (gỡ cờ tạm) → thông qua", () => {
    expect(validateDraftForSubmit(validDraft({ scheduleProvisional: false }))).toEqual({});
  });

  it("giải nội bộ thiếu mã đơn vị được phép → báo lỗi", () => {
    const errors = validateDraftForSubmit(validDraft({ allowedUnitCodes: [] }));
    expect(errors.allowedUnitCodes).toMatch(/ít nhất 1 mã đơn vị/);
  });
});
