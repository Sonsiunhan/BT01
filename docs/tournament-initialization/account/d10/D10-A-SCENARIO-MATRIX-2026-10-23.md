# D10-A scenario matrix — cross-stream integration foundation

| Canonical scenario | Existing authority / integration point | D10-A test | Gap or follow-up |
|---|---|---|---|
| T031–T036 import, identity reuse, scope and retry safety | `RosterService.commitRosterImport` and the D09 command ledger | Real PostgreSQL fixture commits one canonical row and asserts one enrollment | D10-B adds concurrent cross-stream retries and post-preview TOCTOU pressure |
| T037–T038 activation claim | `ActivationService.issueActivationToken` / `claimActivation` | Real PostgreSQL fixture issues and claims a token; audit is checked for token absence | D10-B adds claim/reissue race and rollback fault injection |
| Referee acceptance/readiness | `TournamentStaffService` and `PrismaReadinessSourcesAdapter` | Invitation is accepted, readiness is `1`; after revoke readiness is `0` | D10-B adds concurrent accept/revoke proof and lifecycle composition stress |
| Current-version ACK before lifecycle start | `TournamentAcknowledgementService.assertAcknowledged` consumed by `PrismaTournamentAcknowledgementGuard` | Missing ACK blocks; exact current ACK passes; stale version blocks | D10-B proves cross-store transition failure/race behavior |
| Server actor and scope authority | `resolveTournamentRequestActor`, roster/staff/ACK scope checks | Fixture uses owner/recipient scopes and exact tournament/contract IDs | D10-C covers browser actor/error presentation |
| Audit/privacy under the integrated flow | D05/D06/D08 audit writes and sanitizing snapshots | Raw activation token and password text are absent from audit evidence | D10-B expands rollback/audit atomicity checks |

The matrix is intentionally limited to canonical D10 pages P09, P10, P11, P12, P13, P17 and P18 and the directly relevant T031–T040 scenarios. It does not claim the browser acceptance slice or overall D10 completion.
