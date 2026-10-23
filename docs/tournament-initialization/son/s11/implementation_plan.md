# Kế Hoạch Thực Thi Task S11 — Review Chéo Phân Hệ Đức

## 1. Các bước thực hiện
1. **Bước 1: Soát xét mã nguồn tĩnh (Static Inspection)**
   - Soát xét toàn bộ các trang frontend của Đức: `AdminTaPage.tsx`, `TournamentRosterPage.tsx`, `TournamentStaffPage.tsx`, `SupportRecoveryPage.tsx`, `AccountActivationPage.tsx`, `InvitationAcceptancePage.tsx`, `RulesAcknowledgementPage.tsx`.
   - Soát xét các API client tương ứng: `tournamentRosterApi.ts`, `tournamentStaffApi.ts`, `rulesAcknowledgementApi.ts`, `recoveryApi.ts`, `activationApi.ts`.
   - Soát xét ranh giới bảo mật server: `acknowledgement-guard.ts`, `lifecycle-transaction.ts`.
2. **Bước 2: Phân tích các ca kiểm thử và báo cáo sẵn có của Đức (Evidence Audit)**
   - Đọc kết quả D10-A, D10-B, D10-C (`D10-A-RESULT-2026-10-23.md`, `D10-B-RESULT-2026-10-23.md`, `D10-C-RESULT-2026-10-23.md`).
   - Kiểm tra log chạy Playwright E2E thực tế của D10-C (`d10c-browser-evidence.json`).
3. **Bước 3: Xây dựng bộ test kiểm chứng độc lập của Sơn (Harness Construction)**
   - Viết file test `tests/unit/s11-cross-review-account.unit.test.ts` để kiểm chứng các điều kiện bất biến (invariants) AC-01..AC-06.
   - Chạy test kiểm thử qua Vitest.
4. **Bước 4: Tổng hợp phát hiện và biên bản bàn giao (Reporting)**
   - Soạn thảo `S11-CROSS-REVIEW-DUC.md` phân tích chuyên sâu các điểm đã làm tốt và các khuyến nghị vận hành.
   - Soạn thảo `S11-RESULT-2026-10-23.md` nghiệm thu và chốt trạng thái `DONE`.
   - Cập nhật `DELIVERY-TASKS.csv`.
