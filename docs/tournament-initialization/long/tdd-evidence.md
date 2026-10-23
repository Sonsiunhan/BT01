# Bằng Chứng Kiểm Thử TDD & Verification Loop (`L01`–`L13`)

## 1. Kết Quả Chạy Kiểm Thử Chuyên Biệt Cho Khởi Tạo Giải Đấu

- **Contract Tests (`L01`):** `tests/contract/tournament-l01.contract.test.ts` — **8/8 PASS**
  - Hợp nhất toàn diện tại cổng `G1`: chuẩn hóa mã đơn vị/hợp đồng/giải đấu, ràng buộc thời gian, công thức `quotaRemainingCount`, kiểm tra `evaluateRuleProfileEnvelope`, bộ schema/fixtures `D00`, bộ chính sách & DTO `N00`, bộ Console DTO `S00`, và kiểm tra tính chất expand-only của migration SQL cùng cổng bảo vệ DB tạm (`disposable-db.mjs`).
- **Unit & Domain Security Tests (`L02`–`L08`):** `tests/unit/tournament-*.unit.test.ts` — **11 test files (44/44 PASS)**
  - `tournament-l02-foundation.unit.test.ts` (2 tests PASS)
  - `tournament-l02-l08.unit.test.ts` (3 tests PASS)
  - `tournament-l05-lifecycle-readiness.unit.test.ts` (5 tests PASS)
  - `tournament-l06-admission-gate.unit.test.ts` (5 tests PASS)
  - `tournament-l07-pause-cancel-end.unit.test.ts` (4 tests PASS)
  - `tournament-l08-adjudication-ledger.unit.test.ts` (6 tests PASS)
  - `tournament-rules-preview.service.unit.test.ts` (4 tests PASS)
  - `tournament-rules-preview.unit.test.ts` (2 tests PASS)
  - `tournament-goals.unit.test.ts` (4 tests PASS)
  - `n11-safe-admin-errors.unit.test.ts` (2 tests PASS)
- **Concurrency & Race Tests (`L09`):** `tests/unit/tournament-l09-concurrency.unit.test.ts` — **7/7 PASS**
  - Tranh chấp suất quota cuối cùng (`T011`), tranh chấp cập nhật bản nháp CAS (`expectedRevision`), tranh chấp gửi duyệt + chỉnh sửa đồng thời, tranh chấp phán quyết thủ công (`T060`), kết thúc trận đồng thời tạo `finish_sequence` liên tục không trùng lặp (`T072`/`T081`), ghim phiên bản luật tại ranh giới thời gian (`T062`), và quét timeout tự động vs nộp phán quyết đồng thời.
- **Frontend Admin UI Tests (`L03`–`L04`):** `apps/web/src/features/admin/admin-pages.test.tsx` — **5/5 PASS**
  - Kiểm thử đầy đủ các trang `P06` (`UnitsAdminPage`), `P07` (`ContractsAdminPage`), `P08` (`ApprovalsAdminPage`) và metadata định tuyến chuẩn.
- **End-to-End Fastify HTTP Integration Tests (`L10`):** `tests/integration/tournament-l10-e2e-flow.integration.test.ts` — **1/1 luồng E2E toàn trình PASS**
  - Kiểm chứng toàn bộ chu trình HTTP từ chặn truy cập trái phép `403` trên `/api/admin/*`, tạo Đơn vị (`P06`), tạo Hợp đồng & gán TA (`P07`), tạo Bản nháp, gửi duyệt, Admin phê duyệt (`P08`), tạo & duyệt `ChangeRequest`, phát hành phiên bản luật mới, mở đăng ký, bắt đầu giải, chặn Guest/Admin/Outsider qua cổng `C32`, xử lý phán quyết thủ công, tính bảng xếp hạng theo `finish_sequence`, tự động kết thúc giải, chốt giải và kiểm tra nhật ký kiểm toán đã khử dữ liệu nhạy cảm.
- **Review Chéo & Giao Diện Phán Quyết Nam (`L11`):**
  - `apps/web/src/features/admin/tournaments/ManualAdjudicationPage.test.tsx` — **4/4 PASS**
  - `tests/integration/n10-engine-settlement.integration.test.ts` — **3/3 PASS**
  - `tests/integration/n10-engine-adapter.integration.test.ts` — **2/2 PASS**

## 2. Kết Quả Các Cổng Chất Lượng Toàn Monorepo (`verification-loop`)

- `corepack pnpm run typecheck`: **PASS** (0 errors toàn bộ workspace).
- `corepack pnpm run lint`: **PASS** (0 errors, 0 warnings trên toàn bộ monorepo).
- `corepack pnpm run build`: **PASS** (biên dịch thành công toàn bộ packages, server và web bundle).
- `corepack pnpm release:gate`: **PASS** (Route inventory: 59 entries audited, Initial JS: 69.5 KB gzip, Total JS: 323.9 KB gzip / 324 KB budget).
- `santa-method` Dual Review: **PASS** (`typescript-reviewer`: **PASS (APPROVED)**, `security-reviewer`: **PASS (NICE)**).
