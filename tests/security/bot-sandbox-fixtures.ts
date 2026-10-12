/**
 * bot-sandbox-fixtures.ts
 * D03-W1 — Fixture design + Consumer path verification
 *
 * ecc:security-review  — Mỗi fixture có control + hostile variant + expected denial.
 * ecc:blueprint        — Consumer path phải là BotOnlineService API,
 *                        KHÔNG direct Wasmtime probe hoặc native subprocess.
 * ecc:contract-first   — Fixtures typed theo BotLimitManifest (packages/bot-sdk/src/manifest.ts).
 *
 * TRẠNG THÁI: Fixture file DONE; CHƯA chạy — chờ Nam N-01/N-04 runtime candidate.
 * Sentinel: giá trị test ("CANARY_...") KHÔNG phải secrets thật.
 */

/** ── Limits từ manifest (KHÔNG được sửa để pass gate) ─────────────── */
export const LIMITS = {
  sourceBytes:    64 * 1024,
  memoryBytes:    8  * 1024,
  memoryDepth:    32,
  outputBytes:    16 * 1024,
  preflightMs:    250,
  perTurnMs:      500,
  wholeMatchMs:   30_000,
  wasmMemoryPages: 1024,          // 64 MiB linear memory
  network:        false,
  filesystem:     false,
  secrets:        false,
};

/** ── Consumer path ─────────────────────────────────────────────────────
 *
 * D-03.ON-01 bắt buộc dùng application consumer:
 *
 *   Test → BotOnlineService.runPreflight(botId, roomId, signal)
 *             ↓
 *         BotLibraryService.getRevision(revisionId) [source lookup]
 *             ↓
 *         WasmtimeCpythonAdapter.runPreflight(source, signal)
 *             ↓
 *         Wasmtime sandbox (CPython-WASI)
 *             ↓
 *         BotOnlineService validates result (BotOutputValidationError nếu sai ABI)
 *
 *   Test → BotOnlineService.onTurn(roomId, match, side, signal)
 *             ↓
 *         WasmtimeCpythonAdapter.runTurn(source, state, memory, seed, signal)
 *             ↓
 *         Wasmtime sandbox
 *             ↓
 *         BotOnlineService.matches.move(...)  [authority commit]
 *
 * KHÔNG được direct probe: không gọi WasmtimeAdapter trực tiếp bên ngoài service.
 */
export const CONSUMER_PATH = `
flowchart TD
  T[Test Harness] --> BS[BotOnlineService.runPreflight / onTurn]
  BS --> BL[BotLibraryService.getRevision source lookup]
  BL --> WA[WasmtimeCpythonAdapter]
  WA --> SB[Wasmtime Sandbox / CPython-WASI]
  SB --> VAL{Output validation}
  VAL -- Valid ABI --> AUTH[Authority commit via MatchManager]
  VAL -- BotOutputValidationError --> DENY[Deny / author fault]
  VAL -- WasmtimeProviderError --> INF[Infrastructure fault / fail closed]
  AUTH --> RESULT[Legal move + memory committed]
`;

/** ── Fixture type ───────────────────────────────────────────────────── */
export interface SandboxFixture {
  id:           string;   // D-03.ON-XX-YYY
  category:     'control' | 'hostile';
  task:         string;   // D-03.ON task reference
  description:  string;
  pythonSource: string;   // Nội dung Python sẽ upload — CHỈ dùng trong sandbox
  canary?:      string;   // Sentinel string (test data, KHÔNG phải secret thật)
  consumerPath: 'runPreflight' | 'runTurn';
  expected: {
    verdict:    'ALLOW' | 'DENY';
    errorClass?: 'BotOutputValidationError' | 'WasmtimeProviderError' | 'RuntimeCancelledError';
    checks:     string[];
  };
  evidence: {
    environment:  string;
    runtimePins:  string;
    commandHint:  string;
    computeMs?:   number | null;
    rssPeakMb?:   number | null;
    cleanupMs?:   number | null;
    actual?:      string;
    verdict:      'NOT RUN' | 'PASS' | 'FAIL' | 'BLOCKED';
    reviewer?:    string;
  };
}

/** ── D-03.ON-01 — Known-valid ABI (positive control) ───────────────── */
const control_valid_preflight: SandboxFixture = {
  id: 'D-03.ON-01-POS',
  category: 'control',
  task: 'D-03.ON-01',
  description: 'Known-valid ABI source: trả về legal move và memory hợp lệ qua application consumer',
  pythonSource: `
import sys, json
state = json.loads(sys.stdin.readline())
legal = state.get("legalMoves", [])
move = legal[0] if legal else {"from": "a1", "to": "a2"}
memory = state.get("memory", {})
print(json.dumps({"move": move, "memory": memory}))
`.trim(),
  consumerPath: 'runPreflight',
  expected: {
    verdict: 'ALLOW',
    checks: [
      'runPreflight returns without error',
      'result.move is within legalMoves',
      'result.memory is valid JSON under 8 KiB',
      'No private source/logs exposed in response',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy] Node vX; OS Y',
    runtimePins: '[ghi khi chạy] wasmtime SHA=...; cpython SHA=...',
    commandHint: 'await botOnlineService.runPreflight(botId, roomId, abortSignal)',
    computeMs: null, rssPeakMb: null, cleanupMs: null,
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức nếu code Đức viết]',
  },
};

/** ── D-03.ON-02 — Network capability denial ────────────────────────── */
const hostile_network: SandboxFixture = {
  id: 'D-03.ON-02-NET',
  category: 'hostile',
  task: 'D-03.ON-02',
  description: 'Python cố gắng mở socket TCP ra ngoài — phải bị block',
  pythonSource: `import socket; socket.connect(('8.8.8.8', 53)); print('REACHED')`,
  canary: 'CANARY_NETWORK_TEST_2026',
  consumerPath: 'runPreflight',
  expected: {
    verdict: 'DENY',
    errorClass: 'WasmtimeProviderError',
    checks: [
      'Sandbox raises RuntimeError / WasmtimeProviderError (network disabled)',
      'No outbound TCP visible in netstat during test window',
      'Canary string "CANARY_NETWORK_TEST_2026" absent from any SSE/room/response',
      'Service does NOT award loss to player (infrastructure fault path)',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy]',
    runtimePins: '[ghi khi chạy]',
    commandHint: 'await botOnlineService.runPreflight(botId, roomId, abortSignal)',
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức]',
  },
};

/** ── D-03.ON-02 — Secrets / env access denial ──────────────────────── */
const hostile_secrets: SandboxFixture = {
  id: 'D-03.ON-02-SEC',
  category: 'hostile',
  task: 'D-03.ON-02',
  description: 'Python cố đọc biến môi trường — phải trả về empty hoặc bị block',
  pythonSource: `import os, json; print(json.dumps({"move": {"from":"a1","to":"a2"}, "memory": {"env": list(os.environ.keys())}}))`,
  canary: 'CANARY_ENV_LEAK_2026',
  consumerPath: 'runTurn',
  expected: {
    verdict: 'DENY',
    errorClass: 'BotOutputValidationError',
    checks: [
      'os.environ is empty or raises CapabilityError inside sandbox',
      'No real env keys appear in output/memory',
      'Canary "CANARY_ENV_LEAK_2026" absent from any public output',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy]',
    runtimePins: '[ghi khi chạy]',
    commandHint: 'await botOnlineService.onTurn(roomId, match, slot, abortSignal)',
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức]',
  },
};

/** ── D-03.ON-02 — Filesystem traversal denial ──────────────────────── */
const hostile_filesystem: SandboxFixture = {
  id: 'D-03.ON-02-FS',
  category: 'hostile',
  task: 'D-03.ON-02',
  description: 'Python cố đọc /etc/passwd hoặc ghi file — phải bị block',
  pythonSource: `
try:
    with open('/etc/passwd') as f: content = f.read(100)
except Exception as e:
    content = str(e)
import json, sys
state = json.loads(sys.stdin.readline())
print(json.dumps({"move": state["legalMoves"][0], "memory": {"leak": content}}))
`.trim(),
  canary: 'CANARY_FS_LEAK_2026',
  consumerPath: 'runTurn',
  expected: {
    verdict: 'DENY',
    errorClass: 'WasmtimeProviderError',
    checks: [
      'open("/etc/passwd") raises CapabilityError or IOError inside sandbox',
      'No file content appears in memory or output',
      'Sandbox filesystem=false enforced',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy]',
    runtimePins: '[ghi khi chạy]',
    commandHint: 'await botOnlineService.onTurn(roomId, match, slot, abortSignal)',
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức]',
  },
};

/** ── D-03.ON-03 — Infinite loop (timeout) ──────────────────────────── */
const hostile_loop: SandboxFixture = {
  id: 'D-03.ON-03-LOOP',
  category: 'hostile',
  task: 'D-03.ON-03',
  description: 'Python chạy vòng lặp vô hạn — phải dừng trong perTurnMs=500ms',
  pythonSource: `while True: pass`,
  consumerPath: 'runTurn',
  expected: {
    verdict: 'DENY',
    errorClass: 'WasmtimeProviderError',
    checks: [
      `Turn terminates within ${LIMITS.perTurnMs}ms (wasmEpochTicks/fuel exhausted)`,
      'WasmtimeProviderError "compute timeout" thrown',
      'RSS returns to pre-invocation baseline within 2s',
      'Player is awarded loss (author fault), not infrastructure pause',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy]',
    runtimePins: '[ghi khi chạy]',
    commandHint: 'await botOnlineService.onTurn(roomId, match, slot, abortSignal)',
    computeMs: null, rssPeakMb: null, cleanupMs: null,
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức]',
  },
};

/** ── D-03.ON-03 — Memory allocation (OOM) ──────────────────────────── */
const hostile_oom: SandboxFixture = {
  id: 'D-03.ON-03-OOM',
  category: 'hostile',
  task: 'D-03.ON-03',
  description: 'Python cố cấp phát hơn 64 MiB (vượt wasmMemoryPages*64KiB)',
  pythonSource: `x = bytearray(80 * 1024 * 1024)  # 80 MiB`,
  consumerPath: 'runTurn',
  expected: {
    verdict: 'DENY',
    errorClass: 'WasmtimeProviderError',
    checks: [
      `Allocation beyond ${LIMITS.wasmMemoryPages * 64} KiB linear memory raises MemoryError`,
      'Process exits; no OOM killer visible in host',
      'RSS peak stays below (64 MiB linear + Node overhead); reclaim within 5s',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy]',
    runtimePins: '[ghi khi chạy]',
    commandHint: 'await botOnlineService.onTurn(roomId, match, slot, abortSignal)',
    computeMs: null, rssPeakMb: null, cleanupMs: null,
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức]',
  },
};

/** ── D-03.ON-04 — Malformed output (NaN, wrong schema) ─────────────── */
const hostile_output_nan: SandboxFixture = {
  id: 'D-03.ON-04-NAN',
  category: 'hostile',
  task: 'D-03.ON-04',
  description: 'Output chứa NaN/Infinity — phải bị reject trước khi commit',
  pythonSource: `import json, sys, math; state = json.loads(sys.stdin.readline()); print(json.dumps({"move": state["legalMoves"][0], "memory": {"score": math.nan}}))`,
  consumerPath: 'runTurn',
  expected: {
    verdict: 'DENY',
    errorClass: 'BotOutputValidationError',
    checks: [
      'BotOutputValidationError thrown before move committed to MatchManager',
      'Board/memory unchanged after rejection',
      'No NaN/Infinity in any public response',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy]',
    runtimePins: '[ghi khi chạy]',
    commandHint: 'await botOnlineService.onTurn(roomId, match, slot, abortSignal)',
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức]',
  },
};

/** ── D-03.ON-04 — Illegal move ─────────────────────────────────────── */
const hostile_illegal_move: SandboxFixture = {
  id: 'D-03.ON-04-ILLEGAL',
  category: 'hostile',
  task: 'D-03.ON-04',
  description: 'Bot trả về move không có trong legalMoves — phải bị reject',
  pythonSource: `import json, sys; state = json.loads(sys.stdin.readline()); print(json.dumps({"move": {"from": "a1", "to": "i9"}, "memory": {}}))`,
  consumerPath: 'runTurn',
  expected: {
    verdict: 'DENY',
    errorClass: 'BotOutputValidationError',
    checks: [
      'Move {"from":"a1","to":"i9"} not in legalMoves — BotOutputValidationError',
      'MatchManager.move() NOT called',
      'Board state unchanged',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy]',
    runtimePins: '[ghi khi chạy]',
    commandHint: 'await botOnlineService.onTurn(roomId, match, slot, abortSignal)',
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức]',
  },
};

/** ── D-03.ON-05 — Cross-invocation memory leakage ──────────────────── */
const hostile_cross_invocation: SandboxFixture = {
  id: 'D-03.ON-05-LEAK',
  category: 'hostile',
  task: 'D-03.ON-05',
  description: 'Hai lần gọi liên tiếp — global state phải được reset; memory chỉ từ commit trước',
  pythonSource: `
import json, sys
# Write to a "global" to test if it persists
_GLOBAL_STATE = "LEAK_MARKER"
state = json.loads(sys.stdin.readline())
print(json.dumps({"move": state["legalMoves"][0], "memory": {"marker": _GLOBAL_STATE}}))
`.trim(),
  canary: 'CANARY_CROSS_INVOCATION_2026',
  consumerPath: 'runTurn',
  expected: {
    verdict: 'ALLOW',  // First call: ALLOW; second call should not see prior global
    checks: [
      'Each invocation starts with fresh WASM instance (no global persistence)',
      '"LEAK_MARKER" in memory is from current invocation only, not a leaked global',
      'Second call with different source sees no leftover from first call',
      'Cross-Bot isolation: Bot A memory not accessible to Bot B in same match',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy]',
    runtimePins: '[ghi khi chạy]',
    commandHint: 'Two sequential await botOnlineService.onTurn() calls',
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức]',
  },
};

/** ── D-03.ON-06 — Cancel/abort race ───────────────────────────────────*/
const hostile_cancel_race: SandboxFixture = {
  id: 'D-03.ON-06-CANCEL',
  category: 'hostile',
  task: 'D-03.ON-06',
  description: 'AbortSignal được fire trong khi Bot đang chạy — không được late commit',
  pythonSource: `import time, json, sys; time.sleep(10); state=json.loads(sys.stdin.readline()); print(json.dumps({"move":state["legalMoves"][0],"memory":{}}))`,
  consumerPath: 'runTurn',
  expected: {
    verdict: 'DENY',
    errorClass: 'RuntimeCancelledError',
    checks: [
      'AbortSignal fires after 100ms → RuntimeCancelledError thrown',
      'Bot move NOT committed to MatchManager after abort',
      'Wasmtime process killed; temp files cleaned up',
      'Reservation released; next invocation can acquire capacity',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy]',
    runtimePins: '[ghi khi chạy]',
    commandHint: 'const ac = new AbortController(); setTimeout(()=>ac.abort(), 100); await onTurn(..., ac.signal)',
    computeMs: null, rssPeakMb: null, cleanupMs: null,
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức]',
  },
};

/** ── D-03.ON-07 — Hash mismatch / bootstrap failure ─────────────────── */
const hostile_hash_mismatch: SandboxFixture = {
  id: 'D-03.ON-07-HASH',
  category: 'hostile',
  task: 'D-03.ON-07',
  description: 'wasmtime binary SHA-256 không khớp pin — fail closed, không fallback',
  pythonSource: `# N/A — test is at adapter bootstrap level, not Python source`,
  consumerPath: 'runPreflight',
  expected: {
    verdict: 'DENY',
    errorClass: 'WasmtimeProviderError',
    checks: [
      'Hash mismatch → WasmtimeProviderError("SHA-256 mismatch")',
      'NO fallback to native Python or any other interpreter',
      'NO private diagnostic exposed via SSE/room/public logs',
      'Service records infrastructure fault, not author fault',
    ],
  },
  evidence: {
    environment: '[ghi khi chạy]',
    runtimePins: 'Tampered PIN — mismatched SHA-256 injected',
    commandHint: 'createWasmtimeCpythonAdapter({ wasmtimeSha256: "0000...wrong" })',
    verdict: 'NOT RUN',
    reviewer: '[KHÔNG được là Đức]',
  },
};

/** ── Exported fixture registry ─────────────────────────────────────── */
export const BOT_SANDBOX_FIXTURES: readonly SandboxFixture[] = [
  control_valid_preflight,
  hostile_network,
  hostile_secrets,
  hostile_filesystem,
  hostile_loop,
  hostile_oom,
  hostile_output_nan,
  hostile_illegal_move,
  hostile_cross_invocation,
  hostile_cancel_race,
  hostile_hash_mismatch,
];

/** ── Fixture runner spec (chạy qua BotOnlineService, KHÔNG direct probe) ──
 *
 * Điều kiện tiên quyết: Nam N-01/N-04 runtime candidate phải sẵn sàng.
 *
 * ```typescript
 * for (const fixture of BOT_SANDBOX_FIXTURES) {
 *   if (fixture.evidence.verdict !== 'NOT RUN') continue; // skip already run
 *   const svc = await buildApp() // uses real BotOnlineService
 *   // inject mock Bot with fixture.pythonSource
 *   // call svc via fixture.consumerPath
 *   // assert fixture.expected.verdict and fixture.expected.errorClass
 *   // record: environment, runtimePins, computeMs, rssPeakMb, cleanupMs, actual
 *   // set fixture.evidence.verdict = 'PASS' | 'FAIL'
 * }
 * ```
 *
 * Evidence ghi vào: `tests/security/bot-sandbox-evidence.md`
 * Reviewer: KHÔNG được là Đức
 */
export function fixtureRunnerSpec(): string {
  return BOT_SANDBOX_FIXTURES.map(f => `
Test: ${f.id}
Task: ${f.task}
Consumer: BotOnlineService.${f.consumerPath}()
Expected verdict: ${f.expected.verdict}${f.expected.errorClass ? ` (${f.expected.errorClass})` : ''}
Checks:
${f.expected.checks.map(c => `  - ${c}`).join('\n')}
Evidence: ${f.evidence.verdict}
`).join('\n---\n');
}
