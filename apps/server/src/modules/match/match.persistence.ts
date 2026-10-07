import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import type { MatchEventEnvelope, MatchSnapshot } from "@ottv2/contracts";
import type { Coordinate, Side } from "@ottv2/game-rules";

export type PersistedMove = {
  sequence: number;
  stateVersion: number;
  side: Side;
  from: Coordinate;
  to: Coordinate;
  capturedPieceId: string | null;
  committedAt: number;
};

export type MatchCheckpoint = {
  roomId: string;
  matchId: string;
  sequence: number;
  stateVersion: number;
  snapshot: MatchSnapshot;
  moves: readonly PersistedMove[];
  disconnectDeadlines: Readonly<Record<string, number>>;
  expiredDisconnects: readonly string[];
};

/**
 * Synchronous seam used by the authoritative lifecycle. A production adapter
 * can implement this with a transactionally fenced database/object store; the
 * manager never writes private bot payloads into the public event envelope.
 */
export interface MatchPersistence {
  load(roomId: string): MatchCheckpoint | null;
  saveCheckpoint(checkpoint: MatchCheckpoint): void;
  appendEvent(event: MatchEventEnvelope): void;
  /**
   * Optional atomic boundary for adapters that can commit the public event and
   * the checkpoint together. The manager uses this to avoid an acknowledged
   * move existing in only one of the two durable records.
   */
  commitEvent?(checkpoint: MatchCheckpoint, event: MatchEventEnvelope): void;
}

export class InMemoryMatchPersistence implements MatchPersistence {
  private readonly checkpoints = new Map<string, MatchCheckpoint>();
  private readonly events = new Map<string, MatchEventEnvelope[]>();

  load(roomId: string): MatchCheckpoint | null {
    const value = this.checkpoints.get(roomId);
    return value ? structuredClone(value) : null;
  }

  saveCheckpoint(checkpoint: MatchCheckpoint): void {
    this.checkpoints.set(checkpoint.roomId, structuredClone(checkpoint));
  }

  appendEvent(event: MatchEventEnvelope): void {
    const list = this.events.get(event.roomId) ?? [];
    list.push(structuredClone(event));
    this.events.set(event.roomId, list);
  }

  commitEvent(checkpoint: MatchCheckpoint, event: MatchEventEnvelope): void {
    this.saveCheckpoint(checkpoint);
    this.appendEvent(event);
  }

  eventsFor(roomId: string): readonly MatchEventEnvelope[] {
    return structuredClone(this.events.get(roomId) ?? []);
  }
}

type DurableState = {
  checkpoint: MatchCheckpoint | null;
  events: MatchEventEnvelope[];
};

/**
 * Atomic single-host durable adapter.
 *
 * Each room is stored as one JSON document. Writes use an exclusive lock,
 * fsync a temporary file, then rename it over the room document. A monotonic
 * sequence/stateVersion fence rejects stale writers. This adapter is suitable
 * for an explicitly provisioned durable filesystem; Render Free's ephemeral
 * filesystem must not be advertised as restart-durable.
 */
export class FileMatchPersistence implements MatchPersistence {
  private readonly directory: string;
  private readonly lockDirectory: string;

  constructor(directory: string) {
    this.directory = directory;
    this.lockDirectory = join(directory, ".locks");
    mkdirSync(this.directory, { recursive: true });
    mkdirSync(this.lockDirectory, { recursive: true });
  }

  load(roomId: string): MatchCheckpoint | null {
    return structuredClone(this.readState(roomId).checkpoint);
  }

  saveCheckpoint(checkpoint: MatchCheckpoint): void {
    this.withLock(checkpoint.roomId, () => {
      const state = this.readState(checkpoint.roomId);
      this.assertCheckpointFence(state.checkpoint, checkpoint);
      state.checkpoint = structuredClone(checkpoint);
      this.writeState(checkpoint.roomId, state);
    });
  }

  appendEvent(event: MatchEventEnvelope): void {
    this.withLock(event.roomId, () => {
      const state = this.readState(event.roomId);
      this.appendEventWithFence(state, event);
      this.writeState(event.roomId, state);
    });
  }

  commitEvent(checkpoint: MatchCheckpoint, event: MatchEventEnvelope): void {
    if (checkpoint.roomId !== event.roomId || checkpoint.matchId !== event.matchId || checkpoint.sequence !== event.sequence || checkpoint.stateVersion !== event.stateVersion) {
      throw new Error("R4 persistence commit fence mismatch");
    }
    this.withLock(checkpoint.roomId, () => {
      const state = this.readState(checkpoint.roomId);
      this.assertCheckpointFence(state.checkpoint, checkpoint);
      this.appendEventWithFence(state, event);
      state.checkpoint = structuredClone(checkpoint);
      this.writeState(checkpoint.roomId, state);
    });
  }

  eventsFor(roomId: string): readonly MatchEventEnvelope[] {
    return structuredClone(this.readState(roomId).events);
  }

  private statePath(roomId: string): string {
    const safeRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.directory, safeRoomId + ".json");
  }

  private lockPath(roomId: string): string {
    const safeRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.lockDirectory, safeRoomId + ".lock");
  }

  private readState(roomId: string): DurableState {
    const path = this.statePath(roomId);
    if (!existsSync(path)) return { checkpoint: null, events: [] };
    const parsed = JSON.parse(readFileSync(path, "utf8")) as DurableState;
    return { checkpoint: parsed.checkpoint ? structuredClone(parsed.checkpoint) : null, events: structuredClone(parsed.events ?? []) };
  }

  private writeState(roomId: string, state: DurableState): void {
    const path = this.statePath(roomId);
    const temporary = path + "." + process.pid + "." + randomUUID() + ".tmp";
    const payload = JSON.stringify(state);
    try {
      writeFileSync(temporary, payload, { encoding: "utf8", mode: 0o600 });
      const descriptor = openSync(temporary, "r+");
      try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
      renameSync(temporary, path);
    } catch (error) {
      try { unlinkSync(temporary); } catch { /* preserve the original write error */ }
      throw error;
    }
    try {
      const directory = openSync(dirname(path), "r");
      try { fsyncSync(directory); } finally { closeSync(directory); }
    } catch {
      // Directory fsync is unavailable on some Windows filesystems; the file
      // itself was fsynced before rename and the adapter remains fail-closed.
    }
  }

  private withLock(roomId: string, operation: () => void): void {
    const path = this.lockPath(roomId);
    let descriptor: number | undefined;
    try {
      descriptor = openSync(path, "wx", 0o600);
      operation();
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      try { unlinkSync(path); } catch { /* lock was already reclaimed */ }
    }
  }

  private assertCheckpointFence(previous: MatchCheckpoint | null, next: MatchCheckpoint): void {
    if (!previous) return;
    if (previous.matchId !== next.matchId) throw new Error("R4 persistence match fence mismatch");
    if (next.sequence < previous.sequence || (next.sequence === previous.sequence && next.stateVersion < previous.stateVersion)) {
      throw new Error("R4 persistence stale checkpoint");
    }
  }

  private appendEventWithFence(state: DurableState, event: MatchEventEnvelope): void {
    const existing = state.events.find((candidate) => candidate.sequence === event.sequence);
    if (existing) {
      if (existing.messageId === event.messageId) return;
      throw new Error("R4 persistence duplicate sequence fence");
    }
    const previous = state.events.at(-1);
    if (previous && event.sequence < previous.sequence) throw new Error("R4 persistence stale event");
    state.events.push(structuredClone(event));
  }
}
