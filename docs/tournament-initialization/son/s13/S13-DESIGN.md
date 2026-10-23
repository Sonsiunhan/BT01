# Thiết Kế Nghiệm Thu Bàn Giao Phát Hành Mảng Sơn (S13)

## 1. Phương Pháp Luận Bàn Giao
Task **S13** là bước chốt cuối cùng trong toàn bộ chuỗi công việc của Sơn (`S00`–`S13`), bảo đảm rằng:
1. Sản phẩm giao diện bàn giao không phải là nguyên mẫu (prototype) hay fixture tạm thời, mà là mã nguồn hoàn chỉnh đã tích hợp với backend thực tế, rào chắn bảo mật và cơ chế chống lỗi.
2. Tất cả các trang được kiểm thử đa dạng góc nhìn:
   - Đơn vị (Unit test): Kiểm tra tính nhất quán thuộc tính, test-id, invariants.
   - Trực quan & Tương tác (Playwright E2E): Kiểm tra luồng người dùng thật trên trình duyệt Chromium.
   - Tiếp cận (Accessibility): Đạt chuẩn WCAG 2.1 AA không có vi phạm critical/serious.
   - Thích ứng màn hình (Responsive): Kiểm tra trên cả 3 viewports: Mobile 375px, Tablet 768px, Desktop 1440px.

---

## 2. Danh Mục Kiểm Tra Phát Hành (Release Checklist)

- [x] **P01 — Danh sách giải đấu:**
  - Bộ lọc trạng thái (Tất cả, Nháp, Đang diễn ra, Đã kết thúc).
  - Tìm kiếm theo tên / slug / mã giải.
  - Nút "Tạo giải đấu" dẫn tới `/admin/tournaments/new`.
  - Responsive không tràn chiều ngang trên mobile.
- [x] **P02 — Wizard tạo giải đấu nháp:**
  - Quy trình 4 bước tuần tự.
  - Tích hợp Rule Editor V1 (Nam) tại Bước 4.
  - Modal nộp duyệt với ghi chú tùy chọn.
  - Giữ lại bản nháp khi nộp duyệt thất bại.
- [x] **P03 — Chi tiết giải đấu & Điều hành:**
  - 5 liên kết phân hệ: Rules, Roster, Staff, Bot Readiness, Audit.
  - Tab Sẵn sàng (Readiness) hiển thị các điều kiện tiên quyết.
  - Tab Cấu hình (Config) hiển thị các thông số cố định.
- [x] **P14 — Nhật ký kiểm toán:**
  - Hỗ trợ chế độ toàn cục và theo từng giải đấu.
  - Bộ lọc đối tượng và người thực hiện.
  - Loại bỏ hoàn toàn mã băm mật khẩu và token nhạy cảm.
- [x] **P15 — Trung tâm công cụ Offline:**
  - 4 lối vào thi đấu: Kho Bot, Bot – Bot, Người – Bot, Người – Người.
  - Banner công bố chính sách bảo mật Sandbox Web Worker.
