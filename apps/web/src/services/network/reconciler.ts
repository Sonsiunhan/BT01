import type { DomainEventEnvelope, EventScope } from "@ottv2/contracts";

export type PulseMessage = {
  anchorMs: number;
  clocksMs: Record<string, number>;
  serverTime: number;
};

export type DomainReconcilerState<T> = {
  scope: EventScope;
  targetId: string;
  generation: string;
  data: T;
  watermarkSequence: number;
  stateVersion: number;
  gapDetected: boolean;
  lastPulse?: PulseMessage;
};

export type ReconcileAction = "APPLIED" | "IGNORED_DUPLICATE" | "GAP_DETECTED" | "IGNORED_STALE_ACK";

export type ReconcileResult<T> = {
  state: DomainReconcilerState<T>;
  action: ReconcileAction;
};

export function createReconciler<T>(
  scope: EventScope,
  targetId: string,
  generation: string,
  initialData: T,
  watermarkSequence = 0,
  stateVersion = 0
): DomainReconcilerState<T> {
  return {
    scope,
    targetId,
    generation,
    data: initialData,
    watermarkSequence,
    stateVersion,
    gapDetected: false,
  };
}

export function reconcileDomainEvent<T>(
  current: DomainReconcilerState<T>,
  event: DomainEventEnvelope,
  reducer: (prev: T, payload: unknown, type: string) => T
): ReconcileResult<T> {
  // Duplicate / stale: event.sequence <= watermarkSequence
  if (event.sequence <= current.watermarkSequence) {
    return { state: current, action: "IGNORED_DUPLICATE" };
  }

  // Gap detected: sequence > watermarkSequence + 1
  if (event.sequence > current.watermarkSequence + 1) {
    return {
      state: { ...current, gapDetected: true },
      action: "GAP_DETECTED",
    };
  }

  // In-order event: sequence === watermarkSequence + 1
  const nextData = reducer(current.data, event.payload, event.type);
  return {
    state: {
      ...current,
      data: nextData,
      watermarkSequence: event.sequence,
      stateVersion: Math.max(current.stateVersion, event.stateVersion),
      gapDetected: false,
    },
    action: "APPLIED",
  };
}

export function reconcilePulse<T>(
  current: DomainReconcilerState<T>,
  pulse: PulseMessage
): DomainReconcilerState<T> {
  return {
    ...current,
    lastPulse: pulse,
  };
}

export function reconcileSnapshot<T>(
  current: DomainReconcilerState<T>,
  data: T,
  watermarkSequence: number,
  stateVersion: number
): DomainReconcilerState<T> {
  return {
    ...current,
    data,
    watermarkSequence,
    stateVersion,
    gapDetected: false,
  };
}

export function reconcileStaleAck<T>(
  current: DomainReconcilerState<T>,
  ackStateVersion: number,
  updater: () => T
): ReconcileResult<T> {
  if (ackStateVersion < current.stateVersion) {
    return { state: current, action: "IGNORED_STALE_ACK" };
  }
  return {
    state: {
      ...current,
      data: updater(),
      stateVersion: ackStateVersion,
    },
    action: "APPLIED",
  };
}
