# N09 — Phân tích yêu cầu trước kế hoạch

## Revision và điều kiện đầu vào

- Baseline: `main` tại `6e64c22` (23/10/2026).
- N09 phụ thuộc N04, L08, S01 và G0. Baseline chứa rule/comparator, ledger manual adjudication, admin shell/router và G0 PASS; đủ điều kiện bắt đầu requirement gate.
- N09 chỉ bàn giao component FE ổn định cho S10 đăng ký route và L10 smoke test. Không sửa router/shared shell vì thuộc Sơn; không thay transaction/ledger Long.

## Mục tiêu trong scope

Trang P05 để TA chủ giải xem danh sách exact-tie, xem bản snapshot đã được server lọc, chọn BLUE/RED và gửi lý do trước deadline. Server vẫn là nguồn duy nhất quyết định deadline, fallback, hủy giải, tính điểm và quyền.

## Yêu cầu bắt buộc và acceptance criteria

| ID | Điều kiện / thao tác | Kết quả quan sát được | Không được xảy ra |
|---|---|---|---|
| R01 | TA chủ giải mở P05 | tải danh sách theo `tournamentId`, có loading/empty/error/retry | client tự tạo request hay tự tính winner |
| R02 | Bản ghi WAITING | hiển thị match/room, hai participant, snapshot allowlisted, deadline server, fallback policy | lộ source Bot, memory, log/diagnostic riêng tư |
| R03 | TA chọn BLUE hoặc RED, nhập reason 3–1000 ký tự, gửi verdict | POST canonical endpoint; hàng chuyển trạng thái từ phản hồi server | gửi khi thiếu winner/reason hay nhấp đôi tạo hai kết quả |
| R04 | deadline đã qua hoặc tranh chấp CAS | refresh danh sách và hiển thị fallback/terminal server trả về | UI ghi đè fallback hoặc báo thành công giả |
| R05 | giải bị cancel | hàng CANCELLED chỉ đọc, giải thích trạng thái và đường quay lại | verdict sau cancel |
| R06 | TA không phải owner, Referee, SYSTEM_ADMIN, player, Guest | API và UI từ chối/forbidden; không có action | URL, payload hoặc role client cấp quyền |
| R07 | TA owner | là actor duy nhất xem và quyết exact-tie của giải mình | SYSTEM_ADMIN hay staff active đọc danh sách exact-tie như API hiện tại |
| R08 | request terminal DECIDED/FALLBACK_APPLIED/CANCELLED | hiển thị winner, reason/source, thời điểm; không render form | mở lại kết quả hay tính điểm lần hai |
| R09 | dữ liệu lỗi mạng/403/404/409/5xx | copy tiếng Việt, retry hoặc quay lại phù hợp, giữ reason chưa gửi nếu submit lỗi | raw stack/path/env hoặc mất input im lặng |
| R10 | keyboard/mobile/theme/reduced-motion | radio/textarea/button có nhãn, focus lỗi và responsive | action chỉ dùng chuột hoặc màu là tín hiệu duy nhất |
| R11 | component integration | public component/API props ổn định; handoff cho S10 chỉ cần đăng ký route | Nam sửa shared router/shell của Sơn |
| R12 | canonical contracts | request/response dùng `@ottv2/contracts`; server validates input | DTO cục bộ drift contract |
| R13 | security boundary | `frozenSnapshot` server-sanitized và FE render allowlist | render raw object hoặc private Bot fields |
| R14 | tests | HTTP ACL/deadline/cancel/CAS, component state/form/accessibility; browser handoff marked NOT RUN nếu S10 chưa tích hợp | gọi mock/UI screenshot là DONE |

## Quyết định kế thừa đã ổn định

- BA/SA mục 3.2 quy định TA chủ giải quyết exact-tie; SYSTEM_ADMIN, Referee và người chơi không có quyền đó.
- Người dùng cũng đã chốt: Referee quyết sự cố được giao, còn MANUAL exact-tie vẫn TA; không tạo quyền player.
- L08 là authoritative cho freeze/deadline/fallback/CAS/cancel order; N09 không viết lại lifecycle hoặc ledger.

## Quyết định allowlist snapshot (A)

P05 nhận một projection typed, chỉ gồm: `matchId`, `roomId`, hai participant display labels/IDs, `board` ở trạng thái dừng, `sideToMove`, các chỉ số exact-tie đã được server tính cho BLUE/RED, `ruleVersion`, `deadlineAt`, `fallbackPolicy`, status, winner/reason/source và timestamps. FE không nhận hoặc render `Record<string, unknown>` raw. Projection không chứa source Bot, memory, log, diagnostics, credential, token hoặc stack/path/env.

## Khoảng cách nguồn hiện tại cần N09 xử lý

1. GET `/api/tournaments/:tournamentId/adjudications` dùng `canViewTournamentOperationalDetails`, hiện cho global ADMIN và mọi staff active xem danh sách. Điều này rộng hơn R06–R07 và phải siết server ACL về TA chủ giải cho P05 exact-tie.
2. `frozenSnapshot` có type `Record<string, unknown>` dù được service sanitize. N09 phải thêm view allowlisted/typed ở contract/service boundary và chỉ trả projection A; không render raw object.
3. Chưa có component P05 hoặc route đăng ký. Component thuộc N09; route integration thuộc S10 theo ownership đã chốt.

## Ngoài scope

- Scheduler hàng loạt, livestream/match-center, referee incident workflow, void/disqualify, rollback trận, appeal, public replay.
- Tự sửa điểm/Elo ở FE, chạy Bot/Python, hoặc mở rộng quyền SYSTEM_ADMIN/Referee.

## Requirement-gate checklist

14/14 yêu cầu trên đã có AC; chờ reviewer độc lập xác nhận coverage >=99%, không P0/P1 gap, rồi mới lập implementation plan.
