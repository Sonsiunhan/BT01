# Tiêu chí nghiệm thu S09 (Acceptance Criteria)

## Bộ tiêu chí AC-01 đến AC-05

### AC-01: Tích hợp hoàn chỉnh Rule Widget bản cuối trong Wizard Step 4 và P04
- **Điều kiện:** Mở `/admin/tournaments/new` hoặc `/admin/tournaments/:id/rules`.
- **Kết quả mong đợi:**
  - `TournamentRulesPage` mở trực tiếp bước 4 của Wizard nháp với `initialStep={4}`.
  - Bước 4 kết nối trực tiếp `TournamentRuleManagementPanel` và `RuleEditor`.
  - Có các chức năng: Kiểm tra tính hợp lệ của luật (preview), xem diff giữa các phiên bản, hiển thị lịch sử phiên bản.
  - Vô hiệu hóa nút Công bố (`publish`) nếu chưa có kết quả preview hợp lệ hoặc sau khi sửa form luật.

### AC-02: Đăng ký & Nối các Route ACK Điều lệ và Trạng thái Bot
- **Điều kiện:** Kiểm tra danh mục route trong `routes.ts` và `router.tsx`.
- **Kết quả mong đợi:**
  - `routes.tournamentRulesAcknowledgement` (`/tournaments/:tournamentId/rules-ack/:contractId`) gắn với `<RulesAcknowledgementPage />`.
  - `routes.adminTournamentBotReadiness` (`/admin/tournaments/:tournamentId/bot-readiness`) gắn với `<BotReadinessPage />`.
  - `routes.adminSupport` (`/admin/support`) gắn với `<SupportRecoveryPage />`.
  - `routes.accountActivation` và `routes.accountAccess` được khai báo và điều hướng chuẩn xác.

### AC-03: Chi tiết giải đấu (P03) liên kết đầy đủ 5 phân hệ vận hành
- **Điều kiện:** Truy cập `/admin/tournaments/:tournamentId`.
- **Kết quả mong đợi:**
  - Header trang cung cấp 5 nút điều hướng rõ ràng:
    1. Luật thi đấu (`action-rules-btn` -> `.../rules`)
    2. Vận động viên / Roster (`action-roster-btn` -> `.../roster`)
    3. Nhân sự / Referee (`action-staff-btn` -> `.../staff`)
    4. Trạng thái Bot (`action-bot-readiness-btn` -> `.../bot-readiness`)
    5. Nhật ký kiểm toán (`action-audit-btn` -> `.../audit`)
  - Chuyển đổi mượt mà giữa 3 tab: Tổng quan (Overview), Cấu hình (Config), Sẵn sàng (Readiness).
  - Không bao giờ giả mạo trạng thái `READY` nếu còn lý do chặn (`blockers`).

### AC-04: Hub công cụ Offline (P15) bảo đảm 4 lối vào và bảo mật Bot
- **Điều kiện:** Truy cập `/admin/offline` và `/admin/offline/bots`.
- **Kết quả mong đợi:**
  - 4 lối vào rõ ràng: Kho Bot, Đấu Bot, Luyện tập Người–Bot, Hai người một máy.
  - Runtime Sandbox thông báo trung thực chính sách `NO_SERVER_RUNNER` và cách ly `BROWSER_WORKER_CPYTHON`.
  - Danh sách Kho Bot chỉ hiển thị mã băm bảo mật SHA-256 (`sourceDigest`), tuyệt đối không để lộ mã nguồn gốc hoặc bộ nhớ riêng tư.

### AC-05: Chuẩn hóa Theme tokens Robot Lab & Ngăn chặn Online CTAs trong Admin
- **Điều kiện:** Kiểm tra toàn bộ các trang Admin (P01, P02, P03, P14, P15).
- **Kết quả mong đợi:**
  - Áp dụng triệt để hệ thống CSS variables Robot Lab (`var(--surface)`, `var(--border)`, `var(--text)`, `var(--system-cyan)`).
  - Không chứa bất kỳ nút bấm hàng đợi trực tuyến (Online Matchmaking CTA) nào trong Admin shell.
  - Phù hợp với hiển thị responsive và thao tác bàn phím (focus-visible).
