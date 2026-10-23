# Thiết Kế Kiểm Tra Role, URL Trực Tiếp Và Trạng Thái Lỗi (S12)

## 1. Kiến Trúc Bảo Vệ Đa Lớp (Defense in Depth)

### 1.1 Tầng Shell Client (React Router & Guards)
- Mọi route `/admin/*` đều được bọc bên trong `AdminCapabilityGuard`.
- Khi người dùng chưa đăng nhập, `AdminCapabilityGuard` chặn render các trang con bên trong `Outlet`, hiển thị cảnh báo `admin-guard-unauthenticated` và nút "Đăng nhập ngay" trỏ đến `/login?returnUrl=...`.
- Hàm `loginReturnPath` mã hóa URL hiện tại vào query param an toàn, tự động chuyển người dùng quay lại đúng trang họ đang muốn truy cập sau khi xác thực thành công.

### 1.2 Tầng API Máy Chủ (Authoritative Enforcement)
- Không có bất kỳ logic cấp quyền nào dựa vào client-side state.
- Máy chủ Fastify kiểm tra session qua HttpOnly cookie:
  - Tài khoản có vai trò `ADMIN` gọi endpoint hàng đợi `/matchmaking/queue` hoặc phòng chơi `/rooms`: lập tức trả về `403 ADMIN_CANNOT_PLAY_ONLINE`.
  - Người dùng không có vai trò `SYSTEM_ADMIN` gọi `/api/admin/ta`: trả về `403 FORBIDDEN_ROLE`.
  - Thí sinh gọi API thay đổi Roster hoặc Staff: trả về `403 FORBIDDEN`.

### 1.3 Cơ chế Bảo Toàn Bản Nháp (Draft Preservation)
- Trong `TournamentWizardPage.tsx`, state `draft` và các nhóm form được quản lý độc lập với trạng thái gửi request (`isSubmitting`, `submitError`).
- Khi nộp duyệt giải đấu hoặc kiểm tra luật thất bại:
  - `submitError` nhận thông điệp lỗi an toàn để hiển thị trên modal.
  - Form không kích hoạt `reset()`, toàn bộ dữ liệu người dùng đã điền ở Bước 1 (Tên, slug, hợp đồng), Bước 2 (Lịch trình, điều kiện), Bước 3 (Luật đấu) vẫn nguyên vẹn.
