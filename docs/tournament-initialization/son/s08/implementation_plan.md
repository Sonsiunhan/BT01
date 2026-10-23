# S08 — Implementation Plan: Hub công cụ Offline (P15)

## 1. Mục tiêu
Triển khai Hub công cụ Offline (P15) đáp ứng các yêu cầu:
- Đủ auth và capabilities API.
- Bốn lối vào mode routing thực.
- Gameplay chạy cục bộ an toàn, không tạo runner máy chủ.

## 2. Kế hoạch thực hiện
- [x] Tạo backend endpoint `/api/admin/offline/capabilities`.
- [x] Xây dựng test harness `tests/unit/s08-offline-hub.unit.test.ts`.
- [x] Xây dựng các trang giao diện trong `apps/web/src/features/admin/offline/`.
- [x] Đăng ký router chính thức thay thế `AdminRoutePending`.
- [x] Xây dựng bộ test frontend `OfflinePages.test.tsx`.
- [x] Kiểm tra các release gates: typecheck, lint, test, bundle size.
