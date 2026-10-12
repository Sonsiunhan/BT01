/**
 * apps/server/src/modules/capacity/admission.pool.ts
 *
 * Implements segregated admission pools (FRS-L07 Task L-07.03)
 * Tracks concurrency, per-principal quotas, and priority gameplay reservations.
 */

import type { AdmissionPoolType, PoolOccupancy } from "./capacity.types.js";

export class AdmissionPool {
  private activeCount = 0;
  private readonly principals = new Map<string, number>();

  constructor(
    public readonly pool: AdmissionPoolType,
    public readonly maxConcurrency: number,
    public readonly perPrincipalQuota: number,
    public readonly reservedConcurrency = 0
  ) {}

  canAdmit(principalId?: string, isPriority = false): { admitted: boolean; reason?: string } {
    if (this.activeCount >= this.maxConcurrency) {
      return { admitted: false, reason: "POOL_CAPACITY_EXCEEDED" };
    }

    const availableStandard = this.maxConcurrency - this.reservedConcurrency;
    if (!isPriority && this.activeCount >= availableStandard) {
      return { admitted: false, reason: "RESERVED_FOR_PRIORITY_GAMEPLAY" };
    }

    if (principalId) {
      const currentPrincipalActive = this.principals.get(principalId) ?? 0;
      if (currentPrincipalActive >= this.perPrincipalQuota) {
        return { admitted: false, reason: "PRINCIPAL_QUOTA_EXCEEDED" };
      }
    }

    return { admitted: true };
  }

  acquire(principalId?: string, isPriority = false): boolean {
    const check = this.canAdmit(principalId, isPriority);
    if (!check.admitted) return false;

    this.activeCount += 1;
    if (principalId) {
      const current = this.principals.get(principalId) ?? 0;
      this.principals.set(principalId, current + 1);
    }
    return true;
  }

  release(principalId?: string): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    if (principalId) {
      const current = this.principals.get(principalId) ?? 0;
      if (current <= 1) {
        this.principals.delete(principalId);
      } else {
        this.principals.set(principalId, current - 1);
      }
    }
  }

  reset(): void {
    this.activeCount = 0;
    this.principals.clear();
  }

  getOccupancy(): PoolOccupancy {
    return {
      pool: this.pool,
      active: this.activeCount,
      max: this.maxConcurrency,
      reserved: this.reservedConcurrency,
      perPrincipalActive: this.principals.size,
    };
  }
}
