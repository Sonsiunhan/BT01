import { describe, expect, it } from "vitest";
import { AdjudicationLedgerService } from "../../src/modules/tournament-core/adjudication-ledger.service.js";
import { TournamentStateStore } from "../../src/modules/tournament-foundation/tournament-store.js";
import { canViewExactTieAdjudications } from "../../src/modules/tournament-core/tournament-core.route.js";
import type { ManualAdjudicationRequestDto } from "@ottv2/contracts";

const request: ManualAdjudicationRequestDto = {
  id: "adj-1",
  tournamentId: "t-1",
  matchId: "m-1",
  roomId: "room-1",
  blueParticipantId: "blue-1",
  redParticipantId: "red-1",
  status: "WAITING",
  frozenSnapshot: {
    board: { rows: 1, columns: 1, cells: [{ row: 0, column: 0, side: "BLUE", pieceType: "R" }] },
    sideToMove: "BLUE",
    tieIndicators: {
      blue: { materialByType: { R: 1, P: 2, S: 1 }, goalDistance: { reachable: true, distance: 3 }, mobility: 3 },
      red: { materialByType: { R: 1, P: 2, S: 1 }, goalDistance: { reachable: true, distance: 3 }, mobility: 3 },
    },
    ruleVersion: "v3",
    privateBotSource: "must-not-leak",
  },
  deadlineAt: "2026-10-23T10:00:00.000Z",
  fallbackPolicy: "RANDOM_SEEDED",
  winnerSide: null,
  decidedByUserId: null,
  decisionReason: null,
  decidedAt: null,
  finishSequence: null,
  createdAt: "2026-10-23T09:00:00.000Z",
  updatedAt: "2026-10-23T09:00:00.000Z",
};

describe("N09 manual adjudication view", () => {
  it("projects only the typed stopped-match allowlist", () => {
    const service = new AdjudicationLedgerService(new TournamentStateStore());
    const view = service.toManualAdjudicationView(request);
    expect(view.board?.cells).toHaveLength(1);
    expect(view.tieIndicators?.blue.materialByType).toEqual({ R: 1, P: 2, S: 1 });
    expect(view).not.toHaveProperty("privateBotSource");
    expect(view).not.toHaveProperty("frozenSnapshot");
  });

  it("allows only an owner TA to view exact-tie requests", () => {
    expect(canViewExactTieAdjudications({ userId: "ta-1", roles: ["TOURNAMENT_ADMIN"], principalType: "USER" }, "ta-1")).toBe(true);
    expect(canViewExactTieAdjudications({ userId: "admin-1", roles: ["ADMIN"], principalType: "USER" }, "ta-1")).toBe(false);
    expect(canViewExactTieAdjudications({ userId: "ref-1", roles: ["REFEREE"], principalType: "USER" }, "ref-1")).toBe(false);
  });
});
