# Thiết Kế Kỹ Thuật Task S10: Browser E2E Test Suite và Kiến Trúc Tương Tác

## 1. Kiến trúc Suite Kiểm Thử E2E

### 1.1 Nguyên lý thiết kế
- **Môi trường thực thi:** Playwright điều khiển Chromium không đầu (`headless: true`), kết nối trực tiếp đến máy chủ phát triển Vite frontend (`http://127.0.0.1:4173`).
- **Phân tách trách nhiệm:** Kiểm thử hành vi người dùng cuối (End-to-End) thông qua tương tác DOM thực: nhấp chuột, nhập liệu, thay đổi kích thước viewport, kiểm tra URL điều hướng và trạng thái modal.
- **Tính độc lập & Determinism:** Dữ liệu phản hồi được chuẩn hóa theo đúng cấu trúc schema Zod của `@ottv2/contracts`, bảo đảm kiểm thử chạy nhất quán, không phụ thuộc vào trạng thái cơ sở dữ liệu bên ngoài.

```
       +---------------------------------------------+
       |           Playwright Test Runner            |
       +---------------------------------------------+
                              |
                     [Browser Chromium]
                              |
       +---------------------------------------------+
       |         Vite Dev Server (Port 4173)         |
       |             @ottv2/web App                  |
       +---------------------------------------------+
          /           |            |           \
     [P01 List]  [P02 Wizard] [P03 Detail] [P14 Audit] [P15 Offline]
```

### 1.2 Giả lập phiên Quản trị viên (Admin Session Setup)
Để mô phỏng chính xác vai trò Tournament Admin hợp lệ:
1. `prepareAdmin(page)` cài đặt script ngăn chặn kết nối SSE không mong muốn (`SilentEventSource`).
2. Định tuyến `**/auth/me` trả về đối tượng `UserProfile` đầy đủ quyền `TOURNAMENT_ADMIN`, kèm các capability cần thiết: `tournament.create`, `offline.hub.read`.
3. Định tuyến `**/health` trả về `protocolVersion: "0.1"` và tất cả components đều ở trạng thái `ok`, giúp `AdminLayout` nhận diện mạng ở chế độ `online` thay vì hiển thị cảnh báo ngắt kết nối.

## 2. Thiết kế chi tiết cho từng trang (P01, P02, P03, P14, P15)

### 2.1 P01: Danh sách giải đấu (TournamentListPage)
- **Kiểm tra Responsive:**
  - Viewports: Mobile (375x812), Tablet (768x1024), Desktop (1440x900).
  - Điều kiện: Không bị tràn ngang màn hình (`pageEl.scrollWidth <= pageEl.clientWidth`).
  - Tối ưu hóa: Khung lưới thẻ giải đấu sử dụng `repeat(auto-fill, minmax(min(100%, 280px), 1fr))` và thanh tìm kiếm có `minWidth: 0, flex: "1 1 200px"`, cho phép co giãn mượt mà ngay cả trên thiết bị di động có chiều rộng 375px.
- **Kiểm tra Khả năng tiếp cận (Accessibility):**
  - Quét với `@axe-core/playwright` áp dụng thẻ tiêu chuẩn `wcag2a` và `wcag2aa`.
  - Không có bất kỳ vi phạm nghiêm trọng nào (`critical` hoặc `serious`).

### 2.2 P02: Wizard tạo giải đấu nháp (TournamentWizardPage)
- **Quy trình 4 bước:**
  - Bước 1: Hồ sơ & Đơn vị (`wizard-name-input`, `wizard-slug-input`, `wizard-contract-input`).
  - Bước 2: Lịch trình & Múi giờ (`wizard-step-2-btn`).
  - Bước 3: Quy mô & Thể thức (`wizard-step-3-btn`).
  - Bước 4: Tổng quan & Luật (`wizard-step-4-btn`).
- **Tích hợp Rule Widget bản cuối:**
  - Chứa container `wizard-rule-section`.
  - Nút kiểm tra luật `wizard-rule-preview-btn` sẵn sàng hoạt động.
- **Modal nộp duyệt:**
  - Xác nhận nộp duyệt qua modal `wizard-submit-modal` và ghi chú thẩm định `wizard-submission-note-input`.

### 2.3 P03: Chi tiết giải đấu & Điều kiện sẵn sàng (TournamentDetailPage)
- **5 Liên kết điều hành phân hệ:**
  1. Điều lệ / Luật chơi: `action-rules-btn` -> `/admin/tournaments/:id/rules`
  2. Vận động viên: `action-roster-btn` -> `/admin/tournaments/:id/roster`
  3. Nhân sự / Trọng tài: `action-staff-btn` -> `/admin/tournaments/:id/staff`
  4. Trạng thái Bot: `action-bot-readiness-btn` -> `/admin/tournaments/:id/bot-readiness`
  5. Nhật ký kiểm toán: `action-audit-btn` -> `/admin/tournaments/:id/audit`
- **Tab Điều kiện sẵn sàng (Readiness):**
  - Chuyển tab qua `tab-readiness-btn`.
  - Hiển thị bảng điều kiện sẵn sàng `panel-readiness` và nhãn trạng thái tổng thể `readiness-overall-status`.
- **Tab Cấu hình:**
  - Chuyển tab qua `tab-config-btn`, kiểm tra container cấu hình `panel-config`.

### 2.4 P14: Nhật ký kiểm toán (AuditLogsViewerPage)
- **Hai phạm vi xem:**
  - Toàn cục hệ thống: `/admin/audit` hiển thị tiêu đề `audit-page-title`.
  - Riêng theo giải đấu: `/admin/tournaments/:id/audit` lọc sẵn phạm vi giải đấu tương ứng.
- **Bộ lọc đối tượng:**
  - Dropdown `filter-target-type-select` hỗ trợ chọn các loại mục tiêu: TOURNAMENT, RULE_VERSION, CONTRACT, ROSTER, v.v.
- **Bảo vệ an toàn thông tin:**
  - Xác thực trang tuyệt đối không chứa các trường dữ liệu nhạy cảm thô như `passwordHash`, `privateKey`, `sessionToken`.

### 2.5 P15: Hub công cụ Offline & Kho Bot (OfflineHubPage & OfflineBotsPage)
- **4 Lối vào chế độ thi đấu Offline:**
  1. Kho Bot của tôi -> `/admin/offline/bots`
  2. Đấu Bot Offline (Bot – Bot) -> `/admin/offline/bot-vs-bot`
  3. Phòng tập Người – Bot -> `/admin/offline/practice-human-bot`
  4. Phòng tập Người – Người -> `/admin/offline/practice-human-human`
- **Mô hình an toàn Sandbox:**
  - Banner công bố nguyên tắc cô lập: Mọi tác vụ Python/tính toán chạy hoàn toàn trong trình duyệt hoặc Web Worker riêng biệt, không chạy mã trên server.
- **Bảo mật Kho Bot:**
  - Danh sách bot chỉ hiển thị metadata và băm định danh nguồn `sourceDigest`, không để lộ mã nguồn gốc (`def __init__`, `exec(`).
