import type { DraftFormData } from "./tournamentTypes";

/**
 * Field-level pre-submit validation for the tournament wizard.
 *
 * Saving a draft is intentionally NOT validated (a draft may contain anything);
 * these checks mirror the server-side submit gates so the TA sees exactly which
 * fields are missing or wrong, with red-marked inputs, before the request fires.
 */
export function validateDraftForSubmit(data: DraftFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = (data.name ?? "").trim();
  if (name.length < 3 || name.length > 120) {
    errors.name = "Tên giải đấu bắt buộc, từ 3 đến 120 ký tự.";
  }

  const slug = (data.slug ?? "").trim();
  if (!/^[A-Z0-9_]{3,64}$/.test(slug)) {
    errors.slug = "Mã giải bắt buộc: 3–64 ký tự IN HOA (chữ cái, số, dấu gạch dưới _).";
  }

  if (!(data.contractId ?? "").trim()) {
    errors.contractId = "Vui lòng nhập mã hợp đồng bảo trợ (Contract).";
  }

  if (!(data.organizerUnitId ?? "").trim()) {
    errors.organizerUnitId = "Vui lòng nhập đơn vị tổ chức (Unit).";
  }

  if (!(data.organizersText ?? "").trim()) {
    errors.organizersText = "Vui lòng nhập tên ban tổ chức hiển thị.";
  }

  if (data.visibility === "PRIVATE" && !(data.allowedUnitCodes ?? []).length) {
    errors.allowedUnitCodes = "Giải nội bộ cần ít nhất 1 mã đơn vị được phép tham gia.";
  }

  if (!data.startAt) {
    errors.startAt = "Vui lòng chọn thời gian bắt đầu thi đấu.";
  } else if (Date.parse(data.startAt) <= Date.now()) {
    errors.startAt = "Thời gian bắt đầu phải ở tương lai khi nộp duyệt.";
  }

  if (!data.endAt) {
    errors.endAt = "Vui lòng chọn thời gian kết thúc thi đấu.";
  } else if (data.startAt && Date.parse(data.endAt) <= Date.parse(data.startAt)) {
    errors.endAt = "Thời gian kết thúc phải sau thời gian bắt đầu.";
  }

  const min = Number(data.minParticipants);
  const max = Number(data.maxParticipants);
  if (!Number.isFinite(min) || min < 2) {
    errors.minParticipants = "Số thí sinh tối thiểu phải từ 2 trở lên.";
  }
  if (!Number.isFinite(max) || max < 2) {
    errors.maxParticipants = "Số thí sinh tối đa phải từ 2 trở lên.";
  } else if (Number.isFinite(min) && min > max) {
    errors.maxParticipants = "Số thí sinh tối đa phải lớn hơn hoặc bằng số tối thiểu.";
  }

  return errors;
}

/** Wizard step containing each validated field, so a blocked submit can jump there. */
export const FIELD_STEP: Record<string, 1 | 2 | 3 | 4> = {
  name: 1,
  slug: 1,
  contractId: 1,
  organizerUnitId: 1,
  organizersText: 1,
  allowedUnitCodes: 1,
  startAt: 2,
  endAt: 2,
  minParticipants: 3,
  maxParticipants: 3,
};
