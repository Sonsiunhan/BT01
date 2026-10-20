/**
 * offline-probes.unit.test.ts
 *
 * Unit tests validating D04-W1 Offline Probes & Consumer Path Specification.
 * Ensures:
 * - ecc:security-review: Canary non-secret strings, threat vectors, capability denials
 * - ecc:contract-first: Manifest limit parity, opaque iframe attributes
 * - ecc:blueprint: Complete coverage of D-03.OFF-01 to D-03.OFF-09
 */

import { describe, it, expect } from 'vitest';
import {
  OFFLINE_PROBES,
  CANARY_SENTINELS,
  BRIDGE_ATTACK_VECTORS,
  OFFLINE_LIMITS,
  formatOfflineProbeSpec,
} from '../security/offline-probes.js';

describe('D04-W1: Offline Probes & Consumer Path Verification', () => {
  it('enforces offline manifest and sandbox constraints', () => {
    expect(OFFLINE_LIMITS.sourceBytes).toBe(64 * 1024);
    expect(OFFLINE_LIMITS.memoryBytes).toBe(8 * 1024);
    expect(OFFLINE_LIMITS.preflightMs).toBe(250);
    expect(OFFLINE_LIMITS.perTurnMs).toBe(500);
    expect(OFFLINE_LIMITS.iframeSandbox).toBe('allow-scripts');
    expect(OFFLINE_LIMITS.iframeSandbox).not.toContain('allow-same-origin');
    expect(OFFLINE_LIMITS.cspConnectSrc).toBe("'none'");
  });

  it('covers all required tasks from D-03.OFF-01 to D-03.OFF-09', () => {
    const tasks = [
      'D-03.OFF-01',
      'D-03.OFF-02',
      'D-03.OFF-03',
      'D-03.OFF-04',
      'D-03.OFF-05',
      'D-03.OFF-06',
      'D-03.OFF-07',
      'D-03.OFF-08',
      'D-03.OFF-09',
    ];

    for (const task of tasks) {
      const found = OFFLINE_PROBES.some((p) => p.task === task);
      expect(found, `Missing coverage for task ${task}`).toBe(true);
    }
  });

  it('ensures all probes have unique IDs and valid categories', () => {
    const ids = new Set<string>();
    for (const probe of OFFLINE_PROBES) {
      expect(ids.has(probe.id), `Duplicate probe ID: ${probe.id}`).toBe(false);
      ids.add(probe.id);

      expect(['control', 'adversarial', 'lifecycle', 'integrity']).toContain(probe.category);
      expect(['offlineRunner', 'offlineCompartment', 'serviceWorker']).toContain(probe.consumerPath);
      expect(probe.expected.checks.length).toBeGreaterThan(0);
      expect(probe.description.trim().length).toBeGreaterThan(10);
    }
  });

  it('verifies positive control allows execution and tampered kit denies', () => {
    const pos = OFFLINE_PROBES.find((p) => p.id === 'D-03.OFF-01-POS');
    expect(pos).toBeDefined();
    expect(pos?.expected.verdict).toBe('ALLOW');

    const tamper = OFFLINE_PROBES.find((p) => p.id === 'D-03.OFF-01-TAMPER');
    expect(tamper).toBeDefined();
    expect(tamper?.expected.verdict).toBe('DENY');
    expect(tamper?.expected.errorCode).toBe('RUNTIME_HASH_MISMATCH');
  });

  it('verifies canaries are safe test data and do not match secrets', () => {
    expect(CANARY_SENTINELS.DOM).toBe('CANARY_DOM_OFFLINE_2026');
    expect(CANARY_SENTINELS.COOKIE).toBe('CANARY_COOKIE_OFFLINE_2026');
    expect(CANARY_SENTINELS.STORAGE).toBe('CANARY_STORAGE_OFFLINE_2026');
    expect(CANARY_SENTINELS.BRIDGE).toBe('CANARY_BRIDGE_OFFLINE_2026');

    for (const probe of OFFLINE_PROBES) {
      if (probe.canary) {
        expect(probe.canary.startsWith('CANARY_')).toBe(true);
        expect(probe.canary).not.toMatch(/password|secret|key|token|auth/i);
      }
    }
  });

  it('documents all bridge attack vectors with concrete mitigations', () => {
    const vectorNames = BRIDGE_ATTACK_VECTORS.map((v) => v.vector);
    expect(vectorNames).toContain('FORGED_WINDOW_POSTMESSAGE');
    expect(vectorNames).toContain('WRONG_KIND_PAYLOAD');
    expect(vectorNames).toContain('STALE_INVOCATION_ID');
    expect(vectorNames).toContain('OVERSIZED_PAYLOAD_FLOOD');

    for (const v of BRIDGE_ATTACK_VECTORS) {
      expect(v.description.length).toBeGreaterThan(20);
      expect(v.expectedMitigation.length).toBeGreaterThan(20);
    }
  });

  it('verifies formatOfflineProbeSpec produces valid non-empty documentation', () => {
    const spec = formatOfflineProbeSpec();
    expect(spec).toContain('Probe ID: D-03.OFF-01-POS');
    expect(spec).toContain('Probe ID: D-03.OFF-02-DOM-COOKIE');
    expect(spec).toContain('Probe ID: D-03.OFF-09-ELO-GUARD');
  });
});
