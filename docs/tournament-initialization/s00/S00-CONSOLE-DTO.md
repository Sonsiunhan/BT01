# S00 — Console DTO ngữ nghĩa

Các DTO dưới đây là payload proposal để Long/Đức xác nhận ở G1. Chúng không phải TypeScript source và không cho client nắm authority. Payload thật phải nằm trong `packages/contracts`, server kiểm actor/tenant/scope/revision trước khi trả.

Revision 3: dùng [S00-TRACEABILITY.md](S00-TRACEABILITY.md) và thiết kế R2 làm handoff hiện hành. UI context là scoped grant, không phải danh sách global role mới. Capability/status names bên dưới vẫn là proposal chờ G1.

## 1. Kiểu dùng chung

```text
ActorSummary {
  actorId: string              // server supplied, opaque
  displayName: string          // đã lọc theo policy
  displayContext: SYSTEM_ADMIN | TOURNAMENT_ADMIN | REFEREE | BROADCAST_OBSERVER | BROADCAST_ADMIN
  scopedGrants: string[]       // confirmed server grants only; mapping remains pending G1
  tenantScope: string[]        // chỉ trả scope cần cho màn hiện tại
}

CapabilitySet {
  version: string
  permittedActions: string[]   // allowlist server, không phải role claim
  expiresAt: Instant
}

PageInfo {
  nextCursor?: string
  pageSize: number             // bounded server value
  asOf: Instant
}

RevisionContext {
  resourceRevision: string
  configRevision?: string
  serverNow: Instant
  idempotencyScope: string
}

SafeError {
  code: string
  messageKey: string
  safeMessage: string
  fieldPath?: string
  retryable: boolean
  correlationId?: string
}
```

Không trả password, activation/reset token, raw source, memory, private log, filesystem path, stack trace, secret, internal SQL hoặc cross-tenant identifier.

## 2. Shell và navigation

```text
ConsoleShellView {
  actor: ActorSummary
  capabilities: CapabilitySet
  navigation: NavigationItem[]
  network: CHECKING | ONLINE | DEGRADED | OFFLINE | RECONNECTING
  serverNow: Instant
}

NavigationItem {
  id: string
  label: string
  href: string
  group: TOURNAMENTS | OFFLINE
  requiredCapability: string
  badge?: { kind: INCIDENT | BLOCKER | JOB; count: number; asOf: Instant }
}
```

`navigation` đã được lọc theo server capability. Client không được thêm item bằng cách đọc role trong local storage.

## 3. P01 — Tournament list

```text
TournamentListQuery {
  q?: string                 // bounded, server-side
  statuses?: LifecycleStatus[]
  visibility?: PRIVATE | PUBLIC | UNLISTED
  unitId?: string
  cursor?: string
  pageSize?: number
  sort?: CREATED_DESC | START_ASC | UPDATED_DESC
}

TournamentListItem {
  tournamentId: string
  name: string
  slug: string
  status: DRAFT | SUBMITTED | UNDER_REVIEW | CHANGES_REQUESTED | REJECTED | APPROVED | ROSTER_OPEN |
          READY | RUNNING | PAUSED | ENDED | REVIEWING | FINALIZED | ARCHIVED | CANCELLED
  visibility: PRIVATE | PUBLIC | UNLISTED
  startAt: Instant | null      // null only in DRAFT/CHANGES_REQUESTED before schedule validation
  endAt: Instant | null        // submitted/approved profile must have a validated schedule
  timezone: IanaZone
  ownerDisplay: string
  readiness: { state: READY | BLOCKED | CHECKING; blockerCount: number }
  permittedActions: string[]
  revision: string
}

TournamentListResponse {
  items: TournamentListItem[]
  page: PageInfo
  capabilities: CapabilitySet
}
```

## 4. P02 — Draft form

```text
TournamentDraftView {
  tournamentId: string
  draftRevision: string
  configRevision: string
  stage: DRAFT | CHANGES_REQUESTED
  fields: Record<string, unknown>      // canonical field paths only
  applicability: Record<string, APPLICABLE | NOT_APPLICABLE | PENDING>
  validation: { errors: SafeError[]; warnings: SafeError[] }
  permittedActions: string[]
  lastSavedAt?: Instant
}

SaveDraftCommand {
  tournamentId?: string
  expectedConfigRevision?: string
  draftRevision: string
  patch: FieldPatch[]                    // no actor/owner/role authority
  idempotencyKey: string
}
```

`patch` chỉ chứa field đã có trong canonical field registry. Server chuẩn hóa hidden values, kiểm cap và trả revision mới. Preview/validate response phải gắn `draftRevision`, `configRevision`, digest và capabilities version để UI bỏ response cũ.

## 5. P03 — Detail, incident và extension summary

```text
TournamentDetailView {
  tournament: TournamentListItem
  readiness: ReadinessSummary
  staffing: { requiredReadyOnline: number; currentReadyOnline: number; asOf: Instant }
  blockers: BlockerSummary[]
  incidentSummary: { open: number; assigned: number; overdue: number }
  extensionSummary: { pending: number; capRemainingMinutes?: number }
  permittedActions: string[]
  context: RevisionContext
}

MatchCenterView {
  activeRound: CTF | CUSTOM
  overview: TournamentOverview
  ctfSchedule?: MatchRow[]       // ngày đấu CTF và toàn bộ trận theo lịch
  customSchedule?: MatchRow[]    // thứ tự từ import, không suy ra bracket semantics
  permittedActions: string[]
  broadcast: { canView: boolean; canPrepare: boolean }
  context: RevisionContext
}

MatchRow {
  matchId: string
  scheduledAt: Instant
  boardLabel: string
  blueLabel: string
  redLabel: string
  status: SCHEDULED | RUNNING | ENDED | PAUSED
  streamChannel?: string
  permittedActions: string[]
}

IncidentSummary {
  incidentId: string
  matchId: string
  kind: string
  origin: PLAYER | TRUSTED_DETECTOR | STAFF
  status: OPEN | ASSIGNED | IN_PROGRESS | RESOLVED | CANCELLED | EXPIRED
  priority: LOW | NORMAL | HIGH | CRITICAL
  safeSummary: string
  assignment?: { refereeDisplay: string; status: string; expiresAt?: Instant }
  permittedActions: string[]
  revision: string
}

ExtensionRequestSummary {
  requestId: string
  originalEndAt: Instant
  currentEndAt: Instant
  requestedMinutes: number
  requestedEndAt: Instant
  status: PENDING | APPROVED | PARTIALLY_APPROVED | REJECTED | WITHDRAWN
  cumulativeApprovedMinutes: number
  capRemainingMinutes: number
  reason: string
  permittedActions: string[]
  revision: string
}
```

Incident/extension detail dùng DTO authoritative của N00/Long; S00 chỉ định summary cần cho shell. Referee suggestion chỉ là gợi ý availability, không reservation hay cấp global role.

## 6. P14 — Audit

```text
AuditQuery { tournamentId?: string; actorId?: string; action?: string; from?: Instant; to?: Instant; cursor?: string; pageSize?: number }

AuditEventView {
  eventId: string
  occurredAt: Instant
  actorDisplay: string
  action: string
  objectType: string
  objectRef: string
  outcome: ACK | REJECTED | CONFLICT | FAILED
  reason?: string
  safeFieldDiff?: { path: string; before?: string; after?: string }[]
  correlationId?: string
  revision?: string
}
```

`safeFieldDiff` allowlist do server tạo; không nhận `before/after` raw từ client. Export response dùng cùng filter/retention và có ACK riêng.

## 7. P15 — Offline hub

```text
OfflineHubView {
  entries: OfflineEntry[]
  runtime: { status: READY | BLOCKED | UNAVAILABLE | CHECKING; safeMessage: string; checkedAt?: Instant }
  capabilities: CapabilitySet
}

OfflineEntry {
  id: BOT_LIBRARY | BOT_OFFLINE | HUMAN_BOT | HUMAN_HUMAN
  label: string
  status: AVAILABLE | BLOCKED | HIDDEN
  reasonCode?: string
  href?: string
  permittedActions: string[]
}
```

`BOT_LIBRARY` metadata không bao gồm source/private logs. `BOT_OFFLINE`/`HUMAN_BOT` chỉ hiện READY khi consumer runtime thật có receipt phù hợp; thiếu môi trường là `BLOCKED`, không phải success giả.

## 8. Mutation envelope

Mọi mutation UI phát ra cùng envelope tối thiểu:

```text
MutationEnvelope {
  operation: string
  expectedRevision: string
  idempotencyKey: string
  reason?: string
}

AuthoritativeAck {
  outcome: ACK | ACCEPTED_RECOMPUTING | CONFLICT | FORBIDDEN | FINALIZED_LOCKED | FAILED
  eventId?: string
  revision?: string
  serverNow: Instant
  safeMessage: string
  nextActions?: string[]
}
```

Client không gửi `actorId`, `role`, `winner`, `score`, `tenantScope`, `permittedActions` hoặc `serverNow` để xin authority. Server recheck ACL, state, revision, idempotency và conflict rồi mới ghi.
