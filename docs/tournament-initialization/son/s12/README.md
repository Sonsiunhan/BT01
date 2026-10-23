# Task S12 — Kiểm Tra Role, URL Trực Tiếp Và Trạng Thái Lỗi (P01, P02, P03, P14, P15)

## 1. Thông tin tổng quan
- **Mã Task:** `S12`
- **Người thực hiện:** Sơn (Frontend Lead / Admin Shell & Pages P01, P02, P03, P14, P15)
- **Mục tiêu:**
  1. **Chặn Admin tham gia Online:** Thực thi nguyên tắc an toàn tuyệt đối — tài khoản Quản trị (`ADMIN` / `SYSTEM_ADMIN`) không được tham gia hàng đợi thi đấu hoặc phòng chơi Online với tư cách đấu thủ (`403 ADMIN_CANNOT_PLAY_ONLINE`).
  2. **Chặn truy cập URL trực tiếp trái phép:** Khi người dùng chưa đăng nhập hoặc không đủ thẩm quyền truy cập thẳng các URL `/admin/*`, giao diện phải chặn an toàn bằng Guard và cung cấp đường dẫn chuyển tiếp (`loginReturnPath`) hợp lệ.
  3. **Bảo toàn dữ liệu nháp (Draft Preservation):** Đảm bảo trên các trang cấu hình nháp (P02 Wizard), dữ liệu người dùng đã nhập không bị xóa trắng khi xảy ra lỗi mạng hoặc lỗi thẩm định từ máy chủ.
  4. **Thông báo lỗi an toàn (Safe Errors):** Chuẩn hóa thông điệp lỗi người dùng, tuyệt đối không rò rỉ mã lỗi nội bộ, database stack trace hay khóa token ra ngoài màn hình.
