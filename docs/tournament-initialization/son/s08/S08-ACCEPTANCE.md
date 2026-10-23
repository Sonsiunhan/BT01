# S08 — Acceptance Criteria: Hub công cụ Offline (P15)

Bộ tiêu chí nghiệm thu cho task S08:

| Mã AC | Tiêu chí nghiệm thu | Bằng chứng kiểm thử |
|---|---|---|
| **AC-01** | Backend cung cấp endpoint `GET /api/admin/offline/capabilities` yêu cầu quyền `ADMIN` hoặc `TOURNAMENT_ADMIN`, trả về 4 capabilities offline và 4 mode entries. | `tests/unit/s08-offline-hub.unit.test.ts` |
| **AC-02** | Không tạo bất kỳ native subprocess hoặc server Python runner nào trên backend phục vụ gameplay offline (chính sách `NO_SERVER_RUNNER`). | `tests/unit/s08-offline-hub.unit.test.ts` |
| **AC-03** | Router đăng ký đầy đủ 4 route offline thay cho trạng thái chờ `AdminRoutePending`: `/admin/offline`, `/admin/offline/bots`, `/admin/offline/practice/human-bot`, `/admin/offline/practice/human-human`. Hỗ trợ redirect `/admin/offline-hub` và `/admin/offline-tools`. | `apps/web/src/features/admin/offline/OfflinePages.test.tsx` |
| **AC-04** | Trang Hub Offline (`OfflineHubPage`) hiển thị đầy đủ 4 thẻ lối vào, trạng thái môi trường cô lập, và xử lý chặn quyền truy cập khi thiếu `offline.hub.read`. | `apps/web/src/features/admin/offline/OfflinePages.test.tsx` |
| **AC-05** | Trang Kho Bot cá nhân (`OfflineBotsPage`) tích hợp tải file Python, kiểm tra an toàn preflight, hiển thị SHA-256 digest và nút chuyển tiếp sang đấu Bot Offline. | `apps/web/src/features/admin/offline/OfflinePages.test.tsx` |
| **AC-06** | Các trang phòng tập (`OfflinePracticeHumanBotPage`, `OfflinePracticeHumanHumanPage`) hiển thị bàn cờ Robot Lab, đi nước đi hợp lệ theo luật cờ canonical `@ottv2/game-rules`, chạy hoàn toàn offline. | `apps/web/src/features/admin/offline/OfflinePages.test.tsx` |
