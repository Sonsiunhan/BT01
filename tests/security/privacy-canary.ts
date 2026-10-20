/**
 * privacy-canary.ts
 * D05-W1 — Canary design, scan targets and procedure for D-04.08
 *
 * ecc:security-review  — Canary sentinels are unique test data strings,
 *                        NEVER real user secrets or actual production tokens.
 * ecc:contract-first   — Surface targets match real OTTv2 router & SSE endpoints.
 * ecc:blueprint        — Visibility matrix: zero private leaks on public surfaces;
 *                        owners retain legitimate access to own resources.
 */

/** ── Safe Canary Sentinel Constants (Test Data Only) ───────────────── */
export const PRIVACY_CANARIES = {
  SOURCE:  'CANARY_SOURCE_TEST_2026_SENTINEL',
  MEMORY:  'CANARY_MEMORY_TEST_2026_SENTINEL',
  LOG:     'CANARY_LOG_TEST_2026_SENTINEL',
  SESSION: 'CANARY_SESSION_TEST_2026_SENTINEL',
} as const;

export type CanaryType = keyof typeof PRIVACY_CANARIES;

/** ── Public & Protected Surface Definitions ─────────────────────────── */
export interface ScanSurface {
  name:        string;
  type:        'HTTP_API' | 'SSE_STREAM' | 'REPLAY_AUDIT' | 'DIAGNOSTICS' | 'ERROR_PAYLOAD';
  path:        string;
  expectedLeakFree: CanaryType[];
  ownerAllowed:     CanaryType[];
}

export const SCAN_SURFACES: readonly ScanSurface[] = [
  {
    name: 'Room Public Detail',
    type: 'HTTP_API',
    path: '/rooms/:roomId',
    expectedLeakFree: ['SOURCE', 'MEMORY', 'LOG', 'SESSION'],
    ownerAllowed: [],
  },
  {
    name: 'Match Snapshot',
    type: 'HTTP_API',
    path: '/matches/:roomId',
    expectedLeakFree: ['SOURCE', 'MEMORY', 'LOG', 'SESSION'],
    ownerAllowed: [],
  },
  {
    name: 'Room Event Stream',
    type: 'SSE_STREAM',
    path: '/rooms/events',
    expectedLeakFree: ['SOURCE', 'MEMORY', 'LOG', 'SESSION'],
    ownerAllowed: [],
  },
  {
    name: 'Match Event Stream (Spectator)',
    type: 'SSE_STREAM',
    path: '/matches/:roomId/events (spectator)',
    expectedLeakFree: ['SOURCE', 'MEMORY', 'LOG', 'SESSION'],
    ownerAllowed: [],
  },
  {
    name: 'Public Match History & Replay',
    type: 'REPLAY_AUDIT',
    path: '/history/:matchId/replay',
    expectedLeakFree: ['SOURCE', 'MEMORY', 'LOG', 'SESSION'],
    ownerAllowed: [],
  },
  {
    name: 'System Metrics Snapshot',
    type: 'DIAGNOSTICS',
    path: '/metrics',
    expectedLeakFree: ['SOURCE', 'MEMORY', 'LOG', 'SESSION'],
    ownerAllowed: [],
  },
  {
    name: 'R3 Provider Diagnostics',
    type: 'DIAGNOSTICS',
    path: '/diagnostics/r3/provider',
    expectedLeakFree: ['SOURCE', 'MEMORY', 'LOG', 'SESSION'],
    ownerAllowed: [],
  },
  {
    name: 'Fastify AppError Details',
    type: 'ERROR_PAYLOAD',
    path: 'Error response JSON (details field)',
    expectedLeakFree: ['SOURCE', 'MEMORY', 'LOG', 'SESSION'],
    ownerAllowed: [],
  },
  {
    name: 'Owner Bot Library Detail',
    type: 'HTTP_API',
    path: '/bot-library/:botId/revisions/:revId',
    expectedLeakFree: ['SESSION'],
    ownerAllowed: ['SOURCE'], // Owner CAN view own source code
  },
];

/** ── Canary Leak Detection Engine ───────────────────────────────────── */
export interface LeakDetectionResult {
  leaked: boolean;
  canaryType?: CanaryType;
  surface: string;
  matchedString?: string;
  viewerRole: 'OWNER' | 'PUBLIC';
  compliant: boolean; // true if within policy
}

/**
 * Scans a response payload body string for any occurrences of canary sentinels.
 * Checks whether detected canaries violate the Visibility Matrix.
 */
export function scanContentForCanaryLeaks(
  content: string,
  surfaceName: string,
  viewerRole: 'OWNER' | 'PUBLIC' = 'PUBLIC'
): LeakDetectionResult[] {
  const surface = SCAN_SURFACES.find((s) => s.name === surfaceName);
  const results: LeakDetectionResult[] = [];

  for (const [type, canaryString] of Object.entries(PRIVACY_CANARIES) as [CanaryType, string][]) {
    if (content.includes(canaryString)) {
      // Canary was found!
      const isAllowedForOwner = viewerRole === 'OWNER' && (surface?.ownerAllowed.includes(type) ?? false);
      const isViolation = !isAllowedForOwner;

      results.push({
        leaked: true,
        canaryType: type,
        surface: surfaceName,
        matchedString: canaryString,
        viewerRole,
        compliant: !isViolation,
      });
    }
  }

  if (results.length === 0) {
    results.push({
      leaked: false,
      surface: surfaceName,
      viewerRole,
      compliant: true,
    });
  }

  return results;
}

/** ── Canary Scan Procedure Generator ────────────────────────────────── */
export function formatPrivacyCanaryProcedure(): string {
  return `
# Privacy Canary Verification Procedure (D-04.08)

1. SETUP:
   - Inject "${PRIVACY_CANARIES.SOURCE}" into test bot Python source.
   - Inject "${PRIVACY_CANARIES.MEMORY}" into test bot JSON memory payload.
   - Inject "${PRIVACY_CANARIES.LOG}" into test bot private execution log.
   - Inject "${PRIVACY_CANARIES.SESSION}" into test session cookie / auth state.

2. EXECUTION:
   - Run full match with test bot across 10 plies.
   - Capture all response bodies across the following surfaces:
${SCAN_SURFACES.map(s => `     * [${s.type}] ${s.name} (${s.path})`).join('\n')}

3. ASSERTION:
   - Zero-match across all public surfaces (grep for CANARY_* must return 0 results).
   - Only owner authenticated call to /bot-library can view CANARY_SOURCE_2026.
   - Pass verdict: 100% compliant across all scanned surfaces.
`.trim();
}
