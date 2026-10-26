# Biên bản kiểm thử tích hợp & hệ thống — Phân hệ Giải đấu (UI thật)

- **Người thực hiện:** Sơn (`son-tournament`) với ZCode
- **Ngày:** 2026-10-27
- **Môi trường:** PostgreSQL 17 disposable (`docker run postgres:17-alpine` tại `127.0.0.1:54339`, database `ottv2_uitest` — chỉ bind localhost, dữ liệu giả lập), Fastify server `:3001`, Vite dev `:3000`, trình duyệt thật (Chromium qua ZCode In-app Browser), 2 tài khoản: `uitest_admin` (SYSTEM_ADMIN) và `uitest_player` (USER).
- **Phạm vi:** tích hợp + hệ thống mức cơ bản cho phân hệ giải đấu. **Chưa bao gồm** kiểm thử chịu tải (k6) và thiết bị vật lý.
- **Kết quả tổng: 12/12 kịch bản PASS, 1 phát hiện lỗi nghiêm trọng đã vá trong đợt này.**

## Phát hiện quan trọng trong quá trình test

**Schema drift D06/D07/D08 (CAO):** `prisma/schema.prisma` chứa `User.role`, bảng `TournamentStaffInvitation`, `SupportRecoveryTicket`, `TournamentRulesAcknowledgement`, cột `invitationId`… nhưng **không có migration tương ứng**. Hệ quả: một database dựng từ `db:deploy` thuần sẽ thiếu toàn bộ nhóm bảng này; trước đây hydration lỗi bị nuốt (`console.warn`) nên server vẫn boot với store rỗng — đúng biến thể của BUG-06. **Fail-closed boot mới đã bắt được lỗi ngay lần chạy đầu.** Đã vá bằng migration `20261027000000_d06_d07_d08_missing_schema`. *Lưu ý vận hành Render: nếu DB production từng được tạo bằng `db push` thì không cần hành động; nếu được tạo bằng `migrate deploy` thì cần chạy `pnpm db:deploy` với `DATABASE_URL` của Render (cần phê duyệt riêng trước khi chạm DB dùng chung).*

## Ma trận kịch bản & kết quả

| # | Kịch bản | Kết quả | Bằng chứng chính |
|---|---|---|---|
| A1 | Admin đăng nhập → tự vào Console Quản trị, nav đủ 7 mục (kể cả Hỗ trợ) | **PASS** | URL `/admin/tournaments`, nav đầy đủ |
| A2 | Player truy cập thẳng `/admin/tournaments` | **PASS** | `admin-guard-forbidden` hiện, tên tài khoản + vai trò yêu cầu, **không** render vỏ console (nav count = 0) |
| A3 | Vô danh gọi `/diagnostics/metrics` và `/leaderboard` | **PASS** | HTTP 401 (trước đây 200 công khai) |
| A4 | Player có session tạo draft qua API / xem readiness | **PASS** | HTTP 403 `FORBIDDEN_ROLE` (không có TA binding) |
| B1 | Tạo đơn vị `KHOA_CNTT_UITEST` | **PASS** | Thông báo thành công, dòng xuất hiện trong bảng |
| B2 | Phát hành hợp đồng `HD_UITEST_2026` (quota 2, gán TA admin) | **PASS** | ACTIVE, "Đã giữ 0/2", TA binding ACTIVE, envelope hiển thị |
| C1 | Wizard 4 bước → Lưu nháp → Nộp duyệt | **PASS** | "Đã lưu máy chủ… r1" → `UNDER_REVIEW r2` (API thật, không còn giả lập) |
| D1 | Hàng phê duyệt → Phê duyệt | **PASS** | `APPROVED (v3)`, snapshot bất biến "Duyệt bởi", config v1 phát hành |
| E1 | Trang chi tiết + tabs + 7 liên kết phụ | **PASS** | Đủ Luật/Roster/Staff/Bot/Operations/Adjudications/Audit |
| E2 | Readiness trung thực | **PASS** | 4 PASS + 1 BLOCKED (`INSUFFICIENT_ELIGIBLE_PARTICIPANTS` 0/4); nút "Bắt đầu" disabled |
| F1 | **Restart server** → giải, hợp đồng (quota 1/2), audit (5 bản ghi) còn nguyên | **PASS** | Hydrate từ PostgreSQL; trước khi vá: 404 sau restart |
| F2 | Audit actor filter (sai → 0, đúng → 5) | **PASS** | Lọc 2 chiều qua API thật |

Kiểm tra bổ sung: trang Điều hành sự cố là trang thật (cổng RUNNING/PAUSED, không placeholder); trang Roster bị chặn đúng với player; filter "Người thực hiện" hoạt động end-to-end.

## Cách tái lập môi trường

```bash
docker run -d --name ottv2-ui-test-pg -e POSTGRES_USER=ottv2_uitest -e POSTGRES_PASSWORD=uitest_disposable \
  -e POSTGRES_DB=ottv2_uitest -p 127.0.0.1:54339:5432 postgres:17-alpine
DATABASE_URL='postgresql://ottv2_uitest:uitest_disposable@127.0.0.1:54339/ottv2_uitest' corepack pnpm db:deploy
DATABASE_URL='postgresql://ottv2_uitest:uitest_disposable@127.0.0.1:54339/ottv2_uitest' CORS_ORIGINS=http://localhost:3000 corepack pnpm --filter @ottv2/server dev
corepack pnpm --filter @ottv2/web dev   # mở http://localhost:3000
# nâng quyền admin sau khi đăng ký qua UI/API:
# docker exec ottv2-ui-test-pg psql -U ottv2_uitest -d ottv2_uitest -c "UPDATE \"User\" SET role='SYSTEM_ADMIN' WHERE username='...';"
```

Dọn dẹp: `docker rm -f ottv2-ui-test-pg` và dừng 2 tiến trình dev.

## Chưa kiểm thử (NOT RUN)

- Điểm danh/roster import CSV, start giải thật khi đủ điều kiện, phán quyết hòa P05 với trận đang chờ, dòng sự kiện SSE khi trận chạy.
- k6 / chịu tải (theo yêu cầu tạm gác), thiết bị vật lý (đã waived từ trước), smoke production trên URL Render.
