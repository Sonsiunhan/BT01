# Tiêu Chí Nghiệm Thu Task S12 (AC-01..AC-05)

## Bảng Ma Trận Nghiệm Thu

| Tiêu chí | Mô tả yêu cầu | Phương thức kiểm chứng | Kết quả |
| :--- | :--- | :--- | :---: |
| **AC-01** | **Chặn Admin thi đấu Online:** Tài khoản quản trị không có nút/CTA mời chơi Online tại Admin Shell; khi gọi API vào hàng đợi hoặc phòng chơi với tư cách player, server trả về mã lỗi `403 ADMIN_CANNOT_PLAY_ONLINE`. | Kiểm tra server admission-gate & shell router | **PASS** |
| **AC-02** | **Chặn URL trực tiếp trái phép & Return Path:** Khách hoặc tài khoản chưa xác thực truy cập trực tiếp URL quản trị (`/admin/tournaments`, `/admin/tournaments/new`, `/admin/audit`, `/admin/offline`) bị chặn bởi `AdminCapabilityGuard`, hiển thị màn hình yêu cầu đăng nhập và lưu `returnUrl` an toàn. | Vitest AC-02 & AdminCapabilityGuard test | **PASS** |
| **AC-03** | **Chặn phân quyền vai trò chuyên sâu (TA/Admin):** Người dùng thông thường vào `/admin/ta` bị hiển thị thông báo cấm quyền (`ta-forbidden`); thí sinh vào `/admin/tournaments/:id/roster` nhận phản hồi máy chủ 403 Forbidden. | Vitest AC-03 & AdminTaPage / Roster tests | **PASS** |
| **AC-04** | **Bảo toàn dữ liệu nháp (Draft Preservation):** Tại trang Wizard tạo giải (P02), khi form gặp lỗi mạng hoặc lỗi thẩm định từ máy chủ, state nháp (tên giải, slug, hợp đồng, các nhóm form) được giữ nguyên, không bắt người dùng nhập lại từ đầu. | Vitest AC-04 & TournamentWizardPage inspection | **PASS** |
| **AC-05** | **Thông báo lỗi an toàn (Safe Errors):** Mọi lỗi hiển thị trên P01, P02, P03, P14, P15 đều đi qua bộ lọc `safeErrorMessage`, không bao giờ hiển thị Prisma query, database credentials, hoặc session tokens. | Vitest AC-05 & Error sanitization assertions | **PASS** |
