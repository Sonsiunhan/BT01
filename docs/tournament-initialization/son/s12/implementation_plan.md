# Kế Hoạch Thực Thi Task S12

## Các bước triển khai
1. **Kiểm tra ranh giới bảo mật URL và Guards:**
   - Soát xét `AdminCapabilityGuard.tsx`, `AdminLayout.tsx`, `router.tsx`.
   - Xác minh luồng tạo URL chuyển tiếp `loginReturnPath` an toàn khi truy cập trái phép.
2. **Kiểm tra cơ chế chặn Admin tham gia Online:**
   - Xác minh máy chủ trả về `ADMIN_CANNOT_PLAY_ONLINE`.
   - Đảm bảo Admin Shell không chứa các CTA mời Admin vào sảnh thi đấu Online.
3. **Kiểm tra tính bền vững của Form Nháp:**
   - Xác minh `TournamentWizardPage.tsx` không reset state khi gặp lỗi server hoặc lỗi kết nối.
4. **Xây dựng bộ test kiểm chứng tự động:**
   - Viết `tests/unit/s12-role-url-errors.unit.test.ts` kiểm thử toàn bộ các tiêu chí AC-01..AC-05.
5. **Tổng kết nghiệm thu:**
   - Lập `S12-RESULT-2026-10-23.md`.
   - Cập nhật `DELIVERY-TASKS.csv`.
