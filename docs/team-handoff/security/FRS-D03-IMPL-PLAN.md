# FRS-D03 — Online Sandbox Security: Implementation Plan

| Thuộc tính | Giá trị |
|---|---|
| **TASK_ID** | D-03 (scope: D-03.ON) |
| **FRS** | [FRS-D03-ONLINE-SANDBOX.md](FRS-D03-ONLINE-SANDBOX.md) |
| **Owner chính** | Đức (test/review); Nam (runtime/fix); Long (admission/commit integration) |
| **Trạng thái** | IN PROGRESS (D03-W1 DONE) |
| **Deadline** | 00:00 12/10/2026 UTC+7 (~36h) |

> **CHỜ DUYỆT.** Không sửa application code, không commit/push/deploy, không chạy load test.
> Hostile fixtures CHỈ chạy trong test boundary đã xác minh — không chạy player Python native subprocess không hạn chế.

---

## 1. Objective / Security Outcome

Python của người chơi không đọc dữ liệu server/Bot khác, vượt quyền trận, hoặc giữ tài nguyên vô hạn. Runtime đã pin và harness hiện có; fixtures bao phủ đủ threat groups; không mở fuzzing diện rộng hoặc đổi kiến trúc.

**Người dùng hợp lệ thấy gì:**
- Bot Python hợp lệ chạy preflight/lượt → legal move được commit
- Lỗi code rõ lý do (author fault vs infra fault)
- Bot bị timeout: trận adjudicate đúng policy; không xử thua do hạ tầng

**Tấn công bị chặn:**
- Python mở socket → blocked (Wasmtime `network:false`)
- Python đọc `/proc/`, `/etc/` → blocked (`filesystem:false`)
- Loop vô hạn → timeout trong `perTurnMs=500ms`
- OOM → kill + reclaim; không chiếm tài nguyên mãi
- Output > 16 KiB → reject trước commit
- Hash mismatch artifact → fail closed, không fallback native Python

---

## 2. AC / DoD

| TASK_ID | Acceptance Criteria |
|---|---|
| D-03.ON-01 | Known-valid ABI source chạy preflight và turn qua **application consumer thật** (không chỉ direct probe); tạo legal move được authority chấp nhận |
| D-03.ON-02 | Network/secrets/env/filesystem canary probe → bị chặn; canary test không lộ; sentinel là test data, không dùng secrets thật |
| D-03.ON-03 | Loop/sleep/OOM/recursion/output flood → dừng trong configured bounds; peak resources và reclaim được đo |
| D-03.ON-04 | Missing/malformed/multi-result output, NaN, memory oversize/depth, illegal move, forged timing → reject trước commit; board/memory/result không đổi |
| D-03.ON-05 | Hai Bot, globals/temp leftovers, memory reset/round-trip → không cross-Bot/cross-invocation leakage; chỉ own committed memory |
| D-03.ON-06 | Pause/cancel/timeout/revision race + repeated abort → không late/double commit; process/timer/temp/reservations không leak; capacity reclaimed |
| D-03.ON-07 | Asset missing/hash mismatch/bootstrap failure → fail closed; không fallback native Python; không public diagnostics riêng |
| D-03.ON-08 | Preflight flood + real runtime + API/trận hợp lệ → queue/concurrency hữu hạn; gameplay reserve/SLO L07 đạt; rejection đếm, không gọi rejected là served |
| D-03.ON-09 | Linux/provider real-consumer gate trên candidate được phép kiểm tra → môi trường/pins/limits/admission/cancel/reclaim/consumer evidence; local/mock không thay provider proof |

**DoD:** D-03.ON-01…09 nối vào matrix chung; Online runtime report: candidate hash, OS/arch/provider, runtime/SDK/pins/config, expected/actual, measurements, verdict/reviewer. Không P0/P1 hoặc isolation/privacy/correctness blocker mở.

---

## 3. Risk và Control

| Risk (từ D-01) | Control hiện có (source) | Gap | Owner fix |
|---|---|---|---|
| R04 Python network/secrets/fs escape | `wasmtime.adapter.ts`: `network:false, filesystem:false, secrets:false, applicationMounts:false` | Chưa có hostile fixture chạy qua application consumer thật | Đức (fixtures); Nam (nếu phát hiện gap) |
| R06 Loop/OOM | `wasmtimeFuel=300M`, `wasmMemoryPages=1024`, watchdog `hostTimer` + `computeTimer` | `occupied` flag là in-process — race khi restart server; không per-principal queue | Long (admission); Nam (nếu adapter cần fix) |
| R06 Output flood | `MAX_CAPTURE_BYTES = outputBytes * 4`; kill khi vượt | Kill không có confirmed exit; reclaim chưa được đo | Nam (confirm exit/reclaim) |
| R04/R06 Asset integrity | SHA-256 pin: `wasmtimeSha256`, `cpythonWasmSha256`; verify trước execute | `verification` promise cache không reset khi binary thay — hash mismatch chỉ fail lần đầu | Nam (reset on mismatch) |
| R06 Preflight flood | `preflightWaiting` flag (1 candidate wait); `WasmtimeBusyError` | Không có per-principal quota; không ưu tiên gameplay vs preflight | Long (admission reserve) |
| R08 Late output commit | In `bot-online.service.ts` — cần verify invocation token/epoch fence | Cần runtime evidence từ Nam candidate | Nam |

### Giới hạn đã pin (manifest.ts — đã xác minh)
```
sourceBytes:    64 KiB
memoryBytes:    8 KiB, depth 32
outputBytes:    16 KiB
privateLogBytes: 16 KiB
preflightMs:    250 ms
perTurnMs:      500 ms
wholeMatchMs:   30.000 ms
wasmFuel:       300.000.000
wasmMemoryPages: 1.024 (= 64 MiB linear)
admission:      "single"
network/filesystem/secrets: false
```

---

## 4. Ownership

| Phạm vi | Owner |
|---|---|
| Hostile Python fixtures (file content) | **Đức** — tạo test files, không chạy native |
| Fixture runner/harness chạy qua app consumer | **Đức** (design); **Nam** (nếu cần adapter fix để chạy được) |
| Runtime adapter, watchdog, reclaim, per-principal quota | **Nam** |
| Admission reserve, invocation commit fence | **Long** |
| SHA-256 pin, bootstrap verification | **Nam** (runtime side); **Long** (app.ts config) |
| Online runtime report | **Đức** (aggregate); **Nam** (runtime measurements) |

---

## 5. Waves

### D03-W1 — Fixture design + Consumer path verification
*T+4h → T+10h*

**Mục tiêu:** Chuẩn bị đủ hostile Python fixtures; xác minh consumer path (application consumer thật, không direct probe).

**Đức làm:**
- `tests/security/bot-sandbox-fixtures.ts`: fixture set cho D-03.ON-02…07
- Mỗi fixture: known-valid control + hostile variant + expected denial
- Canary sentinel: test data string (KHÔNG phải secrets thật)
- Viết fixture runner spec (test harness chạy qua BotOnlineService API, không spawn trực tiếp)

**Nam làm (khi có candidate):**
- Xác nhận consumer path cho D-03.ON-01 (valid Bot chạy được qua app)
- Báo gaps nếu adapter không hỗ trợ fixture runner

**Output:** Fixture file; fixture runner spec; consumer path diagram

**Exit gate:** Fixture file reviewed; consumer path documented; **chưa chạy vì chờ Nam candidate**

**Trạng thái:** DONE — Fixtures file (`tests/security/bot-sandbox-fixtures.ts`), Runner spec & Consumer path diagram (`tests/security/bot-sandbox-runner.spec.md`), và unit tests verification (`tests/unit/bot-sandbox-fixtures.unit.test.ts`) 7/7 PASS. Sẵn sàng handoff sang D03-W2 khi có Nam N-01/N-04 candidate.

---

### D03-W2 — Runtime boundary tests (khi có Nam candidate)
*T+10h → T+18h — BLOCKED chờ N-01/N-04*

**Mục tiêu:** Chạy D-03.ON-01…07 qua application consumer thật; đo peak resources; xác nhận reclaim.

**Điều kiện mở:** Nam bàn giao N-01/N-04 runtime candidate với admission working.

**Đức làm:**
- Chạy fixtures D-03.ON-01…07 theo trình tự
- Ghi: environment (OS/arch/Node version), runtime pins (SHA-256), `perTurnMs`/`preflightMs` measured, peak RSS, cleanup time
- Nếu phát hiện gap → finding với severity/owner/repro; giao Nam fix

**Nam làm:**
- Cung cấp candidate; sửa findings và bàn giao retest candidate

**Output:** Runtime evidence report; findings list với severity

**Exit gate:** D-03.ON-01…07 PASS hoặc FAIL với evidence; không ghi PASS nếu chưa chạy

**Trạng thái:** BLOCKED (chờ Nam N-01/N-04 candidate)

---

### D03-W3 — Preflight flood + admission regression
*T+14h → T+22h — BLOCKED chờ Long LD-03*

**Mục tiêu:** D-03.ON-08: preflight flood không chiếm gameplay reserve.

**Điều kiện mở:** Long bàn giao LD-03 admission candidate.

**Đức làm:**
- Fixture: burst preflight requests + concurrent legitimate gameplay
- Đo: admitted/rejected counts; gameplay SLO trong measured profile
- Xác nhận `rejection` không gọi là "served"

**Long làm:**
- Admission reserve; separate preflight quota; NORMAL/PRESSURE mode

**Output:** Flood test report; counter traces; SLO evidence

**Exit gate:** D-02.08 counters hữu hạn; D-03.ON-08 gameplay reserve intact

**Trạng thái:** BLOCKED (chờ Long LD-03)

---

### D03-W4 — Provider gate + retest
*T+24h → T+32h — BLOCKED chờ authorization*

**Mục tiêu:** D-03.ON-09: Linux/provider real gate. Nếu chưa có authorization → ghi BLOCKED.

**Điều kiện mở:** Authorization riêng để test trên provider/Linux environment.

**Đức làm:**
- Nếu có auth: chạy D-03.ON-09 trên target; ghi provider evidence
- Nếu không có: ghi `D-03.ON-09: BLOCKED — authorization chưa được cấp`
- Retest fixes từ D03-W2

**Output:** Provider evidence hoặc BLOCKED verdict; retest log

**Exit gate:** D-03.ON-09 PASS hoặc BLOCKED với lý do rõ; findings từ W2 đã retest

**Trạng thái:** BLOCKED (chờ authorization)

---

## 6. Output từng Wave

| Wave | Artifact |
|---|---|
| D03-W1 | `tests/security/bot-sandbox-fixtures.ts`; consumer path diagram; fixture runner spec |
| D03-W2 | Runtime evidence report (OS/pins/measurements); findings list; D-03.ON-01…07 verdict |
| D03-W3 | Flood test report; counter/metric trace; SLO evidence |
| D03-W4 | Provider evidence hoặc BLOCKED verdict; retest log |

---

## 7. Files / Owner / Dependency

| File | Owner | Dependency |
|---|---|---|
| `tests/security/bot-sandbox-fixtures.ts` (mới) | Đức | D01-W2 policy; manifiest limits |
| `apps/server/src/modules/bot-online/wasmtime.adapter.ts` | Nam | Đức gửi findings |
| `apps/server/src/modules/bot-online/bot-online.service.ts` | Nam | Đức gửi findings về fence/reclaim |
| Admission config trong `app.ts` | Long | LD-03 |
| `packages/bot-sdk/src/manifest.ts` | Nam | Chỉ đọc; không tự sửa giới hạn để pass gate |

---

## 8. Test / Evidence / Exit Gate

### Fixture template

```
# D-03.ON-02: Network capability denial
Fixture: Python source = "import socket; socket.connect(('8.8.8.8', 53))"
Canary sentinel: "CANARY_NETWORK_TEST_2026" (test data, không phải secret thật)
Consumer path: BotOnlineService.runPreflight() → WasmtimeAdapter → result
Expected: RuntimeError / WasmtimeBusyError / BotOutputValidationError
Actual: [ghi khi chạy]
Verify: process exit; no outbound connection in netstat; canary not in any response
```

```
# D-03.ON-03: Loop timeout
Fixture: Python source = "while True: pass"
Consumer path: BotOnlineService.runTurn()
Expected: timeout within 500ms + WasmtimeProviderError "compute timeout"
Actual: [ghi khi chạy]
Verify: measured computeMs <= perTurnMs; RSS returned to baseline within 2s
```

### Evidence format
```
Test: D-03.ON-<n>
Candidate: <Nam diff/commit hash>
Environment: local test; Node v<X>; OS <Y>; DB test separate
Runtime: wasmtime SHA=<hash>; cpython SHA=<hash>; limits from manifest.ts
Command: [test harness command — không phải native Python invoke]
Expected: [behavior]
Actual: [ghi khi chạy]
Measurements: computeMs=<X>, RSS peak=<Y>MB, cleanup time=<Z>ms
Verdict: NOT RUN / PASS / FAIL
Reviewer: [không Đức nếu code Đức viết]
```

---

## 9. Trạng thái

| Item | Trạng thái | Blocker |
|---|---|---|
| D03-W1 Fixture design | DONE | Không |
| D03-W2 Runtime tests | BLOCKED | Nam N-01/N-04 candidate |
| D03-W3 Preflight flood | BLOCKED | Long LD-03 |
| D03-W4 Provider gate | BLOCKED | Authorization riêng |
| D-03.ON-01…09 AC | NOT RUN | — |

---

## 10. Mandatory Gates và Residual Risks

**Release blockers (phạm vi D-03.ON):**
- Bất kỳ isolation bypass (network/fs/secrets) → P0
- Late output commit sau Stop/revision → P1
- Reclaim không xảy ra → P1

**Residual risks được chấp nhận:**
- D-03.ON-09 provider gate: BLOCKED nếu chưa có authorization → ghi NOT RUN, không PASS
- `occupied` flag là in-process: restart server có thể reset — ghi là known gap; Long fix khi có candidate
- Linear memory 64 MiB không phải tổng RSS; ghi đo actual RSS riêng

**KHÔNG được:**
- Chạy player Python bằng native subprocess không hạn chế để test
- Dùng direct Wasmtime probe thay application consumer (D-03.ON-01 bắt buộc consumer)
- Coi exit code ≠ 0 đơn thuần là "isolated"
- Tăng limits hoặc tắt watchdog để sample pass gate

---

## 11. Dependency / Critical Path trong 36 giờ

```
T+4h  Đức: D03-W1 fixtures design (parallel với D02-W1)
T+8h  CP-1: Báo Nam cần N-01/N-04 candidate
T+10h Nam: runtime candidate → Đức bắt đầu D03-W2
T+14h Long: LD-03 admission → Đức bắt đầu D03-W3
T+22h Đức: D03-W2+W3 evidence; findings → Nam/Long
T+26h Nam/Long fix findings → Đức retest (D03-W4 nếu có auth)
T+32h Verdict cho D-07 input
```

**Critical dependency:** Nam N-01/N-04 là blocker duy nhất quan trọng nhất của D-03. Nếu candidate không đến T+10h → báo ngay, không đợi.
