# Task S02 — Danh sách giải đấu + Capabilities FE/BE (Trang P01)

## 1. Thông tin tổng quan
- **Mã task:** `S02`
- **Tên nhiệm vụ:** Danh sách giải + capabilities FE/BE (P01 — `/admin/tournaments`)
- **Phụ trách:** Sơn
- **Thời lượng kế hoạch:** 2 giờ (21/10 10:00 – 21/10 12:00)
- **Đầu vào phụ thuộc:** `S01` (Admin shell layout & router), `G0` (Gate chốt đặc tả), `L01` (Chốt DTO/Schema), `D01` (Tenant/Auth guard).
- **Đầu ra chính:** 
  1. Trang danh sách giải đấu `TournamentListPage.tsx` và các component con: `TournamentCard`, `TournamentFilterToolbar`, `TournamentEmptyState`.
  2. Typed client & fixtures thích ứng DTO `TournamentDtoSchema` / `TournamentListItem`.
  3. Mount chính thức vào router `/admin/tournaments` (thay thế placeholder `AdminRoutePending`).
  4. Bộ kiểm thử đơn vị `tests/unit/s02-tournament-list.unit.test.ts`.

## 2. Tài liệu đặc tả liên quan
- **Wireframe & State Map:** [S00-UI-STATE-MAP.md](../s00/S00-UI-STATE-MAP.md#4-p01--danh-sách-giảiadmin)
- **Thiết kế hình học & giao diện R2:** [S00-DESIGN-R2.md](../s00/S00-DESIGN-R2.md) (Card layout, bevel Robot Lab, chính sách ít chữ)
- **DTO Console & Query schema:** [S00-CONSOLE-DTO.md](../s00/S00-CONSOLE-DTO.md#3-p01--tournament-list)
- **Form tokens & accessible errors:** [S00-FORM-TOKENS.md](../s00/S00-FORM-TOKENS.md)

## 3. Cấu trúc thư mục task S02
- `README.md`: Tổng quan nhiệm vụ và liên kết tài liệu.
- `S02-DESIGN.md`: Thiết kế chi tiết kiến trúc component, state machine và tokens.
- `S02-ACCEPTANCE.md`: Ma trận nghiệm thu và tiêu chí kiểm thử.
- `S02-RESULT-2026-10-21.md`: Biên bản kết quả kiểm thử và bằng chứng hoàn tất.
