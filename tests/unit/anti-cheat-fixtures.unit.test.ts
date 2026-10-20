/**
 * anti-cheat-fixtures.unit.test.ts
 *
 * Unit tests validating D05-W1 Anti-Cheat Fixtures & Privacy Canary Specification.
 * Ensures:
 * - ecc:security-review: Complete tamper vector coverage, safe canary sentinels
 * - ecc:contract-first: Parity with Fastify AppError error codes and game rules
 * - ecc:blueprint: Multi-surface privacy verification with owner vs public distinction
 */

import { describe, it, expect } from 'vitest';
import {
  ANTI_CHEAT_FIXTURES,
  formatAntiCheatFixtures,
} from '../security/anti-cheat-fixtures.js';
import {
  PRIVACY_CANARIES,
  SCAN_SURFACES,
  scanContentForCanaryLeaks,
  formatPrivacyCanaryProcedure,
} from '../security/privacy-canary.js';

describe('D05-W1: Anti-Cheat Fixtures & Privacy Canary Verification', () => {
  it('covers all required tasks from D-04.01 to D-04.07', () => {
    const requiredTasks = [
      'D-04.01',
      'D-04.02',
      'D-04.03',
      'D-04.04',
      'D-04.05',
      'D-04.06',
      'D-04.07',
    ];

    for (const task of requiredTasks) {
      const found = ANTI_CHEAT_FIXTURES.some((f) => f.task === task);
      expect(found, `Missing coverage for task ${task}`).toBe(true);
    }
  });

  it('ensures all tamper fixtures have unique IDs and comprehensive invariants', () => {
    const ids = new Set<string>();
    for (const f of ANTI_CHEAT_FIXTURES) {
      expect(ids.has(f.id), `Duplicate fixture ID: ${f.id}`).toBe(false);
      ids.add(f.id);

      expect(f.name.length).toBeGreaterThan(5);
      expect(f.description.length).toBeGreaterThan(10);
      expect(f.expected.httpStatus).toBeGreaterThanOrEqual(200);
      expect(f.expected.reason.length).toBeGreaterThan(2);
      expect(f.expected.invariants.length).toBeGreaterThan(0);
    }
  });

  it('verifies safe canary sentinels format and absence of real secrets', () => {
    expect(PRIVACY_CANARIES.SOURCE).toBe('CANARY_SOURCE_TEST_2026_SENTINEL');
    expect(PRIVACY_CANARIES.MEMORY).toBe('CANARY_MEMORY_TEST_2026_SENTINEL');
    expect(PRIVACY_CANARIES.LOG).toBe('CANARY_LOG_TEST_2026_SENTINEL');
    expect(PRIVACY_CANARIES.SESSION).toBe('CANARY_SESSION_TEST_2026_SENTINEL');

    for (const [key, val] of Object.entries(PRIVACY_CANARIES)) {
      expect(val.startsWith('CANARY_')).toBe(true);
      expect(val.endsWith('_SENTINEL')).toBe(true);
      expect(val).not.toMatch(/password|secret|bearer|token/i);
    }
  });

  it('verifies scan surfaces cover HTTP, SSE, Replay, Diagnostics, and Errors', () => {
    const types = new Set(SCAN_SURFACES.map((s) => s.type));
    expect(types.has('HTTP_API')).toBe(true);
    expect(types.has('SSE_STREAM')).toBe(true);
    expect(types.has('REPLAY_AUDIT')).toBe(true);
    expect(types.has('DIAGNOSTICS')).toBe(true);
    expect(types.has('ERROR_PAYLOAD')).toBe(true);
  });

  it('scanner correctly detects leaked canary on public surfaces', () => {
    const leakedPayload = JSON.stringify({
      event: 'PIECE_MOVE_ACCEPTED',
      leak: PRIVACY_CANARIES.SOURCE,
    });

    const results = scanContentForCanaryLeaks(leakedPayload, 'Room Public Detail', 'PUBLIC');
    expect(results.length).toBe(1);
    expect(results[0].leaked).toBe(true);
    expect(results[0].canaryType).toBe('SOURCE');
    expect(results[0].compliant).toBe(false); // Violation!
  });

  it('scanner confirms zero-leak compliant payload', () => {
    const cleanPayload = JSON.stringify({
      event: 'PIECE_MOVE_ACCEPTED',
      from: 'a1',
      to: 'a2',
      stateVersion: 2,
    });

    const results = scanContentForCanaryLeaks(cleanPayload, 'Room Public Detail', 'PUBLIC');
    expect(results.length).toBe(1);
    expect(results[0].leaked).toBe(false);
    expect(results[0].compliant).toBe(true);
  });

  it('scanner allows legitimate owner access to own source code', () => {
    const ownerResponse = JSON.stringify({
      botId: 'bot-123',
      source: PRIVACY_CANARIES.SOURCE,
    });

    const results = scanContentForCanaryLeaks(ownerResponse, 'Owner Bot Library Detail', 'OWNER');
    expect(results.length).toBe(1);
    expect(results[0].leaked).toBe(true);
    expect(results[0].compliant).toBe(true); // Allowed by Visibility Matrix for Owner
  });

  it('formatters generate complete non-empty procedure and fixture specs', () => {
    const fixtureDoc = formatAntiCheatFixtures();
    expect(fixtureDoc).toContain('D-04.01-T1');
    expect(fixtureDoc).toContain('D-04.07-T1');

    const procedureDoc = formatPrivacyCanaryProcedure();
    expect(procedureDoc).toContain('CANARY_SOURCE_TEST_2026_SENTINEL');
    expect(procedureDoc).toContain('Zero-match across all public surfaces');
  });
});
