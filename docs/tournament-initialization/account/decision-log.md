# Decision Log – D00 Design

## Open Questions / SPEC GAPS

| ID | Topic | Description | Status |
|----|-------|-------------|--------|
| GAP-01 | Support Request DTO fields | The BA+SA spec lists a Support Request entity but does not explicitly enumerate required fields. Clarified with the team that the minimal required fields are `requestId, tenantId, userId, description, status, createdAt, resolvedAt, notes`. | Resolved (confirmed) |
| GAP-02 | Activation token TTL | Spec mentions retention of activation tokens but does not define a numeric TTL. The design must make the TTL **configurable**; the exact default value is a SPEC GAP. | Pending (configurable) |
| GAP-03 | Naming of contracts module | Decided to use the `account` namespace under `packages/contracts/src/account`. | Resolved (account namespace) |
| GAP-04 | Support request enum values | Proposed enum values (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `ESCALATED`, `CLOSED`). | Resolved (proposed) |
| GAP-05 | Roster import duplicate handling | Duplicate rows in import must produce a validation error list requiring user correction. | Resolved (error list) |
| GAP-06 | Tenant ID & Roles in User model | Prisma `User` model lacks `tenantId` and `roles` fields required by the tenant guard. Guard assumes these are provided by authentication service; this is a SPEC GAP to be addressed in future schema updates. | Open |

## Decisions Made

- **Namespace**: `account` under `packages/contracts/src` for all D00 DTOs.
- **DTO field definitions**: Implemented as per confirmed fields; timestamps use ISO‑8601 strings.
- **Activation token**: Designed as a configurable expiry (no hard‑coded numeric TTL). Security properties enforced (single‑use, revocation, no secret leakage).
- **Wireframes**: Completed for pages P09, P10, P11, P12, P13, P17. (P18 pending – not required for D00 scope).
- **Actor matrix**: Included all actors, permissions, tenant scope, server‑side enforcement, and audit requirements.
- **Synthetic fixtures**: Specification prepared in a separate artifact.
- **Hand‑off**: Documented for Long with contract list and assumptions.

**Next Steps**
- Review the configurable activation‑token settings in the project's config module.
- Implement synthetic fixtures according to the spec.
- Deliver hand‑off document to Long.
