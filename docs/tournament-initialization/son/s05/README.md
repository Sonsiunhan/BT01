# Task S05 — Trang chi tiết giải đấu và Panel Readiness (P03)

## 1. Thông tin tổng quan
- **Mã task:** `S05`
- **Tên nhiệm vụ:** Trang chi tiết giải đấu và panel sẵn sàng (P03 — `/admin/tournaments/:tournamentId`)
- **Phụ trách:** Sơn
- **Thời lượng dự kiến:** 3 giờ
- **Đầu vào phụ thuộc:**
  - `S04`: Form groups và schema CoreConfig hoàn chỉnh
  - `L03`/`L05`: Authoritative lifecycle service & Readiness snapshot API (`/api/tournaments/:tournamentId/readiness`)
  - `G0`: Governance gate check PASS
- **Đầu ra chính:**
  1. Trang `TournamentDetailPage.tsx` (P03) với các tab:
     - **Tổng quan (Overview):** Thông tin cơ bản, huy hiệu trạng thái, tiến độ thời gian, thẻ tóm tắt nhanh.
     - **Cấu hình (Configuration):** Chi tiết toàn bộ 19 trường mở rộng theo đặc tả S04 (Vận hành, Khán giả, Tính điểm, Điều lệ).
     - **Điều kiện sẵn sàng (Readiness Panel):** Hiển thị danh sách checklist tự động (`APPROVAL_STATUS`, `RULE_VERSION_PUBLISHED`, `MIN_ELIGIBLE_PARTICIPANTS`, `NO_PENDING_ADJUDICATION`), các lý do chặn (blockers), số lượng thí sinh/bot đủ điều kiện.
  2. Các nút thao tác chuyển trạng thái vòng đời theo quyền và điều kiện máy chủ:
     - `Mở lịch trình (SCHEDULED)` (khi `canOpenScheduled = true`).
     - `Bắt đầu giải (RUNNING)` (khi `canStartRunning = true`).
     - `Tạm dừng giải (PAUSED)` (khi đang RUNNING kèm lý do).
     - `Tiếp tục giải (RESUME)` (khi đang PAUSED).
  3. Mở rộng `tournamentApi.ts` với các phương thức gọi API lifecycle & readiness.
  4. Đăng ký route chính thức trong `apps/web/src/app/router.tsx` tại `routes.adminTournamentDetail`.
  5. Bộ kiểm thử tự động `tests/unit/s05-tournament-detail-readiness.unit.test.ts` (5/5 AC passed).

## 2. Cấu trúc tài liệu S05
- `README.md`: Tổng quan nhiệm vụ và liên kết tài liệu.
- `S05-DESIGN.md`: Thiết kế giao diện P03, kiến trúc tab, bảng checklist readiness và các quy tắc hiển thị không tạo trạng thái READY giả.
- `S05-ACCEPTANCE.md`: Ma trận tiêu chí nghiệm thu AC-01 đến AC-05.
- `S05-RESULT-2026-10-22.md`: Báo cáo kết quả thực thi và bằng chứng kiểm thử tự động.
- `implementation_plan.md`: Kế hoạch chi tiết triển khai S05.
