# S03-ACCEPTANCE — Ma trận tiêu chí nghiệm thu Task S03

## 1. Tiêu chí bắt buộc (Acceptance Criteria)

| Mã AC | Tiêu chí nghiệm thu | Phương thức kiểm tra | Kết quả mong đợi |
|---|---|---|---|
| **AC-01** | Khởi tạo form 4 bước + Tự sinh Slug | Vitest Unit test & Component test | Nhập tên giải đấu tự động gợi ý mã slug chữ hoa hợp lệ (ví dụ: `GIAI_DAU_ROBOT_2026`). Cho phép điều hướng mượt mà giữa các bước 1 -> 2 -> 3 -> 4. |
| **AC-02** | Khả năng phục hồi dữ liệu Local Storage Buffer | Vitest Unit test | Tự động ghi nhớ các trường đã nhập vào Local Storage; khi mở lại trang, dữ liệu được phục hồi nguyên vẹn và cung cấp nút xóa đệm. |
| **AC-03** | Lưu bản nháp (Draft Save) qua API | Vitest Unit test & Component test | Khi nhấn "Lưu bản nháp", gọi đúng `createDraft` (với giải mới) hoặc `patchDraft` (với giải đang sửa), cập nhật revision phản hồi từ máy chủ. |
| **AC-04** | Xử lý xung đột phiên bản Optimistic Concurrency Control (OCC 409) | Vitest Unit test & Component test | Khi máy chủ trả về `409 Conflict`, giao diện hiển thị dải thông báo cảnh báo xung đột phiên bản kèm nút "Tải lại dữ liệu mới nhất". |
| **AC-05** | Tích hợp Route & Lazy Loading | Vitest Unit test & Build test | Cấu hình router cho `/admin/tournaments/new` và `/admin/tournaments/:id/edit`, build bundle thành công không lỗi TypeScript. |

---

## 2. Kiểm thử tự động tương ứng

- `tests/unit/s03-tournament-wizard.unit.test.ts`:
  - `AC-01`: Form 4 bước, auto-slug generator, chuyển bước hợp lệ.
  - `AC-02`: Lưu và khôi phục từ local draft buffer, xóa bộ đệm.
  - `AC-03`: Lưu bản nháp thành công và cập nhật revision.
  - `AC-04`: Bắt lỗi 409 CONFLICT và hiển thị banner OCC.
  - `AC-05`: Kiểm tra validation rule (bắt buộc tên, thời gian hợp lý, min <= max).
- `apps/web/src/features/admin/tournaments/TournamentWizardPage.test.tsx`:
  - Kiểm thử tương tác component trên React DOM, giả lập người dùng click, thay đổi input và submit.
