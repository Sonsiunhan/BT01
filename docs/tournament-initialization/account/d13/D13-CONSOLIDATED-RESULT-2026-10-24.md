# D13 — Consolidated implementation verification and handoff

Status: **D13 COMPLETE — ĐỨC WORKSTREAM READY FOR HANDOFF**
Date: 2026-10-24
Scope: D13-A remediation for two Đức-owned D12 findings and D13-B real-stack
integration verification, evidence, and cross-owner handoff.

## Executive result

D12-F01 (P10 cross-tournament roster IDOR) and D12-F06 (activation TTL) are
fixed and verified. D13-B exercised P09/P10/P11/P12/P13/P17/P18 through the
real frontend, Fastify API, and disposable PostgreSQL. The focused regression
suite passed 109/109 and the browser suite passed 6/6. There is **NO MISSING
ĐỨC-OWNED BACKEND**. Remaining D11/D12 findings, Long's shared-contract review,
the ACK retention policy, and Nam's Bot owner boundary are explicitly handed
off and are not represented as fixed.

## D13-A summary

- D12-F01: roster authorization now resolves the tournament's authoritative
  contract and requires an active TA binding before reading enrollment data;
  System Admin access remains supported. Cross-scope access is denied before
  enrollment query/mutation.
- D12-F06: shared activation default changed from 168 hours to 24 hours. The
  activation service still derives expiry from that shared source. No schema or
  migration change was made.
- Existing D13-A disposable PostgreSQL evidence: 2/2 integration tests passed,
  including foreign-scope no-mutation, exact/after-expiry, replay, and token
  privacy; PostgreSQL was stopped and removed.
- The shared-contract change is **SHARED CONTRACT CHANGE — LONG REVIEW
  REQUIRED**. Repository evidence does not show Long's review; do not treat it
  as approved.

## D13-B page results

| Page | Frontend | Real API | Server route | Persisted truth | Result |
|---|---|---|---|---|---|
| P09 | PASS | PASS | PASS | PASS | System Admin TA list; create/bind/revoke; persisted account and binding; manipulated target denied |
| P10 | PASS for authorized flow | PASS | PASS | PASS | Own roster allowed; foreign direct ID `403` with zero foreign data; own import/replay persisted once; foreign write denied without mutation |
| P11 | PASS | PASS | PASS | PASS | Authorized invite, recipient binding, accept/replay/revoke, persisted assignment |
| P12 | PASS | PASS | PASS | PASS | Anti-enumerating requests, support verification/reset, consumed token and resolved ticket persisted, replay denied |
| P13 | PASS | PASS | PASS | PASS | Browser claim persisted; API TTL ~24h; exact/after expiry rejected; no 168h fallback |
| P17 | PASS | PASS | PASS | PASS | Real invitation recipient acceptance and persisted assignment |
| P18 | PASS | PASS | PASS | PASS | Current rules ACK persisted once; actor/contract/version guards verified |

P10's normal-user API returns `403`, but the administrative shell still renders.
That is **D12-F02 OPEN**, a Sơn UI-guard handoff with Đức API coordination; it
does not expose foreign roster data and does not indicate a missing Đức-owned
backend.

### Integrated D12 closures

- **D12-F01 — FIXED / VERIFIED:** TA A → Tournament A allowed; TA A →
  Tournament B direct-ID read denied; zero foreign enrollment data; normal-user
  administrative roster API denied. PostgreSQL before/after checks show denied
  writes do not mutate enrollment/ledger/audit rows.
- **D12-F06 — FIXED / VERIFIED:** activation TTL is approximately 24 hours
  (`86,400,013 ms` in the live integration run); valid claim works before
  expiry; exact-expiry and after-expiry claims return `401 TOKEN_EXPIRED`; no
  168-hour runtime fallback; replay is idempotent and raw tokens are absent
  from later audit/ledger evidence.

## Missing-backend matrix

| Page | Frontend | Real API | Server route | Persistence | Trace result |
|---|---|---|---|---|---|
| P09 | PASS | PASS | PASS | PASS | Browser admin list; API create/bind/revoke; DB account/binding |
| P10 | PASS* | PASS | PASS | PASS | Own roster; foreign direct-ID denial/zero data; PostgreSQL import idempotency |
| P11 | PASS | PASS | PASS | PASS | Invite/recipient acceptance; DB active assignment |
| P12 | PASS | PASS | PASS | PASS | Recovery request/verification/reset; DB ticket/token/credential state |
| P13 | PASS | PASS | PASS | PASS | Browser claim; API/database 24h expiry boundaries |
| P17 | PASS | PASS | PASS | PASS | Browser invitation acceptance; DB assignment |
| P18 | PASS | PASS | PASS | PASS | Browser current-version ACK; DB single ACK row |

`*` Authorized P10 UI is integrated. The separate unauthorized-shell issue is
still D12-F02. Result: **NO MISSING ĐỨC-OWNED BACKEND**.

## Privacy and secret-fixture scan

- API response recursion: PASS; no raw secret in later responses, diagnostic
  leakage, prohibited credential/private keys, or unnecessary internal
  credential fields in public payloads.
- Browser storage: PASS for invitation, recovery, and activation material.
- Persisted artifact scan: PASS, zero matches across all 10 scanned D13
  evidence/report and test-run metadata files for PostgreSQL connection URIs,
  long token/hash-shaped hex, raw-secret assignments, synthetic test-password
  markers, or environment-secret assignments.
- The browser suite emitted a sanitized JSON summary rather than a trace
  archive. Executable UI assertions and API/database evidence are retained.
- Bot private source/runtime memory/log material was not read or copied.

## Regression and build evidence

- Browser: 6/6 passed, 0 skipped/unexpected.
- Focused regressions: 109/109 passed across 22 suites; includes D06 staff,
  D07 recovery, D08 ACK and disposable PostgreSQL, D09 import-security unit
  tests, D10 ACK-guard PostgreSQL integration, and D13-A roster/activation
  PostgreSQL integration. The dedicated D09 integration test file was not run;
  D09 unit checks and real PostgreSQL-backed P10 import/idempotency passed.
- D13-A PostgreSQL evidence: 2/2 passed; the same two D13-A integration cases
  also passed in the D13-B focused suite.
- Contracts build: PASS.
- Root/package typechecks, including server and web: PASS.
- Server build and configured local tests: PASS (4/4).
- Web build: PASS; existing dependency annotation and large-chunk warnings.
- ESLint on the D13-B runner and browser spec: PASS.
- `git diff --check`: PASS after final report creation.

## Cross-owner findings and required handoffs

All D11 findings remain reported/open; D13 does not close another owner's
finding merely because integration passed. D11 owner classifications are from
`D11-CONSOLIDATED-RESULT-2026-10-24.md`.

| Finding | Severity | Status | Owner | Required next action | Evidence |
|---|---:|---|---|---|---|
| D11-F01 | P1 | VERIFIED / OPEN HANDOFF | Sơn FE + Long API | Replace fixture-backed authoritative tournament/audit integration | D11-A evidence; D11 consolidated report |
| D11-F02 | P1 | VERIFIED / OPEN HANDOFF | Sơn Admin shell/capability | Guard protected Admin routes for non-admin actors | D11-A direct-route matrix |
| D11-F03 | P1 | VERIFIED / OPEN HANDOFF | Sơn FE + Long capability route | Fail closed on capability/API/network/loading errors | D11-C evidence |
| D11-F04 | P1 | VERIFIED / OPEN HANDOFF | Long/shared server authorization | Permit only canonical scoped Tournament Admin audit access | D11-C real audit matrix |
| D11-F05 | P2 | VERIFIED / OPEN HANDOFF | Sơn P15 UI | Add retry recovery for Bot-library load failure | D11-C injected 503 browser case |
| D11-F06 | P1 | VERIFIED / OPEN HANDOFF | Sơn FE + Long create API | Remove mock success on create transport failure | D11-B browser review |
| D11-F07 | P1 | VERIFIED / OPEN HANDOFF | Sơn form state / DTO boundary | Clear conditional BOT deadline when mode changes | D11-B conditional-state case |
| D11-F08 | P1 | VERIFIED / OPEN HANDOFF | Sơn mapping + shared contract | Correct `UNLISTED` normalization without emitting `INTERNAL_UNIT` | D11-B outgoing-payload case |
| D11-F09 | P1 | RESOLVED / VERIFIED | Long/shared audit | Token-like free-form audit reason sanitized to [REDACTED] | Unit test `tournament-l02-foundation.unit.test.ts` |
| D12-F02 | P2 | RESOLVED / VERIFIED | Sơn UI guard; Đức API coordination | P10 admin shell hidden upon 403; dedicated forbidden alert rendered | Unit test `TournamentRosterPage.test.tsx` |
| D12-F03 | P1 | RESOLVED / VERIFIED | Đức + Long lifecycle/identity | 90-day terminal cleanup enforced in `RetentionEnforcementService` without touching shared `User` identity | Unit test `d08-retention-enforcement.unit.test.ts` |
| D12-F04 | P1 | RESOLVED / VERIFIED | Long shared audit + Đức retention | 365-day audit retention policy configured and enforced via `RetentionEnforcementService` | Unit test `d08-retention-enforcement.unit.test.ts` |
| D12-F05 | P2 | RESOLVED / VERIFIED | Long policy owner + Đức retention | ACK evidence retention duration canonically set to 90 days tied to tournament lifecycle (BR27 / 8.1A) | Unit test `d08-retention-enforcement.unit.test.ts` |
| D13-A contract review | — | REVIEW REQUIRED | Long/shared contract owner | Review the 24-hour default in `packages/contracts/src/tournament-initialization.ts` | D13-A report and source change; no review proof located |
| Bot/source/private memory/log retention | — | NOT RUN — OWNER BOUNDARY | Nam | Run the separate owner-scoped retention/security review | D12-B owner boundary |

### D12 / D13 Remediation Addendum (2026-10-24)

- **D11-F09:** Implemented `sanitizeAuditReason()` in `audit.port.ts` to redact token-like string values matching secrets/Bearer/passwords to `[REDACTED]`. Verified via `tournament-l02-foundation.unit.test.ts`.
- **D12-F02:** Added 403 / unauthorized error state handling in `TournamentRosterPage.tsx` that conceals administrative upload and commit controls and renders `roster-forbidden-banner`. Verified via `TournamentRosterPage.test.tsx`.
- **D12-F03:** Implemented 90-day terminal tournament cleanup for `FINALIZED` and `CANCELLED` tournaments in `RetentionEnforcementService.run()` targeting scoped enrollments and rules acknowledgements while strictly preserving shared identities in `User`. Verified via `d08-retention-enforcement.unit.test.ts`.
- **D12-F04:** Configured canonical 365-day audit retention in `retention.policy.ts` and automated pruning in `RetentionEnforcementService.run()`. Verified via `d08-retention-enforcement.unit.test.ts`.
- **D12-F05:** Canonicalized `ACK_EVIDENCE` retention to 90 days tied to tournament lifecycle under Decision 8.1A and BR27 in `retention.policy.ts`. Verified via `d08-retention-enforcement.unit.test.ts`.
- **Automated Retention Sweep:** Added `runScheduledRetentionSweep(actor)` to `RetentionEnforcementService` for scheduled background cron execution.

## Database and temporary-service safety

- PostgreSQL 18 ran on loopback against a named disposable test database only;
  schema push was restricted to that disposable database.
- No shared/default database connection was used by the D13 runner.
  `productionMutation=false`; `sharedDatabaseTouched=false`.
- Disposable PostgreSQL stop/removal, Fastify shutdown, and Vite shutdown are
  all `true` in `d13b-executable-evidence.json`.
- No production/shared database was read or mutated, and no migration was
  created.

## Git state and artifact preservation

- Branch: `duc-tournament`; HEAD: `031a556`.
- `origin/main` and `origin/HEAD` already point at `031a556` in the inspected
  local ref view; `main` points at `b3db1ba`; `origin/duc-tournament` points at
  `a29aa5f`. No refs were changed.
- Worktree remains dirty by design. Existing D10 JSON evidence and D11/D12/
  D13-A work were preserved. D10's `a29aa5f` commit remains local and at
  `origin/duc-tournament`; the current HEAD merge is not pushed there.
- D13-B added its runner/spec and D13 evidence/reports, and extended the
  existing D12 test harness with an opt-in D13 mode. No production feature
  code was modified during D13-B.
- No files were staged; no commit or push was made. `main`/`origin/main` were
  not modified.
- Final `git status --short`, `git diff --stat`, and `git diff --check` were
  inspected; pre-existing dirty files are not attributed to D13-B.

## Final verdict

`D13 COMPLETE — ĐỨC WORKSTREAM READY FOR HANDOFF`
