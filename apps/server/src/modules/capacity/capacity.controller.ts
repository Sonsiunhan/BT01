/**
 * apps/server/src/modules/capacity/capacity.controller.ts
 *
 * Implements Adaptive Capacity Controller (FRS-L07 Task L-07.03)
 * States: NORMAL, PRESSURE, RECOVERY with hysteresis, cooldown, and jittered load shedding.
 */

import v8 from "node:v8";
import { DEFAULT_BUDGET_PROFILE_V0, resolveBudgetNumber, type BudgetProfile } from "../../config/budget-profile.js";
import type { MetricsRegistry } from "../diagnostics/metrics.js";
import { AdmissionPool } from "./admission.pool.js";
import type {
  AdmissionDecision,
  AdmissionPoolType,
  CapacityControllerStatus,
  CapacityState,
  CapacityThresholds,
  PoolOccupancy,
  SystemMetricsInput,
} from "./capacity.types.js";

export interface CapacityControllerOptions {
  readonly profile?: BudgetProfile;
  readonly metrics?: MetricsRegistry;
  readonly thresholds?: Partial<CapacityThresholds>;
  readonly now?: () => number;
  readonly sampleIntervalMs?: number;
}

export class CapacityController {
  private readonly profile: BudgetProfile;
  private readonly metricsRegistry: MetricsRegistry | undefined;
  private readonly now: () => number;
  private readonly thresholds: CapacityThresholds;
  private readonly sampleIntervalMs: number;

  private state: CapacityState = "NORMAL";
  private stateChangedAt: number;
  private cooldownUntil = 0;
  private consecutiveSuccessfulProbes = 0;
  private lastEvaluatedAt = 0;

  private readonly pools: Record<AdmissionPoolType, AdmissionPool>;
  private lastMetrics: SystemMetricsInput;

  constructor(options: CapacityControllerOptions = {}) {
    this.profile = options.profile ?? DEFAULT_BUDGET_PROFILE_V0;
    this.metricsRegistry = options.metrics;
    this.now = options.now ?? (() => Date.now());
    this.sampleIntervalMs = options.sampleIntervalMs ?? 1000;
    this.stateChangedAt = this.now();

    const cfg = this.profile.capacityController;
    this.thresholds = {
      highEventLoopLagMs: options.thresholds?.highEventLoopLagMs ?? resolveBudgetNumber(cfg.highEventLoopLagMs, 50),
      lowEventLoopLagMs: options.thresholds?.lowEventLoopLagMs ?? resolveBudgetNumber(cfg.lowEventLoopLagMs, 20),
      highHeapPercent: options.thresholds?.highHeapPercent ?? resolveBudgetNumber(cfg.highHeapPercent, 85),
      lowHeapPercent: options.thresholds?.lowHeapPercent ?? resolveBudgetNumber(cfg.lowHeapPercent, 70),
      highRssBytes: options.thresholds?.highRssBytes ?? resolveBudgetNumber(cfg.highRssBytes, 1024 * 1024 * 1024),
      lowRssBytes: options.thresholds?.lowRssBytes ?? resolveBudgetNumber(cfg.lowRssBytes, 800 * 1024 * 1024),
      cooldownPeriodMs: options.thresholds?.cooldownPeriodMs ?? resolveBudgetNumber(cfg.cooldownPeriodMs, 5000),
      recoveryProbeBudget: options.thresholds?.recoveryProbeBudget ?? resolveBudgetNumber(cfg.recoveryProbeBudget, 5),
      reconnectJitterMaxMs: options.thresholds?.reconnectJitterMaxMs ?? resolveBudgetNumber(cfg.reconnectJitterMaxMs, 3000),
    };

    const adm = this.profile.admission;
    this.pools = {
      lobby: new AdmissionPool(
        "lobby",
        resolveBudgetNumber(adm.maxConcurrentLobby, 100),
        resolveBudgetNumber(adm.perPrincipalLobbyQuota, 10),
        0
      ),
      pvp: new AdmissionPool(
        "pvp",
        resolveBudgetNumber(adm.maxActivePvPMatches, 50),
        resolveBudgetNumber(adm.perPrincipalStreamQuota, 5),
        10 // Reserved 10 slots for priority gameplay updates
      ),
      python: new AdmissionPool(
        "python",
        resolveBudgetNumber(adm.maxActivePythonMatches, 1), // Authoritative gate: Online Python strictly 1 active match
        1,
        0
      ),
    };

    this.lastMetrics = {
      eventLoopLagMs: 0,
      heapPercent: 0,
      rssBytes: 0,
    };
  }

  getState(): CapacityState {
    return this.state;
  }

  evaluateMetrics(customMetrics?: Partial<SystemMetricsInput>): CapacityState {
    const currentTime = this.now();
    if (!customMetrics && this.lastEvaluatedAt > 0 && currentTime - this.lastEvaluatedAt < this.sampleIntervalMs) {
      return this.state;
    }
    this.lastEvaluatedAt = currentTime;

    const currentLag = customMetrics?.eventLoopLagMs ?? this.metricsRegistry?.getEventLoopLagMs() ?? 0;
    let currentHeap = customMetrics?.heapPercent;
    let currentRss = customMetrics?.rssBytes;

    if (currentHeap === undefined || currentRss === undefined) {
      const mem = process.memoryUsage();
      if (currentHeap === undefined) {
        const heapLimit = v8.getHeapStatistics().heap_size_limit;
        currentHeap = heapLimit > 0 ? Number(((mem.heapUsed / heapLimit) * 100).toFixed(2)) : 0;
      }
      if (currentRss === undefined) {
        currentRss = mem.rss;
      }
    }

    this.lastMetrics = {
      eventLoopLagMs: currentLag,
      heapPercent: currentHeap,
      rssBytes: currentRss,
      ...(customMetrics?.cpuPercent !== undefined ? { cpuPercent: customMetrics.cpuPercent } : {}),
    };

    const isHigh =
      currentLag >= this.thresholds.highEventLoopLagMs ||
      currentHeap >= this.thresholds.highHeapPercent ||
      currentRss >= this.thresholds.highRssBytes;

    const isLow =
      currentLag <= this.thresholds.lowEventLoopLagMs &&
      currentHeap <= this.thresholds.lowHeapPercent &&
      currentRss <= this.thresholds.lowRssBytes;

    switch (this.state) {
      case "NORMAL": {
        if (isHigh) {
          this.state = "PRESSURE";
          this.stateChangedAt = currentTime;
          this.consecutiveSuccessfulProbes = 0;
        }
        break;
      }

      case "PRESSURE": {
        // Hysteresis: Only enter RECOVERY when ALL metrics drop below the low thresholds
        if (isLow) {
          this.state = "RECOVERY";
          this.stateChangedAt = currentTime;
          this.cooldownUntil = currentTime + this.thresholds.cooldownPeriodMs;
          this.consecutiveSuccessfulProbes = 0;
        }
        break;
      }

      case "RECOVERY": {
        if (isHigh) {
          // Relapse immediately on any high spike
          this.state = "PRESSURE";
          this.stateChangedAt = currentTime;
          this.consecutiveSuccessfulProbes = 0;
        } else if (isLow) {
          this.consecutiveSuccessfulProbes += 1;
          const cooldownSatisfied = currentTime >= this.cooldownUntil;
          const probeSatisfied = this.consecutiveSuccessfulProbes >= this.thresholds.recoveryProbeBudget;
          if (cooldownSatisfied && probeSatisfied) {
            this.state = "NORMAL";
            this.stateChangedAt = currentTime;
            this.consecutiveSuccessfulProbes = 0;
          }
        }
        break;
      }
    }

    return this.state;
  }

  recordProbeSuccess(): void {
    if (this.state === "RECOVERY") {
      this.consecutiveSuccessfulProbes += 1;
    }
  }

  getJitteredRetryAfter(baseMs = 1000): number {
    const jitter = Math.floor(Math.random() * this.thresholds.reconnectJitterMaxMs);
    return baseMs + jitter;
  }

  checkAdmission(poolType: AdmissionPoolType, principalId?: string, isPriority = false): AdmissionDecision {
    const pool = this.pools[poolType];

    switch (this.state) {
      case "NORMAL": {
        const check = pool.canAdmit(principalId, isPriority);
        if (!check.admitted) {
          return {
            admitted: false,
            pool: poolType,
            ...(check.reason ? { reason: check.reason } : {}),
            retryAfterMs: this.getJitteredRetryAfter(1000),
          };
        }
        return { admitted: true, pool: poolType };
      }

      case "PRESSURE": {
        if (poolType === "lobby") {
          return {
            admitted: false,
            pool: poolType,
            reason: "SYSTEM_PRESSURE_LOBBY_SHED",
            retryAfterMs: this.getJitteredRetryAfter(3000),
          };
        }

        if (poolType === "python") {
          return {
            admitted: false,
            pool: poolType,
            reason: "SYSTEM_PRESSURE_BOT_PREFLIGHT_SHED",
            retryAfterMs: this.getJitteredRetryAfter(5000),
          };
        }

        if (poolType === "pvp") {
          // Gameplay reserve protects active moves and reconnects
          if (isPriority) {
            const check = pool.canAdmit(principalId, true);
            if (check.admitted) {
              return { admitted: true, pool: poolType };
            }
          }
          return {
            admitted: false,
            pool: poolType,
            reason: "SYSTEM_PRESSURE_PVP_CONGESTION",
            retryAfterMs: this.getJitteredRetryAfter(2000),
          };
        }

        return { admitted: false, pool: poolType, reason: "SYSTEM_PRESSURE" };
      }

      case "RECOVERY": {
        // Controlled admission during recovery
        const check = pool.canAdmit(principalId, isPriority);
        if (!check.admitted) {
          return {
            admitted: false,
            pool: poolType,
            ...(check.reason ? { reason: check.reason } : {}),
            retryAfterMs: this.getJitteredRetryAfter(1500),
          };
        }
        return { admitted: true, pool: poolType };
      }
    }
  }

  acquire(poolType: AdmissionPoolType, principalId?: string, isPriority = false): boolean {
    const decision = this.checkAdmission(poolType, principalId, isPriority);
    if (!decision.admitted) return false;
    return this.pools[poolType].acquire(principalId, isPriority);
  }

  release(poolType: AdmissionPoolType, principalId?: string): void {
    this.pools[poolType].release(principalId);
  }

  reset(): void {
    this.state = "NORMAL";
    this.stateChangedAt = this.now();
    this.cooldownUntil = 0;
    this.consecutiveSuccessfulProbes = 0;
    this.lastEvaluatedAt = 0;
    this.pools.lobby.reset();
    this.pools.pvp.reset();
    this.pools.python.reset();
  }

  getPool(poolType: AdmissionPoolType): AdmissionPool {
    return this.pools[poolType];
  }

  getStatus(): CapacityControllerStatus {
    const currentTime = this.now();
    const poolsOccupancy: Record<AdmissionPoolType, PoolOccupancy> = {
      lobby: this.pools.lobby.getOccupancy(),
      pvp: this.pools.pvp.getOccupancy(),
      python: this.pools.python.getOccupancy(),
    };

    return {
      state: this.state,
      stateChangedAt: this.stateChangedAt,
      timeInStateMs: Math.max(0, currentTime - this.stateChangedAt),
      cooldownRemainingMs: Math.max(0, this.cooldownUntil - currentTime),
      consecutiveSuccessfulProbes: this.consecutiveSuccessfulProbes,
      pools: poolsOccupancy,
      lastMetrics: this.lastMetrics,
    };
  }
}
