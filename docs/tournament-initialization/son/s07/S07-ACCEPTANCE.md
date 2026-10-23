# S07 — Acceptance Criteria: Nối RuleEditor V1 vào Wizard và Submit

Bộ tiêu chí nghiệm thu tự động cho S07 (AC-01 đến AC-05):

| Mã AC | Tiêu chí nghiệm thu | Bằng chứng kiểm thử |
|---|---|---|
| **AC-01** | `TournamentApiPort` và `TournamentApiClient` hỗ trợ đầy đủ `submitDraft(tournamentId, input)` với `SubmitTournamentDraftInputSchema` (`expectedRevision`, `submissionNote`). | `tests/unit/s07-rule-editor-wizard.unit.test.ts` |
| **AC-02** | Wizard (P02) hiển thị nút "Nộp duyệt giải đấu" (`wizard-submit-draft-btn`) khi bản nháp đã được lưu trên máy chủ (có `tournamentId`). | `apps/web/src/features/admin/tournaments/TournamentWizardPage.test.tsx` |
| **AC-03** | Khi người dùng xác nhận nộp duyệt, client gửi yêu cầu kèm `expectedRevision` chính xác và ghi chú nộp duyệt; xử lý lỗi 409 Conflict bằng banner cảnh báo thân thiện. | `TournamentWizardPage.test.tsx` |
| **AC-04** | Sau khi nộp duyệt thành công, trạng thái hiển thị được cập nhật sang `UNDER_REVIEW`, giao diện thông báo thành công và khóa các trường nhập liệu chống chỉnh sửa trái phép. | `TournamentWizardPage.test.tsx` |
| **AC-05** | Trang Chi tiết giải đấu (P03) cung cấp nút nộp duyệt trực tiếp (`action-submit-draft-btn`) khi giải ở trạng thái `DRAFT` hoặc `CHANGES_REQUESTED`. | `TournamentDetailPage.test.tsx` |
