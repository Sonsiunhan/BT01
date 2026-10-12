import type { EventScope } from "@ottv2/contracts";

import { env } from "../../config/env";
import { NetworkStore, type NetworkConnectionState } from "./networkStore";

export type SubscriptionLease = {
  release: () => void;
  networkStore: NetworkStore;
};

export type SubscriptionOptions = {
  onEvent?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onStateChange?: (state: NetworkConnectionState) => void;
  initialCursor?: string;
};

type ConnectionRecord = {
  key: string;
  scope: EventScope;
  targetId: string;
  path: string;
  consumers: number;
  isRevoked: boolean;
  eventSource?: EventSource | undefined;
  teardownTimer?: ReturnType<typeof setTimeout> | undefined;
  reconnectTimer?: ReturnType<typeof setTimeout> | undefined;
  networkStore: NetworkStore;
  listeners: Set<(event: MessageEvent) => void>;
  errorListeners: Set<(event: Event) => void>;
  backoffMs: number;
  lastEventId?: string | undefined;
};

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 10_000;
const BACKOFF_MULTIPLIER = 1.5;
const DEFAULT_TEARDOWN_GRACE_MS = 50;

export class SubscriptionManager {
  private readonly connections = new Map<string, ConnectionRecord>();
  private readonly cacheClearHandlers = new Set<() => void>();
  private readonly teardownGraceMs: number;

  constructor(options: { teardownGraceMs?: number } = {}) {
    this.teardownGraceMs = options.teardownGraceMs ?? DEFAULT_TEARDOWN_GRACE_MS;

    if (typeof window !== "undefined") {
      window.addEventListener("ottv2:session-expired", () => {
        this.revokeAll("SESSION_EXPIRED");
      });
    }
  }

  get activeConnectionCount(): number {
    return this.connections.size;
  }

  getConsumerCount(scope: EventScope, targetId: string): number {
    return this.connections.get(this.keyOf(scope, targetId))?.consumers ?? 0;
  }

  private keyOf(scope: EventScope, targetId: string): string {
    return `${scope}:${targetId}`;
  }

  onClearCache(handler: () => void): () => void {
    this.cacheClearHandlers.add(handler);
    return () => {
      this.cacheClearHandlers.delete(handler);
    };
  }

  clearPrivateCache(): void {
    for (const handler of this.cacheClearHandlers) {
      try {
        handler();
      } catch {}
    }
  }

  acquire(
    scope: EventScope,
    targetId: string,
    path: string,
    options: SubscriptionOptions = {}
  ): SubscriptionLease {
    const key = this.keyOf(scope, targetId);
    let record = this.connections.get(key);

    if (record) {
      if (record.teardownTimer !== undefined) {
        clearTimeout(record.teardownTimer);
        record.teardownTimer = undefined;
      }
      record.consumers += 1;
    } else {
      record = {
        key,
        scope,
        targetId,
        path,
        consumers: 1,
        isRevoked: false,
        networkStore: new NetworkStore("CONNECTING"),
        listeners: new Set(),
        errorListeners: new Set(),
        backoffMs: INITIAL_BACKOFF_MS,
        lastEventId: options.initialCursor,
      };
      this.connections.set(key, record);
      this.connect(record);
    }

    if (options.onEvent) record.listeners.add(options.onEvent);
    if (options.onError) record.errorListeners.add(options.onError);
    const unsubscribeState = options.onStateChange
      ? record.networkStore.subscribe(options.onStateChange)
      : undefined;

    let released = false;
    return {
      networkStore: record.networkStore,
      release: () => {
        if (released) return;
        released = true;
        if (options.onEvent) record?.listeners.delete(options.onEvent);
        if (options.onError) record?.errorListeners.delete(options.onError);
        unsubscribeState?.();

        if (!record) return;
        record.consumers -= 1;
        if (record.consumers <= 0) {
          record.teardownTimer = setTimeout(() => {
            if (record && record.consumers <= 0) {
              this.teardown(record);
            }
          }, this.teardownGraceMs);
        }
      },
    };
  }

  private connect(record: ConnectionRecord): void {
    if (typeof EventSource === "undefined" || record.isRevoked) return;

    record.networkStore.setState(
      record.eventSource ? "RECONNECTING" : "CONNECTING"
    );

    const url = record.path.startsWith("http")
      ? record.path
      : `${env.apiBaseUrl}${record.path}`;

    try {
      const es = new EventSource(url, { withCredentials: true });
      record.eventSource = es;

      es.onopen = () => {
        if (record.isRevoked) {
          es.close();
          return;
        }
        record.backoffMs = INITIAL_BACKOFF_MS;
        record.networkStore.setState("SYNCED");
      };

      es.onmessage = (event) => {
        if (event.lastEventId) {
          record.lastEventId = event.lastEventId;
        }
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.type === "REVOKED") {
            this.handleRevocation(record, parsed?.reason ?? "SESSION_REVOKED");
            return;
          }
        } catch {}

        for (const listener of record.listeners) {
          try {
            listener(event);
          } catch {}
        }
      };

      es.addEventListener("revoked", (event: MessageEvent) => {
        let reason = "SESSION_REVOKED";
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.reason) reason = parsed.reason;
        } catch {}
        this.handleRevocation(record, reason);
      });

      es.onerror = (event) => {
        if (record.isRevoked) return;
        for (const listener of record.errorListeners) {
          try {
            listener(event);
          } catch {}
        }
        this.scheduleReconnect(record);
      };
    } catch {
      if (!record.isRevoked) {
        this.scheduleReconnect(record);
      }
    }
  }

  private handleRevocation(record: ConnectionRecord, reason = "SESSION_REVOKED"): void {
    record.isRevoked = true;
    if (record.reconnectTimer !== undefined) {
      clearTimeout(record.reconnectTimer);
      record.reconnectTimer = undefined;
    }
    if (record.eventSource) {
      record.eventSource.close();
      record.eventSource = undefined;
    }

    const nextState = reason === "ROLE_REVOKED" ? "READ_ONLY" : "FATAL";
    record.networkStore.setState(nextState, reason);
    this.clearPrivateCache();

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ottv2:session-revoked", {
          detail: { reason, scope: record.scope, targetId: record.targetId },
        })
      );
    }
  }

  revoke(scope: EventScope, targetId: string, reason = "SESSION_REVOKED"): void {
    const key = this.keyOf(scope, targetId);
    const record = this.connections.get(key);
    if (record) {
      this.handleRevocation(record, reason);
    }
  }

  revokeAll(reason = "SESSION_REVOKED"): void {
    for (const record of this.connections.values()) {
      this.handleRevocation(record, reason);
    }
  }

  private scheduleReconnect(record: ConnectionRecord): void {
    if (record.consumers <= 0 || record.isRevoked) return;
    if (record.reconnectTimer !== undefined) return;

    record.networkStore.setState("RECONNECTING");
    if (record.eventSource) {
      record.eventSource.close();
      record.eventSource = undefined;
    }

    // Exponential backoff with jitter (+/- 20%)
    const jitter = (Math.random() - 0.5) * 0.4 * record.backoffMs;
    const delay = Math.round(
      Math.min(MAX_BACKOFF_MS, record.backoffMs + jitter)
    );
    record.backoffMs = Math.min(
      MAX_BACKOFF_MS,
      record.backoffMs * BACKOFF_MULTIPLIER
    );

    record.reconnectTimer = setTimeout(() => {
      record.reconnectTimer = undefined;
      if (record.consumers > 0 && !record.isRevoked) {
        this.connect(record);
      }
    }, delay);
  }

  private teardown(record: ConnectionRecord): void {
    if (record.teardownTimer !== undefined) {
      clearTimeout(record.teardownTimer);
      record.teardownTimer = undefined;
    }
    if (record.reconnectTimer !== undefined) {
      clearTimeout(record.reconnectTimer);
      record.reconnectTimer = undefined;
    }
    if (record.eventSource) {
      record.eventSource.close();
      record.eventSource = undefined;
    }
    record.listeners.clear();
    record.errorListeners.clear();
    record.networkStore.clear();
    this.connections.delete(record.key);
  }

  closeAll(): void {
    for (const record of this.connections.values()) {
      this.teardown(record);
    }
    this.connections.clear();
  }
}

let defaultManager: SubscriptionManager | null = null;

export function getSubscriptionManager(): SubscriptionManager {
  if (!defaultManager) {
    defaultManager = new SubscriptionManager();
  }
  return defaultManager;
}

