# Bằng Chứng Kiểm Thử TDD & Verification Loop (`L01`–`L13`)

## 1. Kết Quả Chạy Kiểm Thử Chuyên Biệt Cho Khởi Tạo Giải Đấu

- **Contract Tests (`L01`):** `tests/contract/tournament-l01.contract.test.ts` — **9/9 PASS**
  - Hợp nhất toàn diện `N00 + S00 + L00 + D00` tại cổng `G1`: chuẩn hóa mã đơn vị/hợp đồng/giải đấu, ràng buộc thời gian, công thức `quotaRemainingCount`, kiểm tra `evaluateRuleProfileEnvelope`, bộ schema/fixtures `D00` (`AccountOnboardingDTOSchema`, `RosterImportRowDTOSchema`, `StaffInvitationDTOSchema`, `SupportRequestDTOSchema`, `PrincipalSummarySchema`, `D00AccountTtlConfigSchema`, `D00_SYNTHETIC_FIXTURES`), bộ chính sách & DTO `N00` (`G1_APPROVED_POLICY_DEFAULTS_V1`, `G1_CAPABILITIES_LIMITS_REGISTRY`, `RAY`/`LEAP`, toạ độ `{ fileIndex, rankIndex }`, `ResolutionSnapshot`, `IncidentView`, `ExtensionRequestView`), bộ Console DTO `S00` (`ConsoleShellView`, `MatchCenterView`, `OfflineHubView`, `MutationEnvelope`, `AuthoritativeAck`), bộ hợp đồng `L00` (`RequestContext`, `ResourceMeta`, `SnapshotRef`, `ApprovalRequestView`), và kiểm tra tính chất expand-only của migration SQL (20 bảng + cột `Match`) cùng cổng bảo vệ DB tạm (`disposable-db.mjs`).
- **Unit & Domain Security Tests (`L02`–`L08`):** `tests/unit/tournament-l02-l08.unit.test.ts` — **3/3 bộ kịch bản lớn PASS**
  - `T002` (chặn xóa đơn vị đang được tham chiếu), `T006`/`T008`/`T018` (phân quyền TA theo hợp đồng và thu hồi quyền), `T077` (khử nhạy cảm sâu `SanitizingAuditService` + `deepFreeze`), `T011`–`T016` (hạn mức hợp đồng & trần thí sinh), `T022`–`T024` (duyệt giải, tạo bản sao từ giải bị từ chối, tách biệt `ChangeRequest`), `T061` (phát hành luật trong khung hợp đồng), `T025`–`T030` (readiness, tạm dừng, tự động kết thúc, hủy giải, chốt giải), `T005`/`T075` (cổng C32), `T062` (ghim phiên bản luật cho trận đang chạy), `T059`/`T060` (ACL phán quyết thủ công & tự động áp dụng `fallbackPolicy` khi quá hạn), `T072`/`T073`/`T081` (tính lại bảng xếp hạng tất định theo `finish_sequence`).
- **Concurrency & Race Tests (`L09`):** `tests/unit/tournament-l09-concurrency.unit.test.ts` — **5/5 PASS**
  - Tranh chấp suất quota cuối cùng (`T011`), tranh chấp cập nhật bản nháp CAS (`expectedRevision`), tranh chấp gửi duyệt + chỉnh sửa đồng thời, tranh chấp phán quyết thủ công (`T060`), và kết thúc trận đồng thời tạo `finish_sequence` liên tục không trùng lặp (`T072`/`T081`).
- **Frontend Admin UI Tests (`L03`–`L04`):** `apps/web/src/features/admin/admin-pages.test.tsx` — **5/5 PASS**
  - Kiểm thử đầy đủ các trang `P06` (`UnitsAdminPage`), `P07` (`ContractsAdminPage`), `P08` (`ApprovalsAdminPage`) và metadata định tuyến (`long-route-meta.ts`, `long-routes.tsx`).
- **End-to-End Fastify HTTP Integration Tests (`L10`):** `tests/integration/tournament-l10-e2e-flow.integration.test.ts` — **1/1 luồng E2E toàn trình PASS**
  - Kiểm chứng toàn bộ chu trình HTTP từ chặn truy cập trái phép `403` trên `/api/admin/*`, tạo Đơn vị (`P06`), tạo Hợp đồng & gán TA (`P07`), tạo Bản nháp, gửi duyệt, Admin phê duyệt (`P08`), tạo & duyệt `ChangeRequest`, phát hành phiên bản luật mới, mở đăng ký, bắt đầu giải, chặn Guest/Admin/Outsider qua cổng `C32`, xử lý phán quyết thủ công, tính bảng xếp hạng theo `finish_sequence`, tự động kết thúc giải, chốt giải và kiểm tra nhật ký kiểm toán đã khử dữ liệu nhạy cảm.

## 2. Kết Quả Các Cổng Chất Lượng Toàn Monorepo (`verification-loop`)

- `corepack pnpm typecheck`: **PASS** (0 lỗi trên toàn bộ `packages/*` và `apps/*` với `strict: true` & `exactOptionalPropertyTypes: true`).
- `corepack pnpm lint`: **PASS** (0 lỗi, 0 cảnh báo với `--max-warnings 0`).
- `corepack pnpm build`: **PASS** (biên dịch thành công toàn bộ packages, `@ottv2/server` và `@ottv2/web`).
- `santa-method` Dual Review: **PASS** (`typescript-reviewer`: **PASS (APPROVED)**, `security-reviewer`: **PASS (NICE)**).
