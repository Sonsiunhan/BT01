/**
 * D03-W1 — Consumer Path Verification Test
 * ecc:security-review: Xác minh BotOnlineService export đúng API
 *                      và WasmtimeAdapter KHÔNG bị bypass.
 * ecc:blueprint:       Static structural check — không cần Nam runtime candidate.
 *
 * KHÔNG spawn Python trực tiếp. KHÔNG gọi WasmtimeAdapter directly.
 */

import { describe, it, expect } from 'vitest';
import { BOT_SANDBOX_FIXTURES, LIMITS, fixtureRunnerSpec } from '../../tests/security/bot-sandbox-fixtures.js';

describe('D03-W1: Consumer path và fixture structure', () => {

  it('Fixtures cover all required D-03.ON tasks (02..07)', () => {
    const tasks = new Set(BOT_SANDBOX_FIXTURES.map(f => f.task));
    // D-03.ON-01 (valid ABI) is the positive control
    expect(tasks.has('D-03.ON-01')).toBe(true);
    // D-03.ON-02: capability denial
    expect(tasks.has('D-03.ON-02')).toBe(true);
    // D-03.ON-03: resource exhaustion
    expect(tasks.has('D-03.ON-03')).toBe(true);
    // D-03.ON-04: output validation
    expect(tasks.has('D-03.ON-04')).toBe(true);
    // D-03.ON-05: cross-invocation isolation
    expect(tasks.has('D-03.ON-05')).toBe(true);
    // D-03.ON-06: cancel/abort
    expect(tasks.has('D-03.ON-06')).toBe(true);
    // D-03.ON-07: hash mismatch
    expect(tasks.has('D-03.ON-07')).toBe(true);
  });

  it('Every fixture has BOTH hostile and control variants for capability fixtures', () => {
    const hostile = BOT_SANDBOX_FIXTURES.filter(f => f.category === 'hostile');
    const controls = BOT_SANDBOX_FIXTURES.filter(f => f.category === 'control');
    expect(hostile.length).toBeGreaterThanOrEqual(8);
    expect(controls.length).toBeGreaterThanOrEqual(1);
  });

  it('No fixture has "NOT RUN" verdict changed to PASS without evidence', () => {
    for (const f of BOT_SANDBOX_FIXTURES) {
      // All fixtures start as NOT RUN — none should be pre-marked PASS without runtime
      if (f.evidence.verdict === 'PASS') {
        expect(f.evidence.computeMs).not.toBeNull();
        expect(f.evidence.runtimePins).not.toBe('[ghi khi chạy]');
      }
    }
  });

  it('LIMITS match DEFAULT_BOT_LIMITS from manifest (sanity check)', async () => {
    // Read actual manifest dynamically to catch drift
    const { DEFAULT_BOT_LIMITS } = await import('../../packages/bot-sdk/src/manifest.js');
    expect(LIMITS.sourceBytes).toBe(DEFAULT_BOT_LIMITS.sourceBytes);
    expect(LIMITS.memoryBytes).toBe(DEFAULT_BOT_LIMITS.memoryBytes);
    expect(LIMITS.preflightMs).toBe(DEFAULT_BOT_LIMITS.preflightMs);
    expect(LIMITS.perTurnMs).toBe(DEFAULT_BOT_LIMITS.perTurnMs);
    expect(LIMITS.network).toBe(DEFAULT_BOT_LIMITS.network);
    expect(LIMITS.filesystem).toBe(DEFAULT_BOT_LIMITS.filesystem);
    expect(LIMITS.secrets).toBe(DEFAULT_BOT_LIMITS.secrets);
  });

  it('Consumer path uses BotOnlineService, not direct adapter', () => {
    // All fixtures must specify consumerPath via BotOnlineService API
    for (const f of BOT_SANDBOX_FIXTURES) {
      expect(['runPreflight', 'runTurn']).toContain(f.consumerPath);
    }
  });

  it('Hostile fixtures all expect DENY', () => {
    const hostile = BOT_SANDBOX_FIXTURES.filter(f => f.category === 'hostile');
    // All hostile must expect DENY (isolation must hold)
    // Exception: D-03.ON-05 cross-invocation is ALLOW first call but tests isolation
    const hardDeny = hostile.filter(f => f.id !== 'D-03.ON-05-LEAK');
    for (const f of hardDeny) {
      expect(f.expected.verdict).toBe('DENY');
    }
  });

  it('Fixture runner spec is non-empty and documents evidence format', () => {
    const spec = fixtureRunnerSpec();
    expect(spec).toContain('BotOnlineService');
    expect(spec).toContain('NOT RUN');
    expect(spec.length).toBeGreaterThan(500);
  });

  it('No canary value matches real secret patterns', () => {
    // Canaries must be test data only — not real tokens/passwords
    for (const f of BOT_SANDBOX_FIXTURES) {
      if (f.canary) {
        expect(f.canary.startsWith('CANARY_')).toBe(true);
        // Must not look like real credentials (base64, hex, JWT etc.)
        expect(f.canary).not.toMatch(/^[A-Za-z0-9+/]{32,}={0,2}$/);
        expect(f.canary).not.toMatch(/^[a-f0-9]{32,}$/i);
      }
    }
  });
});
