# N09 — Implementation plan (approved requirements gate)

## Outcome

Deliver P05 exact-tie adjudication as a real server-backed component for the owner TA: list waiting/terminal requests, render the typed safe snapshot projection, submit one winner + reason, and surface deadline/cancel/CAS outcomes. The component remains route-neutral for Sơn's S10 integration.

## Ownership and boundaries

- Nam owns `packages/contracts/src/tournament-initialization.ts`, the adjudication projection/ACL seam in tournament-core, the P05 API client/component, focused tests and evidence.
- Long's ledger remains authoritative for fallback, deadline, CAS, cancel ordering and ledger settlement. No rewrite.
- Sơn owns `apps/web/src/app/routes.ts` and `apps/web/src/app/router.tsx`; N09 exports a stable component and integration contract, but does not edit these shared files.
- No production/shared DB mutation, push, deploy, player Python, or public replay work.

## Harness first

1. Add a failing server regression for non-owner ADMIN/active staff GET denial and raw `frozenSnapshot` absence.
2. Add a failing contract projection fixture containing board/indicators plus forbidden Bot source/memory/log fields; assert only the allowlist survives.
3. Add a component harness for loading, empty, forbidden, waiting, terminal, deadline conflict and cancelled states.

## Implementation

1. Add typed `ManualAdjudicationViewDto` and safe snapshot schemas to `@ottv2/contracts`; response is `{ adjudications: ManualAdjudicationViewDto[] }`.
2. Project on the server from the canonical request, validating/normalizing the allowlist. Never pass raw `Record<string, unknown>` to the route response.
3. Replace GET's operational-staff check with owner-TA-only authorization; preserve POST's existing owner-TA/deadline/CAS guard.
4. Add a route-neutral `ManualAdjudicationPage` and typed API adapter. It must use server state, render board/side-to-move/BLUE+RED indicators safely, keep unsent reason on recoverable submit errors, and disable terminal forms.
5. Export documented props/route handoff for S10; do not register the shared route in N09.

## Verification

- Server focused tests: owner TA 200, ADMIN/Referee/staff/player/Guest 403; projection strips forbidden keys; expired request is fallback/readonly; duplicate/late verdict cannot double-settle.
- Web focused tests: all state branches, validation 3–1000, retry/focus, keyboard labels, responsive structure and no raw private fields.
- Run contract/server/web typecheck and focused test suites; run build/lint proportionately. Browser route smoke is **NOT RUN** until S10 registers the route.

## DONE gate

N09 is DONE only when all 14 requirements have evidence, server ACL/projection tests pass, component tests/typecheck pass, no P0/P1 findings remain, and the S10 handoff explicitly records browser integration as pending rather than claiming it passed.
