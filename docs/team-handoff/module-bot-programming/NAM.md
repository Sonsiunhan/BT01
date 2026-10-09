# Nam — Bot end-to-end và System Design

**Deadline chung:** 00:00 10/10/2026 → 00:00 12/10/2026, UTC+7; 48 giờ cho toàn team. Theo [checkpoint chung](00-TONG-QUAN.md); bàn giao candidate sớm để Đức/Long/Sơn review, không chờ task DONE. Không tự cắt scope hoặc bỏ gate.

**DRAFT.** Đọc [00](00-TONG-QUAN.md), [01](01-QUYET-DINH.md), `AGENTS.md`, plan Robot Lab trước khi làm. Không sửa shared file do Long/Sơn giữ nếu chưa chuyển writer.

| ID | Thứ tự | Nhiệm vụ/đầu ra | Dependency | FRS | Nghiệm thu |
|---|---|---|---|---|---|
| N-00 | 0 | Chốt DEC, mode matrix, contract changes, scope và người review | Không | Toàn bộ | Quyết định ghi rõ; từng task được READY riêng |
| N-01 | 1 | Tái hiện R3 consumer fail, bổ sung diagnostics đã sanitize, sửa và đo pinned runtime Linux | D-01 policy; phối hợp L-06/file probe | 04,08,10 | Real consumer PASS đúng commit; không fake runtime/disable gate |
| N-02 | 2 | Hoàn thiện Library/Workbench/Guest ownership; upload→revision→preflight→select | L-02 contract; N-01 cho Online | 03 | Luồng đầy đủ; lỗi/retention/active-reference guard |
| N-03 | 2 | Guideline Python ABI, state/memory, allowlist, lỗi, ví dụ và first-bot tutorial | L-01/02; N-02 | 03 | Người mới tạo được bot riêng theo tài liệu; sample chạy sandbox |
| N-04 | 3 | Bot Online lifecycle, equal budgets, pending revision, pause/cancel/restart/result | L-04/05; N-01/02 | 04 | Race và privacy tests; trận tiếp tục khi owner rời UI theo policy |
| N-05 | 3 | Bot Offline kit, preflight, run/pause/step/speed/restore và version migration | L-01; N-03; D-01 policy | 05 | Implementation tạo candidate cho D-03 review; DONE sau cold offline + restore + adversarial evidence |
| N-06 | 4 | Người–Bot Online/Offline/Phòng tập theo mode matrix được duyệt | DEC-04/05; L-02/04; N-04/05 | 06 | Đúng controller từng slot; không giả người/bot qua client payload |
| N-07 | 5 | Bot tham chiếu có giải thích thuật toán, test positions và benchmark | DEC-07; N-03/04/05 | 07 | Legal/budget PASS; sức mạnh có protocol + dữ liệu thật |
| N-08 | 6 | Handoff SDK/sample, demo script, known limits; tích hợp review Đức/Long/Sơn | N-01…07 đã implementation; D-03/D-06 scoped; L-07; S-06 | 10 | Không P0/P1 mở; evidence đúng candidate; không phụ thuộc deploy L-06B |

## Ownership thực thi

| Sửa trực tiếp | Yêu cầu người khác sửa |
|---|---|
| `packages/bot-sdk/**`; server `bot-library/**`, `bot-online/**`; web Bot pages/services/compartment | Long: game-rules/contracts/match/room/schema/replay data/probe script chung; Sơn: router/shared CSS/board; Đức: auth/security plugin |

Nam chịu trách nhiệm UI/backend/security thực thi trong Bot; Đức review threat model và sandbox độc lập với Nam. Sơn nhận yêu cầu hiển thị, không đồng thời sửa file Bot của Nam.

## Gói trả lại cho System Designer

| Artifact | Tối thiểu |
|---|---|
| Runtime report | OS/architecture/provider/limits/hash/commit; preflight+turn+cancel+reclaim; author vs infrastructure |
| SDK guide | State dictionary chính xác; return schema; memory lifecycle; mẫu chạy được; bảng lỗi; troubleshooting |
| Reference bot | Source/documentation/license; benchmark dataset/config/raw results; không gắn “expert” trước khi đạt |
| Demo | Guest/account, upload sai/đúng, Ready, match, pending revision, lỗi, restore, history |

Chạy theo `Plan → Harness → Dev → Test → Review → Clean Rubbish Code`. Không chạy player Python bằng native unrestricted Python hoặc trong Node application process. Lệnh test hiện có tham chiếu `apps/server/package.json`, `apps/web/package.json`; thêm harness đúng FRS thay vì chỉ chạy build.
