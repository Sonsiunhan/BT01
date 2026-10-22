# Task S03 — Wizard tạo bản nháp giải đấu (Trang P02)

## 1. Thông tin tổng quan
- **Mã task:** `S03`
- **Tên nhiệm vụ:** Wizard tạo bản nháp giải đấu (P02 — `/admin/tournaments/new` & `/admin/tournaments/:id/edit`)
- **Phụ trách:** Sơn
- **Thời lượng thực hiện:** 2 giờ (22/10 11:30 – 22/10 13:40)
- **Đầu vào phụ thuộc:**
  - `S01`: Admin Shell layout & Navigation
  - `S02`: Danh sách giải đấu P01 & Client API layer
  - `L01`/`L02`: Hợp đồng API bản nháp giải đấu (`CreateTournamentDraftInputSchema`, `PatchTournamentDraftInputSchema`, `TournamentDtoSchema`, `TournamentCoreConfigSchema`, `TournamentRuleProfileSchema`)
  - `L08`: Quota & Quản lý hợp đồng giải đấu
- **Đầu ra chính:**
  1. Trang Wizard `TournamentWizardPage.tsx` với luồng 4 bước:
     - Bước 1: Hồ sơ & Đơn vị (Tên, mã slug, đơn vị, hợp đồng, phạm vi công khai)
     - Bước 2: Thời gian & Lịch trình (Mô hình thời gian, múi giờ, bắt đầu/kết thúc, mở/đóng danh sách)
     - Bước 3: Thể thức & Quy mô (Chế độ thi đấu, số lượng người chơi min/max, điểm danh)
     - Bước 4: Tổng hợp & Kiểm tra hợp lệ (Xem lại trước khi nộp, lưu nháp, kiểm tra lỗi)
  2. Khả năng phục hồi ngoại tuyến & mạng chập chờn: Bộ đệm Local Storage (`saveLocalDraftBuffer`, `getLocalDraftBuffer`, `clearLocalDraftBuffer`).
  3. Cảnh báo xung đột phiên bản Optimistic Concurrency Control (OCC 409 CONFLICT banner).
  4. Tích hợp backend Fastify server (`apps/server/src/app.ts`) với các route draft (`POST /api/tournaments/drafts`, `PATCH /api/tournaments/:tournamentId`, `GET /api/tournaments/:tournamentId`, `DELETE /api/tournaments/:tournamentId`).
  5. Đăng ký route chính thức trong `apps/web/src/app/router.tsx` tại `routes.adminTournamentNew` và `routes.adminTournamentEdit`.
  6. Bộ kiểm thử đơn vị & component: `tests/unit/s03-tournament-wizard.unit.test.ts` (5/5 AC passed) và `TournamentWizardPage.test.tsx` (5/5 passed).

## 2. Cấu trúc tài liệu S03
- `README.md`: Tổng quan nhiệm vụ và liên kết tài liệu.
- `S03-DESIGN.md`: Thiết kế chi tiết luồng 4 bước wizard, kiến trúc lưu trữ, xử lý OCC 409, và Robot Lab theme.
- `S03-ACCEPTANCE.md`: Ma trận tiêu chí nghiệm thu AC-01 đến AC-05.
- `S03-RESULT-2026-10-22.md`: Báo cáo kết quả thực thi và bằng chứng kiểm thử tự động.
