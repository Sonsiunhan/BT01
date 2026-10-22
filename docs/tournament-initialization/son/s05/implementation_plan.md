# S05 — Implementation Plan: Trang chi tiết giải đấu và Panel Readiness (P03)

**Owner:** Sơn  
**Task:** S05  
**Trang:** P03 — Chi tiết giải đấu, Cấu hình, và Panel Readiness (`/admin/tournaments/:tournamentId`)  
**Dependencies:** S04, L03; G0 PASS  
**Status:** IN_PROGRESS  

---

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu
Xây dựng trang chi tiết giải đấu `TournamentDetailPage.tsx` (P03) và panel sẵn sàng (Readiness Panel) kết nối trực tiếp với API backend:
1. **Thông tin tổng quan & Metadata giải đấu (Overview Tab):**
   - Header hiển thị Tên giải, Mã slug, Huy hiệu trạng thái vòng đời chuẩn (`TournamentStatus`), Múi giờ, Lịch trình bắt đầu/kết thúc.
   - Thao tác nhanh (Quick Actions) theo quyền: "Chỉnh sửa bản nháp" (nếu DRAFT/CHANGES_REQUESTED), "Mở lịch trình" (nếu APPROVED), "Bắt đầu giải" (nếu READY/canStartRunning), "Tạm dừng" / "Tiếp tục" (nếu RUNNING/PAUSED).
2. **Cấu hình & Thể thức (Config Tab):**
   - Hiển thị đầy đủ các thông số cốt lõi từ `TournamentCoreConfig`: Đơn vị tổ chức, Hợp đồng, Thể thức (ARENA), Quy mô thí sinh (Min/Max), Cửa sổ điểm danh, Hạn nộp Bot, Kiểm soát vận hành (Max matches, Pair meetings, Cooldown), Quyền riêng tư & Khán giả, Tính điểm Elo/Score.
3. **Panel điều kiện sẵn sàng (Authoritative Readiness Panel - T025/T026):**
   - Gọi API `/api/tournaments/:tournamentId/readiness` (trả về `TournamentReadinessSnapshot`).
   - Hiển thị danh sách checklist kiểm tra tự động:
     - Phê duyệt cấp hệ thống (`APPROVAL_STATUS`).
     - Phiên bản cấu hình & luật thi đấu (`RULE_VERSION_PUBLISHED`).
     - Số lượng thí sinh đủ điều kiện tối thiểu (`MIN_ELIGIBLE_PARTICIPANTS`).
     - Phán quyết thủ công tồn đọng (`NO_PENDING_ADJUDICATION`).
   - Hiển thị danh sách cảnh báo hoặc lý do chặn (Blockers) nếu chưa đủ điều kiện.
   - **Quy tắc bất biến:** Không bao giờ hiển thị trạng thái `READY` giả khi runtime/enrollment đang thiếu hoặc pending.
4. **Hỗ trợ thao tác vòng đời thực thi (Lifecycle Action Controls):**
   - Nút `openScheduled`: Gọi `POST /api/tournaments/:tournamentId/open-scheduled`.
   - Nút `startRunning`: Gọi `POST /api/tournaments/:tournamentId/start` (chỉ active khi `canStartRunning = true`).
   - Nút `pauseTournament` & `resumeTournament`: Gọi `POST /api/tournaments/:tournamentId/pause` và `resume`.
5. **Đăng ký Router chính thức:**
   - Thay thế `AdminRoutePending` tại `routes.adminTournamentDetail` bằng `TournamentDetailPage`.

### 1.2 Out of scope
- Match-center vận hành phân cặp theo thời gian thực (thuộc S08 / L07).
- Tab Rule Editor tích hợp tương tác bàn cờ (thuộc S07 / N05).
- Audit log viewer chuyên sâu (thuộc S06).

---

## 2. File Ownership

| File | Phân loại | Mô tả |
|---|---|---|
| `docs/tournament-initialization/son/s05/*` | Docs | Tài liệu README, DESIGN, ACCEPTANCE, RESULT, Implementation Plan của S05 |
| `apps/web/src/features/admin/tournaments/TournamentDetailPage.tsx` | UI | Trang chi tiết giải đấu và Panel Readiness P03 |
| `apps/web/src/features/admin/tournaments/tournamentApi.ts` | API Client | Bổ sung `getTournamentDetail`, `getTournamentReadiness`, `openScheduled`, `startTournament`, `pauseTournament`, `resumeTournament` |
| `apps/web/src/features/admin/tournaments/tournamentTypes.ts` | Types | Bổ sung các kiểu dữ liệu chi tiết P03 |
| `apps/web/src/app/router.tsx` | Router | Mount `TournamentDetailPage` vào `routes.adminTournamentDetail` |
| `tests/unit/s05-tournament-detail-readiness.unit.test.ts` | Test | Unit tests kiểm tra render, readiness evaluate, và lifecycle actions |

---

## 3. Kế hoạch triển khai (Harness → Dev → Test → Review)

1. **Harness First:**
   - Viết test unit `tests/unit/s05-tournament-detail-readiness.unit.test.ts` kiểm thử các yêu cầu AC-01 đến AC-05.
2. **Cập nhật Types & Client API:**
   - Bổ sung các method API vào `tournamentApi.ts` tương ứng với các route backend đã có trong `tournament-core.route.ts`.
3. **Phát triển UI Component:**
   - Tạo `TournamentDetailPage.tsx` với thiết kế Robot Lab (Header, Tabs Overview/Config/Readiness, Readiness Checklist Cards, Action Buttons).
4. **Tích hợp Router:**
   - Cập nhật `apps/web/src/app/router.tsx` để mount `TournamentDetailPage`.
5. **Kiểm thử & Đóng gói:**
   - Chạy TypeScript typecheck, unit tests và commit.
