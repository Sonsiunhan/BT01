# S02-ACCEPTANCE — Ma trận tiêu chí nghiệm thu Task S02

## 1. Tiêu chí bắt buộc (Acceptance Criteria)

| Mã AC | Tiêu chí nghiệm thu | Phương thức kiểm tra | Kết quả mong đợi |
|---|---|---|---|
| **AC-01** | Render lưới thẻ giải đấu (Tournament Cards) | Vitest Unit test | Thẻ hiển thị đúng tên, mã slug, trạng thái, lịch thi đấu, đơn vị và số blocker. |
| **AC-02** | Tìm kiếm theo tên hoặc mã slug | Vitest Unit test | Danh sách thẻ lọc tức thì/chính xác theo từ khóa nhập vào. |
| **AC-03** | Lọc theo Tab trạng thái vòng đời | Vitest Unit test | Chọn tab (ví dụ "Bản nháp", "Đang diễn ra") chỉ hiển thị giải đấu khớp với nhóm trạng thái. |
| **AC-04** | Trạng thái rỗng P01.empty | Vitest Unit test | Khi hệ thống chưa có giải đấu nào: Hiển thị card hướng dẫn và nút tạo giải đấu đầu tiên. |
| **AC-05** | Trạng thái không tìm thấy P01.no-results | Vitest Unit test | Khi tìm kiếm không khớp: Hiển thị thông báo và nút "Xóa bộ lọc" để phục hồi danh sách. |
| **AC-06** | Trạng thái lỗi mạng / Server error | Vitest Unit test | Hiển thị thông báo lỗi an toàn và nút "Thử lại". |
| **AC-07** | Quản lý quyền nút "Tạo giải đấu" | Vitest Unit test | Hiển thị link dẫn đến `/admin/tournaments/new` khi có quyền `tournament.create`; hiển thị disabled kèm giải thích khi thiếu quyền. |
| **AC-08** | Điều hướng chính xác | Vitest Unit test | Click nút trên thẻ chuyển đúng đến trang xem chi tiết (`/admin/tournaments/:id`) hoặc sửa nháp (`/admin/tournaments/:id/edit`). |
| **AC-09** | Tích hợp Router | Vitest Smoke / Build | Trang được lazy-load tại `/admin/tournaments` trong `router.tsx` và build bundle code-split thành công. |
