# Thiết kế kỹ thuật S09: Hoàn thiện UI và Tích hợp Rule Widget Bản Cuối

## 1. Kiến trúc phân hệ và Luồng điều hướng

### 1.1. Sơ đồ liên kết từ Chi tiết giải đấu (P03)
```
                      +----------------------------------+
                      |      /admin/tournaments/:id      |
                      |   (TournamentDetailPage - P03)  |
                      +-----------------+----------------+
                                        |
      +------------------+--------------+---------------+------------------+
      |                  |              |               |                  |
      v                  v              v               v                  v
+-----------+     +------------+  +-----------+  +--------------+   +---------------+
|   Luật    |     |   Roster   |  |  Referee  |  |  Trạng thái  |   |    Nhật ký    |
|  thi đấu  |     |  Vận động  |  |  Nhân sự  |  |     Bot      |   |   kiểm toán   |
|   (P04)   |     |    viên    |  |   (P11)   |  |    (P16)     |   |     (P14)     |
+-----------+     +------------+  +-----------+  +--------------+   +---------------+
      |
      v
+-------------------------------+
|     TournamentWizardPage      |
|        initialStep={4}        |
|  TournamentRuleManagementPanel|
+-------------------------------+
```

---

## 2. Tích hợp Rule Widget bản cuối (P04 & P02)

### 2.1. Đảm bảo Single Source of Truth cho RuleProfile
- Giao diện `TournamentRuleManagementPanel` đóng vai trò là container tích hợp cho `RuleEditor`.
- Mọi thay đổi cấu hình trên `RuleEditor` sẽ lập tức vô hiệu hóa preview cũ, yêu cầu gọi `previewApi.preview()` để nhận được chứng chỉ `valid: true`.
- Khi người dùng công bố phiên bản (`publish`), hệ thống yêu cầu:
  - `profileDigest` (SHA-256 mã băm 64 ký tự).
  - `expectedConfigRevision`: Tránh ghi đè song song.
  - `effectiveAt` & `reason`: Lý do và thời điểm áp dụng luật thi đấu.

### 2.2. Nhất quán giữa P02 (Wizard nháp) và P04 (Trang luật riêng)
- `TournamentRulesPage.tsx` tận dụng khả năng khởi tạo tại bước 4 của `TournamentWizardPage` (`initialStep={4}`).
- Người dùng chỉnh sửa luật tại P04 được hưởng toàn bộ tính năng: preview bàn cờ trực quan, kiểm tra reachability của quân cờ, xem diff lịch sử các phiên bản cũ.

---

## 3. Hoàn thiện Trải nghiệm người dùng (UX/A11y/Theme)

### 3.1. Truy cập bàn phím (Keyboard Accessibility)
- Mọi nút bấm, tab, link và trường nhập liệu đều có `:focus-visible` với vòng viền nổi bật.
- Cập nhật trạng thái thông báo động qua `aria-live="polite"` (ví dụ: thông báo preview hợp lệ, thông báo lưu bản nháp).
- Tab navigation có đầy đủ các thuộc tính chuẩn: `role="tab"`, `aria-selected`, `aria-controls`.

### 3.2. Hệ thống Theme Tokens Robot Lab
- Sử dụng triệt để biến CSS:
  - Nền: `var(--surface)`, `var(--surface-subtle)`
  - Văn bản: `var(--text)`, `var(--text-muted)`
  - Đường viền: `var(--border)`
  - Màu nhấn Robot Lab: `var(--system-cyan)`, `var(--primary)`, `var(--system-green)`, `var(--system-red)`
  - Bóng đổ: `var(--elevation-card)`
- Đảm bảo độ tương phản cao, chuyển đổi liền mạch giữa Dark mode và Light mode.

### 3.3. Ranh giới bảo mật & Phân quyền
- Tuyệt đối ngăn chặn nút "Vào hàng đợi" hoặc "Chơi online" của người chơi thông thường xuất hiện trong Admin console shell.
- Khi người dùng không đủ quyền quản trị (`ADMIN_VIEW` / `ADMIN_MANAGE`), hệ thống hiển thị màn hình từ chối quyền trang nhã, không để lộ dữ liệu bí mật.
