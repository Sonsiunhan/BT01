# L00 — Kế hoạch thiết kế trang SA và hợp nhất API/data proposal

Ngày 21/10/2026, Asia/Bangkok. Revision 2. **L00 EXECUTED — DESIGN HANDOFF COMPLETE; APPLICATION/DB WORK NOT STARTED.**

Chỉ đạo hiện hành: đọc `docs/tournament-initialization`, lập kế hoạch L00, đưa lên nhánh `nam-backup-team` rebase từ `main`, sau đó thực thi L00. Lượt này đã tạo các artifact thiết kế/wireframe/API-data/method ownership/acceptance/result trong `l00/`; không sửa application, chạy DB hoặc mở L01. Việc push tài liệu được cho phép bởi chính yêu cầu này; không mở rộng thành quyền deploy, push main hoặc migrate DB chung.

## 1. Nguồn và phạm vi đã kiểm tra

Thứ tự ưu tiên: chỉ đạo human hiện hành → [N00 decisions revision 2](../N00-DECISIONS-2026-10-21.md) → đặc tả trong phần tương thích → [lịch cuốn chiếu V3](../DELIVERY-PLAN-V3-CUON-CHIEU.md) về thứ tự → phân công V2 về ownership. Đọc [AGENTS.md](../../../AGENTS.md), các quy tắc Robot Lab và các handoff liên quan trước khi thực thi.

- [README](../README.md), [đặc tả BA/SA](../OTTv2_Dac_Ta_BA_SA_Khoi_Tao_Giai_v1.0.md), trọng tâm §3–7, §8–12, §15–16.
- [Phân công V2](../DELIVERY-PLAN.md), dòng L00/L01 và bảng single-writer; [CSV](../DELIVERY-TASKS.csv): L00 là thiết kế P06/P07/P08, wireframes, contract skeleton/error/envelope và method ownership, không phải build ba trang.
- [N00 result](../N00-RESULT-2026-10-21.md), [UI/DTO](../N00-UI-DTO-DRAFT.md), [incident supplement](../N00-INCIDENT-EXTENSION-REQUIREMENTS.md), [review độc lập hiện hành](../support/N00-INDEPENDENT-REVIEW-2026-10-21.md), phần FINAL.
- S00 đã commit: [state map](../s00/S00-UI-STATE-MAP.md), [route inventory](../s00/S00-ROUTE-INVENTORY.md), [form tokens](../s00/S00-FORM-TOKENS.md), [console DTO](../s00/S00-CONSOLE-DTO.md). Các bản đang sửa/untracked tại checkout gốc không được xem là handoff đã hợp nhất.

ECC đã áp dụng: `intent-driven-development` để phân biệt yêu cầu và source, khóa phạm vi, định nghĩa AC quan sát được và tách gate yêu cầu khỏi bằng chứng implementation. `blueprint` đã đọc để kiểm tra applicability; không áp dụng vì đây là một task tài liệu, không phải roadmap nhiều PR. Không chạy tool review hoặc tự nhận independent PASS cho kế hoạch mới.

## 2. Baseline và phân tích chênh lệch

- Checkout gốc: `nam-tournament` tại `7e7b683`, nhiều thay đổi người dùng chưa commit. Tạo worktree riêng từ lịch sử đã commit, rebase lên local `main` tại `a4ee7c7`; `origin/main` đã fetch tại `ca62e95`. Local main có thêm commit lịch V3. Nhánh mới giữ lịch sử N00/S00 đã commit; không lấy dirty/untracked từ checkout gốc.
- [Prisma hiện tại](../../../prisma/schema.prisma) có User/Session/Match/Bot và settlement nền, chưa có Unit, Contract, Tournament, ApprovalRequest hoặc scoped admin grant tương ứng. Không suy có SA/TA thật từ tên role trong đặc tả.
- [Server composition](../../../apps/server/src/app.ts) dùng Fastify và các module auth/room/match/Bot; chưa đăng ký module tournament. Chưa có API P06/P07/P08 để gọi thật.
- [Routes hiện tại](../../../apps/web/src/app/routes.ts), [router](../../../apps/web/src/app/router.tsx) chưa có các trang Admin tương ứng. Tên route của S00 là proposal; không tự đăng ký hoặc coi đã tồn tại.
- [Error contracts](../../../packages/contracts/src/errors.ts), [semantic envelope](../../../packages/contracts/src/envelope.ts), [bounds/pagination](../../../packages/contracts/src/bounds.ts) đã có Zod schema. L00 phải đề xuất mapping/tái sử dụng có chủ đích, không tạo error protocol song song hoặc phá consumer room/match.
- G0 theo kết luận FINAL N00: **93/93 requirement items covered, không P0/P1 còn mở trên snapshot được review**. Đây là bằng chứng lịch sử của yêu cầu N00, không phải review độc lập L00 hay bằng chứng runtime/DB/UI. Không dùng các dòng HOLD lịch sử trong V2/brief để tự đảo kết luận FINAL.
- G1 chưa được chứng nhận bởi tài liệu này. D00 chưa được đối chiếu trong nhánh này; commit title ở nhánh khác không thay bằng chứng nội dung. S00 dirty mới hơn cần bàn giao revision cụ thể khi thực thi.

Không phát hiện lựa chọn sản phẩm mới bắt buộc chỉ để lập kế hoạch L00. Những điểm technical chưa chốt phải được ghi `PROPOSED`/`DEPENDENCY_PENDING`, không đổi thành quyết định human. Nếu thực thi phát hiện mâu thuẫn có ảnh hưởng quyền, quota, dữ liệu hoặc vòng đời, dừng mục bị ảnh hưởng và hỏi MCQ kèm khuyến nghị; tiếp tục phần độc lập. Không hỏi lại policy đã chốt ở N00.

## 3. Kết quả L00 dự kiến và ownership

Người phụ trách theo phân công hiện hành: Long; lượt này chỉ chuẩn bị kế hoạch trên nhánh user yêu cầu, không đổi chủ trang hoặc giao việc cho người khác.

| File dự kiến khi L00 được mở | Nội dung và consumer |
|---|---|
| `l00/L00-BASELINE-AND-GAPS.md` | Revision/hash nguồn, source inventory, conflicts và dependency matrix; đầu vào G1 |
| `l00/L00-WIREFRAMES.md` | P06/P07/P08 ở desktop/mobile, field/action/state/permission/recovery; handoff Sơn và chủ trang |
| `l00/L00-API-DATA-PROPOSAL.md` | Semantic DTO/skeleton, data relations, finite bounds, error/envelope mapping, transaction boundaries; đầu vào L01 |
| `l00/L00-METHOD-OWNERSHIP.md` | Method, trusted input, caller/writer, preconditions, idempotency/CAS, safe output và consumers |
| `l00/L00-ACCEPTANCE.md` | AC bên dưới với evidence/NOT RUN, source trace và kết quả review thực tế |
| `l00/L00-RESULT.md` | Kết quả, dependency còn thiếu, giới hạn và điều kiện mở L01; không tự ký G1 |

L00 chỉ ghi dưới `docs/tournament-initialization/l00/`. Không sửa snapshot N00 đã review hoặc S00/D00 của người khác. Không tạo TypeScript executable, Prisma schema/migration, seed, router hay shared styles trong task thiết kế này.

Ownership khi bước code sau này được mở vẫn theo V2: Long ghi contracts/schema/server composition/shared lifecycle; Sơn ghi router/layout/styles; Đức ghi auth/principal; Nam ghi rule engine và rule/adjudication/Bot-readiness adapters. Page adapter gọi canonical core, không tự cấp role, quota hoặc ghi result riêng.

## 4. Trình tự thực thi sau khi được yêu cầu

### Bước A — Plan: đóng baseline và trace yêu cầu

1. Đọc lại AGENTS và các nguồn §1 theo đúng revision; lưu commit/hash, gồm FINAL G0. Đối chiếu hash snapshot N00 thay vì chỉ đọc nhãn PASS.
2. Kiểm tra diff/worktree và khai báo ownership L00 trước mọi edit. Lấy D00/S00 đã bàn giao thật, không tự cherry-pick hoặc ghi đè thay đổi chưa commit.
3. Tạo bảng yêu cầu → màn hình/action/DTO/method → AC. Giữ policy human mới hơn làm authority khi canonical còn mô tả default cũ.
4. Ghi các dependency chưa nhận, câu hỏi kỹ thuật và product conflict nếu có. Không lấy mốc 1 giờ của lịch cũ làm bằng chứng đủ effort; không tự đổi lịch/hạn team.

### Bước B — Harness: lập checklist thất bại trước thiết kế

L00 là task tài liệu: harness là bảng kiểm artifact có expected output, counterexample và nguồn, không phải runtime test. Đặt AC chưa có artifact là NOT RUN; đánh dấu thiếu ACL/state/error/ownership là FAIL. Chuẩn bị các tình huống synthetic: actor ngoài quyền, unit code trùng/đang được dùng, contract hết hạn/hết quota, stale revision, reject/refund retry, extension đến đúng end_at, lỗi mạng và stale response. Không tạo account hoặc dữ liệu thật.

### Bước C — Dev: tạo tài liệu thiết kế

**P06 — Quản lí đơn vị:** danh sách/tìm/lọc/phân trang; tạo/sửa/khóa với `unit_code` stable/unique, tên, trạng thái, revision và thông tin liên kết an toàn. SA thao tác; actor khác bị server deny theo ACL. Khóa/sửa không xóa identity hoặc tham chiếu đang dùng; mô tả kiểm tra liên kết và trạng thái bị chặn, không dựng thao tác hard-delete. Định nghĩa lỗi trùng mã, field invalid, resource in use, conflict và retry giữ form. Quan hệ Unit–Contract–allowed units phải nhất quán.

**P07 — Hợp đồng/hạn mức:** danh sách/chi tiết/tạo/sửa/kích hoạt; unit đối tác, valid_from/to, min/max duration, max_tournaments, participant caps, allowed units/control modes, rule envelope và sandbox caps. Tách cấu hình SA nhập khỏi usage server read-only. TA binding do Đức, không tạo account từ P07. Hiển thị quota dùng chung contract; cùng người ở hai giải dùng hai enrollment, withdraw/reactivate không hoàn/tăng suất, retention không reset counter. Tạo draft giữ lượt; xóa draft/reject hoàn đúng một lần; hủy giải từng approved không hoàn. Sửa chính sách không âm thầm thay snapshot đã duyệt hoặc match đang chạy. Contract chain/billing ledger/advanced IAM không đưa vào MUST.

**P08 — Xét duyệt:** inbox có bộ lọc/phân trang; hồ sơ snapshot+revision, envelope diff, blockers, notes theo field, ba outcome duyệt/từ chối/yêu cầu sửa. Phân biệt initial approval và locked-field change request có state riêng; pending/rejected giữ config hiệu lực. SA không tự tạo giải, TA không tự duyệt; quyết định cần reason theo workflow, expectedRevision và idempotency. Response conflict buộc đọc lại, không overwrite hoặc báo thành công trước ack.

Bổ sung extension panel trong P08/P03 theo N00: SA chỉ approve trước end_at hiện tại, cộng dồn tối đa 2h trong contract/capacity, có partial approval; pending không đổi lịch. Không hứa reservation khi chưa có scheduler thật. Đúng/sau end_at từ chối, không reopen giải. Started matches drain theo budget đã pin; không tạo/start trận mới sau end_at. Không biến L00 thành triển khai scheduler, incident engine hoặc rollback ledger.

**Cả ba trang:** loading/empty/forbidden/not-found/error/retry/offline/reconnecting/expired grant/stale revision; không lưu thành công cục bộ. Giữ draft khi lỗi mạng, tái đọc state sau mutation không rõ kết quả, bỏ response thuộc actor/resource cũ. Copy tiếng Việt, label+error summary, focus return, keyboard, target ≥44px, light/dark, mobile và reduced motion theo Robot Lab. Wireframe phải chỉ rõ đường quay lại và confirmation cho action có tác động.

**API/data proposal:** xác định request/query/response riêng, entity IDs/revision/time/usage/capabilities do server; client không truyền role/actor authority. Đề xuất Unit, Contract, Binding reference, Tournament/ConfigSnapshot, Approval/ChangeRequest, ExtensionRequest, quota reservation/refund và safe audit relations. Ghi unique/FK/index/immutable fields/transaction intent nhưng chưa viết DDL. API list bounded, sort/cursor ổn định; cụ thể hóa giới hạn string/list/body/depth ở mức proposal để L01 chốt, không ghi `unlimited`.

Method table phải bao phủ list/get/create/update/lock unit; list/get/create/update/activate contract; list/get/review initial/change requests; request/review extension; core create/patch/submit/quota/refund/readiness/result ports và auth/audit/engine ports. Mỗi method ghi owner+consumer, ACL/state/envelope checks, expected revision, idempotency scope, atomic effects, safe errors và điều kiện retry. Mutation core thuộc Long; proposal engine/receipt của Nam, principal/grant/identity của Đức, console của Sơn chỉ được hợp nhất khi đã có revision đầu vào, không tự bịa signature của họ.

Error proposal phải ánh xạ vào code/severity/retryable hiện hành; phân biệt validation/unauthenticated/forbidden/not-found/conflict/quota/contract-expired/outside-envelope/rate-limit/unavailable. Chọn chính sách che tồn tại tài nguyên ngoài scope nhất quán với Đức; field errors có path và safe Vietnamese message. Không raw SQL/path/stack/secret hoặc private Bot source/memory/log. Chưa chốt HTTP/envelope/version/bounds thì ghi proposal, không export như compiled G1 contract.

### Bước D — Test: kiểm chứng artifact

- Đối chiếu mỗi AC với file/section cụ thể; kiểm mọi link local, ID trùng, nguồn priority và các action không có owner/consumer/error.
- Rà ma trận actor×resource×state cho P06/P07/P08; kiểm concurrent edit/duplicate decision/expired binding/cross-tenant/timeout/end_at bằng walkthrough tài liệu.
- `git diff --check` và kiểm name-only: chỉ artifact L00 thay đổi so với baseline sau rebase. Không chạy app tests/typecheck/build/DB/browser để tạo cảm giác đã thực thi.
- Khi L01 hoặc page code được mở ở lượt khác: mới tạo failing contract/API/race tests trước implementation, compile contracts, focused tests và các gate tương xứng. DB phải là disposable được định danh; cấm suy default DATABASE_URL là an toàn.

### Bước E — Review và Clean Rubbish Code

Review trace toàn phạm vi, quyền, race, Vietnamese copy, keyboard/theme/viewport/motion/failure và consumer compatibility. Independent review chỉ được ghi PASS khi có reviewer thật đọc đúng revision; nếu chưa có thì NOT RUN. Gate N00 cũ không thay review L00. Lượt hiện tại không giao code hoặc nhắn team. Khi kết thúc chỉ bỏ bản nháp L00 do chính lượt đó tạo và đã xác định không có consumer; giữ nguyên evidence, snapshot cũ và `.worktrees/`.

## 5. Tiêu chí nghiệm thu L00

Tất cả là required. Sau thực thi, trạng thái artifact được ghi trong [`L00-ACCEPTANCE.md`](L00-ACCEPTANCE.md); các gate application/runtime/DB/browser vẫn NOT RUN. Kiểm checklist này không phải coverage 93/93 N00.

| AC | Điều kiện/hành động → kết quả, điều cấm | Verification khi thực thi / trace |
|---|---|---|
| L00-AC01 | Người mới đọc baseline → xác định source có/thiếu, revision và dependency thật; không suy schema/admin API đã tồn tại | Inventory file+source refs; T002/T080 |
| L00-AC02 | SA mở P06 và thử dữ liệu trùng/đang dùng → đủ list/form/actions, field errors, conflict và recovery; không xóa tham chiếu | Annotated wireframe + negative walkthrough; T002/T020/T079 |
| L00-AC03 | SA cấu hình P07 → đầy đủ caps/envelope/validity/usage với semantics quota và enrollment đúng quyết định; không reset usage theo binding/retention | Field+state+quota matrix; T011–T018/T076 |
| L00-AC04 | SA xử lí initial/change approval → đủ 3 outcome, snapshot/revision/reason, pending giữ config; TA/actor ngoài scope không có mutation authority | Actor/state/API walkthrough; T003/T004/T021–T024 |
| L00-AC05 | Extension trước/đúng/sau end_at → partial/cap2h/capacity/expiry rõ, pending không đổi lịch, không reopen hoặc tăng budget trận | Boundary table; T028/T030/IE08–IE11 + N00 decisions |
| L00-AC06 | Consumer đọc API/data proposal → đủ DTO relations/bounds/validation/error mapping và immutable snapshot/transaction intent; không tạo protocol cạnh tranh hoặc lộ dữ liệu riêng | Semantic schema + error/compatibility audit; T010/T017/T023/T074/T077 |
| L00-AC07 | Consumer cần method → có writer/caller/trusted inputs/ACL/state/CAS/idempotency/effects/errors; không ghi lifecycle/result ở page adapter | Method ownership matrix; BR04/05/07/12/17/42 |
| L00-AC08 | UI loading/error/conflict/logout/mobile/keyboard → có visible feedback, draft recovery, bỏ stale responses và focus flow; không fake success hoặc cấp quyền từ URL | Annotated state matrix; T004/T079 |
| L00-AC09 | Hợp nhất N00/S00/D00 → từng field/method có revision nguồn, missing handoff ghi pending; không gọi proposal là G1 freeze | Source-to-consumer trace + gap list; L01 dependency |
| L00-AC10 | Kết thúc task → report evidence PASS/FAIL/NOT RUN/BLOCKED, review đúng snapshot, chỉ docs L00 thay đổi; không ký DONE khi còn mandatory gap | Diff/link/checklist/review record; T080 |

## 6. Điều kiện dừng và bàn giao

- L00 có thể thực hiện phần thiết kế độc lập; dependency thiếu chỉ chặn phần hợp nhất tương ứng. Không dùng mock, prototype hay review đặc tả làm proof runtime/DB/capacity.
- L00 DONE cần artifact và evidence đủ AC01–10. Mục bắt buộc thiếu là IN PROGRESS/BLOCKED, không ký DONE theo lịch.
- **L01 chỉ đủ điều kiện xem xét sau L00 + N00 + S00 + D00 và G0 đúng snapshot**; G1 cần contracts/schema/error/bounds/policy registry/ports/disposable DB được chốt riêng. Không tự mở code L01 hoặc certify G1 từ việc push kế hoạch.
- Mốc 21/10 08:00–09:00 là allocation lịch sử, chưa là giờ thực tế L00 hoặc cam kết effort. Không khởi động clock thực thi, đổi deadline hoặc duyệt thêm ngày.
- Rollback riêng kế hoạch mới bằng revert commit kế hoạch; không reset lịch sử kế thừa hoặc xóa worktree người dùng.

Kết quả lượt này: L00 design handoff đã thực thi và có evidence trong `l00/`. **L01, application tests, runtime, DB, browser và independent review L00: NOT RUN.**
