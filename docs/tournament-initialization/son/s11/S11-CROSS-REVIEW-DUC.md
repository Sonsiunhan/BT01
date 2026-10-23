# S11 — Biên Bản Review Chéo Phân Hệ Tài Khoản, Roster, Nhân Sự & Điều Lệ Của Đức

- **Người thực hiện:** Sơn (Frontend Lead / Admin Shell & Pages P01, P02, P03, P14, P15)
- **Đối tượng được review:** Đức (`D00`–`D10`: `P09`–`P13`, `P17`–`P18`, `apps/server/src/modules/tournament-core/acknowledgement-guard.ts`, `apps/web/src/features/tournament-roster/`, `apps/web/src/features/tournament-staff/`, `apps/web/src/features/account/`)
- **Ngày thực hiện:** 2026-10-23
- **Trạng thái:** **APPROVED (Chấp thuận 100% — Không có lỗi cản trở release)**

---

## 1. Bảng Tổng Hợp Kiểm Tra Theo Trang và Phân Hệ

| Trang | Route & Thành phần | Vai trò thực hiện | Đánh giá UI / UX | Đánh giá Bảo mật & Quyền (ACL) | Đánh giá Xử lý Tranh chấp (Concurrency) | Kết luận |
|---|---|:---:|---|---|---|:---:|
| **P09** | `/admin/ta`<br>`AdminTaPage` | `SYSTEM_ADMIN` | Đạt chuẩn, hiển thị bảng TA và modal gán hợp đồng rõ ràng. | Chặn hoàn toàn người dùng không phải Admin (`403 FORBIDDEN`). | Không có tranh chấp nguy hiểm. | **PASS** |
| **P10** | `/admin/tournaments/:id/roster`<br>`TournamentRosterPage` | `TOURNAMENT_ADMIN` | Giao diện nạp CSV có preview tách biệt Valid / Error / Warning. | Thí sinh vào trực tiếp bị chặn 403. Chỉ TA sở hữu mới được commit. | Chống nhấp đúp (double-submit) bằng cờ `committing` và CAS server. | **PASS** |
| **P11** | `/admin/tournaments/:id/staff`<br>`TournamentStaffPage` | `TOURNAMENT_ADMIN` | Hiển thị danh sách phân công, badge trạng thái và nút thu hồi. | Chỉ TA gửi được lời mời. Lời mời thu hồi không thể tái kích hoạt. | Debounce nút gửi; hỗ trợ xóa lời mời đang chờ. | **PASS** |
| **P12** | `/admin/support`, `/account-access`<br>`SupportRecoveryPage` | `SYSTEM_ADMIN` & Thí sinh | Tách bạch form yêu cầu công khai và hàng đợi xử lý của admin. | Admin kiểm tra ghi nhận mã xác minh trước khi cấp token đặt lại. | Phiếu hỗ trợ chuyển trạng thái theo luồng khép kín (`RESOLVED`). | **PASS** |
| **P13** | `/kich-hoat/:token`<br>`AccountActivationPage` | Thí sinh nạp danh sách | Form thiết lập mật khẩu trực quan, thông báo lỗi an toàn. | Token một lần tự vô hiệu hóa sau khi kích hoạt thành công. | Replay token trả về trạng thái idempotent `CLAIMED`, không tạo user lặp. | **PASS** |
| **P17** | `/staff/invitations/:id/:token`<br>`InvitationAcceptancePage` | Trọng tài (`REFEREE`) | Nút Chấp nhận / Từ chối hiển thị rõ ràng, xác nhận tức thì. | Token liên kết đúng giải đấu và vai trò chỉ định. | Nhấp đúp được chặn; replay trả về kết quả đã ghi nhận. | **PASS** |
| **P18** | `/tournaments/:id/rules-ack/:contractId`<br>`RulesAcknowledgementPage` | Thí sinh tham gia | Tóm tắt điều lệ, phiên bản hiệu lực và nút xác nhận điều lệ. | Bắt buộc đúng `config_version_id` hiện hành. Không spoof được quyền. | Không thể bỏ qua bước xác nhận để vào hàng đợi thi đấu. | **PASS** |

---

## 2. Các Điểm Nổi Bật và Tối Ưu Tốt Trong Phân Hệ Của Đức

1. **Mô hình bàn giao Token một lần an toàn (Transient Token Handoff Pattern):**
   - Khi TA phát hành mã kích hoạt hoặc cấp lại mật khẩu, mã kích hoạt thô (`claimToken`) chỉ được lưu trong bộ nhớ React state tức thời của trang hiện tại để TA copy/bàn giao. Mã này tuyệt đối **không được lưu vào `localStorage` hay `sessionStorage`**, ngăn chặn triệt để rủi ro rò rỉ token qua XSS hoặc lưu vết trên máy tính dùng chung.
2. **Khắc phục kịp thời ranh giới CSRF và HTTP Header:**
   - Trong `tournamentStaffApi.ts`, Đức đã chủ động bổ sung header bảo mật `X-OTT-Request: 1` và chuẩn hóa việc không gửi `Content-Type: application/json` đối với các request POST không có body (như hành động revoke assignment). Điều này giúp API vượt qua toàn bộ các rào kiểm tra bảo mật CSRF nghiêm ngặt của server Fastify.
3. **Bảo vệ rào điều lệ đa luồng với Serializable Transaction (`TournamentAcknowledgementGuard`):**
   - Sự kết hợp giữa `acknowledgement-guard.ts` và `lifecycle-transaction.ts` tạo ra rào chắn nguyên tử (atomic boundary): Khi giải đấu chuẩn bị chuyển trạng thái `RUNNING`, hệ thống kiểm tra đồng thời trạng thái nhân sự trọng tài và tình trạng ký nhận điều lệ của thí sinh trong cùng một giao dịch cơ sở dữ liệu. Nếu một trọng tài bị thu hồi trong khoảnh khắc chuyển trạng thái, giải đấu lập tức hủy tiến trình bắt đầu và rollback toàn bộ.
4. **Xóa bỏ hoàn toàn rò rỉ bí mật trong Nhật ký và Lỗi:**
   - Qua kiểm tra các payload trả về và kiểm thử bảo mật `D09CFrontendSecurity.test.tsx`, không có bất kỳ trường nhạy cảm nào như `passwordHash`, `privateKey`, hay chuỗi kết nối database bị phơi bày ra giao diện người dùng.

---

## 3. Các Ghi Nhận và Khuyến Nghị Bổ Sung (Không cản trở Release)

- **Ghi nhận 1 (UI Performance cho Roster lớn):** Bảng danh sách thí sinh trên trang `TournamentRosterPage` hiện đang render trực tiếp danh sách mảng HTML. Với quy mô giải đấu thử nghiệm thông thường (<500 thí sinh), hiệu năng hoàn toàn mượt mà. Trong các giai đoạn mở rộng tương lai (hàng nghìn thí sinh), có thể cân nhắc áp dụng virtualized list (như `react-window`).
- **Ghi nhận 2 (Thông báo xác nhận điều lệ):** Tại trang `RulesAcknowledgementPage`, sau khi xác nhận điều lệ thành công, giao diện chuyển sang trạng thái xanh `satisfied = true`. Sẽ tuyệt vời hơn nếu trang hiển thị thêm một nút tắt điều hướng nhanh quay trở lại trang thi đấu cá nhân (`/rooms` hoặc `/matchmaking`).

---

## 4. Kết Luận
Toàn bộ mã nguồn, kiểm thử và thiết kế của Đức (`D00`–`D10`) đạt tiêu chuẩn kỹ thuật cao, đáp ứng 100% các cam kết bảo mật và hợp đồng API. **Chính thức xác nhận PASS Task S11.**
