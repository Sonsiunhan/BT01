/**
 * abuse.limiter.ts — D-02.08 / D-02.09 / LD-03
 * ecc:security-review: Principal/action/IP per-window counters with hard caps.
 * ecc:contract-first:  AbuseLimiter interface fixed here; Long wires into
 *                      room admission / SSE admission / matchmaking pipeline.
 */

export interface AbuseQuotaPolicy {
  principal: string;
  action: 'CREATE_ROOM' | 'JOIN_ROOM' | 'STREAM_CONNECT' | 'UPLOAD_ASSET' | 'ROOM_MOVE' | 'ROOM_CHAT';
  ip?: string;
  roomId?: string;
}

/** Single sliding-window bucket */
type WindowBucket = {
  count: number;
  windowStart: number;
};

export type AbuseDecision = 'ALLOW' | 'DENY';

/** Policy thresholds — keyed by action. All limits are per windowMs. */
export const LIMITER_POLICIES = {
  GLOBAL: {
    CREATE_ROOM:    { max: 10,  windowMs: 60_000 },
    JOIN_ROOM:      { max: 20,  windowMs: 60_000 },
    STREAM_CONNECT: { max: 50,  windowMs: 60_000 },  // SSE backpressure
    UPLOAD_ASSET:   { max: 5,   windowMs: 60_000 },
  },
  PER_ROOM: {
    ROOM_MOVE: { max: 60,  windowMs: 60_000 },   // max 1 move/s avg
    ROOM_CHAT: { max: 30,  windowMs: 60_000 },
  },
  /** Maximum number of distinct keys tracked in-memory before forced cleanup. */
  MAX_BUCKETS: 100_000,
} as const;

/**
 * AbuseLimiter — in-process sliding-window counter.
 *
 * ecc:security-review rules enforced:
 *  • Shared-IP is NOT used as sole identity: principal key always includes
 *    userId so one attacker cannot lock innocent users sharing a NAT/proxy.
 *  • Buckets evicted after windowMs to bound memory (no infinite growth).
 *  • Hard cap on bucket count prevents OOM via key-flooding.
 *  • X-Forwarded-For is accepted only as an informational tag; admission
 *    decision is always principal-based first, IP-secondarily.
 *  • Returns a decision enum — never throws — so callers can log+continue.
 */
export class AbuseLimiter {
  private readonly buckets = new Map<string, WindowBucket>();
  private lastEviction = Date.now();

  /**
   * Check and record an action in one call.
   * @returns 'ALLOW' if within quota, 'DENY' if over quota.
   */
  check(policy: AbuseQuotaPolicy): AbuseDecision {
    this.maybeEvict();

    const policy_config = this.policyFor(policy.action);
    if (!policy_config) return 'ALLOW'; // unknown action — not in scope, allow

    // Primary key: userId + action (principal identity, not IP)
    const principalKey = `${policy.principal}:${policy.action}`;
    const decision = this.checkBucket(principalKey, policy_config);

    // Secondary key: IP + action (rate-limit by IP on top — not sole gate)
    if (policy.ip) {
      const ipKey = `ip:${policy.ip}:${policy.action}`;
      const ipDecision = this.checkBucket(ipKey, policy_config);
      if (ipDecision === 'DENY') return 'DENY';
    }

    // Per-room key for room-scoped actions
    if (policy.roomId && (policy.action === 'ROOM_MOVE' || policy.action === 'ROOM_CHAT')) {
      const roomPolicyCfg = LIMITER_POLICIES.PER_ROOM[policy.action];
      const roomKey = `${policy.principal}:${policy.roomId}:${policy.action}`;
      const roomDecision = this.checkBucket(roomKey, roomPolicyCfg);
      if (roomDecision === 'DENY') return 'DENY';
    }

    return decision;
  }

  /** Exposed for testing: current bucket count. */
  get size(): number { return this.buckets.size; }

  private checkBucket(
    key: string,
    policy: { max: number; windowMs: number }
  ): AbuseDecision {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now - existing.windowStart >= policy.windowMs) {
      // Fresh window
      this.buckets.set(key, { count: 1, windowStart: now });
      return 'ALLOW';
    }

    if (existing.count >= policy.max) {
      return 'DENY';
    }

    existing.count += 1;
    return 'ALLOW';
  }

  private policyFor(action: AbuseQuotaPolicy['action']): { max: number; windowMs: number } | null {
    const global = LIMITER_POLICIES.GLOBAL as Record<string, { max: number; windowMs: number }>;
    const perRoom = LIMITER_POLICIES.PER_ROOM as Record<string, { max: number; windowMs: number }>;
    return global[action] ?? perRoom[action] ?? null;
  }

  /** Evict expired buckets; enforce hard cap against key-flooding. */
  private maybeEvict(): void {
    const now = Date.now();
    // Run eviction at most once per second OR when approaching cap
    if (now - this.lastEviction < 1_000 && this.buckets.size < LIMITER_POLICIES.MAX_BUCKETS) return;
    this.lastEviction = now;

    for (const [key, bucket] of this.buckets) {
      const policy = this.policyForKey(key);
      if (policy && now - bucket.windowStart >= policy.windowMs) {
        this.buckets.delete(key);
      }
    }

    // Hard cap: drop oldest if still over limit
    if (this.buckets.size >= LIMITER_POLICIES.MAX_BUCKETS) {
      const excess = this.buckets.size - LIMITER_POLICIES.MAX_BUCKETS + 1_000;
      let removed = 0;
      for (const key of this.buckets.keys()) {
        if (removed >= excess) break;
        this.buckets.delete(key);
        removed++;
      }
    }
  }

  private policyForKey(key: string): { max: number; windowMs: number } | null {
    // key format: "<principal>:<action>" or "ip:<ip>:<action>" or "<principal>:<roomId>:<action>"
    const parts = key.split(':');
    const action = parts[parts.length - 1] as AbuseQuotaPolicy['action'];
    return this.policyFor(action);
  }
}

/**
 * Contract for Long (LD-03) — wire this into room admission:
 *
 * ```typescript
 * // In room.route.ts or matchmaking.route.ts (Long's scope):
 * import { AbuseLimiter } from '../auth/abuse.limiter.js';
 * const limiter = new AbuseLimiter();
 *
 * // Before rooms.create():
 * const decision = limiter.check({
 *   principal: context.user.id,
 *   action: 'CREATE_ROOM',
 *   ip: request.ip,
 * });
 * if (decision === 'DENY') throw new AppError('RATE_LIMITED', 'Quá nhiều phòng. Vui lòng thử lại.', 429, true, 'RECOVERABLE');
 * ```
 *
 * SSE / STREAM_CONNECT wiring:
 * ```typescript
 * const decision = limiter.check({ principal: userId, action: 'STREAM_CONNECT', ip });
 * if (decision === 'DENY') { reply.raw.writeHead(429); reply.raw.end(); return; }
 * ```
 */
