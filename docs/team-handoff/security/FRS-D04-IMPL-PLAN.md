# FRS-D04 — Offline Sandbox Security: Implementation Plan

| Thuộc tính | Giá trị |
|---|---|
| **TASK_ID** | D-03 (scope: D-03.OFF) |
| **FRS** | [FRS-D04-OFFLINE-SANDBOX.md](FRS-D04-OFFLINE-SANDBOX.md) |
| **Owner chính** | Đức (test/fixtures); Nam (compartment/Worker/fix) |
| **Trạng thái** | IN PROGRESS (D04-W1 DONE) |
| **Deadline** | 00:00 12/10/2026 UTC+7 (~36h) |

> **CHỜ DUYỆT.** Không sửa application code, không commit/push/deploy.
> Hostile fixtures CHỈ chạy trong browser test boundary đã xác minh.
> Browser không có hard CPU/RAM guarantee tương đương server — ghi đo thực tế, không hứa.

---

## 1. Objective / Security Outcome

Bot Offline không đọc renderer credentials/DOM/storage, không truy cập network, không lấy dữ liệu Bot khác. Kết quả local không dùng để cộng Elo Online.

**Người dùng hợp lệ thấy gì:**
- Bot chạy trong Offline mode; Pause/Step/Speed hoạt động đúng
- Mất mạng sau chuẩn bị → cold launch chạy được từ cache
- Kit sai hash → thông báo lỗi rõ; không fallback server/native

**Tấn công bị chặn:**
- Python đọc `document.cookie` → canary không lộ ra bridge
- `fetch()` từ compartment → blocked bởi CSP
- Forged bridge message từ window → rejected (wrong source/kind)
- Two-slot: slot-A không đọc memory slot-B

---

## 2. AC / DoD

| TASK_ID | Acceptance Criteria |
|---|---|
| D-03.OFF-01 | Kit pins + runtime attestation: known-valid source chạy qua consumer; sửa/mất một asset chặn chạy; presence-only không thành Ready |
| D-03.OFF-02 | DOM/cookie/storage/network/JS bridge probes: canaries không bị đọc/gửi; capability denial trong compartment **thật** (không chỉ AST rejection) |
| D-03.OFF-03 | Forged/duplicate/stale/oversized bridge messages: không đổi local state, không reset watchdog, không nhận kết quả invocation cũ |
| D-03.OFF-04 | Loop/allocation/recursion/output flood/bootstrap stall: deadline/memory/output bounds có đo; cleanup xong; UI còn điều khiển được trong test profile |
| D-03.OFF-05 | Two-slot/cross-turn/revision memory: không leakage; memory round-trip đúng; preserve/reset chỉ đúng lựa chọn/schema |
| D-03.OFF-06 | Pause/Step/unmount/cancel và late result: một commit hợp lệ; không worker/frame/port/timer leak sau repeated cycles |
| D-03.OFF-07 | Warm-up → đóng tab → network disabled → cold route: shell/runtime đủ; chạy Bot thật sau verify; restore paused |
| D-03.OFF-08 | Author vs infrastructure error paths: đúng reason; không fake move, false author loss hoặc silent reset |
| D-03.OFF-09 | Principal switch/cache/export/restore: không dùng private cache owner trước; export đúng local scope; local result không thành Online authority |

**DoD:** D-03.OFF-01…09 có evidence runtime/browser thật; thiếu browser/device evidence phải ghi rõ, không gắn PASS cho device giả lập như máy thật. Historical attestation và mock Worker không thay adversarial consumer/cold Offline evidence.

---

## 3. Risk và Control

| Risk (từ D-01) | Control expected | Cần xác minh bằng browser thật | Owner |
|---|---|---|---|
| R05 Bot đọc DOM/cookie/storage | Opaque iframe sandbox `sandbox=""` không allow-same-origin; CSP deny fetch/XHR | D-03.OFF-02: inject canary vào DOM/cookie → check bridge không trả về canary | Nam (compartment); Đức (probe) |
| R05 Bridge injection | Private MessageChannel; kiểm tra source/kind/phase/invocation ID | D-03.OFF-03: forged window message → không đổi state | Nam (bridge validation) |
| R05 Cross-slot leak | Per-turn fresh compartment; chỉ own committed memory | D-03.OFF-05: slot-A/B isolation | Nam |
| R06 Loop/OOM browser | Host watchdog timer độc lập; bootstrap + compute deadline | D-03.OFF-04: loop → deadline; đo cleanup + UI responsiveness | Nam |
| R11 Kit integrity | Hash verification trước dùng; cache presence ≠ readiness | D-03.OFF-01: sửa/mất asset → fail closed | Nam |
| R12 Cold Offline | Service Worker cache public shell/runtime/assets | D-03.OFF-07: network disabled cold launch | Nam |
| R09 Local result → Online Elo | Server không nhận Offline outcomes; local authority không tích hợp | D-03.OFF-09: local result không thành Elo | Long (server side); Nam (client side) |

**Lưu ý quan trọng:** Browser không có hard process isolation tương đương Wasmtime. Kết quả Offline không thể tuyên bố "cùng mức an toàn server sandbox." Ghi đo thực tế và giới hạn rõ.

---

## 4. Ownership

| Phạm vi | Owner |
|---|---|
| Offline probe fixtures (content) | **Đức** — thiết kế canary và hostile payload |
| Compartment, Worker, opaque iframe, bridge validation | **Nam** — implement và fix |
| Service Worker, cache policy | **Nam** |
| Kit integrity, attestation | **Nam** |
| ABI/error/version contract delta ảnh hưởng consumer | **Long** (LD-04) — nếu có shared delta |
| Browser evidence collection | **Đức** chạy trên candidate Nam cung cấp |

---

## 5. Waves

### D04-W1 — Probe design + Consumer path mapping
*T+4h → T+10h*

**Mục tiêu:** Thiết kế đầy đủ browser probe fixtures và map consumer path Offline.

**Đức làm:**
- `tests/security/offline-probes.ts`: probe spec cho D-03.OFF-01…09
- Canary design: `CANARY_DOM_OFFLINE_2026`, `CANARY_COOKIE_OFFLINE_2026` (test data string, không phải secrets)
- Document bridge attack vectors (forged source, wrong kind, stale invocation ID)
- Map cold Offline consumer path: route → Service Worker → kit → compartment

**Output:** Probe spec file; canary design doc; consumer path diagram

**Exit gate:** Spec reviewed; canary strings xác nhận là test data; **chưa chạy**

**Trạng thái:** DONE — Probe registry (`tests/security/offline-probes.ts`), Runner spec & Consumer path mapping (`tests/security/offline-runner.spec.md`), và unit tests verification (`tests/unit/offline-probes.unit.test.ts`) 7/7 PASS. Sẵn sàng bàn giao spec cho Nam N-05 candidate.

---

### D04-W2 — Browser sandbox tests (khi có Nam candidate + browser)
*T+12h → T+22h — BLOCKED chờ N-05 Offline candidate*

**Mục tiêu:** Chạy D-03.OFF-01…08 trong browser thật với opaque iframe consumer.

**Điều kiện mở:** Nam bàn giao N-05 Offline candidate và xác nhận compartment setup.

**Đức làm:**
- Setup browser test environment (Chromium/Firefox thật, không headless giả lập)
- Inject canary vào DOM/cookie; chạy Bot; kiểm tra bridge output không chứa canary
- Forge bridge message; verify state không đổi
- Chạy loop → verify timeout + cleanup + UI responsive
- Ghi: browser/version/OS, kit SHA, expected/actual, measurements

**Nam làm:**
- Cung cấp Offline candidate chạy được trong browser
- Fix findings; cung cấp retest candidate

**Output:** Browser evidence report (không dùng device giả lập); findings list

**Exit gate:** D-03.OFF-02 canary denial trong browser thật; D-03.OFF-06 no leak after cycles

**Trạng thái:** BLOCKED (chờ Nam N-05)

---

### D04-W3 — Cold Offline + Principal isolation
*T+18h → T+26h*

**Mục tiêu:** D-03.OFF-07 (cold launch), D-03.OFF-09 (principal isolation).

**Điều kiện mở:** Có browser environment và Service Worker setup.

**Đức làm:**
- D-03.OFF-07: warm-up → close tab → disable network → navigate → verify Bot runs from cache
- D-03.OFF-09: login user-A → play Offline → switch to user-B → verify no cache bleed
- Verify local Offline result không trigger Elo update server-side (Long confirm)

**Nam làm:**
- Service Worker cache scoping; principal namespace isolation

**Long làm:**
- Confirm server không accept Offline outcome để cộng Elo

**Output:** Cold launch evidence; principal switch evidence; Elo non-attribution confirmation

**Exit gate:** D-03.OFF-07 PASS; D-03.OFF-09 PASS; local result không thành Online authority

**Trạng thái:** BLOCKED (chờ Nam N-05; Long confirm)

---

### D04-W4 — Retest + Verdict
*T+26h → T+34h*

**Mục tiêu:** Retest fixes từ W2/W3; aggregate D-03.OFF-01…09 verdict.

**Exit gate:** Tất cả findings có owner/fix/retest; BLOCKED items ghi lý do rõ; không tự PASS nếu chưa chạy browser thật

**Trạng thái:** NOT STARTED

---

## 6. Output từng Wave

| Wave | Artifact |
|---|---|
| D04-W1 | `tests/security/offline-probes.ts`; canary design; consumer path diagram |
| D04-W2 | Browser evidence report (browser/version/OS/kit SHA); findings; D-03.OFF-01…08 verdict |
| D04-W3 | Cold launch evidence; principal isolation evidence; Elo non-attribution confirmation |
| D04-W4 | Retest log; full D-03.OFF-01…09 verdict table |

---

## 7. Files / Owner / Dependency

| File | Owner | Dependency |
|---|---|---|
| `tests/security/offline-probes.ts` (mới) | Đức | D01 policy; Nam compartment spec |
| Offline compartment/Worker/iframe | Nam | Đức gửi probe spec |
| Bridge validation logic | Nam | Đức probe W1 |
| Service Worker cache | Nam | Đức D04-W3 |
| ABI/error contract delta | Long (nếu có) | Nam Offline consumer |
| Server Elo endpoint | Long | Confirm không nhận Offline result |

---

## 8. Test / Evidence / Exit Gate

### Probe templates

```
# D-03.OFF-02: DOM canary probe
Setup: inject "CANARY_DOM_OFFLINE_2026" vào document.cookie và DOM
Action: Offline Bot runs (valid source)
Check: Bridge message output không chứa canary string
Verify: compartment được cô lập (opaque origin)
Evidence: browser console log + bridge message trace

# D-03.OFF-03: Forged bridge message
Setup: postMessage từ window (không phải Private MessageChannel)
Action: Worker/iframe nhận
Check: State không đổi; no watchdog reset
Evidence: Offline game state unchanged before/after forged message
```

### Evidence format
```
Test: D-03.OFF-<n>
Candidate: <Nam commit/diff hash>
Browser: Chrome <version> / Firefox <version>
OS: <platform>
Kit: <kit version / SHA>
SDK: <version / pins>
Command: [test procedure — manual browser + devtools hoặc Playwright]
Expected: [behavior]
Actual: [ghi khi chạy]
Verdict: NOT RUN (chờ browser environment)
Reviewer: [không Đức cho code Đức viết]
```

> **Lưu ý:** Warm tab, fake Worker, kit presence-only không đủ làm evidence cho D-03.OFF. Phải có real opaque iframe/Worker consumer.

---

## 9. Trạng thái

| Item | Trạng thái | Blocker |
|---|---|---|
| D04-W1 Probe design | DONE | Không |
| D04-W2 Browser tests | BLOCKED | Nam N-05 Offline candidate + browser env |
| D04-W3 Cold/principal | BLOCKED | Nam N-05; Long server confirm |
| D04-W4 Retest | NOT STARTED | W2/W3 |
| D-03.OFF-01…09 AC | NOT RUN | — |

---

## 10. Mandatory Gates và Residual Risks

**Release blockers:**
- Canary DOM/cookie leak qua bridge → P1
- Forged window message thay đổi Offline state → P1
- Kit hash bypass (presence-only → Ready) → P1
- Offline result cộng Elo Online → P0

**Residual risks được chấp nhận:**
- Browser không có hard CPU/RAM guarantee: ghi đo thực tế (linear memory ABI ≠ RAM tổng); không hứa isolation tuyệt đối
- Máy/browser người dùng đã bị sửa: ngoài control của app
- Cold Offline phụ thuộc Service Worker spec của browser — ghi browser/version evidence rõ

**KHÔNG được:**
- Dùng headless mode giả lập làm evidence thay browser thật
- Coi AST rejection là "capability denied" — phải test trong compartment thật
- Startup attestation thành công ≠ production release approval

---

## 11. Dependency / Critical Path trong 36 giờ

```
T+4h  Đức: D04-W1 probe design (parallel D03-W1)
T+10h CP-1: Báo Nam cần N-05 Offline candidate + browser env
T+12h Nam: Offline candidate → Đức bắt đầu D04-W2
T+18h Đức: D04-W2 browser evidence
T+20h Nam fix findings → Đức D04-W3
T+26h Đức: cold/principal evidence
T+30h Retest findings → D04-W4
T+34h Verdict input cho D-07
```

**Critical dependency:** Nam N-05 Offline candidate + browser environment. Nếu không có browser thật → D-03.OFF-02, OFF-04, OFF-06, OFF-07 = BLOCKED → ghi rõ trong D-07 matrix.
