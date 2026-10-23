# S08 — Hub công cụ Offline (P15)

## 1. Giới thiệu tổng quan
Task **S08** thuộc phạm vi công việc của **Sơn** (phụ trách các trang quản trị giải đấu P01–P03, P14, P15).
Mục tiêu là xây dựng và hoàn thiện **Hub công cụ Offline (P15)** đầy đủ xác thực, backend capabilities và bốn lối vào mode routing thực, tuân thủ nghiêm ngặt chính sách bảo mật: toàn bộ tính toán Python chạy cục bộ trong Web Worker/Pyodide sandbox, tuyệt đối không tạo server Python runner hay thực thi subprocess không an toàn trên máy chủ.

## 2. Bốn lối vào công cụ Offline (P15)
1. **Kho Bot của tôi** (`/admin/offline/bots`):
   Quản lý mã nguồn Bot cá nhân thuộc tài khoản quản trị viên hiện tại. Cho phép tải lên file `.py`, preflight test, xem SHA-256 digest và revision history.
2. **Đấu Bot Offline (Bot – Bot)** (`/dau-chuong-trinh/offline`):
   Môi trường giả lập hai Bot đối kháng trực tiếp trong trình duyệt sử dụng Pyodide Web Worker an toàn.
3. **Phòng tập Người – Bot** (`/admin/offline/practice/human-bot`):
   Người chơi (Xanh) thi đấu trực tiếp với Bot Python (Đỏ) chạy cục bộ.
4. **Phòng tập Người – Người** (`/admin/offline/practice/human-human`):
   Chế độ chơi Pass & Play hai người trên cùng một thiết bị với bàn cờ Robot Lab.

## 3. Kiến trúc Backend & Security Invariants
- **Endpoint**: `GET /api/admin/offline/capabilities`
  - Trả về quyền `offline.hub.read`, `offline.bot.read`, `offline.practice.humanBot`, `offline.practice.humanHuman`.
  - Khai báo rõ ràng chính sách `NO_SERVER_RUNNER` và môi trường cô lập `BROWSER_WORKER_CPYTHON`.
- **Bảo mật mã nguồn**:
  - Mã nguồn Bot là riêng tư của từng tài khoản, chỉ lưu trong kho cá nhân qua `/api/bot-library`.
  - Không bao giờ để lộ source code, traceback hoặc memory qua audit log công khai hay room snapshot.
