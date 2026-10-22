import { getBoardCoordinates } from "./coordinates.js";
import { createRuleProgress, getActiveGoal } from "./goals.js";
import { getLegalDestinations, getLegalMoves } from "./engine.js";
import type { Board, Coordinate, Piece, PieceType, RuleProfile, RuleState, Side } from "./types.js";

export const COMPARATOR_POLICY_VERSION = "comparator-v1" as const;

export type ComparatorCriterion = "WEIGHTED_MATERIAL" | "GOAL_DISTANCE" | "MOBILITY";
export type ComparatorFinalTiePolicy = "FIRST_MOVER_WINS" | "SECOND_MOVER_WINS" | "MANUAL";
export type ComparatorNoLegalMovePolicy = "COMPARE_CRITERIA" | "WIN" | "LOSS" | "DRAW";
export type ComparatorManualFallback = Exclude<ComparatorFinalTiePolicy, "MANUAL"> | "DRAW";

export type ComparatorPolicy = Readonly<{
  version: string;
  criteriaOrder: readonly ComparatorCriterion[];
  materialWeights: Readonly<Record<PieceType, number>>;
  goalDistanceEnabled: boolean;
  mobilityEnabled: boolean;
  eventPolicies: Readonly<{
    noLegalMove: ComparatorNoLegalMovePolicy;
    ownTurnViolation: "LOSS";
    infrastructure: "NEUTRAL";
  }>;
  drawEnabled: boolean;
  finalTiePolicy: ComparatorFinalTiePolicy;
  manual: Readonly<{
    timeoutSeconds: number;
    fallback: ComparatorManualFallback;
  }>;
}>;

export type ComparatorGoalDistance = Readonly<{
  reachable: boolean;
  distance: number | null;
}>;

export type ComparatorSideMetrics = Readonly<{
  materialByType: Readonly<Record<PieceType, number>>;
  goalDistance: ComparatorGoalDistance | null;
  mobility: number;
}>;

export type ComparatorEvent =
  | Readonly<{ kind: "NO_LEGAL_MOVE"; side: Side }>
  | Readonly<{ kind: "OWN_TURN_VIOLATION"; side: Side }>
  | Readonly<{ kind: "INFRASTRUCTURE_FAILURE" }>;

export type TournamentComparatorInput = Readonly<{
  policy: ComparatorPolicy;
  firstMoverSide: Side;
  metrics: Readonly<Record<Side, ComparatorSideMetrics>>;
  event: ComparatorEvent | null;
}>;

export type ComparatorReasonCode =
  | "WEIGHTED_MATERIAL"
  | "GOAL_DISTANCE"
  | "MOBILITY"
  | "FINAL_TIE_POLICY"
  | "MANUAL_EXACT_TIE"
  | "NO_LEGAL_MOVE_WIN"
  | "NO_LEGAL_MOVE_LOSS"
  | "NO_LEGAL_MOVE_DRAW"
  | "INFRASTRUCTURE_NEUTRAL"
  | "OWN_TURN_VIOLATION";

export type TournamentComparatorResult = Readonly<{
  winnerSide: Side | null;
  reasonCode: ComparatorReasonCode;
  decidedBy: ComparatorCriterion | "FINAL_TIE_POLICY" | "EVENT";
  manualRequired: boolean;
  firstMoverSide: Side;
  secondMoverSide: Side;
  metrics: Readonly<Record<Side, ComparatorSideMetrics>>;
}>;

export type DerivedComparatorMetrics = Readonly<{
  BLUE: ComparatorSideMetrics;
  RED: ComparatorSideMetrics;
}>;

export class ComparatorPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComparatorPolicyError";
  }
}

function opposite(side: Side): Side {
  return side === "BLUE" ? "RED" : "BLUE";
}

function scaledWeight(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1000) {
    throw new ComparatorPolicyError("Trọng số comparator phải hữu hạn trong khoảng 0..1000.");
  }
  const scaled = Math.round(value * 1000);
  if (Math.abs(value * 1000 - scaled) > 1e-9) {
    throw new ComparatorPolicyError("Trọng số comparator chỉ được có tối đa 3 chữ số thập phân.");
  }
  return scaled;
}

export function validateComparatorPolicy(policy: ComparatorPolicy): void {
  if (policy.criteriaOrder.length === 0 || policy.criteriaOrder.length > 3 || new Set(policy.criteriaOrder).size !== policy.criteriaOrder.length) {
    throw new ComparatorPolicyError("criteriaOrder phải không rỗng và không lặp tiêu chí.");
  }
  if (!policy.criteriaOrder.some((criterion) => criterion === "WEIGHTED_MATERIAL" || (criterion === "GOAL_DISTANCE" && policy.goalDistanceEnabled) || (criterion === "MOBILITY" && policy.mobilityEnabled))) {
    throw new ComparatorPolicyError("criteriaOrder phải chứa ít nhất một tiêu chí đang bật.");
  }
  for (const criterion of policy.criteriaOrder) {
    if (criterion === "GOAL_DISTANCE" && !policy.goalDistanceEnabled) {
      throw new ComparatorPolicyError("Không thể đưa GOAL_DISTANCE vào thứ tự khi đã tắt tiêu chí.");
    }
    if (criterion === "MOBILITY" && !policy.mobilityEnabled) {
      throw new ComparatorPolicyError("Không thể đưa MOBILITY vào thứ tự khi đã tắt tiêu chí.");
    }
  }
  const totalMaterialWeight = (Object.keys(policy.materialWeights) as PieceType[])
    .reduce((sum, type) => sum + scaledWeight(policy.materialWeights[type]), 0);
  if (totalMaterialWeight === 0) {
    throw new ComparatorPolicyError("Comparator không được có toàn bộ trọng số và tiêu chí bằng 0.");
  }
  if (!policy.drawEnabled && policy.eventPolicies.noLegalMove === "DRAW") {
    throw new ComparatorPolicyError("NO_LEGAL_MOVE DRAW yêu cầu drawEnabled.");
  }
  if (!policy.drawEnabled && policy.manual.fallback === "DRAW") {
    throw new ComparatorPolicyError("Manual fallback DRAW yêu cầu drawEnabled.");
  }
  if (!Number.isInteger(policy.manual.timeoutSeconds) || policy.manual.timeoutSeconds < 1 || policy.manual.timeoutSeconds > 3600) {
    throw new ComparatorPolicyError("Manual timeout phải là số nguyên trong khoảng 1..3600 giây.");
  }
}

function materialScore(metrics: ComparatorSideMetrics, policy: ComparatorPolicy): number {
  const score = (Object.keys(metrics.materialByType) as PieceType[]).reduce(
    (sum, type) => sum + metrics.materialByType[type] * scaledWeight(policy.materialWeights[type]),
    0,
  );
  if (!Number.isSafeInteger(score)) {
    throw new ComparatorPolicyError("Điểm material vượt giới hạn số nguyên an toàn.");
  }
  return score;
}

function validateMetrics(metrics: ComparatorSideMetrics): void {
  for (const type of ["R", "P", "S"] as const) {
    const count = metrics.materialByType[type];
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new ComparatorPolicyError("Số quân material phải là số nguyên không âm hữu hạn.");
    }
  }
  if (!Number.isSafeInteger(metrics.mobility) || metrics.mobility < 0) {
    throw new ComparatorPolicyError("Mobility phải là số nguyên không âm hữu hạn.");
  }
  if (metrics.goalDistance) {
    if (metrics.goalDistance.reachable && (!Number.isSafeInteger(metrics.goalDistance.distance) || metrics.goalDistance.distance === null || metrics.goalDistance.distance < 0)) {
      throw new ComparatorPolicyError("Goal distance reachable phải có khoảng cách nguyên không âm.");
    }
    if (!metrics.goalDistance.reachable && metrics.goalDistance.distance !== null) {
      throw new ComparatorPolicyError("Goal distance unreachable phải có distance null.");
    }
  }
}

function cloneMetrics(metrics: Readonly<Record<Side, ComparatorSideMetrics>>): Readonly<Record<Side, ComparatorSideMetrics>> {
  return {
    BLUE: {
      materialByType: { ...metrics.BLUE.materialByType },
      goalDistance: metrics.BLUE.goalDistance ? { ...metrics.BLUE.goalDistance } : null,
      mobility: metrics.BLUE.mobility,
    },
    RED: {
      materialByType: { ...metrics.RED.materialByType },
      goalDistance: metrics.RED.goalDistance ? { ...metrics.RED.goalDistance } : null,
      mobility: metrics.RED.mobility,
    },
  };
}

function emptyBoard(profile: RuleProfile): Board {
  return Object.fromEntries(getBoardCoordinates(profile.board).map((coordinate) => [coordinate, null])) as Record<Coordinate, Piece | null>;
}

function probeState(profile: RuleProfile, side: Side, piece: Piece, coordinate: Coordinate): RuleState {
  const board = { ...emptyBoard(profile) } as Record<Coordinate, Piece | null>;
  board[coordinate] = piece;
  return {
    board,
    pieceCounts: profile.pieceCounts,
    currentTurn: side,
    status: "PLAYING",
    winner: null,
    resultReason: null,
    ruleProfile: profile,
  };
}

function shortestGoalDistance(state: RuleState, side: Side, goal: Coordinate | null): ComparatorGoalDistance | null {
  if (goal === null) return null;
  const profile = state.ruleProfile;
  if (!profile) return null;
  const queue: Array<{ coordinate: Coordinate; distance: number; piece: Piece }> = [];
  const visited = new Set<string>();
  for (const coordinate of getBoardCoordinates(profile.board)) {
    const piece = state.board[coordinate];
    if (!piece || piece.side !== side) continue;
    queue.push({ coordinate, distance: 0, piece });
    visited.add(`${piece.type}:${coordinate}`);
  }
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) continue;
    if (current.coordinate === goal) return { reachable: true, distance: current.distance };
    const next = getLegalDestinations(probeState(profile, side, current.piece, current.coordinate), side, current.coordinate);
    for (const coordinate of next) {
      const visitKey = `${current.piece.type}:${coordinate}`;
      if (visited.has(visitKey)) continue;
      visited.add(visitKey);
      queue.push({ coordinate, distance: current.distance + 1, piece: current.piece });
    }
  }
  return { reachable: false, distance: null };
}

function activeGoalForState(state: RuleState, side: Side): Coordinate | null {
  const profile = state.ruleProfile;
  if (!profile) return null;
  if (state.progress) return state.progress.activeGoalBySide[side];
  return getActiveGoal(profile, side, createRuleProgress(profile));
}

export function deriveTournamentComparatorMetrics(state: RuleState): DerivedComparatorMetrics {
  const profile = state.ruleProfile;
  if (!profile) throw new ComparatorPolicyError("Không thể tính comparator khi state thiếu ruleProfile.");
  const make = (side: Side): ComparatorSideMetrics => ({
    materialByType: { ...state.pieceCounts[side] },
    goalDistance: shortestGoalDistance(state, side, activeGoalForState(state, side)),
    mobility: getLegalMoves({ ...state, currentTurn: side, status: "PLAYING" }, side).length,
  });
  return { BLUE: make("BLUE"), RED: make("RED") };
}

export function compareRuleStateOutcome(
  state: RuleState,
  policy: ComparatorPolicy,
  firstMoverSide: Side,
  event: ComparatorEvent | null = null,
): TournamentComparatorResult {
  return compareTournamentOutcome({ policy, firstMoverSide, metrics: deriveTournamentComparatorMetrics(state), event });
}

function compareGoalDistance(
  blue: ComparatorGoalDistance | null,
  red: ComparatorGoalDistance | null,
): Side | null {
  if (!blue || !red || (!blue.reachable && !red.reachable)) return null;
  if (blue.reachable !== red.reachable) return blue.reachable ? "BLUE" : "RED";
  if (blue.distance === null || red.distance === null) return null;
  if (blue.distance === red.distance) return null;
  return blue.distance < red.distance ? "BLUE" : "RED";
}

function freezeResult(result: TournamentComparatorResult): TournamentComparatorResult {
  Object.freeze(result.metrics.BLUE.materialByType);
  if (result.metrics.BLUE.goalDistance) Object.freeze(result.metrics.BLUE.goalDistance);
  Object.freeze(result.metrics.BLUE);
  Object.freeze(result.metrics.RED.materialByType);
  if (result.metrics.RED.goalDistance) Object.freeze(result.metrics.RED.goalDistance);
  Object.freeze(result.metrics.RED);
  Object.freeze(result.metrics);
  return Object.freeze(result);
}

export function compareTournamentOutcome(input: TournamentComparatorInput): TournamentComparatorResult {
  validateComparatorPolicy(input.policy);
  validateMetrics(input.metrics.BLUE);
  validateMetrics(input.metrics.RED);
  const resultMetrics = cloneMetrics(input.metrics);
  const firstMoverSide = input.firstMoverSide;
  const secondMoverSide = opposite(firstMoverSide);

  if (input.event?.kind === "INFRASTRUCTURE_FAILURE") {
    return freezeResult({
      winnerSide: null,
      reasonCode: "INFRASTRUCTURE_NEUTRAL",
      decidedBy: "EVENT",
      manualRequired: false,
      firstMoverSide,
      secondMoverSide,
      metrics: resultMetrics,
    });
  }
  if (input.event?.kind === "OWN_TURN_VIOLATION") {
    return freezeResult({
      winnerSide: opposite(input.event.side),
      reasonCode: "OWN_TURN_VIOLATION",
      decidedBy: "EVENT",
      manualRequired: false,
      firstMoverSide,
      secondMoverSide,
      metrics: resultMetrics,
    });
  }
  if (input.event?.kind === "NO_LEGAL_MOVE" && input.policy.eventPolicies.noLegalMove !== "COMPARE_CRITERIA") {
    const eventPolicy = input.policy.eventPolicies.noLegalMove;
    const winnerSide = eventPolicy === "DRAW"
      ? null
      : eventPolicy === "WIN"
        ? input.event.side
        : opposite(input.event.side);
    return freezeResult({
      winnerSide,
      reasonCode: eventPolicy === "DRAW" ? "NO_LEGAL_MOVE_DRAW" : eventPolicy === "WIN" ? "NO_LEGAL_MOVE_WIN" : "NO_LEGAL_MOVE_LOSS",
      decidedBy: "EVENT",
      manualRequired: false,
      firstMoverSide,
      secondMoverSide,
      metrics: resultMetrics,
    });
  }

  for (const criterion of input.policy.criteriaOrder) {
    let winner: Side | null = null;
    if (criterion === "WEIGHTED_MATERIAL") {
      const blueScore = materialScore(input.metrics.BLUE, input.policy);
      const redScore = materialScore(input.metrics.RED, input.policy);
      winner = blueScore === redScore ? null : blueScore > redScore ? "BLUE" : "RED";
    } else if (criterion === "GOAL_DISTANCE") {
      winner = compareGoalDistance(input.metrics.BLUE.goalDistance, input.metrics.RED.goalDistance);
    } else if (criterion === "MOBILITY") {
      winner = input.metrics.BLUE.mobility === input.metrics.RED.mobility
        ? null
        : input.metrics.BLUE.mobility > input.metrics.RED.mobility ? "BLUE" : "RED";
    }
    if (winner) {
      return freezeResult({
        winnerSide: winner,
        reasonCode: criterion,
        decidedBy: criterion,
        manualRequired: false,
        firstMoverSide,
        secondMoverSide,
        metrics: resultMetrics,
      });
    }
  }

  const winnerSide = input.policy.finalTiePolicy === "MANUAL"
    ? null
    : input.policy.finalTiePolicy === "FIRST_MOVER_WINS" ? firstMoverSide : secondMoverSide;
  return freezeResult({
    winnerSide,
    reasonCode: input.policy.finalTiePolicy === "MANUAL" ? "MANUAL_EXACT_TIE" : "FINAL_TIE_POLICY",
    decidedBy: "FINAL_TIE_POLICY",
    manualRequired: input.policy.finalTiePolicy === "MANUAL",
    firstMoverSide,
    secondMoverSide,
    metrics: resultMetrics,
  });
}
