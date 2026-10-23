# N08 — Requirements snapshot — revision 2 — 2026-10-23

## Phạm vi và nguồn quyết định

N08 hoàn thiện P16 — Trạng thái sẵn sàng Bot và bằng chứng runtime bắt buộc trong DELIVERY-PLAN. Nguồn ưu tiên là các quyết định N00 đã duyệt, N00-UI-DTO-DRAFT, N06 ABI/receipt, D04 enrollment và source hiện tại. N08 không mở lại mô hình thi: giải chỉ chọn `HUMAN_ONLINE` hoặc `BOT_VS_BOT`.

N08 sở hữu `modules/tournament-bot-readiness/**`, `features/admin/bot-readiness/**`, focused tests và tài liệu N08. Thay đổi contract/router/app composition là điểm nối tối thiểu, phải giữ tương thích consumer hiện có. N08 không sửa luật engine, không cấp quyền mới từ client và không đưa source Python vào tournament payload.

## Actor và quyền

- TA owner có grant giải còn hiệu lực được xem metadata readiness đã lọc của enrollment trong giải và yêu cầu kiểm tra lại. TA không được xem source, memory, private log hoặc raw runtime diagnostics.
- Bot owner chỉ được chọn/recheck revision do chính mình sở hữu cho enrollment của chính mình. Source/private log tiếp tục đi qua Bot Library owner-only, không qua P16.
- SA/Referee chỉ nhận quyền xem tối thiểu nếu capability server hiện hành cho phép; không mặc nhiên được recheck. Observer, Guest và thí sinh khác không được list/detail P16.
- Mọi request và lúc job thực thi đều kiểm principal/grant/ownership lại. ID hoặc capability do client gửi không tạo quyền.

## Trạng thái và contract quan sát được

Một item readiness phải khóa target tuple do server tạo: tournament, enrollment, bot/revision owner, source digest, config/rule version, schema/SDK/runtime/policy version và `targetContextRef`. Trạng thái item công khai chuẩn là `NOT_SUBMITTED`, `PENDING`, `CHECKING`, `READY`, `INCOMPATIBLE`, `BLOCKED_INFRA`, `STALE`; persistence/legacy `MISSING` được normalize thành `NOT_SUBMITTED`, còn `INVALID` được normalize fail-closed thành `INCOMPATIBLE`, cả hai không xuất hiện trong response. Contract test phải khẳng định không có legacy enum đi ra ngoài. `BLOCKED_INFRA` là trạng thái item và đồng thời tạo blocker readiness của giải; không dùng `BLOCKED` làm item enum khác.

### State machine và command contract

Transition server cưỡng chế: `NOT_SUBMITTED --select--> PENDING`; `PENDING --enqueue--> CHECKING`; `CHECKING --bot-policy-fail--> INCOMPATIBLE`; `CHECKING --provider-unavailable/busy/crash/pin-or-measurement-fail--> BLOCKED_INFRA`; `CHECKING --target-digest-or-version-changed--> STALE`; `CHECKING --verified-result--> READY`; mọi terminal state có thể `--recheck--> PENDING` nếu actor còn quyền. `HUMAN_ONLINE` luôn normalize `NOT_REQUIRED` ở enrollment và không tạo Bot item.

Selection command là `PUT /api/tournaments/:tournamentId/enrollments/:enrollmentId/bot` với `{ botId, revisionId, expectedEnrollmentRevision, idempotencyKey }`. Principal phải là Bot owner của enrollment đã claim, `ELIGIBLE`, chưa `WITHDRAWN/DISQUALIFIED`, và revision còn tồn tại/không hết TTL. Server tự đọc owner, source digest, target config/rule/SDK/runtime/policy và tạo `targetContextRef`; không tin các trường authority trong body. TA owner không chọn thay Bot owner, nhưng được recheck metadata trong giải.

Recheck là `POST /api/tournaments/:tournamentId/bot-readiness/rechecks` với `{ enrollmentId, expectedEnrollmentRevision, idempotencyKey }`. Response enqueue và `GET /api/tournaments/:tournamentId/bot-readiness/jobs/:jobId` dùng contract `{ jobId, targetContextRef, state: QUEUED|CHECKING|SUCCEEDED|BOT_REJECTED|BLOCKED_INFRA|STALE|CANCELLED, retryable, retryAfterMs, safeReason, createdAt, updatedAt, completedAt }`. Đọc job cần cùng grant/owner scope. Idempotency scope là `principal+tournament+operation+payloadDigest`; cùng key với payload khác trả conflict; cùng target tái sử dụng job. Unique target digest/CAS ngăn hai job active cho một tuple. Sau restart, `QUEUED/CHECKING` được recover thành `BLOCKED_INFRA` với `retryable=true` hoặc requeued bởi worker; không để job treo vô hạn.

Failure taxonomy và receipt: source/ABI/illegal move/compute-output-memory cap của Bot → `INCOMPATIBLE`, receipt outcome `REJECTED`; runtime absent/busy/crash/hash-pin/measurement unavailable → `BLOCKED_INFRA`, receipt outcome `FAILED` hoặc `CANCELLED`; target đổi → `STALE`, receipt outcome `CANCELLED`. Mọi terminal path lưu trusted receipt/result reference cùng target tuple; public projection chỉ lộ `receiptId`, outcome, safe code và timing, không lộ diagnostic. `READY` chỉ được commit trong một transaction/CAS gồm targetContextRef hiện hành, pinned revision, readiness status và receipt/result ref; nếu bất kỳ điều kiện nào lệch hoặc ghi một phần thất bại thì rollback toàn bộ và không có `READY`. Lifecycle/admission đọc đúng projection đã commit.

Payload công khai chỉ có metadata cần cho điều hành: enrollment/bot display metadata, revision number/digest rút gọn, target versions, timestamps, safe reason code/message và permitted actions. Payload không chứa source, memory, private logs, stderr/traceback, filesystem/env/token hoặc đường tải source.

## Acceptance checklist ổn định

| ID | Điều kiện → hành động → kết quả quan sát được | Điều cấm | Verification |
|---|---|---|---|
| N08-AC01 | TA owner mở P16 → thấy danh sách enrollment của đúng giải, trạng thái và target versions từ API server | Không fixture UI hoặc dữ liệu giải khác | Contract + route/component test |
| N08-AC02 | Giải `HUMAN_ONLINE` → P16/readiness hiển thị không áp dụng | Không bắt nộp Bot | Service/UI test |
| N08-AC03 | Enrollment `BOT_VS_BOT` chưa chọn revision → canonical `NOT_SUBMITTED` và chặn riêng enrollment đó | Không mặc định `READY` hoặc trả `MISSING` trong response | Regression core + contract test |
| N08-AC04 | Bot owner gửi selection command hợp lệ → server kiểm claim/eligibility/ownership/TTL, khóa owner/revision/digest/target tuple và expected revision | Không tin ownerId/digest từ body; deny enrollment khác scope, withdrawn/disqualified hoặc revision hết hạn | ACL/CAS/contract test |
| N08-AC05 | TA owner yêu cầu recheck → enqueue response có job contract, targetContextRef, state/retry; GET job poll được đúng scope | Không tải source về browser, không cho actor ngoài scope đọc job | Route/service contract test |
| N08-AC06 | Hai request cùng target → idempotency/durable uniqueness/CAS tái sử dụng một job; key khác payload conflict; queued/checking recover sau restart | Không spam runtime hoặc last-write-wins sai tuple | Concurrency/recovery test |
| N08-AC07 | Job bắt đầu/kết thúc → kiểm lại grant, ownership, source digest và target versions | Không áp kết quả stale vào enrollment hiện hành | Race test |
| N08-AC08 | Preflight chạy adapter cô lập thật với hai phía và profile luật target | Không dùng AI heuristic/mock làm production proof | Adapter integration evidence |
| N08-AC09 | Bot vượt hard compute/output/memory policy → `INCOMPATIBLE`, receipt `REJECTED`; provider crash/pin/measurement failure → `BLOCKED_INFRA`, receipt `FAILED/CANCELLED` | Không lộ diagnostic; không chạy Python trong app process; không biến infra thành author fault | Failure taxonomy + fault-injection test |
| N08-AC10 | Runtime thiếu/bận/lỗi hạ tầng → `BLOCKED_INFRA`, retryable theo policy và tournament blocker | Không xử thua hoặc đánh dấu author invalid | Provider-failure test |
| N08-AC11 | Kết quả đạt đúng tuple → transaction/CAS nguyên tử ghi target, receipt ref, pinned revision và `botReadinessStatus=READY`; lifecycle/admission đọc cùng committed authority | Không client tự đánh PASSED/READY; partial write không được READY | Transaction/CAS integration test |
| N08-AC12 | Publish target mới → receipt cũ chỉ stale cho trận mới; match cũ giữ pin và kết quả | Không áp ngược luật mới | Version regression test |
| N08-AC13 | API list/detail/recheck trả payload sanitized cho mọi actor path | Không source/log/memory/path/env/token trong JSON/audit | Leak assertions |
| N08-AC14 | P16 có loading/empty/forbidden/error/busy/blocked/stale/success; retry dùng semantic button, vùng tương tác tối thiểu 24×24 CSS px và `aria-live`, focus về status heading sau success/error, về heading an toàn sau forbidden/scope change, purge cache khi scope đổi | Không render action khi chỉ có quyền xem; không mất keyboard access | Component + browser/a11y test |
| N08-AC15 | Proof Người–Python Bot Offline chạy accepted move qua N06 ABI/receipt | Không coi unit mock là runtime proof | Offline integration evidence |
| N08-AC16 | Proof Bot–Bot chạy tối thiểu hai lượt accepted qua cùng ABI/policy/receipt | Không thay bằng fixture kết quả | Offline integration evidence |
| N08-AC17 | Runtime artifact/config không sẵn hoặc không đo được hard cap → báo `BLOCKED`, không ký N08 DONE | Không suy PASS từ build | Environment evidence |
| N08-AC18 | API có filter/status, stable sort, cursor/page bound và empty semantics; focused tests, lint, typecheck, build và browser flow phù hợp đều qua | Không để client tự đoán phân trang hoặc dùng screenshot đơn lẻ làm bằng chứng | Contract + test log + result report |

## Đối chiếu source ban đầu

- Có: N06 ABI/receipt; Wasmtime supervisor với hash pin, process isolation và compute watchdog; Bot Library owner-only; lifecycle đọc `botReadinessStatus`; Offline Người–Bot/Bot–Bot hiện hữu.
- Thiếu: contract/API/module P16, route/page P16, selection/recheck target tuple và job dedupe, liên kết kết quả preflight với enrollment.
- Sai cần sửa: `enrollParticipant` hiện mặc định enrollment `BOT_VS_BOT` thành `READY`; điều này tạo READY giả trước khi có revision/receipt.
- Chưa chứng minh: runtime artifact hiện có trên máy, hard-compute run thực và browser P16. Đây là gate thực thi, không được thay bằng mock.

## Các lựa chọn đã được quyết định từ N00

Không hỏi lại: TA owner được list/recheck metadata trong giải; Bot owner chỉ thao tác source của mình; P16 không lộ source/private diagnostics; infra là neutral blocker; targetContextRef ghim tuple; old match giữ pin; UI có retry/a11y/cache purge. Các chi tiết queue/polling/dedupe là guardrail kỹ thuật và không thay đổi business policy.

## Revision 2 closure notes

Revision này đóng các gap N08-G01…G07 của independent review revision 1 bằng canonical enum/mapping, command/job payload, idempotency/recovery, failure receipts, atomic READY CAS, focus targets và list bounds. Business policy không đổi. Runtime/browser/database evidence vẫn là verification sau requirements gate; nếu artifact hoặc hard cap không chạy được thì N08 phải ghi `BLOCKED`, không tự ký DONE.
