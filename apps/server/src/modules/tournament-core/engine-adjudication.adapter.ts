import {
  compareRuleStateOutcome,
  coordinateToPosition,
  deriveTournamentComparatorMetrics,
  getBoardCoordinates,
  type ComparatorPolicy,
  type RuleState,
  type Side,
} from "@ottv2/game-rules";
import type { AdjudicationLedgerService } from "./adjudication-ledger.service.js";

/**
 * The engine is the only source of truth for an exact-tie snapshot.  This
 * adapter is deliberately small: it translates an immutable RuleState into
 * the redacted boundary owned by the adjudication ledger and never accepts
 * client supplied metrics.
 */
export function createEngineAdjudicationSnapshot(state: RuleState): Record<string, unknown> {
  const profile = state.ruleProfile;
  if (!profile) throw new Error("ENGINE_RULE_PROFILE_REQUIRED");

  const cells = getBoardCoordinates(profile.board).map((coordinate) => {
    const position = coordinateToPosition(coordinate);
    const piece = state.board[coordinate] ?? null;
    return {
      row: position.rankIndex,
      column: position.fileIndex,
      side: piece?.side ?? null,
      pieceType: piece?.type ?? null,
    };
  });
  const metrics = deriveTournamentComparatorMetrics(state);

  return {
    board: {
      rows: profile.board.rows,
      columns: profile.board.cols,
      cells,
    },
    sideToMove: state.currentTurn,
    ruleVersion: profile.version,
    tieIndicators: {
      blue: {
        pieceCounts: { ...metrics.BLUE.materialByType },
        goalDistance: metrics.BLUE.goalDistance,
        mobility: metrics.BLUE.mobility,
      },
      red: {
        pieceCounts: { ...metrics.RED.materialByType },
        goalDistance: metrics.RED.goalDistance,
        mobility: metrics.RED.mobility,
      },
    },
  };
}

export async function openExactTieAdjudicationFromEngine(input: {
  ledgerService: AdjudicationLedgerService;
  state: RuleState;
  policy: ComparatorPolicy;
  firstMoverSide: Side;
  tournamentId: string;
  matchId: string;
  roomId: string;
  blueParticipantId: string;
  redParticipantId: string;
  deadlineSeconds?: number;
}) {
  const comparison = compareRuleStateOutcome(
    input.state,
    input.policy,
    input.firstMoverSide,
  );
  if (!comparison.manualRequired || comparison.reasonCode !== "MANUAL_EXACT_TIE") {
    throw new Error("ENGINE_STATE_IS_NOT_MANUAL_EXACT_TIE");
  }

  const request = {
    tournamentId: input.tournamentId,
    matchId: input.matchId,
    roomId: input.roomId,
    blueParticipantId: input.blueParticipantId,
    redParticipantId: input.redParticipantId,
    frozenSnapshot: createEngineAdjudicationSnapshot(input.state),
  };

  return input.deadlineSeconds === undefined
    ? input.ledgerService.openManualAdjudicationRequest(request)
    : input.ledgerService.openManualAdjudicationRequest({
        ...request,
        deadlineSeconds: input.deadlineSeconds,
      });
}
