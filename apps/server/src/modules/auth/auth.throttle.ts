import { AppError } from "../../shared/errors/app-error.js";

type Bucket = { failures: number; blockedUntil: number };

const MAX_BUCKETS = 50_000;
/** Buckets older than this (from blockedUntil) are eligible for cleanup. */
const BUCKET_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // run cleanup at most once per minute

export class AuthThrottle {
  private readonly buckets = new Map<string, Bucket>();
  private lastCleanup = Date.now();

  guard(key: string): void {
    this.maybeCleanup();
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    const remaining = bucket.blockedUntil - Date.now();
    if (remaining <= 0) return;
    throw new AppError("RATE_LIMITED", "Có quá nhiều lần thử. Vui lòng thử lại sau.", 429, true, "RECOVERABLE", {
      retryAfterSeconds: Math.ceil(remaining / 1000),
    });
  }

  failure(key: string): void {
    this.maybeCleanup();
    const current = this.buckets.get(key) ?? { failures: 0, blockedUntil: 0 };
    const failures = current.failures + 1;
    const delay = failures >= 10 ? 60_000 : failures >= 6 ? 30_000 : failures >= 4 ? 5_000 : failures >= 3 ? 1_000 : 0;
    this.buckets.set(key, { failures, blockedUntil: Date.now() + delay });
  }

  success(key: string): void {
    this.buckets.delete(key);
  }

  /** Evict expired entries and enforce hard cap to prevent OOM from key flooding. */
  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS && this.buckets.size < MAX_BUCKETS) return;
    this.lastCleanup = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.blockedUntil + BUCKET_TTL_MS < now) this.buckets.delete(key);
    }
    // Hard cap: if still over limit after TTL cleanup, drop oldest entries
    if (this.buckets.size >= MAX_BUCKETS) {
      const excess = this.buckets.size - MAX_BUCKETS + 1000; // reclaim 1000 slots
      let removed = 0;
      for (const key of this.buckets.keys()) {
        if (removed >= excess) break;
        this.buckets.delete(key);
        removed++;
      }
    }
  }

  /** Exposed for testing: current bucket count. */
  get size(): number { return this.buckets.size; }
}
