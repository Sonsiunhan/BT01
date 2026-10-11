# FRS-D06 — Operations & Data Security: Implementation Plan

| Thuộc tính | Giá trị |
|---|---|
| **TASK_ID** | D-05 |
| **FRS** | [FRS-D06-OPERATIONS-DATA-SECURITY.md](FRS-D06-OPERATIONS-DATA-SECURITY.md) |
| **Owner chính** | Đức (audit/policy/harness); Long (ops/admission/data/config); Nam (runtime/private data) |
| **Trạng thái** | NOT STARTED |
| **Deadline** | 00:00 12/10/2026 UTC+7 (~36h) |

> **CHỜ DUYỆT.** Không sửa application code, không commit/push/deploy, không mutation DB mặc định.
> Restore rehearsal chỉ trên DB test đã xác minh riêng. Không bật billing hoặc paid services.

---

## 1. Objective / Security Outcome

Giảm rò rỉ dữ liệu và ngăn spam workload phụ làm cạn ngân sách trận đang chạy. Dùng metrics/logs/config hiện có; không thêm dashboard quản trị, SIEM, WAF, CAPTCHA, hoặc module tổ chức giải đấu mới.

**Người dùng hợp lệ thấy gì:**
- Không thay đổi UX ở normal load
- 503/429 khi hệ thống PRESSURE nhưng gameplay reserve còn ngân sách
- Lỗi không chứa stack trace, cookie, token, source Bot, hay private IDs

**Tấn công bị chặn:**
- Secret/credential không xuất hiện trong bất kỳ public response/log nào
- Metrics label không tăng unbounded từ random URL/IDs
- Private cache của user-A không phục vụ user-B sau logout/switch
- Expired source/log access bị deny dù GC chưa chạy

---

## 2. AC / DoD

| TASK_ID | Acceptance Criteria |
|---|---|
| D-05.01 | Canary credentials không xuất hiện trên public output/report; lỗi sanitizer có regression; secrets không trong Git/bundle/config được check-in |
| D-05.02 | Random paths/IDs + denial flood không tăng label/log storage vô hạn; public `/metrics` và `/diagnostics/r3/provider` whitelist đúng; `p95/p99` từ L07 có |
| D-05.03 | Hai principals, logout/revoke, warm cache/cold routes không trả private data sai owner; Service Worker scope isolation |
| D-05.04 | Pins/notices/versions và findings có owner/severity; exact candidate runtime gate đúng; không dùng evidence cũ để mở gate |
| D-05.05 | Time-travel expiry và cleanup delay vẫn deny; active refs/Library/replay giữ đúng; backup access và test restore có evidence |
| D-05.06 | Legit+spam workload: PRESSURE/cooldown/recovery đúng, resources bounded; không sai/mất/double ACKed move; commands/expected/actual rõ |

**DoD:** D-05.01…06 có sanitized evidence trong matrix chung; runbook đã có người khác làm theo trên test target; findings có fix/retest; không P0/P1 hoặc privacy/correctness blocker mở. Test chưa được phép/chưa có environment → BLOCKED/NOT RUN. Không thay production, bật billing hoặc migrate DB chung.

---

## 3. Risk và Control

| Risk (D-01) | Control hiện có (source) | Gap | Owner fix |
|---|---|---|---|
| R11 Secrets trong Git/bundle/log | `error-handler.ts`: `publicEnvelope()` chỉ expose `code/message/retryable/severity/details`; không stack trace | `AppError.details` có thể chứa internal field nếu caller không lọc; cần grep CI artifact | Long/Nam |
| R11 Metrics label cardinality | `MetricsRegistry`: key = `METHOD path` (route template từ Fastify); `MAX_SAMPLES_PER_ROUTE=200` | Key là `routeOptions.url` (template), không raw URL → cardinality bounded. Cần xác minh 404 route (unknown paths) không fan-in vào một key | Long |
| R11 `/diagnostics/r3/provider` | `r3-provider.route.ts`: trả JSON schema-validated; không expose filesystem path hoặc parser details | Public endpoint không auth-gated; content phụ thuộc evidence file format — cần xác minh không expose private IDs | Long (audit) |
| R12 Cache isolation | Session cookie HttpOnly; SameSite=Lax | Service Worker scope isolation chưa verified; `ETag`/`Vary` header policy chưa rõ | Nam (SW scope); Long (HTTP headers) |
| R12 Retention | `history.service.ts`: `audit()` trả `sourceUntil = endedAt + 30d`, `logsUntil = endedAt + 7d` — đây là computed policy, chưa có enforcement deny | Deny access khi hết hạn dù GC chưa chạy — chưa có enforcement layer | Long |
| R06 NORMAL/PRESSURE/RECOVERY | `MetricsRegistry.snapshot()`: counters có; không có admission mode | Không có PRESSURE detection/switch — chỉ có counters, không có gate logic | Long (LD-03/LD-07) |
| R06 Log volume | Logger từ Fastify built-in (pino); level từ env.LOG_LEVEL | Không thấy log size/TTL/cardinality limit trong source — cần confirm pino config | Long |
| R05 Backup access | Không thấy backup/export endpoint trong source | `FileMatchPersistence` writes mode `0o600` (owner-only) | Long (audit backup access) |

### Controls đã có (xác minh từ source)
```
error-handler.ts: sanitized response (no stack/path/internal)
metrics.ts: MAX_SAMPLES_PER_ROUTE=200 + template key (bounded)
match.persistence.ts: mode 0o600 file; fsync+rename atomic
history.service.ts: retention timestamps computed
r3-provider.route.ts: schema-validated; no filesystem path exposed
auth.service.ts: DUMMY_PASSWORD_HASH prevents timing leak
```

---

## 4. Ownership

| Phạm vi | Owner |
|---|---|
| Canary credential design + scan | **Đức** (test data; không secret thật) |
| Audit checklist (secrets/Git/bundle) | **Đức** (scan pattern); owners fix |
| Dependency/artifact review | **Đức** (inventory); **Nam** (runtime pins); **Long** (build/SDK) |
| `MetricsRegistry`, label bound audit | **Long** |
| `/diagnostics/r3/provider` content audit | **Long** |
| Admission NORMAL/PRESSURE/RECOVERY | **Long** (LD-03/LD-07) |
| Log level/volume/TTL config | **Long** |
| Retention enforcement (deny expired) | **Long** |
| Cache headers / Service Worker scope | **Long** (HTTP); **Nam** (SW) |
| Bot private log cleanup | **Nam** |
| Runtime pins (wasmtime/cpython SHA-256) | **Nam** |
| Runbook | **Long** drafts; **Đức** reviews; không self-publish |

---

## 5. Waves

### D06-W1 — Secret audit + metrics/diagnostics review
*T+8h → T+14h*

**Mục tiêu:** D-05.01 (secret scan), D-05.02 (metrics/diagnostics whitelist), D-05.04 (dependency pins).

**Đức làm:**
- Design canary credentials (test-only strings, không phải secrets thật):
  ```
  CANARY_CRED_ENV_2026   → inject vào test env var
  CANARY_CRED_LOG_2026   → inject vào error payload
  ```
- Scan: không có trong any public response, log, `/metrics`, `/diagnostics/r3/provider`
- Audit `AppError.details` field: có field nào expose internal data không?
- Audit `/diagnostics/r3/provider`: content có private IDs/paths không?
- Inventory dependencies: runtime pins (wasmtime/cpython SHA-256), SDK version, licenses

**Long làm:**
- Xác nhận 404 routes không dùng raw URL làm metrics key
- Xác nhận log level/volume/TTL config có bounds
- `AppError.details` audit — lọc nếu cần

**Nam làm:**
- Confirm runtime pin versions; xem có vulnerability trong direct deps không

**Output:**
- `tests/security/ops-audit-checklist.md`: scan targets + findings
- Dependency inventory (runtime/SDK/direct deps + versions + vulnerability status)

**Exit gate:** D-05.01 canary zero-match; D-05.02 label bound confirmed; D-05.04 pins verified

**Effort:** Đức 3h; chờ Long/Nam confirm T+12h

**Trạng thái:** NOT STARTED

---

### D06-W2 — Cache isolation + retention enforcement
*T+12h → T+20h — BLOCKED chờ Long LD-05*

**Mục tiêu:** D-05.03 (cache/principal isolation), D-05.05 (retention/export/backup).

**Điều kiện mở:** Long bàn giao LD-05 candidate với retention deny và cache headers.

**Đức làm:**
- D-05.03: login user-A → xem history/match; logout → login user-B → verify không còn private data của A
- D-05.03: revoke session mid-SSE → verify private cache không phục vụ tiếp
- D-05.05: time-travel test — source TTL expired (simulate `endedAt` cũ > 30 ngày) → verify 403/404; replay vẫn có
- D-05.05: test restore rehearsal trên DB test riêng (không phải default DATABASE_URL)

**Long làm (LD-05):**
- Retention deny layer: kiểm tra `endedAt + 30d` trước khi trả source; `endedAt + 7d` cho logs
- Cache headers: `Cache-Control: no-store` cho private responses; `Vary: Cookie` nếu cần
- Backup file access: confirm mode `0o600` không accessible từ web

**Nam làm:**
- Service Worker scope isolation: không cache private responses cross-origin

**Output:** Cache isolation evidence; retention deny evidence; backup access confirm

**Exit gate:** D-05.03 no cross-principal data; D-05.05 deny expired access

**Effort:** Đức 3h; chờ Long LD-05 T+14h

**Trạng thái:** BLOCKED (chờ Long LD-05)

---

### D06-W3 — Incident rehearsal + runbook test
*T+18h → T+28h — BLOCKED chờ Long LD-07 + admission candidate*

**Mục tiêu:** D-05.06: legit + spam workload; NORMAL/PRESSURE/RECOVERY; runbook.

**Điều kiện mở:** Long bàn giao LD-07 admission candidate với PRESSURE detection + runbook draft.

**Đức làm:**
- `tests/security/ops-audit-checklist.md`: incident scenarios (room spam, SSE flood, preflight abuse, credential incident)
- D-05.06 mixed workload: chạy legit gameplay + spam requests → verify PRESSURE switch; counters bounded; không lost ACK; gameplay reserve intact
- Runbook rehearsal: Đức làm theo runbook như "người không biết hệ thống" → verify hướng dẫn đủ rõ, không cần quyền production

**Long làm:**
- Runbook draft: open where → check metrics → action → expected → rollback/escalate
- NORMAL/PRESSURE/RECOVERY thresholds config

**Output:** Rehearsal evidence (commands/expected/actual); runbook pass/fail; counters trace

**Exit gate:** D-05.06 gameplay SLO đạt trong measured envelope; PRESSURE/cooldown đúng; không double ACK; runbook được người khác follow thành công

**Effort:** Đức 4h; chờ Long LD-07 T+20h

**Trạng thái:** BLOCKED (chờ Long LD-07 + admission)

---

### D06-W4 — Retest + Sign-off input
*T+28h → T+34h*

**Mục tiêu:** Retest findings từ W1/W2/W3; aggregate D-05.01…06 verdict cho D-07.

**Exit gate:** Tất cả P0/P1 resolved; NOT RUN/BLOCKED ghi lý do rõ; reviewer không phải Đức cho code Đức viết

**Effort:** Đức 2h

**Trạng thái:** NOT STARTED

---

## 6. Output từng Wave

| Wave | Artifact |
|---|---|
| D06-W1 | `tests/security/ops-audit-checklist.md`; dependency inventory; canary scan log; label bound confirmation |
| D06-W2 | Cache isolation evidence; retention deny evidence; backup access report; restore rehearsal result |
| D06-W3 | Mixed workload evidence (counters/p95/p99); runbook rehearsal log; PRESSURE/RECOVERY trace |
| D06-W4 | Retest log; D-05.01…06 final verdict table |

---

## 7. Files / Owner / Dependency

| File | Owner | Dependency |
|---|---|---|
| `tests/security/ops-audit-checklist.md` (mới) | Đức | D01 policy |
| `apps/server/src/modules/diagnostics/metrics.ts` | Long | Đức audit label key; gửi finding nếu có |
| `apps/server/src/modules/diagnostics/r3-provider.route.ts` | Long | Đức audit content |
| `apps/server/src/plugins/error-handler.ts` | Long | Đức audit `details` exposure |
| `apps/server/src/modules/history/history.service.ts` | Long | Retention deny layer |
| `apps/server/src/modules/match/match.persistence.ts` | Long | Backup file access (đã có `0o600`) |
| Admission/PRESSURE config | Long | LD-03/LD-07 |
| Runbook | Long (tạo); Đức (rehearsal) | LD-07 baseline |
| Service Worker cache scope | Nam | Đức D-05.03 test |
| Runtime pins audit | Nam | Đức D-05.04 review |
| `packages/bot-sdk/src/manifest.ts` | Nam | Chỉ đọc; không giảm limits |

---

## 8. Test / Evidence / Exit Gate

### Canary credential design

```
CANARY_CRED_ENV_2026   (test env var, không phải real secret)
  → Inject vào test server env (NODE_ENV=test)
  → Action: trigger error, view /metrics, /diagnostics/r3/provider
  → Expected: không xuất hiện trong bất kỳ response body

CANARY_CRED_LOG_2026   (test string trong AppError.details)
  → Throw AppError với details: { secret: "CANARY_CRED_LOG_2026" }
  → View public error response
  → Expected: details không chứa CANARY_CRED_LOG_2026
```

### Metrics label bound test

```
Action: gửi 100 POST /random-path-<uuid> → 404
Check: GET /metrics → route count không tăng 100 entries
Expected: 404 route dùng một template key hoặc không ghi per-path
```

### Retention test

```
Setup: Match với endedAt = current - 31 ngày (simulated)
Action: GET /history/<matchId>/source (nếu có endpoint)
Expected: 403/404 "Hết hạn truy cập"
Verify: Replay (công khai) vẫn available
```

### Evidence format

```
Test: D-05.<n>
Candidate: <Long diff hash>
Environment: local Node; DB test: <identifier>; không default DATABASE_URL
Command: <curl/script>
Expected: <HTTP code + body>
Actual: [ghi khi chạy]
Canary scan: [zero-match / FAIL nếu có]
Verdict: NOT RUN
Reviewer: [không Đức nếu code Đức viết]
```

---

## 9. Trạng thái

| Item | Trạng thái | Blocker |
|---|---|---|
| D06-W1 Secret + metrics audit | IN PROGRESS | FAIL (D-05.01, D-05.02); BLOCKED (D-05.04) |
| D06-W2 Cache + retention | BLOCKED | Long LD-05 candidate |
| D06-W3 Incident rehearsal | BLOCKED | Long LD-07 admission + runbook |
| D06-W4 Retest | NOT STARTED | W1/W2/W3 |
| D-05.01…06 AC | NOT RUN | — |

---

## 10. Mandatory Gates và Residual Risks

**Release blockers:**
- D-05.01 canary trong bất kỳ public response → P1
- D-05.02 unbounded label growth từ 404 flood → P1
- D-05.03 cross-principal private data → P1
- D-05.06 double-ACK move dưới PRESSURE → P1

**Residual risks được chấp nhận:**
- Log volume control phụ thuộc pino config từ Long — nếu không config thì ghi là finding/BLOCKED
- Restore rehearsal chỉ trên DB test riêng — không có production restore evidence
- Retention deny cần enforcement layer từ Long (LD-05); nếu không có → D-05.05 BLOCKED
- Không hứa chống volumetric DDoS — chỉ application abuse và safe envelope

**KHÔNG được:**
- Inject canary vào production env hoặc dùng real secrets
- Chạy load test trên production hoặc default DATABASE_URL
- Coi `0o600` file mode là đủ — cần confirm không accessible từ web server
- Tự deploy runbook changes lên production

---

## 11. Dependency / Critical Path trong 36 giờ

```
T+8h   Đức: D06-W1 secret audit + metrics scan (parallel D05-W1)
T+12h  Long: confirm label bound + AppError.details audit
T+14h  Long: LD-05 candidate → Đức bắt đầu D06-W2
T+20h  Đức: D06-W2 evidence; findings → Long/Nam
T+20h  Long: LD-07 admission + runbook → Đức bắt đầu D06-W3
T+28h  Đức: D06-W3 rehearsal evidence; Long/Nam fix findings
T+32h  Retest → D06-W4
T+34h  Verdict input cho D-07
```

**Critical dependencies:**
1. Long LD-05 (retention deny + cache headers): blocker cho D-05.03/05
2. Long LD-07 (admission PRESSURE + runbook): blocker cho D-05.06
3. Nam (SW scope + runtime pins): blocker cho D-05.03/04 browser side
