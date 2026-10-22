# S00 — Traceability và handoff hiện hành

21/10/2026. Writer S00 lần này: Nam theo human authorization. Không thay ownership triển khai dài hạn. Phạm vi Q1A…Q5A; prototype không có server ACL hoặc runtime proof.

## Nguồn và dependency

| Nguồn | Bằng chứng | Trạng thái và tác động |
|---|---|---|
| N00 | `N00-RESULT-2026-10-21.md`, decisions revision 2, independent report FINAL 93/93 | G0 PASS yêu cầu; áp override mới hơn canonical |
| Frontend hiện hành | `apps/web/src/layouts/AppLayout.tsx`, `app/routes.ts`, `foundation/RobotLabWordmark.tsx`, `foundation/tokens.ts`, `components/ui/{Button,Modal,LoadingState}.tsx`, `styles/robot-lab.css` | Reuse wordmark/header/menu và geometry; S00 chỉ mô phỏng, chưa import production React |
| Visual authority | `docs/implementation_plan_robot_lab_visual_rebuild.md` §3 | Navy/ceramic/mint, radius18–24, đế3–4, hover/press, reduced motion |
| D00 | `origin/duc-tournament@241cb414`, account actor matrix/DTO/handoff đã đọc | DELIVERED_ARTIFACT; chưa nghiệm thu nghiệp vụ toàn bộ, chưa G1 freeze |
| D00 delta | Actor matrix cho SA full CRUD và referee resolve support; handoff reject existing personKey, TTL chưa chốt | Xung đột N00/canonical: SA không tạo giải; support authority không tự chuyển Referee; identity reuse và activation24h theo quyết định mới. Không reuse các đoạn này như contract đã duyệt |
| L00 | Không tìm thấy artifact L00 trong docs/branch local đã tra | DEPENDENCY_PENDING. Không kết luận trạng thái GitHub của Long; G1 writer phải xác minh |
| G1 | contracts/schema/error/bounds freeze | DEPENDENCY_PENDING; mọi capability/enum mới trong S00 là proposal |

## Page/action/state/component/owner

| Page | Actor và action | States | Component prototype | Handoff | Owner / AC |
|---|---|---|---|---|---|
| P01 | TA list/create; SA list; denied không đọc | ready/empty/no-results/loading/error/forbidden/expired | cards, search, filters, pagination | TournamentListQuery/View, cursor và capability server | Sơn + Long/Đức; AC03/04/14 |
| P02 | TA draft/edit/validate/submit | dirty/saving/saved/errors/conflict/recovery | 4-step wizard, field/error summary, confirmation/leave dialog | DraftView/SaveDraft/normalized profile; expected revision/idempotency G1 | Sơn; luật Nam; AC05–08/15 |
| P03 | TA overview/readiness/assign/rollback/request extension; SA compare/approve extension; Referee active assignee accept/decide | startup blocker vs running warning; open/assigned/inprogress/resolved/expired; finalized locked; pending/partial/rejected | detail tabs, sidepanel/mobile stack, reason forms | Incident/Extension DTO N00 + canonical transactions Long | Sơn + Long/Đức; AC09–11 |
| P03 exact-tie | TA only; referee không có action | frozen snapshot/manual deadline/fallback; finalized readonly | contextual handoff panel | P05 owner Nam, không thay transaction Long | Nam + Long; AC03/10 |
| P14 | TA scoped audit, SA theo grant | filter/page/empty/detail/error/forbidden | audit table, safe diff panel | safe allowlist; actor/reason/revision/event | Sơn + Long/Đức; AC12/14 |
| P15 | Admin tools; source library owner-only qua endpoint riêng | available/blocked/unavailable/retry | 4 cards, preparation/detail | `/bot-lab`, `/dau-chuong-trinh/offline`, `/offline`; Human–Python target pending | Sơn + Nam; AC13 |

## Actor matrix

| UI context | P01/P02 | P03 | P14 | P15 |
|---|---|---|---|---|
| TA owner | Scoped list/create/edit khi capability hợp lệ | Owner actions, assign/rollback trước FINALIZED; exact-tie only owner | Scoped safe audit | Tools theo capability |
| SA | Scoped system list; không tạo giải | Request comparison/approval; không tự quyết exact-tie | Theo ACL | Tools theo capability |
| Referee assigned | Không hiện list/wizard của admin | Chỉ case active assignee; hết lease/revoke không đọc/mutate; không exact-tie | Case history đã lọc trong panel; không full audit | Không kế thừa quyền admin |
| Unknown/ngoài scope | Không thấy private data | Denied | Denied | Không tự cấp capability |
| Observer / Broadcast Admin | Read-only match-center theo grant xác minh | Mở bảng CTF/Custom và từng trận; Broadcast Admin có surface chuẩn bị phát sóng, không điều khiển kết quả | Không assignment/decision/rollback/extension mặc định | Persisted role/capability mapping vẫn chờ G1; không suy từ tên chức danh |

`STAFF`, `SUPPORT_AGENT`, `Observer`, `Broadcast Admin` không tự trở thành persisted global role. G1 xác định grant mapping thật. Role switch trong prototype là điều khiển review ngoài sản phẩm.

## Mapping đầy đủ F01–F82

Ký hiệu: **UI** = interactive representative trong prototype; **Handoff** = thiết kế/DTO hoặc component của owner kế tiếp, không claim implementation. Không phải toàn bộ field đều bắt nhập ở P02. `D` draft tối thiểu, `S` trước submit, `P` sau duyệt, `Auto` server-owned. Các nhóm dưới đây giữ từng ID để kiểm đủ82 trường; không đồng nghĩa82 field đã code.

| Field | Surface/giai đoạn | Hành vi/owner và giới hạn proof |
|---|---|---|
| F01 | P02 bước1 / D | UI chọn contract mẫu; binding/quota Long G1 |
| F02 | P02 bước1 / D | UI tên3–120 và lỗi; Sơn |
| F03 | P02 / S | Handoff slug unique, immutable ID; server Long |
| F04 | P02 / optional | Handoff plain-text description bounded; Sơn |
| F05 | P02 / S | Handoff organizer theo contract, không arbitrary unit; Long |
| F06 | Auto | Trusted owner từ session; không input; Đức/Long |
| F07 | P02 bước1 / S | UI PRIVATE/PUBLIC/UNLISTED; không enrollment grant |
| F08 | P02 confirm / Auto | ARENA một stage, không form multi-stage |
| F09 | P02 bước1 / S | UI chỉ cho HUMAN_ONLY (Người đấu Người) hoặc BOT_ONLY (Bot đấu Bot); không có Hybrid, controller ghim, không hot-switch |
| F10 | P02 / S | Handoff expected≤max; Sơn |
| F11 | P02 bước1 / S | UI max1..4000 mẫu, cap thật contract; Long |
| F12 | P02 / S | Handoff allowed unit IDs từ contract, không mở toàn hệ thống |
| F13 | Handoff / optional | Group chooser deferred; direct unit IDs đủ |
| F14 | Handoff / optional | Banner optional, không block submit |
| F15 | P02 bước2 / S | Handoff time model FIXED/MULTIDAY; không tạo stage |
| F16 | P02 bước2 / S | UI zone Asia/Ho_Chi_Minh; production IANA/instant Long |
| F17 | P02 bước2 / S | UI roster open<close≤start |
| F18 | P02 bước2 / S | UI start<end; contract duration/cap validation handoff |
| F19 | Handoff / optional | Daily windows advanced UI deferred |
| F20 | Auto / optional | Slot booking chỉ khi scheduler thật; không input giả |
| F21 | Handoff / optional | Maintenance trong comparison nguồn Long |
| F22 | P02 bước3 / S | Handoff match/day/total caps preset bounded |
| F23 | P02 RuleEditor / optional | Template selection Nam, không fake engine validation |
| F24 | P02 bước3 / S | UI rows/cols5..15, bàn vuông không bắt buộc |
| F25 | P04 embedded / S | Handoff counts side/type khớp layout, Nam |
| F26 | P04 embedded / S | Handoff layout bounds/overlap; mini-board chỉ minh họa |
| F27 | P04 embedded / S | Handoff same movement toggle, normalized explicit hai bên |
| F28 | P04 embedded / S | Handoff RAY/LEAP union, Nam |
| F29 | P04 embedded / conditional | Handoff directions relative/absolute theo N00 |
| F30 | P04 embedded / conditional | Handoff ray finite min/max, Nam |
| F31 | P04 embedded / conditional | Handoff jump chỉ RAY; LEAP không toggle mâu thuẫn |
| F32 | P04 embedded / conditional | Handoff finite offsets nonzero; caps G1 |
| F33 | Auto | Capture fixed R>S/P>R/S>P; không builder |
| F34 | P02 bước3 / S | UI bật/tắt goal; extinction builder chi tiết Nam; OR theo N00 |
| F35 | P04 embedded / S,P | Preview phải engine thật khi production; prototype không proof |
| F36 | P02 bước3 / conditional | UI STATIC/CYCLE/SEEDED theo goal enabled |
| F37 | P02 bước3 / conditional | UI ô mẫu có bounds, không proof initial own-goal |
| F38 | P04 embedded / conditional | Handoff ordered finite cycle; mẫu1ô không full editor |
| F39 | P04 embedded / conditional | Handoff candidate set/seed streams, Nam |
| F40 | P02 bước3 / conditional | UI interval positive; bound100 là fixture proposal G1 |
| F41 | Auto / S | Server versioned seed; không private runtime seed |
| F42 | Auto | Goal tới quân không auto-win, không toggle |
| F43 | P04 embedded / S | Handoff first-move preset theo N00 |
| F44 | P04 embedded / S | Handoff side assignment policy, pinned match |
| F45 | P02 bước3 / S | Handoff clock registry/caps; không compute==think |
| F46 | P04 embedded / optional | Handoff plies even/finite theo mode, Nam |
| F47 | P04 embedded / S | Handoff event resolution N00; không formula script |
| F48 | P02 bước3 / S | Handoff reconnect/abandon profile; resume không clear unrelated blocker |
| F49 | P15/P16 / conditional | Runtime profile verified, không native Python |
| F50 | P02 bước3 / conditional | UI cpu mẫu≤500; memory/file/libs registry handoff, không runtime proof |
| F51 | P04/P16 / conditional | Handoff per-side hard compute; không charge queue/bootstrap |
| F52 | P16 / conditional | Handoff SECURITY+COMPATIBILITY receipts, không admin tick |
| F53 | Handoff / optional | Bot quotas bounded enforced server, không cap vô hạn |
| F54 | Auto / optional | N00 đã chọn false; không hot-switch editor |
| F55 | P02 summary / S | Fixed approved weighted scoring, không formula editor |
| F56 | Auto / S | N00 override: tất cả tournament Elo1000; không compression UI |
| F57 | P02 summary / S | Approved pairing preset, caps Long; không scheduler proof |
| F58 | Auto | N00 override: không ghi ngược system rating |
| F59 | P03 / S | Handoff finalization khi result/case/recompute settle |
| F60 | Handoff / optional | Ranking order theo N00; advanced review controls deferred |
| F61 | Runtime / optional | TopN không bắt tạo giải; không xây dashboard TopN ở S00 |
| F62 | P03 / P | UI “trọng tài đã sẵn sàng” theo ngưỡng cấu hình; Observer/Broadcast Admin là grant xem riêng, không phải điều kiện staff |
| F63 | P02 bước3 / S | UI regulations/ACK; versioned reACK handoff Đức/Long |
| F64 | Auto / S | N00 tên thi đấu+đơn vị; không email/student ID |
| F65 | P03 / S | Visibility không cấp Observer/Broadcast Admin grant; match-center và kênh phát sóng lọc theo ACL |
| F66 | Auto | N00 90days FINALIZED/cancel, không editable TTL |
| F67 | Auto | Server IDs/status/timestamps, không form editable |
| F68 | Auto | Immutable rule/config/schema versions server |
| F69 | P04 publish | Reason/effective_at cho đổi luật; không ép create reason giả |
| F70 | P03/P14 | Handoff approved envelope/safe audit; append-only |
| F71 | P03/P15/P16 | Status theo target receipt thật; fixture label rõ |
| F72 | P10/P13 / P | Handoff Đức; không nhét activation/token vào P02 |
| F73 | P04 embedded / S | Draw default false theo N00 |
| F74 | P04 embedded / conditional | Weights material khác BXH; Nam |
| F75 | P04 embedded / conditional | Lexicographic comparator Nam; không score UI tự tính |
| F76 | P04 embedded / conditional | Actual first/second mover; không hardcoded RED |
| F77 | Điều lệ / conditional | Luật đầy đủ công bố, không secret policy |
| F78 | P04/P05 | Preview metrics Nam; snapshot source authority |
| F79 | P03 exact-tie/P05 | Handoff deadline300s mẫu server-time, bounded fallback |
| F80 | P03 exact-tie/P05 | First/second fallback, không MANUAL loop |
| F81 | P03 exact-tie/P05 | TA owner only; referee incident khác authority |
| F82 | P03/P05/P14 | Reason/deadline/fallback/audit; chưa settle không finalize |

## Shared components và error contract

Header/nav → capability-filtered loader; PageBoundary → loading/empty/error/forbidden/expired; ControlledField → id/label/required/error path; LeaveDialog → focus trap/Escape/return; SidePanel → nonmodal, focus heading, Escape về opener; ServerCards/ServerTable → bounded query/cursor; AsyncAction → revision/idempotency/ACK.

Prototype dùng local state để review từng nhánh. Production dùng scoped cache clear khi actor/context đổi, response version matching và server ACL. `VERSION_CONFLICT` không silent overwrite; `NETWORK_ERROR` giữ draft; `RUNTIME_UNAVAILABLE` neutral blocked; `FINALIZED_LOCKED` chỉ xem. Không suy event JS click thành quyền thật.
