# S01 — Thiết kế kiến trúc Admin Shell và Router

## 1. Cấu trúc Routing (`apps/web/src/app/routes.ts`)

Mở rộng `routes` với tiền tố `/admin` chuẩn hóa theo inventory của S00:

```typescript
export const routes = {
  // ... các route cũ giữ nguyên ...

  // Admin Routes (P01 – P18)
  adminTournaments: "/admin/tournaments",                       // P01: Danh sách giải
  adminTournamentNew: "/admin/tournaments/new",                // P02: Tạo giải mới (draft)
  adminTournamentEdit: "/admin/tournaments/:tournamentId/edit",// P02: Chỉnh sửa nháp
  adminTournamentDetail: "/admin/tournaments/:tournamentId",   // P03: Chi tiết & Match-center
  adminTournamentOperations: "/admin/tournaments/:tournamentId/operations", // P03: Điều hành
  adminAudit: "/admin/audit",                                  // P14: Nhật ký kiểm toán hệ thống
  adminTournamentAudit: "/admin/tournaments/:tournamentId/audit", // P14: Nhật ký kiểm toán theo giải
  adminOffline: "/admin/offline",                              // P15: Hub công cụ Offline
  adminOfflineBots: "/admin/offline/bots",                     // P15: Kho Bot
  adminOfflinePracticeHumanBot: "/admin/offline/practice/human-bot", // P15: Người - Bot Offline
  adminOfflinePracticeHumanHuman: "/admin/offline/practice/human-human", // P15: Người - Người Offline
} as const;
```

---

## 2. Luồng bảo vệ quyền (`AdminCapabilityGuard`)

Admin Shell không kiểm tra role thô từ client mà hoạt động dựa trên tập hợp **capabilities** do server cấp (hoặc suy ra an toàn từ context đăng nhập):
- Quyền quản trị giải đấu: `tournament.list`, `tournament.create`, `tournament.manage`.
- Quyền nhật ký: `audit.read`.
- Quyền công cụ offline: `offline.hub.read`, `offline.practice.humanBot`, `offline.practice.humanHuman`.

```text
[Người dùng truy cập route Admin]
              │
              ▼
   [Đã đăng nhập hay chưa?]
      ├── Chưa: Điều hướng sang trang Đăng nhập (/dang-nhap) kèm returnUrl
      └── Rồi: Kiểm tra capabilities
              │
              ├── Đủ capability: Render Component trang
              └── Thiếu capability: Render Màn hình 403 Forbidden
```

---

## 3. Khung giao diện Admin Shell (`AdminLayout`)

Bố cục chuẩn Robot Lab bao gồm:
1. **Header Admin ngang:**
   - Wordmark OTT v2 có nhãn định danh "Console Quản trị".
   - Bộ chọn giao diện (ThemeSwitcher: Dark / Light).
   - Menu hồ sơ cá nhân và nút Đăng xuất.
2. **Thanh điều hướng hai nhóm (Sidebar / Navigation Bar):**
   - **Nhóm 1: Quản lí giải đấu:**
     - Danh sách giải đấu (`/admin/tournaments`)
     - Nhật ký kiểm toán (`/admin/audit`)
   - **Nhóm 2: Công cụ Offline:**
     - Trung tâm công cụ Offline (`/admin/offline`)
     - Kho Bot của tôi (`/admin/offline/bots`)
     - Phòng tập Người – Bot (`/admin/offline/practice/human-bot`)
     - Phòng tập Người – Người (`/admin/offline/practice/human-human`)
3. **Khu vực hiển thị nội dung chính (`<Outlet />`):**
   - Hỗ trợ lazy loading thông qua `React.Suspense` với loading indicator đồng bộ.
4. **Trạng thái kết nối mạng (`network-banner`):**
   - Hiển thị banner cảnh báo khi mất kết nối mạng hoặc dịch vụ suy giảm.

---

## 4. Xử lý Route đang chờ (`AdminRoutePending`)

Để các trang con không bị lỗi 404 trong lúc các task `S02`, `S03`, `S08`... đang được triển khai tuần tự theo kế hoạch:
- Component `AdminRoutePending` sẽ được mount tại các route tương ứng.
- Hiển thị thông báo chi tiết:
  - Tên phân hệ (ví dụ: *P01 — Danh sách giải đấu*, *P02 — Khởi tạo giải đấu*).
  - Trạng thái: "Đang được hoàn thiện theo kế hoạch giao việc (Task S02 / S03 / S08)".
  - Đường quay lại trang tổng quan Admin an toàn.
