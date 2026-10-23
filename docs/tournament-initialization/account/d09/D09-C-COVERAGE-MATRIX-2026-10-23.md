# D09-C frontend/security coverage matrix

Ngày kiểm tra: 2026-10-23 (Asia/Saigon).

| Canonical scenario | Backend proof already available | Frontend proof needed | Browser proof possible? | Status |
|---|---|---|---|---|
| T031–T034 roster file validation, preview privacy and commit retry | D09-A/B import digest, conflict and rollback suites | Roster import UI must validate type/size/duplicate/password columns, keep preview secret-free, and retry the same command identity | No roster import screen/API consumer exists in `apps/web`; ownership is outside this slice | IMPLEMENTED-INTEGRATION PENDING |
| T035 same key + same payload concurrent commit | D09-B PostgreSQL race: one ledger/enrollment/audit, deterministic replay | Import UI must disable duplicate submit and replay the authoritative result | No integrated roster UI to drive | IMPLEMENTED-INTEGRATION PENDING |
| T035 same key + different payload | D09-B PostgreSQL race: deterministic `IDEMPOTENCY_KEY_REUSED` | Show safe conflict copy and keep the original command identity | No integrated roster UI to drive | IMPLEMENTED-INTEGRATION PENDING |
| T035 different keys + duplicate logical identity | D09-B PostgreSQL race: DB uniqueness and `DUPLICATE_PERSON_KEY` | Show safe duplicate-person error without server diagnostics | No integrated roster UI to drive | IMPLEMENTED-INTEGRATION PENDING |
| T036 commit succeeds but response is lost; retry | D09-B PostgreSQL commit-then-response-loss replay | Retry must use the same idempotency key and display replayed authoritative state | No integrated roster UI to drive | IMPLEMENTED-INTEGRATION PENDING |
| T037 worker failure before commit | D09-B PostgreSQL rollback: no partial enrollment/ledger/audit | Failed import must show retryable error without partial success claim | No integrated roster UI to drive | IMPLEMENTED-INTEGRATION PENDING |
| T038 activation claim race | D09-B activation race unit/integration proof | Activation UI must render one authoritative claim result and avoid token persistence | No activation screen/API consumer exists in `apps/web` | IMPLEMENTED-INTEGRATION PENDING |
| T038 staff invitation acceptance race | D09-B conditional transition and replay proof | Existing P17 page now single-flights decisions, renders server result, and hides API diagnostics/tokens | Browser blocked by pre-existing router merge marker | IMPLEMENTED-INTEGRATION PENDING |
| T039 recovery token consumption race | D09-B conditional consume/rollback proof | Existing D07 request/reset and support queue keep generic anti-enumeration errors, clear passwords, keep raw handoff in memory, and single-flight actions | Browser blocked by pre-existing router merge marker | IMPLEMENTED-INTEGRATION PENDING |
| T040 ACK version/actor/client authority | D08-C server-version tests plus D09 regression | Existing ACK page sends only server `configVersionId`, uses session identity, single-flights, never stores evidence, and hides API diagnostics | Browser blocked by pre-existing router merge marker | IMPLEMENTED-INTEGRATION PENDING |
| BR-41/BR-42 audit/privacy under failure | D09-B audit counts and secret scans | Frontend must never render/store raw token, password, hash or private diagnostics; focused D07/D08/D09-C tests cover this boundary | Browser blocked by pre-existing router merge marker | IMPLEMENTED-INTEGRATION PENDING |

The matrix intentionally records the actual frontend boundary. It does not invent roster or activation pages that are not present in the repository.
