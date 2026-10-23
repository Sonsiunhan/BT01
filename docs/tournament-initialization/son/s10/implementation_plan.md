# Kế hoạch thực hiện Task S10: Browser E2E Đầy Đủ Các Trang Sơn (P01, P02, P03, P14, P15)

## 1. Mục tiêu và phạm vi
- Xây dựng kịch bản kiểm thử E2E trên trình duyệt Chromium bằng Playwright cho toàn bộ 5 màn hình quản trị thuộc phạm vi phụ trách của Sơn:
  - **P01:** Danh sách giải đấu (`/admin/tournaments`)
  - **P02:** Wizard tạo giải đấu nháp 4 bước (`/admin/tournaments/new`)
  - **P03:** Chi tiết giải đấu & Điều kiện sẵn sàng (`/admin/tournaments/:tournamentId`)
  - **P14:** Nhật ký kiểm toán (`/admin/audit` & `/admin/tournaments/:tournamentId/audit`)
  - **P15:** Hub công cụ Offline (`/admin/offline` & `/admin/offline/bots`)
- Bổ sung bộ kiểm thử đơn vị `tests/unit/s10-browser-e2e.unit.test.ts` đảm bảo kiểm soát tính toàn vẹn tĩnh và hợp đồng dữ liệu.

## 2. Quy trình thực hiện (6 bước chuẩn)

### Bước 1: Kế hoạch (Plan)
- Khảo sát mã nguồn thực tế của cả 5 trang giao diện, liệt kê đầy đủ `data-testid`, vai trò ARIA, định dạng đường dẫn và các endpoint API backend tương ứng.
- Phân tích yêu cầu responsive (Mobile 375px, Tablet 768px, Desktop 1440px) và tiêu chuẩn tiếp cận Web (Axe WCAG 2.0/2.1 AA).
- Xác định quyền hạn cần thiết: vai trò `TOURNAMENT_ADMIN`, capability `tournament.create`, `offline.hub.read`.

### Bước 2: Thiết lập khung kiểm thử (Harness)
- Khởi tạo file kiểm thử E2E `tests/e2e/s10-tournament-admin-flow.spec.ts`.
- Thiết lập hàm hỗ trợ phiên đăng nhập `prepareAdmin(page)`:
  - Khởi tạo `SilentEventSource` ngăn lỗi ngắt kết nối SSE giả định.
  - Mock chuẩn `**/auth/me` với vai trò TOURNAMENT_ADMIN.
  - Mock `**/health` đầy đủ `protocolVersion: "0.1"` và trạng thái ok để giao diện Console không bị rơi vào chế độ "Mất kết nối mạng".
  - Mock các endpoint REST API: `/api/tournaments`, `/api/tournaments/:id/readiness`, `/api/admin/audit-logs`, `/api/offline/capabilities`, `/bot-library`.

### Bước 3: Phát triển (Dev)
- Viết 5 ca kiểm thử đại diện cho 5 tiêu chí AC-01 đến AC-05:
  1. **Test 1 (P01):** Duyệt danh sách qua 3 kích thước màn hình, kiểm tra thanh công cụ lọc và quét Axe.
  2. **Test 2 (P02):** Điền biểu mẫu Wizard 4 bước, xem trước luật, kích hoạt modal nộp duyệt.
  3. **Test 3 (P03):** Xác thực 5 liên kết phân hệ, kiểm tra tab Sẵn sàng và Cấu hình.
  4. **Test 4 (P14):** Kiểm tra trang Audit toàn cục và theo giải đấu, lọc theo đối tượng, bảo mật thông tin nhạy cảm.
  5. **Test 5 (P15):** Kiểm tra Hub Offline 4 lối vào, banner sandbox Web Worker, và danh sách Kho Bot.
- Tinh chỉnh CSS responsive trong `TournamentListPage.tsx`, `TournamentFilterToolbar.tsx`, `TournamentCard.tsx` để hỗ trợ màn hình cực nhỏ (375px).

### Bước 4: Kiểm thử (Test)
- Chạy Playwright E2E: `npx playwright test tests/e2e/s10-tournament-admin-flow.spec.ts`.
- Chạy Vitest Unit: `npx vitest run tests/unit/s10-browser-e2e.unit.test.ts`.
- Chạy kiểm tra TypeScript toàn bộ monorepo: `pnpm run typecheck`.

### Bước 5: Đánh giá & Rà soát (Review)
- Đối chiếu nghiêm ngặt quy ước hợp tác: Không sửa đổi mã nguồn ngoài phạm vi Sơn.
- Đảm bảo các thông điệp giao diện đều là tiếng Việt đúng chuẩn Robot Lab.
- Không để lộ mã nguồn bot gốc trong nhật ký hoặc danh sách chung.

### Bước 6: Làm sạch mã rác (Clean Rubbish Code)
- Loại bỏ các log debug thử nghiệm.
- Lưu trữ kết quả kiểm thử đầy đủ trong `S10-RESULT-2026-10-23.md`.
- Cập nhật trạng thái `DONE` cho task S10 trong `docs/tournament-initialization/DELIVERY-TASKS.csv`.
