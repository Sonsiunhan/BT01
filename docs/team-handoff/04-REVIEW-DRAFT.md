# BT01 — Review tài liệu và việc cần sửa tiếp

Cập nhật: 2026-10-09. Đây là review **tài liệu giao việc**, không phải nghiệm thu ứng dụng hoặc security sign-off.

## 1. Kết luận hiện tại

| Nội dung | Kết luận / tác động |
|---|---|
| DEC-01…12 | Nam đã duyệt trong chat; không hỏi lại các lựa chọn này |
| 00/01 | Đã cập nhật ở lượt trước; là đầu vào cho lượt sửa 02/03/04 |
| 02/03/04 | Cập nhật theo source/DEC hiện tại; riêng mapping FR/AC vẫn đánh dấu delta chưa cover đầy đủ |
| LONG.md và FRS | **DRAFT, cần sửa tiếp sau phân tích tại chat.** Chưa được sửa trong lượt này |
| Website Render | Nam xác nhận deploy thành công với PORT `10000`; bỏ nhận định PORT còn là blocker |
| Bot Online runtime | Chưa có consumer PASS mới đúng candidate; log R3 fail cũ không được đổi thành PASS vì website Live |
| Independent review | Chỉ có review bản nháp trước đây ở mục 3. Lượt sửa hiện tại do root tự rà soát; chưa có independent review mới |
| Application validation | NOT RUN: không chạy game/runtime/browser/DB/security/load tests trong lượt sửa tài liệu |

## 2. Finding hiện tại → tác động → cách xử lý

Mức độ dưới đây áp dụng cho **tài liệu giao việc**: P1 = phải làm rõ trước khi giao implementation phần liên quan; P2 = cần sửa để tránh hiểu/giao việc sai. Không phải severity của vulnerability đã tái hiện.

| ID / mức | Finding có căn cứ | Tác động khi giao việc | Cách xử lý / owner | Trạng thái |
|---|---|---|---|---|
| REV-01 · P1 | FRS-01 còn “chặn bởi DEC”, RULE-10 giữ terminal cũ; FRS-06 còn “scope BLOCKED bởi DEC-04/05” | Thành viên có thể chờ quyết định đã duyệt hoặc bỏ sót thay đổi bắt buộc | Sửa status/scope theo [01](01-QUYET-DINH.md); thêm FR/AC luật bị khóa nước và controller transitions. Long rules/contracts, Nam mode Bot | Đã ghi gap tại 02/03; **FRS chưa sửa** |
| REV-02 · P1 | `engine.ts` chưa xử hết legal move; history contract chưa có result reason mới | Bot có thể bị quy lỗi tác giả thay vì thua theo luật; UI/replay không giải thích đúng kết quả | Đặc tả terminal precedence + reason/schema/history/replay; check trước invocation; fixture mọi mode. Long chính, Nam/Sơn consumer | Source gap được ghi; implementation/test NOT RUN |
| REV-03 · P1 | Replay dựng từ `createInitialState()` hiện hành; public match/private Bot checkpoint lưu riêng | Random setup và luật mới có thể phá replay; recovery cần xác minh consistency | Khóa initial board/version và legacy routing; đo crash/reconcile đúng board/revision/memory. Long + Nam | FRS/data design cần bổ sung; không tuyên bố đã tái hiện lỗi production |
| REV-04 · P1 | FRS-07 còn coi metric/cohort là mở; REF-04 chỉ mô tả hướng dẫn tăng dần | Người thực thi có thể chỉ giao một mẫu hoặc báo “expert” sai metric | Ba mẫu runnable; technical gate riêng; 10 người × 4 trận, hai bên cân bằng, ≥30/40; protocol trước test. Nam chính, Long số liệu | DEC-07/09/10/12 đã chốt; FRS/benchmark chưa thực hiện |
| REV-05 · P2 | FRS-06 chưa đặc tả đủ practice theo DEC-08 | Step/Speed dễ bị hiểu thành tự đi thay người, undo hoặc reset Online | Đặc tả control/state/error cho Người–Bot/Bot–Bot local; chưa undo/đặt quân. Nam, Long contract, Sơn UI review | FRS chưa sửa |
| REV-06 · P2 | FRS-02 gộp transport, room/queue, authority, data; LONG.md nhiều cụm kỹ thuật thiếu tác dụng/DoD cụ thể | Long khó xác định ranh giới file, thứ tự làm và đầu ra bàn giao | Chia nhóm FRS đủ lớn; mỗi nhóm có kỹ thuật → tác dụng → input/output → lỗi → DoD. Chốt tại chat với Nam | 02/03 đã bổ sung bảng phân tích; chia file còn là đề xuất |
| REV-07 · P2 | 03 cũ đủ 104 FR/53 AC của bản nháp nhưng chưa có delta đầy đủ DEC-08…12 | Có thể hiểu nhầm mapping kín nghĩa là scope mới đã đủ hoặc đã test | Giữ ID, thêm DEC→task→gap và status NOT RUN; khi sửa FRS phải thêm/di chuyển mapping rõ | **Đã sửa 03**; coverage FRS mới vẫn chưa hoàn tất |
| REV-08 · P2 | 02 cũ ghi chưa có xác nhận Live sau sửa PORT; review cũ ghi DEC chưa duyệt | Dễ tiếp tục debug việc đã giải quyết hoặc đọc review cũ như hiện trạng | Ghi PORT đã giải quyết theo Nam; đặt review cũ trong lịch sử; Bot gate theo evidence riêng | **Đã sửa 02/04** |
| REV-09 · P1 | Source có file checkpoint/config seam; chưa kiểm chứng backend lưu/restart thật của candidate hiện tại | Có thể hứa refresh/restart luôn phục hồi từ cơ chế chưa được đo | Audit cấu hình đã sanitize, storage, crash/restart, capacity; không lấy schema/interface làm bằng chứng durability. Long điều phối | Cần FRS/data/release; runtime/DB tests NOT RUN |

Không dùng danh sách này để kết luận hệ thống đã bị khai thác. Source audit cho biết nơi cần sửa/kiểm chứng; failure thực tế cần repro và evidence riêng.

## 3. Lịch sử review độc lập bản nháp trước khi cập nhật DEC

Ngày 2026-10-09 · Reviewer: agent `/root/review_handoff` (Astra), READ-ONLY. Root giữ findings/retest đã nhận dưới đây. Review này có trước các đợt cập nhật 00/01 và 02/03/04; **không chứng nhận các bản sửa hiện tại**.

### Phạm vi và verdict tại snapshot cũ

| Nội dung | Kết quả |
|---|---|
| Review ban đầu | Đọc7 tài liệu top-level+10FRS; AGENTS/plan authority; đối chiếu source setup/SDK/runner có mục tiêu |
| Findings | 1nhóm P1 gồm2vòng dependency;3P2 về discard disconnect, budget mapping, thiếu traceability |
| Retest |4findings đã sửa; reviewer không thấy vòng dependency quan trọng còn lại trong phạm vi sửa |
| Quyết định tại thời điểm review cũ | DEC chưa duyệt tại snapshot đó. Hiện DEC-01…12 đã duyệt; statement cũ không còn là blocker sản phẩm |
| Giới hạn | Không chạy application tests/runtime/browser/DB/production; không xác minh độc lập log Render người dùng |

### Finding → correction → retest tại snapshot cũ

| Finding | Sửa trong draft | Retest reviewer |
|---|---|---|
| N-05 đợi D-03, D-03 đợi N-05; L-06 đợi D-05, D-05 đợi L-06 | N-05 đợi D-01 policy rồi tạo candidate cho D-03; L-06A candidate→D-05→L-06B release | Đã xử lý; N-08/L-07 không đợi deploy |
| BON-06 discard mọi disconnect trái BON-08 | Chỉ discard khi invocation/version/blocker mất hiệu lực; owner UI disconnect đơn thuần không hủy | Nhất quán trong phạm vi sửa |
| Budget250/500ms có thể đọc ngược | Named values: preflight250ms, perTurn500ms | Đúng source manifest |
| Bundle chỉ trỏ toàn FRS, chưa mapping FR/AC | Thêm03-TRACEABILITY, trạng thái NOT RUN |104FR+53AC không thiếu/lạ ID |

### Kiểm tra cấu trúc tại snapshot cũ

| Check | Result |
|---|---|
| Markdown local links | Không link hỏng tại snapshot kiểm tra |
| FR/AC unique IDs |104 requirements +53 acceptance; không trùng ID |
| Mapping coverage | Không thiếu FR/AC; không reference ID/task lạ;29tasks |
| Draft status | Mọi file ghi DRAFT tại snapshot cũ; không áp trạng thái này cho quyết định đã chốt hiện nay |
| `git diff --check` | PASS; các file mới vẫn untracked, không suy rộng thành application validation |

Các kiểm tra lịch sử chỉ xác minh cấu trúc bản nháp tương ứng; không tự chuyển thành application PASS hoặc chứng minh coverage DEC mới.

## 4. Kiểm tra cho lượt sửa 02/03/04

| Check | Cách xác minh | Trạng thái |
|---|---|---|
| Source claims | Đọc setup/engine/contracts/match/room/queue/history/rating/persistence/app/probe có mục tiêu | ĐÃ RÀ SOÁT SOURCE; không phải runtime test |
| Decisions | So với 01: 18 quân, restore/random, hybrid/practice, ba mẫu, ≥30/40 và khóa nước | ĐÃ RÀ SOÁT TÀI LIỆU |
| Links/IDs/mapping | Local links/fences/whitespace; 104 FR, 53 AC, 29 task IDs; mapping cũ không thiếu/lạ ID; đủ 12 dòng DEC delta | PASS cấu trúc tài liệu; không phải application PASS hoặc coverage đầy đủ scope mới |
| Change scope | So SHA-256 trước/sau toàn bộ `docs/team-handoff/` | PASS: chỉ 02/03/04 thay đổi; 00/01/LONG.md/FRS và tài liệu khác giữ nguyên |
| Independent review mới | Reviewer khác đọc candidate hiện tại và trả findings/retest | NOT RUN |
| Application/browser/runtime/DB/security/load | Thực thi harness theo FRS được duyệt | NOT RUN |

## 5. Đầu vào để phân tích nhiệm vụ Long

| Phải chốt | Đầu ra cần đạt |
|---|---|
| Cách chia FRS | Mỗi nhóm đủ lớn có một spec chính; chỉ dẫn rõ FRS cũ được thay thế/phân tách ở đâu |
| Ownership server/client | Ai sửa API client, SSE subscription và state reconciliation; ai giữ layout/Robot Lab; không nhiều writer chung file |
| Contract trước Dev | Mode/controller, command/event/error, public/private fields, version/compatibility, quyền theo actor |
| Thứ tự thực thi | Rules/contracts/policy → room/sync/authority → data/recovery → integration/runbook; candidate trước audit, release sau audit |
| DoD | Ca thường + mất mạng/lệnh lặp/race/crash/thiếu quyền; expected/actual, artifact, candidate và reviewer rõ |

Nam chốt tại chat trước khi sửa LONG.md hoặc FRS tương ứng. HTTP/SSE và ownership nền đã được duyệt ở DEC-06; không hỏi lại đổi transport. Chưa có lệnh push/deploy/migration production trong lượt này.
