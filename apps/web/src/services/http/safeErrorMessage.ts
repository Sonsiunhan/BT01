import { ApiError } from "./apiError";

/** Converts API failures into UI-safe copy without exposing server diagnostics. */
export function safeErrorMessage(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) {
    // Unexpected client/network errors must never be rendered verbatim. Their
    // messages can contain internal paths, query details, or credentials.
    return fallback;
  }
  if (cause.status === 401) return "Phiên làm việc không còn hợp lệ. Vui lòng đăng nhập lại.";
  if (cause.status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (cause.status === 404) return "Yêu cầu không còn khả dụng.";
  if (cause.status === 409) {
    if (cause.code === "IDEMPOTENCY_KEY_REUSED") return "Mã yêu cầu đã được dùng cho dữ liệu khác.";
    if (cause.code === "DUPLICATE_PERSON_KEY") return "Người này đã có trong danh sách.";
    return "Yêu cầu đã được xử lý hoặc đang có thao tác khác. Hãy tải lại để xem trạng thái mới.";
  }
  if (cause.status === 413) return "Tệp hoặc dữ liệu vượt quá giới hạn cho phép.";
  if (cause.status === 400) return "Dữ liệu gửi lên chưa hợp lệ.";
  return fallback;
}
