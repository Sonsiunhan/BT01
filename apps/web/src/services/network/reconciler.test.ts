import { describe, expect, it } from "vitest";
import type { DomainEventEnvelope } from "@ottv2/contracts";

import {
  createReconciler,
  reconcileDomainEvent,
  reconcilePulse,
  reconcileSnapshot,
  reconcileStaleAck,
  type DomainReconcilerState,
} from "./reconciler";

type TestMatchData = {
  board: string[];
  moves: string[];
};

describe("L04-W2 Client Reconciler (SYNC-03)", () => {
  const initialData: TestMatchData = { board: ["a1", "b1"], moves: [] };

  it("applies in-order domain events monotonically and updates watermark", () => {
    let state = createReconciler<TestMatchData>("MATCH", "room-1", "gen-1", initialData, 0, 0);

    const event1: DomainEventEnvelope = {
      protocolVersion: "0.2",
      messageId: "00000000-0000-0000-0000-000000000001",
      type: "MOVE",
      timestamp: 1000,
      scope: "MATCH",
      targetId: "room-1",
      sequence: 1,
      stateVersion: 1,
      payload: { move: "a1-a2" },
    };

    const result1 = reconcileDomainEvent(state, event1, (prev, payload: any) => ({
      ...prev,
      moves: [...prev.moves, payload.move],
    }));

    expect(result1.action).toBe("APPLIED");
    expect(result1.state.watermarkSequence).toBe(1);
    expect(result1.state.stateVersion).toBe(1);
    expect(result1.state.data.moves).toEqual(["a1-a2"]);
    expect(result1.state.gapDetected).toBe(false);
  });

  it("ignores duplicate and stale events without rolling back or duplicate side-effects", () => {
    let state = createReconciler<TestMatchData>("MATCH", "room-1", "gen-1", initialData, 2, 2);

    const duplicateEvent: DomainEventEnvelope = {
      protocolVersion: "0.2",
      messageId: "00000000-0000-0000-0000-000000000002",
      type: "MOVE",
      timestamp: 1000,
      scope: "MATCH",
      targetId: "room-1",
      sequence: 2, // Already at sequence 2
      stateVersion: 2,
      payload: { move: "duplicate-move" },
    };

    const result = reconcileDomainEvent(state, duplicateEvent, (prev, payload: any) => ({
      ...prev,
      moves: [...prev.moves, payload.move],
    }));

    expect(result.action).toBe("IGNORED_DUPLICATE");
    expect(result.state.watermarkSequence).toBe(2);
    expect(result.state.data.moves).toEqual([]);
  });

  it("detects sequence gap and flags gapDetected to trigger resync", () => {
    let state = createReconciler<TestMatchData>("MATCH", "room-1", "gen-1", initialData, 1, 1);

    // Sequence jumps from 1 to 3 (missing seq 2!)
    const gapEvent: DomainEventEnvelope = {
      protocolVersion: "0.2",
      messageId: "00000000-0000-0000-0000-000000000003",
      type: "MOVE",
      timestamp: 1000,
      scope: "MATCH",
      targetId: "room-1",
      sequence: 3,
      stateVersion: 3,
      payload: { move: "c1-c2" },
    };

    const result = reconcileDomainEvent(state, gapEvent, (prev) => prev);

    expect(result.action).toBe("GAP_DETECTED");
    expect(result.state.gapDetected).toBe(true);
    // Invariant: does not guess move or advance sequence on gap!
    expect(result.state.watermarkSequence).toBe(1);
  });

  it("reconciles full snapshot on resync and clears gapDetected flag", () => {
    let state = createReconciler<TestMatchData>("MATCH", "room-1", "gen-1", initialData, 1, 1);
    state = { ...state, gapDetected: true };

    const freshSnapshotData: TestMatchData = { board: ["a1", "b2"], moves: ["a1-a2", "b1-b2"] };
    const resynced = reconcileSnapshot(state, freshSnapshotData, 5, 5);

    expect(resynced.watermarkSequence).toBe(5);
    expect(resynced.stateVersion).toBe(5);
    expect(resynced.gapDetected).toBe(false);
    expect(resynced.data.moves).toHaveLength(2);
  });

  it("reconciles clock pulse without overwriting board or advancing domain sequence", () => {
    let state = createReconciler<TestMatchData>("MATCH", "room-1", "gen-1", initialData, 3, 3);

    const pulse = {
      anchorMs: 5000,
      clocksMs: { BLUE: 295000, RED: 300000 },
      serverTime: 1234567,
    };

    const nextState = reconcilePulse(state, pulse);

    expect(nextState.watermarkSequence).toBe(3);
    expect(nextState.stateVersion).toBe(3);
    expect(nextState.lastPulse).toEqual(pulse);
    // Board data remains unchanged
    expect(nextState.data).toBe(state.data);
  });

  it("stale HTTP ACK does not rollback canonical store", () => {
    let state = createReconciler<TestMatchData>("MATCH", "room-1", "gen-1", initialData, 4, 4);

    // Older HTTP ACK with stateVersion 2
    const staleAck = {
      match: {
        stateVersion: 2,
        board: ["stale"],
      },
    };

    const result = reconcileStaleAck(state, staleAck.match.stateVersion, () => {
      return { board: staleAck.match.board, moves: [] };
    });

    expect(result.action).toBe("IGNORED_STALE_ACK");
    expect(result.state.stateVersion).toBe(4);
    expect(result.state.data.board).toEqual(["a1", "b1"]);
  });
});
