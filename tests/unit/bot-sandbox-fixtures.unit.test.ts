/**
 * bot-sandbox-fixtures.unit.test.ts
 *
 * Unit tests validating D03-W1 Fixtures & Runner Specification.
 * Ensures all hostile/control fixtures adhere strictly to:
 * - ecc:security-review (proper error expectations, non-secret canaries, complete threat mapping)
 * - ecc:contract-first (exact match against manifest limits)
 * - ecc:blueprint (consumer path verification, no raw subprocess probing)
 */

import { describe, it, expect } from 'vitest';
import {
  BOT_SANDBOX_FIXTURES,
  LIMITS,
  CONSUMER_PATH,
  fixtureRunnerSpec,
  type SandboxFixture,
} from '../security/bot-sandbox-fixtures.js';

describe('D03-W1: Bot Sandbox Fixtures & Contract Verification', () => {
  it('enforces manifest pinned limits strictly without tampering', () => {
    expect(LIMITS.sourceBytes).toBe(64 * 1024);
    expect(LIMITS.memoryBytes).toBe(8 * 1024);
    expect(LIMITS.memoryDepth).toBe(32);
    expect(LIMITS.outputBytes).toBe(16 * 1024);
    expect(LIMITS.preflightMs).toBe(250);
    expect(LIMITS.perTurnMs).toBe(500);
    expect(LIMITS.wholeMatchMs).toBe(30_000);
    expect(LIMITS.wasmMemoryPages).toBe(1024);
    expect(LIMITS.network).toBe(false);
    expect(LIMITS.filesystem).toBe(false);
    expect(LIMITS.secrets).toBe(false);
  });

  it('contains comprehensive fixture suite covering D-03.ON-01 to D-03.ON-07', () => {
    const requiredTasks = [
      'D-03.ON-01',
      'D-03.ON-02',
      'D-03.ON-03',
      'D-03.ON-04',
      'D-03.ON-05',
      'D-03.ON-06',
      'D-03.ON-07',
    ];

    for (const task of requiredTasks) {
      const found = BOT_SANDBOX_FIXTURES.some((f) => f.task === task);
      expect(found, `Missing fixture coverage for task ${task}`).toBe(true);
    }
  });

  it('ensures all fixtures have unique IDs and valid consumer paths', () => {
    const ids = new Set<string>();
    for (const fixture of BOT_SANDBOX_FIXTURES) {
      expect(ids.has(fixture.id), `Duplicate fixture ID: ${fixture.id}`).toBe(false);
      ids.add(fixture.id);

      expect(['runPreflight', 'runTurn']).toContain(fixture.consumerPath);
      expect(['control', 'hostile']).toContain(fixture.category);
      expect(fixture.expected.checks.length).toBeGreaterThan(0);
      expect(fixture.description.trim().length).toBeGreaterThan(10);
    }
  });

  it('verifies positive control fixture D-03.ON-01-POS allows valid execution', () => {
    const control = BOT_SANDBOX_FIXTURES.find((f) => f.id === 'D-03.ON-01-POS');
    expect(control).toBeDefined();
    expect(control?.category).toBe('control');
    expect(control?.expected.verdict).toBe('ALLOW');
  });

  it('verifies hostile fixtures specify expected denials and error classes', () => {
    const hostileFixtures = BOT_SANDBOX_FIXTURES.filter(
      (f) => f.category === 'hostile' && f.id !== 'D-03.ON-05-LEAK'
    );

    for (const f of hostileFixtures) {
      expect(f.expected.verdict).toBe('DENY');
      expect(f.expected.errorClass).toBeDefined();
      expect([
        'WasmtimeProviderError',
        'BotOutputValidationError',
        'RuntimeCancelledError',
      ]).toContain(f.expected.errorClass);
    }
  });

  it('verifies canary sentinels do not leak secrets and follow naming convention', () => {
    for (const f of BOT_SANDBOX_FIXTURES) {
      if (f.canary) {
        expect(f.canary.startsWith('CANARY_')).toBe(true);
        expect(f.canary).not.toMatch(/password|secret|key|token|auth/i);
      }
    }
  });

  it('exports valid consumer path diagram and runner spec generator', () => {
    expect(CONSUMER_PATH).toContain('flowchart');
    expect(CONSUMER_PATH).toContain('BotOnlineService');
    expect(CONSUMER_PATH).toContain('WasmtimeCpythonAdapter');
    expect(CONSUMER_PATH).toContain('Wasmtime Sandbox');

    const runnerSpec = fixtureRunnerSpec();
    expect(runnerSpec).toContain('Test: D-03.ON-01-POS');
    expect(runnerSpec).toContain('Test: D-03.ON-02-NET');
    expect(runnerSpec).toContain('Consumer: BotOnlineService');
  });
});
