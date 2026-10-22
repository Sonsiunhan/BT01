# S03-DESIGN — Thiết kế kiến trúc Wizard tạo bản nháp giải đấu (P02)

## 1. Mục tiêu và bối cảnh
Nhiệm vụ `S03` cung cấp giao diện Wizard trực quan cho Trợ lý Học vụ (TA) và Quản trị viên khởi tạo bản nháp giải đấu mới hoặc chỉnh sửa bản nháp hiện có trước khi gửi duyệt hoặc lên lịch chính thức.

Trang tuân thủ các nguyên tắc thiết kế **Robot Lab**:
- Bảng màu Sleek Dark / Slate / Indigo tương thích biến CSS toàn cục `--surface`, `--surface-raised`, `--text`, `--accent`, `--border`.
- Vector monochrome icons thông qua `UiGlyph` và inline SVG, không dùng OS emoji recoloring.
- Typography rõ ràng, trạng thái lỗi gắn aria attributes `aria-invalid`, `role="alert"`.
- Tiếng Việt 100% cho toàn bộ chuỗi thông báo và nhãn hiển thị người dùng; mã định danh kỹ thuật giữ nguyên English.

---

## 2. Kiến trúc 4 bước (Step Machine)

```
[Bước 1: Hồ sơ & Đơn vị] ---> [Bước 2: Lịch trình] ---> [Bước 3: Thể thức & Quy mô] ---> [Bước 4: Tổng quan & Kiểm tra]
      |                              |                             |                               |
      +------------------------------+-----------------------------+-------------------------------+
                                                    |
                                    [Bộ đệm Local Storage tự động]
                                                    |
                                    [Lưu nháp Máy chủ / OCC 409]
```

### Bước 1: Hồ sơ & Đơn vị (`STEP 1`)
- **Tên giải đấu (`name`):** Nhập văn bản tự do, tự động đề xuất mã slug chữ hoa không dấu gạch ngang (`auto-slugify`).
- **Mã giải đấu (`slug`):** Mã nhận diện duy nhất (`tournamentCode`), ví dụ `BK_ROBOT_2026`.
- **Hợp đồng tổ chức (`contractId`):** Lựa chọn từ hợp đồng đã ký của đơn vị.
- **Đơn vị chủ quản (`organizerUnitId`):** Mã khoa/viện tổ chức.
- **Phạm vi hiển thị (`visibility`):** Công khai (`PUBLIC_REGISTERED`) hoặc Nội bộ đơn vị (`INTERNAL_UNIT`).
- **Mô tả ngắn (`description`):** Tóm tắt điều lệ giải.

### Bước 2: Thời gian & Lịch trình (`STEP 2`)
- **Mô hình thời gian (`timeModel`):** Khung giờ cố định (`FIXED_WINDOW`) hoặc Đa ngày (`MULTIDAY`).
- **Múi giờ (`timezone`):** Mặc định `Asia/Ho_Chi_Minh`.
- **Thời gian bắt đầu / kết thúc (`startAt` / `endAt`):** Lịch thi đấu chính thức.
- **Đăng ký mở / đóng (`rosterOpenAt` / `rosterCloseAt`):** Cửa sổ đăng ký người chơi / bot.

### Bước 3: Thể thức & Quy mô (`STEP 3`)
- **Chế độ thi đấu (`competitionMode`):** Người đấu Người trực tuyến (`HUMAN_ONLINE`) hoặc Bot đấu Bot (`BOT_VS_BOT`).
- **Số người tối thiểu (`minParticipants`):** Tối thiểu để bắt đầu giải (mặc định 2 hoặc 4).
- **Số người tối đa (`maxParticipants`):** Sức chứa giải (mặc định 16 đến 32).
- **Yêu cầu điểm danh (`checkinRequired`):** Bật/tắt điểm danh trước trận.

### Bước 4: Tổng hợp & Kiểm tra hợp lệ (`STEP 4`)
- Hiển thị bảng tổng hợp toàn bộ thông tin đã nhập từ 3 bước trước.
- Bộ kiểm tra tính hợp lệ (Validation Engine): Kiểm tra tên, slug, thời gian hợp lý (kết thúc > bắt đầu), số lượng tham gia min <= max.
- Nút "Lưu bản nháp" và "Nộp phê duyệt" kèm trạng thái chỉ báo.

---

## 3. Khả năng phục hồi dữ liệu (Resilience Architecture)

### 3.1. Local Storage Draft Buffer
- Tự động đồng bộ hóa form data vào `localStorage` với key tiền tố `ottv2_tournament_draft_buffer_${id || 'new'}`.
- Khi người dùng vô tình tải lại trang hoặc mất mạng, Wizard tự động phát hiện và khôi phục form từ bộ nhớ đệm cục bộ kèm thông báo: *"Đã khôi phục từ bộ nhớ đệm cục bộ"*.
- Có nút "Xóa đệm" cho phép reset lại trạng thái trắng ban đầu.

### 3.2. Optimistic Concurrency Control (OCC) & 409 Conflict Banner
- Khi chỉnh sửa bản nháp (`/admin/tournaments/:id/edit`), frontend gửi kèm `expectedRevision: serverRevision`.
- Nếu một quản trị viên khác vừa chỉnh sửa trên máy chủ, server trả về mã `409 Conflict`.
- Frontend bắt mã lỗi này và hiển thị dải thông báo cảnh báo màu vàng nổi bật:
  > **Xung đột phiên bản bản nháp (Optimistic Concurrency Control):** Bản nháp đã được cập nhật bởi một phiên làm việc khác trên máy chủ. Vui lòng tải lại dữ liệu mới nhất để tránh ghi đè thay đổi.
- Cung cấp nút "Tải lại dữ liệu mới nhất" để cập nhật phiên bản máy chủ an toàn.
