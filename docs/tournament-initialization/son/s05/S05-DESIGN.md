# S05-DESIGN — Thiết kế kiến trúc Trang chi tiết giải đấu và Panel Readiness (P03)

## 1. Mục tiêu và bối cảnh
Nhiệm vụ `S05` cung cấp trang hiển thị chi tiết giải đấu `TournamentDetailPage.tsx` tại đường dẫn `/admin/tournaments/:tournamentId`. Đây là trung tâm quản trị (Control Hub) cho Ban tổ chức (TA) và Quản trị viên hệ thống (Admin) theo dõi tiến độ, kiểm tra điều kiện khởi chạy, xem lại cấu hình giải đấu và kích hoạt các chuyển đổi trạng thái vòng đời giải.

Toàn bộ giao diện tuân thủ **Robot Lab Design System**:
- Màu nền và viền: `var(--surface)`, `var(--border)`, `var(--lab-panel)`, `var(--system-cyan)`.
- Icon đơn sắc qua `UiGlyph`.
- 100% copy Tiếng Việt cho các nhãn, trạng thái, thông báo; mã định danh kỹ thuật giữ nguyên English.

---

## 2. Kiến trúc trang P03

```
+-----------------------------------------------------------------------------------+
|  [<- Danh sách giải] / P03 // CHI TIẾT GIẢI ĐẤU                                   |
|  Tên Giải Đấu [Trạng thái: APPROVED / RUNNING...] [Mã Slug]                       |
|  Lịch: 21/10/2026 - 24/10/2026 (Asia/Ho_Chi_Minh) | Đơn vị: Khoa CNTT             |
|                                                                                   |
|  [Thao tác nhanh: Bắt đầu giải | Tạm dừng | Chỉnh sửa bản nháp]                    |
+-----------------------------------------------------------------------------------+
|  [ Tab: Tổng quan ]  |  [ Tab: Cấu hình giải ]  |  [ Tab: Điều kiện sẵn sàng ]    |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  Nội dung từng Tab:                                                               |
|  - Tổng quan: Tóm tắt tiến độ, thống kê nhanh, thông tin ban tổ chức              |
|  - Cấu hình: 19 trường mở rộng chi tiết S04 (Vận hành, Khán giả, Tính điểm...)    |
|  - Điều kiện sẵn sàng (Readiness Panel):                                          |
|    + Trạng thái tổng quát: SẴN SÀNG KHỞI CHẠY hoặc CHƯA ĐỦ ĐIỀU KIỆN             |
|    + Thẻ kiểm tra tự động (Checklist cards):                                      |
|      * Phê duyệt hệ thống (PASS / BLOCKED)                                        |
|      * Phiên bản cấu hình & luật phát hành (PASS / BLOCKED)                       |
|      * Số thí sinh / Bot đủ điều kiện tối thiểu (PASS / BLOCKED)                  |
|      * Phán quyết thủ công tồn đọng (PASS / WARN)                                 |
|    + Danh sách các lý do chặn (Blocker details) nếu có                            |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Quy tắc bất biến về tính sẵn sàng (Authoritative Readiness Invariant)

1. **Tuyệt đối không hiển thị `READY` giả:**
   - Client không được tự tính toán trạng thái "READY" chỉ dựa vào việc các trường form đã điền đầy đủ.
   - Trạng thái sẵn sàng phải được lấy từ máy chủ thông qua endpoint `/api/tournaments/:tournamentId/readiness`.
   - Nếu `canStartRunning === false` hoặc `blockers.length > 0`, giao diện bắt buộc hiển thị trạng thái `CHƯA ĐỦ ĐIỀU KIỆN (BLOCKED)` kèm danh sách chi tiết các lý do chặn (ví dụ: `INSUFFICIENT_ELIGIBLE_PARTICIPANTS`, `TOURNAMENT_NOT_APPROVED`, `NO_ACTIVE_RULE_VERSION`).
2. **Quyền thao tác vòng đời (Lifecycle Operations):**
   - Chỉ hiển thị nút "Mở lịch trình" khi giải đang ở trạng thái `APPROVED` và `canOpenScheduled === true`.
   - Chỉ hiển thị nút "Bắt đầu giải" khi giải đang ở trạng thái `APPROVED` hoặc `SCHEDULED` và `canStartRunning === true`.
   - Nút "Tạm dừng" yêu cầu nhập lý do tạm dừng bắt buộc trước khi gửi lệnh.
   - Thao tác gửi kèm `expectedRevision` để bảo đảm kiểm soát đồng thời (OCC).
