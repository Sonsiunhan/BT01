# N08 implementation report

## Delivered

- Added canonical public readiness contract in `packages/contracts/src/bot-readiness.ts` and exported it from the package.
- Added server owned `BotReadinessService` with owner authorization, enrollment CAS, idempotency payload binding, stale/withdrawn/expired guards, safe receipts, bounded list filtering/cursors, job lookup and Offline proof execution.
- Added endpoints for selection, recheck jobs, readiness list and Offline Human–Python / Bot–Bot proofs.
- Removed the fake `READY` default for `BOT_VS_BOT`; a new enrollment starts as legacy `MISSING`, which maps to public `NOT_SUBMITTED`.
- Added the P16 admin status page with semantic filtering, focus/live-region feedback, empty/error states and a link from tournament detail.
- Added bounded cursor pagination, scoped job polling and a forbidden transition that clears the active job and moves focus to a safe heading.
- Added a real HTTP composition test, a real pinned Wasmtime/CPython-WASI proof, and responsive/a11y browser coverage for the P16 route.
- Added fail-closed profile binding: a composed engine profile is used when present; an unsupported tournament rule version becomes a retryable infrastructure blocker instead of silently running the canonical profile.

## Evidence

- Requirements review: 18/18 acceptance items, 100% coverage, 0 P0/P1 gaps. Hash is recorded in `N08-INDEPENDENT-REQUIREMENTS-REVIEW-2026-10-22.md`.
- Contract/unit suites: 12 tests passed across `n08-bot-readiness.contract.test.ts` and `n08-bot-readiness.unit.test.ts`.
- Server HTTP boundary: 2 integration tests passed, including ACL, invalid query validation, pagination, TA recheck and job polling.
- Web component suite: 4 tests passed, including scope cache purge, human-mode N/A and forbidden focus.
- Real runtime proof: 1 integration test passed using the pinned Wasmtime + CPython-WASI artifacts in `D:\BT01\.worktrees\w1-runtime-artifacts`; Human–Python and Bot–Bot accepted turns returned N06 receipt IDs. Artifact SHA-256 values were checked before execution.
- Browser gate: 3 Playwright tests passed at 375/768/1440px, with no document horizontal overflow and no serious/critical axe violations; recheck polling and forbidden focus were exercised against a live Vite page.
- Static gates: contracts, game-rules and bot-sdk package builds; server typecheck/build; web typecheck/lint/build all passed. Prisma client was generated from `prisma/schema.prisma` before the server gate.

## Scope boundary

The tournament composition currently exposes the canonical `rps-v1` engine profile. If a future tournament publishes a different `rulesVersion` without supplying the normalized engine profile, N08 returns `BLOCKED_INFRA` and never runs the canonical setup against the wrong target. Wiring persistence of a future custom engine profile remains an upstream composition change; it is intentionally fail-closed here.

N08 is **DONE for the approved P16 scope and currently composed engine profile**, with all implementation, runtime, browser, typecheck, lint and build evidence above.
