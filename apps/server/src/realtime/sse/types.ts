import type { EventScope, DomainEventEnvelope } from "@ottv2/contracts";

export type SseMessage = {
  id?: string | undefined;
  event?: string | undefined;
  data: unknown;
  retry?: number | undefined;
};

export type SseClientOptions = {
  /** Maximum number of buffered messages before marking as slow reader. Default: 64. */
  maxBufferSize?: number | undefined;
  /** Maximum bytes in queue before marking as slow reader. Default: 64 KB (65,536 bytes). */
  maxBufferBytes?: number | undefined;
  /** Maximum age of a message in buffer in ms before overflow. Default: 15,000 ms. */
  maxBufferAgeMs?: number | undefined;
  /** Heartbeat interval in ms. Default: 15,000 ms (0 disables). */
  heartbeatIntervalMs?: number | undefined;
  /** Optional role group tag (e.g. "SPECTATOR", "PLAYER_BLUE") for serialize-once optimization. */
  roleGroup?: string | undefined;
  /** Optional session ID for targeted session revocation (SYNC-07). */
  sessionId?: string | undefined;
  /** Optional principal ID for targeted principal revocation (SYNC-07). */
  principal?: string | undefined;
};

export type SseChannelOptions = {
  scope: EventScope;
  targetId: string;
  generation: string;
  ringBufferSize?: number | undefined;
};

export type PulseMessage = {
  anchorMs: number;
  clocksMs: Record<string, number>;
  serverTime: number;
};

export type SubscribeResult = {
  replayed: number;
  fullSyncNeeded: boolean;
};
