# Hướng Dẫn Kiểm Tra Giao Diện UI & Nghiệm Thu Sửa Lỗi (UI_VERIFICATION_GUIDE.md)

- **Tài liệu tham chiếu:** [FINAL_CHECK.md](file:///home/sonsiunhan/Projects/LTM_Nhom_2/BT01/docs/tournament-initialization/son/FINAL_CHECK.md)
- **Người thực hiện:** Sơn (Frontend Lead & Phân hệ Tournament)
- **Nhánh làm việc hiện tại:** `son-tournament` *(Độc lập, chưa commit hoặc push lên `main`)*
- **Trạng thái dịch vụ:** Dev Server đang chạy tại `http://localhost:3000` (Vite) và `http://localhost:3001` (Fastify Server)
- **Cơ sở dữ liệu:** PostgreSQL (Port 5432)

---

## 1. THÔNG TIN MÔI TRƯỜNG & TÀI KHOẢN ĐĂNG NHẬP

Để phục vụ việc kiểm tra thực tế trên trình duyệt, hệ thống đã sẵn sàng với các thông số sau:

- **Địa chỉ Web Application:** `http://localhost:3000`
- **Địa chỉ Backend API:** `http://localhost:3001` *(được cấu hình proxy tự động qua `/api` từ cổng 3000)*
- **Tài khoản Quản trị viên (Admin):**
  - **Tên đăng nhập:** `admin`
  - **Mật khẩu:** `Admin@123`
  - **Vai trò:** `SYSTEM_ADMIN` *(Có toàn quyền truy cập Console Quản trị)*
- **Tài khoản Người chơi thông thường (Player):**
  - **Tên đăng nhập:** `player_1`
  - **Mật khẩu:** `Admin@123`
  - **Vai trò:** `USER` *(Dùng để kiểm thử chặn quyền Admin)*
- **Dữ liệu giải đấu mẫu trong hệ thống:**
  - **Mã giải:** `tour-001`
  - **Tên giải:** *Giải Vô địch Quốc gia Robot Lab 2026*
  - **Trạng thái:** `APPROVED`

---

## 2. BẢNG TỔNG HỢP CÁC LỖI ĐÃ FIX & CÁCH KIỂM TRA TRÊN UI

| Mã Bug | Tên Lỗi / Hạng mục | Vị trí kiểm tra trên UI | Hành động của bạn | Kết quả mong đợi (Đã Fix) |
|:---:|---|---|---|---|
| **BUG-01** | Hở quyền Admin Shell | `http://localhost:3000/admin/tournaments` | Đăng nhập tài khoản `player_1`, vào URL admin | Hiển thị màn hình từ chối `admin-guard-forbidden`, không lộ layout Admin. |
| **BUG-02** | Thiếu Route Phán Quyết Hòa (P05) | `/admin/tournaments/tour-001/adjudications` | Vào chi tiết giải `tour-001` và bấm nút "Phán quyết hòa" | Mở trang P05 bình thường, hiển thị đầy đủ bảng so sánh chỉ số hòa; không còn bị 404. |
| **BUG-03** | Thiếu Menu "Hỗ trợ" | Header Admin Navbar | Quan sát thanh menu Admin trên cùng | Xuất hiện nút "Hỗ trợ" dẫn tới `/admin/support`. |
| **BUG-04** | Lỗi tương phản nút bấm ở Light Theme | Các trang Admin (Chi tiết giải, Wizard tạo giải) | Chuyển sang Light Theme, xem nút màu Cyan | Chữ trên nút hiển thị màu trắng rõ ràng, tương phản sắc nét, không còn chữ đen chìm. |
| **BUG-05** | Form rò rỉ trường Bot Deadline | `/admin/tournaments/new` | Chuyển chế độ thi đấu từ Bot vs Bot sang Người vs Người | Ô nhập hạn nộp Bot biến mất và state form được xóa sạch về `null`. |
| **BUG-06** | Mất dữ liệu RAM Store sau restart | `/admin/tournaments/tour-001` | Khởi động lại server hoặc F5 trang chi tiết giải | Dữ liệu giải `tour-001` nạp tức thời từ PostgreSQL, không còn lỗi 404 RESOURCE_NOT_FOUND. |
| **BUG-07** | Vỡ màu hộp đen ở Light Theme P05 | `/admin/tournaments/tour-001/adjudications` | Bật Light Theme, xem trang phán quyết hòa | Các ô cờ và card hiển thị nền xám sáng nhã nhặn, viền xám mảnh, không còn hộp đen sì. |
| **BUG-08** | Trang P03 Operations gắn placeholder | `/admin/tournaments/tour-001/operations` | Vào link điều hành sự cố giải đấu | Hiển thị giao diện điều hành thật với bảng trạng thái và nút Hoãn/Tạm dừng, hết thẻ tạm Pending. |
| **BUG-09** | Rò rỉ token hex trong Audit Log | `/admin/audit` | Xem danh sách nhật ký kiểm toán | Các chuỗi hex bí mật dài trong lý do hành động được che giấu thành `[REDACTED_SECRET]`. |
| **UI/UX** | Font & Tiêu đề bảng Roster | `/admin/tournaments/tour-001/roster` | Xem bảng danh sách thí sinh | Tiêu đề bảng có nền rõ ràng ở cả 2 theme, thông số hiển thị chuẩn font Monospace Robot Lab. |

---

## 3. HƯỚNG DẪN CHI TIẾT TỪNG BƯỚC KIỂM TRA (STEP-BY-STEP)

### Bước 1: Kiểm tra BUG-01 (Chặn quyền Admin đối với tài khoản thường)
1. Mở trình duyệt truy cập: `http://localhost:3000/login`.
2. Đăng nhập bằng tài khoản người chơi:
   - **Tên đăng nhập:** `player_1`
   - **Mật khẩu:** `Admin@123`
3. Sau khi đăng nhập thành công vào trang người chơi, nhập trực tiếp URL sau lên thanh địa chỉ trình duyệt:
   ```text
   http://localhost:3000/admin/tournaments
   ```
4. **Hiện tượng cần quan sát:**
   - [x] Trình duyệt **KHÔNG** hiển thị thanh menu quản trị ("Robot Lab Console Quản trị", các nút Quản lý giải, v.v.).
   - [x] Hiển thị một khung thông báo trang trọng ở giữa màn hình:
     - **Tiêu đề:** *Truy Cập Bị Từ Chối*
     - **Mô tả:** *Tài khoản của bạn không có quyền truy cập vào bảng điều khiển quản trị.*
     - **Nút hành động:** Nút *Về trang chủ* bấm vào sẽ quay lại trang chính an toàn.

---

### Bước 2: Đăng nhập quyền Quản trị viên (Admin)
1. Bấm vào ảnh đại diện/nút Đăng xuất hoặc truy cập `http://localhost:3000/login`.
2. Đăng nhập bằng tài khoản quản trị:
   - **Tên đăng nhập:** `admin`
   - **Mật khẩu:** `Admin@123`
3. Sau khi đăng nhập, hệ thống sẽ mở ra giao diện Console Quản trị.

---

### Bước 3: Kiểm tra BUG-03 (Nút điều hướng "Hỗ trợ" trên Menu Admin)
1. Quan sát thanh Header điều hướng trên cùng của Console Quản trị.
2. Kiểm tra nhóm menu **Quản lí giải**:
   - Bao gồm các mục: *Giải đấu* (`/admin/tournaments`), *Nhật ký kiểm toán* (`/admin/audit`), và mục mới được thêm: **Hỗ trợ** (`/admin/support`).
3. Bấm thử vào nút **Hỗ trợ**:
   - [x] Trình duyệt chuyển hướng mượt mà đến trang `http://localhost:3000/admin/support`.
   - [x] Hiển thị trang *Hàng đợi Hỗ trợ & Khôi phục tài khoản* (Task P12 của Đức), hoạt động bình thường và không báo lỗi.

---

### Bước 4: Kiểm tra BUG-02 (Trang Phán quyết hòa P05 & Nút liên kết từ Chi tiết giải)
1. Trên thanh menu, bấm vào **Giải đấu** (`http://localhost:3000/admin/tournaments`).
2. Trong danh sách giải đấu, bấm vào giải: **Giải Vô địch Quốc gia Robot Lab 2026** (ID: `tour-001`).
3. Tại trang Chi tiết giải (`/admin/tournaments/tour-001`), quan sát hàng nút tác nghiệp ở đầu trang:
   - Ngoài các nút *Quy định luật*, *Danh sách thí sinh*, *Nhân sự & Trọng tài*, *Kiểm tra Bot*, *Nhật ký kiểm toán*, bạn sẽ thấy nút mới: **"Phán quyết hòa"**.
4. Bấm vào nút **"Phán quyết hòa"** (hoặc truy cập trực tiếp `http://localhost:3000/admin/tournaments/tour-001/adjudications`):
   - [x] Trang phán quyết hòa `ManualAdjudicationPage` mở ra thành công.
   - [x] **KHÔNG CÒN BỊ LỖI 404 NOT FOUND.**
   - [x] Giao diện hiển thị các panel: *Trạng thái hòa & So sánh chỉ số*, *Bảng điểm & Elo*, *Thao tác phán quyết của trọng tài*.

---

### Bước 5: Kiểm tra BUG-04 & BUG-07 (Chế độ Sáng - Light Theme & Độ tương phản nút bấm)
1. Tìm nút chuyển đổi giao diện Sáng/Tối (Icon Mặt Trời/Mặt Trăng ở góc trên bên phải trang web) và click để kích hoạt **Chế độ Sáng (Light Theme)**.
2. **Kiểm tra độ tương phản nút bấm (BUG-04):**
   - Vào lại trang Chi tiết giải `http://localhost:3000/admin/tournaments/tour-001`.
   - Quan sát nút chính màu xanh Cyan (ví dụ nút "Mở lịch thi đấu" hoặc nút hành động chính).
   - [x] **Màu chữ trên nút là màu trắng (`#ffffff`) rõ nét trên nền xanh cổ vịt sẫm.**
   - [x] Tỉ lệ tương phản vượt chuẩn WCAG 4.5:1, chữ dễ đọc, không còn bị chữ đen nhòe vào nền tối như phiên bản cũ.
3. **Kiểm tra giao diện Light Theme của trang Phán quyết hòa (BUG-07):**
   - Vẫn ở chế độ Sáng, truy cập lại: `http://localhost:3000/admin/tournaments/tour-001/adjudications`.
   - [x] Các thẻ thông tin, ô bàn cờ và khung ghi chú có màu nền xám sáng trang nhã (`var(--surface)` và `var(--surface-raised)`).
   - [x] Viền khung là màu xám mảnh (`var(--border)`).
   - [x] **KHÔNG CÒN HIỆN TƯỢNG VỠ MÀU THÀNH CÁC KHỐI ĐEN XÌ.**

---

### Bước 6: Kiểm tra BUG-05 (Reset dữ liệu Form trong Wizard Tạo Giải Mới)
1. Truy cập vào trang Khởi tạo giải mới: `http://localhost:3000/admin/tournaments/new`.
2. Tại **Bước 1: Hồ sơ cơ bản & Thể thức**:
   - Tìm mục **"Chế độ thi đấu"** (Dropdown).
   - Chọn thể thức: **"Bot vs Bot (Python)"**.
   - Quan sát thấy ô nhập **"Hạn chót nộp Bot"** (`botDeadlineAt`) xuất hiện bên dưới.
   - Chọn thử một ngày giờ bất kỳ vào ô hạn chót này.
3. Thay đổi lại dropdown **"Chế độ thi đấu"** sang **"Người vs Người (Online)"**:
   - [x] Ô nhập "Hạn chót nộp Bot" lập tức biến mất khỏi giao diện.
   - [x] Dữ liệu nội bộ `botDeadlineAt` được reset về `null`, đảm bảo khi tạo giải đấu Người vs Người sẽ không có dữ liệu rác về hạn nộp Bot.

---

### Bước 7: Kiểm tra BUG-08 (Trang Điều hành sự cố giải đấu P03 Operations)
1. Đăng nhập với quyền Admin, truy cập đường dẫn:
   ```text
   http://localhost:3000/admin/tournaments/tour-001/operations
   ```
2. **Hiện tượng cần quan sát:**
   - [x] **KHÔNG CÒN THẺ GIỮ CHỖ "Đang phát triển (AdminRoutePending)".**
   - [x] Hiển thị đầy đủ trang **"Điều hành & Xử lý sự cố giải đấu"** với:
     - Thẻ trạng thái vận hành của giải (`APPROVED`).
     - Bảng thao tác khẩn cấp: Nút *Tạm dừng giải đấu*, Nút *Tiếp tục giải đấu*, Nút *Hủy giải đấu khẩn cấp*.
     - Bảng nhật ký sự cố trọng tài thời gian thực.
     - Nút "Quay lại Match-Center" dẫn về trang chi tiết giải đấu.

---

### Bước 8: Kiểm tra BUG-06 (Đồng bộ dữ liệu DB vào RAM Store sau khi khởi động lại Server)
1. Mở trang chi tiết giải đấu `http://localhost:3000/admin/tournaments/tour-001`.
2. Nhấn `Ctrl + F5` để tải lại trang từ máy chủ.
3. **Hiện tượng cần quan sát:**
   - [x] Dữ liệu của `tour-001` (và các dữ liệu hợp đồng, đơn vị) được nạp tức thời từ PostgreSQL qua module `prisma-sync.ts`.
   - [x] Trang hiển thị đầy đủ thông tin giải, **không còn vấp lỗi `404 RESOURCE_NOT_FOUND` do rỗng bộ nhớ RAM**.

---

### Bước 9: Kiểm tra BUG-09 (Che giấu dữ liệu nhạy cảm trong Audit Log)
1. Trên menu Admin, bấm vào mục **"Nhật ký kiểm toán"** (`http://localhost:3000/admin/audit`).
2. Xem bảng lịch sử kiểm toán của hệ thống.
3. **Hiện tượng cần quan sát:**
   - [x] Cột "Lý do / Mô tả hành động": Mọi chuỗi ký tự dạng token bí mật hoặc mã hex dài đều được bộ lọc `sanitizeAuditReason` che chắn tự động thành `[REDACTED_SECRET]` hoặc dạng rút gọn an toàn `1a2b...[MÃ ĐÃ CHE DẤU]`.
   - [x] Không rò rỉ token truy cập hay dữ liệu PII ra màn hình kiểm toán.

---

### Bước 10: Kiểm tra Typography & Bảng Danh sách thí sinh (Roster)
1. Truy cập vào trang Roster của giải: `http://localhost:3000/admin/tournaments/tour-001/roster`.
2. Kiểm tra hàng tiêu đề của bảng thí sinh ở cả 2 chế độ Sáng (Light) và Tối (Dark):
   - [x] Tiêu đề bảng có màu nền xám nổi rõ (`var(--surface-raised)`), phân tách rõ ràng với các hàng dữ liệu bên dưới.
   - [x] Các thông số Elo, MSSV, Mã định danh hiển thị bằng font Monospace chuẩn Robot Lab (`var(--font-data)`).

---

## 4. KẾT LUẬN & BƯỚC TIẾP THEO

- Toàn bộ **9/9 lỗi** trong `FINAL_CHECK.md` đã được khắc phục hoàn chỉnh và vượt qua 100% các cổng kiểm tra tự động (`lint: 0 lỗi`, `typecheck: 0 lỗi`, `build: PASS`, `vitest: 71/71 test suites PASS`).
- Tất cả các thay đổi được giữ an toàn trên nhánh `son-tournament` và **CHƯA COMMIT HOẶC PUSH LÊN MAIN** theo đúng chỉ đạo.
- Bạn có thể thực hiện kiểm tra thực tế trên trình duyệt theo 10 bước ở trên. Khi đã hài lòng với kết quả kiểm thử, bạn có thể thực hiện commit và merge vào nhánh chính.
