# L00 — Method ownership và contract boundaries

Revision 1. This matrix prevents page adapters from becoming a second lifecycle or authorization writer. Method signatures remain semantic until L01 freezes TypeScript/Prisma details.

## Ports

| Port | Writer | Trusted inputs | Consumers | Boundary |
|---|---|---|---|---|
| `PrincipalPort` | Đức/D00 | session → principal, global/scoped grants | All admin routes | Never accepts client role/scope. |
| `UnitPort` | Long | principal, unit command, expected revision, idempotency | P06, contract service | Unique code, lock/in-use and audit are server rules. |
| `ContractPort` | Long | principal, contract command, envelope, expected revision, idempotency | P07, tournament core | Shared quota and policy revision; no billing ledger. |
| `TournamentCorePort` | Long | trusted principal, lifecycle command, canonical snapshot | P02/P03/P08/D00/Nam | Single lifecycle/settlement writer. |
| `ApprovalPort` | Long | request ID, decision, reason, expected revisions, idempotency | P08, S03/P03 | Initial/change decisions and extension CAS. |
| `AuditPort` | Long composition; scoped producers | sanitized event, actor/scope from server | All modules | Append-only; no secrets/private Bot data. |
| `RuleSnapshotPort` | Nam | validated rule/config revision | Long core, P04/P02 | Only opaque snapshot refs cross boundary. |
| `IdentityGrantPort` | Đức/D00 | principal, binding/enrollment state | Long core/P08 | Long cannot invent account or grant. |
| `ConsoleQueryPort` | Sơn adapter over core ports | server query + trusted context | P06/P07/P08 UI | Read/query composition; no mutation authority. |

## Method matrix

| Method | Caller | Preconditions | Atomic effect | Safe result/error |
|---|---|---|---|---|
| `listUnits(query)` | P06 query | `unit.list`, bounded query | None | `Page<Unit>` or disclosure-safe error. |
| `createUnit(command, ctx)` | P06 form | SA `unit.create`, valid code/name, idempotency | Unit + audit | Unit meta; duplicate/conflict. |
| `getUnit(id, ctx)` | P06 detail | scoped `unit.read` | None | Unit safe projection; no cross-scope existence. |
| `updateUnit(id, command, expectedRevision, ctx)` | P06 form | SA write, revision match, in-use policy | Update/lock + audit | New revision; stale/in-use/validation. |
| `listContracts(query)` | P07 query | `contract.list`, bounded query | None | Page with server usage projection. |
| `createContract(command, ctx)` | P07 form | SA create, valid unit/date/caps/envelope | Contract draft + audit | Draft revision; invalid/scope conflict. |
| `updateContract(id, command, expectedRevision, ctx)` | P07 form | SA write; active snapshot policy | Draft/new policy revision + audit | New revision; stale/active lock. |
| `activateContract(id, expectedRevision, ctx)` | P07 action | SA activate, valid date/caps, not suspended | Contract ACTIVE + audit | ACK revision; conflict/inactive. |
| `listApprovalRequests(query, ctx)` | P08 inbox | scoped `approval.list` | None | Page with filtered snapshot metadata. |
| `getApprovalRequest(id, ctx)` | P08 detail | scoped `approval.read` | None | Safe diff and actions. |
| `decideApproval(id, decision, ctx)` | P08 action | actor/request type/state/revision/deadline/ACL | One decision + audit + effective snapshot if approved | ACCEPTED/APPLIED or conflict; never local success. |
| `requestExtension(id, command, ctx)` | P03/P08 | allowed request capability; current end not passed | Pending request only | Pending revision; validation/deadline. |
| `decideExtension(id, decision, ctx)` | P08 action | SA review before end, cap/capacity evidence | Approved/partial/rejected event + end boundary | Applied revision; expired/capacity/conflict. |
| `createDraft(command, ctx)` | P02/core | TA binding + contract active + quota | Draft + quota reservation + ledger | Draft ID/revision; quota race. |
| `patchDraft(id, command, ctx)` | P02/core | owner/state/revision | Draft update | Draft revision; stale/field errors. |
| `submitDraft(id, ctx)` | P02/core | required fields/envelope; no fake readiness | Submitted snapshot + approval request | Request ID; validation/conflict. |
| `readReadiness(id, ctx)` | P03 | scope/read capability | None | Blocker summary; no private source. |

## Command rules

Every mutation uses one idempotency scope `(principal, resource, operation, commandId)`, checks expected revision in the same transaction and returns the prior authoritative ACK for a retried command. A mutation cannot infer actor authority from URL, body, local storage, hidden field or caller-provided `permittedActions`.

Page adapters may normalize form data and map field errors. They may not create a second quota counter, mutate lifecycle directly, publish a rule snapshot, approve their own request, set score/Elo, restore a database, or append unsanitized audit data. Any cross-module method not present here is `DEPENDENCY_PENDING` and blocks L01 export rather than being invented.

## Handoff requests

- D00 must provide `PrincipalPort`/grant/enrollment semantics and its safe actor projection.
- S00/S01 must consume route/capability names from the eventual contract; they must not edit Long-owned schema or core lifecycle.
- Nam must provide rule/config snapshot reference and validation result shape; Long stores opaque references and does not duplicate engine logic.
- L01 must choose concrete repository/Prisma types, error-catalog additions, transaction boundaries, migration candidate and disposable DB fixture strategy.
