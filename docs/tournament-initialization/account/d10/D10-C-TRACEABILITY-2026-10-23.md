# D10-C — Acceptance traceability matrix

| D10 requirement | BA/SA reference | Page | Browser scenario | Backend authority / DB assertion | Test/evidence | Result |
|---|---|---|---|---|---|---|
| Real account registration/session persistence | BA/SA §7.5; D02/P09 | P09 | Register four test actors, then log in through the UI with HttpOnly sessions | `/auth/*`; persisted `User` rows and server role checks | runner + P09 Playwright | PASS |
| SYSTEM_ADMIN authority | P09 wireframe; BR-01/03/04 | P09 | Admin loads the TA table | `/api/admin/ta`; `User.role`, TA binding | P09 Playwright | PASS |
| Roster preview and commit | T031–T036; BR-13/14/25/33–36 | P10 | CSV upload, valid preview, commit and reload | roster routes; one imported `TournamentEnrollmentRecord` | P10 Playwright + DB assertion | PASS |
| Duplicate/double commit safety | T035–T037; BR-33–36 | P10 | Forced second commit submit | D09 ledger digest and unique roster identity; one `ROSTER_IMPORT_COMMIT` | P10 Playwright + DB assertion | PASS |
| Activation claim and credential setup | T038; BR-01/03/04/41/42 | P10/P13 | Issue handoff, claim identity, set password | activation service; one claim (`CLAIMED`) and one credential (`ACTIVE`) ledger | P10/P13 Playwright + DB assertion | PASS |
| Activation replay | T038; BR-33–36/41–42 | P13 | Replay the same claim token in a second page | claim ledger/idempotent enrollment state | P13 Playwright + DB assertion | PASS |
| Token/password privacy | T038–T040; BR-25/41/42 | P13/P17/P12 | Inspect storage and rendered flows after sensitive mutations | HttpOnly session only; no raw token/password/hash in storage/evidence | Playwright storage/privacy checks | PASS |
| Scoped staff invitation | T038; BR-01/03/04 | P11 | TA creates a tournament-scoped referee invitation | staff invitation and assignment rows | P11 Playwright | PASS |
| Invitation acceptance and revoke | T038–T039; BR-33–36/41–42 | P17/P11 | Referee accepts in isolated context; TA revokes | assignment final status `REVOKED`; audit row | P17/P11 Playwright + DB assertion | PASS |
| Recovery/support authority | T039; BR-01/03/04/41/42 | P12 | Public request, admin ownership, verification, reset handoff | `SupportRecoveryTicket` `RESOLVED`; credential update/audit | P12 Playwright + DB assertion | PASS |
| Recovery one-time/privacy boundary | T039; BR-25/33–36/41–42 | P12 | Use reset handoff and inspect storage | conditional token consumption; no raw token/password persisted | P12 Playwright storage + DB | PASS |
| Current regulation acknowledgement | T040; D08 BA/SA F63/F66, §7.5/§12/§15, BR-27 | P18 | Participant reads version `1` and acknowledges it | exact actor/tournament/contract/config-version ACK row | P18 Playwright + DB assertion | PASS |
| Stale ACK cannot satisfy newer version | T040; D08 BA/SA F63/F66, §7.5/§12/§15, BR-27 | P18/lifecycle | Browser uses only server-returned current version; stale-version gate is covered by D10-A/B | ACK guard and lifecycle transaction reject stale version | D10-A/B focused PostgreSQL evidence | PASS |
| Negative authorization | BA/SA actor matrix; BR-01/03/04 | P09–P18 | Participant navigates directly to TA roster | server session role/scope guard; no TA page | negative Playwright scenario | PASS |
| Browser diagnostics | BR-41/42 | all | Capture console/page/request failures | no unexpected diagnostics; expected `/auth/me` 401 bootstrap documented | Playwright watcher | PASS |
| Disposable DB isolation | D10 G0 gate; BA/SA §7.5 | all | Run with random localhost PostgreSQL cluster | caller DB variables removed; cluster stopped | `d10c-browser-evidence.json` | PASS |
| D10-A regression | D10-A result/matrix; T031–T040 | all | Focused guard + PostgreSQL runner | existing cross-stream/ACK evidence retained | D10-A tests/runner | PASS (prior + rerun) |
| D10-B regression | D10-B race matrix; T035–T040 | all | Focused lifecycle + PostgreSQL runner | transaction/race/rollback evidence retained | D10-B tests/runner | PASS (prior + rerun) |
| Production/shared DB safety | AGENTS.md / D10 G0 | all | Verify isolation flags and stopped cluster | production/shared mutation flags false | runner JSON | PASS |

## Canonical flow map

`P09 SYSTEM_ADMIN → P10 TA roster preview/commit → P13 claim/credential → P11 invite → P17 referee accept → P11 revoke → P12 support/recovery → P18 current ACK → negative participant authorization`

The browser suite uses server responses as authority after every mutation. It does not seed the roster/staff/ACK result rows that it later asserts; the runner only creates the base tournament contract/configuration and the initial eligible participant fixture. Raw handoff tokens are held in test memory long enough to follow the intended out-of-band link and are not written to evidence.

## Evidence files

- `d10c-browser-evidence.json`
- `D10-C-RESULT-2026-10-23.md`
- `D10-C-TRACEABILITY-2026-10-23.md`

The generated JSON contains only localhost ports, an ephemeral database directory/name, boolean isolation flags, and aggregate pass/fail state. It contains no account password, activation token, reset token, credential hash, private Python source, or diagnostic payload.
