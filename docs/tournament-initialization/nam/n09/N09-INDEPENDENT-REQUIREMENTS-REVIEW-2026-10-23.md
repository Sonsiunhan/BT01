# N09 — Independent requirements review

- Reviewer: Codex requirements reviewer, read-only.
- Verdict: **HOLD — 13/14 (92.9%)**.

## Evidence

- `ManualAdjudicationRequestDto.frozenSnapshot` is `Record<string, unknown>` in `packages/contracts/src/tournament-initialization.ts`.
- GET adjudications returns that raw DTO in `apps/server/src/modules/tournament-core/tournament-core.route.ts`.
- `sanitizeAuditSnapshot` is a denylist sanitizer, not a rendering allowlist.
- GET ACL currently permits global ADMIN and ACTIVE staff, while BA/SA reserves pending exact-tie action/data for owner TA.
- POST verdict already verifies owner TA and deadline/CAS in ledger service.

## P1 gap

R02/R13 lacks a typed projection for the stopped board and exact-tie indicators. BA/SA requires these values but raw arbitrary snapshot cannot be a safe display contract. The requirement gate stays HOLD until the UI-safe snapshot allowlist is chosen, documented, and re-reviewed.
