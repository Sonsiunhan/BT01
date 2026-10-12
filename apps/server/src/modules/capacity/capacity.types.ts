/**
 * apps/server/src/modules/capacity/capacity.types.ts
 *
 * Types for Capacity Controller and Admission Pools (FRS-L07 Task L-07.03)
 */

export type CapacityState = "NORMAL" | "PRESSURE" | "RECOVERY";

export type AdmissionPoolType = "lobby" | "pvp" | "python";

export interface AdmissionDecision {
  readonly admitted: boolean;
  readonly pool: AdmissionPoolType;
  readonly reason?: string;
  readonly retryAfterMs?: number;
}

export interface PoolOccupancy {
  readonly pool: AdmissionPoolType;
  readonly active: number;
  readonly max: number;
  readonly reserved: number;
  readonly perPrincipalActive: number;
}

export interface SystemMetricsInput {
  readonly eventLoopLagMs: number;
  readonly heapPercent: number;
  readonly rssBytes: number;
  readonly cpuPercent?: number;
}

export interface CapacityThresholds {
  readonly highEventLoopLagMs: number;
  readonly lowEventLoopLagMs: number;
  readonly highHeapPercent: number;
  readonly lowHeapPercent: number;
  readonly highRssBytes: number;
  readonly lowRssBytes: number;
  readonly cooldownPeriodMs: number;
  readonly recoveryProbeBudget: number;
  readonly reconnectJitterMaxMs: number;
  readonly highCpuPercent?: number;
  readonly lowCpuPercent?: number;
}

export interface CapacityControllerStatus {
  readonly state: CapacityState;
  readonly stateChangedAt: number;
  readonly timeInStateMs: number;
  readonly cooldownRemainingMs: number;
  readonly consecutiveSuccessfulProbes: number;
  readonly pools: Record<AdmissionPoolType, PoolOccupancy>;
  readonly lastMetrics: SystemMetricsInput;
}
