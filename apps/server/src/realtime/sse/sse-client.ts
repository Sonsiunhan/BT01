import { EventEmitter } from "node:events";
import type { Writable } from "node:stream";

import type { SseClientOptions, SseMessage } from "./types.js";

type BufferedItem = {
  chunk: string;
  bytes: number;
  enqueuedAt: number;
};

const DEFAULT_MAX_BUFFER_SIZE = 64;
const DEFAULT_MAX_BUFFER_BYTES = 64 * 1024; // 64 KB
const DEFAULT_MAX_BUFFER_AGE_MS = 15_000;
const DEFAULT_HEARTBEAT_MS = 15_000;

export class SseClient extends EventEmitter {
  private readonly options: {
    maxBufferSize: number;
    maxBufferBytes: number;
    maxBufferAgeMs: number;
    heartbeatIntervalMs: number;
    roleGroup?: string | undefined;
    sessionId?: string | undefined;
    principal?: string | undefined;
  };
  private buffer: BufferedItem[] = [];
  private bufferBytes = 0;
  private isDraining = false;
  private heartbeatTimer?: NodeJS.Timeout | undefined;
  public isClosed = false;

  private readonly onStreamDrain = () => this.handleDrain();
  private readonly onStreamClose = () => this.close();
  private readonly onStreamError = (_err: Error) => this.close();

  constructor(private readonly stream: Writable, options: SseClientOptions = {}) {
    super();
    this.options = {
      maxBufferSize: options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE,
      maxBufferBytes: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES,
      maxBufferAgeMs: options.maxBufferAgeMs ?? DEFAULT_MAX_BUFFER_AGE_MS,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS,
      roleGroup: options.roleGroup,
      sessionId: options.sessionId,
      principal: options.principal,
    };

    this.stream.on("drain", this.onStreamDrain);
    this.stream.on("close", this.onStreamClose);
    this.stream.on("error", this.onStreamError);

    if (this.options.heartbeatIntervalMs > 0) {
      this.heartbeatTimer = setInterval(() => {
        if (!this.isClosed) this.sendComment("ping");
      }, this.options.heartbeatIntervalMs);
      this.heartbeatTimer.unref();
    }
  }

  get bufferedCount(): number {
    return this.buffer.length;
  }

  get bufferedBytes(): number {
    return this.bufferBytes;
  }

  get roleGroup(): string | undefined {
    return this.options.roleGroup;
  }

  get sessionId(): string | undefined {
    return this.options.sessionId;
  }

  get principal(): string | undefined {
    return this.options.principal;
  }

  send(message: SseMessage, serializedData?: string): boolean {
    if (this.isClosed) return false;

    let chunk = "";
    if (message.id !== undefined) chunk += `id: ${message.id}\n`;
    if (message.event !== undefined) chunk += `event: ${message.event}\n`;
    if (message.retry !== undefined) chunk += `retry: ${message.retry}\n`;
    chunk += `data: ${serializedData ?? JSON.stringify(message.data)}\n\n`;

    const bytes = Buffer.byteLength(chunk, "utf8");

    // If already waiting for drain or having buffered items, queue immediately
    if (this.isDraining || this.buffer.length > 0) {
      return this.enqueue(chunk, bytes);
    }

    try {
      const ok = this.stream.write(chunk);
      if (!ok) {
        this.isDraining = true;
      }
      return ok;
    } catch {
      this.close();
      return false;
    }
  }

  sendComment(comment: string): boolean {
    if (this.isClosed) return false;
    try {
      return this.stream.write(`: ${comment}\n\n`);
    } catch {
      this.close();
      return false;
    }
  }

  private enqueue(chunk: string, bytes: number): boolean {
    if (
      this.buffer.length >= this.options.maxBufferSize ||
      this.bufferBytes + bytes > this.options.maxBufferBytes
    ) {
      this.handleOverflow("BUFFER_OVERFLOW");
      return false;
    }

    this.buffer.push({ chunk, bytes, enqueuedAt: Date.now() });
    this.bufferBytes += bytes;
    return false;
  }

  private handleDrain(): void {
    if (this.isClosed) return;

    const now = Date.now();
    while (this.buffer.length > 0) {
      const item = this.buffer[0];
      if (!item) break;

      if (now - item.enqueuedAt > this.options.maxBufferAgeMs) {
        this.handleOverflow("BUFFER_AGE_EXCEEDED");
        return;
      }

      try {
        const ok = this.stream.write(item.chunk);
        this.buffer.shift();
        this.bufferBytes -= item.bytes;
        if (!ok) {
          // Socket write buffer full again; wait for next drain
          this.isDraining = true;
          return;
        }
      } catch {
        this.close();
        return;
      }
    }

    this.isDraining = false;
    this.emit("drain");
  }

  private handleOverflow(reason: string): void {
    if (this.isClosed) return;
    this.emit("overflow", reason);
    try {
      this.stream.write(
        `event: error\ndata: ${JSON.stringify({ error: "SLOW_READER_DISCONNECT", reason })}\n\n`
      );
    } catch {}
    this.close();
  }

  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;

    if (this.heartbeatTimer !== undefined) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    this.buffer = [];
    this.bufferBytes = 0;
    this.isDraining = false;

    this.stream.off("drain", this.onStreamDrain);
    this.stream.off("close", this.onStreamClose);
    this.stream.off("error", this.onStreamError);

    try {
      if (!this.stream.destroyed && !(this.stream as any).writableEnded) {
        this.stream.end();
      }
    } catch {}

    this.emit("close");
  }
}
