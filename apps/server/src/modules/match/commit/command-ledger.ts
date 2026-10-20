import type { CommandKey, CommandOutcome } from "./commit.port.js";

export interface CompactionResult {
  tombstonedCount: number;
  prunedCount: number;
  preservedUnresolvedCount: number;
}

export class CommandLedger {
  private readonly records = new Map<string, CommandOutcome>();
  private readonly byTargetId = new Map<string, Set<string>>();
  private readonly maxPerTarget: number;

  constructor(maxPerTarget = 100) {
    this.maxPerTarget = maxPerTarget;
  }

  buildKey(key: CommandKey): string {
    return JSON.stringify([key.targetId, key.principalId, key.commandId, key.operation]);
  }

  get(key: CommandKey): CommandOutcome | undefined {
    return this.records.get(this.buildKey(key));
  }

  has(key: CommandKey): boolean {
    return this.records.has(this.buildKey(key));
  }

  isExpired(key: CommandKey, now: number = Date.now()): boolean {
    const outcome = this.get(key);
    if (!outcome) return false;
    if (outcome.expiresAt !== undefined && now > outcome.expiresAt) {
      return true;
    }
    return false;
  }

  record(outcome: CommandOutcome, key: CommandKey): void {
    const stringKey = this.buildKey(key);
    const storedOutcome = key.payloadHash === undefined ? outcome : { ...outcome, payloadHash: key.payloadHash };
    this.records.set(stringKey, storedOutcome);

    const targetKeys = this.byTargetId.get(key.targetId) ?? new Set<string>();
    targetKeys.add(stringKey);
    this.byTargetId.set(key.targetId, targetKeys);

    if (targetKeys.size > this.maxPerTarget) {
      // Find oldest key that is NOT an unresolved ("UNKNOWN") outcome and not the newly added key
      let candidateKey: string | null = null;
      for (const k of targetKeys) {
        if (k !== stringKey) {
          const item = this.records.get(k);
          if (item && item.outcome !== "UNKNOWN") {
            candidateKey = k;
            break;
          }
        }
      }

      if (candidateKey) {
        targetKeys.delete(candidateKey);
        this.records.delete(candidateKey);
      }
      // Note: If all entries are UNKNOWN, none are evicted to ensure durability!
    }
  }

  /**
   * Compaction removes or tombstones expired committed/conflict records.
   * INVARIANT (FRS-L06 §3, L-05.04): Unresolved outcomes ("UNKNOWN") are NEVER purged during compaction.
   */
  compact(now: number = Date.now(), ttlMs = 300_000): CompactionResult {
    let tombstonedCount = 0;
    let prunedCount = 0;
    let preservedUnresolvedCount = 0;

    for (const [key, outcome] of Array.from(this.records.entries())) {
      // Invariant: NEVER purge or drop unresolved outcomes
      if (outcome.outcome === "UNKNOWN") {
        preservedUnresolvedCount++;
        continue;
      }

      const isExpiredByTime = outcome.expiresAt !== undefined ? now > outcome.expiresAt : now - outcome.committedAt > ttlMs;

      if (outcome.isTombstone) {
        // Tombstone that has exceeded double TTL can be pruned completely
        if (now - outcome.committedAt > ttlMs * 2) {
          this.records.delete(key);
          prunedCount++;
        }
      } else if (isExpiredByTime) {
        // Convert expired outcome to tombstone: keep key identity, strip large payload
        outcome.isTombstone = true;
        outcome.ackPayload = null;
        tombstonedCount++;
      }
    }

    return { tombstonedCount, prunedCount, preservedUnresolvedCount };
  }

  clear(targetId?: string): void {
    if (targetId) {
      const targetKeys = this.byTargetId.get(targetId);
      if (targetKeys) {
        for (const key of targetKeys) {
          this.records.delete(key);
        }
        this.byTargetId.delete(targetId);
      }
    } else {
      this.records.clear();
      this.byTargetId.clear();
    }
  }

  size(): number {
    return this.records.size;
  }
}
