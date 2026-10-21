# L00 — API/data proposal cho G1

Revision 1. **PROPOSAL — chưa phải compiled contract, migration hoặc route.** Long là single writer đề xuất cho contracts/schema/server composition; D00 sở hữu principal/grant/identity inputs, Sơn sở hữu route/layout, Nam sở hữu rule/receipt consumers. Các tên dưới đây chỉ được freeze ở L01/G1.

## Shared transport

Reuse `SemanticEnvelope` and `ErrorEnvelope` from `@ottv2/contracts`. Every response is scoped to a trusted principal resolved server-side and carries `serverNow`, `asOf` and resource revision where applicable. Client supplied `actorId`, role, unit scope, owner, capability, quota usage or result authority is ignored/rejected.

## Contract skeleton delivered by L00

The following skeleton is the boundary that L01 will compile. It is intentionally expressed as a semantic contract here so the three page consumers can align without introducing a second protocol:

```text
AdminUnitApi {
  list(query, ctx): Page<Unit>
  get(unitId, ctx): Unit
  create(command, ctx): AuthoritativeAck<Unit>
  update(unitId, command, expectedRevision, ctx): AuthoritativeAck<Unit>
}

AdminContractApi {
  list(query, ctx): Page<Contract>
  get(contractId, ctx): Contract
  create(command, ctx): AuthoritativeAck<Contract>
  update(contractId, command, expectedRevision, ctx): AuthoritativeAck<Contract>
  activate(contractId, expectedRevision, ctx): AuthoritativeAck<Contract>
}

AdminApprovalApi {
  list(query, ctx): Page<ApprovalRequest>
  get(requestId, ctx): ApprovalRequest
  decide(requestId, decision, expectedRevision, ctx): AuthoritativeAck<ApprovalRequest>
  requestExtension(tournamentId, command, ctx): AuthoritativeAck<ExtensionRequest>
  decideExtension(requestId, decision, expectedRevision, ctx): AuthoritativeAck<ExtensionRequest>
}

AuthoritativeAck<T> {
  value: T
  eventId: OpaqueId
  resourceRevision: string
  serverNow: Instant
  idempotencyKey: string
}
```

Every method returns either this ACK/page shape or the shared `ErrorEnvelope`; field errors use `details.fieldPath` and a safe message key. `SemanticEnvelope` carries protocol version/message ID/type/timestamp and optional resource sequence; no method accepts client authority fields. This is the required L00 skeleton, while TypeScript/Zod implementation and schema freeze remain L01.

```text
RequestContext {
  principal: TrustedPrincipal        // from auth/D00 port, never request body
  capabilityVersion: string
  requestId: string
  idempotencyKey?: string            // required for mutation commands
  serverNow: Instant
}

ResourceMeta {
  resourceRevision: string
  asOf: Instant
  permittedActions: string[]         // server allowlist, filtered by resource
}

Page<T> { items: T[]; nextCursor: string | null; hasMore: boolean; meta: ResourceMeta }
```

Pagination uses the existing bounded pagination primitive; proposed default is 20, maximum 50 until L01 measures/approves a different bound. Search/filter values and JSON depth/bytes use existing bounds or a stricter endpoint-specific bound. No unbounded list or arbitrary JSON/script field is accepted.

## Domain records (semantic proposal)

```text
Unit {
  unitId: OpaqueId
  unitCode: string                 // stable, unique, server-owned after first reference
  name: string
  status: ACTIVE | LOCKED
  revision: string
  contractCount: number            // scoped summary only
  createdAt: Instant
  updatedAt: Instant
}

Contract {
  contractId: OpaqueId
  partnerUnitId: OpaqueId
  validFrom: Instant
  validTo: Instant
  status: DRAFT | ACTIVE | EXPIRED | SUSPENDED
  caps: {
    maxTournaments: number
    maxParticipantsPerTournament: number
    maxParticipantsTotal: number
    minTournamentDays: number
    maxTournamentDays: number
  }
  allowedUnitIds: OpaqueId[]
  allowedControlModes: HUMAN_ONLY | BOT_ONLY | HYBRID[]
  rulesEnvelope: RuleEnvelopeRef
  sandboxCaps: SandboxCaps
  usage: { tournamentsUsed: number; participantsUsed: number } // server read-only
  revision: string
}

RuleEnvelopeRef {
  version: string
  boardRows: { min: number; max: number }
  boardCols: { min: number; max: number }
  movementFamilies: string[]
  goalModes: string[]
  resourceProfileIds: string[]
}

TournamentSummary {
  tournamentId: OpaqueId
  ownerBindingId: OpaqueId
  contractId: OpaqueId
  name: string
  slug: string
  lifecycle: DRAFT | SUBMITTED | UNDER_REVIEW | CHANGES_REQUESTED | REJECTED | APPROVED | ROSTER_OPEN | READY | RUNNING | PAUSED | ENDED | REVIEWING | FINALIZED | ARCHIVED | CANCELLED
  visibility: PRIVATE | PUBLIC | UNLISTED
  startAt: Instant
  endAt: Instant
  configRevision: string | null
  readiness: ReadinessSummary
  revision: string
}

ApprovalRequest {
  requestId: OpaqueId
  tournamentId: OpaqueId
  requestType: INITIAL_APPROVAL | CONFIG_CHANGE | EXTENSION
  requestedSnapshot: SnapshotRef
  effectiveSnapshot: SnapshotRef | null
  status: PENDING | APPROVED | REJECTED | CHANGES_REQUESTED | EXPIRED | CONFLICTED
  requestedBy: SafeActorSummary
  reviewedBy: SafeActorSummary | null
  reason: string | null
  fieldNotes: FieldNote[]
  expectedTournamentRevision: string
  deadline: Instant | null
  revision: string
}

ExtensionRequest {
  requestId: OpaqueId
  tournamentId: OpaqueId
  requestedEndAt: Instant
  approvedEndAt: Instant | null
  status: PENDING | PARTIALLY_APPROVED | APPROVED | REJECTED | EXPIRED
  capacityEvidence: CapacityEvidenceSummary | null
  reason: string
  expectedTournamentRevision: string
  revision: string
}
```

`SnapshotRef` contains hash/version and sanitized field projection. It never contains private Bot source/memory/logs, credentials, reset/activation tokens, raw file paths, stack traces or internal SQL. A tournament/match stores immutable snapshot references; approving a new snapshot does not mutate old matches.

## Endpoint skeleton

| Endpoint | Actor/capability | Mutation and authority |
|---|---|---|
| `GET /admin/units` | SA + `unit.list` | Scoped server filter; cursor bounded. |
| `POST /admin/units` | SA + `unit.create` | Create unique code/name; idempotency; audit. |
| `GET /admin/units/:unitId` | scoped `unit.read` | Safe detail or disclosure-safe forbidden. |
| `PATCH /admin/units/:unitId` | SA + `unit.write` | Expected revision; lock/in-use checks; no cascade delete. |
| `GET /admin/contracts` | SA + `contract.list` | Server usage projection; no client-computed quota. |
| `POST /admin/contracts` | SA + `contract.create` | Validate envelope/caps/date; reserve no external capacity. |
| `PATCH /admin/contracts/:contractId` | SA + `contract.write` | Draft changes only or new policy revision; active snapshot protected. |
| `POST /admin/contracts/:contractId/activate` | SA + `contract.activate` | CAS/idempotency; records effective revision. |
| `GET /admin/tournament-approvals` | SA/TA scoped + `approval.list` | Server-paginated safe request list. |
| `GET /admin/tournament-approvals/:requestId` | scoped `approval.read` | Snapshot diff and permitted actions; no authority from ID. |
| `POST /admin/tournament-approvals/:requestId/decision` | SA/TA according to request type | One decision CAS; reason, notes, expected revision, idempotency. |
| `POST /admin/tournaments/:id/extensions` | eligible SA/TA request capability | Creates pending request; does not alter `end_at`. |
| `POST /admin/tournament-approvals/:requestId/extension-decision` | SA + `extension.review` | Before `end_at`; partial/capacity policy; no late reopen. |
| `GET /admin/tournaments/:id/readiness` | scoped read capability | Aggregates blockers, no source/private data. |

HTTP names remain proposal until L01. Existing public `ErrorEnvelope` is used for all failures; new reason keys must be added only by the contracts writer after collision review.

## Validation and error mapping

| Condition | Proposed reason | HTTP/public result | Retry |
|---|---|---|---|
| Missing/invalid field or cap | `SCHEMA_VALIDATION_FAILED` | `VALIDATION_ERROR`, field path | No; edit input. |
| Principal missing/expired | `UNAUTHORIZED` / existing auth mapping | `UNAUTHORIZED` | Re-auth. |
| Capability/scope denied | `FORBIDDEN_ROLE` | `UNAUTHORIZED`/forbidden policy | No; navigate back. |
| Resource outside disclosure scope | `RESOURCE_NOT_FOUND` | `NOT_FOUND` | No blind retry. |
| Duplicate unit code/slug | `CONFLICT` | `CONFLICT`, field path | Reload/choose value. |
| Expected revision mismatch | `STALE_VERSION` | `CONFLICT`, authoritative revision | Reload/compare. |
| Contract expired/suspended | proposal `CONTRACT_INACTIVE` | `VALIDATION_ERROR` or `CONFLICT` after error-catalog review | No until contract changes. |
| Quota exhausted/race | proposal `QUOTA_EXCEEDED` | `CONFLICT`/rate policy | Reload; no automatic duplicate. |
| Outside rules envelope | proposal `OUTSIDE_ENVELOPE` | `VALIDATION_ERROR`, field paths | Adjust or request change. |
| Extension at/after end | proposal `DEADLINE_EXPIRED` | `CONFLICT`, read-only explanation | No reopen. |
| Capacity provider unavailable | `CAPACITY_EXCEEDED` or service unavailable mapping | `SERVICE_UNAVAILABLE`, blocker | Bounded retry; no approval. |
| Duplicate command key | `COMMAND_ID_REUSED` | existing command ledger result or conflict | Replay same command only. |

Proposed new reason names are explicitly `DEPENDENCY_PENDING` until the contracts writer verifies they do not collide with `ErrorReasonV2Schema`. No route may return raw exception text, secret, path, SQL, actor existence or private Bot diagnostic.

## Data and transaction intent

The conceptual relations are `Unit 1—N Contract`, `Contract 1—N TournamentAdminBinding`, `Contract 1—N Tournament`, `Tournament 1—N ApprovalRequest`, and `Tournament 1—N ExtensionRequest`. A concrete schema must preserve stable IDs, unique unit code, unique contract-scoped slug/identity rules, immutable snapshots, append-only decisions and safe audit references.

The following effects are intended to be atomic in the future core service:

1. Create draft + increment shared contract quota once + command ledger entry.
2. Delete draft/reject + refund exactly once, while approved cancellation never refunds.
3. Approve/reject/request changes + append decision audit + publish effective snapshot or leave it unchanged.
4. Extension decision + update approved end boundary + append event, only before current end and within cap.
5. Every mutation validates principal, binding, state, envelope, expected revision and idempotency before commit.

No restore-database command, arbitrary score setter, client quota update, role from payload or cross-tenant relation is part of this proposal.
