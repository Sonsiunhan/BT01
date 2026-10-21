# Hand‑off Document for Long – D00 Foundations (Account / Roster / Staff / Support / Onboarding)

**Audience:** Long (core backend owner).  
**Scope:** Summarize the design artifacts created in D00, specify contract locations, define boundaries, and list security/privacy requirements that must be respected when implementing the actual backend logic.

---

## 1. Contract location

All D00 contract definitions are placed under:

```
packages/contracts/src/account/d00.dto.ts
```

### DTO / Interface overview

| DTO | Primary purpose | Key fields (excerpt) |
|-----|----------------|----------------------|
| **AccountOnboardingDTO** | Bootstrap & claim flow (pages P09, P13). | `tenantId`, `userId`, `email`, `initialState`, optional `activationToken`, `activationExpiresAt`. |
| **RosterImportRowDTO** | One row from CSV/XLSX import (page P10). | `sourceRowId`, `personKey`, `displayName`, optional `email`, `metadata`, `errors`. |
| **StaffInvitationDTO** | Invitation lifecycle (pages P11, P17). | `invitationId`, `tenantId`, `staffEmail`, `role`, `expiresAt`, `token`, `status`, optional `notes`. |
| **SupportRequestDTO** | Support / recovery request flow (page P12). | `requestId`, `tenantId`, `userId`, `description`, `status`, `createdAt`, optional `resolvedAt`, `notes`. |

*All fields are **synthetic** in the fixture spec and must be stored/validated securely in production.*

---

## 2. Account / Identity Boundary

- **Identity fields** – `tenantId`, `userId`, `email`.
- **Tenant / scope binding** – Every account operation must verify that the `tenantId` of the request matches the session tenant; no cross‑tenant access is allowed.
- **Actor / role information** – Roles are defined in the BA+SA spec (SYSTEM_ADMIN, TOURNAMENT_ADMIN, REFEREE, STAFF, SUPPORT_AGENT, TOURNAMENT_USER). No new roles may be introduced.
- **Server‑side authority** – The backend is the sole source of truth for role assignment, permissions, and tenant isolation. UI‑only checks are insufficient.
- **Public registration** – Must **never** allow a self‑service registration to acquire ADMIN or TOURNAMENT_ADMIN privileges.
- **Credential ownership** – Passwords, activation secrets, and any credential material are owned exclusively by the server. They must never be sent back to the client after creation.

---

## 3. Roster Import Boundary (P10)

- **Preview vs. Commit** – The import UI must present a *preview* of parsed rows with validation results before any data is persisted.
- **Staging vs. Committed data** – Parsed rows reside in a temporary staging area (idempotency key) until the user explicitly clicks *Commit*. Only then are rows written to the permanent roster store.
- **Row‑level validation** – All validation (format, required fields, `personKey` uniqueness, tenant scope) happens during preview. Errors are returned per‑row.
- **Duplicate handling** – **Validation error list**; user must correct duplicate rows before committing. No automatic merging.
- **`personKey` reuse** – If a `personKey` already exists **within the same tenant**, the import must **reject** the row (duplicate) unless the spec explicitly permits linking to an existing identity (which it does not for this flow).
- **Cross‑tenant identifiers** – Identical `personKey` values in different tenants are allowed; tenant isolation is enforced.
- **Capacity limits** – Import batches may have a configurable maximum (e.g., 100 rows). Exceeding the limit must raise `BATCH_CAPACITY_EXCEEDED`.

---

## 4. Activation / Onboarding Boundary (P09 & P13)

- **Configurable TTL** – The activation token expiry is **configurable** via the project’s configuration module (e.g., `config.activationTokenTtl`). No hard‑coded numeric default should be assumed. The exact numeric value remains a **SPEC GAP**.
- **Expiry** – Tokens carry an absolute `activationExpiresAt` timestamp; backend must reject any claim after this point.
- **Single‑use** – Tokens are marked as `consumed` on first successful claim; any subsequent use must be rejected.
- **Claim / Revocation states** – Tokens may be in states `UNCLAIMED`, `CLAIMED`, `REVOKED`, `EXPIRED`. State transitions must be atomic and auditable.
- **Owner binding** – Token payload must contain the intended `tenantId` and `userId`; mismatched owners cause immediate rejection.
- **No secret leakage** – Activation tokens must never be logged, returned in API responses (except the initial email link), or included in fixture data. Use placeholder `<SYNTHETIC_ACTIVATION_SECRET>` in fixtures only.

---

## 5. Staff / Referee / Support Boundary (P11, P12, P17)

### Staff Invitation Lifecycle
1. **Create** – Only a `TOURNAMENT_ADMIN` may create an invitation (`status = PENDING`).
2. **Token generation** – Single‑use, time‑bound token stored hashed on the server; never exposed.
3. **Expiration / Revocation** – Configurable expiry; admin may revoke (`status = REVOKED`).
4. **Accept / Decline** – Invitee clicks link, token validated server‑side, then can `ACCEPT` (becomes active staff) or `DECLINE`.
5. **Audit** – All state changes (`PENDING → ACCEPTED/DECLINED/EXPIRED/REVOKED`) must be logged with actor, tenant, and timestamp.

### Support / Recovery Flow
- **Creation** – Any authenticated user (`TOURNAMENT_USER` or higher) may open a support request.
- **Tenant isolation** – Requests are scoped to the creator’s tenant; other tenants cannot view them.
- **Agent assignment** – Only `SUPPORT_AGENT` for the same tenant may view/modify the request.
- **Status lifecycle** – `OPEN → IN_PROGRESS → RESOLVED/ESCALATED → CLOSED`.
- **PII handling** – Request `description` may contain user‑provided data; it must be stored encrypted at rest and never echoed back in logs or error messages.
- **Rate limiting & anti‑enumeration** – Public endpoints that accept a user identifier (e.g., password‑reset) must impose rate limits and generic error messages to avoid account enumeration.

---

## 6. Security Requirements

| Requirement | Description |
|-------------|-------------|
| **Server authority** | All permission checks, role assignments, and tenant scope enforcement must be performed server‑side. |
| **No secret exposure** | Activation tokens, password reset tokens, API keys, or any credential must never appear in logs, audit payloads, API responses, or fixture files. |
| **Audit logging** | Every state‑changing operation (account claim, staff invitation status change, support request status update) must emit an audit record containing actor ID, tenant ID, action, timestamp, and outcome. |
| **IDOR prevention** | Resource identifiers (`requestId`, `invitationId`, etc.) must be validated against the requesting tenant; cross‑tenant access must be denied with a generic error. |
| **Rate limiting** | Endpoints that can be abused for enumeration (login, password reset, support request lookup) must have rate limiting and generic error messages. |
| **Data minimisation** | Store only the fields required by the DTOs; optional fields should be omitted unless needed. |
| **Encryption at rest** | Sensitive fields (`token`, `activationToken`, any PII) must be encrypted at rest per repository security guidelines. |
| **Configurable defaults** | Any time‑based defaults (e.g., activation TTL) must be driven by configuration, not hard‑coded values. |

---

## 7. Ownership Boundary

> **D00** defines **contracts, wireframes, actor matrix, and fixture specifications only**.  
> It **does not** implement any backend behavior (e.g., actual token generation, DB migrations, API handlers). 

Long’s implementation should **consume** these contracts and adhere to the design boundaries, but must not assume that D00 has already built runtime logic. All downstream tasks (D01‑D10) will flesh out the actual behavior respecting the constraints listed above.

---

## 8. Open SPEC GAPs (as of finalization)

| GAP‑ID | Description |
|--------|-------------|
| GAP‑02 | Exact numeric default for activation‑token TTL (configurable; no hard‑coded value). |
| GAP‑XX | Potential future fields for `SupportRequestDTO` or `StaffInvitationDTO` not covered by current spec – revisit when spec is updated. |

---

## 9. Next Steps for Long

1. **Import `d00.dto.ts`** into the shared contracts package.
2. **Create configuration entry** for activation‑token TTL (e.g., `config.activationTokenTtl = 'configurable'`).
3. **Implement validation logic** for roster import according to the error‑only duplicate handling.
4. **Build server‑side token handling** (hashing, single‑use enforcement, expiry checks).
5. **Add audit logging** for all state transitions mentioned above.
6. **Write unit / integration tests** using the synthetic fixtures defined in `fixtures/spec.md`.

---

*All listed artifacts are present, consistent with the confirmed decisions (namespace `account`, configurable TTL, duplicate‑row validation), and contain **no real secrets or PII**. The README now accurately references the fixture and hand‑off files.*

---

**End of hand‑off document**.
