# BẢN HANDDOWN TỔNG HỢP LUỒNG LONG (`L00` – `L13`) & HƯỚNG DẪN TÍCH HỢP CHO CÁC LUỒNG PHỤ THUỘC (`S`, `D`, `N`)

- **Người bàn giao:** Long (Team Lead / Architect / Single Writer cho `prisma/schema.prisma`, `packages/contracts`, `tournament-foundation`, `tournament-core`, và các trang Admin `P06`, `P07`, `P08`)
- **Thời điểm bàn giao:** 2026-10-21
- **Trạng thái hoàn thành:** **14/14 Tasks (`L00` → `L13`) = DONE (100% PASS)**
- **Trạng thái rà soát đối kháng (`santa-method`):** Hội tụ kép Vòng 2 (`typescript-reviewer`: **PASS (APPROVED)**, `security-reviewer`: **PASS (NICE)**)

---

## PHẦN 1 — TỔNG HỢP KẾT QUẢ ĐÃ THỰC HIỆN (`L00` – `L13`)

### 1.1. Danh Mục Task & File Bàn Giao Của Long

| Task | Tên Task | Kết Quả & Tạo Phẩm Chính | Trạng Thái |
|---|---|---|---|
| **L00** | Thiết kế trang SA & hợp nhất API/data proposal | [L00-design-and-wireframes.md](file:///home/endministrator/BT01/docs/tournament-initialization/long/L00-design-and-wireframes.md), [decisions.md](file:///home/endministrator/BT01/docs/tournament-initialization/long/decisions.md) (`ADR-L00-01`..`ADR-L00-06`) | **DONE** |
| **L01** | Chốt contracts/schema & DB test an toàn | [tournament-initialization.ts](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts), [d00.dto.ts](file:///home/endministrator/BT01/packages/contracts/src/account/d00.dto.ts), [schema.prisma](file:///home/endministrator/BT01/prisma/schema.prisma), [migration.sql](file:///home/endministrator/BT01/prisma/migrations/20261021100000_l01_tournament_initialization/migration.sql), [error-handler.ts](file:///home/endministrator/BT01/apps/server/src/plugins/error-handler.ts) | **DONE** |
| **L02** | Core draft/quota/contract-policy & audit port | [audit.port.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-foundation/audit.port.ts), [tournament-store.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-foundation/tournament-store.ts), [unit-contract.service.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-foundation/unit-contract.service.ts), [foundation.route.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-foundation/foundation.route.ts) | **DONE** |
| **L03** | Hai trang Đơn vị (`P06`) & Hợp đồng (`P07`) FE/BE | [UnitsAdminPage.tsx](file:///home/endministrator/BT01/apps/web/src/features/admin/units/UnitsAdminPage.tsx), [ContractsAdminPage.tsx](file:///home/endministrator/BT01/apps/web/src/features/admin/contracts/ContractsAdminPage.tsx), [tournamentAdminApi.ts](file:///home/endministrator/BT01/apps/web/src/features/admin/services/tournamentAdminApi.ts) | **DONE** |
| **L04** | Hộp duyệt & chi tiết xét duyệt (`P08`) FE/BE | [core-draft.service.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/core-draft.service.ts), [approval.service.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/approval.service.ts), [ApprovalsAdminPage.tsx](file:///home/endministrator/BT01/apps/web/src/features/admin/approvals/ApprovalsAdminPage.tsx), [long-routes.tsx](file:///home/endministrator/BT01/apps/web/src/features/admin/long-routes.tsx), [long-route-meta.ts](file:///home/endministrator/BT01/apps/web/src/features/admin/long-route-meta.ts) | **DONE** |
| **L05** | Lifecycle / `ChangeRequest` / `READY` aggregate | `createChangeRequest`, `publishWithinEnvelopeRuleUpdate`, `evaluateReadiness` trong [lifecycle.service.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/lifecycle.service.ts) | **DONE** |
| **L06** | Player admission `C32` & cổng quyền chung | [admission-gate.service.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/admission-gate.service.ts), Fastify `preHandler` hook trong [index.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/index.ts) | **DONE** |
| **L07** | Pause / cancel / end & persistence boundary | `openScheduled`, `startRunning`, `pauseTournament`, `resumeTournament`, `evaluateAutoEndAtWindow`, `cancelTournament`, `finalizeTournament` trong [lifecycle.service.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/lifecycle.service.ts) | **DONE** |
| **L08** | Manual adjudication transaction & ledger handoff | [adjudication-ledger.service.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/adjudication-ledger.service.ts), [tournament-core.route.ts](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/tournament-core.route.ts) | **DONE** |
| **L09** | Concurrency & state/permission test suite | [tournament-l01.contract.test.ts](file:///home/endministrator/BT01/tests/contract/tournament-l01.contract.test.ts), [tournament-l02-l08.unit.test.ts](file:///home/endministrator/BT01/tests/unit/tournament-l02-l08.unit.test.ts), [tournament-l09-concurrency.unit.test.ts](file:///home/endministrator/BT01/tests/unit/tournament-l09-concurrency.unit.test.ts), [admin-pages.test.tsx](file:///home/endministrator/BT01/apps/web/src/features/admin/admin-pages.test.tsx) | **DONE** |
| **L10** | Tích hợp app/API/DB & chạy luồng xuyên suốt | [tournament-l10-e2e-flow.integration.test.ts](file:///home/endministrator/BT01/tests/integration/tournament-l10-e2e-flow.integration.test.ts), đăng ký vào [app.ts](file:///home/endministrator/BT01/apps/server/src/app.ts) | **DONE** |
| **L11** | Review chéo engine/SDK & phân xử của Nam | [L11-cross-review-nam.md](file:///home/endministrator/BT01/docs/tournament-initialization/long/L11-cross-review-nam.md) | **DONE** |
| **L12** | Đóng gói data/handoff & kiểm lại trạng thái | [L12-operations-handoff.md](file:///home/endministrator/BT01/docs/tournament-initialization/long/L12-operations-handoff.md), [l12-handoff-manifest.json](file:///home/endministrator/BT01/docs/tournament-initialization/long/l12-handoff-manifest.json) | **DONE** |
| **L13** | Sửa lỗi & bàn giao candidate tích hợp | [L13-final-release-report.md](file:///home/endministrator/BT01/docs/tournament-initialization/long/L13-final-release-report.md), [tdd-evidence.md](file:///home/endministrator/BT01/docs/tournament-initialization/long/tdd-evidence.md) | **DONE** |

---

## PHẦN 2 — NHỮNG THÔNG TIN QUAN TRỌNG & BẤT BIẾN KIẾN TRÚC (CRITICAL INVARIANTS)

1. **Định danh và Phân quyền (`T001`, `T004`, `T005`, `T006`, `T008`, `T009`, `T059`):**
   - Toàn bộ quyền của người dùng trong ngữ cảnh giải đấu được giải quyết tại máy chủ thông qua [`TournamentStateStore.resolveAuthoritativeActor`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-foundation/tournament-store.ts#L137-L176) và [`resolveTournamentRequestActor`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-foundation/foundation.route.ts#L19-L38).
   - **Không bao giờ** tin tưởng `role` truyền từ URL, query hay body; **đã gỡ bỏ** mọi cơ chế leo thang đặc quyền theo `username === "sysadmin"` — quyền `ADMIN` chỉ được cấp từ `store.grantSystemRole(userId, "ADMIN")` (hoặc bảng `SystemRoleAssignment` trong DB).
   - Toàn bộ các route `/api/admin/*` (cả `GET` và `POST`/`PATCH`/`DELETE`) đều bắt buộc qua `assertAdminActor(actor)` (`403 FORBIDDEN_ROLE` nếu không phải `ADMIN`).
   - Các giải đấu ở trạng thái chưa duyệt (`DRAFT`, `UNDER_REVIEW`, `CHANGES_REQUESTED`, `REJECTED`) bị lọc khỏi danh sách công khai và chặn truy cập chéo giữa các TA (`403 FORBIDDEN_ROLE`).
   - **Phán quyết thủ công (`T059`):** Chỉ duy nhất **Owner TA** (`tournament.ownerTaUserId === actor.userId` có liên kết hợp đồng chưa bị `REVOKED`) mới được gửi phán quyết trận đấu (`POST /api/tournaments/adjudications/:adjudicationRequestId/verdict`). Cả `ADMIN` và `REFEREE` đều bị chặn `403`.

2. **Kế toán Hạn mức Hợp đồng (`BR-05`, `T011`–`T016`):**
   - Công thức chuẩn: `quotaRemainingCount = maxTournamentsTotal - quotaReservedCount`.
   - Khi tạo `DRAFT`: giữ chỗ nguyên tử `quotaReservedCount += 1` bên trong mutex `store.withLock(...)`.
   - Khi xóa `DRAFT` hoặc Admin `REJECT` lần duyệt đầu (`everApproved === false` và `quotaRefunded === false`): hoàn trả đúng **1 lần** (`quotaReservedCount -= 1`, `quotaRefunded = true`).
   - Khi giải đã từng được `APPROVED` (`everApproved === true`, `quotaConsumedCount += 1`): **không bao giờ hoàn lại quota** kể cả khi sau đó giải bị `CANCELLED` (`T013`).
   - Khi giải bị `REJECTED`: trạng thái là kết thúc cho bản ghi đó, nhưng TA có thể tạo bản nháp mới từ cấu hình cũ qua `POST /api/tournaments/:tournamentId/copy-to-draft` (`T023`).

3. **Tách biệt `ChangeRequest` Hậu Duyệt & Phát Hành Luật Trong Khung (`BR-07`, `BR-10`, `T024`, `T061`, `T062`):**
   - Sau khi giải đã `APPROVED`, mọi đề xuất thay đổi `coreConfig` hoặc thay đổi luật vượt ngoài `ContractPolicyEnvelope` phải tạo bản ghi `TournamentChangeRequest` riêng (`POST /api/tournaments/:tournamentId/change-requests`), **tuyệt đối không** đẩy trạng thái giải đấu về lại `UNDER_REVIEW`.
   - Nếu TA cập nhật `ruleProfile` nằm hoàn toàn trong `contract.policyEnvelope` và `effectiveAt >= serverNow`, TA được phép phát hành trực tiếp phiên bản cấu hình mới (`v(N+1)`) qua `POST /api/tournaments/:tournamentId/rule-versions` mà không cần chờ Admin duyệt.
   - Các trận đấu đang chạy (`RUNNING` / `PAUSED_ADJUDICATION`) được ghim cứng (`pinnedConfigVersionId`, `pinnedConfigVersionNumber`) tại thời điểm khởi tạo trận qua [`AdmissionGateService.pinMatchConfigVersion`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/admission-gate.service.ts#L225-L276).

4. **Cổng Kiểm Soát `C32` (`T005`, `T075`):**
   - `ADMIN` luôn bị chặn tham gia hàng đợi/phòng chơi Online với tư cách đấu thủ (`403 ADMIN_CANNOT_PLAY_ONLINE`), kể cả khi không có giải đấu nào đang mở.
   - Khi có giải đấu đang `RUNNING` hoặc `PAUSED`, `GUEST` và người dùng ngoài danh sách đủ điều kiện của giải bị chặn tạo/vào phòng đấu Online (`403 GUEST_BLOCKED_DURING_TOURNAMENT_WINDOW` / `NOT_ENROLLED_IN_ACTIVE_TOURNAMENT`), nhưng **vẫn cho phép** kết nối lại trận đang dở (`ONLINE_RECONNECT_EXISTING_MATCH`), thi đấu Offline (`OFFLINE_LOCAL_MATCH`) và quan sát/trọng tài đúng phạm vi.

5. **Phán Quyết Thủ Công Có Hạn Chót & Sổ Cái Điểm/Elo `finish_sequence` (`C33`, `T060`, `T072`, `T073`, `T081`):**
   - Khi yêu cầu phán quyết thủ công (`WAITING`) quá hạn `deadlineAt`, [`AdjudicationLedgerService.sweepExpiredAdjudicationsSync`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/adjudication-ledger.service.ts#L233-L272) tự động áp dụng `fallbackPolicy` (`RANDOM_SEEDED`, `BLUE_ADVANTAGE`, `RED_ADVANTAGE`, `REPLAY_ONCE_THEN_SEEDED`), cấp `finishSequence` và ghi vào sổ cái trước khi đánh giá `Readiness`, chốt giải (`finalizeTournament`) hoặc xuất bảng xếp hạng.
   - Bảng xếp hạng (`GET /api/tournaments/:tournamentId/leaderboard`) luôn được tính tất định theo thứ tự tăng dần của `finishSequence` (không phụ thuộc jitter thời gian thực) với bộ 6 tiêu chí phá hòa cố định.

6. **Nhật Ký Kiểm Toán Bất Biến & Khử Nhạy Cảm Sâu (`BR-41`, `BR-42`, `T077`):**
   - [`SanitizingAuditService`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-foundation/audit.port.ts#L95-L139) chỉ có `append` và `list` (không có `update`/`delete`), tự động thay thế bằng `"[REDACTED]"` đối với mọi khóa/giá trị chứa `password`, `token`, `recoveryCode`, `apiKey`, `credential`, `sourceText`, `pythonCode`, `botSource`, `memoryPayload`, `botMemory`, `privateDiagnostics`, `stderr`, `traceback`, `def ...`, `class ...`, `scrypt$`, `argon2id$`, và đóng băng đệ quy (`deepFreeze`) toàn bộ bản ghi.

---

## PHẦN 3 — HƯỚNG DẪN TÍCH HỢP CHO CÁC TASK PHỤ THUỘC VÀO LUỒNG `L` (`S`, `D`, `N`)

Dưới đây là bản đồ chi tiết từng task của **Sơn (`S`)**, **Đức (`D`)**, và **Nam (`N`)** có phụ thuộc đầu vào từ `L00`–`L13`, kèm đúng đường dẫn file, symbol/schema và API cần gọi.

### 3.1. Dành Cho Luồng Của SƠN (`S01`, `S02`, `S03`, `S05`, `S06`, `S07`, `S10`)

| Task Của Sơn | Phụ Thuộc `L` | Đầu Vào Từ `L` & Cách Sơn Sử Dụng |
|---|---|---|
| **S01** (Admin shell/router & auth-state) | `L03`, `L04`, `L12` | - Import [`LONG_ADMIN_ROUTE_PATHS`](file:///home/endministrator/BT01/apps/web/src/features/admin/long-route-meta.ts#L1-L5) và [`LONG_ADMIN_NAV_ITEMS`](file:///home/endministrator/BT01/apps/web/src/features/admin/long-route-meta.ts#L14-L36) từ `apps/web/src/features/admin/long-route-meta.ts` để hiển thị menu điều hướng cho `ADMIN`.<br>- Mount component [`LongAdminRoutes`](file:///home/endministrator/BT01/apps/web/src/features/admin/long-routes.tsx#L15-L29) từ `apps/web/src/features/admin/long-routes.tsx` vào `apps/web/src/app/router.tsx` cho 3 đường dẫn `/admin/units` (`P06`), `/admin/contracts` (`P07`), `/admin/approvals` (`P08`). |
| **S02** (Danh sách giải `P01` + capabilities FE/BE) | `L01` | - Sử dụng [`TournamentDtoSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L636-L669) và [`TournamentStatusSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L50-L60) từ `@ottv2/contracts`.<br>- Gọi endpoint `GET /api/tournaments?contractId=&status=&ownerTaUserId=` (hoặc phương thức `tournamentAdminApi.listTournaments()` trong [tournamentAdminApi.ts](file:///home/endministrator/BT01/apps/web/src/features/admin/services/tournamentAdminApi.ts)). Endpoint này đã tự động lọc quyền đa thuê bao (`T004`). |
| **S03** & **S04** (Wizard nháp cơ bản `P02` & các nhóm form) | `L01`, `L02` | - Dùng các schema [`CreateTournamentDraftInputSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L672-L677), [`PatchTournamentDraftInputSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L681-L686), [`TournamentCoreConfigSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L454-L499) và hàm [`validateTournamentCoreConfigSemantics`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L517-L598) từ `@ottv2/contracts`.<br>- Gọi các API đã sẵn sàng:<br>  + `POST /api/tournaments/drafts` (tạo bản nháp + giữ chỗ quota hợp đồng)<br>  + `PATCH /api/tournaments/:tournamentId` (cập nhật bản nháp có kiểm tra `expectedRevision` CAS)<br>  + `DELETE /api/tournaments/:tournamentId` (xóa bản nháp + hoàn trả quota 1 lần)<br>  + `POST /api/tournaments/:tournamentId/copy-to-draft` (tạo bản nháp mới từ giải bị `REJECTED`) |
| **S05** (Trang chi tiết giải `P03` & panel readiness) | `L03`, `L05`, `L07` | - Dùng [`TournamentReadinessSnapshotSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L761-L776) từ `@ottv2/contracts`.<br>- Gọi các API vòng đời đã sẵn sàng:<br>  + `GET /api/tournaments/:tournamentId` (trả về `{ tournament, configVersions }`)<br>  + `GET /api/tournaments/:tournamentId/readiness` (trả về `{ readiness }` với `checklist`, `blockers`, `canOpenScheduled`, `canStartRunning`, `canFinalize`)<br>  + `POST /api/tournaments/:tournamentId/open-scheduled`<br>  + `POST /api/tournaments/:tournamentId/start`<br>  + `POST /api/tournaments/:tournamentId/pause` (body `{ reason, expectedRevision? }`)<br>  + `POST /api/tournaments/:tournamentId/resume`<br>  + `POST /api/tournaments/:tournamentId/cancel` (body `{ reason, expectedRevision? }`)<br>  + `POST /api/tournaments/:tournamentId/finalize` |
| **S06** (Audit viewer `P14` FE/BE & nối readiness core) | `L02`, `L05` | - Dùng [`AuditLogRecordSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L868-L886) từ `@ottv2/contracts`.<br>- Gọi `GET /api/admin/audit-logs?targetType=&targetId=` (hoặc `tournamentAdminApi.listAuditLogs()`). Toàn bộ `beforeSnapshot` / `afterSnapshot` đã được khử nhạy cảm sâu. |
| **S07** (Nối `RuleEditor V1` vào wizard & submit) | `L04`, `L05` | - Khi giải ở `DRAFT` / `CHANGES_REQUESTED`: gọi `POST /api/tournaments/:tournamentId/submit` (`SubmitTournamentDraftInputSchema`).<br>- Khi giải đã `APPROVED` / `SCHEDULED` / `RUNNING` / `PAUSED`:<br>  + Nếu sửa trong khung hợp đồng: gọi `POST /api/tournaments/:tournamentId/rule-versions` (`PublishWithinEnvelopeRuleUpdateInputSchema`).<br>  + Nếu sửa ngoài khung hoặc sửa `coreConfig`: gọi `POST /api/tournaments/:tournamentId/change-requests` (`CreateTournamentChangeRequestInputSchema`). |

---

### 3.2. Dành Cho Luồng Của ĐỨC (`D01`, `D02`, `D03`, `D04`, `D06`, `D08`)

| Task Của Đức | Phụ Thuộc `L` | Đầu Vào Từ `L` & Cách Đức Sử Dụng |
|---|---|---|
| **D01** & **D02** (Auth/tenant guard & Bootstrap/TA account `P09`) | `L01`, `L02` | - Các DTO nền tảng của Đức đã được xuất sẵn tại [d00.dto.ts](file:///home/endministrator/BT01/packages/contracts/src/account/d00.dto.ts) (`PrincipalSummarySchema`, `AccountOnboardingDTOSchema`, `RosterImportRowDTOSchema`, `StaffInvitationDTOSchema`, `SupportRequestDTOSchema`) và re-export qua `@ottv2/contracts`.<br>- Các model Prisma `SystemRoleAssignment`, `AccountClaimToken`, `RosterImportBatch`, `RosterImportStageRow`, `SupportRecoveryTicket` đã được khai báo trong [schema.prisma](file:///home/endministrator/BT01/prisma/schema.prisma) và [migration.sql](file:///home/endministrator/BT01/prisma/migrations/20261021100000_l01_tournament_initialization/migration.sql).<br>- Để cấp/thu hồi quyền `ADMIN` trong bộ nhớ runtime, gọi `store.grantSystemRole(userId, "ADMIN")` / `store.revokeSystemRole(userId, "ADMIN")`.<br>- Để ghi audit không lộ mật khẩu/token kích hoạt, gọi `store.audit.append(...)` ([`AuditPort`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-foundation/audit.port.ts#L82-L89)). |
| **D03** & **D04** (Roster + preview CSV/XLSX `P10` & Import commit worker) | `L01`, `L02` | - Sử dụng [`CoreDraftService.enrollParticipant`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/core-draft.service.ts#L610-L751) (hoặc ghi vào `store.enrollments` dưới khóa `store.withLock`) để tự động kiểm tra đồng thời:<br>  + Trần thí sinh mỗi giải (`min(tournament.coreConfig.maxParticipants, contract.maxParticipantsPerTournament)`) — mã lỗi `TOURNAMENT_PARTICIPANT_CAP_EXCEEDED` (`T015`)<br>  + Tổng trần thí sinh toàn hợp đồng (`contract.maxParticipantsTotal`) — mã lỗi `CONTRACT_TOTAL_PARTICIPANT_CAP_EXCEEDED` (`T016`)<br>  + Phạm vi đơn vị `INTERNAL_UNIT` (`allowedUnitCodes`) và chống trùng `personKey` (`DUPLICATE_PERSON_KEY`). |
| **D06** (Nhân sự / Referee invite `P11` / `P17`) | `L01`, `L03`, `L06` | - Dùng [`TournamentStaffAssignmentSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L789-L802) từ `@ottv2/contracts`.<br>- Khi Referee/Staff chấp nhận lời mời (`status: "ACTIVE"`), cập nhật vào `store.staffAssignments`:<br>  + [`TournamentLifecycleService.evaluateReadiness`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/lifecycle.service.ts#L361-L527) sẽ tự động đếm `activeRefereeCount` và `activeStaffCount`.<br>  + [`AdmissionGateService.evaluateAdmission`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/admission-gate.service.ts#L22-L209) sẽ tự động cho phép `REFEREE_JOIN_ROOM` trên đúng các phòng thuộc `assignedRoomIds` (hoặc toàn giải nếu `assignedRoomIds` rỗng) và chặn `403` nếu truy cập phòng ngoài phạm vi. |
| **D08** (Ack điều lệ / expiry / retention `P11` / `P18`) | `L07` | - Đọc `tournament.activeConfigVersionId`, `tournament.activeConfigVersionNumber`, `tournament.endedAt`, `tournament.finalizedAt` từ [`CoreDraftService.getTournament`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/core-draft.service.ts#L753-L764) để đối chiếu phiên bản điều lệ thí sinh đã xác nhận (`rules_ack`) và mốc hết hạn sau khi giải kết thúc (`ENDED` / `ARCHIVED`). |

---

### 3.3. Dành Cho Luồng Của NAM (`N02`, `N04`, `N06`, `N08`, `N09`, `N10`, `N11`)

| Task Của Nam | Phụ Thuộc `L` | Đầu Vào Từ `L` & Cách Nam Sử Dụng |
|---|---|---|
| **N02** (API validate/preview & tính khả thi ban đầu `P04`) | `L01` | - Sử dụng [`TournamentRuleProfileSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L168-L216), [`DEFAULT_TOURNAMENT_RULE_PROFILE`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L220-L237), [`ContractPolicyEnvelopeSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L130-L152) và hàm [`evaluateRuleProfileEnvelope(ruleProfile, envelope)`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L244-L320) từ `@ottv2/contracts`. |
| **N04** (Comparator & API version/publish `P04` / `P05`) | `L02`, `L05` | - Gọi [`TournamentLifecycleService.publishWithinEnvelopeRuleUpdate`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/lifecycle.service.ts#L215-L355) hoặc endpoint `POST /api/tournaments/:tournamentId/rule-versions`. Dịch vụ này đã kiểm tra `effectiveAt >= serverNow`, kiểm tra `evaluateRuleProfileEnvelope`, tạo bản ghi bất biến `TournamentConfigVersion` (`v(N+1)`) và ghi audit `RULE_VERSION_PUBLISHED`. |
| **N06** & **N08** (SDK/runtime adapter, receipts & trang trạng thái Bot `P16`) | `L01`, `L05` | - Đọc `contract.technicalCaps` (`botSourceMaxBytes`, `botRuntimeTimeoutMs`, `botMemoryLimitMb`) từ [`TournamentContractSchema`](file:///home/endministrator/BT01/packages/contracts/src/tournament-initialization.ts#L387-L419).<br>- Khi preflight Bot hoàn tất, cập nhật `enrollment.botReadinessStatus` (`"READY"` / `"FAILED"` / `"PENDING"`) và `enrollment.pinnedBotRevisionId` trong `store.enrollments`. [`TournamentLifecycleService.evaluateReadiness`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/lifecycle.service.ts#L373-L390) sẽ tự động chặn mở giải `BOT_VS_BOT` / `HYBRID` nếu còn thí sinh có `botReadinessStatus !== "READY"`.<br>- Khi tạo trận đấu mới, gọi [`AdmissionGateService.pinMatchConfigVersion`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/admission-gate.service.ts#L225-L276) để ghim phiên bản luật cho trận đó (`T062`). |
| **N09** & **N10** (Trang xem/phân xử exact-tie `P05` & Regression engine-to-settlement) | `L08` | - Khi engine kết thúc trận bình thường: gọi [`AdjudicationLedgerService.recordNormalMatchFinish`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/adjudication-ledger.service.ts#L599-L619) để cấp `finishSequence` và tính điểm/Elo tức thì.<br>- Khi engine gặp hòa tuyệt đối (`MANUAL_REFEREE`): gọi [`AdjudicationLedgerService.openManualAdjudicationRequest`](file:///home/endministrator/BT01/apps/server/src/modules/tournament-core/adjudication-ledger.service.ts#L381-L449) để tạo yêu cầu `WAITING` (snapshot đã tự động được khử nhạy cảm qua `sanitizeAuditSnapshot`).<br>- Giao diện `P05` của Nam gọi:<br>  + `GET /api/tournaments/:tournamentId/adjudications` (lấy danh sách phán quyết + tự động quét các yêu cầu quá hạn qua `fallbackPolicy`)<br>  + `POST /api/tournaments/adjudications/:adjudicationRequestId/verdict` (Owner TA gửi phán quyết `BLUE` / `RED` + `reason`)<br>  + `GET /api/tournaments/:tournamentId/leaderboard` (lấy bảng xếp hạng chuẩn theo `finishSequence`). |
| **N11** (Review UI Đơn vị/Hợp đồng/Duyệt và backend của Long) | `L09`, `L10` | - Toàn bộ các điểm lưu ý trong [L11-cross-review-nam.md](file:///home/endministrator/BT01/docs/tournament-initialization/long/L11-cross-review-nam.md) và báo cáo kiểm thử [tdd-evidence.md](file:///home/endministrator/BT01/docs/tournament-initialization/long/tdd-evidence.md) đã sẵn sàng để Nam đối chiếu. |

---

## PHẦN 4 — LỆNH KIỂM CHỨNG NHANH DÀNH CHO CÁC THÀNH VIÊN TIẾP NHẬN

```bash
# 1. Chạy toàn bộ 5 bộ test của luồng L (Contract, Unit, Concurrency, Admin UI, E2E HTTP)
corepack pnpm vitest run \
  tests/contract/tournament-l01.contract.test.ts \
  tests/unit/tournament-l02-l08.unit.test.ts \
  tests/unit/tournament-l09-concurrency.unit.test.ts \
  tests/integration/tournament-l10-e2e-flow.integration.test.ts

corepack pnpm --filter @ottv2/web exec vitest run src/features/admin/admin-pages.test.tsx

# 2. Kiểm tra Typecheck, Lint và Build toàn bộ monorepo
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```
