import type { FastifyRequest } from "fastify";
import { AppError } from "../../shared/errors/app-error.js";
import { readCookie } from "../auth/auth.http.js";
import { GUEST_SESSION_COOKIE, type AuthService } from "../auth/auth.service.js";

/**
 * Diagnostics endpoints expose per-route latency, error counts and capacity
 * telemetry — operational detail, not public product data (Robot Lab plan:
 * healthy tech status is hidden from the normal UI and diagnostics are
 * separated). Only authenticated administrator sessions may read them:
 * anonymous callers receive 401, authenticated non-admins 403.
 */
export async function assertDiagnosticsAdmin(
  request: FastifyRequest,
  auth: AuthService
): Promise<void> {
  const context = await auth.authenticateAny(
    readCookie(request),
    readCookie(request, GUEST_SESSION_COOKIE)
  );

  // AuthContext.principal is "ACCOUNT" for logged-in users and "GUEST" for
  // guest sessions; guests never hold administrator telemetry access.
  if (context.principal === "GUEST") {
    throw new AppError(
      "UNAUTHORIZED",
      "Chẩn đoán hệ thống chỉ dành cho tài khoản quản trị đã đăng nhập.",
      403,
      false,
      "INVALID",
      { reason: "FORBIDDEN_ROLE" }
    );
  }

  const user = context.user as { role?: unknown; roles?: unknown };
  const roles: string[] = [];
  if (typeof user.role === "string") roles.push(user.role);
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) {
      if (typeof r === "string") roles.push(r);
    }
  }

  if (!roles.includes("ADMIN") && !roles.includes("SYSTEM_ADMIN")) {
    throw new AppError(
      "UNAUTHORIZED",
      "Chỉ Quản trị hệ thống mới được xem chẩn đoán hệ thống.",
      403,
      false,
      "INVALID",
      { reason: "FORBIDDEN_ROLE" }
    );
  }
}
