# S03 — Implementation Plan: Wizard nháp cơ bản FE/BE (P02)

**Owner:** Sơn  
**Task:** S03  
**Trang:** P02 — Khởi tạo / Sửa nháp giải đấu  
**Dependencies:** S02, L02; G0 PASS  
**Status:** IN_PROGRESS  

---

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu
Xây dựng trang Wizard P02 cho phép Tournament Admin (TA) và System Admin (SA) khởi tạo và chỉnh sửa bản nháp giải đấu với:
1. Giao diện Wizard từng bước trực quan, tuân thủ Robot Lab design system.
2. Form nhập liệu đầy đủ các nhóm trường cơ bản theo đặc tả BA/SA v1.0 I3:
   - Hồ sơ & Đơn vị (F01–F07): name, slug, description, contractId, organizerUnitId, visibility.
   - Lịch trình (F15–F18): timezone, rosterOpenAt, rosterCloseAt, startAt, endAt, timeModel.
   - Quy mô & Thể thức (F08–F11): competitionMode, pairingStrategy (ARENA), min/maxParticipants, checkinRequired.
3. Cơ chế lưu trữ nháp an toàn (Draft Persistence & Resilience):
   - Tự động lưu nháp (Auto-save) và lưu thủ công.
   - Lưu trữ dự phòng cục bộ (`localStorage`) khi gặp lỗi mạng/mất kết nối, chống mất dữ liệu của người dùng.
   - Xử lý xung đột phiên bản (Optimistic Concurrency Control): gửi `expectedRevision` khi cập nhật (`PATCH`), bắt HTTP 409 `CONFLICT` và hiển thị cảnh báo với lựa chọn tải lại hoặc giữ bản sửa.
4. Tích hợp API chuẩn với backend Fastify:
   - `POST /api/tournaments/drafts`
   - `GET /api/tournaments/:tournamentId`
   - `PATCH /api/tournaments/:tournamentId`
   - `DELETE /api/tournaments/:tournamentId`

### 1.2 Out of scope (thuộc các task sau)
- Nhóm form rule builder chi tiết (bàn cờ, quân, di chuyển, goal): thuộc N02/N05 và S07.
- Các nhóm form mở rộng chi tiết (clock, scoring, privacy, regulations): thuộc S04.
- Nộp duyệt (`POST /submit`), duyệt giải (`P08`): thuộc S07 và L05.
- Vận hành, ghép cặp runtime: thuộc giai đoạn sau.

---

## 2. File Ownership

| File | Phân loại | Mô tả |
|---|---|---|
| `docs/tournament-initialization/son/s03/*` | Docs | Kế hoạch, thiết kế, acceptance và kết quả S03 |
| `apps/web/src/features/admin/tournaments/TournamentWizardPage.tsx` | UI | Wizard đa bước khởi tạo & sửa nháp P02 |
| `apps/web/src/features/admin/tournaments/tournamentApi.ts` | Client API | Mở rộng API client: createDraft, patchDraft, getDraft, deleteDraft, local buffer |
| `apps/web/src/features/admin/tournaments/tournamentTypes.ts` | Types | Bổ sung draft types/state |
| `apps/web/src/app/router.tsx` | Router | Mount `TournamentWizardPage` vào `/admin/tournaments/new` và `/admin/tournaments/:id` |
| `apps/server/src/app.ts` | Server | Mount `registerTournamentInitializationRoutes` |
| `tests/unit/s03-tournament-wizard.unit.test.ts` | Test | Unit tests kiểm tra draft adapter, OCC conflict và validation |
| `apps/web/src/features/admin/tournaments/TournamentWizardPage.test.tsx` | Test | Component tests cho Wizard UI |

---

## 3. Kế hoạch triển khai (Harness → Dev → Test → Review)

1. **Harness First**: Thiết lập test kiểm tra các invariant của draft (tạo draft, cập nhật có revision, bắt lỗi 409 khi revision cũ, kiểm tra quota).
2. **API Client**: Cập nhật `tournamentApi.ts` với các phương thức draft và local buffer persistence.
3. **Wizard UI**: Xây dựng component `TournamentWizardPage.tsx` với các bước nhập liệu, auto-save, banner xung đột phiên bản.
4. **Router & Navigation**: Đăng ký component vào router, nối nút tạo mới từ `TournamentListPage`.
5. **Kiểm thử**: Chạy đầy đủ unit test, web component test, build typecheck và test suite.
