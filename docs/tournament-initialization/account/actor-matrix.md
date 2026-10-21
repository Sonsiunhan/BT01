# Actor Matrix for D00 (Account / Roster / Staff / Support / Onboarding)

| Actor | Page(s) | Action | Read / Write | Permission / Role | Tenant Scope | Preconditions | Server‑Side Enforcement | Expected Result | Forbidden Cases | Audit / Security Requirement |
|-------|---------|--------|--------------|-------------------|--------------|----------------|--------------------------|-----------------|-----------------|------------------------------|
| SYSTEM_ADMIN | P09‑P13, P17‑P18 | Manage all accounts, roster, staff, support requests | Read & Write | system_admin | Global (all tenants) | Authenticated as system admin | Enforced by backend guard middleware | Full CRUD across tenants | Non‑admin cannot perform any write | Log all changes, require admin audit |
| TOURNAMENT_ADMIN | P09‑P13, P17‑P18 | Create/activate accounts, import roster, invite staff, handle support | Read & Write (within own tenant) | tournament_admin | Tenant‑specific | Must belong to tenant, have admin role | Backend checks tenantId matches session tenant | Operations succeed for own tenant only | Cross‑tenant access denied (IDOR) | Audit actions, record tenantId |
| REFEREE | P11, P12, P13, P17 | View assigned staff, accept invitations, resolve support tickets | Read & Write (limited) | referee | Tenant‑specific | Assigned to tournament | Role‑based permission check | Can update invitation status, resolve support | Cannot modify other referee’s assignments | Audit invitation state changes |
| TOURNAMENT_USER (Guest) | P09, P13 | Register / claim account, request support | Write (self) | guest | Tenant‑specific (after claim) | No prior account | Server validates email uniqueness, token flow | Account becomes active | Cannot claim another tenant’s account | Log claim attempts, rate‑limit |
| STAFF | P11, P17 | Accept invitation, perform duties | Write (self) | staff | Tenant‑specific | Invitation valid | Backend validates invitation token and expiry | Staff becomes active | Cannot accept expired/ revoked invitation | Audit acceptance, expiry handling |
| SUPPORT_AGENT | P12 | Review/resolve support requests | Read & Write | support_agent | Tenant‑specific | Must be assigned to tenant support team | Permission check on support queue | Resolve request, update status | Cannot modify unrelated tenant’s requests | Audit status changes, PII handling |

**Notes**:
- Roles are taken directly from BA+SA spec; no new roles introduced.
- All write actions are enforced server‑side; client UI must not rely on hidden fields for permission.
- Audit logs must capture actor ID, tenantId, action, timestamp, and outcome.
