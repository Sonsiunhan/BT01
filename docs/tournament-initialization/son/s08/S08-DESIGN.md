# S08 — Thiết kế kỹ thuật: Hub công cụ Offline (P15)

## 1. Thiết kế Giao diện (Frontend)
- Vị trí: `apps/web/src/features/admin/offline/`
- Các trang thành phần:
  1. `OfflineHubPage.tsx`: Trang chủ P15 `/admin/offline`.
  2. `OfflineBotsPage.tsx`: Trang quản lý kho Bot cá nhân `/admin/offline/bots`.
  3. `OfflinePracticeHumanBotPage.tsx`: Phòng luyện tập Người vs Bot `/admin/offline/practice/human-bot`.
  4. `OfflinePracticeHumanHumanPage.tsx`: Phòng luyện tập Người vs Người `/admin/offline/practice/human-human`.
- Tách chunk: Các trang thuộc nhóm `admin-pages` để đảm bảo bundle size tối ưu và không ảnh hưởng đến initial load.

## 2. API Backend & Quyền hạn
- `GET /api/admin/offline/capabilities`:
  - Trả về danh sách capabilities: `offline.hub.read`, `offline.bot.read`, `offline.practice.humanBot`, `offline.practice.humanHuman`.
  - Khai báo runtime status `READY` và isolation `BROWSER_WORKER_CPYTHON`.
  - Actor role requirement: `ADMIN` hoặc `TOURNAMENT_ADMIN`.

## 3. Quản lý tính cô lập & Bảo mật
- **Không thực thi Python trên máy chủ**: Gameplay offline sử dụng Pyodide Web Worker trên trình duyệt (`runOfflineBotTurn`).
- **Kho Bot riêng tư**: Khai thác endpoint `/api/bot-library`, đảm bảo mỗi tài khoản chỉ thấy bot của chính mình, bảo vệ mã nguồn tuyệt đối.
- **Tiêu chuẩn Robot Lab**: Giao diện bàn cờ, quân cờ tuân thủ đúng thiết kế Robot Lab đã được duyệt.
