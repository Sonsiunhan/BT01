import type { TournamentLifecycleStatus } from "./tournamentTypes";

/**
 * Vietnamese lifecycle labels shared by the wizard badge, the dedicated rules
 * page and any surface that must show the real tournament status instead of
 * assuming a draft.
 */
export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã gửi duyệt",
  UNDER_REVIEW: "Đang chờ phê duyệt",
  CHANGES_REQUESTED: "Cần chỉnh sửa theo yêu cầu",
  APPROVED: "Đã phê duyệt",
  REJECTED: "Bị từ chối",
  SCHEDULED: "Đã lên lịch",
  RUNNING: "Đang diễn ra",
  PAUSED: "Tạm dừng",
  PAUSED_ADJUDICATION: "Tạm dừng chờ phán quyết",
  CANCELLED: "Đã hủy",
  ENDED: "Đã kết thúc",
  FINALIZED: "Đã tổng kết",
  ARCHIVED: "Đã lưu trữ",
};

export function tournamentStatusLabel(status: string | null | undefined): string {
  if (!status) return TOURNAMENT_STATUS_LABELS.DRAFT;
  return TOURNAMENT_STATUS_LABELS[status] ?? status;
}

/**
 * Statuses in which the wizard may still patch the draft and submit it for
 * review. Every other lifecycle state locks the draft form server-side, so the
 * UI must not offer save/submit controls.
 */
export function isDraftEditableStatus(status: string | null | undefined): boolean {
  return !status || status === "DRAFT" || status === "CHANGES_REQUESTED";
}

export type { TournamentLifecycleStatus };
