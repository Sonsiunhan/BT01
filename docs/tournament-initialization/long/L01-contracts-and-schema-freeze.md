# L01 — Chốt Contracts / Schema & DB Test An Toàn (Gate `G1` Freeze)

- **Task ID:** `L01` (Wave `W1` — Gate `G1`)
- **Owner:** Long (Single Writer cho `packages/contracts/**` và `prisma/**`)
- **Ngày hoàn thành:** 2026-10-21
- **Trạng thái:** **DONE (PASS 9/9 Contract Tests + Full Monorepo Gates)**
- **Nguồn đầu vào hợp nhất (`W0` → `L01`):**
  1. **`N00` (Nam — BA/Engine/Rule/Incident/Extension/G0):**
     - [N00-ACCEPTANCE-BRIEF.md](file:///home/endministrator/BT01/docs/tournament-initialization/N00-ACCEPTANCE-BRIEF.md)
     - [N00-DECISIONS-2026-10-21.md](file:///home/endministrator/BT01/docs/tournament-initialization/N00-DECISIONS-2026-10-21.md)
     - [N00-INCIDENT-EXTENSION-REQUIREMENTS.md](file:///home/endministrator/BT01/docs/tournament-initialization/N00-INCIDENT-EXTENSION-REQUIREMENTS.md)
     - [N00-UI-DTO-DRAFT.md](file:///home/endministrator/BT01/docs/tournament-initialization/N00-UI-DTO-DRAFT.md)
     - [N00-RESULT-2026-10-21.md](file:///home/endministrator/BT01/docs/tournament-initialization/N00-RESULT-2026-10-21.md) (`PASS — REQUIREMENTS ONLY 93/93`: `T001`–`T081` + `IE01`–`IE12`)
  2. **`S00` (Sơn — Console IA / Route Inventory / Console DTO / Delta):**
     - [S00-ROUTE-INVENTORY.md](file:///home/endministrator/BT01/docs/tournament-initialization/s00/S00-ROUTE-INVENTORY.md)
     - [S00-CONSOLE-DTO.md](file:///home/endministrator/BT01/docs/tournament-initialization/s00/S00-CONSOLE-DTO.md)
     - [S00-REQUIREMENT-DELTA-2026-10-21.md](file:///home/endministrator/BT01/docs/tournament-initialization/s00/S00-REQUIREMENT-DELTA-2026-10-21.md)
     - [S00-RESULT-2026-10-21.md](file:///home/endministrator/BT01/docs/tournament-initialization/s00/S00-RESULT-2026-10-21.md)
  3. **`L00` (Long — SA Pages P06/P07/P08, Core Lifecycle, Port Ownership, Quota & Audit):**
     - [L00-design-and-wireframes.md](file:///home/endministrator/BT01/docs/tournament-initialization/long/L00-design-and-wireframes.md)
     - [decisions.md](file:///home/endministrator/BT01/docs/tournament-initialization/long/decisions.md) (`ADR-L00-01`..`ADR-L00-06`)
  4. **`D00` (Đức — Account / Roster / Staff / Support / Synthetic Fixtures):**
     - [README.md](file:///home/endministrator/BT01/docs/tournament-initialization/account/README.md)
     - [hand-off-long.md](file:///home/endministrator/BT01/docs/tournament-initialization/account/hand-off-long.md)
     - [actor-matrix.md](file:///home/endministrator/BT01/docs/tournament-initialization/account/actor-matrix.md)
     - [decision-log.md](file:///home/endministrator/BT01/docs/tournament-initialization/account/decision-log.md)
     - [spec.md](file:///home/endministrator/BT01/docs/tournament-initialization/account/fixtures/spec.md)

---

## 1. Bảng Đối Chiếu Hợp Nhất `N00 + S00 + L00 + D00` Vào `L01` (`G1`)

| Nguồn `W0` | Đề xuất / Quyết định từ `W0` | Nơi chốt chính thức tại `L01` (`@ottv2/contracts` & `prisma`) |
|---|---|---|
| **`D00`** | `AccountOnboardingDTO`, `RosterImportRowDTO`, `StaffInvitationDTO`, `SupportRequestDTO`, `PrincipalSummary`, cấu hình TTL (`activation` 24h, `reset` 30m, `invite` 72h, `staging` 24h, `audit` 365d) và bộ dữ liệu giả lập `FIX-*`, `ACT-*`, `STAFF-INV-*`, `SUPPORT-*`, `PK-001..PK-010` | [d00.dto.ts](file:///home/endministrator/BT01/packages/contracts/src/account/d00.dto.ts): giữ nguyên TypeScript interfaces của Đức và bổ sung Zod schemas (`AccountOnboardingDTOSchema`, `RosterImportRowDTOSchema`, `StaffInvitationDTOSchema`, `SupportRequestDTOSchema`, `PrincipalSummarySchema`, `D00AccountTtlConfigSchema`, `D00_SYNTHETIC_FIXTURES`). |
| **`N00`** | Kết quả `G0` (`93/93`), hệ toạ độ 0-based `{ fileIndex, rankIndex }` (`0..14`), họ luật di chuyển `RAY` + `LEAP` (tối đa 16 mẫu/quân/phe, 225 offset/mẫu), `EXTINCTION` / `GOAL_REACHED`, chuỗi comparator `WEIGHTED_MATERIAL` → `GOAL_DISTANCE` → `MOBILITY`, phán quyết hòa tuyệt đối (`MANUAL_ADMIN`, chỉ Owner TA, hạn 300s), giới hạn compute của Bot (`250ms` preflight, `500ms` turn, `30000ms` trận, `64KiB` source, `8KiB` memory JSON), ma trận sự cố `IE01`–`IE07`/`IE12` & gia hạn `IE08`–`IE11` (trần cộng dồn `120` phút) | [tournament-initialization.ts](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts): `G1_APPROVED_POLICY_DEFAULTS_V1`, `G1_CAPABILITIES_LIMITS_REGISTRY`, `G1BoardCoordinateSchema`, `PieceMovementPatternSchema`, `RuleProfileDraftSchema`, `ValidatedRuleProfileSchema`, `RuleSnapshotSchema`, `ResolutionSnapshotSchema`, `AdjudicationRequestViewSchema`, `DecideAdjudicationCommandSchema`, `DecisionResponseSchema`, `TargetContextRefSchema`, `BotReadinessViewSchema`, `DETECTOR_POLICY_MATRIX_V1`, `IncidentViewSchema`, `AssignIncidentCommandSchema`, `ReverseRefereeDecisionCommandSchema`, `ScheduleComparisonSchema`, `ExtensionRequestViewSchema`, `DecideExtensionCommandSchema`. |
| **`S00`** | Console Shell, Capabilities, `control_mode` (`HUMAN_ONLY` \| `BOT_ONLY`), `TournamentListQuery/Item/Response`, `TournamentDraftView`, `SaveDraftCommand`, `TournamentDetailView`, `MatchCenterView` (`activeRound: 'CTF' \| 'CUSTOM'`, `ctfSchedule`, `customSchedule`, `broadcast`), `OfflineHubView`, `MutationEnvelope`, `AuthoritativeAck` | [tournament-initialization.ts](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts): `S00ControlModeSchema`, `ConsoleActorRoleSchema`, `ActorSummarySchema`, `CapabilitySetSchema`, `PageInfoSchema`, `RevisionContextSchema`, `SafeErrorSchema`, `ConsoleShellViewSchema`, `TournamentListQuerySchema`, `TournamentListItemSchema`, `TournamentListResponseSchema`, `TournamentDraftViewSchema`, `SaveDraftCommandSchema`, `TournamentDetailViewSchema`, `MatchCenterViewSchema`, `OfflineHubViewSchema`, `MutationEnvelopeSchema`, `AuthoritativeAckSchema`. |
| **`L00`** | Đơn vị (`P06`), Hợp đồng & TA bindings (`P07`), Hộp duyệt & `ChangeRequest` (`P08`), chuẩn hóa trường phụ thuộc (`T071`), kiểm tra khung hợp đồng (`T017`/`T061`), cổng `C32` (`T005`/`T075`), sổ cái `finish_sequence` (`T072`/`T081`), `RequestContext`, `ResourceMeta`, `SnapshotRef`, `ApprovalRequestView`, và 8 Port interfaces | [tournament-initialization.ts](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts): Sections 1–12 & Section 15 (`RequestContextSchema`, `ResourceMetaSchema`, `SnapshotRefSchema`, `FieldNoteSchema`, `ApprovalRequestViewSchema`, `PrincipalPort`, `UnitPort`, `ContractPort`, `TournamentCorePort`, `ApprovalPort`, `RuleSnapshotPort`, `IdentityGrantPort`, `ConsoleQueryPort`). |

---

## 2. Thiết Kế Schema Prisma & Migration Expand-Only (`prisma/`)

Tệp [schema.prisma](file:///home/endministrator/BT01/prisma/schema.prisma) và [migration.sql](file:///home/endministrator/BT01/prisma/migrations/20261021100000_l01_tournament_initialization/migration.sql) tuân thủ tuyệt đối nguyên tắc **Expand-Only** (không có `DROP`, không có `TRUNCATE`, chỉ thêm cột nullable trên bảng `Match` hiện hữu và tạo mới 20 bảng chuyên biệt cho Khởi tạo giải đấu):

1. **Mở rộng bảng `Match` hiện hữu:**
   - `tournamentId TEXT NULL`, `pinnedConfigVersionId TEXT NULL`, `finishSequence INTEGER NULL` + chỉ mục `(tournamentId, finishSequence)`.
2. **Các bảng Nền tảng & Vòng đời của Long (`L00`):**
   - `Unit` (`P06`)
   - `TournamentContract` (`P07`)
   - `TournamentContractTaBinding` (`P07`)
   - `TournamentQuotaLedgerRecord` (`P07` — sổ cái bất biến ghi nhận `RESERVE` / `CONSUME` / `REFUND`)
   - `Tournament` (`P02`, `P03`, `P08`)
   - `TournamentConfigVersionRecord` (`P04`)
   - `TournamentChangeRequestRecord` (`P08`)
   - `ManualAdjudicationRequestRecord` (`P05`)
   - `TournamentScoreLedgerRecord` (`P05` — khoá duy nhất `(tournamentId, finishSequence)`)
   - `TournamentAuditLogRecord` (`P14`)
3. **Các bảng Tài khoản, Roster, Nhân sự & Hỗ trợ của Đức (`D00`):**
   - `SystemRoleAssignment` (cấp quyền `ADMIN` / `SUPPORT` cấp hệ thống)
   - `AccountClaimToken` (`P09`, `P13` — mã kích hoạt & đặt lại mật khẩu có `tokenHash` và `expiresAt`)
   - `TournamentEnrollmentRecord` (`P09`, `P10`)
   - `RosterImportBatch` & `RosterImportStageRow` (`P10` — lô tạm nhập CSV/XLSX có `idempotencyKey` và `expiresAt`)
   - `TournamentStaffAssignmentRecord` (`P11`, `P17`)
   - `SupportRecoveryTicket` (`P12`)
   - `TournamentRegulationsAckRecord` (`P11`, `P18` — xác nhận điều lệ theo `configVersionId`)
4. **Các bảng Sự cố, Gia hạn & Tương thích Bot của Nam (`N00`):**
   - `TournamentIncidentRecord` (`IE02`–`IE07`, `IE12` — sự cố trận đấu, phân công Trọng tài và TA đảo ngược quyết định trước `FINALIZED`)
   - `TournamentExtensionRequestRecord` (`IE08`–`IE11` — yêu cầu gia hạn giải và đối chiếu lịch `scheduleComparison`)
   - `BotCompatibilityReceiptRecord` (`P16` — biên nhận kiểm tra tương thích Bot theo `ruleSnapshotId`)

---

## 3. Cổng Bảo Vệ Cơ Sở Dữ Liệu Tạm (`Disposable DB Guard`)

- Script [disposable-db.mjs](file:///home/endministrator/BT01/scripts/network/disposable-db.mjs) cung cấp hai hàm kiểm chứng bắt buộc:
  - `validateDisposableDbUrl(targetUrl, options)`: chặn mọi URL trỏ tới cơ sở dữ liệu mặc định (`ott` hoặc trùng `DATABASE_URL`) và bắt buộc tên DB chứa hậu tố tạm thời (`_test`, `_disposable`, `_tmp`, `_ephemeral`, `_ci`).
  - `runGuardSelfCheck()`: tự kiểm tra 4 kịch bản chặn/cho phép trước khi chạy bất kỳ tác vụ kiểm thử DB nào.

---

## 4. Bằng Chứng Kiểm Thử TDD (`RED → GREEN`)

- **Tệp kiểm thử hợp đồng `L01`:** [tournament-l01.contract.test.ts](file:///home/endministrator/BT01/tests/contract/tournament-l01.contract.test.ts)
  - **RED Gate:** Chạy `corepack pnpm vitest run tests/contract/tournament-l01.contract.test.ts` trước khi cập nhật `d00.dto.ts`, `tournament-initialization.ts`, và `migration.sql` báo lỗi `4 failed | 5 passed` đúng tại 4 nhóm hợp đồng mới (`D00`, `N00`, `S00+L00`, `SQL migration`).
  - **GREEN Gate:** Sau khi hoàn tất cập nhật, chạy lại `corepack pnpm vitest run tests/contract/tournament-l01.contract.test.ts` đạt **9/9 PASS (100%)**.
