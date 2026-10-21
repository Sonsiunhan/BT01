# Synthetic Fixture Specification – D00

> **Purpose** – Provide safe, deterministic test data for downstream tasks **D01–D10**.  
> All identifiers are synthetic; no real passwords, tokens, API keys, or personal data are included.

---

## 1. Identity / Account Fixtures

| Fixture ID | Actor / Role | tenantId | userId / systemId | email (synthetic) | notes |
|------------|--------------|----------|-------------------|-------------------|-------|
| FIX‑SYS‑ADMIN | SYSTEM_ADMIN | `tenant‑sys‑001` | `sys‑admin‑001` | `admin+sys001@example.com` | Full‑admin, global scope. |
| FIX‑TOUR‑ADMIN | TOURNAMENT_ADMIN | `tenant‑t01` | `admin‑t01‑001` | `admin+t01@example.com` | Admin of tenant **t01**. |
| FIX‑REFEREE | REFEREE | `tenant‑t01` | `referee‑t01‑001` | `referee+t01@example.com` | Can view assigned staff, accept invitations. |
| FIX‑GUEST | TOURNAMENT_USER (Guest) | `tenant‑t01` | `guest‑t01‑001` | `guest+t01@example.com` | Unclaimed account state. |
| FIX‑STAFF | STAFF | `tenant‑t01` | `staff‑t01‑001` | `staff+t01@example.com` | Invited staff member. |
| FIX‑SUPPORT | SUPPORT_AGENT | `tenant‑t01` | `support‑t01‑001` | `support+t01@example.com` | Member of tenant‑scoped support queue. |

*All passwords, activation tokens, and secret keys are **omitted** – they will be generated at runtime by the implementation.*

---

## 2. Roster Import Fixtures

> **Duplicate‑row handling** – **validation error list**, user must correct before committing.  
> **Same name ≠ same identity** – equality is based on `personKey`, not display name.

| Row | Description | tenantId | personKey | displayName | email | metadata | Expected validation result |
|-----|-------------|----------|-----------|-------------|-------|----------|----------------------------|
| 1 | **Valid row** | `t01` | `P001` | `Alice Nguyen` | `alice+001@example.com` | `{}` | ✅ Pass |
| 2 | **Duplicate row (same personKey)** | `t01` | `P001` | `Alice N.` | `alice+dup@example.com` | `{}` | ❌ Duplicate `personKey` – error `DUPLICATE_PERSON_KEY` |
| 3 | **Invalid identifier (malformed personKey)** | `t01` | `!@#` | `Bob` | `bob@example.com` | `{}` | ❌ Invalid format – error `INVALID_PERSON_KEY` |
| 4 | **Unknown identifier (personKey not in system, allowed for new enrollments)** | `t01` | `NEW001` | `Charlie` | `charlie@example.com` | `{}` | ✅ Pass (treated as new) |
| 5 | **Unicode / normalization edge case** | `t01` | `P005` | `Đỗ Thị Linh` | `linh@example.com` | `{}` | ✅ Pass (Unicode supported) |
| 6 | **Leading‑zero identifier** | `t01` | `00123` | `Dương` | `duong@example.com` | `{}` | ✅ Pass (treated as string) |
| 7 | **Existing `personKey` from another tenant** | `t02` | `P001` | `Eve` | `eve+t02@example.com` | `{}` | ✅ Pass – tenant isolation enforced |
| 8 | **Same name, different `personKey`** | `t01` | `P008` | `Alice Nguyen` | `alice+dupkey@example.com` | `{}` | ✅ Pass – name collision does not imply identity collision |
| 9 | **Cross‑tenant duplicate `personKey`** | `t02` | `P001` | `Frank` | `frank+t02@example.com` | `{}` | ✅ Pass – isolated by tenant |
|10 | **Capacity‑limit scenario (row 101 exceeds limit of 100 per batch)** | `t01` | `P101` | `Grace` | `grace@example.com` | `{}` | ❌ Exceeds batch capacity – error `BATCH_CAPACITY_EXCEEDED` |

*All rows are **synthetic**; email domains are dummy (`example.com`). No real credentials are stored.*

---

## 3. Activation / Onboarding Fixtures

| Fixture ID | tenantId | userId | activationToken (placeholder) | expiry (ISO‑8601) | status | notes |
|------------|----------|--------|------------------------------|-------------------|--------|-------|
| ACT‑VALID | `t01` | `guest‑t01‑001` | `<SYNTHETIC_ACTIVATION_SECRET>` | `2026-12-01T12:00:00Z` | `UNCLAIMED` | Normal activation flow. |
| ACT‑EXPIRED | `t01` | `guest‑t01‑002` | `<SYNTHETIC_ACTIVATION_SECRET>` | `2025-12-01T12:00:00Z` | `EXPIRED` | Should be rejected as expired. |
| ACT‑CLAIMED | `t01` | `guest‑t01‑003` | `<SYNTHETIC_ACTIVATION_SECRET>` | `2026-12-01T12:00:00Z` | `CLAIMED` | Token already consumed – reject. |
| ACT‑REVOKED | `t01` | `guest‑t01‑004` | `<SYNTHETIC_ACTIVATION_SECRET>` | `2026-12-01T12:00:00Z` | `REVOKED` | Revoked by admin – reject. |
| ACT‑WRONG‑PURPOSE | `t01` | `guest‑t01‑005` | `<SYNTHETIC_PASSWORD_RESET>` | `2026-12-01T12:00:00Z` | `UNCLAIMED` | Token purpose mismatch – reject. |
| ACT‑WRONG‑OWNER | `t02` | `guest‑t02‑001` | `<SYNTHETIC_ACTIVATION_SECRET>` | `2026-12-01T12:00:00Z` | `UNCLAIMED` | Token presented to tenant `t01` – reject. |
| ACT‑CONCURRENT‑CLAIM‑1 | `t01` | `guest‑t01‑006` | `<SYNTHETIC_ACTIVATION_SECRET>` | `2026-12-01T12:00:00Z` | `UNCLAIMED` | Simulate two concurrent claim attempts – only first succeeds. |
| ACT‑CONCURRENT‑CLAIM‑2 | `t01` | `guest‑t01‑006` | `<SYNTHETIC_ACTIVATION_SECRET>` | `2026-12-01T12:00:00Z` | `UNCLAIMED` | Same as above, second attempt should be rejected as already claimed. |

*Tokens are never real values; placeholder tags (`<SYNTHETIC_…>`) indicate where runtime code will generate a secure token.*

---

## 4. Staff / Support Fixtures

| Fixture ID | Type | tenantId | actorId | status / outcome | notes |
|------------|------|----------|---------|------------------|-------|
| STAFF‑VALID | StaffInvitation | `t01` | `staff‑t01‑001` | `PENDING` | Invitation sent, not yet accepted. |
| STAFF‑EXPIRED | StaffInvitation | `t01` | `staff‑t01‑002` | `EXPIRED` | Expiry passed – cannot accept. |
| STAFF‑REVOKED | StaffInvitation | `t01` | `staff‑t01‑003` | `REVOKED` | Admin revoked – reject acceptance. |
| STAFF‑ACCEPTED | StaffInvitation | `t01` | `staff‑t01‑004` | `ACCEPTED` | Invitation accepted – staff active. |
| SUPPORT‑OPEN | SupportRequest | `t01` | `guest‑t01‑001` | `OPEN` | New request awaiting assignment. |
| SUPPORT‑RESOLVED | SupportRequest | `t01` | `guest‑t01‑001` | `RESOLVED` | Resolved with notes. |
| SUPPORT‑ESCALATED | SupportRequest | `t01` | `guest‑t01‑001` | `ESCALATED` | Escalated to senior agent. |
| SUPPORT‑REJECTED | SupportRequest | `t01` | `guest‑t01‑001` | `CLOSED` | Closed without resolution (e.g., spam). |
| RECOVERY‑REQ | SupportRequest (recovery) | `t01` | `guest‑t01‑002` | `OPEN` | Password‑reset style request – must not expose password. |

*All fixtures use synthetic identifiers; no real emails or secrets are stored.*

---

## 5. SPEC GAPs documented in this spec

| GAP‑ID | Description |
|--------|-------------|
| GAP‑02 | Exact numeric default for activation‑token TTL (configurable, no hard‑coded value). |
| GAP‑XX | Any future addition of fields to DTOs not covered by the BA+SA spec – to be revisited when the specification is updated. |

*All other design decisions are fully covered by the BA+SA specification and the confirmed D00 decisions.*  

---

### End of Fixture Specification
