# Hướng Dẫn Giả Lập Chu Trình Giải Đấu Toàn Diện (SIMULATION_GUIDE.md)

Tài liệu này hướng dẫn bạn thực hiện kịch bản giả lập đầy đủ 100% vòng đời giải đấu với **2 Actor độc lập** (Admin giải đấu vs Quản trị viên hệ thống), sau đó kích hoạt giải đấu chạy thật sự với thí sinh, trận đấu, điểm số, bảng xếp hạng và phán quyết hòa trọng tài.

---

## 1. THIẾT LẬP 2 PHIÊN LÀM VIỆC ĐỘC LẬP (2 TABS)

Để mô phỏng chính xác 2 người dùng khác nhau trên cùng một máy:

| Vai trò | Phiên trình duyệt | Tên đăng nhập | Mật khẩu | Quyền hạn & Trách nhiệm |
|---|---|---|---|---|
| **Tab 1: Admin giải đấu (TA)** | Cửa sổ trình duyệt thường | `ta_user` | `Admin@123` | Đại diện đơn vị ĐHQG (Hợp đồng `HD-2026-CHUNG`), có nhu cầu tạo giải đấu mới, cấu hình thể thức và nộp duyệt lên cấp trên. |
| **Tab 2: Quản trị viên hệ thống (SA)** | Cửa sổ ẩn danh (*Ctrl + Shift + N*) | `admin` | `Admin@123` | Quản trị viên cao nhất hệ thống, thẩm định các giải đấu đang chờ duyệt tại `/admin/approvals` và cấp phép hoạt động. |

---

## 2. KỊCH BẢN THỰC HIỆN CHI TIẾT TỪNG BƯỚC

### BƯỚC 1: Admin giải đấu (TA) Tạo giải mới & Nộp duyệt (Tại Tab 1)

1. Mở trình duyệt thường, truy cập: `http://localhost:3000/login`
2. Đăng nhập bằng tài khoản: `ta_user` / `Admin@123`
3. Truy cập trang tạo giải đấu: `http://localhost:3000/admin/tournaments/new`
4. Điền Wizard 4 bước khởi tạo giải đấu:
   - **Bước 1: Hồ sơ cơ bản:**
     - *Đơn vị tổ chức:* Chọn **Đại học Quốc gia Hà Nội (`unit-dhqg`)**
     - *Hợp đồng hạn mức:* Chọn **`HD-2026-CHUNG` (`contract-001`)**
     - *Mã giải đấu:* `SIM-ROBOT-2026` *(hoặc mã bất kỳ bạn muốn)*
     - *Tên giải đấu:* `Giải Đấu Thực Nghiệm Robot Lab 2026`
     - *Mô tả ngắn:* Giải đấu cờ Robot Lab mô phỏng thử nghiệm thực tế.
     - *Chế độ thi đấu:* Chọn **Người vs Người (Online)**
     - *Đơn vị tổ chức hiển thị:* Khoa CNTT - ĐHQGHN
     - Bấm **"Tiếp tục"**.
   - **Bước 2: Quy mô & Lịch trình:**
     - *Số lượng người tham gia tối đa:* `8`
     - *Thời gian bắt đầu / kết thúc:* Giữ nguyên mặc định hoặc chọn ngày hôm nay.
     - Bấm **"Tiếp tục"**.
   - **Bước 3: Cơ cấu điểm & Xếp cặp:**
     - *Thể thức thi đấu:* **Arena liên tục (ARENA_CONTINUOUS)**
     - *Phương pháp xếp cặp:* **Thụy Sĩ lân cận điểm (SWISS_SCORE_ADJACENT)**
     - Bấm **"Tiếp tục"**.
   - **Bước 4: Cấu hình luật Robot Lab (Rule Editor):**
     - Giữ nguyên cấu hình luật Robot Lab 2026 chuẩn.
     - Bấm nút **"Lưu bản nháp & Nộp phê duyệt"** (Submit for Approval).
5. **Kết quả:** Giải đấu được tạo và chuyển sang trạng thái: **`SUBMITTED` (Chờ phê duyệt)**.

---

### BƯỚC 2: Quản trị viên hệ thống (SA) Thẩm định & Phê duyệt giải (Tại Tab 2)

1. Mở cửa sổ **Ẩn danh (Incognito)** bằng phím tắt `Ctrl + Shift + N`.
2. Truy cập: `http://localhost:3000/login`
3. Đăng nhập bằng tài khoản: `admin` / `Admin@123`
4. Truy cập trang Phê duyệt giải đấu: `http://localhost:3000/admin/approvals`
5. Tại tab **"Đơn nộp ban đầu (Initial Submissions)"**:
   - Bạn sẽ nhìn thấy giải đấu vừa tạo: **"Giải Đấu Thực Nghiệm Robot Lab 2026"** (`SIM-ROBOT-2026`).
   - Bấm vào giải đấu đó để mở panel xem xét chi tiết cấu hình.
   - Tại ô *Ghi chú thẩm định (Review Note)*, nhập:
     > *"Hồ sơ giải đấu đầy đủ và hợp lệ, đáp ứng điều lệ thi đấu Robot Lab 2026. Cho phép khởi chạy."*
   - Bấm nút màu xanh: **"Phê duyệt (APPROVE)"**.
6. **Kết quả:** Thông báo thành công hiển thị, giải đấu chính thức chuyển sang trạng thái **`APPROVED` (Đã phê duyệt)**!

---

### BƯỚC 3: Mở lịch & Bắt đầu giải đấu (Kích hoạt RUNNING)

1. Quay lại **Tab 1** (hoặc ngay tại Tab 2), truy cập vào trang chi tiết giải:
   `http://localhost:3000/admin/tournaments/SIM-ROBOT-2026`
   *(hoặc bấm vào tên giải trong danh sách `/admin/tournaments`)*.
2. Bạn sẽ thấy trạng thái giải đấu đã đổi thành badge xanh: **`APPROVED`**.
3. **Mở lịch thi đấu:**
   - Bấm nút **"Mở lịch thi đấu"** trên thanh công cụ.
   - Trạng thái giải chuyển thành **`SCHEDULED`**.
4. **Bắt đầu giải đấu:**
   - Bấm nút **"Bắt đầu giải đấu"**.
   - Trạng thái giải chính thức chuyển thành **`RUNNING` (Đang diễn ra)**!

---

### BƯỚC 4: Giả lập thi đấu thật sự (Thí sinh, Trận đấu, Điểm số, Bảng xếp hạng & Hòa cờ)

Hệ thống đã chuẩn bị sẵn công cụ giả lập tự động thi đấu.

#### Cách 1: Sử dụng giải đấu mẫu có sẵn `tour-001` (Đã được nạp sẵn dữ liệu)
Bạn có thể mở ngay trình duyệt và kiểm tra kết quả thi đấu đã có sẵn tại giải `tour-001`:
- **Chi tiết giải & Bảng xếp hạng:** `http://localhost:3000/admin/tournaments/tour-001`
- **Danh sách thí sinh:** `http://localhost:3000/admin/tournaments/tour-001/roster`
- **Phán quyết hòa trọng tài:** `http://localhost:3000/admin/tournaments/tour-001/adjudications`

#### Cách 2: Chạy giả lập cho chính giải đấu mới tạo (`SIM-ROBOT-2026` hoặc ID bất kỳ)
Mở một terminal mới và chạy lệnh sau:
```bash
npm run simulate:tournament <ID_CỦA_GIẢI_MỚI>
```
*(Nếu không truyền ID, lệnh sẽ tự động áp dụng cho `tour-001`)*.

Lệnh này sẽ tự động:
1. Ghi danh 4 thí sinh thi đấu thật: `player_1`, `player_2`, `player_3`, `player_4` kèm mã thí sinh và xác nhận điều lệ.
2. Phân công Trọng tài điều hành chính.
3. Chạy 2 trận đấu phân thắng bại ở Vòng 1:
   - **Trận 1:** `player_1` (Xanh) thắng `player_2` (Đỏ) -> `player_1` đạt 1041đ (Elo 1016), `player_2` đạt 992đ (Elo 984).
   - **Trận 2:** `player_4` (Đỏ) thắng `player_3` (Xanh) -> `player_4` đạt 1041đ (Elo 1016), `player_3` đạt 992đ (Elo 984).
4. Tạo 1 trận đấu hòa kịch tính giữa 2 người thắng (`player_1` vs `player_4`) sau 60 nước cờ:
   - Đưa trận đấu vào trạng thái **Hòa chỉ số kỹ thuật** cần Trọng tài phán quyết.
   - Đẩy yêu cầu lên trang Phán quyết hòa `ManualAdjudicationPage` (P05).

---

### BƯỚC 5: Trải nghiệm & Kiểm tra kết quả trên giao diện UI

Sau khi giả lập chạy, bạn kiểm tra 3 màn hình nghiệp vụ trọng tâm:

1. **Xem Bảng xếp hạng & Sổ cái điểm (`/admin/tournaments/:id`):**
   - Bảng xếp hạng hiển thị thứ tự thi đấu:
     - 🥇 **Hạng 1 (Đồng hạng):** `player_1` (1041 điểm, Elo 1016, 1 Thắng - 0 Thua)
     - 🥇 **Hạng 1 (Đồng hạng):** `player_4` (1041 điểm, Elo 1016, 1 Thắng - 0 Thua)
     - 🥉 **Hạng 3 (Đồng hạng):** `player_2` (992 điểm, Elo 984, 0 Thắng - 1 Thua)
     - 🥉 **Hạng 3 (Đồng hạng):** `player_3` (992 điểm, Elo 984, 0 Thắng - 1 Thua)

2. **Xem Danh sách thí sinh (`/admin/tournaments/:id/roster`):**
   - 4 thí sinh hiển thị đầy đủ thông tin mã định danh, đơn vị `DHQG`, trạng thái "Đã liên kết" với tài khoản người chơi.

3. **Thao tác Phán quyết hòa Trọng tài (`/admin/tournaments/:id/adjudications`):**
   - Hiển thị trận đấu đang chờ: `player_1` (Blue) vs `player_4` (Red).
   - Hiển thị mô phỏng bàn cờ 9x9 với các vị trí quân cờ `R`, `P`, `S`.
   - Hiển thị các chỉ số phụ so sánh hòa: Điểm vật lực, Khoảng cách tới ô mục tiêu (`Goal Distance`), Độ linh hoạt nước đi (`Mobility`).
   - **Thao tác Trọng tài:** Bạn có thể nhập lý do phán quyết và bấm chọn bên thắng (ví dụ chọn *Bên Xanh thắng* hoặc *Áp dụng Fallback*). Hệ thống sẽ ngay lập tức chốt kết quả và cộng điểm vào Bảng xếp hạng!

4. **Trang Điều hành sự cố (`/admin/tournaments/:id/operations`):**
   - Trạng thái giải hiển thị `RUNNING`.
   - Có thể thử bấm các nút can thiệp như *Tạm dừng giải đấu* hoặc *Xem nhật ký sự cố*.
