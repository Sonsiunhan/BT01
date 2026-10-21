# N00 — Review yêu cầu độc lập

**Kết luận hiện hành: G0 PASS — REQUIREMENTS ONLY, 93/93 covered, 0 partial, 0 open; không P0/P1 requirement gap còn mở trong scope đã công bố.** Xem phần FINAL cuối report để lấy đúng hashes. Các vòng HOLD/counts bên dưới giữ làm lịch sử, không là trạng thái hiện hành.

Ngày: 21/10/2026 (UTC+7). Reviewer: `/root/n00_requirements_review`.

**G0: HOLD. Covered 47/81 (58.02%); PARTIAL 34/81; OPEN 0/81.** Không tính partial là covered; với checklist 81 cần 81/81 mới đạt ≥99%. Đây là coverage đặc tả, không là độ an toàn hay implementation completion.

## Phạm vi và thẩm quyền

Đã đọc AGENTS.md, WORKING-AGREEMENT.md của Nam và skill `ecc:intent-driven-development`; áp dụng Existing Specification Review: kiểm actor/condition/action/observable outcome/prohibited effect/verification trên toàn checklist ổn định T001–T081, F01–F82, BR01–BR42 và mục15. Không thu hẹp chỉ mảng Nam. User chỉ yêu cầu bắt đầu N00; không coi đó là duyệt toàn bộ defaults hoặc lịch25/10. Lịch mới trong chat là đề xuất, file candidate V2 còn hiện hành.

Chỉ sở hữu report này. Không sửa app, canonical, contracts/schema/router, dữ liệu/production; không tạo worker code hoặc liên lạc thành viên. Review baseline độc lập, không kế thừa số65/16 trong SPEC-REVIEW.json. Các đề xuất đã viết rõ nhưng chưa được human duyệt vẫn PARTIAL khi ảnh hưởng acceptance.

## Snapshot đã đọc

- Git HEAD: `c10d67f8025acedd18d38459aee434499e4bc6f0` (working tree có thay đổi sẵn; HEAD không thay cho hash file).
- Canonical `OTTv2_Dac_Ta_BA_SA_Khoi_Tao_Giai_v1.0.md`: SHA256 `A0DD4B1CF905B89DD98C14775EC193972078D0CFC8F40F43EF666A777A269448`.
- `DELIVERY-PLAN.md`: SHA256 `45AE27DCF4192CB52B0D0EC707E4BA6F1B703B67FE8368B7C9E40032A17A27FF`.
- `DELIVERY-TASKS.csv`: SHA256 `A0CC0F3698DF24FAA174A7FEA9831ED5A0F756E8251D8D84FCFF54A5D8DE83F8`.
- Đã đọc README, SPEC-REVIEW.json, DELIVERY-PLAN và55 dòng task CSV; source rules/types/coordinates/engine, SDK/types/scorer/state, Prisma User và các điểm contract/referee hiện hành. Đọc source là đối chiếu baseline, không chạy app test/runtime.

## Gap cần chốt

| Gap | Mức | Cần quyết định/bổ sung quan sát được |
|---|---|---|
| G01 | P1 | Duyệt total enrollment counting, allowance/refund khi withdraw/reimport và envelope bản đầu; không tự nhân quota theo TA. |
| G02 | P1 | Chốt min eligible roster và tập dùng để aggregate READY. Người chưa claim/chưaACK/receipt thiếu bị chặn riêng hay làm cả giải khôngREADY? Không suy từ expected_participants. |
| G03 | P1 | Duyệt cancel allowed states, pending neutral-close, settled giữ nguyên; xác định deadline manual vẫn chạy qua pause/end/restart, race theo CAS. |
| G04 | P1 | Khi tournament end_at tới với gameplay đang chạy: dừng tại snapshot nào, verdict theo comparator hay neutral abort, move/invocation race. Không chỉ đổi status giải rồi để mỗi consumer tự hiểu. |
| G05 | P1 | Chốt upload/token/staging/support policy đề xuất; cap kỹ thuật phải đo, không hứa20k rows hay10MiB đã enforce. |
| G06 | P1 | Chốt scope RAY8/LEAP finite union, cap pattern/offset; unsupported reject. |
| G07 | P1 | Định nghĩa hệ relative (ví dụ RED rotate180 cả hai trục), để engine/UI/SDK có golden expected vector. |
| G08 | P1 | Chốt win OR, extinction một type=0 hay tổng0, initial terminal/legal-move/reachability rules; baseline source đang dùng một type=0. |
| G09 | P1 | Chốt STATIC/CYCLE/SEEDED initial/repeat/own-piece filtering. Thuật toán PRNG và version cần pin trước consumers; không dùng secret runtime seed công khai. |
| G10 | P1 | Duyệt event defaults/priority, compute hard-stop và giao điểm clock/end_at/goal tick/ply limit; lỗi infra không author loss. |
| G11 | P1 | Duyệt exact arithmetic/weights/graph distance/mobility/final tie baseline; không cố định RED nếu RED đi trước. |
| G12 | P1 | Duyệt HYBRID/controller policy và switch=false cho scope bản đầu; không im lặng giảm ba loại pairing. |
| G13 | P1 | Chốt Bot caps dưới dạng candidate profile, phát hành chỉ khi consumer proof; total memory/RSS khác linear memory phải có giới hạn thực. |
| G14 | P1 | Chốt ACK trước new match, privacy defaults; bổ sung UNLISTED view/list/spectator scope để URL không tự mở quyền. |
| G15 | P1 | Duyệt score/Elo/pairing registry; compression cần công thức và rounding, score/Elo before từ replay phải rõ. |
| G16 | P1 | Duyệt finish order/TopN, định nghĩa earlier-reached khi score giảm/tăng lại hoặc replay verdict trễ. |
| G17 | P1 | Chọn mốc TTL90days, event nào khởi động, có đổi sau review/archive/cancel không; bảo toàn multi-reference. |
| G18 | P2 | Audit retention riêng, identity mapping/anonymization có policy của môi trường; không tự tuyên bố compliance. |

P0 phát hiện:0. Các gap P1 là yêu cầu chưa quyết định/thiếu semantics, không phải kết luận source có exploit. Các tham số thuần kỹ thuật (PRNG algorithm, timeout bounds, parser caps) có thể chốt thành contract có version do writer trước dev, nhưng không được thay đổi ý nghĩa nghiệp vụ chưa được Nam chốt.

## Checklist cố định81 mục

COVERED nghĩa có actor/trigger/expected/prohibition/verification đủ ở mức đặc tả hiện hành, chưa phải code PASS. PARTIAL có phần rõ nhưng vướng gap/policy chưa duyệt. OPEN chỉ dùng nếu không có mô tả; lần này0.

| ID | Review | Cơ sở hoặc phần thiếu |
|---|---|---|
| T001 | COVERED | §3/4/7.2/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T002 | COVERED | §3/4/7.2/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T003 | COVERED | §3/4/7.2/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T004 | COVERED | §3/4/7.2/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T005 | COVERED | §3/4/7.2/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T006 | COVERED | §3/4/7.2/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T007 | COVERED | §3/4/7.2/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T008 | COVERED | §3/4/7.2/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T009 | COVERED | §3/4/7.2/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T010 | COVERED | §3/4/7.2/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T011 | COVERED | §7.1/7.3A/8; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T012 | COVERED | §7.1/7.3A/8; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T013 | COVERED | §7.1/7.3A/8; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T014 | COVERED | §7.1/7.3A/8; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T015 | COVERED | §7.1/7.3A/8; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T016 | PARTIAL | G01: Chưa duyệt cách đếm tổng enrollment/cap hợp đồng ở mục 15. |
| T017 | PARTIAL | G01: Envelope/capability cụ thể còn đề xuất ở mục 15. |
| T018 | COVERED | §7.1/7.3A/8; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T019 | COVERED | §7.1/7.3A/8; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T020 | COVERED | §7.1/7.3A/8; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T021 | COVERED | §5/6/7.4/10.6; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T022 | COVERED | §5/6/7.4/10.6; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T023 | COVERED | §5/6/7.4/10.6; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T024 | COVERED | §5/6/7.4/10.6; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T025 | PARTIAL | G02: Chưa định nghĩa số roster tối thiểu và READY cần mọi enrollment hay tập eligible; activation/ACK/receipt phải có cùng tập mục tiêu. |
| T026 | COVERED | §5/6/7.4/10.6; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T027 | PARTIAL | G03: Policy pause/cancel ảnh hưởng pending manual còn chờ duyệt mục 15. |
| T028 | PARTIAL | G04: Đã nói end_at dẫn ENDED nhưng thiếu cách settle gameplay đang chạy tại deadline. |
| T029 | PARTIAL | G03: Cancel pending/gameplay/result race là policy chưa duyệt. |
| T030 | PARTIAL | G04: Thiếu explicit event/action với gameplay đang chạy khi end_at; không rõ committed snapshot/result dùng thế nào. |
| T031 | COVERED | §7.2/7.5/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T032 | COVERED | §7.2/7.5/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T033 | COVERED | §7.2/7.5/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T034 | COVERED | §7.2/7.5/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T035 | COVERED | §7.2/7.5/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T036 | COVERED | §7.2/7.5/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T037 | PARTIAL | G05: TTL activation/rate-limit cụ thể còn chờ duyệt. |
| T038 | PARTIAL | G05: Atomic single-use rõ; TTL/reissue boundary cụ thể chưa duyệt. |
| T039 | COVERED | §7.2/7.5/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T040 | PARTIAL | G05: Upload/expanded/rows/staging TTL cap cần chốt và đo ở giai đoạn harness. |
| T041 | COVERED | §7.3C/10.2; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T042 | COVERED | §7.3C/10.2; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T043 | PARTIAL | G06: RAY/can_jump capability và caps còn đề xuất. |
| T044 | PARTIAL | G06: LEAP/union capability/caps còn đề xuất. |
| T045 | PARTIAL | G07: Relative direction chưa quy định phép biến đổi BLUE/RED (rotate180 hay phản chiếu trục). |
| T046 | COVERED | §7.3C/10.2; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T047 | PARTIAL | G06: Bounded pattern/offset/depth còn cần caps chuẩn hóa; không được coi payload candidate là đã duyệt. |
| T048 | PARTIAL | G08: OR, extinction và initial conditions còn chờ duyệt; cần ghi rõ extinction=zero một type theo baseline. |
| T049 | PARTIAL | G08: Empty-board reachability/initial legal moves validation còn chờ duyệt. |
| T050 | COVERED | §7.3C/10.2; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T051 | PARTIAL | G09: Initial sampling/lặp/CYCLE/PRNG version policy còn chờ duyệt; PRNG algorithm chọn và pin tại contract. |
| T052 | COVERED | §7.3D/E/I/10.4; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T053 | PARTIAL | G09: Occupied/shared goal không auto-win rõ; initial own-goal/SEEDED filtering còn chờ duyệt. |
| T054 | PARTIAL | G04/G10: Event order còn chờ duyệt; thiếu tournament end_at trong thứ tự commit. |
| T055 | PARTIAL | G10: NO_LEGAL_MOVE/global limit/own-turn violation event policies chưa duyệt. |
| T056 | PARTIAL | G11: Weights, scaled integer, lexicographic defaults còn chờ duyệt. |
| T057 | PARTIAL | G11: Movement graph distance/unreachable/mobility semantics còn chờ duyệt. |
| T058 | PARTIAL | G11: Actual assignment policy rõ nhưng baseline/default FIRST/SECOND/MANUAL còn cần quyết định gói comparator. |
| T059 | COVERED | §7.3D/E/I/10.4; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T060 | PARTIAL | G03/G10: CAS+now>=deadline rõ; manual deadline qua pause/end/cancel và fallback candidate chưa đóng. |
| T061 | COVERED | §7.6/10.3/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T062 | COVERED | §7.6/10.3/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T063 | COVERED | §7.6/10.3/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T064 | COVERED | §7.6/10.3/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T065 | PARTIAL | G12: HYBRID H-H/H-Bot/Bot-Bot/shared BXH policy chưa duyệt. |
| T066 | COVERED | §7.6/10.3/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T067 | COVERED | §7.6/10.3/12; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T068 | PARTIAL | G10/G13: Caps, hard-stop mid-round, committed snapshot, loại trừ queue/bootstrap còn thuộc đề xuất mục15. |
| T069 | PARTIAL | G12: SHOULD switch có boundary rõ nhưng mặc định false bản đầu chưa được human duyệt. |
| T070 | PARTIAL | G14: Re-ack version trước new match và giữ old match là đề xuất chưa duyệt. |
| T071 | COVERED | §7.3G/H/10.5/12/14; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T072 | PARTIAL | G15: Score/Elo/pairing preset chưa duyệt; compression0..1 thiếu công thức/rounding và earlier timing. |
| T073 | PARTIAL | G16: TopN deterministic order đề xuất; earlier-reached chưa định nghĩa timestamp/finish_sequence sau replay. |
| T074 | PARTIAL | G14: PRIVATE/PUBLIC defaults chưa duyệt; UNLISTED không có spectator policy mặc định. |
| T075 | COVERED | §7.3G/H/10.5/12/14; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T076 | PARTIAL | G17: Có90days nhưng thiếu mốc bắt đầu TTL và xử lý PAUSED/cancel/manual/recompute trong retention clock. |
| T077 | PARTIAL | G18: Append-only/anonymize rõ; audit retention không tự xóa90days còn chờ quyết định vận hành; không chứng nhận compliance. |
| T078 | COVERED | §7.3G/H/10.5/12/14; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T079 | COVERED | §7.3G/H/10.5/12/14; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T080 | COVERED | §7.3G/H/10.5/12/14; scenario/action/expected/prohibited effect và verification tại§16 đủ cho baseline requirement review. |
| T081 | PARTIAL | G15/G16: Finish_sequence+projection atomic có mô tả nhưng vẫn proposal; earlier-reached/replay values chưa đóng. |

## Đối chiếu source, không phải implementation review

- `packages/game-rules/src/types.ts` giới hạn File a..i/Rank1..9; `coordinates.ts` regex `^[a-i][1-9]$`, goal i9/a1. `engine.ts` isOneStep, extinction khi một type đối thủ0. Không thể lấy engine cũ làm proof board5..15/custom profiles.
- `packages/bot-sdk/src/types.ts` BotTurnState chưa có dimensions/movement/goals/ruleset version của giải. `scorer.ts` dùng distance Chebyshev/progress8, exact tie RED, full-round currentTurnBLUE. Chưa đạt yêu cầu actual-first assignment/custom graph/cadence; đây là N01–N10 work, không tăng coverage bằng code giả.
- Prisma User baseline không có tournament grant/enrollment models trong phần đã quan sát; REFEREE trong room/contracts hiện hành không tự là grant trọng tài giải. Cần Long/Đức sở hữu schema/principal changes theo bảng ownership.
- Wasmtime adapter tồn tại không chứng minh runtime luật mới hoặc Offline Người–Python Bot consumer đã chạy. Không chạy Python hoặc sandbox trong review này.

## Điều kiện đóng N00/G0

1. Human quyết các gói policy còn mở qua MCQ có khuyến nghị; ghi đúng bằng chứng trả lời, không suy từ 'bắt đầuN00'.
2. Canonical hoặc supplement được liên kết rõ bổ sung các semantics mới; wireframe P04/P05/P16 và Rule/Resolution DTO draft đủ success/loading/empty/error/forbidden/conflict/timeout/infra-unavailable.
3. Re-review đúng hash canonical+supplement hiện hành trên81IDs, đủ81covered, khôngP0/P1 chưa giải quyết. Nếu cần mở rộng checklist cho gap mới thì công bố revision/mẫu số trước, không đổi mẫu số để đạt điểm.
4. G0 PASS chỉ cho phép bước tiếp theo theo workflow; không chứng nhận integration/runtime/capacity và không cấp quyền push/deploy/sharedDB.

## Evidence và giới hạn

Commands read-only: Get-Content/Select-Object, Get-FileHash, git rev-parse HEAD, rg source/contracts/schema và inventory tests. App tests/runtime/DB/browser: **NOT RUN — requirements review only**. Không dùng lịch/giờ ước lượng thay kết quả gate. Chưa review artifact N00 mới của root; report bổ sung sau khi nhận snapshot.

## Supplemental review — hai draft N00 (21/10/2026)

Snapshot supplemental:

- `N00-ACCEPTANCE-BRIEF.md`: SHA256 `7E45D73808BF517AFF19FB785C66B263F6619C3EF8983754720A424C326F3D6C`.
- `N00-UI-DTO-DRAFT.md`: SHA256 `829EA283AB0EF151BEAD18D4DD399E74044E7CBC00AF2C6253C1DDEE2BA78215`.
- Canonical/plan/CSV hashes vẫn như baseline ở trên trong phạm vi bổ sung này.

Root đã cung cấp bằng chứng điều phối: human trả lời NHÓM1 A (movement/win/goal); nhóm2/3 còn pending. Không diễn giải thành duyệt toàn mục15, không tự duyệt G0 hay lịch25/10. Counts47/34/0 ở đầu report là **baseline trước trả lời nhóm1**, chưa phải con số final sau tổng hợp quyết định. Supplemental này không cộng covered khi còn phần phụ thuộc chưa duyệt hoặc thiếu raw câu hỏi và câu trả lời để kiểm full semantics; cần một re-review cuối có decision snapshot đầy đủ.

### D01 — kiểm nội dung quyết định được ghi

Bảng brief ghi RAY8+LEAP finite union theo type+side, candidate16patterns/225offsets; win OR; initial legal moves/reachability; initial goal/seed filtering/no auto-win. Các nội dung khớp phạm vi nhóm1 mà root cung cấp. Cần chỉnh câu rút gọn `extinction đủ3type` thành **khi bật EXTINCTION, mỗi bên phải có số lượng cả R/P/S >0 ban đầu**; đây là điều kiện initial, không phải định nghĩa event extinction và không đồng nghĩa phải ăn hết cả ba type để thắng. Semantics source hiện hành là đối thủ hết ít nhất một type; nếu raw MCQ không hỏi định nghĩa event này thì vẫn cần ghi nó thuộc preserved baseline hoặc hỏi lựa chọn, không gán cho câu trả lời mới.

Caps16/225 vẫn là candidate cần đo trước phát hành; D01 không tạo runtime proof. D01 không cho phép script/multi-segment/promotion/đa capture. Goal FILTER chỉ initial SEEDED own-occupied cells, không suy rộng thành loại ô có quân ở mọi lần tick hoặc auto-win.

### Đánh giá UI yêu cầu đã có

| Phần | Có trong draft | Còn thiếu/sửa |
|---|---|---|
| P04 | Builder bàn/quân/type+side, goal/result/preview/diff/publish; text alternative; keyboard/mobile/theme; loading/empty/forbidden/network/conflict | U01/U02/U04 bên dưới; chưa đồng nhất read-only action nếu actor chỉ có view |
| P05 | Durable list, frozen board, criteria, actual first/second, deadline, reason, CAS/idempotency, re-fetch conflict/offline | U03/U04; cancel/end policy còn human pending |
| P16 | Metadata/status/retry, Human N/A, infra neutral, source/log privacy, receipt versions | U05/U06; list/recheck authorization cần actor scope cụ thể |
| Contract ownership | Long contracts/schema/composition, Sơn router/style, Nam endpoint gọi canonical service | Phù hợp; chưa chỉnh shared files |
| Verification | Golden/runtime/DB/browser/engine-to-settlement ghi NOT RUN | Phù hợp, không coi wireframe là browser pass |

### Findings thiết kế kỹ thuật có thể sửa ngay

| ID | Mức | Finding và acceptance cần bổ sung |
|---|---|---|
| U01 | P1 | `RuleProfileDraft / RuleSnapshot` đang mô tả chung các required fields, trong khi DRAFT cần lưu cấu hình chưa hoàn tất. Tách partial editable draft, complete validated normalized profile và immutable snapshot. Chưa đủ S-fields phải lưu nháp được nhưng không submit/publish; không cast partial thành executable profile. |
| U02 | P1 | Publish request ghi `draft/profile ref` chưa ràng buộc rõ với payload đã preview. Server phải đọc payload phiên bản xác định, normalize/revalidate cấu trúc/envelope/version/caps tại transaction/commit và kiểm expectedRevision/hash; preview trước đó không cấp quyền hoặc bảo đảm snapshot còn hợp lệ. Retry dùng idempotency payload fingerprint; cùng key khác payload conflict thay vì lấy kết quả sai. |
| U03 | P1 | `DecisionResponse` mới có source MANUAL/TIMEOUT và winner/verdict ref, chưa biểu diễn pending request được neutral-close do CANCEL. Dùng discriminated status WAITING/SETTLED/CANCELLED với winner/verdict/points có ngữ nghĩa nullable/absent cho neutral; không tạo result thắng giả để thỏa schema. Infra neutral cũng không thành LOSS; semantics cancel cuối chờ human. |
| U04 | P1 | Preview stale-response chỉ gắn draftRevision chưa đủ nếu đổi giải hoặc base config nhưng cùng revision cục bộ. Gắn tournamentId/base config revision/profile digest/request generation; chỉ nhận response khớp toàn context. Resolution frozen snapshot có immutable ID+digest/version và board ref resolve bằng ACL; decision không cho client thay board/hash/deadline. |
| U05 | P1 | BotReadinessView chưa nói version nào là target (current effective, scheduled hay old pinned match). Tách target config/rule versions và effectiveAt; check lại authority tại create. Receipt cũ vẫn hợp lệ old match; không mark global stale chỉ vì publish version future. Recheck target/version race trả conflict hoặc job version cụ thể, không cập nhật nhầm status hiện hành. |
| U06 | P1 | P16 ghi 'actor có quyền' và server kiểm owner/scope nhưng chưa định nghĩa list/recheck theo action. Cần request identity từ principal, tournament-grant scope; TA chỉ metadata an toàn trong giải, source access không phát sinh; enumerate botID ngoài scope trả safe deny. Actor nào được request recheck/select Bot phải khớp grant/capability, không lấy ownerDisplay hoặc permittedActions làm authority. |
| U07 | P2 | Các giới hạn reason length, request/page bounds, coordinate int/bounds/depth, timestamp parsing và request-size caps cần contract registry tại G1, có reject path/code và no mutation. Đây là technical guardrail, không cần human quyết từng con số nếu không đổi product semantics; phải ghi trước implementation. |
| U08 | P2 | P04/P05/P16 có mô tả loading/error và a11y nhưng cần keyboard focus sau conflict/retry, aria-live progress/errors và safe back/return path. Action read-only/view-only không render editable controls; forbidden không lộ dữ liệu cũ từ cache sau principal/scope đổi. |

### Điều kiện re-review tiếp theo

Root sửa U01–U08 trong draft đang sở hữu; bổ sung quyết định human và semantic gaps G02/G04/G07/G14–G17. Reviewer chỉ cập nhật report theo hash mới; không sửa hộ hai draft. **G0 vẫn HOLD; N00 chưa DONE.** App/runtime/DB/browser tests vẫn NOT RUN.

## Supplemental review — vòng chỉnh draft, kết thúc vòng này

Đã đọc lại toàn bộ hai draft sau root chỉnh sửa:

- Brief SHA256: `45C003DB13148F9766791C29CB1DA3039A071ECC3B27A883801F16E2D044E30B`.
- UI/DTO SHA256: `46F56C31BCC4963A59A3A5F17F01A72C485BE4D8DF87175D2031713F7D67E268`.

D01 đã đổi đúng thành mỗi bên có cả ba type>0 ban đầu khi bậtEXTINCTION; ghi riêng semantics extinction chưa được xác nhận. Brief đã có D16 roster/READY, D17 TTL/extinction. Không ghi nhóm2/3 đã duyệt, không đổi G0 hoặc nhãn cả mục15.

| Finding | Trạng thái vòng này | Căn cứ |
|---|---|---|
| U01 | CLOSED trong draft | Tách partialRuleProfileDraft, ValidatedRuleProfile, immutableRuleSnapshot; draft không executable. |
| U02 | PARTIAL | Có exactref+digest và revalidate quyền/revision/envelope/effectiveAt tại publish. Còn ghi rõ sameidempotencyKey+differentpayload phải conflict; generic idempotency không đủ chứng minh điều này. |
| U03 | CLOSED trong draft | Có SETTLED/CLOSED_NEUTRAL/PENDING, neutral winner/verdictnull và pointsAppliedfalse. Semantics business cancel vẫn pending, thiết kế schema không tự duyệt policy. |
| U04 | CLOSED trong draft | Có full previewcontext tournament/config/draft/profile/capabilities và ACL/digest cho board snapshotrefs. |
| U05 | PARTIAL | View đã có target EFFECTIVE/FUTURE/PINNED_MATCH và không làm receiptold/futurestale sai. RecheckCommand còn thiếu tournament/targetConfigVersion/source revision hoặc source digest để job result gắn chính xác tuple và chống đổiBot/file trong lúc queued. Có thể bổ sung bằng server-bound targetcontextref thay vì thêm mọi trường client. |
| U06 | OPEN | Chưa có actoractionmatrix list/recheck giữa TAowner, SA, Botowner và Ref. 'theoquyền' vẫn cần cụ thể theo existinggrants; không cấp quyền mới ngầm. Đây là đề xuất bổ sung technicalACL, nếu thay productroles phải hỏihuman. |
| U07 | OPEN P2 | Capsregistry/errorboundary cần ghi ở G1 trướcdev; không là lý do tự đổi businessdefault. |
| U08 | PARTIAL P2 | Đã có aria-busy/focus/keyboard/errors; chưa explicitcachepurge trênprincipal/scopeđổi và focus/aria-live sauconflict/retry. |

**Kết luận vòng draft: có wireframe P04/P05/P16 và semanticDTO reviewable; chưa đạt G0, chưaN00DONE.** Có thể đóng vòng supplemental này để root tiếp tục MCQ, không cần chờ nhóm2/3 mới phát hành report. U02/U05/U06 còn là P1 requirement/designclarity cần sửa trướcG0; không phải yêu cầu chạy implementationtest tạiN00. Các businessdecisions D02–D17 chưa được đóng bởi việc sửa DTO. Baselinecoverage47/34/0 vẫn chỉ gắn canonicalsnapshot; chưa có final81IDre-review sau đầy đủhumandecisions. Runtime/DB/browser/benchmark: NOTRUN.

## Final supplemental snapshot — technical draft closure (21/10/2026)

Đã đọc lại toàn bộ brief và UI/DTO của snapshot:

- Brief SHA256: `984FF964D2FD02E6F5B0ADBE72B521C0D747915FA1F5774D9B008D9EB61F9CFF`.
- UI/DTO SHA256: `F201958D9D79966482B005828DF9B048524AB1C0A86C28E935BD05AD5E03E9E8`.

**U01–U08 đã được xử lí đủ ở mức thiết kế draft**, với giới hạn sau:

- U02: idempotency scope principal+tournament+operation+digest; cùng key khác payload trả conflict; replay vẫn kiểm quyền; concurrent retry dùng durable unique/CAS.
- U05: targetContextRef do server tạo, ghim tournament/config/rule/schema/SDK/runtime/policy/source revision+digest/owner/provenance; enqueue/execute revalidate; completion không ghi sang target khác.
- U06: có ma trận list/detail/recheck/source theo TA owner/Bot owner/SA/Referee/observer. **Chỉ đóng thiếu mô tả ma trận; quyền sản phẩm mới trong ma trận vẫn là đề xuất chờ Nam duyệt**, không coi TA recheck thay owner đã được cấp quyền.
- U07: G1 yêu cầu versioned bounds registry trước dev consumer phụ thuộc; thiếu registry là BLOCKED, không biến số candidate thành enforce đã đo.
- U08: aria-live/focus/retry và purge cache scoped khi actor/tournament đổi; bỏ response cũ, không render dữ liệu actor trước khi loading. Các nguyên tắc được dùng xuyên các UI được mô tả trong draft.
- U01/U03/U04 đã đóng ở vòng trước và vẫn giữ trong snapshot này.

Brief đã chuẩn bị Q04–Q10 là **MCQ CHƯA DUYỆT**. Câu hỏi có phương án đề xuất quan sát được cho relative/extinction, READY/HYBRID, end_at/cancel/manual, UNLISTED/ACK, quota/upload/token, score/Elo/TopN và TTL/audit. Không tự lấy A. Nhóm2/3 vẫn pending theo bằng chứng root cung cấp; không biến việc chuẩn bị câu hỏi thành đáp án human.

**Kết luận cuối vòng supplemental: G0 HOLD; N00 IN PROGRESS.** Không còn technical drafting finding U01–U08 chưa xử lí ở snapshot này; business gaps G01–G18/D02–D17 còn theo decision table và câu trả lời human thực tế. Coverage47/34/0 chỉ là baseline đã công bố, chưa là final re-review sau toàn bộ decisions. Không phát sinh implementation plan hoặc quyền N01 từ việc đóng findings draft. App/runtime/DB/browser/benchmark vẫn **NOT RUN**.

## Review delta human 4A và incident/extension — checklist revision 2

Đã đọc supplemental mới cùng brief cập nhật:

- `N00-INCIDENT-EXTENSION-REQUIREMENTS.md`: SHA256 `B34330E7776AD70C030AEA94B6827CE2C2DB546EA1193017AB3999AC2C2F03E2`.
- `N00-ACCEPTANCE-BRIEF.md`: SHA256 `44692E49ED59C558C9EC206358BDA2FDB0ACE865E77E4EF7ADF04E8288FCA443`.
- `N00-UI-DTO-DRAFT.md`: SHA256 `F201958D9D79966482B005828DF9B048524AB1C0A86C28E935BD05AD5E03E9E8`; UI này chưa bổ sung incident/extension mới.
- Source đối chiếu thêm: `room.manager.ts` hiện có in-memory room referee invitations, `match.manager.ts` có room referee/replacement/player approval/connection maps. Các cơ chế đó không tự chứng minh tournament incident dispatch/grant/lease có sẵn.

### Quyết định và thẩm quyền được ghi đúng

Human4A chốt relative RED rotate180 cả hai trục và extinction khi hết một type. Human nhóm5 yêu cầu thi/test/chấm/phát hiện gian lận tự động cùng dashboard thông báo sự cố, TA chọn trận, hệ thống gợi ý referee available rồi TA cấp quyền xử lí ngay trong quản lí giải; **không một referee thường trực cho mỗi trận**. Nhóm6 yêu cầu TA gửi lý do+thời lượng gia hạn cho SA, SA vừa xem request vừa đối chiếu lịch. Không coi5A/6A cũ đã duyệt, không suy ra bỏ pool minimum hoặc duyệt cap2h/pending-hold15m.

Scope Vận hành mới là yêu cầu đang phân tích thật, không tự đẩy DEFER và không coi lịch4/5ngày bao gồm đủ effort. N00 chỉ đặc tả. Checklist công bố revision2: T001–T081 + IE01–IE12 = **93IDs**, cần93covered mới≥99%. Bảng47/34/0 trước là baseline81 lịch sử, không coverage93 hiện hành. Chưa có aggregate93 final; cần review lại toàn bộ T cùng IE sau human decisions và semantic integration.

### Checklist IE01–IE12 — kết quả review hiện hành

| ID | Trạng thái | Gap cần đóng trước acceptance ổn định |
|---|---|---|
| IE01 | PARTIAL | Human xác định automatic operation; cần danh sách mode/controller, scheduler/pairing/ledger/error recovery và detector baseline cụ thể. Không dùng một AC tổng quát thay các flow nghiệp vụ cần nghiệm thu. |
| IE02 | PARTIAL | Durable notice/dedupe/ACL rõ; actor được gửi, input evidence/upload bounds và case merging/cancellation còn cần contract. |
| IE03 | PARTIAL | Có đường dashboard→match panel giữ context; chưa có wireframe/DTO mới và role states/referee inbox/reject/expiry. |
| IE04 | PARTIAL | Grant accepted/availability/tải là đề xuất; pool prerequisite vs on-demand acceptance và policy gợi ý/availability chưa được human chốt. |
| IE05 | PARTIAL | CAS/capacity/accept/reassign rõ hướng, chưa chốt một active incident/referee, TTL/lease/release/cross-case quyền; technical constants cần registry. |
| IE06 | PARTIAL | Player chỉ request pause và human Stop/Resume là recommendation chưa duyệt. Cần reason set độc lập, abuse rate/hold timeout; resume không clear unrelated blocker. |
| IE07 | PARTIAL | Suspicion khác proven server violation đã nêu, nhưng detector matrix/data/version/threshold/action và appeal authority chưa chốt. |
| IE08 | PARTIAL | Request lý do+duration được human yêu cầu; cap2h cumulative và partial approval, allowed states/cutoff còn đề xuất. |
| IE09 | PARTIAL | Có SA compare calendar/resources/contract/UNKNOWN; scheduler booking/resource authority/capacity proof và manual override policy cần chốt. |
| IE10 | PARTIAL | Atomic revision/cap/reservation hướng đúng; cần base timestamp semantics, timezone instants, approval pre/post end_at, cancellation races và approval history cụ thể. |
| IE11 | PARTIAL | Pending tại end_at, frozen hold15m/fallback, late approval/reopen/charge interval chưa được human quyết; không đủ deterministic expected outcome. |
| IE12 | PARTIAL | Incident verdict vs TA exact-tie boundaries được nhận diện; finalization/review/sanction/retention lifecycle chưa chốt. |

IE subtotal: **0 covered /12 partial /0 open**. Đây là kết quả phần delta, không phải toàn bộ93. P0 mới phát hiện:0; còn các P1 bên dưới nên G0HOLD bất kể coverage.

### Các gap P1 và đề xuất xử lí

| Gap mới | Mức | Yêu cầu cần rõ |
|---|---|---|
| IE-G01 accepted grant vs assignment | P1 | Grant giải accepted/active khác assignment riêng case/match. Assign không cấp global role, không chiếm player slot; release/expire case không xóa grant giải; revoke grant phải thu hồi mọi lease/write token liên quan. Bỏ1ref/match không tự bỏ pool prerequisite trướcREADY. |
| IE-G02 availability race | P1 | Availability UI chỉ gợi ý, heartbeat không là reservation. Claim capacity+case revision nguyên tử; referee accept chỉ hợp lệ với assignment revision hiện hành. Sau timeout/reassign/disconnect, old assignee không còn mutate; restart khôi phục assignment bền vững, không dựa process memory. |
| IE-G03 pause blockers | P1 | Player pause request khác actual Stop. Freeze server board/clocks/compute, discard late output, chỉ remove incident blocker đã xử lí; không reset infrastructure/disconnect/end_at blocker. Cần human chọn pause authority và maximum wait/fallback. |
| IE-G04 detector scope/evidence | P1 | Chốt detector inventory (rule/runtime violation, similarity hay anomaly nào), source/provenance/version/threshold, allowed evidence readers và false-positive corpus. Suspected cheating không tự LOSS/void/disqualify. Reviewer không cần source/log riêng tư để xử lí metadata; evidence refs có ACL/TTL, không public payload. |
| IE-G05 adjudication authority | P1 | Incident assignment không tự cho referee override natural winner/TA-only exact-tie. Ai được sanction/void/disqualify, appeal/reopen cần human quyết và CAS/result replay audit riêng. Không thực thi sửa điểm qua incident endpoint. |
| IE-G06 extension lifecycle | P1 | Chốt states được request/approve (READY/RUNNING/PAUSED/ENDED?), request expiry, minimum lead/cutoff, stale/withdraw/reject/version behavior. Pending tự nó không đổi authoritative end_at; hold là policy mới chưa duyệt. |
| IE-G07 duration accounting | P1 | Chốt requestedEndAt=baseEndAt+duration hay approvalTime+duration; cumulative cap tính actual granted delta, không trôi khi SA chậm. Partial approval chỉ trong requested bound và validity/cap. Hold15m có tính trong2h, release capacity thế nào cần quyết. |
| IE-G08 end_at pending | P1 | Nếu chọn freeze hold, phải có state riêng không gọi ENDED rồi tự resume; hold phải finite và có capacity/reservation, không vượt lịch giải khác. Nếu approve sau terminal/review/finalize thì là reopen semantics mới, không âm thầm sửa end_at/cho tạo trận. Manual deadline cũ không tự freeze vì extension pending. |
| IE-G09 compare vs approve | P1 | Calendar preview không reservation/authority; approval atomic rechecks resource-capacity data version và contract/cumulative cap/schedule. UNKNOWN không giả free. Nếu không có scheduler/reservation thật, phải nói BLOCKED hoặc human chọn bounded policy khác, không chỉ hiển thị calendar mock. |
| IE-G10 expanded scope trace | P1 | T007/T025/T027–T030/T059–T060/T073/T076/T081 và UI/DTO phải liên kết supplement; exact conflict ưu tiên latest human. Operation scheduler/ledger/detector/dashboard mới cần AC/component ownership sau gate, không lấy old delivery scope/chưa có source làm proof. |

Technical fixes có thể làm ngay không cần thay business choices: thêm discriminated incident/request/assignment/extension states và revisions; separate grant/lease/context refs; scope idempotency+payload digest; bind resource/schedule preview versions; safe evidence refs và cache/context invalidation. Các con số1incident/referee,2h/cumulative,15m hold, pool minimum, referee sanctions và reopening là product choices chưa duyệt, không tự quyết qua technical contract.

**Kết luận: G0 HOLD, N00 IN PROGRESS.** Cần MCQ ngắn cho các product choices mới, cập nhật acceptance/semantic states theo human rồi re-review đúng93IDs/hashes. Không code/DB/runtime/browser tests trong lượt review này.

## Kết thúc vòng impact review — incident/extension draft

Snapshot cuối vòng đã đọc lại:

- Brief: `44692E49ED59C558C9EC206358BDA2FDB0ACE865E77E4EF7ADF04E8288FCA443`.
- UI/DTO: `241D4280283FB4B640BCFC4A94BBD81594888A0FACC6A41FEAFA73D30CCB063E`.
- Incident/extension supplement: `FEA8AE0A244973F9E6D4132F29F985121FDF9054F4FF69661AF13016AFF695D7`.

Đã bổ sung wireframe dashboard trận→incident panel trong quản lí giải và TA extension→SA compare/decision, cùng IncidentView/AvailableReferee/AssignIncident/IncidentAction/ExtensionRequest/ScheduleComparison/DecideExtension semantic DTOs. Có scoped capabilities, CAS/capacity revisions, durable lease/reassign/restart/revoke, blocker separation, safe evidence refs, preview-vs-approve authority và UNKNOWN capacity. Thiếu wireframe/DTO mới ở IE03 không còn là finding kỹ thuật của vòng này; policy/role details vẫn cần chốt. Các model này chưa compile/implemented.

Supplement đã ghi rõ recommendation tính gia hạn từ end_at cũ; thời gian chờ nằm trong duration/cap; hold cũng cần capacity/reservation hữu hạn; settled terminal không tự reopen do approve muộn. **Tất cả vẫn CHƯA DUYỆT.** Không coi đề xuất2h/15m là quyết định hoặc proof capacity. IE01 có subcriteria vận hành để hoàn thiện, IE07 yêu cầu detector matrix trước khi COVERED; chưa nhận claim toàn năng/proven cheating.

Có thể kết thúc vòng review này để root hỏi bốn lựa chọn: pool minimum trước READY; request pause manual vs auto; cap2h cumulative với contract/capacity/partial approval; pending freeze≤15m vs end-settle. Detector inventory/authority và các gói policy cũ còn mở vẫn phải xử lí sau các câu đó; không suy bốn câu trả lời sẽ tự đóng hết93IDs.

**G0 HOLD trên scope93, N00 IN PROGRESS; không phát hành final aggregate coverage chưa re-score T001–T081.** Counts baseline81 và IE subtotal trước chỉ là evidence theo snapshot đã ghi, không score hiện hành gộp. Không code/DB/runtime/browser/benchmark; không thay canonical hoặc lịch. Reviewer chỉ sửa report này.

## Correction ưu tiên mới nhất — human5.2A/6.1A và lời sửa6.2

Đã đọc brief revision4 và supplement revision2:

- Brief SHA256 `D49FDF92A1CAE3E9F3E1066799C898836422FC1781A74F0595E96B42AECEAD1D`.
- Incident/extension SHA256 `99969E5D899887D97D42E68C0DCB996617D0FF36AFB4EB228CC1316083A4DB59`.
- UI/DTO SHA256 `241D4280283FB4B640BCFC4A94BBD81594888A0FACC6A41FEAFA73D30CCB063E`.

**Phần này thay thế trạng thái pending của các quyết định tương ứng trong report lịch sử bên trên.**

1. **5.2A APPROVED:** player chỉ gửi yêu cầu pause; TA/referee xác nhận mới dừng. Không hỏi lại liệu player một click tự pause. Authority vẫn phải kiểm grant/assignment/capability; resume không xóa blocker khác.
2. **6.1A APPROVED:** gia hạn tối đa2giờ cộng dồn mỗi giải, trong hợp đồng/capacity; SA có thể duyệt một phần. Cap2h không còn pending; không phải proof tài nguyên luôn có2h trống.
3. **Human sửa6.2 có ưu tiên hơn nhãn6.2A:** trận đấu hết giờ phải phân xử ngay theo luật pinned; **không hold15phút/freeze gameplay để chờ SA**. Mọi recommendation hold15m, reserve-hold và hỏi human chọn freeze15m bên trên là lịch sử **WITHDRAWN**, không phương án hiện hành.
4. **5.1A chưa APPROVED:** human hỏi nghĩa là gì. Cần giải thích riêng: không1ref/match đã xác nhận; có bỏ yêu cầu pool≥1acceptedReferee trướcREADY hay không là lựa chọn khác chưa chốt. Không suy chọn5.2/6.1 thành bỏ pool prerequisite.
5. Không suy “trận hết giờ” thành quyết định tổng quát về `tournament.end_at`, late SA approval hoặc reopen giải ENDED/FINALIZED. Clock trận và lịch giải là hai nguồn hạn riêng; cần đặc tả riêng. Gia hạn giải không reset clock/compute hay hồi sinh trận đã kết thúc. Quan hệ với exact-tie MANUAL đã pin và manual deadline cần giải thích để “phân xử ngay” không bị dùng làm lý do bỏ qua policy đã duyệt.

Cần đồng bộ phần pending trong supplement/brief: dòng cũ “chưa duyệt con số”, mục cap2h mang nhãn đề xuất, IE08 verification “cap cần duyệt”, và câu hỏi cuối về auto pause/cap2h/hold15m là trạng thái cũ; top correction đã nêu ưu tiên nhưng các dòng này không nên được dùng để hỏi lại. IE11 cần thay nhánh extension-hold bằng no-hold theo human, giữ open semantics `end_at`/late approval riêng. D13/D16 nên trỏ D18/D19/D20 để không gọi pause/cap còn pending một cách tổng quát.

Không full re-review93 ở vòng correction này; không xuất coverage final. **G0 vẫn HOLD, N00 IN PROGRESS**, do pool-beforeREADY và các business/operation/identity/scoring/retention gaps khác chưa chốt. Không sửa app/DB/canonical/lịch; không chạy runtime/browser/test.

## Delta review — D21 referee gate đã được human chốt

Đã đọc brief revision5, supplement revision3 và UI/DTO mới:

- Brief SHA256 `AA723FB0E30A24475E0816B68BCE2A79393EFDFB9AEABF93130AAC38C385DB8D`.
- Incident/extension SHA256 `8A46E41F6D1C26BA0190EBC32D9E482262E8EC0000D8601F109C1034AA801AF5`.
- UI/DTO SHA256 `79854053221EAF04752A66296DEB004408CF155A8BE1B97D23ED620BA7B60AEB`.

**D21 APPROVED bằng chỉ đạo human mới, thay lựa chọn5.1A/B cũ.** TA chọn có/không referee. Nếu có, TA đặt minimum; server chỉ bắt đầu giải lần đầu khi đủ referee hợp lệ đồng thờiONLINE+READY. Khi giải đã chạy, tụt minimum không pause/trì hoãn/dừng giải, không chặn admission/trận mới chỉ vì thiếu referee. Minimum không áp lại để cản resume. Đây không phải một referee thường trực cho từng trận.

Supplement đã tách rõ accepted/active tournament grant, ONLINE server heartbeat, READY chủ động trong giải, AVAILABLE để nhận incident; count distinct accounts và atomic initial-start recheck. Đang xử lí case không đồng nghĩa OFFLINE/NOT_READY. Permission/config revisions/audit bảo vệ thay minimum; UI cho biết X/N trước start. IE01 đã có subcriteria cho initial-start race/no-ref start/offline-after-start/resume. Không tăng mẫu số93 vì đây là làm rõ AC đã có, không bỏ requirement.

Trạng thái “5.1 chưa duyệt/pool minimum còn mở” trong các phần report trước là **SUPERSEDED**, không được dùng để hỏi lại. Các dòng stale về pause/cap2h/hold15m đã được đồng bộ trong brief/supplement hiện hành; cap2h và manual-confirm pause vẫn approved, extension gameplay hold15m vẫn withdrawn.

Không phát hiện thêm business gap material riêng ở delta D21. Khi G1 chốt contract, cần marker durable đã-bắt-đầu (ví dụ firstStartedAt) và presence/READY revision để restart/retry/PAUSED→RUNNING không vô tình áp lại gate đầu; test CAS phải có heartbeat/revoke/READY-race. Đây là cách làm rõ technical guardrail của D21, không câu hỏi human mới hay bằng chứng implementation.

**G0 vẫn HOLD do các policy khác; không full re-score93 trong lượt delta này.** Scope/runtime/app/DB/browser vẫn chưa được nghiệm thu bằng việc cập nhật đặc tả; reviewer chỉ sửa report.

## Full re-review93 — decisions revision1 sau8MCQ và overrides

Snapshot đã review đầy đủ:

- Decision record: `E81E66A742B915FB73147AE587F216C7814BD5BCFA0EBB49A56B7BDBE0754E23`.
- Brief revision6: `FEB3E0700DCBF595771BBF5F59AD3BF32209829EE7945429AFC789AB67C1DFE6`.
- UI/DTO priority-update revision2: `A4C68F8B0588050923945DC50F52AB8FD531FCD53599B19E67BDBAF95970E9DC`.
- Incident/extension priority update: `747FEE674F5C8698BA7E5D5B77591FA0A0800708BB3062F90C559D1CA25AD4DA`.
- Canonical hash vẫn là baseline `A0DD4B1CF905B89DD98C14775EC193972078D0CFC8F40F43EF666A777A269448`. Current decision record có explicit priority/supersession; các dòng lịch sử canonical/brief/UI không được override human mới.

**G0 HOLD. Covered79/93 (84,95%); PARTIAL14/93; OPEN0/93.** T subtotal72covered/9partial/0open; IE subtotal7covered/5partial/0open. Đây là re-score độc lập đúng93 checklist revision2, không cộng cơ học từ47/81 hoặc65/81 trước. PARTIAL không tính điểm và không phải implementationFAIL. Cần93covered và không gapP0/P1 đểPASS.

### Những thay đổi human đã khóa, không hỏi lại

Referee assigned quyết định case ngay, TA không phải approve trước; TA có quyền xem/hủy/rollback (window/effects còn pending). Giải start đúnggiờ không chờparticipants;0/1eligible RUNNINGidle; matchcreate vẫn đòi2eligible và runtime/ACK/receipt/ACL. RefereegateD21 vẫn áp initialstart. SA extension chỉapprove trướccurrentend_at, pending khôngđổilịch, no reopen quaextension; startedmatches drain theo pinnedmatchclocks, no newcreate/rematch/requeue sauend_at. Khônghold15m.

HYBRID pinned/nohot-switch; visibilitylatest5A staff+enrolled choPRIVATE/UNLISTED, PUBLIC logged-in; tênthiđấu+đơnvị. Scorepreset10*m/-5/m, Elo1000 **mọi enrollment**, no compression/globalwrite. Canonicalfinishorder/replay/earlierReached; tournamentTTL90days từFINALIZED/cancelcommit; audit365days riêng. Những điều này không còn businesspending. Giới hạndev không cho phép bỏMUST/runtimeproof/transaction/privacy/tests.

### Remaining material blockers

| ID | Mức | Gap và câu hỏi/việc tối thiểu |
|---|---|---|
| R01 | P1 | Referee quyết ngay có bao gồm exact-tieMANUAL hay chỉ incident? BaselineMANUALTA-only chưa được human override tường minh. Khuyến nghị incidentonly, MANUAL giữTA; chỉ hỏi phạm vi này, không hỏi lại ref cầnTAapprove. |
| R02 | P1 | Rollback window trướcFINALIZED hay cósau; disqualification áp futureadmission/ranking hay tựvoidpastmatches? Eventbù+canonicalreplay/pinnedhistory là proposal chưa được duyệt. Khuyến nghị trướcFINALIZED, futureblock/ranking, voidmatch riêngcólýdo; noDBrestore/rewindgame. |
| R03 | P1 | D07/cancel vẫnPENDING trong brief;8MCQ mới không hề hỏi toàn bộcancel. Cần chốt currentcancel allowedstates và effect gameplay/pending/settled/race; có thể gộp với lifecycleboundary thay mởlại8nhóm. |
| R04 | P1 | Startedmatches drain theo clock hữu hạn nhưng clockfrozen khiPAUSED thì drain có thể vôhạn. Cần pausemaximum/wall-timebound và hành động khi hết, không tựresume cònsafetyblocker; tránh hold vôhạn/finalization never/TTLneverstarts. Human đãchốt manualconfirmpause, không hỏi lại cóautopausehaykhông. |
| R05 | P1 — technical spec | Detectorbaseline đãđược chọn2A, khônghỏisimilarity/collusion. Cần matrix từngnhóm deterministic gồm trusteddata/evidence/version/policy/rejection-vs-sanction/infrafalsepositive và corpus. Có thể root bổ sung không cần human chọn lại: illegalmove rejecttheoengine; unauthorized/malformeddeny; enforceownexecution theoeventpolicy; sandboxviolation theoisolatedsupervisor evidence; infra neutral. Không tựgánLOSS chỉ vìuserclick sai hoặcparseerror của hạ tầng. |
| R06 | P1 | Created/planned nhưng chưaSTARTED tạiend_at: drainhayneutralcancel? Khuyến nghị khôngstartngoàiwindow, neutralcancel/no points/releasereservation. Đây là semantics admission/result, cầnhumanchốt hoặc explicitconfirmation boundary khi trìnhrecommendation. |

Không phát hiệnP0. Chỉ R01/R02/R03/R04/R06 cần productchoice nếu chưa có bằng chứng human khác; R05 là technical acceptance matrix có thể tự hoàn thiện từ policy đãchốt. Parsercaps/TTLlease/heartbeat hữu hạn và scheduler registry còn ởG1 không phải lý do hỏi human từng hằng số. Không dùng việc chưa chạytests để hạ requirementcoverage; hạ vì chưa đủ deterministicexpected hoặc cònproductchoice.

### Checklist93 theo snapshot mới

| ID | Kết quả | Evidence/ngữ nghĩa hoặc gap |
|---|---|---|
| T001 | COVERED | Canonical§16 T001 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T002 | COVERED | Canonical§16 T002 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T003 | COVERED | Canonical§16 T003 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T004 | COVERED | Canonical§16 T004 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T005 | COVERED | Canonical§16 T005 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T006 | COVERED | Canonical§16 T006 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T007 | COVERED | D21 thay≥1Ref cố định: TA optional/min ONLINE+READY chỉ initial start; accepted grant vẫn bắt buộc trước quyền. Verify invite/start race. |
| T008 | COVERED | Canonical§16 T008 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T009 | PARTIAL | R01: referee case authority mới có thể chạm MANUAL exact-tie; cần human chốt tách incident/manual. |
| T010 | COVERED | Canonical§16 T010 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T011 | COVERED | Canonical§16 T011 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T012 | COVERED | Canonical§16 T012 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T013 | COVERED | Canonical§16 T013 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T014 | COVERED | Canonical§16 T014 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T015 | COVERED | Canonical§16 T015 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T016 | COVERED | Canonical§16 T016 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T017 | COVERED | Canonical§16 T017 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T018 | COVERED | Canonical§16 T018 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T019 | COVERED | Canonical§16 T019 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T020 | COVERED | Canonical§16 T020 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T021 | COVERED | Canonical§16 T021 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T022 | COVERED | Canonical§16 T022 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T023 | COVERED | Canonical§16 T023 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T024 | COVERED | Canonical§16 T024 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T025 | COVERED | 4.1 override: không roster/claim/ACK/receipt blocker giải; config/runtime/safety + optional referee initial gate; match admission vẫn kiểm. Verify0/1/2eligible. |
| T026 | COVERED | 4.1+D21: đúngstart_at nếu technical/referee gate đạt,0eligible RUNNING idle; thiếu gate hiện blocker, không backdate. Verify fake-time. |
| T027 | PARTIAL | R04: clock dừng khi pause; thiếu finite pause/drain timeout và outcome, dù no-auto-pause đã chốt. |
| T028 | PARTIAL | R04: ENDED chặn admission nhưng started match PAUSED có thể không drain nếu không policy hữu hạn. |
| T029 | PARTIAL | R03: D07 còn PENDING; cancel gameplay/pending/result race chưa được duyệt qua8MCQ mới. |
| T030 | PARTIAL | R02/R04: rollback/finalization window và paused drain chưa cho deterministic settlement/finalization. |
| T031 | COVERED | Canonical§16 T031 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T032 | COVERED | Canonical§16 T032 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T033 | COVERED | Canonical§16 T033 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T034 | COVERED | Canonical§16 T034 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T035 | COVERED | Canonical§16 T035 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T036 | COVERED | Canonical§16 T036 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T037 | COVERED | Canonical§16 T037 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T038 | COVERED | Canonical§16 T038 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T039 | COVERED | Canonical§16 T039 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T040 | COVERED | Canonical§16 T040 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T041 | COVERED | Canonical§16 T041 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T042 | COVERED | Canonical§16 T042 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T043 | COVERED | Human nhóm1 duyệt RAY8/can_jump finite; engine/UI/SDK same legal set, no intermediate capture. Verify golden corpus. |
| T044 | COVERED | Human nhóm1 duyệt LEAP/union finite offsets; no contradictory jump toggle, dedupe mobility. Verify engine corpus. |
| T045 | COVERED | Human4A: BLUE relative gốc, RED rotate180 dx/dy; absolute unchanged, không theo UI. Verify vectors/rotation. |
| T046 | COVERED | Canonical§16 T046 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T047 | COVERED | Human nhóm1 finite16patterns/225offset candidate + G1 limits registry; reject script/deep/zero/unbounded trước eval. Verify parser/security. |
| T048 | COVERED | Nhóm1+4A: OR thắng, extinction zero một type, cả3types>0 ban đầu khi bật. Verify enabled/disabled/initial terminal. |
| T049 | COVERED | Nhóm1: structure/nonterminal/initial legal moves/empty-board reachability; không claim fairness. Verify report+goldens. |
| T050 | COVERED | Canonical§16 T050 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T051 | COVERED | Nhóm1: STATIC/CYCLE index0/SEEDED initial filtering/repeat semantics; PRNG/version independent streams pinned. Verify replay samples. |
| T052 | COVERED | Canonical§16 T052 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T053 | COVERED | Nhóm1: shared/occupied goal không auto-win; own-initial filtering đúngmode; legal move into goal mới thắng. Verify occupied/shared fixtures. |
| T054 | COVERED | D03+3.2A: match own deadline reject trướccommit; naturalwin→plylimit→goaltick; giảiend_at không override startedmatch bank. Verify boundaries. |
| T055 | COVERED | D02/D03: no-legal compare, own-turn violation LOSS, global limit comparator, DRAW chỉ bật; infra neutral. Verify event corpus. |
| T056 | COVERED | D02 weights0..1000/3decimals/scaled exact arithmetic, lexicographic; khác weightedscore giải. Verify arithmetic goldens. |
| T057 | COVERED | D02: movement-graph distance tới current goal, unreachable kém reachable, mobility uniquefrom/to; khônghardcoded9. Verify graph corpus. |
| T058 | COVERED | D02: actual first/second assignment final policy; defaultSECOND_MOVER, MANUALrequest theo cấu hình; fullregulations. Actor boundary R01 tạiT009/T059. |
| T059 | PARTIAL | R01: TA-only MANUAL là baseline nhưng referee quyết ngay mới cần authority boundary cuối. |
| T060 | PARTIAL | R01/R03: manual/timeout có CAS+deadline; cancel/incident/rollback interaction còn mở. |
| T061 | COVERED | Canonical§16 T061 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T062 | COVERED | Canonical§16 T062 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T063 | COVERED | Canonical§16 T063 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T064 | COVERED | Canonical§16 T064 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T065 | COVERED | 4.2A: H-H/H-Bot/Bot-Bot, controllers pinned, labeledsharedBXH, no inmatch hotswitch. Verify controller/mode matrix. |
| T066 | COVERED | Canonical§16 T066 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T067 | COVERED | Canonical§16 T067 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T068 | COVERED | D03: trusted hardtotalcompute per side midround, no queue/bootstrap/Humanthink charges; finitecap proof later. Verify supervisor boundaries. |
| T069 | COVERED | 4.2A lựa chọn scope: khônghot-switch, newBot chỉ trướcnewmatch; khôngshiptoggle giả. Verify no-switch and new-match selection. |
| T070 | COVERED | 5A+versionpolicy: reACK trướcnewmatch, oldmatch/rating giữpin, Bot recheck theoactualtarget. Verify rulechange integration. |
| T071 | COVERED | Canonical§16 T071 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T072 | COVERED | 7.1A/7.2A: score10*m/-5/m floor0; allinitElo1000,K32/400; no compression/globalwrite;band100+50/30s/rematch3day. Verify arithmetic/replay. |
| T073 | PARTIAL | R02: official finalized export phải nhất quán với rollback pre/post FINALIZED chưa chốt. |
| T074 | COVERED | Latest5A override: PRIVATE/UNLISTEDstaff+enrolled, PUBLIC loggedin; tênthiđấu+đơnvị, noID/email, URL khônggrant. Verify payloadACL. |
| T075 | COVERED | Canonical§16 T075 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T076 | COVERED | 8.1A: finalizedAt+90days/cancelledAt+90days, archive khôngreset, protectedmultirefs, restore khôngkhôiphụcdeletedmatches. Verify fake-time. |
| T077 | COVERED | 8.2A: auditeventAt+365days, append-only+sanitizedACL/identitymapping, separateBotTTL. Verify eventTTL/leak corpus. |
| T078 | COVERED | Canonical§16 T078 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T079 | COVERED | Canonical§16 T079 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T080 | COVERED | Canonical§16 T080 có scenario/action/expected/prohibition/verification; đọc cùng latest decision priority và UI/DTO guards; không có unresolvedproductchoice trực tiếp ở mục này. |
| T081 | PARTIAL | R02: replay/finish_sequence đã chốt; reversal/disqualification scope/window còn pending nên chưa đủ subAC. |
| IE01 | COVERED | D21+4.1+2A operation subAC: initialtechnical/refereegate,0eligible idle, pairing/admission/runtime/ledger/restart/backpressure. Knownpolicy ready; pause/cancel edges trackedIE06/11/12. |
| IE02 | COVERED | Player/detector scoped case→durableTA notice, bounded input/dedupe/idempotency/rate+safe evidence ACL. Verify retry/browser+tenantdeny. |
| IE03 | PARTIAL | R02: incident/extension UI có wireframe; action rollback/window/finalized denial chưa có final semantics. |
| IE04 | COVERED | Acceptedactivegrant+serverpresence/availability/capacity; emptycandidate queue+escalation no fakeassignment. Verify fake-time/ACL. |
| IE05 | COVERED | Incident+capacity revisions/CAS, acceptedassignmentlease/revoke/reassign/restart; no oldassignee authority. Verify concurrentclaims/lateaccept. |
| IE06 | PARTIAL | R04: manual-confirm pause đã approved; thiếu finite pause/drain bound và outcome trong incident/infra blockers. |
| IE07 | PARTIAL | R05: human chọn deterministic baseline; chưa có detector matrix cụ thể/data/provenance/effect/corpus mapping. |
| IE08 | COVERED | 6.1A+3.1A: cap2h cumul, partialSAapproval withincontract/capacity beforeend_at; requestreason/duration/revision/idempotency. Verify boundary/ACL. |
| IE09 | COVERED | SA request+calendar/resource/blackout/contract/cap dataasof; CLEARpreview nonauthority, UNKNOWNdeny where reservation needed. Verify UI+capacity. |
| IE10 | COVERED | Atomic request/schedule/resource/cap recheck andreserve+end_at exactlyonce; no score/rule/clock reset. Verify TOCTOU/concurrency/restart. |
| IE11 | PARTIAL | R06/R04: started drain và approve-before-end đã chốt; created-not-started và paused-drain edge chưa chốt. |
| IE12 | PARTIAL | R01/R02/R03: scoped referee decision, TA reversal, finalization/cancel/retention/result authority chưa đóng đủ. |

### Scope/effort forecast review

126h-người allocation cũ và128/160h-người capacity4/5ngày là phép cộng lịch, không proof effort hoặc sốgiờ còn lại. Incremental40–64h và tổng166–190h là coarse scenario không có working-slice timings, runtime availability và throughput số đo. Report chỉ chấp nhận nhãn **chưa đo/không camkết**, không chấp nhận dùng làm feasibilityPASS hoặc chứng minh thêmngày25 sẽđủ. Chưa đổideadline, chưacắtMUST, chưaWaveplan mới. Baseline oldsource9×9/SDK scorer cùng modulesoperation chưa có là rủi ro thực, không bằng chứng rangeestimate chính xác.

UI tốithiểu trong P03/P08/P11 thay vì app mới, fixedapprovedpresets/no compression/nohot-switch/noadvancedAI đều phù hợp humanchoices để hạnchếdev; vẫn cần full FE/BE/ACL/error/retry/tests cho mandatoryflows. G0requirementsPASS về sau không tựPASS runtime/capacity/time gate.

**Kết thúc vòng93: G0 HOLD; N00 IN PROGRESS.** Root chỉ cần xử lí remaininggaps trên, đồng bộsupersession/thêmtechnicalmatrix rồi re-review đúnghash. App/runtime/DB/browser/benchmark vẫnNOTRUN; reviewer chỉsửa report.

## FINAL — Re-review93 sau quyết định bổ sung, G0 PASS ở mức yêu cầu

Ngày21/10/2026. Reviewer độc lập `/root/n00_requirements_review`, skill `ecc:intent-driven-development` đã đọc/áp dụng. Đây là kết luận mới nhất, thay mọi trạng thái HOLD/counts cũ ở report lịch sử khi cùngscope.

### Snapshot khóa cho kết luận này

| Artifact | SHA256 |
|---|---|
| N00-DECISIONS-2026-10-21.md revision2 | 747B05C2F207F6DA3ABD450F633342251523BEAA62C1FD422D390E77B09A2EDB |
| N00-ACCEPTANCE-BRIEF.md finalupdate | 0792980F4E2749F0E85AC3256E90FD441C9027EC534F9FAB4264904D3ABB635E |
| N00-UI-DTO-DRAFT.md deltarevision3 | 6487139C55E49054E3FFD4FE3F3D9C7149DD5EFFA264C972F627F4649E8A9392 |
| N00-INCIDENT-EXTENSION-REQUIREMENTS.md prioritylink | 747FEE674F5C8698BA7E5D5B77591FA0A0800708BB3062F90C559D1CA25AD4DA |
| Canonical specification historicalbase | A0DD4B1CF905B89DD98C14775EC193972078D0CFC8F40F43EF666A777A269448 |

Đã đọc actualsavedfiles và kiểm Get-FileHash khớp toàn bộ hashes trên. Stablechecklist revision2: T001–T081+IE01–IE12,93IDs; parentcriteria chỉCOVERED khi các subAC liên quan đã có expected/prohibited/verification rõ. Review toàn phạm vi, không chỉ14partial trước. Không thêm/giảm mẫu số để lấyPASS.

**Rawcounts: T81covered/0partial/0open; IE12covered/0partial/0open; tổng93covered/93 (100% specificationcoverage),0partial,0open. P0 còn mở:0; P1 còn mở:0 trong scope/checklist đã công bố. G0: PASS — REQUIREMENTS ONLY.**

### Kiểm quyết định mới và closure material blockers

Human đã chọnA cho ba câu bổ sung: incidentreferee quyếtngay nhưngMANUALTA-only; TArollback trướcFINALIZED bằng eventbù/replay, disqual chỉfutureadmission/ranking không tựvoidpastmatches; cancel trướcENDED giữsettled/neutralclosepending, pause10min/lần30min/trận quáhạnneutralabort, không tựresume/cưỡngclearblocker.

- R01 authority đã đóng, không dùng “referee quyếtngay” đểchuyển MANUAL sangreferee hoặc chooverride naturalwinner ngoàicase cóquyền/lýdo.
- R02 rollback đã đóng; UI/DTO reversecommand có decision/tournamentrevision, principalTAowner,reason/idempotency, FINALIZED_LOCKED; visible recomputing/atomicprojection và nohistoryrewind.
- R03 cancellation đã đóng theo explicit humanchoice; canonicaltransaction giải quyết cancel/manual/timeout đểkhôngdoublepoints.
- R04 finitepauseddrain đã đóng bằng10/30min vàneutralabort; no hold15m/infraauthorloss/noautoresume.
- R05 detector matrix đã được root bổ sung từ lựa chọn2A, khôngmởscope: trusteddata/provenance/policyversion,rejectvssanction,legitimate/violation/faultcorpus; không suy malformedrequest/Humanwrongclick thànhcheatingLOSS.
- R06 creatednotstarted neutralcancel/nopoints/releasereservation là hệquả tườngminh của chỉSTARTEDdrain. Không hỏi lại; không bắt đầu trận ngoàiwindow hayhồisinh trận đãkếtthúc.

Latestdecisionrecord có priority rõ đối với canonical/brief/UI/supplement lịch sử. Vì vậy không cần human trả lời lại8nhóm hoặc normalizecanonical như điều kiện sản phẩm mới đểPASS G0. Tuy nhiên tài liệu implementation saugate phải dẫnlatestrecord và cập nhật/supersede các dòngbase dễgâyhiểu nhầm; không copy STAFF_ONLY/Elo compression/min1ref/runtimehold cũ vào code.

### Checklist93 final theo snapshot khóa

Các mục đã COVERED ở vòng79/93 được đọc lại cùng newdecisions, không thấy regression. MỗiID vẫn có scenario/action/expected/prohibited+verification trong canonical§16/incidentIEtable cùng latestsemantic subAC; code/runtimeverification chưa chạy. Các14ID partial trước được checkclosure riêng bên dưới.

| ID | Kết quả | Evidence cuối |
|---|---|---|
| T001 | COVERED | Canonical§16 T001 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T002 | COVERED | Canonical§16 T002 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T003 | COVERED | Canonical§16 T003 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T004 | COVERED | Canonical§16 T004 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T005 | COVERED | Canonical§16 T005 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T006 | COVERED | Canonical§16 T006 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T007 | COVERED | Canonical§16 T007 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T008 | COVERED | Canonical§16 T008 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T009 | COVERED | R01 đóng: referee incident-only; MANUAL exact-tie TA owner; forged actor/role denied. |
| T010 | COVERED | Canonical§16 T010 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T011 | COVERED | Canonical§16 T011 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T012 | COVERED | Canonical§16 T012 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T013 | COVERED | Canonical§16 T013 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T014 | COVERED | Canonical§16 T014 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T015 | COVERED | Canonical§16 T015 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T016 | COVERED | Canonical§16 T016 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T017 | COVERED | Canonical§16 T017 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T018 | COVERED | Canonical§16 T018 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T019 | COVERED | Canonical§16 T019 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T020 | COVERED | Canonical§16 T020 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T021 | COVERED | Canonical§16 T021 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T022 | COVERED | Canonical§16 T022 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T023 | COVERED | Canonical§16 T023 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T024 | COVERED | Canonical§16 T024 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T025 | COVERED | Canonical§16 T025 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T026 | COVERED | Canonical§16 T026 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T027 | COVERED | R04 đóng: manual-confirm pause, cap10min/lần30min/trận, quá cap neutralabort; không auto-resume/clear blocker. |
| T028 | COVERED | R04 đóng: end_at chặnnewstart, pausedstartedmatch drain với finitepausecap, khôngreopen quaextension. |
| T029 | COVERED | R03 đóng: cancel trướcENDED, giữsettled, neutralclose gameplay/requestdở, no newpoints; canonicalCAS. |
| T030 | COVERED | R02/R04 đóng: finite pauseddrain+manualfallback; chỉFINALIZED sau case/result/recompute settle, no pending swallowed. |
| T031 | COVERED | Canonical§16 T031 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T032 | COVERED | Canonical§16 T032 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T033 | COVERED | Canonical§16 T033 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T034 | COVERED | Canonical§16 T034 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T035 | COVERED | Canonical§16 T035 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T036 | COVERED | Canonical§16 T036 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T037 | COVERED | Canonical§16 T037 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T038 | COVERED | Canonical§16 T038 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T039 | COVERED | Canonical§16 T039 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T040 | COVERED | Canonical§16 T040 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T041 | COVERED | Canonical§16 T041 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T042 | COVERED | Canonical§16 T042 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T043 | COVERED | Canonical§16 T043 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T044 | COVERED | Canonical§16 T044 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T045 | COVERED | Canonical§16 T045 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T046 | COVERED | Canonical§16 T046 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T047 | COVERED | Canonical§16 T047 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T048 | COVERED | Canonical§16 T048 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T049 | COVERED | Canonical§16 T049 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T050 | COVERED | Canonical§16 T050 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T051 | COVERED | Canonical§16 T051 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T052 | COVERED | Canonical§16 T052 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T053 | COVERED | Canonical§16 T053 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T054 | COVERED | Canonical§16 T054 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T055 | COVERED | Canonical§16 T055 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T056 | COVERED | Canonical§16 T056 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T057 | COVERED | Canonical§16 T057 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T058 | COVERED | Canonical§16 T058 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T059 | COVERED | R01 đóng: MANUAL TA-only lockedboard/clocks/compute, winner+reason trướcdeadline; incidentreferee khôngoverrideworkflow. |
| T060 | COVERED | R01/R03 đóng: cancelneutralclose vs manual/timeout qua một canonicaltransaction; now>=deadlinefallback, no doubleverdict/points. |
| T061 | COVERED | Canonical§16 T061 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T062 | COVERED | Canonical§16 T062 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T063 | COVERED | Canonical§16 T063 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T064 | COVERED | Canonical§16 T064 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T065 | COVERED | Canonical§16 T065 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T066 | COVERED | Canonical§16 T066 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T067 | COVERED | Canonical§16 T067 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T068 | COVERED | Canonical§16 T068 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T069 | COVERED | Canonical§16 T069 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T070 | COVERED | Canonical§16 T070 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T071 | COVERED | Canonical§16 T071 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T072 | COVERED | Canonical§16 T072 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T073 | COVERED | R02 đóng: rollbackTA chỉtrướcFINALIZED; officialexport finalizedgeneration đúngNeligible, safeidentity. |
| T074 | COVERED | Canonical§16 T074 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T075 | COVERED | Canonical§16 T075 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T076 | COVERED | Canonical§16 T076 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T077 | COVERED | Canonical§16 T077 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T078 | COVERED | Canonical§16 T078 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T079 | COVERED | Canonical§16 T079 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T080 | COVERED | Canonical§16 T080 + decisionrecord revision2 priority/subAC + UI/DTOguards; không có unresolved P0/P1 requirement gap trong mục. |
| T081 | COVERED | R02 đóng: eventbù/replayfirstaffectedsequence/atomicprojection, disqualfuture-only, pinnedpairing/history immutable. |
| IE01 | COVERED | Incident checklist IE01 + decisionrecord revision2/subAC + UI/DTO; actor/scope/state/race/failure và verification được mô tả. |
| IE02 | COVERED | Incident checklist IE02 + decisionrecord revision2/subAC + UI/DTO; actor/scope/state/race/failure và verification được mô tả. |
| IE03 | COVERED | R02 đóng: UIhistory+TArollbackconfirm trướcFINALIZED; afterFINALIZED readonly/serverdeny; recomputing/conflict/focus states. |
| IE04 | COVERED | Incident checklist IE04 + decisionrecord revision2/subAC + UI/DTO; actor/scope/state/race/failure và verification được mô tả. |
| IE05 | COVERED | Incident checklist IE05 + decisionrecord revision2/subAC + UI/DTO; actor/scope/state/race/failure và verification được mô tả. |
| IE06 | COVERED | R04 đóng: pause10/30min, authoritativefreeze/lateoutputdiscard, quá cap neutralabort; noinfrafaultloss/no auto-resume. |
| IE07 | COVERED | R05 đóng: matrix deterministic trustedengine/supervisor/schema/sandbox/infra, rejection-vssanction/provenance/version/corpus, no advancedAI required. |
| IE08 | COVERED | Incident checklist IE08 + decisionrecord revision2/subAC + UI/DTO; actor/scope/state/race/failure và verification được mô tả. |
| IE09 | COVERED | Incident checklist IE09 + decisionrecord revision2/subAC + UI/DTO; actor/scope/state/race/failure và verification được mô tả. |
| IE10 | COVERED | Incident checklist IE10 + decisionrecord revision2/subAC + UI/DTO; actor/scope/state/race/failure và verification được mô tả. |
| IE11 | COVERED | R06/R04 đóng: chỉSTARTEDdrain, creatednotstarted neutralcancel/no points/release; extensionapprovebeforeend only; finitepausecap/nohold15m. |
| IE12 | COVERED | R01/R02/R03 đóng: referee case quyếtngay,TAcompensatingrollbackpreFINALIZED, nohistoryrewind/voidpast tựđộng; safeevidence+canonicalreplay. |

### Giới hạn kết luận và bước được mở

- **Không là implementationPASS, runtime/securityproof, capacity/loadPASS, effortPASS hoặc bảo đảm lịch.** App/engine/runtime/DB/browser/load tests **NOT RUN trongN00**; isolatedruntime/newrules/hardcompute/realconsumer/transactionraces phải có evidence ở các gate thực thi.
- Forecast40–64incremental/166–190h-người là scenario chưa đo, allocation126h cũ cũng chưađo. Không tự duyệt ngày25 hoặc deadline mới, không tựcắtMUST. Chỉ dùngđểquảnlíuncertainty vàđo lại sauworkingslice.
- G1 vẫn cần singlewriterLong chốt concrete DTO/schema/error/finitebounds/policyregistry/resource/lease/presenceversions/disposableDB. Các tham số thuầntechnical chưachốt không cho phép fakecaps hoặc skipenforcement; consumerphụthuộc phảiBLOCKED cho tới registry/providerproof đủ.
- Không sửaapplication/sharedfiles/DB/production/push/deploy; reviewer chỉreport. G0PASS cho phép root đóng requirementgate và chuẩn bị plan/harness theo workflow và approvedscope; không nghĩa đãhoànthànhN01 hoặc mọi task.
- N00 wireframes P04/P05/P16 và incident/extensionpanel, proposedRule/Resolution/rollbackDTO đã review ở mức yêu cầu; chưa G1compiledcontracts hay browserUI đãbuild.

**Kết luận hiện hành: G0 PASS về yêu cầu trên snapshot93 nêu trên.** Mọi snapshot/policy thay đổi tiếp theo cần review tácđộng; không dùng100%coverage này khẳngđịnh biếtmọiyêucầu cóthểcó hoặc implementation100%.
