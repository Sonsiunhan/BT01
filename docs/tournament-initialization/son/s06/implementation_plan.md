# S06 — Implementation Plan: Audit Viewer FE/BE và Nối Readiness Core (P14 | P03)

**Owner:** Sơn
**Task:** S06
**Trang:** P14 — Nhật ký kiểm toán (`/admin/audit`, `/admin/tournaments/:tournamentId/audit`) & P03 — Chi tiết giải đấu
**Dependencies:** S05, L05; G0 PASS
**Status:** IN_PROGRESS

---

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu
Xây dựng giao diện nhật ký kiểm toán quản trị hệ thống và giải đấu `AuditLogsViewerPage.tsx` (P14), kết nối trực tiếp với API backend `/api/admin/audit-logs`:
1. **Giao diện Audit Viewer toàn hệ thống (`/admin/audit`):**
   - Bộ lọc theo Loại mục tiêu (`targetType`: `UNIT`, `CONTRACT`, `TOURNAMENT`, `CHANGE_REQUEST`, `RULE_VERSION`, `ADJUDICATION`, `ROSTER`, `STAFF`, `SUPPORT`).
   - Ô nhập tìm kiếm Mã mục tiêu (`targetId`) và Lọc theo Người thao tác (`actorUserId`).
   - Phân trang, hiển thị tổng số bản ghi và thời điểm ghi nhận (định dạng UTC+7).
2. **Giao diện Audit Viewer theo ngữ cảnh giải đấu (`/admin/tournaments/:tournamentId/audit`):**
   - Tự động gán và khóa phạm vi `targetId = tournamentId`, hiển thị tiêu đề và nút quay lại trang Chi tiết giải đấu (P03).
3. **Trình xem chi tiết bản ghi (Snapshot Inspector Modal / Expandable View):**
   - Cho phép người quản trị xem chi tiết `beforeSnapshot` và `afterSnapshot`.
   - Đảm bảo dữ liệu đã qua lớp khử nhạy cảm sâu (`SanitizingAuditService` — BR-41, BR-42, T077), không làm lộ mật khẩu, mã xác thực hay khóa bí mật.
4. **Nối Audit Viewer và làm rõ Blocker trong trang Chi tiết giải đấu `TournamentDetailPage.tsx` (P03):**
   - Đặt nút hành động nhanh "Xem nhật ký kiểm toán" trong trang giải đấu.
   - Thể hiện trạng thái sẵn sàng (Readiness) với chi tiết blockers, hướng dẫn quản trị viên tra cứu nhật ký khi có thay đổi trạng thái hoặc phán quyết.
5. **Đăng ký Router chính thức:**
   - Thay thế `AdminRoutePending` tại `routes.adminAudit` và `routes.adminTournamentAudit` bằng component `AuditLogsViewerPage`.

### 1.2 Out of scope
- Xuất file báo cáo kiểm toán định dạng PDF/Excel có chữ ký số (thuộc phạm vi mở rộng).
- Thay đổi hoặc xóa bản ghi kiểm toán (hệ thống kiểm toán là append-only, bất biến).

---

## 2. File Ownership

| File | Phân loại | Mô tả |
|---|---|---|
| `docs/tournament-initialization/son/s06/*` | Docs | Tài liệu README, DESIGN, ACCEPTANCE, RESULT, Implementation Plan của S06 |
| `apps/web/src/features/admin/tournaments/AuditLogsViewerPage.tsx` | UI | Trang nhật ký kiểm toán P14 hỗ trợ cả chế độ toàn cục và chế độ theo giải đấu |
| `apps/web/src/features/admin/tournaments/AuditLogsViewerPage.test.tsx` | Test | Component tests cho AuditLogsViewerPage |
| `apps/web/src/features/admin/tournaments/tournamentApi.ts` | API Client | Bổ sung phương thức `listAuditLogs` vào `TournamentApiPort` và client |
| `apps/web/src/features/admin/tournaments/TournamentDetailPage.tsx` | UI | Nối liên kết tới Audit Viewer và làm nổi bật liên kết tra cứu blocker |
| `apps/web/src/app/router.tsx` | Router | Mount `AuditLogsViewerPage` vào `routes.adminAudit` và `routes.adminTournamentAudit` |
| `tests/unit/s06-audit-viewer-readiness.unit.test.ts` | Test | Unit tests kiểm tra tích hợp API, bộ lọc, snapshot và readiness core link |

---

## 3. Kế hoạch triển khai (Harness → Dev → Test → Review)

1. **Harness First:**
   - Tạo bộ kiểm thử `tests/unit/s06-audit-viewer-readiness.unit.test.ts` và `AuditLogsViewerPage.test.tsx` kiểm tra các tiêu chí nghiệm thu AC-01 đến AC-05.
2. **Cập nhật API Client:**
   - Bổ sung `listAuditLogs` vào `TournamentApiPort` trong `tournamentApi.ts`.
3. **Phát triển UI Component `AuditLogsViewerPage.tsx` (P14):**
   - Thiết kế giao diện theo phong cách Robot Lab với bảng dữ liệu, huy hiệu vai trò, bộ lọc, modal xem chi tiết snapshot.
4. **Tích hợp vào `TournamentDetailPage.tsx` (P03):**
   - Bổ sung nút liên kết nhật ký kiểm toán trong thanh tác vụ của giải đấu.
5. **Cập nhật Router:**
   - Đăng ký `AuditLogsViewerPage` cho cả 2 route `adminAudit` và `adminTournamentAudit`.
6. **Kiểm thử toàn diện & Bàn giao:**
   - Chạy toàn bộ test suites (`vitest`, `pnpm run test:unit`, TypeScript check).
   - Lập báo cáo `S06-RESULT-2026-10-22.md`.
