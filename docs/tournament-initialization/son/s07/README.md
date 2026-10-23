# S07 — Nối RuleEditor V1 vào Wizard và Submit

## 1. Thông tin chung
- **Task ID:** S07
- **Người thực hiện:** Sơn
- **Thời gian:** 2026-10-22 -> 2026-10-23
- **Trạng thái:** IN_PROGRESS
- **Phạm vi giao diện:** P02 (Tournament Wizard / Chỉnh sửa nháp), P03 (Tournament Detail / Chi tiết giải đấu)
- **Dependencies:** N05 (RuleEditor V1 & preview API), S04 (Form groups & schedule wizard), L05 (Core draft lifecycle & Submit endpoint)

## 2. Mục tiêu trọng tâm
1. **Nối RuleEditor V1 vào Wizard (P02):**
   - Giữ duy nhất một `ruleProfile` chuẩn hoá, không duplicate engine logic về client.
   - Đồng bộ cấu hình luật giữa form draft và `TournamentRuleManagementPanel`.
2. **Triển khai luồng Nộp duyệt giải đấu (`POST /api/tournaments/:tournamentId/submit`):**
   - Mở rộng `TournamentApiPort` và `TournamentApiClient` với phương thức `submitDraft`.
   - Tích hợp nút "Nộp duyệt giải đấu" (`wizard-submit-draft-btn` và `action-submit-draft-btn`) với `SubmitTournamentDraftInputSchema` (`expectedRevision`, `submissionNote`).
   - Xử lý chuyển đổi trạng thái sang `UNDER_REVIEW` (Đang chờ phê duyệt) và khóa chỉnh sửa an toàn khi đang duyệt.
   - Bắt và hiển thị lỗi tranh chấp OCC (HTTP 409 Conflict) rõ ràng.

## 3. Cấu trúc tài liệu đính kèm
- `README.md`: Tổng quan nghiệp vụ và ranh giới trách nhiệm.
- `implementation_plan.md`: Kế hoạch chi tiết theo quy trình Chuẩn (Plan -> Harness -> Dev -> Test -> Review).
- `S07-DESIGN.md`: Thiết kế kỹ thuật, luồng dữ liệu và hợp đồng API.
- `S07-ACCEPTANCE.md`: Bộ tiêu chí nghiệm thu từ AC-01 đến AC-05.
- `S07-RESULT-2026-10-22.md`: Báo cáo kết quả và bằng chứng kiểm thử tự động.
