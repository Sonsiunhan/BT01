# N00 — Rà yêu cầu và thiết kế trước G0

Ngày: 21/10/2026, UTC+7. Revision 6: Nam đã trả lời8nhóm; referee quyết ngay/TA rollback và giải không chờ thí sinh. **Nguồn quyết định mới nhất: [N00-DECISIONS-2026-10-21.md](N00-DECISIONS-2026-10-21.md)**, ưu tiên hơn mọi dòng pending/đề xuất lịch sử dưới đây. **IN PROGRESS — G0 HOLD**.

Update cuối vòng này: Nam đã chọn A cho cả ba câu bổ sung. Referee quyết case sự cố, MANUAL exact-tie vẫn TA; rollback trước FINALIZED, không rewinding lịch sử; cancel giữ settled/neutral-close pending, pause10phút/lần và30phút/trận rồi neutral-abort nếu chưa tiếp tục. Decision record revision2 có detector matrix và AC đã đồng bộ. Chờ re-review93 đúng hash, không còn hỏi lại các nhóm đã chốt.

## Phạm vi và quyền ghi

N00 tạo hồ sơ yêu cầu, wireframe và đề xuất Rule/Resolution DTO; chưa code app, chưa sửa contracts/schema/router, chưa chạy DB/runtime, chưa lập implementation plan mới. Root sở hữu file này và `N00-UI-DTO-DRAFT.md`; reviewer chỉ sở hữu `support/N00-INDEPENDENT-REVIEW-2026-10-21.md`.

Nguồn: AGENTS.md, WORKING-AGREEMENT của Nam, đặc tả canonical ngày 20/10, DELIVERY-PLAN/CSV và toàn bộ hội thoại sẵn có. Skill đã đọc/áp dụng: `ecc:intent-driven-development`, review đặc tả có sẵn, phát hiện quyết định còn mở, ghi AC quan sát được. Reviewer phải dùng ECC độc lập.

Lịch 5 ngày tới 25/10 được đề xuất trong chat để điều phối, chưa được chuyển thành lịch chính thức; câu “Okay, bắt đầu thực thi N00” cho phép thực hiện N00, không được diễn giải là duyệt mọi default hay mọi hạn mới.

## Baseline source quan sát trực tiếp

HEAD: `c10d67f8025acedd18d38459aee434499e4bc6f0`. Đây là checkout `D:/BT01`; không đại diện mọi worktree hoặc môi trường đang deploy.

| Vùng | Bằng chứng | Chênh lệch với scope giải |
|---|---|---|
| Coordinates | packages/game-rules/src/types.ts, coordinates.ts: a..i, 1..9, regex a-i/1-9 | Chưa biểu diễn bàn 5..15/custom rectangle |
| Engine | packages/game-rules/src/engine.ts: isOneStep, fixed GOAL_COORDINATES, extinction/goal luôn bật | Chưa có movement per type/side, goal schedule và win-condition toggle |
| Comparator | packages/bot-sdk/src/scorer.ts: N/P/M cố định, distance Chebyshev, exact tie RED, full round theo currentTurn BLUE | Chưa có weights/custom graph/final policy theo actual first assignment |
| SDK | packages/bot-sdk/src/types.ts: state có board/legalMoves/history/clock, chưa có dimensions/goals/ruleset profile | Không được tuyên bố đã tương thích luật mới |
| Runtime | wasmtime.adapter.ts và config/bot-runtime.ts có provider hash pin, bounds và trusted adapter; bot-online.service.ts dựng old ABI | Có nền runtime, chưa chứng minh new-rule/hard-total-compute hoặc Human–Python consumer bằng execution |
| Web/server/schema | router.tsx hiện các trang game/Bot; tìm tournament/SYSTEM_ADMIN/TOURNAMENT_ADMIN trên server/contracts/schema không tìm được module tương ứng (trừ old bot adjudication) | Tên trang/entity trong đặc tả chưa chứng minh implementation tồn tại |

Dirty baseline đã có AGENTS.md, harness/w2-disposable-db.mjs cùng nhiều tài liệu untracked và `.worktrees/`; không reset/clean/sửa các thay đổi đó.

## Quyết định và điểm còn mở

Chỉ phản hồi human thực sự nhận được mới được đánh dấu duyệt. Không suy ra chấp thuận từ option mặc định hoặc hết thời gian.

| ID | Nội dung | Trạng thái |
|---|---|---|
| D01 | Movement: RAY 8 hướng + LEAP hữu hạn, union type+side; cap candidate16 patterns/225 offsets; win OR; khi bật EXTINCTION mỗi bên có cả3type>0 ban đầu; initial legal move/reachability; initial goal/seed filtering/no auto-win | **APPROVED**: Nam trả lời nhóm1 A ngày21/10; cap vẫn cần đo, không runtime PASS; câu hỏi này chưa xác nhận extinction là hết một type hay hết tổng quân |
| D02 | Weighted material→goal distance nếu bật goal→mobility; weights chung0..1000/3decimals/không cùng0; no legal move mặc định compare, own-turn violation mặc định LOSS, infra không author loss; draw=false mặc định nhưng TA bật cho sự kiện được phép; exact-tie mặc định SECOND_MOVER_WINS theo actual assignment, TA có thể cấu hình MANUAL | **APPROVED**: Nam trả lời “2A 3A” ngày21/10, chọn2A; không diễn giải thành mặc định MANUAL |
| D03 | BLUE_FIRST mặc định, ALTERNATE_BY_PAIR; Human bank180s/cap30s; Bot candidate preflight250ms/turn500ms/total30s mỗi bên/120plies/source64KiB/memoryJSON8KiB depth32/output16KiB/linearWASM64MiB; deadline>=reject, natural win→plylimit→goaltick, totalcompute hardstop midround, không charge queue/bootstrap | **APPROVED**: cùng phản hồi “2A 3A”, chọn3A; runtime profile chỉ bật khi consumer chứng minh enforce; chưa là runtime proof hoặc total RSS cap |
| D04 | HYBRID controllers pinned, in-match switch false | APPROVED4.2A |
| D05 | ACK/reACK trước new match; PRIVATE/UNLISTED staff+enrolled, PUBLIC logged-in, tên thi đấu+đơn vị | APPROVED5A; thay default STAFF_ONLY trước |
| D06 | Contract total đếm enrollment, withdraw/reactivate cùng đăng ký không hoàn/tăng suất | APPROVED6.1A; envelope kỹ thuật hữu hạn theo contract |
| D07 | Cancel trướcENDED giữ settled/neutral-close pending, pause10phút/lần30phút/trận quáhạn neutralabort/noautoresume; MANUAL vẫn TA | APPROVED câu bổ sung A, deadline/race canonical transaction |
| D08 | Activation24h/reset30m/staging24h/upload và support caps | APPROVED6.2A; caps cần đo/enforce trước hỗ trợ |
| D09 | Weighted score10*m/-5/m, Elo giải1000 cho mọi người/K32/400, band100+50/30s/rematch3day, không globalwrite/compression | APPROVED7.1A/7.2A, xem decision record |
| D10 | finish_sequence/replay/TopN và earlierReached | APPROVED7.3A, xem định nghĩa chính xác ở decision record |
| D11 | Audit365days từeventAt, ACL/identity mapping, BotTTLriêng | APPROVED8.2A; không tự chứng nhận pháp lí/compliance |
| D12 | Relative BLUE vector gốc/RED rotate180 cả2trục; EXTINCTION khi mất hết một loại R/P/S | **APPROVED** Nam trả lời4A; đóng phần extinction semantics củaD17 |
| D13 | end_at/gia hạn theo TA request→SA duyệt trướcend_at+công cụso lịch; end_at dừngnewmatch,startedmatchdrain | APPROVED3.1A/3.2A; nohold/noreset/no reopen quaextension |
| D14 | UNLISTED khôngpublicsearch/list, staff/enrolled scopedview | APPROVED5A |
| D15 | earlierReached từcanonicalreplay; mọiEloinit1000 khôngcompression | APPROVED7.2A/7.3A; không tiếp tục hỏicompression |
| D16 | Thi tự động, incident notice trên dashboard, TA bấm trận gợi ý referee available và gán quyền xử lí ngay trong quản lí giải | **HUMAN DIRECTION CONFIRMED**, không1ref/trận; gate referee đã chốtD21, pauseD18; roster≥2eligible/HYBRID và quyền verdict còn mở |
| D17 | Data90days từFINALIZED hoặcCANCELLED commit; archivekhôngreset/multirefsprotected | APPROVED8.1A |
| D18 | Player gửi yêu cầu pause, TA/referee xác nhận mới dừng | **APPROVED** Nam chọn5.2A; không tự pause từ request |
| D19 | Gia hạn cộng dồn tối đa2giờ/giải, trong hợp đồng/capacity, SA được duyệt một phần | **APPROVED** Nam chọn6.1A |
| D20 | Trận hết giờ phân xử thắng/thua ngay theo luật; không freeze15phút chờ extension | **HUMAN CORRECTION CONFIRMED** ưu tiên hơn6.2A được root mô tả; không coi chữ6.2A là duyệt hold15phút. Grant giải không hồi sinh trận đã kết thúc |
| D21 | TA cấu hình có/không trọng tài; nếu có, TA đặt minimum và đủ referee hợp lệ đồng thờiONLINE+READY mới được bắt đầu giải; sau khi đã chạy, tụt minimum không pause/trì hoãn/dừng giải hoặc admission chỉ do thiếuref | **APPROVED bằng chỉ đạo human mới**, thay5.1A/B cũ. ONLINE/READY khác assignment availability; không cần1ref/trận |
| D22 | Referee quyết case ngay; MANUAL exact-tie TA-only; TA rollback trướcFINALIZED bằng lịch sử bù/replay, không rewindboard/trận hoặc tựvoidpastmatches khi disqualify | APPROVED1A có sửa và hai câu bổ sungA, xem decisionrecordrevision2 |
| D23 | Giải đếnstart_at chạy khôngchờthísinh;0/1eligible thì idle, per-match vẫnkiểm2eligible | APPROVED4.1 có sửa; giữtechnical/refereegate |

5.1A/B cũ bị thay bởiD21; không hỏi lại pool minimum như lựa chọn chưa chốt. Min count doTA đặt, server đếm distinct referee accepted/grant còn hiệu lực, đồng thờiONLINE+READY tại transaction bắt đầu. Không áp minimum vào từng trận sau khi giải đã chạy. Resume một giải đã bắt đầu không được dùng minimum này như blocker mới.

Toàn bộ mục15 canonical còn mang nhãn chưa duyệt. Hồ sơ này ghi duyệt từng phần; chưa đổi nhãn cả mục, chưa thay default trong code.

## MCQ chuẩn bị cũ — LỊCH SỬ, không dùng hỏi lại

Những lựa chọn hiện hành của toàn bộ8nhóm đã ghi trong N00-DECISIONS-2026-10-21.md. Bảng Q04–Q10 sau chỉ giữ lịch sử đề xuất; các default pool/roster/visibility/Elo/TTL cũ bị thay nơi có quyết định mới. Không dùng bảng này để mở lại các câu đã chốt.

| Câu | A — khuyến nghị | B — lựa chọn khác cần Nam nêu |
|---|---|---|
| Q04 Relative + extinction | Relative BLUE dùng vector gốc, RED rotate180 (đảo cả dx/dy), không phụ thuộc UI orientation; absolute không đổi. EXTINCTION là đối thủ hết **một** loại R/P/S (giữ semantics canonical cũ) | Mirror riêng trục hoặc extinction hết tổng quân; nêu rõ semantics muốn đổi |
| Q05 READY/HYBRID | Cần≥2 enrollment eligible và≥1 Referee accepted; config/runtime hệ thống phải đạt. Enrollment chưa claim/ACK/receipt bị chặn cá nhân, không khóa cả giải nếu đủ2eligible; mọi create match recheck. HYBRID hỗ trợ H–H/H–Bot/Bot–Bot, controller pinned, switch=false bản đầu; chung BXH có nhãn | READY bắt toàn roster cùng đạt, hoặc ngưỡng/ghép controller khác |
| Q06 end_at/cancel/manual | end_at là hard deadline gameplay: server time>=end_at không commit move/output mới, khóa tại committed snapshot, dùng comparator/finaltie đã pin (có thể tạo MANUAL), ENDED không admission; request manual vẫn chạy tới deadline rồi fallback, không finalize khi pending. CANCEL chỉ trước ENDED: giữ settled, neutral-abort gameplay/pending; CAS ai commit trước quyết định, không xóa result đã commit | Chặn trận mới rồi drain trận cũ có deadline hữu hạn, hoặc neutral-abort tại end_at; cần chọn rõ một policy |
| Q07 visibility/ACK | PRIVATE+STAFF_ONLY default; PUBLIC+LOGGED_IN default; UNLISTED không xuất hiện public list/search, xem STAFF_ONLY default, có thể ROSTER_ONLY trong scope hỗ trợ; biết URL không cấp quyền. Identity NAME_UNIT_MASKED, ACK=true và re-ACK trước new match, old match giữ pin | UNLISTED cho logged-in xem hoặc thay default/ACK; nêu phạm vi payload |
| Q08 quota/upload/token | Total participants đếm tổng enrollment qua các giải contract; unique(tournament,account), withdraw/reactivate cùng enrollment không hoàn/tăng suất, giải khác tính suất mới; retention không reset counter. Envelope SA thu hẹp board/movement/goal/win/control/resources/dates/units. Reject file password; raw cleanup ngay sau parse/error, staging24h; cap candidate10MiB/expanded50MiB/20krows/batch200 phải đo; activation24h/reset30phút, support10/account/day + public anti-enumeration/rate-limit port; evidence support90days sau xử lí | Đếm account duy nhất hoặc hoàn suất khi withdraw, TTL/cap khác; cần chốt từng điểm |
| Q09 score/Elo/TopN | Duyệt nguyên formula/caps/rounding registry ELO_WEIGHTED_V1 mục15, default10/5/0, floor0, Elo1000/K32/scale400, band100+50/30s đến SA cap/rematch3/day/affects_system_rating=false. Compression đề xuất round-half-away-from-zero(1000+factor*(systemRating-1000)), factor0..1. Replay theo finish_sequence; earlier-reached là finish_sequence đầu của lần đạt score hiện tại mà từ đó chưa tụt dưới score đó trong ledger replay; khởi tạo sequence0, replay dựng lại toàn bộ. TopN score↓Elo↓wins↓earlierReached↑participantId↑, đủ đúngNeligible | Công thức/định nghĩa khác; không dùng thời điểm TA trả verdict hoặc thời gian refresh UI |
| Q10 retention/audit | 90days dữ liệu giải tính từ terminalGameplayAt: ENDED tại end_at/thời điểm kết thúc sớm hợp lệ hoặc CANCELLED tại commit; không reset bởi review/archive. Pending settlement/recompute tạo hold có ACL và cảnh báo, chỉ xóa khi settle xong và đã quá TTL; không xóa tham chiếu giải khác. Audit tách TTL giải, không auto-delete cùng90days; identity mapping có ACL, policy xóa/anonymize riêng cần chủ hệ thống xác định trước deploy. Bot/source/log giữ TTL riêng đã duyệt | TTL tính từ FINALIZED/ARCHIVED hoặc policy audit khác; nêu rõ giới hạn hold và lịch xóa muốn áp dụng |

Q09 phải xác nhận liệu định nghĩa earlier-reached ưu tiên tốc độ đạt **điểm hiện tại** là đúng ý định; không biến timestamp server của verdict trễ thành lợi thế. Q10 không phải khẳng định tuân thủ pháp luật; nghĩa vụ của môi trường thật chưa được đánh giá trong N00. Tham số thuần kỹ thuật (PRNG version/finite parser caps/profile RSS supervisor) được writer chốt có version và harness trước consumer/dev phụ thuộc; không hứa số đo hoặc bỏ runtime gate.

## Nghiệm thu N00

| ID | Actor/điều kiện → hành động → đầu ra quan sát được | Điều cấm | Verification / trạng thái |
|---|---|---|---|
| N00-AC01 | Nam bắt đầu N00 → đối chiếu hội thoại/docs/source → có baseline, scope và gaps có nguồn | Không lấy tài liệu làm bằng chứng code đã có | Kiểm source ở bảng baseline; PASS cho phạm vi đã ghi |
| N00-AC02 | Có quyết định chưa chốt → hỏi MCQ với khuyến nghị → ghi chính xác lựa chọn human và tác động | Không biến “bắt đầu”/im lặng thành phê duyệt | Decision table + hội thoại; IN PROGRESS |
| N00-AC03 | TA được phép mở P04 → thiết kế đầy đủ builder/preview/diff/publish và failure states | Không cho script, không áp ngược old match hoặc ghi quyền từ URL | N00-UI-DTO-DRAFT.md; DRAFT |
| N00-AC04 | TA owner có exact tie pending → thiết kế list→frozen match→winner+reason, deadline/conflict/fallback | Không thay natural winner, không player role/SA override, không double result | Wireframe + Resolution proposal; DRAFT |
| N00-AC05 | Actor có quyền mở P16 → thấy Bot/version/receipt status và retry rõ | Không source/log/memory/private diagnostic; infra không thành author loss | Wireframe + readiness DTO proposal; DRAFT |
| N00-AC06 | Cần payload chia sẻ → mô tả proposed DTO với version/ACL/error/idempotency và writer Long | Không sửa shared contracts/schema/app composition trước G1 | Proposal review; DRAFT |
| N00-AC07 | Reviewer độc lập đọc đúng snapshot → chấm T001–T081 + IE01–IE12 =93 mục, raw counts, gaps severity, hash → có report | Không dùng coverage cũ hoặc tự chấm PASS thay reviewer | support/N00-INDEPENDENT-REVIEW-2026-10-21.md; IN PROGRESS |
| N00-AC08 | Các quyết định bắt buộc được chốt, mọi required AC quan sát được, coverage≥99% và không gap P0/P1 → G0 PASS; nếu thiếu → HOLD | Không mở N01 hoặc clock thực thi chỉ vì deadline | Gate record; HOLD |

Checklist G0 **revision2** giữ T001–T081 và thêm **IE01–IE12** ở supplement: **93 mục**, cần93/93 để≥99%. Công bố mở rộng vì human bổ sung automatic operation/incidents/extension, không dùng81/81 chứng nhận scope mới. Reviewer ghi subgaps và hash; không âm thầm đổi mẫu số hoặc gạt yêu cầu ngoài checklist để đạt điểm.

Coverage là độ đầy đủ đặc tả, không an toàn/correctness/implementation completion. Mọi test engine/runtime/browser/load vẫn NOT RUN trong N00; đo thực và isolated runtime là gate riêng sau yêu cầu.

Reviewer baseline độc lập revision1: 47 covered, 34 partial, 0 open /81 (58,02%), G0 HOLD, không P0 nhưng còn P1 requirement gaps. Số này gắn baseline canonical, chưa phải kết quả re-review sau quyết định nhóm1 hay sau chỉnh draft; không kế thừa65/16 của lần review lịch sử.

## Đường tiếp tục

Các semantic choices đã chốt; UI/DTO hiện có delta cập nhật và detector matrix trong decision record. Independent re-review93IDs đúng snapshot đang chờ kết quả; không hỏi lại8nhóm/3câu bổ sung. Coverage47/34 chỉ baseline81 cũ. Capacity/effort là scenario forecast chưa đo, không implementation plan hoặc lịch cam kết. Không viết lịch/Wave implementation mới trước G0.
