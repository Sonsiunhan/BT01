import type { ErrorSeverity } from "@ottv2/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code = "NETWORK_ERROR",
    readonly retryable = false,
    readonly severity?: ErrorSeverity,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}
