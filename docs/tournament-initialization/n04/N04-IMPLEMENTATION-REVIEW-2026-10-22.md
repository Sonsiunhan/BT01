# N04 — Independent implementation review

Ngày: 22/10/2026
Nhánh: `nam-tournament`
Reviewer: agent requirements-review độc lập (read-only)

## Phạm vi review

Reviewer đối chiếu implementation N04 với checklist 20 AC sau khi requirements gate PASS, đọc source/test/plan và không chỉnh sửa code. Review không xem việc L05 persistence chưa có là lỗi ownership của N04; đó là boundary đã chốt.

## Kết quả vòng đầu

Vòng đầu trả **HOLD** vì 7 điểm P1 và 1 điểm P2:

1. all-zero material weights còn được chấp nhận khi goal/mobility bật;
2. `MANUAL` exact-tie bị buộc phải bật `drawEnabled`;
3. metric goal/mobility còn có đường nhận từ caller;
4. plan diễn đạt route có `/api` trong khi server dùng route không có prefix;
5. route chưa có seam đăng ký trong `buildApp`;
6. envelope/effectiveAt/CAS/idempotency/tenant/old-match mới chỉ là port contract, chưa phải persistence của L05;
7. expected-revision cần dùng public `CONFLICT` + safe reason thay vì invent public error code.

Vòng review tiếp theo phát hiện thêm hai điểm cần chặn: `NO_LEGAL_MOVE=DRAW` khi `drawEnabled=false` và BFS goal-distance trộn loại quân; cả hai đã được sửa và có regression test. Vòng cuối còn yêu cầu ràng buộc `manual.fallback=DRAW` theo `drawEnabled`; điểm này cũng đã được sửa, đồng thời `reasonCode` được giới hạn bằng enum ở contract.

## Các điểm đã xử lý trong implementation

- Comparator và contract schema từ chối material weights `{R:0,P:0,S:0}` ở mọi cấu hình; `MANUAL` exact-tie hợp lệ với `drawEnabled: false`.
- `deriveTournamentComparatorMetrics` và `compareRuleStateOutcome` tính goal distance trên movement graph/bounds của `RuleState`, và mobility từ legal `(from,to)` của engine; caller không cung cấp metric authoritative cho state path.
- Plan và route dùng đúng các path `/tournaments/:tournamentId/rule-versions...`.
- `BuildAppOptions.tournamentVersioning` cho phép L05 inject canonical port; `buildApp` chỉ đăng ký adapter khi port tồn tại, không tạo writer thứ hai.
- Route giữ public error codes hiện có và truyền conflict reason an toàn từ L05 port.
- Plan ghi rõ semantic envelope, effectiveAt boundary, tenant ACL, CAS, idempotency replay và old-match pinning phải được chứng minh trong transaction L05; N04 không claim các acceptance đó đã persisted.

## Evidence hiện có

- N04 focused: **20/20 tests PASS** (11 comparator, 5 route, 4 contract).
- N03/L02 regression: **19/19 tests PASS**.
- `packages/game-rules` typecheck: **PASS**.
- Server workspace typecheck: **BLOCKED** bởi Prisma client/generated dependency cũ; lỗi còn lại ở `auth.service.ts`, không nằm trong module N04.

## Trạng thái

**N04-owned implementation: PASS — final independent source review không còn P0/P1 gap.**
**Overall version/publish flow: BLOCKED_ON_L05_INTEGRATION.** L05 vẫn phải cung cấp và kiểm thử transaction canonical cho tenant scope, expected-revision CAS, scoped idempotency, effectiveAt/create boundary, immutable snapshots và common error envelope.

Reviewer không thể tự chạy lại Vitest trong checkout do thiếu binary workspace và pnpm dưới engine requirement; các số liệu test ở trên là evidence đã chạy bằng runtime dependency cố định của workspace, được reviewer đối chiếu source/test độc lập.

## Kiểm tra khi tích hợp vào tournament-initialization

Root chạy lại trên nền `982c10c` (đã có D03), trong worktree `D:/BT01/.worktrees/merge-d03`:

- N04 focused: 20/20 PASS.
- N03/L02/rules preview regression: 17/17 PASS.
- D03 và rules preview route regression: 24/24 PASS.
- `pnpm typecheck`: PASS toàn workspace, gồm build các package contracts/game-rules/bot-sdk. Blocker Prisma client cũ của checkout ban đầu không tái hiện sau khi sinh client cục bộ ở worktree tích hợp.
- `git diff --check`: PASS. Không chạy migration hoặc sửa dữ liệu DB.

Đây là evidence chạy bởi root khi tích hợp, không được ghi thành một lượt review độc lập mới. Boundary L05 ở trên vẫn giữ nguyên. Dùng ECC `git-workflow` để chỉ đưa các file N04 vào commit, giữ thay đổi ngoài nhiệm vụ ở workspace chính.
