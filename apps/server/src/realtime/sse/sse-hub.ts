import type { EventScope } from "@ottv2/contracts";

import { SseChannel } from "./sse-channel.js";
import type { SseChannelOptions } from "./types.js";

export class SseHub {
  private readonly channels = new Map<string, SseChannel>();

  private keyOf(scope: EventScope, targetId: string): string {
    return `${scope}:${targetId}`;
  }

  getOrCreateChannel(
    scope: EventScope,
    targetId: string,
    generation: string,
    options?: Partial<Omit<SseChannelOptions, "scope" | "targetId" | "generation">>
  ): SseChannel {
    const key = this.keyOf(scope, targetId);
    let channel = this.channels.get(key);

    // If channel exists but generation changed, close and replace old channel
    if (channel && channel.generation !== generation) {
      channel.close();
      this.channels.delete(key);
      channel = undefined;
    }

    if (!channel) {
      channel = new SseChannel({
        scope,
        targetId,
        generation,
        ...(options?.ringBufferSize !== undefined ? { ringBufferSize: options.ringBufferSize } : {}),
      });

      channel.once("close", () => {
        if (this.channels.get(key) === channel) {
          this.channels.delete(key);
        }
      });

      this.channels.set(key, channel);
    }

    return channel;
  }

  getChannel(scope: EventScope, targetId: string): SseChannel | undefined {
    return this.channels.get(this.keyOf(scope, targetId));
  }

  removeChannel(scope: EventScope, targetId: string): void {
    const key = this.keyOf(scope, targetId);
    const channel = this.channels.get(key);
    if (channel) {
      channel.close();
      this.channels.delete(key);
    }
  }

  revokeSession(sessionId: string, reason?: string): number {
    let total = 0;
    for (const channel of this.channels.values()) {
      total += channel.revokeSession(sessionId, reason);
    }
    return total;
  }

  revokePrincipal(principal: string, reason?: string): number {
    let total = 0;
    for (const channel of this.channels.values()) {
      total += channel.revokePrincipal(principal, reason);
    }
    return total;
  }

  metrics(): {
    activeChannels: number;
    activeClients: number;
  } {
    let activeClients = 0;
    for (const channel of this.channels.values()) {
      activeClients += channel.subscriberCount;
    }
    return {
      activeChannels: this.channels.size,
      activeClients,
    };
  }

  close(): void {
    for (const channel of this.channels.values()) {
      channel.close();
    }
    this.channels.clear();
  }
}
