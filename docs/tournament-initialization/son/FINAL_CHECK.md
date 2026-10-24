# Báo Cáo Tổng Kiểm Tra Toàn Bộ Dự Án & Phân Hệ Giải Đấu (FINAL_CHECK.md)

- **Người thực hiện:** Sơn (Frontend Lead / Admin Shell & Phân hệ Tournament) & Nhóm Kiểm Toán Độc Lập
- **Thời điểm kiểm tra:** 2026-10-24
- **Nhánh kiểm tra:** `main` (Commit: `1cf6088`)
- **Phạm vi kiểm tra:** Toàn bộ 4 phân hệ (`S00`–`S13`, `L00`–`L13`, `D00`–`D13`, `N00`–`N12`), cấu trúc Monorepo (`packages/contracts`, `packages/game-rules`, `packages/bot-sdk`, `apps/server`, `apps/web`), bộ kiểm thử tự động, tích hợp chéo giữa các thành viên, và rà soát giao diện UI/UX (Font, Layout, Theme).

---

## MỤC LỤC
1. [Trạng Thái Hoàn Thành & Đánh Giá Thực Tế 4 Phân Hệ (Đức, Nam, Sơn, Long)](#1-trạng-thái-hoàn-thành--đánh-giá-thực-tế-4-phân-hệ)
   - 1.1. [Phân hệ của Đức (Security, Account & Roster — `D00`–`D13`)](#11-phân-hệ-của-đức-security-account--roster--d00d13)
   - 1.2. [Phân hệ của Nam (Game Rules, Engine, Bot ABI & Adjudication — `N00`–`N12`)](#12-phân-hệ-của-nam-game-rules-engine-bot-abi--adjudication--n00n12)
   - 1.3. [Phân hệ của Sơn (Admin Shell, Console UI & Tournament Flow — `S00`–`S13`)](#13-phân-hệ-của-sơn-admin-shell-console-ui--tournament-flow--s00s13)
   - 1.4. [Phân hệ của Long (Foundation, Contracts, Core Lifecycle & Approvals — `L00`–`L13`)](#14-phân-hệ-của-long-foundation-contracts-core-lifecycle--approvals--l00l13)
2. [Các Xung Đột Kỹ Thuật Khi Tích Hợp (Conflicts)](#2-các-xung-đột-kỹ-thuật-khi-tích-hợp)
3. [Danh Mục Bug & Lỗi Tiềm Ẩn (Bugs & Defects Matrix)](#3-danh-mục-bug--lỗi-tiềm-ẩn)
4. [Các Điểm Chồng Lấp & Ranh Giới Bàn Giao Giữa Các Thành Viên](#4-các-điểm-chồng-lấp--ranh-giới-bàn-giao)
5. [Lỗi Giao Diện UI/UX: Font, Bố Cục & Theme Sáng/Tối](#5-lỗi-giao-diện-uiux-font-bố-cục--theme-sángtối)
6. [Kế Hoạch Khắc Phục Khuyến Nghị Trước Khi Release](#6-kế-hoạch-khắc-phục-khuyến-nghị)

---

## 1. TRẠNG THÁI HOÀN THÀNH & ĐÁNH GIÁ THỰC TẾ 4 PHÂN HỆ

Dự án gồm **55 tasks** được phân chia cho 4 kỹ sư chính theo mô hình cuốn chiếu (Cuốn chiếu V3):

| Thành viên / Phân hệ | Số lượng Task | Kết quả Test Suite | Đánh giá hoàn thành Plan | Trạng thái Backend & UI |
|---|:---:|:---:|:---:|---|
| **Đức (D)** — Security & Account | 14 (`D00`–`D13`) | **109/109 PASS** | **~95%** (Thiếu cron purge tự động DB) | 100% API & Trang thật, không thiếu backend |
| **Nam (N)** — Game Rules & Engine | 13 (`N00`–`N12`) | **125/125 PASS** | **~95%** (Trang P05 chưa cắm Web Router) | Engine, ABI, Rules panel hoàn thiện 100% |
| **Sơn (S)** — Frontend & Admin Shell | 14 (`S00`–`S13`) | **59/59 PASS** | **~90%** (P03 Operations cắm placeholder; hở Shell Guard) | Console shell, Wizard, List, Detail hoạt động tốt |
| **Long (L)** — Foundation & Core Lifecycle | 14 (`L00`–`L13`) | **72/72 PASS** | **~92%** (Store chạy RAM Map() cần auto-sync DB) | Schema, Migration, API Vòng đời, P06–P08 hoàn tất |
| **TỔNG CỘNG** | **55/55 Tasks** | **100% Tests PASS** | **~93% Production Ready** | Đã sẵn sàng phát hành sau khi vá 5 điểm hở tích hợp |

---

### 1.1. Phân hệ của Đức (Security, Account & Roster — `D00`–`D13`)

#### Bảng chi tiết 14 Task của Đức:
| Task | Tên Task | Trang | Trạng thái Code | Test Evidence | Đánh giá & Phát hiện |
|:---:|---|:---:|:---:|:---:|---|
| **D00** | Thiết kế account/roster/staff/support | P09–P18 | **DONE** | Wireframes, Actor Matrix | Bản đặc tả phân quyền và DTO chuẩn chỉ gửi Long. |
| **D01** | Auth/tenant guard contracts và tests | P09 | **DONE** | 6/6 PASS (`tenant-guard.unit.test.ts`) | Cấm tuyệt đối public register gán quyền ADMIN; phân lập tenant. |
| **D02** | Bootstrap/TA account FE+BE | P09 | **DONE** | 5/5 PASS (`ta.routes.ts`, `AdminTaPage.tsx`) | Tạo, gán, thu hồi TA; mật khẩu hash bcrypt, không log ra console. |
| **D03** | Roster + preview CSV/XLSX FE/BE | P10 | **DONE** | Unit & Component PASS | Parse file, preview lỗi theo dòng, bắt trùng MSSV/Email. |
| **D04** | Import commit worker & account reuse | P10 | **DONE** | DB test integration PASS | Tái sử dụng tài khoản cũ, cam kết không ghi đè mật khẩu của tài khoản đã kích hoạt. |
| **D05** | Activation và giao diện nhận tài khoản | P13 | **DONE** | 4/4 PASS (`AccountActivationPage.test.tsx`) | Token dùng 1 lần, người chơi tự đặt mật khẩu mới, TTL 24h. |
| **D06** | Nhân sự/Referee invite FE+BE | P11, P17 | **DONE** | Staff suites PASS | Mời trọng tài theo giải; trọng tài chấp thuận qua link P17 an toàn. |
| **D07** | Support queue và recovery SA FE+BE | P12, P13 | **DONE** | 6/6 PASS (`D07RecoveryPages.test.tsx`) | Anti-enumeration khi yêu cầu khôi phục; cấp mã reset 1 lần. |
| **D08** | Ack điều lệ & retention dữ liệu | P18 | **DONE** | DB ACK & fake-time PASS | Lưu vết đồng ý điều lệ; có `retention.policy.ts` và `retention.service.ts`. |
| **D09** | Import/security/privacy tests | P09–P18 | **DONE** | 19/19 PASS (`d09-import-security.unit.test.ts`) | Chống rò rỉ token, upload bounds, bảo vệ PII. |
| **D10** | E2E các trang Đức bằng account thật | P09–P18 | **DONE** | 3/3 PASS (`d10-b-lifecycle-race.unit.test.ts`) | Chạy luồng thật Bootstrap → TA → Import → Claim → Ref Accept. |
| **D11** | Review chéo trang quản trị của Sơn | P01–P16 | **DONE** | `D11-CONSOLIDATED-RESULT-2026-10-24.md` | Tìm ra 9 vấn đề thực tế (D11-F01 đến D11-F09) hỗ trợ Sơn. |
| **D12** | Rà audit/PII/token và matrix cuối | P09–P18 | **DONE** | `D12-FINAL-SECURITY-HANDOFF-2026-10-24.md` | Phát hiện 2 lỗ hổng lớn: IDOR Roster (F01) và TTL kích hoạt 7 ngày (F06). |
| **D13** | Sửa lỗi và nghiệm thu bàn giao | Toàn bộ | **DONE** | 109/109 Regression PASS; 6/6 Browser PASS | Vá triệt để F01 & F06; lập báo cáo `D13-CONSOLIDATED-RESULT-2026-10-24.md`. |

#### Đánh giá code Đức so với Plan ban đầu:
- **Ưu điểm xuất sắc:** Đức là thành viên kiểm thử và rà soát bảo mật chặt chẽ nhất nhóm. Không có "missing backend", 100% trang P09, P10, P11, P12, P13, P17, P18 đều có API thật và ghi nhận vào PostgreSQL.
- **Điểm chưa hoàn thành so với Plan (Gaps):**
  1. *Chưa có Cron Job định kỳ chạy dọn dẹp dữ liệu (Retention — D12-F03/F04):* Code mới chỉ dừng lại ở các hàm logic đánh giá điều kiện trong `retention.policy.ts`. Chưa triển khai tác vụ cron tự động dọn dẹp dữ liệu giải sau 90 ngày và audit log sau 365 ngày trên Database thật vì phụ thuộc vào Long (tránh xóa nhầm dữ liệu dùng chung).
  2. *Hợp đồng dùng chung (Contracts):* Đức trực tiếp hạ TTL từ 168h xuống 24h trong `packages/contracts/src/tournament-initialization.ts` nhưng chưa có văn bản ký duyệt chính thức từ Long (single writer).
  3. *Lỗi UI Guard trang P10 (D12-F02):* User thường gọi API bị 403 nhưng UI Shell của Sơn vẫn render.

---

### 1.2. Phân hệ của Nam (Game Rules, Engine, Bot ABI & Adjudication — `N00`–`N12`)

#### Bảng chi tiết 13 Task của Nam:
| Task | Tên Task | Trang / Module | Trạng thái Code | Test Evidence | Đánh giá & Phát hiện |
|:---:|---|:---:|:---:|:---:|---|
| **N00** | Chốt đặc tả, kiểm G0; thiết kế luật | P04, P05, P16 | **DONE** | Wireframes, DTO draft | Phủ 93/93 tiêu chí đặc tả, thiết kế DTO rule engine. |
| **N01** | Harness và engine bàn cờ / nước đi mới | `@ottv2/game-rules` | **DONE** | 85/85 PASS (`l01-harness.unit.test.ts`) | Hỗ trợ di chuyển `RAY`, `LEAP`, canonical setup A1/I9. |
| **N02** | API validate / preview cấu hình luật | P04, Fastify | **DONE** | 8/8 PASS (`tournament-rules-preview.unit.test.ts`) | Validate luật, preview tức thời trên API Fastify. |
| **N03** | Đích tĩnh / chu kỳ / seed và thứ tự sự kiện | `@ottv2/game-rules` | **DONE** | 21/21 PASS (`tournament-goals.unit.test.ts`) | Cơ chế tính điểm và mục tiêu theo Q17/Q18. |
| **N04** | Bộ so sánh chỉ số hòa & Version/Publish | `@ottv2/contracts`, BE | **DONE** | 20/20 PASS (`n04-comparator.unit.test.ts`) | Comparator chỉ số phụ hòa; publish phiên bản luật bất biến. |
| **N05** | Giao diện `RuleEditor` V1 | `RuleEditor.tsx` (P04) | **DONE** | 6/6 PASS (`RuleEditor.test.tsx`) | Component chỉnh sửa luật với schema an toàn. |
| **N06** | SDK / runtime adapter & biên lai Bot | `@ottv2/bot-sdk` | **DONE** | 4/4 PASS (`n06-bot-abi.unit.test.ts`) | ABI giao tiếp Bot chuẩn xác; parity Python tuple/dict. |
| **N07** | Hoàn thiện trang P04 & ghép Wizard P02 | P04, P02 | **DONE** | 22/22 PASS (`ruleVersionApi.test.ts`) | Ghép `RuleEditor` mượt mà vào bước 4 của Wizard tạo giải. |
| **N08** | Runtime proof và trạng thái Bot P16 | P16, Fastify | **DONE** | Contract & Cross-platform PASS | Trang `BotReadinessPage.tsx` kiểm tra Bot sẵn sàng trước trận. |
| **N09** | Giao diện & API phán quyết hòa P05 | P05 | **DONE** | 14/14 PASS (`ManualAdjudicationPage.test.tsx`) | Giao diện phán quyết hòa tuyệt đối cho trọng tài / TA. |
| **N10** | Kiểm thử hồi quy Engine / SDK / Settlement | Integration | **DONE** | 91/91 PASS (`n10-engine-settlement.integration.test.ts`) | Kiểm tra tính toán Elo, điểm số và thứ tự kết thúc trận. |
| **N11** | Rà soát chéo các trang của Long | P06, P07, P08 | **DONE** | 11/11 PASS (`n11-safe-admin-errors.unit.test.ts`) | Đóng 4 findings `N11-F01`..`F04`, vá an toàn xử lý lỗi. |
| **N12** | Nghiệm thu tổng thể & ký duyệt bàn giao | Toàn bộ | **DONE** | Báo cáo `N12-FINAL-RELEASE-REPORT-2026-10-24.md` | Hơn 125 tests tự động đạt 100% PASS. |

#### Đánh giá code Nam so với Plan ban đầu:
- **Ưu điểm xuất sắc:** Engine cờ Robot Lab, Bot ABI và hệ thống phiên bản luật được xây dựng cực kỳ chặt chẽ, tối ưu hiệu năng và 100% determinism.
- **Điểm chưa hoàn thành so với Plan (Gaps):**
  1. *LỖI QUAN TRỌNG: Trang Phán Quyết Hòa `ManualAdjudicationPage` (`P05`) CHƯA ĐƯỢC ĐĂNG KÝ VÀO WEB ROUTER:* Nam đã viết hoàn chỉnh component `ManualAdjudicationPage.tsx` và test passing, nhưng lại **quên khai báo route** trong `apps/web/src/app/routes.ts` và `apps/web/src/app/router.tsx`! Người dùng truy cập URL `/admin/tournaments/:id/adjudications` sẽ bị rơi vào trang 404 Not Found.
  2. *Lỗi vỡ giao diện ở Light Mode (`ManualAdjudicationPage.css`):* Nam sử dụng biến không tồn tại `var(--surface-sunken, #0b1220)` và `var(--border-subtle, #263247)`, khiến trang bị hiển thị thành các khối đen sì trên nền sáng.
  3. *Thiếu liên kết điều hướng:* Trang chi tiết giải đấu `P03` chưa có nút bấm nào dẫn sang trang phán quyết hòa `P05` của Nam.

---

### 1.3. Phân hệ của Sơn (Admin Shell, Console UI & Tournament Flow — `S00`–`S13`)

#### Bảng chi tiết 14 Task của Sơn:
| Task | Tên Task | Trang | Trạng thái Code | Test Evidence | Đánh giá & Phát hiện |
|:---:|---|:---:|:---:|:---:|---|
| **S00** | Thiết kế shell, chuẩn UI dùng chung | P01–P15 | **DONE** | Wireframes, Tokens, DTOs | Xây dựng Admin layout, bảng màu và bộ token Design System. |
| **S01** | Admin shell / router và auth-state | P01, P15 | **DONE** | 4/4 PASS (`s01-admin-shell.unit.test.ts`) | Khung Console quản trị, tách biệt luồng người chơi và quản lý. |
| **S02** | Danh sách giải + capabilities FE/BE | P01 | **DONE** | 6/6 PASS (`s02-tournament-list.unit.test.ts`) | Trang danh sách giải đấu P01, tìm kiếm, lọc theo trạng thái. |
| **S03** | Wizard nháp cơ bản FE/BE | P02 | **DONE** | 5/5 PASS (`s03-tournament-wizard.unit.test.ts`) | Luồng Wizard 4 bước khởi tạo giải đấu. |
| **S04** | Các nhóm form ngoài rule builder | P02 | **DONE** | 5/5 PASS (`s04-tournament-form-groups.unit.test.ts`) | Form quy mô giải, thời gian, cơ cấu tính điểm và chỉ số phụ. |
| **S05** | Trang chi tiết và panel readiness | P03 | **DONE** | 5/5 PASS (`s05-tournament-detail-readiness.unit.test.ts`) | Bảng điều khiển trung tâm giải đấu P03, kiểm tra đủ điều kiện mở/chạy. |
| **S06** | Audit viewer FE/BE và readiness core | P14, P03 | **DONE** | 5/5 PASS (`s06-audit-viewer-readiness.unit.test.ts`) | Trang xem nhật ký kiểm toán P14, bộ lọc sự kiện. |
| **S07** | Nối RuleEditor V1 vào wizard và submit | P02, P03 | **DONE** | 5/5 PASS (`s07-rule-editor-wizard.unit.test.ts`) | Nhúng component `RuleEditor` của Nam vào bước 4 Wizard tạo giải. |
| **S08** | Hub Offline đủ auth/backend | P15 | **DONE** | 4/4 PASS (`s08-offline-hub.unit.test.ts`) | Trung tâm thi đấu Offline P15 với 4 lối vào luyện tập. |
| **S09** | Hoàn thiện UI responsive, a11y | Toàn bộ | **DONE** | 5/5 PASS (`s09-ui-polish.unit.test.ts`) | Đảm bảo responsive tablet/desktop, gán nhãn a11y. |
| **S10** | Browser E2E đầy đủ các trang Sơn | P01–P15 | **DONE** | 5/5 PASS Playwright E2E | Chạy luồng trình duyệt Chromium thật toàn trình ~5.3s. |
| **S11** | Review chéo trang tài khoản của Đức | P09–P18 | **DONE** | 6/6 PASS (`S11-CROSS-REVIEW-DUC.md`) | Kiểm thử chéo phân quyền và import roster. |
| **S12** | Kiểm tra role/URL trực tiếp và lỗi | P01–P15 | **DONE** | 5/5 PASS (`s12-role-url-errors.unit.test.ts`) | Kiểm tra truy cập URL trực tiếp và hiển thị lỗi thân thiện. |
| **S13** | Sửa lỗi và nghiệm thu bàn giao | P01–P15 | **DONE** | 4/4 PASS (`S13-FINAL-RELEASE-REPORT.md`) | Biên dịch monorepo sạch, đóng gói bundle an toàn. |

#### Đánh giá code Sơn so với Plan ban đầu:
- **Ưu điểm xuất sắc:** Giao diện Robot Lab cực kỳ hiện đại, nhất quán về mặt thị giác, animation mượt mà, cấu trúc code rõ ràng, bao phủ Playwright E2E đầy đủ.
- **Điểm chưa hoàn thành so với Plan (Gaps):**
  1. *Trang Điều hành sự cố giải đấu (`adminTournamentOperations` — P03):* Tuyến `/admin/tournaments/:tournamentId/operations` vẫn đang gắn component giữ chỗ `AdminRoutePending`, chưa có giao diện thực tế cho phép TA can thiệp hoãn/hủy từng trận đấu đang chạy.
  2. *Lỗ hổng kiểm tra quyền tại `AdminCapabilityGuard` (BUG-01 & D12-F02):* Component `AdminCapabilityGuard.tsx` (dòng 80–151) chỉ kiểm tra `if (!user)` (đã đăng nhập chưa) mà không kiểm tra `user.role`! Người dùng thường (học sinh/thí sinh) truy cập trực tiếp URL `/admin/...` vẫn nhìn thấy vỏ Console Quản trị (header, navigation bar) trước khi các API con bên trong từ chối bằng 403.
  3. *Lỗi tương phản chữ trên nền nút ở Light Mode (BUG-04):* Tại `TournamentDetailPage.tsx` (dòng 353), nút bấm bị gán cứng `background: "var(--system-cyan)", color: "#0B1421"`. Ở Light Mode, nền xanh sẫm kết hợp chữ đen khiến chữ chìm hoàn toàn (tỉ lệ tương phản vi phạm WCAG).
  4. *Thiếu liên kết điều hướng Hỗ trợ (BUG-03):* Thanh menu của `AdminLayout.tsx` chưa có nút bấm dẫn tới trang Hỗ trợ / Khôi phục tài khoản (`/admin/support` — P12).
  5. *Rác dữ liệu khi chuyển form tạo giải (BUG-05):* Trong `TournamentWizardPage.tsx`, khi chuyển `competitionMode` từ `BOT_VS_BOT` sang `HUMAN_ONLINE`, trường `botDeadlineAt` không được reset về `null`.

---

### 1.4. Phân hệ của Long (Foundation, Contracts, Core Lifecycle & Approvals — `L00`–`L13`)

#### Bảng chi tiết 14 Task của Long:
| Task | Tên Task | Phân hệ | Trạng thái Code | Test Evidence | Đánh giá & Phát hiện |
|:---:|---|:---:|:---:|:---:|---|
| **L00** | Thiết kế kiến trúc, Wireframe & ADR | Cốt lõi | **DONE** | ADR-L00-01..06, Wireframes | 6 quyết định kiến trúc then chốt về store, quota, concurrency. |
| **L01** | Contracts Zod & Prisma Schema + Migration | Contracts, DB | **DONE** | 8/8 PASS (`tournament-l01.contract.test.ts`) | Hợp đồng khởi tạo giải đấu `@ottv2/contracts`, Prisma migration an toàn. |
| **L02** | Quản trị Đơn vị, Hợp đồng & Quota | Foundation | **DONE** | Service tests PASS | Dịch vụ `UnitContractService`, kiểm soát hạn mức giải đấu nghiêm ngặt. |
| **L03** | Giao diện Quản trị Đơn vị (P06) & Hợp đồng (P07) | Web Admin | **DONE** | 5/5 PASS (`admin-pages.test.tsx`) | Hai trang quản trị `UnitsAdminPage` và `ContractsAdminPage`. |
| **L04** | Bản nháp giải đấu, Phê duyệt & Giao diện P08 | Core, P08 | **DONE** | Unit & UI tests PASS | `CoreDraftService`, `ApprovalService` và trang duyệt giải `ApprovalsAdminPage`. |
| **L05** | `ChangeRequest` hậu duyệt & Phát hành luật | Core | **DONE** | Lifecycle tests PASS | Cơ chế gửi yêu cầu thay đổi và cập nhật luật trong khung an toàn. |
| **L06** | Cổng kiểm soát C32 & Ghim phiên bản luật | Fastify PreHandler | **DONE** | Admission gate tests PASS | Chặn trận đấu khi giải chưa RUNNING; ghim phiên bản luật theo từng trận. |
| **L07** | Máy trạng thái Vòng đời giải đấu | Core Lifecycle | **DONE** | T025..T030 PASS | State machine: SCHEDULED → RUNNING → PAUSED → FINISHED / CANCELLED. |
| **L08** | Phán quyết thủ công & Sổ cái Điểm/Elo (C33) | Ledger, Core | **DONE** | T059..T081 PASS | Xử lý phán quyết hòa, sổ cái tính điểm và thứ tự kết thúc `finish_sequence`. |
| **L09** | Kiểm thử tranh chấp đồng thời (Concurrency) | Concurrency | **DONE** | 7/7 PASS (`tournament-l09-concurrency.unit.test.ts`) | Kiểm tra race-condition với CAS revision và hàng đợi async lock. |
| **L10** | Kiểm thử tích hợp E2E toàn luồng | Fastify Inject | **DONE** | Integration flow PASS | Kiểm thử chu trình từ tạo đơn vị, cấp hợp đồng tới chốt giải. |
| **L11** | Review chéo phân hệ của Nam (N00–N10) | Game Rules | **DONE** | L11 cross-review report | Xác nhận 100% PASS cho N09/N10/N11. |
| **L12** | Bàn giao vận hành, Quy trình duyệt & Manifest | Docs, JSON | **DONE** | `l12-handoff-manifest.json` | Cung cấp manifest v1.1.0 và tài liệu hướng dẫn vận hành / rollback. |
| **L13** | Tổng hợp kiểm thử & Ký duyệt Release | Toàn bộ L | **DONE** | Báo cáo `L13-final-release-report.md` | Điểm tự đánh giá 25/25, 100% cổng release đạt PASS. |

#### Đánh giá code Long so với Plan ban đầu:
- **Ưu điểm xuất sắc:** Nền tảng vòng đời giải đấu, kiến trúc kiểm soát đồng thời (concurrency with async lock), máy trạng thái và các trang P06–P08 được viết theo tiêu chuẩn cao, phân tách module rất sạch sẽ.
- **Điểm chưa hoàn thành so với Plan (Gaps):**
  1. *Xung đột lưu trữ giữa RAM Store và PostgreSQL:* `TournamentStateStore` sử dụng các cấu trúc `Map()` trên RAM để xử lý nghiệp vụ nhanh và quản lý lock. Tuy nhiên, Long **chưa bổ sung hook tự động đồng bộ (hydrate) dữ liệu từ PostgreSQL lên Store khi Fastify khởi động lại**. Dẫn đến nếu server khởi động lại, các giải đấu đã lưu trong PostgreSQL bị mất khỏi RAM, gọi API chi tiết giải bị văng lỗi `404 RESOURCE_NOT_FOUND`.
  2. *Ký duyệt thay đổi hợp đồng dùng chung:* Chưa có tài liệu/bút phê chính thức của Long về việc xác nhận thay đổi TTL kích hoạt từ 168h xuống 24h của Đức trong `packages/contracts`.
  3. *Lọc dữ liệu nhạy cảm trong Audit Log (D11-F09):* `SanitizingAuditService` chưa lọc bỏ triệt để các chuỗi có định dạng hex token tự do người dùng nhập vào trường lý do (reason), tiềm ẩn rủi ro lộ token trong nhật ký kiểm toán.
  4. *Tự động dọn dẹp dữ liệu 90 ngày:* Chưa tạo migration hay scheduled task định kỳ để thực thi dọn dẹp dữ liệu giải đấu hết hạn.

---

## 2. CÁC XUNG ĐỘT KỸ THUẬT KHI TÍCH HỢP

### 2.1. Xung đột cơ chế lưu trữ: In-Memory Store vs PostgreSQL
- **Bản chất:** `TournamentStateStore` của Long trong `apps/server` là một Store chạy trên RAM (`new Map()`). Khi server Fastify khởi động lại, Store bị reset về rỗng. Trong khi đó, các dữ liệu đơn vị, hợp đồng, giải đấu và thí sinh lại được lưu bền vững trong PostgreSQL qua Prisma.
- **Hậu quả:** Khi khởi động lại server hoặc trong môi trường multi-instance, API `/api/tournaments/:id` trả về `404 RESOURCE_NOT_FOUND` mặc dù dữ liệu giải đấu vẫn nằm nguyên trong Database, gây ra lỗi hiển thị trắng trang hoặc báo lỗi không tìm thấy giải đấu.
- **Giải pháp:** Cần tích hợp module đồng bộ `syncPrismaToTournamentStore` tự động nạp snapshot từ PostgreSQL vào `TournamentStateStore` khi server bootstrap.

### 2.2. Xung đột kiểm soát CSRF và Mutation Request
- **Bản chất:** `csrfMiddleware` của Fastify kiểm tra chặt chẽ header `X-OTT-Request: 1` và so khớp `Origin`/`Referer` trong allowlist cho mọi method `POST`, `PUT`, `PATCH`, `DELETE`.
- **Hậu quả:** Một số form và API client cục bộ gửi request mà không đính kèm header `X-OTT-Request: 1` lập tức nhận mã lỗi `403 UNAUTHORIZED` (`INVALID_CSRF_TOKEN`).
- **Giải pháp:** Chuẩn hóa `httpClient.ts` và toàn bộ các API client (`tournamentApi.ts`, `tournamentStaffApi.ts`, `tournamentRosterApi.ts`) luôn tự động inject header `X-OTT-Request: 1`.

### 2.3. Xung đột cơ chế phân quyền: Server ACL vs Client Shell Guard
- **Bản chất:** Server kiểm tra nghiêm ngặt `actor.role` (chặn `USER` thường, chỉ cho phép `SYSTEM_ADMIN` và `TOURNAMENT_ADMIN` sở hữu hợp đồng). Nhưng `AdminCapabilityGuard.tsx` ở Web chỉ kiểm tra `if (!user)` mà không kiểm tra vai trò.
- **Hậu quả:** Người dùng bình thường đăng nhập bằng tài khoản người chơi (ví dụ `player_1`) vẫn có thể truy cập URL `/admin/tournaments` và nhìn thấy vỏ Console Quản trị, sau đó mới bị văng lỗi 403 từ API bên trong.

---

## 3. DANH MỤC BUG & LỖI TIỀM ẨN (BUGS & DEFECTS MATRIX)

| Mã Bug | Mức độ | Người phụ trách | Vị trí phát hiện | Mô tả lỗi | Hướng xử lý |
|:---:|:---:|:---:|---|---|---|
| **BUG-01** | **Cao (Security)** | Sơn | `AdminCapabilityGuard.tsx` (dòng 80–151) | Không kiểm tra `user.role` hoặc capability; chỉ kiểm tra `if (!user)`. Thí sinh thường xem được vỏ Admin Shell. | Bổ sung kiểm tra `role` (`SYSTEM_ADMIN`, `TOURNAMENT_ADMIN`) hoặc gọi endpoint capabilities trước khi render children. |
| **BUG-02** | **Nghiêm trọng (Routing)** | Nam | `apps/web/src/app/router.tsx` & `routes.ts` | Trang **`ManualAdjudicationPage` (`P05`)** của Nam **chưa được đăng ký vào router** của Web. URL `/admin/tournaments/:tournamentId/adjudications` bị 404. | Thêm route `adminTournamentAdjudications` vào `routes.ts` và đăng ký component `ManualAdjudicationPage` vào `router.tsx`. |
| **BUG-03** | **Trung bình (UI Nav)** | Sơn | `apps/web/src/layouts/AdminLayout.tsx` | Tuyến Hàng đợi Hỗ trợ tài khoản (`SupportRecoveryPage` - `P12`, `/admin/support`) **không có nút/link trên thanh điều hướng** Admin. | Thêm `NavLink` "Hỗ trợ" (`routes.adminSupport`) vào thanh header `AdminLayout`. |
| **BUG-04** | **Trung bình (A11y/Contrast)** | Sơn | `TournamentDetailPage.tsx` (dòng 353), `TournamentWizardPage.tsx` | Nút bấm chính có inline style `background: "var(--system-cyan)", color: "#0B1421"`. Ở **Light Mode**, chữ đen trên nền xanh sẫm bị chìm, không đọc được. | Bỏ hardcode `color: "#0B1421"`, sử dụng lớp chuẩn `.button.primary` hoặc gán màu chữ tương phản theo theme. |
| **BUG-05** | **Thấp (Form State)** | Sơn | `TournamentWizardPage.tsx` | Khi chuyển đổi `competitionMode` từ `BOT_VS_BOT` sang `HUMAN_ONLINE`, trường `botDeadlineAt` không được xóa về `null` (D11-F07). | Thêm hook reset `botDeadlineAt: null` khi thay đổi chế độ thi đấu sang thể thức người. |
| **BUG-06** | **Cao (Data Loss/404)** | Long | `apps/server/src/modules/tournament-foundation/tournament-store.ts` | Store lưu trong RAM Map(). Khi restart Fastify server, Store bị rỗng làm mất đồng bộ với giải đấu trong PostgreSQL. | Thêm hàm nạp tự động (hydrate) từ PostgreSQL vào `TournamentStateStore` khi server bootstrap. |
| **BUG-07** | **Trung bình (Light Theme)** | Nam | `apps/web/src/features/admin/tournaments/ManualAdjudicationPage.css` | Sử dụng biến không tồn tại `var(--surface-sunken, #0b1220)` và `var(--border-subtle, #263247)` làm vỡ màu ở Light Mode (biến thành khối đen sì). | Đổi sang các biến token chuẩn: `var(--surface-raised)` và `var(--border)`. |
| **BUG-08** | **Trung bình (Chưa hoàn thiện)** | Sơn | `apps/web/src/app/router.tsx` (dòng 129–137) | Tuyến điều hành sự cố P03 (`adminTournamentOperations`) cắm component giữ chỗ `AdminRoutePending`. | Bổ sung UI thao tác hoãn trận/hủy trận hoặc ẩn link cho đến phiên bản tiếp theo. |
| **BUG-09** | **Thấp (Audit Sanitization)** | Long | `SanitizingAuditService` (`audit.port.ts`) | Chưa lọc bỏ chuỗi dạng token hex tự do người dùng nhập trong trường lý do (reason) (D11-F09). | Thêm regex quét và ẩn chuỗi hex độ dài lớn trong trường `reason`. |

---

## 4. CÁC ĐIỂM CHỒNG LẤP & RANH GIỚI BÀN GIAO GIỮA CÁC THÀNH VIÊN

1. **Ranh giới Rule Editor (Nam) và Wizard tạo giải (Sơn):**
   - Nam chịu trách nhiệm `RuleEditor.tsx` (`P04`), Sơn chịu trách nhiệm tích hợp vào bước 4 của `TournamentWizardPage.tsx` (`P02`).
   - Cần đảm bảo `TournamentWizardPage` sử dụng trực tiếp Zod validation từ `@ottv2/contracts` do Nam & Long xây dựng, tránh tự định nghĩa logic validate quy mô giải đấu độc lập.
2. **Ranh giới Quyền hạn Tournament Admin (Long vs Đức):**
   - Long định danh quyền quản trị qua `tournament.ownerTaUserId`.
   - Đức quản lý gán quyền thông qua bảng quan hệ `TournamentContractTaBinding`.
   - Cần đảm bảo `lifecycle.service.ts` luôn kiểm tra cả hai lớp: TA phải vừa là owner, vừa có binding hợp đồng ACTIVE thì mới được bấm Bắt đầu/Tạm dừng giải đấu.
3. **Ranh giới Hợp đồng dùng chung (Đức vs Long):**
   - Trong `packages/contracts/src/tournament-initialization.ts`, Đức đã chủ động hạ thời gian sống của token kích hoạt tài khoản (`activationTokenExpiresInHours`) từ **168 giờ xuống 24 giờ**.
   - Long (single writer) cần chính thức ký duyệt và ghi nhận trong hồ sơ release.
4. **Ranh giới Tự động hóa Vòng đời dữ liệu (Đức vs Long):**
   - Đức đã hoàn thành các hàm đánh giá chính sách lưu trữ (`retention.policy.ts`). Long cần phối hợp thiết lập Cron job tự động trên Prisma DB để dọn dẹp dữ liệu giải sau 90 ngày mà không làm mất tài khoản sinh viên.
5. **Ranh giới Phân quyền UI vs Backend (Sơn vs Đức):**
   - Backend của Đức từ chối 403 chuẩn xác, nhưng Sơn cần bổ sung kiểm tra vai trò tại `AdminCapabilityGuard` để không cho phép thí sinh vào xem khung Console Admin.

---

## 5. LỖI GIAO DIỆN UI/UX: FONT, BỐ CỤC & THEME SÁNG/TỐI

### 5.1. Lỗi Khác Biệt Font Chữ (Typography Inconsistency)
- **Hệ thống Font tiêu chuẩn của Robot Lab:**
  - Tiêu đề, Thương hiệu: `--font-display` (*Space Grotesk*, *Be Vietnam Pro*)
  - Nội dung văn bản: `--font-body` (*Be Vietnam Pro*)
  - Dữ liệu, Thông số, Mã số, Bàn cờ: `--font-data` (*IBM Plex Mono*, *Consolas*)
- **Sai lệch phát hiện:**
  - Tại `TournamentWizardPage.tsx` (dòng 765): Gán cứng `fontFamily: "monospace"` thay vì dùng biến token chuẩn `var(--font-data)`.
  - Tại `b3-lobby.css`: Sử dụng chuỗi fallback trực tiếp `font: ... ui-monospace, SFMono-Regular, Consolas, monospace` thay vì sử dụng biến `var(--font-data)`.
  - Một số thẻ `<code>` trong `TournamentDetailPage` không có class hay font token, dẫn đến hiển thị font Courier mặc định của OS trên Windows/Linux.

### 5.2. Lỗi Vỡ Theme / Sai Màu ở Chế Độ Sáng (Light Mode Discrepancy)
Toàn bộ phân hệ Tournament được thiết kế và kiểm thử với giả định nền tối (Dark Theme). Khi người dùng đổi sang giao diện Sáng (`:root[data-theme="light"]`), phát hiện các lỗi sau:
1. **Trang Phán quyết hòa (`ManualAdjudicationPage.css`):**
   - Sử dụng các biến không tồn tại: `var(--surface-sunken, #0b1220)` và `var(--border-subtle, #263247)`.
   - Kết quả ở Light Mode: Do biến không có giá trị, trình duyệt rơi về màu fallback `#0b1220` (đen sẫm). Trên nền trang web màu trắng xám `#EAF0F5`, các ô cờ, textarea và khối so sánh biến thành các khối đen sì, mất thẩm mỹ.
2. **Nút bấm chính (`.button.primary` inline):**
   - Màu chữ gán cứng `color: "#0B1421"` trên nền `var(--system-cyan)`.
   - Trong Light Mode: Nền là `#007381` (xanh cổ vịt sẫm), chữ là `#0B1421` (xanh đen). Tỉ lệ tương phản chỉ đạt ~1.4:1 (vi phạm nghiêm trọng chuẩn tương phản WCAG 4.5:1).
3. **Bảng Roster (`TournamentRosterPage.tsx`):**
   - Dòng 237 dùng nền header `rgba(255, 255, 255, 0.05)`. Ở Light Mode, nền bảng đã là trắng `#FDFEFE`, làm tiêu đề bảng bị chìm hoàn toàn.
   - Dòng 223–230 dùng các màu hex cứng (`#10b981`, `#ef4444`, `#f59e0b`) thay vì biến semantic của hệ thống.
4. **Huy hiệu trạng thái giải đấu (`TournamentCard.tsx`):**
   - Dòng 207–276 chứa hơn 15 mã màu hex cứng dạng Tailwind (`#EAB308`, `#A855F7`, `#F97316`, `#10B981`, `#EF4444`) không đổi theo theme sáng/tối.

### 5.3. Lỗi Bố Cục & Tràn Màn Hình (Layout & Responsive Issues)
1. **Thanh điều hướng chi tiết giải đấu (`TournamentDetailPage.tsx`):**
   - Hàng chứa 5 nút tác nghiệp phụ (Luật, Roster, Staff, Bot, Audit) kèm 2 nút vòng đời (Mở lịch, Bắt đầu) có tổng cộng 7 nút.
   - Khi co màn hình về chiều rộng dưới 768px (Tablet/Mobile), các nút này bị rớt dòng thành 3–4 hàng không thẳng hàng, chiếm hết nửa màn hình đầu tiên.
2. **Khoảng cách và Padding của Bảng dữ liệu Roster:**
   - Trên màn hình nhỏ (<640px), bảng danh sách thí sinh có thanh cuộn ngang tốt, nhưng các nút hành động "Cấp token kích hoạt" bị co lại quá hẹp (<32px), khó bấm trên thiết bị cảm ứng.

---

## 6. KẾ HOẠCH KHẮC PHỤC KHUYẾN NGHỊ

### Các hạng mục ưu tiên cao (P1) cần vá ngay lập tức:
1. **Đăng ký Route `ManualAdjudicationPage` (`P05` — Nam & Sơn):** Thêm `/admin/tournaments/:tournamentId/adjudications` vào `routes.ts` và `router.tsx`. Bổ sung nút liên kết từ trang chi tiết giải đấu `P03`.
2. **Vá quyền `AdminCapabilityGuard` (Sơn):** Bổ sung kiểm tra vai trò người dùng (yêu cầu `SYSTEM_ADMIN` hoặc `TOURNAMENT_ADMIN`) để chặn thí sinh thường truy cập Console Quản trị.
3. **Thêm cơ chế tự động đồng bộ DB vào Store (Long):** Viết hook nạp dữ liệu từ PostgreSQL vào `TournamentStateStore` khi server Fastify khởi động để tránh lỗi 404 sau khi restart.
4. **Chuẩn hóa Theme Tokens cho `ManualAdjudicationPage.css` (Nam):** Thay thế `var(--surface-sunken, #0b1220)` bằng `var(--surface-raised)` và `var(--border-subtle)` bằng `var(--border)`.
5. **Sửa màu chữ nút bấm (Sơn):** Bỏ `color: "#0B1421"` trên các nút có `background: var(--system-cyan)` để màu chữ tự động tương phản (`#ffffff` ở Light Mode và `#0B1421` ở Dark Mode).
6. **Bổ sung NavLink Hỗ trợ (Sơn):** Thêm nút điều hướng trang Hỗ trợ (`/admin/support`) vào thanh menu của `AdminLayout`.

### Các hạng mục ưu tiên trung bình (P2) bàn giao trước release:
1. **Phê duyệt Contract TTL 24h (Long):** Long ký duyệt chính thức sự thay đổi từ 168h về 24h của Đức.
2. **Thiết lập Cron Retention DB (Long & Đức):** Lên lịch cron định kỳ dọn dẹp dữ liệu giải 90 ngày và audit log 365 ngày trên PostgreSQL.
3. **Hoàn thiện UI P03 Operations (Sơn):** Thay thế component giữ chỗ `AdminRoutePending` bằng giao diện điều hành sự cố thực tế hoặc ẩn tạm thời nếu chưa đưa vào phạm vi giải đấu lần này.

---
*Biên bản tổng kiểm tra kỹ thuật được cập nhật toàn diện và ký duyệt bởi Sơn & Nhóm Kiểm Toán — 2026-10-24.*
