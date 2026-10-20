import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  formatEventCursor,
  parseEventCursor,
  type DomainEventEnvelope,
  type EventScope,
} from "@ottv2/contracts";

import type { SseClient } from "./sse-client.js";
import type { PulseMessage, SseChannelOptions, SubscribeResult } from "./types.js";

type RingBufferItem = {
  sequence: number;
  cursor: string;
  envelope: DomainEventEnvelope;
};

const DEFAULT_RING_BUFFER_SIZE = 50;

export class SseChannel extends EventEmitter {
  public readonly scope: EventScope;
  public readonly targetId: string;
  public readonly generation: string;
  private readonly ringBufferSize: number;
  private currentSequence = 0;
  private readonly subscribers = new Set<SseClient>();
  private readonly recentEvents: RingBufferItem[] = [];
  public isClosed = false;

  constructor(options: SseChannelOptions) {
    super();
    this.scope = options.scope;
    this.targetId = options.targetId;
    this.generation = options.generation;
    this.ringBufferSize = options.ringBufferSize ?? DEFAULT_RING_BUFFER_SIZE;
  }

  get sequence(): number {
    return this.currentSequence;
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }

  publish(type: string, payload: unknown, stateVersion: number): DomainEventEnvelope {
    this.currentSequence += 1;
    const cursor = formatEventCursor(this.scope, this.generation, this.currentSequence);

    const envelope: DomainEventEnvelope = {
      protocolVersion: "0.2",
      messageId: randomUUID(),
      type,
      timestamp: Date.now(),
      scope: this.scope,
      targetId: this.targetId,
      sequence: this.currentSequence,
      stateVersion,
      payload,
    };

    this.recentEvents.push({ sequence: this.currentSequence, cursor, envelope });
    if (this.recentEvents.length > this.ringBufferSize) {
      this.recentEvents.shift();
    }

    // Domain fan-out with serialize-once per roleGroup (SYNC-05)
    const serializedByRole = new Map<string, string>();

    for (const client of this.subscribers) {
      if (client.isClosed) continue;

      let serialized: string | undefined;
      if (client.roleGroup) {
        serialized = serializedByRole.get(client.roleGroup);
        if (!serialized) {
          serialized = JSON.stringify(envelope);
          serializedByRole.set(client.roleGroup, serialized);
        }
      } else {
        serialized = JSON.stringify(envelope);
      }

      // Listener isolation (SYNC-05)
      try {
        client.send({ id: cursor, event: type, data: envelope }, serialized);
      } catch (err) {
        this.emit("clientError", err, client);
      }
    }

    return envelope;
  }

  publishPulse(pulse: PulseMessage): void {
    if (this.isClosed) return;
    // Clock pulse: small anchor, does NOT increment sequence or touch recentEvents ring buffer
    const serialized = JSON.stringify(pulse);
    for (const client of this.subscribers) {
      if (client.isClosed) continue;
      try {
        client.send({ event: "pulse", data: pulse }, serialized);
      } catch (err) {
        this.emit("clientError", err, client);
      }
    }
  }

  subscribe(
    client: SseClient,
    lastEventId?: string,
    getInitialSnapshot?: () => unknown
  ): SubscribeResult {
    this.subscribers.add(client);

    const onClose = () => {
      this.subscribers.delete(client);
    };
    client.once("close", onClose);

    let fullSyncNeeded = false;
    let replayed = 0;

    if (lastEventId) {
      const parsed = parseEventCursor(lastEventId);
      if (
        parsed &&
        parsed.scope === this.scope &&
        parsed.targetGeneration === this.generation
      ) {
        if (parsed.sequence === this.currentSequence) {
          // Up to date
          return { replayed: 0, fullSyncNeeded: false };
        } else if (parsed.sequence < this.currentSequence) {
          const oldest = this.recentEvents[0]?.sequence;
          if (oldest !== undefined && parsed.sequence >= oldest - 1) {
            // Replay from ring buffer
            const missed = this.recentEvents.filter((item) => item.sequence > parsed.sequence);
            for (const item of missed) {
              client.send({ id: item.cursor, event: item.envelope.type, data: item.envelope });
            }
            return { replayed: missed.length, fullSyncNeeded: false };
          } else {
            // Cursor is older than ring buffer: gap detected!
            fullSyncNeeded = true;
          }
        } else {
          fullSyncNeeded = true;
        }
      } else {
        fullSyncNeeded = true;
      }
    } else {
      fullSyncNeeded = true;
    }

    if (fullSyncNeeded && getInitialSnapshot) {
      const snapshot = getInitialSnapshot();
      const cursor = formatEventCursor(this.scope, this.generation, this.currentSequence);
      client.send({ id: cursor, event: "sync", data: snapshot });
    }

    return { replayed, fullSyncNeeded };
  }

  unsubscribe(client: SseClient): void {
    this.subscribers.delete(client);
  }

  revokeSession(sessionId: string, reason = "SESSION_REVOKED"): number {
    let count = 0;
    const toRevoke: SseClient[] = [];
    for (const client of this.subscribers) {
      if (client.sessionId === sessionId) {
        toRevoke.push(client);
      }
    }
    for (const client of toRevoke) {
      this.subscribers.delete(client);
      try {
        client.send({ event: "revoked", data: { type: "REVOKED", reason } });
      } catch {}
      client.close();
      count += 1;
    }
    return count;
  }

  revokePrincipal(principal: string, reason = "PRINCIPAL_REVOKED"): number {
    let count = 0;
    const toRevoke: SseClient[] = [];
    for (const client of this.subscribers) {
      if (client.principal === principal) {
        toRevoke.push(client);
      }
    }
    for (const client of toRevoke) {
      this.subscribers.delete(client);
      try {
        client.send({ event: "revoked", data: { type: "REVOKED", reason } });
      } catch {}
      client.close();
      count += 1;
    }
    return count;
  }

  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;

    for (const client of this.subscribers) {
      client.close();
    }
    this.subscribers.clear();
    this.recentEvents.length = 0;
    this.emit("close");
  }
}
