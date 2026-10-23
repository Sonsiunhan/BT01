# Tiêu Chí Nghiệm Thu Task S10 (AC-01..AC-05)

## Bảng Ma Trận Nghiệm Thu

| Tiêu chí | Mô tả yêu cầu | Phương thức kiểm chứng | Kết quả |
| :--- | :--- | :--- | :--- |
| **AC-01** | P01 (Danh sách giải đấu) render chuẩn trên cả 3 kích thước viewport (375x812, 768x1024, 1440x900), không có thanh cuộn ngang tràn màn hình (`scrollWidth <= clientWidth`), vượt qua kiểm toán tiếp cận Axe WCAG 2.0/2.1 AA không có lỗi critical/serious. | Playwright E2E Test 1 & Vitest AC-01 | **PASS** |
| **AC-02** | P02 (Wizard tạo giải đấu) dẫn dắt hoàn chỉnh 4 bước cấu hình nháp, tích hợp Rule Widget bản cuối tại Bước 4 (với nút kiểm tra luật), đồng bộ slug/tên giải và kích hoạt modal nộp duyệt giải đấu thành công. | Playwright E2E Test 2 & Vitest AC-02 | **PASS** |
| **AC-03** | P03 (Chi tiết giải đấu) hiển thị đầy đủ 5 liên kết điều hành phân hệ (Rules, Roster, Staff, Bot Readiness, Audit) đúng đường dẫn, chuyển đổi tab Sẵn sàng (Readiness) và Cấu hình (Config) phản hồi tức thì với dữ liệu đối soát. | Playwright E2E Test 3 & Vitest AC-03 | **PASS** |
| **AC-04** | P14 (Nhật ký kiểm toán) hỗ trợ cả 2 chế độ hiển thị: Toàn cục hệ thống (`/admin/audit`) và Theo từng giải đấu (`/admin/tournaments/:id/audit`), có bộ lọc đối tượng, và tuyệt đối không rò rỉ khóa bí mật (`passwordHash`, `privateKey`, `sessionToken`). | Playwright E2E Test 4 & Vitest AC-04 | **PASS** |
| **AC-05** | P15 (Hub công cụ Offline & Kho Bot) hiển thị đủ 4 lối vào, banner công bố chính sách bảo mật Sandbox Web Worker trình duyệt, và trang Kho Bot quản lý bot an toàn mà không tải mã nguồn thô lên giao diện chung. | Playwright E2E Test 5 & Vitest AC-05 | **PASS** |

---

## Chi tiết từng tiêu chí

### AC-01: P01 Danh sách giải đấu & Khả năng tiếp cận
- **Đầu vào:** URL `/admin/tournaments`, người dùng có vai trò `TOURNAMENT_ADMIN`.
- **Kỳ vọng:**
  - Tiêu đề `Quản lý giải đấu` xuất hiện.
  - Thanh tìm kiếm và bộ lọc trạng thái (Tabs) hiển thị và tương tác được.
  - Thử nghiệm trên 3 viewports:
    - Mobile (375 x 812): `scrollWidth <= clientWidth` đạt `true`.
    - Tablet (768 x 1024): `scrollWidth <= clientWidth` đạt `true`.
    - Desktop (1440 x 900): `scrollWidth <= clientWidth` đạt `true`.
  - Quét với AxeBuilder: `violations.filter(v => v.impact === 'critical' || v.impact === 'serious')` trả về mảng rỗng `[]`.

### AC-02: P02 Quy trình Wizard tạo giải nháp & Nộp duyệt
- **Đầu vào:** URL `/admin/tournaments/new`.
- **Kỳ vọng:**
  - Nhập tên giải `wizard-name-input` và slug `wizard-slug-input`.
  - Điều hướng thành công qua Bước 2 (`wizard-step-2-btn`), Bước 3 (`wizard-step-3-btn`) và Bước 4 (`wizard-step-4-btn`).
  - Tại Bước 4, container `wizard-rule-section` và nút `wizard-rule-preview-btn` sẵn sàng.
  - Thông tin slug giải đấu hiển thị chính xác trong phần tóm tắt hồ sơ.

### AC-03: P03 Chi tiết giải đấu, 5 Phân hệ & Điều kiện sẵn sàng
- **Đầu vào:** URL `/admin/tournaments/tour-001`.
- **Kỳ vọng:**
  - Trang chi tiết `tournament-detail-page` hiển thị thông tin giải đấu hợp lệ.
  - 5 nút phân hệ có thuộc tính `href` chính xác:
    - `/admin/tournaments/tour-001/rules`
    - `/admin/tournaments/tour-001/roster`
    - `/admin/tournaments/tour-001/staff`
    - `/admin/tournaments/tour-001/bot-readiness`
    - `/admin/tournaments/tour-001/audit`
  - Nhấp `tab-readiness-btn` chuyển sang `panel-readiness` hiển thị trạng thái tổng quan `readiness-overall-status`.
  - Nhấp `tab-config-btn` chuyển sang `panel-config`.

### AC-04: P14 Nhật ký kiểm toán & Bảo vệ bí mật
- **Đầu vào:** URL `/admin/audit` và `/admin/tournaments/tour-001/audit`.
- **Kỳ vọng:**
  - Trang toàn cục hiển thị `audit-page-title` và bộ lọc `filter-target-type-select`.
  - Trang giải đấu hiển thị mã giải `tour-001`.
  - Quét văn bản toàn trang không chứa `passwordHash`, `privateKey`, hay `sessionToken`.

### AC-05: P15 Hub công cụ Offline & Bảo mật Kho Bot
- **Đầu vào:** URL `/admin/offline` và `/admin/offline/bots`.
- **Kỳ vọng:**
  - Tiêu đề `Trung tâm công cụ Offline` hiển thị đầy đủ 4 thẻ:
    - "Kho Bot của tôi"
    - "Đấu Bot Offline (Bot – Bot)"
    - "Phòng tập Người – Bot"
    - "Phòng tập Người – Người"
  - Khung an toàn Runtime Sandbox nêu rõ tính toán chạy cô lập trong trình duyệt.
  - Trang Kho Bot quản lý bot an toàn, không chứa mã độc hoặc mã nguồn thực thi thô.
