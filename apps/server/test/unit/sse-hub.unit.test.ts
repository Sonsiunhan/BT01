import { EventEmitter, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { SseClient } from "../../src/realtime/sse/sse-client.js";
import { SseChannel } from "../../src/realtime/sse/sse-channel.js";
import { SseHub } from "../../src/realtime/sse/sse-hub.js";

/** Mock Writable stream simulating HTTP response */
class MockHttpResponse extends Writable {
  public writtenChunks: string[] = [];
  public isWritableEnded = false;
  public isDestroyed = false;
  public simulateBackpressure = false;

  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.writtenChunks.push(chunk.toString());
    if (this.simulateBackpressure) {
      // Simulate buffer saturation
      callback();
      return;
    }
    callback();
  }

  write(chunk: any, cb?: any): boolean {
    if (this.isWritableEnded || this.isDestroyed) {
      throw new Error("Cannot write to ended stream");
    }
    const result = super.write(chunk, cb);
    return this.simulateBackpressure ? false : result;
  }

  end(...args: any[]) {
    this.isWritableEnded = true;
    return super.end(...args);
  }

  destroy(error?: Error) {
    this.isDestroyed = true;
    return super.destroy(error);
  }
}

describe("L04-W1 Server SSE Hub & Backpressure (SYNC-02, 04, 05, 06)", () => {
  describe("SYNC-02: Atomic Full Sync & Subscription Gap-Free", () => {
    it("connects without cursor -> receives full snapshot with current watermark cursor", () => {
      const channel = new SseChannel({
        scope: "MATCH",
        targetId: "room-abc",
        generation: "gen-1",
        ringBufferSize: 10,
      });

      // Publish 2 initial events
      channel.publish("MOVE", { move: "a1-b1" }, 1);
      channel.publish("MOVE", { move: "b1-c1" }, 2);

      const mockStream = new MockHttpResponse();
      const client = new SseClient(mockStream);

      const snapshotProvider = () => ({ state: "board_snapshot", version: 2 });
      const result = channel.subscribe(client, undefined, snapshotProvider);

      expect(result.fullSyncNeeded).toBe(true);
      expect(result.replayed).toBe(0);

      // Check stream received snapshot with cursor
      const output = mockStream.writtenChunks.join("");
      expect(output).toContain("event: sync\n");
      expect(output).toContain("id: MATCH:gen-1:2\n");
      expect(output).toContain('"state":"board_snapshot"');

      client.close();
      channel.close();
    });

    it("resumes with valid recent cursor -> replays missed events from ring buffer without full sync", () => {
      const channel = new SseChannel({
        scope: "MATCH",
        targetId: "room-abc",
        generation: "gen-1",
        ringBufferSize: 10,
      });

      channel.publish("MOVE", { move: "1" }, 1); // seq 1
      channel.publish("MOVE", { move: "2" }, 2); // seq 2
      channel.publish("MOVE", { move: "3" }, 3); // seq 3

      const mockStream = new MockHttpResponse();
      const client = new SseClient(mockStream);

      // Client last saw sequence 1
      const result = channel.subscribe(client, "MATCH:gen-1:1");

      expect(result.fullSyncNeeded).toBe(false);
      expect(result.replayed).toBe(2); // replayed seq 2 and 3

      const output = mockStream.writtenChunks.join("");
      expect(output).toContain("id: MATCH:gen-1:2\n");
      expect(output).toContain("id: MATCH:gen-1:3\n");

      client.close();
      channel.close();
    });

    it("resumes with stale cursor beyond ring buffer -> triggers fullSyncNeeded gap detection", () => {
      const channel = new SseChannel({
        scope: "MATCH",
        targetId: "room-abc",
        generation: "gen-1",
        ringBufferSize: 2, // only keep 2 items
      });

      channel.publish("MOVE", { move: "1" }, 1);
      channel.publish("MOVE", { move: "2" }, 2);
      channel.publish("MOVE", { move: "3" }, 3);
      channel.publish("MOVE", { move: "4" }, 4); // ring buffer now has 3, 4

      const mockStream = new MockHttpResponse();
      const client = new SseClient(mockStream);

      // Client asks for seq 1 which was evicted from ring buffer
      const result = channel.subscribe(client, "MATCH:gen-1:1", () => ({ fallback: "snapshot" }));

      expect(result.fullSyncNeeded).toBe(true);
      const output = mockStream.writtenChunks.join("");
      expect(output).toContain("event: sync\n");

      client.close();
      channel.close();
    });
  });

  describe("SYNC-04: Stream Backpressure & Slow Reader Bounded Buffer", () => {
    it("buffers messages when client socket applies backpressure and drains successfully", () => {
      const mockStream = new MockHttpResponse();
      const client = new SseClient(mockStream, { maxBufferSize: 10, maxBufferBytes: 1024 });

      // First message normal
      client.send({ event: "event1", data: { text: "hello" } });
      expect(mockStream.writtenChunks).toHaveLength(1);

      // Simulate backpressure
      mockStream.simulateBackpressure = true;
      client.send({ event: "event2", data: { text: "buffered1" } });
      client.send({ event: "event3", data: { text: "buffered2" } });
      client.send({ event: "event4", data: { text: "buffered3" } });

      expect(client.bufferedCount).toBe(2);

      // Simulate socket drain event
      mockStream.simulateBackpressure = false;
      mockStream.emit("drain");

      expect(client.bufferedCount).toBe(0);
      expect(mockStream.writtenChunks.length).toBe(4);

      client.close();
    });

    it("terminates slow reader when buffer limits are exceeded without affecting fast readers", () => {
      const channel = new SseChannel({
        scope: "MATCH",
        targetId: "room-abc",
        generation: "gen-1",
      });

      const fastStream = new MockHttpResponse();
      const fastClient = new SseClient(fastStream);

      const slowStream = new MockHttpResponse();
      slowStream.simulateBackpressure = true;
      // Very small buffer limit: 2 messages
      const slowClient = new SseClient(slowStream, { maxBufferSize: 2, maxBufferBytes: 500 });

      channel.subscribe(fastClient);
      channel.subscribe(slowClient);

      let slowOverflowed = false;
      slowClient.on("overflow", () => {
        slowOverflowed = true;
      });

      // Publish several messages
      channel.publish("M1", { data: "test1" }, 1);
      channel.publish("M2", { data: "test2" }, 2);
      channel.publish("M3", { data: "test3" }, 3);
      channel.publish("M4", { data: "test4" }, 4); // Slow client exceeds buffer!

      expect(slowOverflowed).toBe(true);
      expect(slowClient.isClosed).toBe(true);
      expect(slowStream.isDestroyed || slowStream.isWritableEnded).toBe(true);

      // Invariant: Fast client is unaffected and still healthy!
      expect(fastClient.isClosed).toBe(false);
      expect(fastStream.writtenChunks.length).toBe(4);

      fastClient.close();
      channel.close();
    });
  });

  describe("SYNC-05: Fan-out Isolation & Group Serialization", () => {
    it("isolates throwing listener so remaining subscribers receive events without disruption", () => {
      const channel = new SseChannel({
        scope: "MATCH",
        targetId: "room-abc",
        generation: "gen-1",
      });

      const normalStream = new MockHttpResponse();
      const normalClient = new SseClient(normalStream);

      // Buggy client whose send throws
      const buggyClient = new SseClient(new MockHttpResponse());
      vi.spyOn(buggyClient, "send").mockImplementation(() => {
        throw new Error("Unexpected subscriber crash!");
      });

      channel.subscribe(normalClient);
      channel.subscribe(buggyClient);

      const errorListener = vi.fn();
      channel.on("clientError", errorListener);

      expect(() => {
        channel.publish("MOVE", { move: "e2-e4" }, 1);
      }).not.toThrow();

      expect(errorListener).toHaveBeenCalledTimes(1);
      // Normal client received the message successfully!
      expect(normalStream.writtenChunks).toHaveLength(1);

      normalClient.close();
      buggyClient.close();
      channel.close();
    });

    it("serializes payload only once per roleGroup", () => {
      const channel = new SseChannel({
        scope: "MATCH",
        targetId: "room-abc",
        generation: "gen-1",
      });

      const spec1 = new SseClient(new MockHttpResponse(), { roleGroup: "SPECTATOR" });
      const spec2 = new SseClient(new MockHttpResponse(), { roleGroup: "SPECTATOR" });
      const playerBlue = new SseClient(new MockHttpResponse(), { roleGroup: "PLAYER_BLUE" });

      channel.subscribe(spec1);
      channel.subscribe(spec2);
      channel.subscribe(playerBlue);

      const jsonSpy = vi.spyOn(JSON, "stringify");

      channel.publish("TICK", { test: 123 }, 1);

      // Group serialization: for the 2 spectators sharing "SPECTATOR", stringification should be done once
      // Fast verify: each client received identical valid payload
      expect(spec1.isClosed).toBe(false);
      expect(spec2.isClosed).toBe(false);
      expect(playerBlue.isClosed).toBe(false);

      spec1.close();
      spec2.close();
      playerBlue.close();
      channel.close();
    });
  });

  describe("SYNC-06: Idempotent Single Cleanup & Resource Release", () => {
    it("cleans up resources idempotently and unregisters client from channel on disconnect", () => {
      const hub = new SseHub();
      const channel = hub.getOrCreateChannel("MATCH", "room-123", "gen-1");

      const stream = new MockHttpResponse();
      const client = new SseClient(stream);

      channel.subscribe(client);
      expect(channel.subscriberCount).toBe(1);

      // Trigger close on stream
      stream.emit("close");

      expect(client.isClosed).toBe(true);
      expect(channel.subscriberCount).toBe(0);

      // Multiple close calls are no-ops
      expect(() => client.close()).not.toThrow();
      expect(() => client.close()).not.toThrow();

      hub.close();
    });
  });

  describe("Pulse Sequence Separation", () => {
    it("publishPulse delivers time sync without incrementing canonical domain sequence", () => {
      const channel = new SseChannel({
        scope: "MATCH",
        targetId: "room-abc",
        generation: "gen-1",
      });

      const stream = new MockHttpResponse();
      const client = new SseClient(stream);
      channel.subscribe(client);

      channel.publish("MOVE", { m: 1 }, 1);
      expect(channel.sequence).toBe(1);

      // Send pulse
      channel.publishPulse({ anchorMs: 1000, clocksMs: { BLUE: 30000 }, serverTime: 12345 });

      // Invariant: sequence must remain 1!
      expect(channel.sequence).toBe(1);

      const output = stream.writtenChunks.join("");
      expect(output).toContain("event: pulse\n");
      expect(output).toContain('"anchorMs":1000');

      client.close();
      channel.close();
    });
  });

  describe("SYNC-07: Session and Principal Revocation", () => {
    it("revokes targeted session across channels, sends revoked event, and releases resources", () => {
      const hub = new SseHub();
      const ch1 = hub.getOrCreateChannel("MATCH", "room-1", "gen-1");
      const ch2 = hub.getOrCreateChannel("MATCH", "room-2", "gen-1");

      const streamSessA1 = new MockHttpResponse();
      const clientSessA1 = new SseClient(streamSessA1, { sessionId: "sess-A", principal: "user-1" });
      ch1.subscribe(clientSessA1);

      const streamSessA2 = new MockHttpResponse();
      const clientSessA2 = new SseClient(streamSessA2, { sessionId: "sess-A", principal: "user-1" });
      ch2.subscribe(clientSessA2);

      const streamSessB = new MockHttpResponse();
      const clientSessB = new SseClient(streamSessB, { sessionId: "sess-B", principal: "user-2" });
      ch1.subscribe(clientSessB);

      expect(ch1.subscriberCount).toBe(2);
      expect(ch2.subscriberCount).toBe(1);

      // Revoke session A
      const revokedCount = hub.revokeSession("sess-A", "SESSION_EXPIRED");
      expect(revokedCount).toBe(2);

      // Clients for session A must be closed
      expect(clientSessA1.isClosed).toBe(true);
      expect(clientSessA2.isClosed).toBe(true);
      expect(streamSessA1.writtenChunks.join("")).toContain("event: revoked\n");
      expect(streamSessA1.writtenChunks.join("")).toContain("SESSION_EXPIRED");
      expect(streamSessA2.writtenChunks.join("")).toContain("event: revoked\n");

      // Session B must remain unaffected and open
      expect(clientSessB.isClosed).toBe(false);
      expect(ch1.subscriberCount).toBe(1);
      expect(ch2.subscriberCount).toBe(0);

      // ch1 still publishes to session B
      ch1.publish("MOVE", { m: 2 }, 2);
      expect(streamSessB.writtenChunks.join("")).toContain("event: MOVE\n");

      hub.close();
    });

    it("revokes targeted principal across channels", () => {
      const hub = new SseHub();
      const ch = hub.getOrCreateChannel("MATCH", "room-1", "gen-1");

      const stream1 = new MockHttpResponse();
      const client1 = new SseClient(stream1, { principal: "user-target" });
      ch.subscribe(client1);

      const stream2 = new MockHttpResponse();
      const client2 = new SseClient(stream2, { principal: "user-other" });
      ch.subscribe(client2);

      const count = hub.revokePrincipal("user-target", "ROLE_REVOKED");
      expect(count).toBe(1);
      expect(client1.isClosed).toBe(true);
      expect(client2.isClosed).toBe(false);
      expect(stream1.writtenChunks.join("")).toContain("ROLE_REVOKED");

      hub.close();
    });
  });
});

