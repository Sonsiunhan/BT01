# S10 — Browser E2E Đầy Đủ Các Trang Sơn (P01, P02, P03, P14, P15)

## 1. Thông tin chung
- **Task ID:** S10
- **Người thực hiện:** Sơn
- **Thời gian:** 2026-10-23
- **Trạng thái:** DONE
- **Phạm vi giao diện:** P01 (Danh sách giải đấu), P02 (Wizard tạo giải đấu), P03 (Chi tiết giải đấu & Điều kiện sẵn sàng), P14 (Nhật ký kiểm toán hệ thống/giải đấu), P15 (Hub công cụ Offline & Kho Bot)
- **Dependencies:** S09, N08, L09, D09 (Tất cả dependencies đã hoàn tất và tích hợp trên nhánh `son-tournament`)

## 2. Mục tiêu trọng tâm
1. **Kiểm thử E2E trình duyệt thật với Playwright:**
   - Xây dựng suite kiểm thử tự động `tests/e2e/s10-tournament-admin-flow.spec.ts` chạy trực tiếp trên Chromium không đầu (headless), tương tác thật qua DOM, URL navigation, form filling, modal confirmation, responsive resizing và accessibility scanning.
   - Không phụ thuộc dữ liệu tĩnh giả lập (mocking) tùy tiện, tuân thủ đúng phân quyền TOURNAMENT_ADMIN và các API contract chuẩn của `@ottv2/contracts`.
2. **Bảo đảm 5 trang giao diện Sơn vận hành trơn tru:**
   - **P01 (Danh sách giải đấu):** Thanh tìm kiếm thời gian thực, lọc theo nhóm trạng thái (Tabs), chuyển đổi viewport (Mobile 375x812, Tablet 768x1024, Desktop 1440x900) không tràn ngang (`scrollWidth <= clientWidth`), kiểm toán Accessibility (Axe-core WCAG 2.0/2.1 AA) không có lỗi nghiêm trọng.
   - **P02 (Wizard tạo giải nháp):** Dẫn dắt 4 bước nháp, đồng bộ dữ liệu hồ sơ, kết nối Rule Widget bản cuối xem trước luật, và modal nộp duyệt với ghi chú.
   - **P03 (Chi tiết giải đấu):** Hiển thị đầy đủ 5 liên kết điều hành phân hệ (`action-rules-btn`, `action-roster-btn`, `action-staff-btn`, `action-bot-readiness-btn`, `action-audit-btn`), chuyển tab Cấu hình / Sẵn sàng, đối soát tiêu chí khởi chạy và hiển thị blocker nếu có.
   - **P04/P14 (Nhật ký kiểm toán):** Xem nhật ký hệ thống toàn cục và nhật ký riêng theo giải đấu, bộ lọc đối tượng mục tiêu, khử hoàn toàn dữ liệu nhạy cảm (mật khẩu, khóa bí mật, session token).
   - **P15 (Hub công cụ Offline & Kho Bot):** Đủ 4 lối vào chế độ Offline, banner giải thích mô hình an toàn Sandbox trình duyệt (không chạy mã trên server), giao diện Kho Bot bảo vệ tính riêng tư của mã nguồn.
3. **Bộ kiểm thử đơn vị & Invariants:**
   - Tạo bộ kiểm thử độc lập `tests/unit/s10-browser-e2e.unit.test.ts` xác thực toàn bộ cấu trúc và điều kiện biên mà không cần dựng trình duyệt.

## 3. Cấu trúc tài liệu đính kèm
- `README.md`: Tổng quan và phạm vi công việc S10.
- `implementation_plan.md`: Kế hoạch 6 bước chuẩn (Plan -> Harness -> Dev -> Test -> Review -> Clean Rubbish Code).
- `S10-DESIGN.md`: Thiết kế kỹ thuật bộ kiểm thử E2E, mock contracts và chiến lược kiểm toán responsive/a11y.
- `S10-ACCEPTANCE.md`: Bộ tiêu chí nghiệm thu từ AC-01 đến AC-05.
- `S10-RESULT-2026-10-23.md`: Báo cáo kết quả chạy kiểm thử Playwright và Vitest, kèm bằng chứng định lượng.
