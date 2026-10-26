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

## Vòng 2 — Tương tác SA↔TA, validation và chuẩn hóa trang Luật (2026-10-27)

Tài khoản bổ sung: `uitest_ta` (TOURNAMENT_ADMIN theo luồng bootstrap D02, được gán TA binding qua UI).

| # | Kịch bản | Thực trạng trước | Kết quả kiểm thử | Hành động |
|---|---|---|---|---|
| G1 | TA đăng nhập → console | — | **PASS** (tự vào `/admin/tournaments`, nav lọc đúng — không thấy mục Đơn vị/Hợp đồng/Xét duyệt) | Không cần |
| G2 | TA tạo + nộp giải của mình | — | **PASS** (DRAFT r1 → UNDER_REVIEW r2 qua API thật) | Không cần |
| G3 | TA vào trang Xét duyệt | — | **PASS** (403 rõ ràng "Yêu cầu thẩm quyền Quản trị viên Hệ thống" — đúng đặc tả chỉ SA duyệt) | Không cần |
| G4 | SA thấy giải TA nộp trong hàng đợi | — | **PASS** (bàn giao SA↔TA hiển thị đúng) | Không cần |
| G5 | Yêu cầu chỉnh sửa khi thiếu lý do | — | **PASS** (server 400 "Bắt buộc nhập lý do (ít nhất 3 ký tự)… (T022)" hiển thị) | Không cần |
| V1 | Lưu nháp khi trùng mã giải | Bất kỳ lỗi 409 nào đều hiện banner **"Xung đột phiên bản (OCC)"** sai bản chất | Trùng mã → 409 `TOURNAMENT_CODE_DUPLICATE` nhưng banner nói về revision | **Đã vá**: chỉ `details.reason === "STALE_VERSION"` mới dùng banner OCC; lỗi khác hiển thị message server |
| V2 | Đệm nháp cục bộ giữa 2 tài khoản | Buffer `"new_tournament_draft"` **dùng chung** — TA được khôi phục form dở của admin (rò rỉ dữ liệu + nguy cơ ghi đè nhầm) | Tái hiện: TA thấy "Đã khôi phục từ bộ nhớ đệm cục bộ" với nội dung của admin | **Đã vá**: key đệm gắn theo user id (`getSessionIdentity` qua `/auth/me`), không khôi phục chéo tài khoản |
| U1 | Bấm "Luật thi đấu" từ chi tiết giải | Nhảy vào nguyên **wizard "CHỈNH SỬA BẢN NHÁP"** với bước 1/2/3, nút Lưu/Nộp, và badge sai "BẢN NHÁP (DRAFT r3)" cho giải APPROVED | Tái hiện đúng như người dùng báo cáo | **Đã vá**: viết lại `TournamentRulesPage` thành trang chuyên biệt read-first — badge trạng thái thật, lưới "Luật hiện hành" 14 chỉ số, lịch sử phiên bản bất biến, CTA "Mở bản nháp (bước 4)" chỉ khi DRAFT/CHANGES_REQUESTED, panel phát hành phiên bản mới chỉ khi giải đã duyệt |
| U2 | Wizard mở với giải không chỉnh sửa được | Badge "BẢN NHÁP (DRAFT rN)" cho mọi trạng thái; nút Lưu/Nộp luôn hiện (server sẽ 403/409) | Tái hiện trên giải APPROVED | **Đã vá**: badge nhãn trạng thái thật cho 14 trạng thái; nút Lưu/Nộp chỉ hiện với DRAFT/CHANGES_REQUESTED; banner khóa kèm link chi tiết |
| U3 | TA nhận ghi chú của SA khi hồ sơ bị trả về | Ghi chú thẩm định **không hiển thị ở bất kỳ đâu** cho TA | Ghi chú chỉ nằm trong DTO | **Đã vá**: banner "Ban quản trị đã yêu cầu chỉnh sửa…" + ghi chú nguyên văn trên trang sửa của TA (DRAFT lẫn CHANGES_REQUESTED) |

Kiểm chứng sau vá (trình duyệt thật): trang luật giải APPROVED hiển thị đúng badge + 14 chỉ số + không còn wizard; wizard `/edit` giải APPROVED hiện banner khóa, 0 nút Lưu/Nộp; banner ghi chú SA hiện đúng nguyên văn cho TA. Test S09-AC-01 gắn cứng với hành vi cũ (assert source chứa `<TournamentWizardPage initialStep={4} />`) đã được cập nhật theo thiết kế mới. Suite: web 71 file/354 tests PASS, workspace unit 368 PASS, typecheck + lint PASS.

## Vòng 3 — Báo lỗi nộp duyệt chỉ đích danh, phân quyền nav TA, active-state và upload UI (2026-10-27)

| # | Yêu cầu | Hành động | Kiểm chứng |
|---|---|---|---|
| H1 | Nộp duyệt thiếu thông tin phải chỉ rõ thiếu gì + tô đỏ ô lỗi (lưu nháp thì không cần) | Thêm `wizardSubmitValidation.ts`: validate 10 trường bắt buộc khi bấm Nộp duyệt; banner liệt kê từng mục thiếu; viền đỏ + hint đỏ dưới từng ô; **tự nhảy tới bước đầu tiên chứa lỗi**; ô được sửa tự gỡ đỏ; Lưu nháp giữ nguyên không validate | Browser: banner hiện đúng 2 mục thiếu, nhảy tới Bước 2, 2 ô viền đỏ, không mở modal; test mới AC "blocks submit" PASS |
| H2 | "Nhật ký" ở giao diện TA là gì? | Đó là Nhật ký kiểm toán hệ thống (`/api/admin/audit-logs` có `assertAdminActor` — chỉ SA đọc được); TA bấm vào sẽ 403 | **Đã ẩn** mục "Nhật ký" khỏi nav TA (`isSystemAdmin`); SA vẫn thấy đầy đủ |
| H3 | "Công cụ Offline" và "Kho Bot" là gì + lỗi sáng 2 nút cùng lúc | "Công cụ Offline" = Trung tâm công cụ Offline (P15: Kho Bot, Đấu Bot, Phòng tập Người–Bot, Người–Người); "Kho Bot" = trang con `/admin/offline/bots`. Lỗi: parent dùng thêm `startsWith("/admin/offline")` nên sáng cả hai | **Đã vá**: NavLink `end` + bỏ startsWith — mỗi trang chỉ sáng đúng 1 nút (browser xác minh cả 2 chiều) |
| H4 | Ô chọn tệp roster chỉ là dòng chữ "choose File" | Thay input trần bằng khung drop-zone viền nét đứt kèm icon upload + nhãn rõ ràng, hiển thị tên tệp đã chọn; input gốc ẩn trực quan vẫn giữ testid/aria-label | Browser xác minh + screenshot dark theme |

Suite sau vòng 3: web **71 file / 355 tests PASS** (thêm 1 test chặn nộp duyệt), workspace unit 368 PASS, typecheck + lint + build PASS.

## Vòng 4 — Tự chuyển hướng phiên admin khỏi player shell (2026-10-27)

| # | Yêu cầu | Kết quả |
|---|---|---|
| K1 | Admin bấm trực tiếp URL người chơi (trang chủ, /lich-su…) vẫn vào được player shell | **Đã vá**: `AppLayout` guard nhận diện phiên SYSTEM_ADMIN/TOURNAMENT_ADMIN → `Navigate` về `/admin/tournaments` (replace) trên mọi route player shell. Nút "Console Quản trị" thủ công trong player shell trở thành UI chết → đã gỡ |
| K2 | Ngoại lệ hợp lý | Các luồng token (thư mời trọng tài `/staff/invitations/…`, kích hoạt tài khoản `/kich-hoat/` `/activate/`, khôi phục `/account-access`, rules-ack) **không** bị chuyển hướng — link token chính là đích cần đến |

Kiểm chứng trình duyệt: SA vào `/lich-su` → kết thúc tại `/admin/tournaments`; SA mở link thư mời → vẫn ở trang nhận lời; player vào `/lich-su` → không bị chuyển hướng. Test mới `AppLayout.test.tsx` (5 case: SA, TA, player, ẩn danh, luồng token) — web suite **72 file / 360 tests PASS**, typecheck + lint PASS.

Ghi chú thiết kế: chuyển hướng "ép về console ở mọi route" là mẫu phù hợp cho hệ thống tách biệt nghiêm ngặt staff/player (định hướng đã chốt của dự án từ S01/23009fe). Mẫu phổ biến trong thực tế rộng hơn là chỉ chặn landing root và cho admin tự do xem trang người chơi — nếu sau này cần admin xem trải nghiệm người chơi (QA nội dung), dùng tài khoản player/khách riêng.

## Vòng 5 — Bản nháp: "Tạo mới" khởi đầu trắng và lịch tạm không được nộp duyệt (2026-10-27)

Báo cáo người dùng: (1) đã có bản nháp nhưng mở "Tạo giải mới" lại được khôi phục dữ liệu cũ; (2) nộp duyệt bị chặn đòi lịch trình, nhưng sau khi bấm "Lưu bản nháp" (chưa nhập lịch) lại nộp được.

**Nguyên nhân gốc:**
- Bộ đệm cục bộ của form tạo mới không được dọn sau khi bản nháp đã lưu server; kèm lỗi lệch khóa lịch sử (`clearLocalDraftBuffer(targetId)` không khớp khóa đã lưu `draft_{id}:{uid}`) khiến việc dọn không bao giờ khớp.
- Schema server bắt buộc `scheduledStartAt/EndAt` kể cả với bản nháp, nên wizard **âm thầm tự điền ngày mai/mốt** khi lưu; sau khi lưu, form mang ngày tự điền đó → cổng kiểm tra nộp duyệt (đã vá ở Vòng 3) bị "qua mặt" bởi dữ liệu người dùng chưa từng nhập.

**Đã vá:**
- Lưu nháp vẫn tự điền lịch (ràng buộc schema) nhưng đánh dấu `scheduleProvisional` minh bạch: hint vàng "Giá trị tạm do hệ thống điền khi lưu nháp" trên 2 ô lịch, banner chặn nộp duyệt ghi rõ "hãy chọn lại lịch thật ở Bước 2"; người dùng tự chọn lại lịch → gỡ cờ → nộp bình thường.
- Dọn đúng khóa đệm theo tài khoản sau khi tạo (form "Tạo mới" khởi đầu trắng) và sau khi nộp duyệt (cả khóa bản nháp lẫn khóa tạo mới).
- Phát hiện thực tế: React giữ nguyên instance wizard khi URL đổi /new → /edit (không remount) — cờ được set trực tiếp trong instance + seed vào đệm cho trường hợp remount thật; auto-persist bị chặn trong lúc tải bản nháp để không ghi đè cờ bằng form mặc định.

**Kiểm chứng trình duyệt (trình tự đúng như người dùng gặp):** Lưu nháp không có lịch ✓ → Nộp duyệt bị chặn "giá trị tạm" ✓ → chọn lịch thật ở Bước 2 → Nộp duyệt mở modal ✓ → xác nhận → UNDER_REVIEW ✓ → mở lại "Tạo giải mới" → form trắng, không khôi phục ✓. Suite: web 73 file/366 tests PASS (thêm `wizardSubmitValidation.test.ts` 6 case), workspace 368 PASS, typecheck + lint + build PASS.

## Vòng 6 — Nút "Từ chối" / "Yêu cầu chỉnh sửa" của SA tưởng hỏng (2026-10-27)

**Báo cáo:** SA chỉ bấm được "Phê duyệt"; hai nút còn lại "không thể chọn".

**Chẩn đoán (browser + code):** Toàn bộ đường xử lý **hoạt động đúng** — 3 nút gọi đúng giá trị quyết định (APPROVE/REQUEST_CHANGES/REJECT), server xử lý đủ 3 nhánh; kiểm chứng thật: REQUEST_CHANGES ✓, REJECT ✓ (kèm hoàn hạn mức). Vấn đề thật là **UX phản hồi thiếu**: khi bấm mà chưa nhập lý do (bắt buộc theo T022), thông báo chỉ hiện ở **banner đầu trang**, trong khi ô nhập lý do và 3 nút nằm ở panel chi tiết dưới màn hình → SA chỉ thấy "bấm không có gì xảy ra".

**Đã vá (chuẩn UX vòng 3):** thiếu lý do khi bấm → viền đỏ 2px trên ô lý do + thông báo đỏ ngay dưới ô (role=alert, aria-describedby) + **focus và cuộn tới ô lý do**; gõ lý do → tự gỡ đỏ, tắt banner cũ; cả hai handler (hồ sơ lần đầu + ChangeRequest hậu duyệt) dùng chung cơ chế.

**Kiểm chứng trình duyệt:** thiếu lý do → đỏ + focus + alert ✓; gõ → gỡ ✓; có lý do → CHANGES_REQUESTED ✓ và REJECTED ✓. Suite: web 73 file/366 tests PASS, typecheck + lint PASS.

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
