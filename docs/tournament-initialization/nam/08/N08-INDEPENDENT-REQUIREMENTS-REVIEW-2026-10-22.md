# N08 — Independent requirements review — 2026-10-22

> **Trạng thái mới nhất (final re-review revision 2, 23/10/2026): PASS — 18/18 AC (100%), 0 P0, 0 P1.** Xem mục final re-review cuối tài liệu. Kết luận này thay thế các kết luận HOLD lịch sử cho quyết định requirements gate hiện tại.

**Reviewer scope:** N08 only — runtime proof and P16 Bot readiness  
**Reviewed requirements:** `N08-REQUIREMENTS-2026-10-22.md`, revision 1  
**Requirements SHA-256:** `3B767F4C4E2988F9C9AFED2160412543139619907079CC284603B996067D0350`  
**Source baseline:** `a1d0547313a48ad9ded0b10be922ea52d0554792`  
**Review mode:** source/docs inspection only; no application code, database or production-data mutation

## Kết luận

**HOLD — 11/18 AC được bao phủ đầy đủ (61,1%).** Có **0 P0, 5 P1 và 2 P2**. Vì còn P1 và coverage dưới 99%, revision 1 chưa qua requirements gate và chưa được dùng để lập implementation plan cuối cùng.

Đây là đánh giá độ đầy đủ của đặc tả. Nó không phải đánh giá phần trăm code đã hoàn thành, độ an toàn runtime hay khả năng hoàn thành trong hai giờ phân bổ.

## ECC đã áp dụng

- `ecc:contract-first`: kiểm tra một nguồn contract có thẩm quyền cho status, target tuple, command/job/result, quyền consumer và compatibility với enrollment/lifecycle hiện hành. Kết quả: phát hiện status vocabulary và job/selection contract chưa khép kín.
- `ecc:accessibility`: kiểm tra trạng thái động, quyền thao tác, live announcement, focus và purge dữ liệu khi đổi scope. Kết quả: state coverage tốt nhưng tiêu chí focus còn chưa quan sát được một cách xác định.

Không chạy `security-review`, browser/E2E hay runtime tools trong vòng này; đó là verification của implementation sau khi requirements gate PASS.

## Checklist 18 AC ổn định

| ID | Kết quả | Nhận xét |
|---|---|---|
| N08-AC01 | COVERED | Actor, scope theo giải, dữ liệu server và verification route/component đã rõ. |
| N08-AC02 | COVERED | `HUMAN_ONLINE` được xác định là không áp dụng và không tạo Bot blocker. |
| N08-AC03 | PARTIAL — P1 | Dùng đồng thời `NOT_SUBMITTED/MISSING`, trong khi tập trạng thái công khai chỉ có `NOT_SUBMITTED` và enrollment hiện hành chỉ có `MISSING`. Chưa có một canonical value/mapping và transition. |
| N08-AC04 | PARTIAL — P1 | Có ownership rule nhưng chưa có selection command/response, expected revision/idempotency và quy tắc ánh xạ principal tới `enrollment.userId`; chưa nêu xử lý enrollment chưa claim, withdrawn/disqualified hoặc revision hết hạn. |
| N08-AC05 | PARTIAL — P1 | Có job và polling nhưng chưa định nghĩa contract tối thiểu của enqueue/read: job id, target ref, state, retry-after, terminal outcome, error/conflict semantics và quyền đọc job. |
| N08-AC06 | PARTIAL — P1 | Yêu cầu dedupe/CAS đúng hướng nhưng thiếu idempotency scope, payload digest, same-key/different-target conflict, durable uniqueness và hành vi recovery sau restart/crash. |
| N08-AC07 | COVERED | Revalidation lúc enqueue/execute và cấm ghi kết quả stale đã rõ. |
| N08-AC08 | COVERED | Đòi adapter cô lập thật, cả hai side và profile luật target; cấm mock/heuristic làm production proof. |
| N08-AC09 | PARTIAL — P1 | Chưa có taxonomy phân biệt bot policy violation với provider kill/crash/measurement unavailable; vì vậy cùng một failure có thể bị ghi `INCOMPATIBLE` thay vì `BLOCKED_INFRA`. “Receipt thất bại” cũng chưa nêu receipt/ref nào được lưu và trường nào công khai. |
| N08-AC10 | COVERED | Infra failure là neutral, retryable và là tournament blocker; không xử thua tác giả. |
| N08-AC11 | PARTIAL — P1 | Đã nêu pin revision và chung authority nhưng chưa bắt buộc commit nguyên tử/CAS giữa receipt đúng tuple, pinned revision, readiness status và lifecycle projection; chưa nêu rollback khi một phần ghi thất bại. |
| N08-AC12 | COVERED | Luật mới chỉ stale target trận mới; trận cũ giữ pin và kết quả. |
| N08-AC13 | COVERED | Allowlist dữ liệu công khai và leak assertions bao phủ actor paths. |
| N08-AC14 | PARTIAL — P2 | Có đủ trạng thái, `aria-live` và cache purge nhưng “focus hợp lý” chưa chỉ rõ focus đi đâu sau retry thành công, lỗi, forbidden hoặc scope change; chưa nêu keyboard behavior của row/detail/retry. |
| N08-AC15 | COVERED | Proof Human–Python Bot Offline yêu cầu accepted move và cấm unit mock làm runtime proof. |
| N08-AC16 | COVERED | Proof Bot–Bot yêu cầu tối thiểu hai accepted turns qua cùng ABI/policy/receipt. |
| N08-AC17 | COVERED | Thiếu artifact/runtime hoặc không đo hard cap phải BLOCKED và không ký DONE. |
| N08-AC18 | COVERED | Các gate focused test/lint/typecheck/build/browser được gọi tên; screenshot không đủ. |

Raw coverage chỉ đếm `COVERED`: **11/18**. Các mục `PARTIAL` không được làm tròn thành đạt.

## Gap bắt buộc trước re-review

| Gap | Severity | Yêu cầu bổ sung để đóng |
|---|---|---|
| N08-G01 — Canonical state machine | P1 | Chọn một enum công khai và mapping rõ với enrollment persistence. Ghi transition hợp lệ cho select, enqueue, checking, pass, bot-invalid, infra-blocked, target-change và recheck; tách trạng thái item khỏi trạng thái task gate `BLOCKED`. Không dùng `NOT_SUBMITTED/MISSING` như hai từ đồng nghĩa. |
| N08-G02 — Selection authority | P1 | Định nghĩa command chọn revision bằng `enrollmentId`, `botId`, `revisionId`, `expectedEnrollmentRevision`, `idempotencyKey`; server tự lấy actor/owner/digest/target. Ghi điều kiện claim/eligibility và deny an toàn cho enrollment/revision không thuộc actor hoặc không còn khả dụng. |
| N08-G03 — Job/idempotency contract | P1 | Định nghĩa job view và lifecycle; khóa unique theo target tuple hoặc target digest. Idempotency phải scope theo principal+tournament+operation+payload digest; cùng key khác payload trả conflict; replay vẫn kiểm quyền. Nêu recovery cho queued/checking khi process restart và cách retry tạo hoặc tái sử dụng job. |
| N08-G04 — Failure taxonomy và receipt | P1 | Lập bảng nguyên nhân: source/ABI/illegal output/compute-output-memory cap của bot → `INCOMPATIBLE`; runtime absent/busy/crash/hash-pin/measurement unavailable → `BLOCKED_INFRA`; target đổi → `STALE`. Chỉ định trusted receipt/result ref được lưu cho mọi terminal path và public safe projection. |
| N08-G05 — Atomic READY write | P1 | Bắt buộc một transaction/CAS ghim `pinnedBotRevisionId`, readiness target/ref/status và receipt/result ref chỉ khi enrollment/target revision vẫn khớp. Partial failure không được để `READY`; lifecycle/admission đọc cùng committed authority. |
| N08-G06 — P16 focus/keyboard | P2 | Chỉ rõ focus về nút retry hoặc status heading sau mutation; forbidden/scope change chuyển focus tới heading an toàn sau khi purge; row/detail/retry dùng semantic control, keyboard reachable và target tối thiểu 24×24 CSS px. |
| N08-G07 — List contract bounds | P2 | Nêu filter/status, stable sort, cursor/page bounds và empty-result semantics để API/UI không phải tự đoán khi danh sách lớn hoặc target đổi trong lúc phân trang. |

Các gap G01–G05 là technical contract/authority guardrails, không cần mở lại quyết định business đã chốt ở N00. Sau khi cập nhật revision 2, reviewer cần chấm lại đúng checklist 18 AC; PASS chỉ khi **18/18** và không còn P0/P1.

## Đối chiếu source làm bằng chứng cho gap

- `TournamentEnrollmentSchema.botReadinessStatus` hiện chỉ nhận `NOT_REQUIRED | READY | INVALID | MISSING`; snapshot N08 lại công bố `NOT_SUBMITTED | PENDING | CHECKING | READY | INCOMPATIBLE | BLOCKED_INFRA | STALE` mà chưa có mapping.
- `CoreDraftService.enrollParticipant` hiện mặc định giải khác `HUMAN_ONLINE` thành `READY`, xác nhận defect baseline mà N08 đã nêu đúng.
- `TournamentEnrollmentRecord` chỉ có `pinnedBotRevisionId` và chuỗi `botReadinessStatus`; chưa có target/job/receipt reference để chứng minh atomic binding hay restart recovery.
- `BotLibraryService.testRevision` hiện chạy legacy initial profile với seed cố định và trả `privateLog`; nó chưa phải P16 target-aware preflight và private log không được đi qua readiness payload.
- N06 đã có ABI/receipt và Wasmtime provider fail-closed, nhưng N06 evidence tự ghi browser-attested Pyodide production runtime là `NOT_PROVEN`. N08 phải tạo bằng chứng thật hoặc giữ gate `BLOCKED` theo AC17.

## Verification đã thực hiện

Chỉ chạy các lệnh read-only: `Get-Content`, `Get-ChildItem`, `Get-FileHash`, `git status`, `git log`, `git rev-parse` và `rg` trên docs/contracts/source/tests. Application tests, database, browser, real Python runtime và fault injection: **NOT RUN — requirements review only**.

---

## Re-review — requirements revision 2 — 2026-10-23

**Reviewed requirements:** `N08-REQUIREMENTS-2026-10-22.md`, revision 2  
**Requirements SHA-256:** `BC7C3B9319D5F2095C19B0AF20583C687FF09370178F7EC366A4BE2E8F42162E`  
**Source baseline:** `a1d0547313a48ad9ded0b10be922ea52d0554792`  
**Method:** re-read the full revision, compare G01–G07 closure with the current enrollment contract/store, N06 receipt/runtime boundary and the stable 18-AC checklist.

### Kết luận revision 2

**HOLD — 16/18 AC được bao phủ đầy đủ (88,9%). Có 0 P0, 1 P1 và 1 P2.** Revision 2 đã đóng G02, G03, G04, G05 và G07; G01 còn thiếu một legacy mapping có thật trong source, còn G06 thiếu target-size criterion đã nêu ở review revision 1. Vì còn P1 và coverage dưới 99%, requirements gate chưa PASS.

### Re-review checklist 18 AC

| ID | Kết quả revision 2 | Bằng chứng/kết luận |
|---|---|---|
| N08-AC01 | COVERED | List đúng tournament, authoritative server data và target versions được nêu rõ. |
| N08-AC02 | COVERED | `HUMAN_ONLINE` không sinh Bot item/blocker và enrollment dùng `NOT_REQUIRED`. |
| N08-AC03 | PARTIAL — P1 | `MISSING → NOT_SUBMITTED` đã rõ, nhưng source contract hiện cũng nhận legacy `INVALID`; revision 2 không normalize `INVALID → INCOMPATIBLE` hoặc quy định migration/rejection. Canonical response cấm trạng thái ngoài enum nên consumer/provider vẫn có thể drift trên dữ liệu hiện hữu. |
| N08-AC04 | COVERED | Selection route, payload, claim/eligibility/ownership/TTL, expected revision, idempotency và server-owned authority tuple đã đầy đủ. |
| N08-AC05 | COVERED | Enqueue/poll job route, response fields và read scope đã rõ. |
| N08-AC06 | COVERED | Dedupe, payload conflict, active-job uniqueness/CAS và restart recovery đều có hành vi quan sát được. |
| N08-AC07 | COVERED | Revalidation grant/owner/digest/version ở execution boundary và stale-result rejection đã rõ. |
| N08-AC08 | COVERED | Isolated real adapter, both sides và target rule profile được yêu cầu; mock/heuristic bị cấm làm proof. |
| N08-AC09 | COVERED | Bot violation và provider/measurement failure được phân loại riêng, có receipt outcome và safe projection. |
| N08-AC10 | COVERED | Infra failure neutral, retryable và tạo tournament blocker. |
| N08-AC11 | COVERED | Atomic transaction/CAS bao gồm target, receipt ref, pinned revision, readiness status; partial write rollback. |
| N08-AC12 | COVERED | New target chỉ stale new-match context; old pinned match/result không đổi. |
| N08-AC13 | COVERED | Sanitization allowlist và leak assertions áp dụng cho mọi actor path. |
| N08-AC14 | PARTIAL — P2 | Semantic button, keyboard reachability, live region, deterministic focus và scoped-cache purge đã có. Tiêu chí target tối thiểu `24×24 CSS px` từ G06 revision 1 chưa được giữ trong AC/verification, nên accessibility acceptance chưa khép kín. |
| N08-AC15 | COVERED | Human–Python accepted-move proof qua N06 ABI/receipt, không chấp nhận unit mock. |
| N08-AC16 | COVERED | Bot–Bot có tối thiểu hai accepted turns qua cùng ABI/policy/receipt. |
| N08-AC17 | COVERED | Artifact/config/hard-cap không chứng minh được bắt buộc báo task `BLOCKED`, không ký DONE. |
| N08-AC18 | COVERED | Filter/status, stable sort, bounded cursor/page, empty semantics và toàn bộ quality gates đã có acceptance evidence tương ứng. |

Raw coverage revision 2: **16/18 = 88,9%**. Mục `PARTIAL` không được làm tròn thành đạt.

### Hai sửa đổi tối thiểu để re-review lần cuối

1. **P1 — N08-G01 còn lại:** bổ sung `INVALID` là legacy persistence input và normalize thành `INCOMPATIBLE` (hoặc nêu migration/rejection fail-closed tương đương); contract test phải có cả `MISSING` và `INVALID`, và response không bao giờ phát hai giá trị legacy này.
2. **P2 — N08-G06 còn lại:** thêm vào AC14 yêu cầu mọi control tương tác đạt tối thiểu `24×24 CSS px`, cùng browser/a11y assertion phù hợp.

Hai sửa đổi này là contract/accessibility guardrail, không mở lại business policy. Sau đó có thể re-review trên cùng mẫu số 18; PASS yêu cầu **18/18 và 0 P0/P1**.

### ECC và verification revision 2

- Tiếp tục áp dụng `ecc:contract-first`: phát hiện legacy `INVALID` còn nằm trong authoritative `TournamentEnrollmentSchema` nhưng chưa có compatibility mapping trong revision 2.
- Tiếp tục áp dụng `ecc:accessibility`: focus/keyboard đã đóng; target-size minimum vẫn thiếu so với WCAG 2.2 criterion và gap G06 đã công bố.
- Chỉ dùng read-only inspection và hash; application tests, DB, browser, runtime và fault injection vẫn **NOT RUN — requirements review only**.

---

## Final re-review — requirements revision 2 — 2026-10-23

**Reviewed requirements:** `N08-REQUIREMENTS-2026-10-22.md`, revision 2 final closure  
**Requirements SHA-256:** `7E9C75D0B87144824A737DB32BD62F2A08F7B8B6A175BDF15F8399B08725A351`  
**Source baseline:** `a1d0547313a48ad9ded0b10be922ea52d0554792`

### Kết luận cuối

**PASS — 18/18 AC được bao phủ (100%), 0 P0, 0 P1.** Hai gap còn lại của lần re-review trước đã được đóng mà không thay đổi business policy:

- Legacy `MISSING` được normalize thành `NOT_SUBMITTED`; legacy `INVALID` được normalize fail-closed thành `INCOMPATIBLE`; contract test cấm cả hai legacy enum xuất hiện trong response.
- AC14 bắt buộc vùng tương tác tối thiểu `24×24 CSS px`, cùng semantic control, keyboard access, live announcement, deterministic focus và scoped-cache purge.

### Checklist cuối 18 AC

| ID | Kết quả | Cơ sở coverage |
|---|---|---|
| N08-AC01 | COVERED | P16 list đúng giải, server-authoritative status/target versions và contract/route/component verification. |
| N08-AC02 | COVERED | `HUMAN_ONLINE` không áp dụng và không sinh Bot blocker. |
| N08-AC03 | COVERED | Canonical `NOT_SUBMITTED`; legacy `MISSING/INVALID` có mapping fail-closed và không đi ra response; READY giả bị cấm. |
| N08-AC04 | COVERED | Selection route/command, claim/eligibility/ownership/TTL, CAS/idempotency và server-owned target tuple đầy đủ. |
| N08-AC05 | COVERED | Recheck enqueue và scoped polling job có observable contract đầy đủ. |
| N08-AC06 | COVERED | Dedupe, durable uniqueness, payload conflict, CAS và restart recovery được quy định. |
| N08-AC07 | COVERED | Quyền, ownership, digest và versions được revalidate; stale result không ghi vào current enrollment. |
| N08-AC08 | COVERED | Real isolated adapter, both sides và target profile; mock/heuristic không được dùng làm proof. |
| N08-AC09 | COVERED | Bot policy violation và provider failure có taxonomy/receipt riêng, safe projection và fail-closed boundary. |
| N08-AC10 | COVERED | Infra unavailable/busy/error là retryable neutral blocker, không thành author fault/loss. |
| N08-AC11 | COVERED | Atomic transaction/CAS gắn target, receipt ref, pinned revision và READY; partial write rollback. |
| N08-AC12 | COVERED | Target mới chỉ stale new-match receipt; old pinned match/result giữ nguyên. |
| N08-AC13 | COVERED | Public payload allowlist và leak assertions bao phủ actor paths/audit. |
| N08-AC14 | COVERED | Tất cả UI states, permission-aware actions, 24×24 target, keyboard, aria-live, focus và cache purge đều có acceptance criterion. |
| N08-AC15 | COVERED | Human–Python accepted-move runtime proof qua N06 ABI/receipt; unit mock không đủ. |
| N08-AC16 | COVERED | Bot–Bot tối thiểu hai accepted turns qua cùng ABI/policy/receipt; fixture result không đủ. |
| N08-AC17 | COVERED | Thiếu artifact/config/hard-cap evidence buộc task BLOCKED và cấm ký DONE. |
| N08-AC18 | COVERED | List bounds/ordering/empty semantics và focused/full/browser gates có evidence requirement rõ. |

Raw coverage cuối: **18/18 = 100%**. Không còn gap P0/P1 hoặc business decision quan trọng chưa chốt trong scope N08.

### Giới hạn của PASS

PASS này chỉ xác nhận **requirements coverage** trên snapshot/hash nêu trên. Nó cho phép chuyển sang implementation plan theo working agreement; không chứng minh application đã được implement, runtime/hard cap hoạt động, browser accessibility đã pass, DB transaction đúng hoặc N08 đã DONE. AC08, AC15–AC18 vẫn phải có evidence thật trong các bước Harness/Test/Review; nếu runtime artifact hoặc hard-cap measurement không sẵn thì implementation phải báo `BLOCKED` theo AC17.

### ECC và verification cuối

- `ecc:contract-first`: PASS cho canonical enum/mapping, selection/job contracts, idempotency/recovery, receipt taxonomy và atomic authority boundary ở mức yêu cầu.
- `ecc:accessibility`: PASS cho semantic/keyboard/live/focus/cache-purge/24×24 acceptance coverage ở mức yêu cầu.
- Read-only inspection: `Get-Content`, `rg`, `Get-FileHash`, `git diff`, `git rev-parse`. Application tests, database, browser, runtime và fault injection: **NOT RUN — requirements review only**.
