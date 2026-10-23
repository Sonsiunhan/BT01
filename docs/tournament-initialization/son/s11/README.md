# Task S11 — Review Chéo Phân Hệ Tài Khoản, Roster, Nhân Sự & Hỗ Trợ Của Đức (D00–D10)

## 1. Thông tin tổng quan
- **Mã Task:** `S11`
- **Người thực hiện:** Sơn (Frontend Lead / Admin Shell & Pages P01, P02, P03, P14, P15)
- **Đối tượng được review:** Phân hệ của Đức (`D00`–`D10`):
  - **P09:** Trang gán tài khoản Quản trị viên giải đấu (`AdminTaPage`, `/admin/ta`)
  - **P10:** Trang danh sách & nạp Roster thí sinh (`TournamentRosterPage`, `/admin/tournaments/:id/roster`)
  - **P11:** Trang quản lý nhân sự & trọng tài (`TournamentStaffPage`, `/admin/tournaments/:id/staff`)
  - **P12:** Trang hỗ trợ tài khoản & hàng đợi khôi phục (`SupportRecoveryPage`, `/admin/support`, `/account-access`)
  - **P13:** Trang kích hoạt tài khoản một lần (`AccountActivationPage`, `/kich-hoat/:token`)
  - **P17:** Trang tiếp nhận lời mời nhân sự / trọng tài (`InvitationAcceptancePage`, `/staff/invitations/:id/:token`)
  - **P18:** Trang xác nhận điều lệ quy chế (`RulesAcknowledgementPage`, `/tournaments/:id/rules-ack/:contractId`)
  - Lõi bảo vệ điều lệ: `TournamentAcknowledgementGuard`, `lifecycle-transaction.ts`
- **Tiêu chí làm việc:** Tuân thủ nguyên tắc cộng tác: *Không sửa trực tiếp file tính năng của Đức; ghi nhận phát hiện, kiểm chứng độc lập bằng test suite và lập biên bản review chéo.*

## 2. Cấu trúc tài liệu Task S11
- `README.md`: Giới thiệu phạm vi và mục tiêu review chéo S11.
- `S11-ACCEPTANCE.md`: Ma trận tiêu chí nghiệm thu kiểm toán chéo (AC-01..AC-06).
- `S11-DESIGN.md`: Phương pháp luận review, danh mục kiểm tra an toàn UI/ACL/Concurrency.
- `implementation_plan.md`: Kế hoạch và các bước thực thi kiểm chứng độc lập.
- `S11-CROSS-REVIEW-DUC.md`: Báo cáo chi tiết phát hiện kỹ thuật, điểm mạnh, rủi ro biên và kiến nghị.
- `S11-RESULT-2026-10-23.md`: Kết quả nghiệm thu định lượng, log chạy test và kết luận ký duyệt.
