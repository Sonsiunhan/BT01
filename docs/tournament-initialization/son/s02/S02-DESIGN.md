# S02-DESIGN — Thiết kế chi tiết Trang Danh sách giải đấu (P01)

## 1. Mục tiêu và Nguyên tắc thiết kế
1. **Tuân thủ triệt để Robot Lab Design System:**
   - Sử dụng thẻ (`TournamentCard`) với bo góc bevel, đổ bóng `var(--lab-bevel)`, background `var(--lab-panel)`.
   - Trực quan hóa trạng thái giải đấu bằng badge có màu tương phản chuẩn WCAG 2.1 AA kết hợp nhãn text rõ ràng (không chỉ dùng màu).
2. **Chính sách ít chữ (Text-lean policy):**
   - First viewport tập trung vào thanh điều khiển (tìm kiếm, tab trạng thái nhanh) và lưới thẻ giải đấu.
   - Thẻ hiển thị các thông tin cốt lõi nhất: Tên giải, mã slug, trạng thái vòng đời, đơn vị chủ quản, khung thời gian thi đấu và tình trạng sẵn sàng (readiness/blocker count).
3. **Quản trị quyền & Capability:**
   - Nút hành động "Tạo giải đấu" (`/admin/tournaments/new`) chỉ khả dụng khi người dùng có quyền `tournament.create` (TA / Ban tổ chức). Khi thiếu quyền (ví dụ SA chỉ xem hoặc tài khoản chưa cấp quyền), nút hiển thị trạng thái disabled kèm tooltip giải thích lý do an toàn, không tạo link chết.
4. **Trạng thái phục hồi và vòng đời UI đầy đủ (State Machine):**
   - `LOADING`: Skeleton pulsing card để tránh giật giao diện.
   - `READY`: Lưới thẻ hiển thị kết quả phân trang.
   - `EMPTY (P01.empty)`: Chưa có giải đấu nào trong hệ thống/đơn vị -> Card hướng dẫn kèm nút Tạo giải đầu tiên.
   - `NO_RESULTS (P01.no-results)`: Bộ lọc hoặc từ khóa tìm kiếm không khớp -> Thông báo không tìm thấy kèm nút "Xóa bộ lọc".
   - `ERROR`: Lỗi mạng hoặc server -> Thông báo lỗi an toàn kèm nút "Thử lại".
   - `FORBIDDEN`: Thiếu quyền xem danh sách giải đấu (`tournament.list`).

---

## 2. Kiến trúc Component

```text
apps/web/src/features/admin/tournaments/
├── tournamentTypes.ts          # Định nghĩa kiểu dữ liệu DTO, Query, Status
├── tournamentApi.ts            # Client gọi API /api/tournaments + fixture adapter
├── TournamentCard.tsx          # Component thẻ hiển thị 1 giải đấu
├── TournamentFilterToolbar.tsx # Toolbar: Ô tìm kiếm, Tab trạng thái, Đơn vị
├── TournamentPagination.tsx    # Phân trang Server-side
└── TournamentListPage.tsx      # Page container điều phối state và effect
```

---

## 3. Bản đồ Trạng thái vòng đời (Lifecycle Statuses & Badges)

| Trạng thái | Nhãn Tiếng Việt | Tone màu | Hành động chính trên thẻ |
|---|---|---|---|
| `DRAFT` | Bản nháp | Vàng hổ phách (Amber) | Sửa bản nháp (`/admin/tournaments/:id/edit`) |
| `SUBMITTED` | Đã gửi duyệt | Xanh biển nhạt (Sky) | Xem chi tiết (`/admin/tournaments/:id`) |
| `UNDER_REVIEW` | Đang xét duyệt | Tím (Purple) | Xem chi tiết (`/admin/tournaments/:id`) |
| `CHANGES_REQUESTED` | Cần sửa đổi | Cam (Orange) | Sửa bản nháp (`/admin/tournaments/:id/edit`) |
| `APPROVED` | Đã phê duyệt | Lục ngọc (Cyan) | Xem chi tiết (`/admin/tournaments/:id`) |
| `READY` | Sẵn sàng mở | Xanh lá (Emerald) | Mở giải / Xem chi tiết |
| `RUNNING` | Đang diễn ra | Xanh lá đậm (Green pulsing) | Quản lý điều hành (`/admin/tournaments/:id`) |
| `PAUSED` | Tạm dừng | Hổ phách đậm (Amber) | Quản lý điều hành (`/admin/tournaments/:id`) |
| `ENDED` / `FINALIZED` | Đã kết thúc | Xám đá (Slate) | Xem kết quả / Tổng kết |
| `REJECTED` | Bị từ chối | Đỏ hồng (Rose) | Xem lý do từ chối |
| `CANCELLED` | Đã hủy | Xám (Neutral) | Xem chi tiết |
