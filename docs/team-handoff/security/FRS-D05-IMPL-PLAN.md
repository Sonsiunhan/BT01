# FRS-D05 — Anti-cheat & Privacy: Implementation Plan

| Thuộc tính | Giá trị |
|---|---|
| **TASK_ID** | D-04 |
| **FRS** | [FRS-D05-ANTI-CHEAT-PRIVACY.md](FRS-D05-ANTI-CHEAT-PRIVACY.md) |
| **Owner chính** | Đức (test/fixtures/review); Long (authority code/data/SSE); Nam (runtime/Bot integration) |
| **Trạng thái** | IN PROGRESS (D05-W1 DONE) |
| **Deadline** | 00:00 12/10/2026 UTC+7 (~36h) |

> **CHỜ DUYỆT.** Không sửa application code, không commit/push/deploy, không tấn công production.
> Disposable DB bắt buộc cho crash/durable gates. Không dùng default DATABASE_URL.

---

## 1. Objective / Security Outcome

Client/Bot không tự sửa bàn cờ, quyền, clock, kết quả hoặc dữ liệu người khác. Retry, reconnect, Stop/Resume và restart không tạo nước trùng hoặc dùng output cũ. Private data (source/memory/logs) không lộ qua bất kỳ public surface nào.

**Người dùng hợp lệ thấy gì:**
- Move hợp lệ → commit ngay; move bị reject → error MOVE_REJECTED; bàn cờ không thay đổi
- Rematch reset đúng: board/clock/side mới; move cũ không hồi về
- Referee stop → clocks frozen; resume không xóa disconnect blocker
- Referee thay thế theo đúng consent flow; ref cũ mất control ngay

**Tấn công bị chặn:**
- Payload giả (sai stateVersion, wrong side, wrong controller) → 409/403 CONFLICT
- Refresh reroll seed → bị chặn (setup từ server, không từ client payload)
- Duplicate command cùng sequence → idempotent outcome; không double ACK
- Private source/memory/logs qua SSE/history/replay/errors → canary zero-match

---

## 2. AC / DoD

| TASK_ID | Acceptance Criteria |
|---|---|
| D-04.01 | Actor/side/controller/seed/result tampering: request giả không đổi trận/quyền; Guest/account/mọi role covered |
| D-04.02 | Setup/refresh/rematch/replay: actual board/version đúng, non-repeat đúng context; refresh không reroll; old/new replay đúng reader |
| D-04.03 | Replay commands/unknown ACK: same/different digest và ID mới đúng outcome/quota; không lost/double ACKed move |
| D-04.04 | Move vs Stop/timeout/surrender/terminal: một outcome đúng precedence; clocks/blockers không bị bypass |
| D-04.05 | Revision/epoch/memory races: latest valid pending đúng activation; late output/cancel/restart không mixed board/revision/memory |
| D-04.06 | Ref replacement/revoke/reconnect: consent/accept/transfer đúng; old referee mất HTTP/SSE controls; deadline không kéo dài do flapping |
| D-04.07 | Crash boundaries/settlement: recover committed state, không double history/Elo; không xử thua do hạ tầng |
| D-04.08 | Canary privacy matrix: zero private leakage qua mọi surface/role được kiểm tra; owner vẫn xem đúng own data |

**DoD:** D-04.01…08 nối vào matrix chung; candidate/environment/failpoints/expected/actual/verdict rõ; findings sửa và retest. Không privacy/isolation/correctness blocker hoặc P0/P1 mở. Source audit/mock không thay evidence API/SSE/DB thật.

---

## 3. Risk và Control

| Risk (D-01) | Control hiện có (source) | Gap cần xác minh | Owner fix |
|---|---|---|---|
| R07 Board/seed/side tampering | `assertVersion(match, stateVersion)`: 409 STALE_STATE nếu sai; `player()` check membership | Client payload có thể inject `from/to` không hợp lệ → `applyMove` reject; seed từ `createInitialState()` phía server | Long (audit routes) |
| R07 Refresh reroll | `createInitialState()` gọi server-side; `rematch()` dùng flip-side deterministic | Cần xác minh rematch payload không cho client chọn seed | Long |
| R08 Duplicate command | `assertVersion()` versionStale reject; `FileMatchPersistence.appendEventWithFence()` reject duplicate sequence | Idempotency digest chưa rõ — cần confirm same-sequence → same-outcome, không second invocation | Long |
| R08 Race Stop/Resume | `resumeByReferee()` kiểm tra `pendingDisconnects` và `refereeConnected`; `pauseInternal()` idempotent | Concurrent race (Stop + Move cùng lúc) cần serialized lane test | Long |
| R09 Private source/memory lọt SSE | `history.service.ts`: `replayFor()` chỉ ghi public event types (whitelist 8 types) | Không ghi raw `payload` vào replay; nhưng `errors.details` có thể expose nếu `AppError.details` không được lọc | Long |
| R09 Canary leak | Chưa có canary test | Cần canary string trong source/memory/log; scan toàn bộ public surfaces | Đức (canary); Long (serializer fix nếu có leak) |
| R07 Controller giả | `move()`: kiểm tra `player(match, actor.userId)` và `currentTurn === player.side` | Bot move phải qua adapter nội bộ không phải body claim; cần verify | Nam (Bot); Long (route) |
| R07 Referee authority | `assertReferee()`: kiểm tra `refereeEnabled && refereeUserId === actor.userId && principal !== GUEST` | Guest không thể referee; đã enforced | Long (audit) |

### Visibility matrix từ FRS-D05 (cần test)
```
Dữ liệu: Board/moves/clocks/public revision → Theo quyền resource (test per-role)
Dữ liệu: source/JSON memory/private logs → Own resource còn hạn; không public
Dữ liệu: Session/recovery code → Không trong public response/log
Dữ liệu: Invite/room password → Chỉ actor được cấp quyền
```

---

## 4. Ownership

| Phạm vi | Owner |
|---|---|
| Tampered payload fixtures | **Đức** — thiết kế; không tự gọi internal APIs |
| Race schedule (Stop + Move concurrency) | **Đức** — thiết kế sequence; Long implement test infra nếu cần |
| Canary placement (source/memory/log) | **Đức** — thiết kế; **Nam** cài trong Bot runtime |
| Canary scan (toàn bộ surfaces) | **Đức** — chạy scan |
| `match.manager.ts`, `match.route.ts`, `history.service.ts` | **Long** — sửa nếu có gap |
| `bot-online.service.ts`, `bot-sdk` | **Nam** — Bot controller enforcement |
| DTO/projection/ACL per route | **Long** |
| SSE fan-out event filter | **Long** |
| Disposable DB cho crash tests | **Long** (cung cấp DB test); **Đức** chạy fixtures |

---

## 5. Waves

### D05-W1 — Tamper fixture design + canary placement spec
*T+8h → T+12h*

**Mục tiêu:** Thiết kế đủ tampered payload fixtures và canary spec trước khi có candidate.

**Đức làm:**
- `tests/security/anti-cheat-fixtures.ts`: fixture set D-04.01…07
- `tests/security/privacy-canary.ts`: canary spec, scan targets, scan procedure
- Document expected rejection per TASK_ID (code/message/no state change)

**Canary design (test data, không phải secrets thật):**
```
CANARY_SOURCE_2026   → inject vào bot source field
CANARY_MEMORY_2026   → inject vào bot memory field
CANARY_LOG_2026      → inject vào private bot log
Scan surfaces: HTTP responses, SSE events, history/detail/replay/audit,
               /metrics snapshot, /diagnostics/r3/provider, AppError.details
```

**Output:** Fixture spec file; canary scan procedure; tamper vectors list

**Exit gate:** Spec reviewed; canary strings confirmed test-only; **chưa chạy**

**Effort:** Đức 3h design

**Trạng thái:** DONE — Tamper fixtures (`tests/security/anti-cheat-fixtures.ts`), Canary spec (`tests/security/privacy-canary.ts`), Architecture spec (`tests/security/anti-cheat-runner.spec.md`), và unit tests verification (`tests/unit/anti-cheat-fixtures.unit.test.ts`) 8/8 PASS. Sẵn sàng handoff sang D05-W2 khi Long hoàn thành LD-04 và cấp disposable DB.

---

### D05-W2 — Authority + identity tampering tests
*T+12h → T+20h — BLOCKED chờ Long LD-04 candidate*

**Mục tiêu:** Chạy D-04.01, D-04.02, D-04.03, D-04.04 trên candidate Long.

**Điều kiện mở:** Long bàn giao L-05/L-06A candidate với match routes và disposable DB.

**Đức làm:**
- D-04.01: POST move/stop/surrender với sai userId/side/stateVersion → 409/403; board unchanged
- D-04.02: Verify rematch không cho client chọn seed; refresh không reroll
- D-04.03: Gửi cùng command sequence 2 lần → outcome giống, không second ACK; gửi unknown ACK → trace outcome
- D-04.04: Concurrent stop + move race → one outcome, đúng precedence
- Ghi: candidate hash, env, disposable DB ID, expected/actual, verdict

**Long làm (LD-04):**
- Serialized lane cho concurrent commands
- Idempotency fence documented
- Cung cấp disposable DB cho tests

**Output:** D-04.01…04 evidence report; findings list

**Exit gate:** Không P0/P1 payload bypass sau candidate; stateVersion fence verified

**Effort:** Đức 4h; chờ Long T+14h

**Trạng thái:** BLOCKED (chờ Long LD-04)

---

### D05-W3 — Crash boundaries + privacy canary
*T+18h → T+26h*

**Mục tiêu:** D-04.05, D-04.06, D-04.07, D-04.08 — crash/recovery và canary scan.

**Điều kiện mở:** Long candidate (history + SSE) + Nam Bot revision candidate + disposable DB.

**Đức làm:**
- D-04.05: Race revision/memory — submit revision A → cancel → revision B; verify no mixed state
- D-04.06: Referee flapping — disconnect/reconnect cycle; verify deadline không kéo; old ref mất control
- D-04.07: Kill server mid-commit; restart; verify recovered state = committed; no double Elo; no author penalty
- D-04.08: Inject canary vào source/memory/log; verify zero-match qua mọi public surface
- Ghi failpoints, recovery time, canary scan output

**Long làm:**
- History/audit/replay DTO không expose raw payload ngoài whitelist
- `AppError.details` không expose private data từ Bot

**Nam làm:**
- Bot private log không route vào public error/SSE

**Output:** Crash evidence; canary scan log (zero-match); D-04.05…08 verdict

**Exit gate:** D-04.08 canary zero-match; D-04.07 không double-ACK; D-04.05 no mixed board

**Effort:** Đức 5h; chờ Long+Nam candidates T+18h

**Trạng thái:** BLOCKED (chờ Long L-05; Nam N-04)

---

### D05-W4 — Retest + Sign-off input
*T+28h → T+34h*

**Mục tiêu:** Retest findings; aggregate D-04.01…08 verdict table cho D-07.

**Exit gate:** Tất cả P0/P1 resolved hoặc BLOCKED với lý do rõ; reviewer không phải Đức cho code Đức viết

**Effort:** Đức 2h

**Trạng thái:** NOT STARTED

---

## 6. Output từng Wave

| Wave | Artifact |
|---|---|
| D05-W1 | `tests/security/anti-cheat-fixtures.ts`; `tests/security/privacy-canary.ts`; tamper vector list |
| D05-W2 | D-04.01…04 evidence report; disposable DB IDs; findings |
| D05-W3 | Crash evidence (failpoints/recovery); canary scan log; D-04.05…08 verdict |
| D05-W4 | Retest log; D-04.01…08 final verdict table |

---

## 7. Files / Owner / Dependency

| File | Owner | Dependency |
|---|---|---|
| `tests/security/anti-cheat-fixtures.ts` (mới) | Đức | D01 policy; Long route spec |
| `tests/security/privacy-canary.ts` (mới) | Đức | Nam Bot memory/log placement |
| `match/match.manager.ts` | Long | Đức gửi findings |
| `match/match.route.ts` | Long | Đức gửi findings |
| `match/match.persistence.ts` | Long | Idempotency fence — đã có `appendEventWithFence`; audit cần xác minh |
| `history/history.service.ts` | Long | `replayFor()` whitelist đã có — cần confirm `errors.details` |
| `bot-online/bot-online.service.ts` | Nam | Controller enforcement |
| Disposable DB | Long (cung cấp) | Không dùng default DATABASE_URL |

---

## 8. Test / Evidence / Exit Gate

### Tamper fixture templates

```
# D-04.01-T1: Wrong side move
Setup: Player BLUE's turn
Action: BLUE sends move as RED (userId=RED's userId)
Expected: 403 FATAL_SESSION "NOT_MATCH_MEMBER" hoặc WRONG_TURN
Verify: board unchanged; no event appended; version unchanged

# D-04.03-T1: Duplicate command
Setup: Move sequence N accepted
Action: Resend identical move (same from/to/stateVersion-1 → stale)
Expected: 409 STALE_STATE + STATE_RESYNC; no second ACK
Verify: moves array length unchanged

# D-04.08-C1: Canary source scan
Setup: Bot source = "# CANARY_SOURCE_2026\n<valid code>"
Action: Run match; complete; view history/replay/audit/SSE/metrics
Expected: "CANARY_SOURCE_2026" không xuất hiện trong bất kỳ response nào
Verify: grep response bodies for canary string
```

### Evidence format
```
Test: D-04.<n>-T<m>
Candidate: <Long/Nam diff hash>
Environment: local Node; disposable DB: <DB identifier, not default URL>
Failpoint: <nếu crash test>
Command: <curl/test script>
Expected: <HTTP code + body>
Actual: [ghi khi chạy]
Board state verified: YES/NO
Verdict: NOT RUN
Reviewer: [không Đức cho code Đức viết]
```

---

## 9. Trạng thái

| Item | Trạng thái | Blocker |
|---|---|---|
| D05-W1 Fixture design | DONE | Không |
| D05-W2 Authority tests | BLOCKED | Long LD-04 candidate + disposable DB |
| D05-W3 Crash + canary | BLOCKED | Long L-05; Nam N-04 |
| D05-W4 Retest | NOT STARTED | W2/W3 |
| D-04.01…08 AC | NOT RUN | — |

---

## 10. Mandatory Gates và Residual Risks

**Release blockers:**
- D-04.01 payload bypass bất kỳ field → P0
- D-04.08 canary leak qua bất kỳ surface → P1
- D-04.07 double-ACK history/Elo → P1
- D-04.03 duplicate command tạo second execution → P1

**Residual risks được chấp nhận:**
- Race detection phụ thuộc serialized lane của Long — nếu LD-04 chậm thì D-04.04/05 BLOCKED
- Crash recovery test cần disposable DB riêng — không chạy trên default DATABASE_URL
- `AppError.details` của Fastify có thể expose thêm nếu Long không lọc — là finding nếu xảy ra

**KHÔNG được:**
- Chạy crash test trên production DB hoặc default DATABASE_URL
- Dùng canary strings là secret thật của người dùng
- Coi `replayFor()` whitelist = "không cần canary test" — phải test thực tế

---

## 11. Dependency / Critical Path trong 36 giờ

```
T+8h   Đức: D05-W1 fixture design (parallel D03-W2)
T+12h  CP-1: Đức giao tamper fixtures → Long confirm LD-04 coverage
T+14h  Long: LD-04 candidate + disposable DB → Đức bắt đầu D05-W2
T+18h  Đức: D05-W2 authority evidence; findings → Long
T+18h  Long+Nam: candidates L-05/N-04 → Đức bắt đầu D05-W3
T+26h  Đức: D05-W3 crash+canary evidence
T+28h  Long/Nam fix findings → Đức retest D05-W4
T+34h  Verdict input cho D-07
```

**Critical dependency:** Long LD-04 (commit fence/serialized lane + disposable DB) → blocker quan trọng nhất. Nam N-04 (Bot controller, private log routing) cho D-04.05/08.
