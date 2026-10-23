# Kế hoạch triển khai S09: Hoàn thiện UI và Tích hợp Rule Widget Bản Cuối

## 1. Mục tiêu và phạm vi
- **Mã công việc:** S09 (Hoàn thiện UI và tích hợp rule widget bản cuối).
- **Phụ trách:** Sơn.
- **Ranh giới:**
  - `apps/web/src/features/admin/tournaments/*`: Tinh chỉnh `TournamentDetailPage.tsx`, `TournamentWizardPage.tsx`, `TournamentRulesPage.tsx`.
  - `apps/web/src/app/router.tsx` & `apps/web/src/app/routes.ts`: Rà soát và kết nối đầy đủ các route ACK điều lệ và Bot readiness.
  - `tests/unit/s09-ui-polish.unit.test.ts` & `TournamentDetailPage.test.tsx`.
  - `docs/tournament-initialization/son/s09/*`: Bộ tài liệu S09 hoàn chỉnh.
  - **TUYỆT ĐỐI KHÔNG SỬA PHẦN NGƯỜI KHÁC:** Không can thiệp mã nguồn server hay contract của Long, Nam, Đức.

---

## 2. Quy trình chuẩn 5 bước (Plan → Harness → Dev → Test → Review)

### Bước 1: Kế hoạch (Plan)
- Khảo sát các tài sản đã hoàn thành:
  - N07 đã xuất `TournamentRuleManagementPanel` và `TournamentRulesPage`.
  - D08 đã xuất `RulesAcknowledgementPage` và `tournamentRulesAcknowledgement` route.
  - N08 đã xuất `BotReadinessPage` và `adminTournamentBotReadiness` route.
  - D07 đã xuất `SupportRecoveryPage` và `adminSupport` route.
- Xác định điểm cần hoàn thiện:
  - Trên P03 `TournamentDetailPage`: Bổ sung liên kết `routes.adminTournamentRoster` (`action-roster-btn`) để đủ trọn vẹn 5 phân hệ vận hành.
  - Trên P02 `TournamentWizardPage`: Đồng bộ tiêu đề Bước 4 ("Tổng quan & Luật") và giữ vững `TournamentRuleManagementPanel`.
  - Rà soát Keyboard / Focus / ARIA / Theme / Responsive tokens.

### Bước 2: Dựng Harness kiểm thử (Harness)
- Tạo test harness `tests/unit/s09-ui-polish.unit.test.ts` kiểm thử toàn diện các tiêu chí AC-01 đến AC-05.
- Cập nhật test case 7 trong `TournamentDetailPage.test.tsx` kiểm tra đủ 5 nút điều hướng.

### Bước 3: Phát triển (Dev)
- Tinh chỉnh `TournamentDetailPage.tsx`: Thêm nút liên kết "Vận động viên / Roster" (`action-roster-btn`).
- Cập nhật tab label Bước 4 trong `TournamentWizardPage.tsx`.
- Đảm bảo các thuộc tính `aria-live`, `aria-selected`, `aria-controls` và vai trò bàn phím được gắn đầy đủ.

### Bước 4: Kiểm thử (Test)
- Chạy unit tests: `npx vitest run tests/unit/s09-ui-polish.unit.test.ts`.
- Chạy web component tests: `npx vitest run src/features/admin/tournaments/TournamentDetailPage.test.tsx`.
- Chạy toàn bộ test suites của monorepo: `pnpm test` và `pnpm run typecheck`.

### Bước 5: Đánh giá & Bàn giao (Review & Clean)
- Đối chiếu giao diện với hướng dẫn phong cách Robot Lab.
- Kiểm tra tính độc lập, không xâm phạm file của các thành viên khác.
- Lập báo cáo `S09-RESULT-2026-10-23.md`.
