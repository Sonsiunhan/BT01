# Task S06 — Audit Viewer FE/BE và Nối Readiness Core (P14 | P03)

## 1. Thông tin tổng quan
- **Mã task:** `S06`
- **Tên nhiệm vụ:** Audit viewer FE/BE và nối readiness core (P14 — `/admin/audit`, `/admin/tournaments/:tournamentId/audit` & P03)
- **Phụ trách:** Sơn
- **Thời lượng dự kiến:** 2 giờ
- **Đầu vào phụ thuộc:**
  - `S05`: Trang chi tiết giải đấu và panel readiness P03
  - `L02`/`L05`: Cổng kiểm toán `AuditPort` (`SanitizingAuditService`), API `GET /api/admin/audit-logs` và Authoritative Readiness Aggregator từ backend
  - `G0`: Governance gate check PASS
- **Đầu ra chính:**
  1. Giao diện nhật ký kiểm toán hệ thống & giải đấu `AuditLogsViewerPage.tsx` (P14):
     - Chế độ toàn hệ thống: `/admin/audit` với các bộ lọc `targetType`, `targetId`, `actorUserId`, tìm kiếm `action`, phân trang.
     - Chế độ phạm vi giải đấu: `/admin/tournaments/:tournamentId/audit` tự động lọc theo `targetId = tournamentId`, có thanh điều hướng quay lại trang giải đấu P03.
     - Xem chi tiết snapshot (`beforeSnapshot` / `afterSnapshot`) định dạng an toàn, đảm bảo đã khử nhạy cảm sâu theo quy định BR-41, BR-42, T077.
     - Trạng thái tải (loading), rỗng (empty state) và xử lý lỗi đồng bộ.
  2. Nối liên kết kiểm toán và hiển thị blockers chuẩn xác trong `TournamentDetailPage.tsx` (P03):
     - Nút/liên kết nhanh "Nhật ký kiểm toán" dẫn trực tiếp đến `/admin/tournaments/:tournamentId/audit`.
     - Đồng bộ danh sách blockers từ authoritative snapshot với bảng kiểm toán.
  3. Mở rộng `TournamentApiPort` trong `tournamentApi.ts` với phương thức `listAuditLogs`.
  4. Đăng ký trang chính thức trong `apps/web/src/app/router.tsx` tại `routes.adminAudit` và `routes.adminTournamentAudit`.
  5. Bộ kiểm thử tự động:
     - `apps/web/src/features/admin/tournaments/AuditLogsViewerPage.test.tsx`
     - `tests/unit/s06-audit-viewer-readiness.unit.test.ts` (5/5 AC passed).

## 2. Cấu trúc tài liệu S06
- `README.md`: Tổng quan nhiệm vụ và liên kết tài liệu.
- `implementation_plan.md`: Kế hoạch chi tiết triển khai S06.
- `S06-DESIGN.md`: Thiết kế kiến trúc trang P14, cấu trúc dữ liệu kiểm toán, bộ lọc và quy tắc an toàn dữ liệu.
- `S06-ACCEPTANCE.md`: Ma trận tiêu chí nghiệm thu AC-01 đến AC-05.
- `S06-RESULT-2026-10-22.md`: Báo cáo kết quả thực thi và bằng chứng kiểm thử tự động.
