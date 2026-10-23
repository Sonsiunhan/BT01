# S06 — Acceptance Criteria: Audit Viewer FE/BE và Nối Readiness Core

## Danh sách tiêu chí nghiệm thu

| Mã AC | Tiêu chí nghiệm thu | Phương thức kiểm tra | Kết quả kỳ vọng |
|---|---|---|---|
| **AC-01** | Giao diện toàn hệ thống `AuditLogsViewerPage` hiển thị danh sách nhật ký kiểm toán với đầy đủ thông tin thời gian, người thực hiện, hành động, loại mục tiêu | Component test & Unit test | Hiển thị bảng kiểm toán đầy đủ cột, định dạng thời gian UTC+7, huy hiệu vai trò chính xác |
| **AC-02** | Hỗ trợ lọc theo loại mục tiêu (`targetType`), mã mục tiêu (`targetId`), người thao tác (`actorUserId`) | Component test & API test | Gửi đúng tham số query lên endpoint `GET /api/admin/audit-logs` và cập nhật danh sách hiển thị tương ứng |
| **AC-03** | Chế độ scoped cho giải đấu (`/admin/tournaments/:tournamentId/audit`) tự động cố định `targetId = tournamentId` và hiển thị nút quay lại chi tiết giải đấu | Component test & Router test | Bảng kiểm toán chỉ hiển thị các thao tác liên quan tới giải đấu đó; có nút "Quay lại giải đấu" liên kết tới P03 |
| **AC-04** | Modal xem chi tiết Snapshot hiển thị `beforeSnapshot` và `afterSnapshot` có cấu trúc rõ ràng, không làm lộ dữ liệu mật | UI inspector test | Mở được modal chi tiết, hiển thị JSON snapshot định dạng gọn gàng, có nút đóng modal |
| **AC-05** | Trang Chi tiết giải đấu `TournamentDetailPage` (P03) tích hợp nút truy cập nhanh sang nhật ký kiểm toán giải đấu và đồng bộ trạng thái blockers | Integration test | Nút "Nhật ký kiểm toán" xuất hiện trên P03 và điều hướng đúng đường dẫn; không làm mất tính toàn vẹn của Readiness Panel |
