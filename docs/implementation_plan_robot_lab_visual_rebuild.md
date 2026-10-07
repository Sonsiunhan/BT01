# OTT v2 — Tái thiết kế Robot Lab theo bản mẫu gốc

## 1. Trạng thái và quyết định

Ngày: 2026-10-04, Asia/Bangkok. Trạng thái: IMPLEMENTATION AUTHORIZED / IN PROGRESS theo yêu cầu tiếp theo của người dùng: hoàn chỉnh plan rồi tự thực thi/test/debug/cleanup. Người dùng chốt 1A/2A/3A: bám sát mẫu gốc, chỉ điều chỉnh bố cục theo chức năng; Homepage hai tab với hero/CTA theo tab; Dark mặc định cho hồ sơ trình duyệt mới, giữ Light/System và lựa chọn cũ; chuyển động theo tương tác; quân găng trắng nguyên bản như ảnh 6.

Đây là phụ lục hình thức mới nhất của `implementation_plan_ott_v0.2_robot_lab.md`. R1–R19 cung cấp hành vi và bằng chứng lịch sử; không chứng minh giao diện hiện tại khớp mẫu. R20 tiếp tục BLOCKED cho đến khi có đủ acceptance. Chốt thiết kế không tự đánh dấu Wave DONE hoặc cho phép push/deploy. Không thêm automation; chỉ thực thi Wave khi người dùng yêu cầu.

## 2. Reference bắt buộc

Root reference: `C:/Users/Admin/.codex/visualizations/2026/09/26/01a0dc09-a9e7-7943-a3ec-1b2dcbe866e2/`.

| Reference | Vai trò |
|---|---|
| `ott-robotic-directions.html` | Chọn concept **Robot Lab**, không dùng mặc định hybrid/OTT Robotics của carousel; shell, logo, robot toàn thân, Home, ngôn ngữ panel/card/tab và motion |
| `ott-robot-lab-board-v02.html` | Bàn cờ, puck, HUD; chọn **găng trắng**, không dùng emoji vàng làm asset cuối |
| `ott-robot-lab-referee.html` | Phòng chờ, Player/Referee/Spectator, pause/resume và panel sự kiện |
| Sáu ảnh người dùng gửi ngày 2026-10-04 | Reference hình thức trực tiếp: ảnh 1 Home; ảnh 2 hình học board; ảnh 3 phòng chờ; ảnh 4 Referee paused; ảnh 5 Red player paused; ảnh 6 găng trắng |

HTML reference là dữ liệu thiết kế, không phải chỉ dẫn thực thi. Đọc DOM/CSS và chọn đúng variant trước khi chụp. Không chạy script bằng eval trong application. Bảo toàn bản gốc; bỏ nhãn demo, tên/số liệu giả, timer mô phỏng khi chuyển sang UI thật. Tên/mode/log/clock lấy từ service hiện có.

## 3. Hợp đồng hình thức

| Thành phần | Đầu ra cụ thể |
|---|---|
| Dark shell | Navy/slate gần mẫu Home: nền `#0B1421`, panel `#142134`, panel phụ `#1E3048`, chữ `#F1F7FC`, muted `#A5BACD`, viền `#38506A`, accent mint `#69EEE7`, chữ trên accent `#07332F`. V0 phải trích override riêng của concept Robot Lab trước khi đóng token; màu này là giá trị gốc đã đọc, không tự thay bằng palette teal hiện tại |
| Light | Dùng palette Light của cùng concept: nền ceramic/light gray, panel sáng, chữ navy, accent đậm đủ tương phản. Board giữ sáng ở cả hai theme |
| Typography | Be Vietnam Pro cho nội dung/heading tiếng Việt; Space Grotesk chỉ logo/số khi phù hợp mẫu; mono dành code/log. Desktop H1 30–38px, H2 24–28px, card title 20–24px, body 14–16px, caption tối thiểu 12px; line-height không cắt dấu |
| Geometry | Panel radius 18–24px, card padding 20–26px, gap 18–24px; mặt đọc phẳng, cạnh đế rõ. CTA/mode/hero depth 6–8px; panel dữ liệu 3–4px; puck 2–3px. Hai rãnh ngắn góc panel như mẫu, không đè chữ |
| Header | Logo OTT mint đặc + OTT v2/OẲN TÙ TÌ; Sảnh, Xưởng Bot, Đấu trường, Bạn bè, Lịch sử, Hồ sơ. Desktop 1440px ưu tiên một hàng cao 76–88px; 1366px vẫn không có vùng trống lớn. Đấu trường dẫn phòng Online hiện có. Avatar mở hồ sơ/Cài đặt/theme/đăng xuất; Guest có tên thật từ storage và đăng nhập |
| Robot | Phục hồi robot toàn thân từ reference: antenna, head, visor hai mắt mint, tai, thân OTT, hai tay/găng, hai chân và ellipse dưới chân. Reuse hình học nguyên bản, đóng thành component; không biểu tượng robot trong hộp, không orb/puck bay quanh hero |
| Motion | Card hover translateY(-4px), nút -2px; press +2px cùng đế ngắn; transition 160ms. Trang/tab vào opacity + translateY(7px) trong 190ms. Robot đổi pose nhẹ khi hover/focus hero; stable idle, không breathing/bobbing tự lặp. No whole-card pointer tilt. Reduced Motion/Low dùng phản hồi tĩnh và không mất focus |
| Board | 81 ô vuông, ceramic `#EEF4F7`/`#DDE8EF`, grid nhẹ; puck chiếm 82–88% ô, xanh `#D7EAFF`, đỏ `#FFE0E5`, rim xanh `#4078AF`/đỏ `#A34F63`. Găng trắng nguyên bản dark contour/cuff, ba gesture khác nhau; không Đ/B/K và không filter emoji |
| HUD | Trên/dưới board: avatar và tên/phe trái, clock tabular bên phải; viền cạnh phe. Own side dưới cố định Online; AI/Offline/Bot Offline và Ref/Spec canonical Blue dưới; không rotate theo turn |
| Desktop arena | Board + HUD khoảng 64–68%, rail khoảng 32–36%. Board scale theo chiều cao viewport, thử 900px/768px; không kéo board thành chữ nhật hoặc thu quá nhỏ để ép vừa. Rail có nội dung dài thì cuộn riêng có nhãn; trang vẫn cho cuộn khi cần |

Dark default chỉ áp dụng khi không có lựa chọn hợp lệ đã lưu. Giữ nguyên key `ottv2.theme`; không xóa storage để ép Dark. Đồng bộ bootstrap index.html, readStoredTheme, ThemeProvider và preview settings; storage bị chặn vẫn render Dark an toàn, System đã lưu vẫn theo OS.

## 4. TASK ID theo trang

### 4.0 Bắt buộc phát triển demo theo tính năng thật

**Demo Robot Lab là chuẩn hình thức, không phải giới hạn tính năng.** Backend R1–R19 đã bổ sung principal, roles, queue, pause/recovery, Bot revisions/runtime, replay/audit và privacy. UI phải đọc contract/service/source thực tế, biểu diễn đầy đủ tính năng mới bằng ngôn ngữ thiết kế demo. Không sao chép fake states/names/counters; không bỏ tính năng vì demo không vẽ nó; không viết lại backend đã có chỉ để vừa demo. Nếu endpoint chưa hỗ trợ scope đã chốt, lập harness chứng minh gap, sửa dependency nhỏ trong kiến trúc hiện tại rồi kiểm thử; tuyệt đối không giả thành công.

| Tính năng mới / khác demo | UI phải bổ sung | Service / nguồn hiện có | Wave |
|---|---|---|---|
| Guest principal + account login giữa trận | Tên local ổn định; Ranked login hint; quyền trận giữ principal; import sau trận có chọn | guestApi/authApi/clientIdentity/localGameStorage | V2/V9 |
| Cancel vs match commit, reconnect/resync | Cancelling/ack/retry/matched; Back không orphan queue | matchmakingApi/queueAdmission/queueState | V3 |
| Active match / Bot owner rời tab | Resume về đúng room; không tạo trận xung đột; không dùng hint hết hạn làm authority | activeMatchHint/matchApi/botOnlineApi | V2/V5 |
| Custom Manual/Bot + Ref/Spec độc lập | Public/private/password, preset, host role, capacity, invitation/Ready/Start/locked config | roomApi/WaitingRoom/CreateRoomForm | V3 |
| Ref pause/resume/replacement | Public category/time, elapsed từ server, 3s resume, blockers, absence/recovery deadline, consent hai Player và candidate | matchApi/RefereeReplacementPanel/RefereePauseOverlay | V4 |
| Online bot hot-update | active/pending/validation failure/latest valid candidate, reset/preserve compatible memory, paused/terminal non-application | botOnlineApi/contract slot/revision | V5 |
| Bot budgets/fault/capacity | Preset số liệu trước Ready, thinking, capacity wait/cancel, author fault vs infrastructure recovery | botOnlineApi/SDK manifest/server public snapshot | V5 |
| Private library | Upload/sample/check/version/export/delete-active guard/quotas/expiry; logs/source owner-only | botLibraryApi | V5 |
| Guest Bot/local library | Local source/revision persistence và sample/test; Online Guest cần principal/ownership API hợp lệ; không chặn toàn mode bằng account library | Audit bot library/online routes trước Dev | V5 |
| Offline runtime/cache | Download progress/version/ready/missing/evicted/update; safe Run/Pause/Step/Speed; restore paused | botOfflineRunner/offlineKit/localData | V5/V9 |
| Invitations/privacy | Manual/Bot/Ref role và expiry/accept/reject; Guest link/code; blocked/stale presence | socialApi/roomApi | V6/V8 |
| Replay/audit/NPM | Moves/revision/pause public timeline, legacy final-only, N/P/M/red tie, neutral infrastructure, audit download | historyApi/ReplayPanel/resultMetrics | V4/V7 |
| Local/account data boundaries | Source badge; explicit import/export/clear confirmation, cloud không bị xóa, active guard | localData/localGameStorage/authApi | V7/V9 |
| Auth/failure paths | Session expired, safe return/draft, recovery code acknowledgment, retry/forbidden/full/missing/cache | httpClient/apiError/returnUrl/authApi | V9 |

**Gaps đã nhìn thấy ngày 2026-10-04:** BotOnlinePage render login gate cho Guest; BotWorkbenchPage gọi account library; chưa có local Guest library service trong inventory. Đây là gap so với quyết định Guest/Bot, không tự khẳng định toàn backend đã DONE. Home UNRANKED hiện trỏ room browser thay queue thường: V2/V3 phải kiểm tra có queue UNRANKED contract và route chưa, nối đúng nếu có; nếu thiếu phải ghi và sửa dependency với test. Workbench Dùng Online/Offline phải thật sự truyền selection/preparation, không chỉ toast thành công. CreateRoomForm có restriction public Ref-host phải đối chiếu server và yêu cầu, không silently bỏ trường hợp tổ chức lớp.

Mỗi task kế thừa state matrix của kế hoạch R: loading/empty/error/retry/disabled/pending/expired/forbidden/disconnected tùy trang; Guest/account/role; Light/Dark; keyboard; Reduced Motion. Bảng chỉ mô tả delta hình thức, không thay luật/backend.

| ID | Trang / đầu ra | Acceptance cụ thể | Wave |
|---|---|---|---|
| VIS-REF-01 | Reference đúng variant và ảnh before | Manifest source/hash/variant/theme/viewport; ba HTML gốc còn nguyên | V0 |
| VIS-REF-02 | Mapping task R → V và baseline | Mỗi nhóm HOME…RESULT có owner V; mọi route hiện có trong inventory, không dùng Home PASS thay toàn hệ thống | V0 |
| VIS-SYS-01 | Token/font/panel/button/form/tab/badge/icon | Khớp reference qua same-size capture; text ≥4.5:1, control/graphic ≥3:1; focus rõ | V1 |
| VIS-SYS-02 | Header/brand/robot toàn thân | Đủ navigation đã nêu; routes cũ giữ; avatar/menu keyboard; robot silhouette đúng mẫu | V1 |
| VIS-SYS-03 | Dark default + motion policy | Fresh profile Dark; stored Light/Dark/System giữ; không flash light; idle stable; Reduced/Low tĩnh | V1 |
| VIS-HOME-01 | Hero trái + profile phải 1.8:1 | Greeting CHAN đúng; robot bên phải hero, CTA trong hero; account stats thật, Guest không fake Elo; không orb/glow | V2 |
| VIS-HOME-02 | Tab Chơi trực tiếp / Đấu chương trình | Direct: Online/Đấu máy/Offline 2P. Bot: Bot Online/Bot Offline/Xưởng Bot. Tab keyboard, panel khác hidden; nhớ tab local hợp lệ, không tự enqueue khi chuyển | V2 |
| VIS-HOME-03 | Hero theo tab | Direct: Đấu thường/Xếp hạng + TÌM TRẬN; Guest Ranked login hint. Bot: lời chào giữ, CTA ĐẤU BOT ONLINE dẫn preparation, secondary XƯỞNG BOT; không Ranked selector trong Bot, không bypass validation | V2 |
| VIS-HOME-04 | Phòng/friends/Resume | Dưới mode: phòng 2×2 + Friends preview, Xem tất cả; Resume trước mode khi có active match, incident ngắn khi ảnh hưởng; không nội dung kỹ thuật trang trí | V2 |
| VIS-ROOMS-01 | Full room browser | Header/search/filter/action gọn; cards 3→2→1, public role/capacity metadata, password/error/load-more đủ | V2 |
| VIS-QUEUE-01 | Search/matched/cancelling | Một panel trung tâm, robot nhỏ, elapsed hữu ích, Cancel rõ; authoritative flow và capacity wait còn nguyên | V3 |
| VIS-WAIT-01 | Waiting/create room theo ảnh 3 | Trái hai Player slots + Ref/Spec list; phải toggles/preset/role/start; bốn tổ hợp Ref/Spec; bot revision/validated/Ready rõ | V3 |
| VIS-GAME-01 | Manual/AI/Offline shared board/HUD | Scale như reference; A1/I9 occupied; coordinate không che puck; select/legal/capture/last-move rõ; handoff không xoay board | V4 |
| VIS-REF-03 | Referee/Player pause theo ảnh 4–5 | Overlay đặt trong vùng board trên desktop, freeze/inert board, elapsed/actor/category; Ref-only Resume ≥44px; panel sự kiện ngoài overlay vẫn đọc được và không interactive gameplay; focus trap. Nếu component portal toàn viewport hiện tại cần đổi, V4 owns và test accessibility trước | V4 |
| VIS-SPEC-01 | Spectator | Canonical HUD, public events, leave/reconnect; không source/private log/Resume/manual selection | V4 |
| VIS-RESULT-01 | Win/loss/neutral/rematch | Heading kết quả, board thumbnail, N/P/M và lý do, CTA đúng trạng thái; finite event celebration, Reduced tĩnh | V4 |
| VIS-LIB-01 | Xưởng Bot ba vùng | 24/42/34% desktop: library/revision → upload/sample/docs → test/result/private log; title/action rõ, source chỉ read-only; không thêm IDE | V5 |
| VIS-BOTON-01 | Bot Online preparation | Ba bước dễ đọc Chọn bot → Kiểm tra → Tìm/Tạo/Vào phòng; status/preset visible, invalid không Ready | V5 |
| VIS-BOTON-02 | Bot đang đấu | Dùng board/HUD V4; rail active/pending/thinking/upload + tab Nước đi/Log riêng; paused upload disabled; đúng ownership/log privacy | V5 |
| VIS-BOTOFF-01 | Bot Offline | Chuẩn bị hai slot cạnh nhau; bắt đầu thì board chính + rail hai slot gọn/controls; Run/Pause/Step/Speed, restore paused, kit progress/error rõ | V5 |
| VIS-FRIEND-01 | Friends/Invitations | Tab friends/incoming/sent/search; tên/avatar ưu tiên, action rõ, role invite/expiry, Guest code/link; robot nhỏ empty | V6 |
| VIS-HIST-01 | History/Replay | Header + filter compact; rows/cards có mode/source/result/thumbnail; replay shared board + timeline/pause/revision, legacy fallback/audit giữ | V7 |
| VIS-PROF-01 | Self/public/Guest profile | Identity hero + stats + recent history; manual Elo/Bot tách; edit/dirty/privacy/relationship và local Guest giữ | V8 |
| VIS-SET-01 | Settings | Nav tab và form panel; theme/motion preview chuẩn; diagnostics collapsed; local export/delete confirmation/cache/active guards | V9 |
| VIS-AUTH-01 | Auth/Guest onboarding | Logo wordmark + robot vừa phải + form; pending/errors/password/recovery/return/import đầy đủ; không ép login normal play | V9 |
| VIS-FALL-01 | 404/error/loading/empty/toast/modal | Một ngôn ngữ panel/robot nhỏ/CTA; retry/back đúng, lỗi cache khác outage, không raw stack; toast không che CTA/board | V9 |
| VIS-QA-01 | Đối chiếu đầy đủ | Evidence theo task/route/state/theme; mock visual riêng với real-service regression; không tuyên bố runtime PASS từ fixture | V10 |
| VIS-QA-02 | Cleanup và R20 linkage | CSS/asset cũ có consumer map, xóa chỉ obsolete; offline kit chứa assets/fonts mới; independent review + performance evidence và trạng thái R20 trung thực | V10 |
| VIS-FUNC-01 | Guest Bot + local Library parity | Guest sample/upload/test/local revisions/export/delete không phụ thuộc account API; Online Guest principal/owner authorization thực tế; nếu dependency thiếu báo rõ, không fixture-only PASS | V5 |
| VIS-FUNC-02 | Queue thường đúng CTA | Audit UNRANKED queue vs room navigation; CTA TÌM TRẬN phải enqueue đúng mode nếu backend hỗ trợ; flow create/join phòng vẫn riêng | V2/V3 |
| VIS-FUNC-03 | Workbench handoff thật | Bot/revision selection qua Online/Offline có owner/SDK/preflight verification; invalid/stale candidate không Ready, không chỉ thông báo toast | V5 |
| VIS-FUNC-04 | Ref tournament edge cases | Host Ref có hai slot trống, Guest không Ref, public/private và Ref/Spec bốn tổ hợp theo server; replacement/deadline/blocked Resume có visible states | V3/V4 |
| VIS-FUNC-05 | Coverage và cleanup inventory | Mỗi tính năng trong bảng 4.0 có task/route/state/API/test/artifact; route/module orphan xác định từ imports trước delete, old evidence không xóa | V0/V10 |

## 5. Wave, dependencies và file ownership

Prefix mọi file dưới đây bằng `apps/web/src/`, trừ file ghi khác. Một writer cho shared styles/router/shared board. Page worker tạo CSS scoped riêng tại `styles/visual-rebuild/<page>.css`, yêu cầu integrator đăng ký import; không append thêm tầng override tùy ý vào globals/robot-lab.css.

Backend dependency ownership cho VIS-FUNC-01/02/04: root là writer duy nhất cho `apps/server/src/modules/{auth,matchmaking,bot-library,bot-online,room,match}` và `packages/contracts`; thay đổi chỉ để khôi phục phạm vi đã chốt sau failing harness, không thay runtime/infrastructure. Không route/schema mutation song song với page worker. Evidence implementation mới ghi trong `docs/robot-lab-visual-rebuild-status.json`; automation=false. V0, V1, V2, V3, V4, V5, V6, V7 và V8 đã có evidence; tracker hiện đang ở V9 và không tuyên bố DONE toàn tái thiết kế.

| Wave | Phụ thuộc | Ownership khi thực thi |
|---|---|---|
| V0 | Plan này | `docs/robot-lab-visual-reference/*`, `docs/robot-lab-visual-rebuild-status.json`, read-only capture/verifier `scripts/robot-lab-v0-harness.mjs` + `scripts/robot-lab-v0-verify.mjs`; chỉ tạo manifest/evidence, chưa đổi UI |
| V1 | V0 | `foundation/tokens.ts`, brand/robot components, `foundation/motionPolicy.ts`, `theme/*`, `layouts/AppLayout.tsx`, shared UI, `styles/globals.css`, `styles/robot-lab.css`, `styles/b3-lobby.css`, `apps/web/index.html`; root sở hữu imports/router |
| V2 | V1 | `pages/HomePage.tsx`, `OnlineRoomsPage.tsx`, `components/rooms/RoomBrowser.tsx`, `components/social/FriendsPreview.tsx`, scoped Home styles/tests |
| V3 | V2 | `pages/QueuePage.tsx`, `components/rooms/WaitingRoom.tsx`, `CreateRoomForm.tsx`, scoped Queue/Waiting styles/tests; không sửa GameRoom cùng V4 |
| V4 | V1,V3 | `pages/GameRoomPage.tsx`, `LocalGamePage.tsx`, `SpectatorPage.tsx`, `components/board/*`, `components/game/*`, `components/result/*`, arena scoped CSS/tests; owns shared board/HUD/pause/Result |
| V5 | V1,V4 | `pages/BotWorkbenchPage.tsx`, `BotOnlinePage.tsx`, `BotOfflinePage.tsx`, Bot scoped components/styles/tests; yêu cầu V4 owner tích hợp strategy rail trong GameRoom, không hai writer |
| V6 | V1,V2 | Friends route consumer xác minh từ router, `FriendsPage.tsx`/`FriendsPageR12.tsx`, social invitations, scoped styles/tests; không sửa FriendsPreview V2 |
| V7 | V1,V4 | `HistoryPage.tsx`, `components/history/*`, scoped styles/tests; chỉ consume shared board/result |
| V8 | V1,V6 | `ProfilePage.tsx`, `components/profile/*`, scoped styles/tests |
| V9 | V1,V5 | `SettingsPage.tsx`, Login/Register/Forgot/GuestSetup/NotFound và fallback components, scoped styles/tests; theme store thuộc V1, cache service giữ nguyên API |
| V10 | V2–V9 | QA evidence, shared E2E/fixtures/import/cache integration và cleanup root; report vào R20, không tự push |

Người dùng đã ủy quyền tự thực thi/test/debug/cleanup cục bộ theo plan này. Không cần hỏi lại cho các bước đó. Chưa có yêu cầu tạo worker song song; thực thi tuần tự trong thread. Khi có nhiều worker, phải khai ownership trước khi sửa; root tích hợp shared edits tuần tự.

| Đợt tối ưu khi được yêu cầu song song | Waves |
|---|---|
| 1 | V0 rồi V1 tuần tự |
| 2 | V2 |
| 3 | V3 + V6 |
| 4 | V4 + V8 |
| 5 | V5 + V7 |
| 6 | V9 |
| 7 | V10 |

Một worker thực thi theo số V tuần tự. Prompt ngắn: `Thực thi V<N> theo docs/implementation_plan_robot_lab_visual_rebuild.md`. Agent phải đọc AGENTS.md, kế hoạch R và kế hoạch này; declare ownership; báo đủ task/evidence/status/next Wave. Không khởi động coordinator tự động.

## 6. Harness → Dev → Test → Review → Clean

1. V0 đọc đúng variant của HTML, ghi hash, chụp mẫu và app ở cùng viewport/theme; tạo bảng delta trước sửa. Screenshot hiện tại là before, không phải approved target.
2. V1–V9 chuyển hình học/asset/token vào React dùng data thật. UI vẫn consume contract hiện tại; material ambiguity ngoài quyết định đã chốt phải làm rõ trước khi đổi hành vi.
3. Focused tests bảo vệ hành vi thay đổi: theme persistence/default/bootstrap, tab CTA/routes, role controls, orientation, pause/focus, upload gates. Không tạo snapshot markup chỉ để phản chiếu implementation.
4. Browser capture tối thiểu 1440×900 và 1366×768 Dark/Light; Home fresh/stored theme, direct/Bot/Guest/account; Waiting cả Ref/Spec; Game Blue/Red/Ref/Spec paused/resuming; Bot invalid/ready/active/pending; các trang phụ loading/empty/error/data. Responsive smoke 375×812 và 768×1024 là browser emulation; physical Android/iOS đã WAIVED_BY_USER.
5. Motion evidence có video/trace hoặc đo transform/timing ở hover/press/entry; đứng idle không thay geometry; Reduced Motion không chạy animation. Screenshot tĩnh không đủ chứng minh motion.
6. So sánh cùng kích thước: robot silhouette, logo, palette, type scale, radius/depth, HUD/board/puck và layout. Chỉ chấp nhận delta chức năng/breakpoint có giải thích. Không dùng một ngưỡng pixel toàn trang cho dynamic time/text; mask có khai báo, không mask thiết kế cần kiểm tra.
7. Axe không serious/critical; contrast đo; keyboard tab/focus/labels; tên dài/tiếng Việt, error/disabled vẫn đọc. No horizontal overflow. Kiểm tra font/asset local offline cold reload sau thay asset.
8. Focused tests mỗi Wave; full web/typecheck/lint/build và browser regression khi integration/V10. Không root build có migrate database; server regression chỉ khi đổi server và với target test hợp lệ.
9. Independent review có artifact thực tế; reviewer unavailable = NOT_RUN. V10 giữ lại release-grade performance/CWV gate đang mở; lab fixture numbers chỉ chẩn đoán. Không đòi sản phẩm chưa deploy phải có CrUX lịch sử; ghi rõ phương pháp release measurement và dataset thực tế.
10. Consumer map trước cleanup CSS/assets; bảo toàn historical evidence/user changes/worktrees/storage. Status manifest hỗ trợ từng task NOT_RUN/IN_PROGRESS/BLOCKED/DONE và source evidence; không suy luận DONE từ build.

## 7. DONE và bàn giao

Mỗi V Wave DONE khi mọi task của nó có output khớp reference + behavior gate phù hợp + evidence. Toàn bộ tái thiết kế DONE khi VIS-REF/SYS/HOME/ROOMS/QUEUE/WAIT/GAME/REF/SPEC/RESULT/LIB/BOTON/BOTOFF/FRIEND/HIST/PROF/SET/AUTH/FALL/QA hoàn tất, không P0/P1/P2 thiết kế chưa xử lý, theme/motion/role/route state matrix đủ. R20 chỉ đóng sau cả gate hình thức và các gate còn lại của kế hoạch R. V0–V10 không tự thay trạng thái completed R1–R19 hoặc xóa báo cáo cũ.

Thực thi được ủy quyền: **V0 → V1 → … → V10**, tiếp tục các bước cục bộ không bị blocker; ghi evidence/status sau mỗi Wave, không cần prompt mới để tiếp tục trong phiên được ủy quyền này. Không production/push; không automation tự phát prompt. Nếu scope/backend cần thay đổi ngoài quyết định đã chốt thì làm rõ dependency đó, tiếp tục phần độc lập.
