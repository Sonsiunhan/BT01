// Type augmentation for AuthService user data
// Adds optional tenantId and roles fields used by tenant guard.
// The underlying Prisma User model does not have these fields, so
// authentication logic must populate them (e.g., via a join on
// tenant/role tables). This is a SPEC GAP that must be addressed in
// production, but for D01 we augment the type locally.

declare module "./auth.service.js" {
  interface UserWithData {
    /** Tenant identifier the user belongs to */
    tenantId?: string;
    /** Array of role identifiers (e.g., ADMIN, PLAYER, etc.) */
    roles?: string[];
  }
}
