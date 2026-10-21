# S01 — Admin shell, router và tích hợp auth-state

| Thuộc tính | Giá trị |
|---|---|
| Task ID | **S01** |
| Chủ trang / Người thực hiện | **Sơn** |
| Khung giờ thực làm | **21/10/2026 09:00 – 10:00** (1 giờ) |
| Hạn nộp | **21/10/2026 10:00** |
| Trang liên quan | **P01** (Danh sách giải & Khung Admin), **P15** (Hub Offline) |
| Điều kiện tiên quyết | `S00` (PASS), `G0` (PASS) |
| Giao tiếp tiếp theo | `S02` (Danh sách giải), `L01` (Contracts & schema freeze) |

---

## 1. Mục tiêu và phạm vi của S01

S01 là bước hiện thực hóa đầu tiên trên mã nguồn ứng dụng (`apps/web/src`) sau khi Gate `G0` đã được thông qua và `S00` đã cung cấp đầy đủ thiết kế nền tảng:

1. **Cập nhật Route Registry (`apps/web/src/app/routes.ts`):**
   - Đăng ký đầy đủ danh mục canonical routes cho toàn bộ console quản trị theo đúng [S00-ROUTE-INVENTORY.md](../s00/S00-ROUTE-INVENTORY.md).
   - Đảm bảo tính mở rộng và backward-compatible với các route hiện có của game client.

2. **Xây dựng Admin Shell & Layout (`apps/web/src/layouts/AdminLayout.tsx`):**
   - Thiết kế giao diện theo ngôn ngữ **Industrial Robot Lab** đã định hình ở `S00` (wordmark OTT v2, tông navy/ceramic, accent mint, header ngang, bo góc panel).
   - Tích hợp trạng thái đăng nhập thực tế (`authApi.getMe()`, session storage, sự kiện auth change).
   - Thanh điều hướng phân chia 2 nhóm rõ ràng: **Quản lí giải đấu** và **Công cụ Offline**.
   - Hỗ trợ trạng thái mạng realtime (`online`, `degraded`, `offline`, `reconnecting`).

3. **Cơ chế Phân quyền & Route Guard (`AdminCapabilityGuard`):**
   - Role-aware và Capability-aware: Kiểm tra các quyền `tournament.list`, `tournament.create`, `audit.read`, `offline.hub.read`...
   - Khi không đủ quyền: Hiển thị màn hình cảnh báo **403 Forbidden** an toàn, không rò rỉ dữ liệu, có nút quay về Sảnh.
   - Khi route đang trong lộ trình phát triển (chờ S02, S03...): Hiển thị component **`AdminRoutePending`** với thông tin tiến độ rõ ràng, không gây crash hoặc lỗi 404 trắng màn hình.

4. **Bảo toàn Ràng buộc Bất biến (Invariants):**
   - **Tuyệt đối không có nút/CTA "Chơi Online"** hoặc hàng đợi ghép trận trực tiếp trong Admin Shell (tuân thủ quy tắc BR-01 và tiêu chí T005).
   - Mọi route trong Admin Shell đều được lazy load (`React.lazy`) để tối ưu hiệu năng tải trang.

---

## 2. Danh mục tài liệu của S01

- [S01-DESIGN.md](S01-DESIGN.md): Đặc tả thiết kế kỹ thuật, cấu trúc component và luồng xử lý quyền.
- [S01-ACCEPTANCE.md](S01-ACCEPTANCE.md): Ma trận tiêu chí nghiệm thu AC-S01-01 đến AC-S01-08 và kết quả kiểm thử.
- [S01-RESULT-2026-10-21.md](S01-RESULT-2026-10-21.md): Báo cáo kết quả nghiệm thu, log test và bằng chứng kiểm thử.
