// Tenant and Role Guard for OTTv2
// Implements the authorization boundary required by D01 (P09).
// Reuses canonical contracts from L01 (AuthContext, AuthPrincipal) and
// TournamentRoleSchema from contracts.

import { AppError } from "../../shared/errors/app-error.js";
import type { AuthContext } from "./auth.service.js";
import { TournamentRoleSchema } from "@ottv2/contracts";

// Extend the AuthContext user with tenantId and roles via module augmentation.
// The actual User model does not contain these fields yet – this is a SPEC GAP.
// Consumers must ensure these fields are populated in the authentication service.

export function enforceAccess(
  context: AuthContext,
  requiredRoles: (typeof TournamentRoleSchema.enum)[keyof typeof TournamentRoleSchema.enum][],
  expectedTenantId: string,
): void {
  // 1. Trusted principal
  if (context.principal !== "ACCOUNT") {
    throw new AppError(
      "UNAUTHORIZED",
      "Principal not authenticated as ACCOUNT",
      401,
      false,
      "FATAL_SESSION",
    );
  }

  // 2. Tenant binding – expect user object to have tenantId (SPEC GAP if missing)
  const userTenantId = (context.user as any).tenantId as string | undefined;
  if (!userTenantId) {
    throw new AppError(
      "UNAUTHORIZED",
      "Tenant information missing in user context",
      403,
      false,
      "INVALID",
    );
  }
  if (userTenantId !== expectedTenantId) {
    throw new AppError(
      "UNAUTHORIZED",
      "Cross‑tenant access denied",
      403,
      false,
      "INVALID",
    );
  }

  // 3. Role / permission check – expect user.roles array
  const userRoles: string[] = ((context.user as any).roles as string[]) ?? [];
  const missing = requiredRoles.filter((r) => !userRoles.includes(r));
  if (missing.length > 0) {
    throw new AppError(
      "UNAUTHORIZED",
      `Insufficient role(s): ${missing.join(", ")}`,
      403,
      false,
      "INVALID",
    );
  }

  // If all checks pass, simply return (allow).
}
