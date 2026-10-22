# S01 — Tiêu chí nghiệm thu (Acceptance Criteria)

| Mã AC | Tiêu chí | Bằng chứng kiểm chứng | Trạng thái |
|---|---|---|---|
| **AC-S01-01** | Đăng ký đầy đủ 11 canonical admin routes vào `apps/web/src/app/routes.ts` | Unit test kiểm tra sự hiện diện của route constants | PENDING |
| **AC-S01-02** | `AppRouter` đăng ký `AdminLayout` và các sub-routes với `React.lazy` | Source inspection & Route match tests | PENDING |
| **AC-S01-03** | `AdminLayout` hiển thị nhận diện Robot Lab, header, điều hướng 2 nhóm và thông tin user | Component test & Render inspection | PENDING |
| **AC-S01-04** | Tuyệt đối **không có nút/CTA chơi Online** hay hàng đợi ghép trận trực tiếp trong Admin Shell | DOM assertions kiểm tra không có CTA chơi online | PENDING |
| **AC-S01-05** | Route Guard (`AdminCapabilityGuard`) chặn truy cập khi thiếu quyền và hiển thị 403 Forbidden | Test truy cập không đủ quyền và kiểm tra 403 screen | PENDING |
| **AC-S01-06** | Các route con chưa hoàn thiện hiển thị `AdminRoutePending` an toàn, không 404/crash | Test render sub-routes | PENDING |
| **AC-S01-07** | Không làm ảnh hưởng hoặc phá vỡ các route hiện có của game client | Chạy toàn bộ test suite cũ (`tests/unit/*`, `w12-route-smoke`) | PENDING |
| **AC-S01-08** | Tuân thủ quyền sở hữu file (chỉ sửa các file thuộc phạm vi của Sơn) | Git diff verification | PENDING |
