# S09 — Hoàn thiện UI và Tích hợp Rule Widget Bản Cuối

## 1. Thông tin chung
- **Task ID:** S09
- **Người thực hiện:** Sơn
- **Thời gian:** 2026-10-23
- **Trạng thái:** DONE
- **Phạm vi giao diện:** P01 (Danh sách giải), P02 (Wizard nháp giải đấu), P03 (Chi tiết giải đấu), P14 (Nhật ký kiểm toán), P15 (Hub công cụ Offline)
- **Dependencies:** S07, S08, N05 (Giao diện ổn định RuleEditor V1), N07 (Rule widget bản cuối)

## 2. Mục tiêu trọng tâm
1. **Tích hợp hoàn chỉnh Rule Widget bản cuối:**
   - Kết nối `TournamentRuleManagementPanel` vào Bước 4 của Wizard nháp (P02).
   - Đảm bảo route P04 (`/admin/tournaments/:tournamentId/rules`) mở trực tiếp Bước 4 thông qua `<TournamentWizardPage initialStep={4} />`.
   - Giữ nguyên hợp đồng RuleProfile duy nhất, validate/preview trước khi công bố, và hiển thị diff phiên bản chi tiết.
2. **Đăng ký và nối các route mới (ACK Điều lệ & Trạng thái Bot):**
   - Đăng ký `routes.tournamentRulesAcknowledgement` (`/tournaments/:tournamentId/rules-ack/:contractId`) tới `<RulesAcknowledgementPage />`.
   - Đăng ký `routes.adminTournamentBotReadiness` (`/admin/tournaments/:tournamentId/bot-readiness`) tới `<BotReadinessPage />`.
   - Bổ sung nút liên kết `"Vận động viên / Roster"` (`action-roster-btn`) tới `routes.adminTournamentRoster` trên trang chi tiết giải đấu (P03).
3. **Chuẩn hóa giao diện & Tiêu chuẩn Robot Lab:**
   - Hoàn thiện khả năng truy cập bàn phím (`aria-live`, focus-visible, tab navigation).
   - Đảm bảo tính nhất quán của theme tokens (`--surface`, `--border`, `--text`, `--primary`, `--system-cyan`, `--elevation-card`).
   - Tối ưu hóa hiển thị di động / responsive (`grid`, `flex-wrap`).
   - Cấm triệt để nút vào hàng đợi người chơi Online trong Admin shell.

## 3. Cấu trúc tài liệu đính kèm
- `README.md`: Tổng quan và phạm vi công việc S09.
- `implementation_plan.md`: Kế hoạch 5 bước chuẩn (Plan -> Harness -> Dev -> Test -> Review).
- `S09-DESIGN.md`: Thiết kế kỹ thuật, luồng tích hợp Rule widget và liên kết phân hệ.
- `S09-ACCEPTANCE.md`: Bộ tiêu chí nghiệm thu từ AC-01 đến AC-05.
- `S09-RESULT-2026-10-23.md`: Báo cáo kết quả và bằng chứng kiểm thử tự động.
