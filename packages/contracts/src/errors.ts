import { z } from "zod";

export const ErrorSeveritySchema = z.enum([
  "RECOVERABLE",
  "INVALID",
  "FATAL_SESSION"
]);

export const PublicErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "CONFLICT",
  "RATE_LIMITED",
  "NOT_FOUND",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
  "PROTOCOL_VERSION_MISMATCH"
]);

export const ErrorEnvelopeSchema = z.object({
  code: PublicErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
  severity: ErrorSeveritySchema,
  details: z.record(z.string(), z.unknown()).default({})
});

export type ErrorSeverity = z.infer<typeof ErrorSeveritySchema>;
export type PublicErrorCode = z.infer<typeof PublicErrorCodeSchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

// V2 Error contracts (L-02.11)
export const ErrorSeverityV2Schema = ErrorSeveritySchema;
export type ErrorSeverityV2 = z.infer<typeof ErrorSeverityV2Schema>;

export const PublicErrorCodeV2Schema = PublicErrorCodeSchema;
export type PublicErrorCodeV2 = z.infer<typeof PublicErrorCodeV2Schema>;

export const ErrorReasonV2Schema = z.enum([
  "SCHEMA_VALIDATION_FAILED",
  "ILLEGAL_MOVE",
  "INVALID_COORDINATES",
  "SESSION_REVOKED",
  "SESSION_EXPIRED",
  "INVALID_CREDENTIALS",
  "FORBIDDEN_ROLE",
  "GUEST_CANNOT_PLAY_RANKED",
  "GUEST_CANNOT_BE_REFEREE",
  "CONTROLLER_MISMATCH",
  "RESOURCE_NOT_FOUND",
  "ROOM_NOT_FOUND",
  "MATCH_NOT_FOUND",
  "STALE_VERSION",
  "WRONG_TURN",
  "COMMAND_ID_REUSED",
  "COMMAND_EXPIRED",
  "MATCH_PAUSED",
  "MATCH_TERMINAL",
  "NO_LEGAL_MOVES",
  "PROTOCOL_VERSION_MISMATCH",
  "SETUP_VERSION_UNSUPPORTED",
  "PAYLOAD_TOO_LARGE",
  "SOURCE_TOO_LARGE",
  "RATE_LIMIT_EXCEEDED",
  "SETUP_ENTROPY_UNAVAILABLE",
  "SETUP_PERSIST_FAILED",
  "RUNTIME_UNAVAILABLE",
  "CAPACITY_EXCEEDED",
  "DATABASE_UNAVAILABLE",
  "SETUP_PREVIOUS_INVALID",
  "CHECKPOINT_RESTORE_FAILED",
  "RULE_STATE_INVALID",
  "SETUP_SEED_INVALID",
  "RESOURCE_LIMIT_EXCEEDED",
]);
export type ErrorReasonV2 = z.infer<typeof ErrorReasonV2Schema>;

export interface ErrorCatalogEntry {
  statusCode: number;
  code: PublicErrorCodeV2;
  severity: ErrorSeverityV2;
  retryable: boolean;
  message: string;
}

export const ERROR_CATALOG_V2: Record<ErrorReasonV2, ErrorCatalogEntry> = {
  SCHEMA_VALIDATION_FAILED: {
    statusCode: 400,
    code: "VALIDATION_ERROR",
    severity: "INVALID",
    retryable: false,
    message: "Dữ liệu yêu cầu không đúng định dạng.",
  },
  ILLEGAL_MOVE: {
    statusCode: 400,
    code: "VALIDATION_ERROR",
    severity: "INVALID",
    retryable: false,
    message: "Nước đi không hợp lệ theo luật cờ.",
  },
  INVALID_COORDINATES: {
    statusCode: 400,
    code: "VALIDATION_ERROR",
    severity: "INVALID",
    retryable: false,
    message: "Tọa độ bàn cờ không hợp lệ.",
  },
  SESSION_REVOKED: {
    statusCode: 401,
    code: "UNAUTHORIZED",
    severity: "FATAL_SESSION",
    retryable: false,
    message: "Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.",
  },
  SESSION_EXPIRED: {
    statusCode: 401,
    code: "UNAUTHORIZED",
    severity: "FATAL_SESSION",
    retryable: false,
    message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  },
  INVALID_CREDENTIALS: {
    statusCode: 401,
    code: "UNAUTHORIZED",
    severity: "INVALID",
    retryable: false,
    message: "Thông tin xác thực không chính xác.",
  },
  FORBIDDEN_ROLE: {
    statusCode: 403,
    code: "UNAUTHORIZED",
    severity: "INVALID",
    retryable: false,
    message: "Bạn không có quyền thực hiện thao tác này.",
  },
  GUEST_CANNOT_PLAY_RANKED: {
    statusCode: 403,
    code: "UNAUTHORIZED",
    severity: "INVALID",
    retryable: false,
    message: "Khách (Guest) không thể tham gia chế độ Xếp hạng.",
  },
  GUEST_CANNOT_BE_REFEREE: {
    statusCode: 403,
    code: "UNAUTHORIZED",
    severity: "INVALID",
    retryable: false,
    message: "Khách (Guest) không thể đảm nhiệm vai trò Trọng tài.",
  },
  CONTROLLER_MISMATCH: {
    statusCode: 403,
    code: "UNAUTHORIZED",
    severity: "INVALID",
    retryable: false,
    message: "Loại bộ điều khiển (Controller) không khớp với cấu hình phòng.",
  },
  RESOURCE_NOT_FOUND: {
    statusCode: 404,
    code: "NOT_FOUND",
    severity: "INVALID",
    retryable: false,
    message: "Không tìm thấy tài nguyên yêu cầu.",
  },
  ROOM_NOT_FOUND: {
    statusCode: 404,
    code: "NOT_FOUND",
    severity: "INVALID",
    retryable: false,
    message: "Phòng chơi không tồn tại hoặc đã đóng.",
  },
  MATCH_NOT_FOUND: {
    statusCode: 404,
    code: "NOT_FOUND",
    severity: "INVALID",
    retryable: false,
    message: "Trận đấu không tồn tại.",
  },
  STALE_VERSION: {
    statusCode: 409,
    code: "CONFLICT",
    severity: "RECOVERABLE",
    retryable: false,
    message: "Phiên bản trạng thái đã cũ. Vui lòng đồng bộ lại bàn cờ.",
  },
  WRONG_TURN: {
    statusCode: 409,
    code: "CONFLICT",
    severity: "RECOVERABLE",
    retryable: false,
    message: "Chưa đến lượt đi của bạn.",
  },
  COMMAND_ID_REUSED: {
    statusCode: 409,
    code: "CONFLICT",
    severity: "RECOVERABLE",
    retryable: false,
    message: "Mã lệnh đã được sử dụng với nội dung khác.",
  },
  COMMAND_EXPIRED: {
    statusCode: 409,
    code: "CONFLICT",
    severity: "RECOVERABLE",
    retryable: false,
    message: "Lệnh đã hết hạn lưu trữ.",
  },
  MATCH_PAUSED: {
    statusCode: 409,
    code: "CONFLICT",
    severity: "RECOVERABLE",
    retryable: false,
    message: "Trận đấu đang tạm dừng.",
  },
  MATCH_TERMINAL: {
    statusCode: 409,
    code: "CONFLICT",
    severity: "RECOVERABLE",
    retryable: false,
    message: "Trận đấu đã kết thúc.",
  },
  NO_LEGAL_MOVES: {
    statusCode: 409,
    code: "CONFLICT",
    severity: "RECOVERABLE",
    retryable: false,
    message: "Bị khóa nước đi, không còn nước đi hợp lệ.",
  },
  PROTOCOL_VERSION_MISMATCH: {
    statusCode: 409,
    code: "PROTOCOL_VERSION_MISMATCH",
    severity: "INVALID",
    retryable: false,
    message: "Phiên bản giao thức không tương thích.",
  },
  SETUP_VERSION_UNSUPPORTED: {
    statusCode: 409,
    code: "PROTOCOL_VERSION_MISMATCH",
    severity: "INVALID",
    retryable: false,
    message: "Phiên bản thiết lập luật cờ không được hỗ trợ.",
  },
  PAYLOAD_TOO_LARGE: {
    statusCode: 413,
    code: "VALIDATION_ERROR",
    severity: "INVALID",
    retryable: false,
    message: "Kích thước dữ liệu gửi lên vượt quá giới hạn cho phép.",
  },
  SOURCE_TOO_LARGE: {
    statusCode: 413,
    code: "VALIDATION_ERROR",
    severity: "INVALID",
    retryable: false,
    message: "Kích thước mã nguồn Bot vượt quá giới hạn 64KB.",
  },
  RATE_LIMIT_EXCEEDED: {
    statusCode: 429,
    code: "RATE_LIMITED",
    severity: "RECOVERABLE",
    retryable: true,
    message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
  },
  SETUP_ENTROPY_UNAVAILABLE: {
    statusCode: 503,
    code: "SERVICE_UNAVAILABLE",
    severity: "RECOVERABLE",
    retryable: true,
    message: "Nguồn ngẫu nhiên tạo hạt giống tạm thời không khả dụng.",
  },
  SETUP_PERSIST_FAILED: {
    statusCode: 503,
    code: "SERVICE_UNAVAILABLE",
    severity: "RECOVERABLE",
    retryable: true,
    message: "Lưu trữ trạng thái trận đấu thất bại. Đang thử lại.",
  },
  RUNTIME_UNAVAILABLE: {
    statusCode: 503,
    code: "SERVICE_UNAVAILABLE",
    severity: "RECOVERABLE",
    retryable: true,
    message: "Môi trường thực thi Bot tạm thời không sẵn sàng.",
  },
  CAPACITY_EXCEEDED: {
    statusCode: 503,
    code: "SERVICE_UNAVAILABLE",
    severity: "RECOVERABLE",
    retryable: true,
    message: "Hệ thống đang quá tải. Vui lòng chờ.",
  },
  DATABASE_UNAVAILABLE: {
    statusCode: 503,
    code: "SERVICE_UNAVAILABLE",
    severity: "RECOVERABLE",
    retryable: true,
    message: "Cơ sở dữ liệu tạm thời gián đoạn. Vui lòng thử lại.",
  },
  SETUP_PREVIOUS_INVALID: {
    statusCode: 503,
    code: "SERVICE_UNAVAILABLE",
    severity: "INVALID",
    retryable: false,
    message: "Hạt giống ván trước không hợp lệ để đối xứng.",
  },
  CHECKPOINT_RESTORE_FAILED: {
    statusCode: 503,
    code: "SERVICE_UNAVAILABLE",
    severity: "INVALID",
    retryable: false,
    message: "Không thể phục hồi điểm kiểm tra an toàn.",
  },
  RULE_STATE_INVALID: {
    statusCode: 500,
    code: "INTERNAL_ERROR",
    severity: "INVALID",
    retryable: false,
    message: "Trạng thái luật cờ nội bộ không hợp lệ.",
  },
  SETUP_SEED_INVALID: {
    statusCode: 500,
    code: "INTERNAL_ERROR",
    severity: "INVALID",
    retryable: false,
    message: "Hạt giống khởi tạo nội bộ không hợp lệ.",
  },
  RESOURCE_LIMIT_EXCEEDED: {
    statusCode: 413,
    code: "VALIDATION_ERROR",
    severity: "INVALID",
    retryable: false,
    message: "Tài nguyên vượt quá giới hạn hệ thống.",
  },
};

export const ErrorDetailsV2Schema = z
  .object({
    reason: z.string().min(1),
    targetId: z.string().optional(),
    currentVersion: z.number().int().nonnegative().optional(),
    submittedVersion: z.number().int().nonnegative().optional(),
    retryAfterMs: z.number().int().positive().optional(),
    issues: z.array(z.string()).max(16).optional(),
  })
  .catchall(z.unknown());
export type ErrorDetailsV2 = z.infer<typeof ErrorDetailsV2Schema>;

export const ErrorEnvelopeV2Schema = z.object({
  code: PublicErrorCodeV2Schema,
  message: z.string().min(1),
  retryable: z.boolean(),
  severity: ErrorSeverityV2Schema,
  details: ErrorDetailsV2Schema.default({ reason: "UNKNOWN" }),
});
export type ErrorEnvelopeV2 = z.infer<typeof ErrorEnvelopeV2Schema>;

export function createErrorEnvelopeV2(
  reason: ErrorReasonV2,
  overrides?: {
    targetId?: string;
    retryAfterMs?: number;
    currentVersion?: number;
    submittedVersion?: number;
    message?: string;
    issues?: string[];
  }
): { statusCode: number; envelope: ErrorEnvelopeV2 } {
  const entry = ERROR_CATALOG_V2[reason];
  if (!entry) {
    throw new Error(`Unknown error reason: ${reason}`);
  }

  const details: ErrorDetailsV2 = {
    reason,
    targetId: overrides?.targetId,
    retryAfterMs: overrides?.retryAfterMs,
    currentVersion: overrides?.currentVersion,
    submittedVersion: overrides?.submittedVersion,
    issues: overrides?.issues?.slice(0, 16),
  };

  const envelope = ErrorEnvelopeV2Schema.parse({
    code: entry.code,
    message: overrides?.message ?? entry.message,
    retryable: entry.retryable,
    severity: entry.severity,
    details,
  });

  return {
    statusCode: entry.statusCode,
    envelope,
  };
}


