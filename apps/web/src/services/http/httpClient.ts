import type { ErrorSeverity } from "@ottv2/contracts";

import { env } from "../../config/env";
import { ApiError } from "./apiError";
import { trackUiEvent } from "../telemetry/uiTelemetry";

function dispatchWindowEvent(name: string, detail?: Record<string, unknown>): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}

function shouldNotifySessionExpiry(path: string): boolean {
  return !["/auth/login", "/auth/register", "/auth/recover", "/auth/me"].some((prefix) => path.startsWith(prefix)) && !path.includes("/spectate") && !path.includes("/spectator");
}

function parseApiError(status: number, data: unknown): ApiError {
  const error = data as {
    message?: unknown;
    code?: unknown;
    retryable?: unknown;
    severity?: unknown;
    details?: unknown;
  } | undefined;
  return new ApiError(
    typeof error?.message === "string" ? error.message : "Máy chủ chưa sẵn sàng.",
    status,
    typeof error?.code === "string" ? error.code : "HTTP_ERROR",
    typeof error?.retryable === "boolean" ? error.retryable : false,
    typeof error?.severity === "string" ? (error.severity as ErrorSeverity) : undefined,
    error?.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : undefined
  );
}

export async function getJson(path: string, signal?: AbortSignal, options: { handleUnauthorized?: boolean } = {}): Promise<unknown> {
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-OTT-Request": "1",
      },
      signal,
    });
  } catch {
    dispatchWindowEvent("ottv2:network-state", { state: "OFFLINE" });
    trackUiEvent("http_request", { method: "GET", path, state: "OFFLINE", durationMs: Math.round(performance.now() - startedAt) });
    throw new ApiError("Không thể kết nối tới máy chủ.");
  }
  const state = response.status >= 500 ? "DEGRADED" : response.status === 408 || response.status === 429 ? "RECONNECTING" : "CONNECTED";
  dispatchWindowEvent("ottv2:network-state", { state });
  trackUiEvent("http_request", { method: "GET", path, status: response.status, state, durationMs: Math.round(performance.now() - startedAt) });
  if (!response.ok) {
    let errorData: unknown;
    try { errorData = await response.json(); } catch {}
    const apiError = parseApiError(response.status, errorData);
    if (response.status === 401 && !options.handleUnauthorized && shouldNotifySessionExpiry(path)) {
      if (apiError.severity === undefined || apiError.severity === "FATAL_SESSION") {
        dispatchWindowEvent("ottv2:session-expired");
      }
    }
    throw apiError;
  }
  try { return await response.json(); }
  catch { throw new ApiError("Phản hồi từ máy chủ không hợp lệ.", response.status, "INVALID_JSON"); }
}

export async function requestJson<T = unknown>(
  path: string,
  options: {
    method: "POST" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    commandId?: string;
  }
): Promise<T> {
  const startedAt = performance.now();
  let response: Response;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-OTT-Request": "1",
    ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(options.commandId ? { "X-Command-Id": options.commandId } : {}),
    ...options.headers,
  };
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method,
      credentials: "include",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    dispatchWindowEvent("ottv2:network-state", { state: "OFFLINE" });
    trackUiEvent("http_request", { method: options.method, path, state: "OFFLINE", durationMs: Math.round(performance.now() - startedAt) });
    throw new ApiError("Không thể kết nối tới máy chủ.");
  }
  const state = response.status >= 500 ? "DEGRADED" : response.status === 408 || response.status === 429 ? "RECONNECTING" : "CONNECTED";
  dispatchWindowEvent("ottv2:network-state", { state });
  trackUiEvent("http_request", { method: options.method, path, status: response.status, state, durationMs: Math.round(performance.now() - startedAt) });
  let payload: unknown = undefined;
  if (response.status !== 204) {
    try { payload = await response.json(); }
    catch { if (response.ok) throw new ApiError("Phản hồi từ máy chủ không hợp lệ.", response.status, "INVALID_JSON"); }
  }
  if (!response.ok) {
    const apiError = parseApiError(response.status, payload);
    if (response.status === 401 && shouldNotifySessionExpiry(path)) {
      if (apiError.severity === undefined || apiError.severity === "FATAL_SESSION") {
        dispatchWindowEvent("ottv2:session-expired");
      }
    }
    throw apiError;
  }
  return payload as T;
}
