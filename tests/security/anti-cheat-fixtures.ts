/**
 * anti-cheat-fixtures.ts
 * D05-W1 — Tamper fixture design + canary placement spec
 *
 * ecc:security-review  — Tampered payloads cover authority, side, version,
 *                        seed, duplicate sequences, and race conditions.
 * ecc:blueprint        — Expected rejections mapped directly to MatchManager contracts;
 *                        invariants assert no state changes on rejection.
 * ecc:contract-first   — Codes aligned with Fastify AppError reasons and game-rules.
 */

export interface TamperFixture {
  id:           string;   // D-04.XX-TY
  task:         string;   // D-04.01 ... D-04.07
  name:         string;
  description:  string;
  actor: {
    userId:     string;
    role:       'PLAYER' | 'REFEREE' | 'SPECTATOR' | 'IMPOSTOR' | 'GUEST';
    side?:      'BLUE' | 'RED';
  };
  payload:      Record<string, unknown>;
  expected: {
    httpStatus: number;
    errorCode:  string;
    reason:     string;
    invariants: string[];
  };
  evidence: {
    disposableDbId?: string;
    candidateHash?:  string;
    actualStatus?:   number;
    actualReason?:   string;
    boardChanged?:   boolean;
    verdict:         'NOT RUN' | 'PASS' | 'FAIL' | 'BLOCKED';
    reviewer?:       string;
  };
}

/** ── D-04.01: Actor / Side / Controller / StateVersion Tampering ────── */
export const FIXTURES_D04_01: readonly TamperFixture[] = [
  {
    id: 'D-04.01-T1',
    task: 'D-04.01',
    name: 'Wrong side move attempt',
    description: 'Player BLUE gửi lệnh move khi đang là lượt của RED',
    actor: { userId: 'user-blue-1', role: 'PLAYER', side: 'BLUE' },
    payload: { from: 'a1', to: 'a2', stateVersion: 1 },
    expected: {
      httpStatus: 409,
      errorCode: 'CONFLICT',
      reason: 'WRONG_TURN',
      invariants: ['match.moves length unchanged', 'match.stateVersion unchanged', 'board unchanged'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
  {
    id: 'D-04.01-T2',
    task: 'D-04.01',
    name: 'Non-match-member move attempt',
    description: 'User ngoài cuộc (hoặc spectator) gửi move vào trận đang chạy',
    actor: { userId: 'impostor-99', role: 'IMPOSTOR' },
    payload: { from: 'a1', to: 'a2', stateVersion: 1 },
    expected: {
      httpStatus: 403,
      errorCode: 'UNAUTHORIZED',
      reason: 'NOT_MATCH_MEMBER',
      invariants: ['match.moves length unchanged', 'no event emitted to players'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
  {
    id: 'D-04.01-T3',
    task: 'D-04.01',
    name: 'Stale stateVersion move attempt',
    description: 'Player gửi move với stateVersion cũ hơn stateVersion hiện tại của server',
    actor: { userId: 'user-blue-1', role: 'PLAYER', side: 'BLUE' },
    payload: { from: 'a1', to: 'a2', stateVersion: 0 }, // server is already version 1
    expected: {
      httpStatus: 409,
      errorCode: 'CONFLICT',
      reason: 'STALE_STATE',
      invariants: ['no move appended', 'client receives STATE_RESYNC cue'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
  {
    id: 'D-04.01-T4',
    task: 'D-04.01',
    name: 'Illegal move coordinates violation',
    description: 'Player gửi nước đi nhảy cóc không hợp lệ theo game-rules (ví dụ a1 -> i9)',
    actor: { userId: 'user-blue-1', role: 'PLAYER', side: 'BLUE' },
    payload: { from: 'a1', to: 'i9', stateVersion: 1 },
    expected: {
      httpStatus: 400,
      errorCode: 'VALIDATION_ERROR',
      reason: 'MOVE_REJECTED',
      invariants: ['PIECE_MOVE_REJECTED emitted', 'board state unchanged'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
];

/** ── D-04.02: Setup / Refresh / Rematch / Replay Integrity ─────────── */
export const FIXTURES_D04_02: readonly TamperFixture[] = [
  {
    id: 'D-04.02-T1',
    task: 'D-04.02',
    name: 'Client seed tamper in rematch payload',
    description: 'Client gửi custom seed trong request rematch để cố ý thao túng cách chia cờ',
    actor: { userId: 'user-blue-1', role: 'PLAYER', side: 'BLUE' },
    payload: { stateVersion: 10, customSeed: 1337, forcedSide: 'BLUE' },
    expected: {
      httpStatus: 200,
      errorCode: 'OK',
      reason: 'SEED_IGNORED_SERVER_AUTHORITY',
      invariants: [
        'Server flips side deterministically (BLUE -> RED)',
        'Server generates authoritative initial state ignoring client seed',
      ],
    },
    evidence: { verdict: 'NOT RUN' },
  },
  {
    id: 'D-04.02-T2',
    task: 'D-04.02',
    name: 'Page refresh setup reroll attack',
    description: 'Player refresh trang khi countdown để cố gắng đổi vị trí quân cờ',
    actor: { userId: 'user-blue-1', role: 'PLAYER', side: 'BLUE' },
    payload: { reconnect: true },
    expected: {
      httpStatus: 200,
      errorCode: 'OK',
      reason: 'INITIAL_STATE_PERSISTED',
      invariants: ['Board pieces layout identical before and after refresh', 'stateVersion preserved'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
];

/** ── D-04.03: Duplicate Command & Idempotency Fencing ──────────────── */
export const FIXTURES_D04_03: readonly TamperFixture[] = [
  {
    id: 'D-04.03-T1',
    task: 'D-04.03',
    name: 'Duplicate move resend with same sequence',
    description: 'Gửi lại chính xác move payload vừa commit (mất ACK giả lập)',
    actor: { userId: 'user-blue-1', role: 'PLAYER', side: 'BLUE' },
    payload: { from: 'a1', to: 'a2', stateVersion: 1 },
    expected: {
      httpStatus: 409,
      errorCode: 'CONFLICT',
      reason: 'STALE_STATE',
      invariants: ['Moves array length unchanged', 'No duplicate PIECE_MOVE_ACCEPTED event'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
];

/** ── D-04.04: Action Precedence vs Stop / Pause / Terminal ──────────── */
export const FIXTURES_D04_04: readonly TamperFixture[] = [
  {
    id: 'D-04.04-T1',
    task: 'D-04.04',
    name: 'Move attempt during referee pause',
    description: 'Player gửi move trong khi trận đấu đang ở trạng thái PAUSED bởi trọng tài',
    actor: { userId: 'user-blue-1', role: 'PLAYER', side: 'BLUE' },
    payload: { from: 'a1', to: 'a2', stateVersion: 2 },
    expected: {
      httpStatus: 409,
      errorCode: 'CONFLICT',
      reason: 'MATCH_NOT_PLAYING',
      invariants: ['Clocks remain frozen', 'No move committed', 'Status remains PAUSED'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
  {
    id: 'D-04.04-T2',
    task: 'D-04.04',
    name: 'Move attempt after terminal state',
    description: 'Player gửi move sau khi trận đã kết thúc (FINISHED)',
    actor: { userId: 'user-blue-1', role: 'PLAYER', side: 'BLUE' },
    payload: { from: 'a1', to: 'a2', stateVersion: 15 },
    expected: {
      httpStatus: 409,
      errorCode: 'CONFLICT',
      reason: 'MATCH_FINISHED',
      invariants: ['Winner not modified', 'Match result unchanged', 'Clocks stopped'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
];

/** ── D-04.05: Revision / Epoch / Memory Races ──────────────────────── */
export const FIXTURES_D04_05: readonly TamperFixture[] = [
  {
    id: 'D-04.05-T1',
    task: 'D-04.05',
    name: 'Late output commit from previous match generation',
    description: 'Bot runtime trả về kết quả cho match cũ sau khi trận mới (rematch) đã bắt đầu',
    actor: { userId: 'bot-runner-internal', role: 'PLAYER' },
    payload: { matchGeneration: 1, move: { from: 'a1', to: 'a2' } },
    expected: {
      httpStatus: 409,
      errorCode: 'CONFLICT',
      reason: 'STALE_MATCH_GENERATION',
      invariants: ['Rematch initial board unchanged', 'Late output dropped cleanly'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
];

/** ── D-04.06: Referee Replacement & Privilege Revocation ────────────── */
export const FIXTURES_D04_06: readonly TamperFixture[] = [
  {
    id: 'D-04.06-T1',
    task: 'D-04.06',
    name: 'Old referee pause attempt after replacement transfer',
    description: 'Trọng tài cũ cố gắng gọi /stop sau khi cả 2 bên đã chuyển giao quyền cho trọng tài mới',
    actor: { userId: 'old-referee-1', role: 'IMPOSTOR' },
    payload: { category: 'TECHNICAL_ISSUE' },
    expected: {
      httpStatus: 403,
      errorCode: 'UNAUTHORIZED',
      reason: 'NOT_ACTIVE_REFEREE',
      invariants: ['Match clocks and status unchanged', 'Old referee commands denied'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
  {
    id: 'D-04.06-T2',
    task: 'D-04.06',
    name: 'Guest principal claiming referee authority',
    description: 'Guest session cố gắng gửi lệnh referee stop',
    actor: { userId: 'guest:anonymous_123', role: 'GUEST' },
    payload: { category: 'TECHNICAL_ISSUE' },
    expected: {
      httpStatus: 403,
      errorCode: 'UNAUTHORIZED',
      reason: 'GUEST_REFEREE_FORBIDDEN',
      invariants: ['Match status unchanged'],
    },
    evidence: { verdict: 'NOT RUN' },
  },
];

/** ── D-04.07: Crash Recovery Boundary Verification ─────────────────── */
export const FIXTURES_D04_07: readonly TamperFixture[] = [
  {
    id: 'D-04.07-T1',
    task: 'D-04.07',
    name: 'Server crash mid-commit recovery checkpoint',
    description: 'Khôi phục state từ FileMatchPersistence sau khi tiến trình server bị dừng đột ngột',
    actor: { userId: 'system-recovery', role: 'PLAYER' },
    payload: { lastCommittedSequence: 5 },
    expected: {
      httpStatus: 200,
      errorCode: 'OK',
      reason: 'CHECKPOINT_RESTORED_EXACT',
      invariants: [
        'Board recovers exact state of last committed move',
        'No duplicate moves in history array',
        'No double Elo calculations in database',
      ],
    },
    evidence: { verdict: 'NOT RUN' },
  },
];

/** ── Aggregate Fixture Registry ─────────────────────────────────────── */
export const ANTI_CHEAT_FIXTURES: readonly TamperFixture[] = [
  ...FIXTURES_D04_01,
  ...FIXTURES_D04_02,
  ...FIXTURES_D04_03,
  ...FIXTURES_D04_04,
  ...FIXTURES_D04_05,
  ...FIXTURES_D04_06,
  ...FIXTURES_D04_07,
];

/** ── Formatter for Handoff / Reports ─────────────────────────────────── */
export function formatAntiCheatFixtures(): string {
  return ANTI_CHEAT_FIXTURES.map(f => `
Fixture: ${f.id} (${f.task})
Name: ${f.name}
Description: ${f.description}
Actor: ${f.actor.role} [${f.actor.userId}]
Expected: HTTP ${f.expected.httpStatus} -> ${f.expected.reason}
Invariants:
${f.expected.invariants.map(inv => `  - ${inv}`).join('\n')}
Evidence: ${f.evidence.verdict}
`).join('\n---\n');
}
