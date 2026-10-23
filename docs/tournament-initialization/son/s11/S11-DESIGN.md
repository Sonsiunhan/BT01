# Thiết Kế Phương Pháp Luận & Khung Kiểm Toán Chéo Task S11

## 1. Mục tiêu và Nguyên tắc Kiểm toán
Task **S11** thực hiện kiểm toán chéo (cross-review) độc lập phân hệ của Đức (`D00`–`D10`) từ góc nhìn tích hợp giao diện (Frontend Shell), ranh giới bảo mật phân quyền (ACL) và tính toàn vẹn trạng thái vòng đời (Lifecycle & Transaction).

### Nguyên tắc bất biến
1. **Không sửa trực tiếp file của Đức:** Tuân thủ quy định phân quyền branch và single-writer. Mọi phát hiện được phân loại mức độ nghiêm trọng (P0/P1/P2) và lập thành bằng chứng.
2. **Kiểm chứng bằng chạy thực tế:** Dựa trên kết quả test định lượng (`pnpm test`, Vitest, Playwright browser), không dùng suy diễn lý thuyết.
3. **Phân định rõ ranh giới quyền lực:** Quyền hạn phải do máy chủ thực thi; client UI không được chứa logic tự phong quyền hay tự cho qua rào kiểm tra.

---

## 2. Danh mục Kiểm tra Chi tiết (Review Checklist)

### 2.1 UI / UX & Khả năng tiếp cận (Accessibility)
- [x] Các trang P09–P13, P17–P18 đồng bộ biến màu CSS (`var(--border)`, `var(--surface)`, `var(--muted)`).
- [x] Có đầy đủ trạng thái `loading`, `error`, `empty` và nút thử lại khi mạng gặp sự cố.
- [x] Các form nhập liệu đều có `aria-label`, thông báo lỗi dễ hiểu và không làm mất dữ liệu nháp khi submit thất bại.
- [x] Có `data-testid` chuẩn mực cho các phần tử tương tác chính phục vụ E2E.

### 2.2 Ranh giới Quyền hạn & Chống IDOR (ACL Enforcement)
- [x] **P09 Admin TA:** Chỉ `SYSTEM_ADMIN` mới có quyền xem danh sách và gán TA cho hợp đồng.
- [x] **P10 Roster:** Chỉ TA sở hữu hợp đồng/giải đấu mới được upload và commit roster. Thí sinh bình thường truy cập trực tiếp URL `/admin/tournaments/:id/roster` bị server từ chối ngay lập tức (HTTP 403).
- [x] **P11 Staff:** Chỉ TA của giải mới được gửi lời mời trọng tài và hủy phân công.
- [x] **P12 Support:** Hàng đợi hỗ trợ `/admin/support` yêu cầu quyền quản trị; form gửi yêu cầu `/account-access` cho phép người dùng chưa đăng nhập gửi phiếu.

### 2.3 Bảo mật Dữ liệu & Xử lý Tranh chấp (Data Safety & Concurrency)
- [x] **Chống Replay Token:** Token kích hoạt (`/kich-hoat/:token`) và token khôi phục chỉ được dùng 1 lần. Khi replay một token đã dùng, hệ thống trả về kết quả idempotent với trạng thái `CLAIMED`/`RESOLVED` mà không sinh tài khoản trùng lặp.
- [x] **Cách ly Token:** Token kích hoạt thô (`claimToken`) chỉ lưu trong state React tức thời để hiển thị bàn giao trực tiếp tại UI, tuyệt đối không ghi vào `window.localStorage` hoặc `window.sessionStorage`.
- [x] **Chống nhấp đúp (Double Submit):** Nút commit roster, nút gửi lời mời, nút tiếp nhận lời mời đều debounce và disable khi đang thực thi request.
- [x] **Chống giả mạo request (CSRF):** Toàn bộ API client gửi header `X-OTT-Request: 1` và chuẩn hóa Content-Type.

### 2.4 Bảo vệ Rào điều lệ (Rules Acknowledgement Guard)
- [x] `TournamentAcknowledgementGuard` kiểm tra bằng một transaction có tính tuần tự (serializable) trước khi bắt đầu giải.
- [x] Chặn đứng trường hợp trọng tài bị thu hồi ngay sát thời điểm xác nhận điều lệ.
- [x] Ngăn chặn hoàn toàn việc bypass xác nhận điều lệ qua thay đổi URL hoặc mạo danh role/principal trong body request.
