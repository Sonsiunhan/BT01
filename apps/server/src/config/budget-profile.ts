/**
 * apps/server/src/config/budget-profile.ts
 *
 * Implements FRS-L07 §3 & Wave L07-W2: Comprehensive Budget Profile
 *
 * Records configuration keys, units, sources, and rationales.
 * Unmeasured thresholds on target environments remain tagged as "UNMEASURED".
 */

export type BudgetThreshold<T> = T | "UNMEASURED";

export interface BudgetMetadataEntry {
  readonly unit: string;
  readonly source: string;
  readonly rationale: string;
}

export interface BudgetProfile {
  readonly version: "v0";
  readonly name: string;
  readonly description: string;
  readonly environment: string;

  // 1. Admission Budgets
  readonly admission: {
    readonly maxActivePvPMatches: BudgetThreshold<number>;
    readonly maxActivePythonMatches: BudgetThreshold<number>; // Authoritative gate: Online Python initially 1 active match
    readonly maxConcurrentStreams: BudgetThreshold<number>;
    readonly maxConcurrentLobby: BudgetThreshold<number>;
    readonly perPrincipalStreamQuota: BudgetThreshold<number>;
    readonly perPrincipalRoomQuota: BudgetThreshold<number>;
    readonly perPrincipalQueueQuota: BudgetThreshold<number>;
  };

  // 2. Match Lanes & DB Budgets
  readonly matchLanes: {
    readonly maxQueueDepthPerMatch: BudgetThreshold<number>;
    readonly maxQueueAgeMs: BudgetThreshold<number>;
    readonly casCommitTimeoutMs: BudgetThreshold<number>;
    readonly dbConnectionPoolSize: BudgetThreshold<number>;
    readonly commandRetryWindowMs: BudgetThreshold<number>;
    readonly unresolvedLedgerRetentionMs: BudgetThreshold<number>;
  };

  // 3. SSE Transport Budgets
  readonly sse: {
    readonly maxEventsPerBuffer: BudgetThreshold<number>;
    readonly streamDrainDeadlineMs: BudgetThreshold<number>;
    readonly heartbeatIntervalMs: BudgetThreshold<number>;
    readonly backlogRetentionWindowMs: BudgetThreshold<number>;
    readonly slowReaderDropTimeoutMs: BudgetThreshold<number>;
  };

  // 4. Retry and Leases Budgets
  readonly retryAndLeases: {
    readonly backoffBaseMs: BudgetThreshold<number>;
    readonly backoffCapMs: BudgetThreshold<number>;
    readonly backoffJitterRatio: BudgetThreshold<number>;
    readonly maxRetryAttempts: BudgetThreshold<number>;
    readonly queueLeaseTimeoutMs: BudgetThreshold<number>;
    readonly reservationTimeoutMs: BudgetThreshold<number>;
    readonly recoveryDeadlineMs: BudgetThreshold<number>;
  };

  // 5. Payload and Query Bounds
  readonly payloadAndQuery: {
    readonly maxHttpBodyBytes: BudgetThreshold<number>;
    readonly maxBotSourceBytes: BudgetThreshold<number>;
    readonly maxEventBytes: BudgetThreshold<number>;
    readonly maxHistoryPageLimit: BudgetThreshold<number>;
    readonly maxReplayPageLimit: BudgetThreshold<number>;
  };

  // 6. Latency Service Level Objectives (SLOs) from FRS-L07 Gate
  readonly latencySlo: {
    readonly humanMoveAckP95Ms: number; // Must be <= 300ms
    readonly humanMoveAckP99Ms: number; // Must be <= 1000ms
    readonly matchRecoveryP95Ms: number; // Target <= 1000ms
  };

  // 7. Measured Baseline (Populated from L07-W1 benchmarks)
  readonly measuredBaseline: {
    readonly generatorCoLocated: boolean;
    readonly httpHealthP50Ms: BudgetThreshold<number>;
    readonly httpHealthP95Ms: BudgetThreshold<number>;
    readonly httpHealthP99Ms: BudgetThreshold<number>;
    readonly sseConnectLatencyP95Ms: BudgetThreshold<number>;
    readonly averageBytesPerEvent: BudgetThreshold<number>;
    readonly eventLoopLagP95Ms: BudgetThreshold<number>;
    readonly memoryRssBytes: BudgetThreshold<number>;
  };

  // 8. Capacity Controller & Hysteresis Transitions
  readonly capacityController: {
    readonly highCpuPercent: BudgetThreshold<number>;
    readonly lowCpuPercent: BudgetThreshold<number>;
    readonly highHeapPercent: BudgetThreshold<number>;
    readonly lowHeapPercent: BudgetThreshold<number>;
    readonly highEventLoopLagMs: BudgetThreshold<number>;
    readonly lowEventLoopLagMs: BudgetThreshold<number>;
    readonly highRssBytes: BudgetThreshold<number>;
    readonly lowRssBytes: BudgetThreshold<number>;
    readonly cooldownPeriodMs: BudgetThreshold<number>;
    readonly recoveryProbeBudget: BudgetThreshold<number>;
    readonly reconnectJitterMaxMs: BudgetThreshold<number>;
  };
}

/**
 * Metadata dictionary documenting units, config sources, and baseline rationales.
 */
export const BUDGET_METADATA: Record<string, BudgetMetadataEntry> = {
  "admission.maxActivePvPMatches": {
    unit: "matches",
    source: "env:MAX_PVP_MATCHES || 50",
    rationale: "Bounded match concurrency preventing memory saturation under sustained gameplay",
  },
  "admission.maxActivePythonMatches": {
    unit: "matches",
    source: "const: 1",
    rationale: "Authoritative security isolation gate: Python Online strictly 1 active match per host",
  },
  "admission.maxConcurrentStreams": {
    unit: "connections",
    source: "env:MAX_SSE_STREAMS || 200",
    rationale: "Limits concurrent SSE socket file descriptors on free-tier container",
  },
  "admission.maxConcurrentLobby": {
    unit: "operations",
    source: "const: 100",
    rationale: "Prevents lobby storm from exhausting server event loop during peak discovery",
  },
  "admission.perPrincipalStreamQuota": {
    unit: "streams/principal",
    source: "const: 5",
    rationale: "Allows multiple tabs (desktop + mobile) while stopping socket flooding attacks",
  },
  "admission.perPrincipalRoomQuota": {
    unit: "rooms/principal",
    source: "const: 2",
    rationale: "Prevents a single malicious actor from monopolizing room namespaces",
  },
  "admission.perPrincipalQueueQuota": {
    unit: "queues/principal",
    source: "const: 1",
    rationale: "Strict invariant: a user can only be in one matchmaking queue at any moment",
  },
  "matchLanes.maxQueueDepthPerMatch": {
    unit: "commands",
    source: "const: 50",
    rationale: "Lane backpressure limit before rejecting commands to avoid unbounded memory queue",
  },
  "matchLanes.maxQueueAgeMs": {
    unit: "milliseconds",
    source: "const: 5000",
    rationale: "Stale command drop deadline to guarantee bounded command age",
  },
  "matchLanes.casCommitTimeoutMs": {
    unit: "milliseconds",
    source: "const: 1000",
    rationale: "Optimistic concurrency lock timeout ensuring human move ACK p99 <= 1000ms",
  },
  "matchLanes.dbConnectionPoolSize": {
    unit: "connections",
    source: "const: 10",
    rationale: "Database client pool limit to prevent PostgreSQL connection starvation",
  },
  "matchLanes.commandRetryWindowMs": {
    unit: "milliseconds",
    source: "const: 30000",
    rationale: "Window for deduplicating retried commands in memory",
  },
  "matchLanes.unresolvedLedgerRetentionMs": {
    unit: "milliseconds",
    source: "const: 300000",
    rationale: "Retention duration for unresolved command ledger entries before tombstoning",
  },
  "sse.maxEventsPerBuffer": {
    unit: "events",
    source: "const: 100",
    rationale: "Circulating buffer limit for SSE backlog replay cursor",
  },
  "sse.streamDrainDeadlineMs": {
    unit: "milliseconds",
    source: "const: 5000",
    rationale: "Deadline for socket write drain before dropping slow stream",
  },
  "sse.heartbeatIntervalMs": {
    unit: "milliseconds",
    source: "const: 15000",
    rationale: "Keep-alive ping interval to keep intermediate HTTP proxies from closing idle streams",
  },
  "sse.backlogRetentionWindowMs": {
    unit: "milliseconds",
    source: "const: 60000",
    rationale: "Event backlog buffer window for reconnecting SSE subscribers",
  },
  "sse.slowReaderDropTimeoutMs": {
    unit: "milliseconds",
    source: "const: 10000",
    rationale: "Maximum duration a subscriber can stall buffer drain before disconnection",
  },
  "retryAndLeases.backoffBaseMs": {
    unit: "milliseconds",
    source: "const: 100",
    rationale: "Initial backoff base delay for exponential retry loops",
  },
  "retryAndLeases.backoffCapMs": {
    unit: "milliseconds",
    source: "const: 5000",
    rationale: "Upper bound cap on exponential backoff delays",
  },
  "retryAndLeases.backoffJitterRatio": {
    unit: "ratio",
    source: "const: 0.2",
    rationale: "Full jitter randomization ratio to prevent synchronized retry spikes",
  },
  "retryAndLeases.maxRetryAttempts": {
    unit: "attempts",
    source: "const: 3",
    rationale: "Maximum retry attempts before failing with permanent recoverable error",
  },
  "retryAndLeases.queueLeaseTimeoutMs": {
    unit: "milliseconds",
    source: "const: 10000",
    rationale: "Timeout for acquiring matchmaking queue lock before expiration",
  },
  "retryAndLeases.reservationTimeoutMs": {
    unit: "milliseconds",
    source: "const: 60000",
    rationale: "Match reservation slot expiration if participant fails to join",
  },
  "retryAndLeases.recoveryDeadlineMs": {
    unit: "milliseconds",
    source: "const: 30000",
    rationale: "Maximum time allowed for match restart state rehydration",
  },
  "payloadAndQuery.maxHttpBodyBytes": {
    unit: "bytes",
    source: "const: 65536",
    rationale: "Maximum request body size (64KB) protecting against memory exhaustion attacks",
  },
  "payloadAndQuery.maxBotSourceBytes": {
    unit: "bytes",
    source: "const: 65536",
    rationale: "Strict limit (64KB) on uploaded Python bot source files",
  },
  "payloadAndQuery.maxEventBytes": {
    unit: "bytes",
    source: "const: 4096",
    rationale: "Envelope size ceiling for broadcast events",
  },
  "payloadAndQuery.maxHistoryPageLimit": {
    unit: "records",
    source: "const: 50",
    rationale: "Pagination bound for match history queries",
  },
  "payloadAndQuery.maxReplayPageLimit": {
    unit: "records",
    source: "const: 100",
    rationale: "Pagination bound for move log replay sequences",
  },
  "latencySlo.humanMoveAckP95Ms": {
    unit: "milliseconds",
    source: "slo: 300",
    rationale: "Target p95 latency SLO for player move acknowledgment",
  },
  "latencySlo.humanMoveAckP99Ms": {
    unit: "milliseconds",
    source: "slo: 1000",
    rationale: "Hard ceiling p99 latency SLO for player move acknowledgment",
  },
  "latencySlo.matchRecoveryP95Ms": {
    unit: "milliseconds",
    source: "slo: 1000",
    rationale: "Maximum cold-start recovery p95 latency upon worker failover",
  },
  "capacityController.highCpuPercent": {
    unit: "percentage",
    source: "const: UNMEASURED",
    rationale: "Unmeasured threshold tagged until cluster profiling is performed",
  },
  "capacityController.lowCpuPercent": {
    unit: "percentage",
    source: "const: UNMEASURED",
    rationale: "Unmeasured threshold tagged until cluster profiling is performed",
  },
  "capacityController.highHeapPercent": {
    unit: "percentage",
    source: "const: 85",
    rationale: "Threshold triggering load shedding in PRESSURE state before OOM crashes",
  },
  "capacityController.lowHeapPercent": {
    unit: "percentage",
    source: "const: 70",
    rationale: "Hysteresis lower bound preventing oscillation between NORMAL and PRESSURE",
  },
  "capacityController.highEventLoopLagMs": {
    unit: "milliseconds",
    source: "const: 50",
    rationale: "Event loop responsiveness gate triggering load shedding",
  },
  "capacityController.lowEventLoopLagMs": {
    unit: "milliseconds",
    source: "const: 20",
    rationale: "Recovery baseline requirement before transitioning out of PRESSURE",
  },
  "capacityController.highRssBytes": {
    unit: "bytes",
    source: "const: 1073741824",
    rationale: "1 GB memory cap for node container before shedding non-essential load",
  },
  "capacityController.lowRssBytes": {
    unit: "bytes",
    source: "const: 838860800",
    rationale: "800 MB hysteresis lower bound before admitting non-essential traffic",
  },
  "capacityController.cooldownPeriodMs": {
    unit: "milliseconds",
    source: "const: 5000",
    rationale: "Mandatory stability duration in RECOVERY state before returning to NORMAL",
  },
  "capacityController.recoveryProbeBudget": {
    unit: "probes",
    source: "const: 5",
    rationale: "Number of consecutive successful probe requests required to confirm healthy recovery",
  },
  "capacityController.reconnectJitterMaxMs": {
    unit: "milliseconds",
    source: "const: 3000",
    rationale: "Maximum random delay added to Retry-After to diffuse thundering herd reconnects",
  },
};

/**
 * Default Budget Profile v0 for initial development and capacity integration.
 */
export const DEFAULT_BUDGET_PROFILE_V0: BudgetProfile = {
  version: "v0",
  name: "baseline-development-v0",
  description: "Initial budget profile with verified free-only limits and empirical baseline values",
  environment: "local-linux-8cpu-12gb",

  admission: {
    maxActivePvPMatches: 50,
    maxActivePythonMatches: 1, // Authoritative gate: Online Python initially 1 active match
    maxConcurrentStreams: 200,
    maxConcurrentLobby: 100,
    perPrincipalStreamQuota: 5,
    perPrincipalRoomQuota: 2,
    perPrincipalQueueQuota: 1,
  },

  matchLanes: {
    maxQueueDepthPerMatch: 50,
    maxQueueAgeMs: 5_000,
    casCommitTimeoutMs: 1_000,
    dbConnectionPoolSize: 10,
    commandRetryWindowMs: 30_000,
    unresolvedLedgerRetentionMs: 300_000, // 5 minutes before tombstone
  },

  sse: {
    maxEventsPerBuffer: 100,
    streamDrainDeadlineMs: 5_000,
    heartbeatIntervalMs: 15_000,
    backlogRetentionWindowMs: 60_000,
    slowReaderDropTimeoutMs: 10_000,
  },

  retryAndLeases: {
    backoffBaseMs: 100,
    backoffCapMs: 5_000,
    backoffJitterRatio: 0.2,
    maxRetryAttempts: 3,
    queueLeaseTimeoutMs: 10_000,
    reservationTimeoutMs: 60_000,
    recoveryDeadlineMs: 30_000,
  },

  payloadAndQuery: {
    maxHttpBodyBytes: 65_536,
    maxBotSourceBytes: 65_536,
    maxEventBytes: 4_096,
    maxHistoryPageLimit: 50,
    maxReplayPageLimit: 100,
  },

  latencySlo: {
    humanMoveAckP95Ms: 300,
    humanMoveAckP99Ms: 1_000,
    matchRecoveryP95Ms: 1_000,
  },

  measuredBaseline: {
    generatorCoLocated: true, // Co-located single-host generator (8 CPU / 11.6 GB RAM)
    httpHealthP50Ms: 1.48,
    httpHealthP95Ms: 3.20,
    httpHealthP99Ms: 4.79,
    sseConnectLatencyP95Ms: 0.5,
    averageBytesPerEvent: 311.1,
    eventLoopLagP95Ms: 8.39,
    memoryRssBytes: 161_180_000,
  },

  capacityController: {
    highCpuPercent: "UNMEASURED",
    lowCpuPercent: "UNMEASURED",
    highHeapPercent: 85,
    lowHeapPercent: 70,
    highEventLoopLagMs: 50,
    lowEventLoopLagMs: 20,
    highRssBytes: 1_073_741_824, // 1 GB
    lowRssBytes: 838_860_800, // 800 MB
    cooldownPeriodMs: 5_000,
    recoveryProbeBudget: 5,
    reconnectJitterMaxMs: 3_000,
  },
};

export function resolveBudgetNumber(threshold: BudgetThreshold<number>, fallback: number): number {
  return typeof threshold === "number" && !Number.isNaN(threshold) ? threshold : fallback;
}
