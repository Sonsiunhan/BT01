import {
  applyMove,
  coordinateToPosition,
  getActiveGoal,
  getLegalMoves,
  GOAL_COORDINATES,
  type Coordinate,
  type MoveCommand,
  type RuleState,
  type Side,
} from "@ottv2/game-rules";

export interface ScoredMove {
  readonly move: MoveCommand;
  readonly score: number;
  readonly reason: string;
}

function chebyshevDistance(from: Coordinate, to: Coordinate): number {
  const p1 = coordinateToPosition(from);
  const p2 = coordinateToPosition(to);
  return Math.max(Math.abs(p1.fileIndex - p2.fileIndex), Math.abs(p1.rankIndex - p2.rankIndex));
}

function manhattanDistance(from: Coordinate, to: Coordinate): number {
  const p1 = coordinateToPosition(from);
  const p2 = coordinateToPosition(to);
  return Math.abs(p1.fileIndex - p2.fileIndex) + Math.abs(p1.rankIndex - p2.rankIndex);
}

/**
 * Evaluates candidate moves for a given side using goal-seeking (A* heuristic),
 * tactical RPS combat, threat avoidance, and defense.
 */
export function chooseBestMove(state: RuleState, side: Side = "RED"): MoveCommand | null {
  if (state.status !== "PLAYING") return null;

  const legalMoves = getLegalMoves(state, side);
  if (legalMoves.length === 0) return null;

  const opponent: Side = side === "BLUE" ? "RED" : "BLUE";
  const profile = state.ruleProfile;
  const targetGoal = (profile ? getActiveGoal(profile, side) : null) ?? GOAL_COORDINATES[side];
  const enemyGoal = (profile ? getActiveGoal(profile, opponent) : null) ?? GOAL_COORDINATES[opponent];

  // Threat check on current state: which of our pieces are currently in danger?
  const currentEnemyMoves = getLegalMoves(state, opponent);
  const endangeredSquares = new Set(currentEnemyMoves.map((m) => m.to));

  const scoredMoves: ScoredMove[] = [];

  for (const move of legalMoves) {
    const fromPiece = state.board[move.from];
    const targetPiece = state.board[move.to];

    // 1. Instant win check
    const moveResult = applyMove(state, move);
    if (moveResult.kind === "accepted") {
      if (moveResult.state.status === "FINISHED" && moveResult.state.winner === side) {
        return move; // Win the game immediately!
      }
    } else {
      continue; // Skip invalid moves
    }

    const nextState = moveResult.state;
    let score = 0;
    let reason = "normal";

    // 2. Goal Seeking (A* heuristic distance to goal)
    if (targetGoal) {
      const prevDist = chebyshevDistance(move.from, targetGoal);
      const nextDist = chebyshevDistance(move.to, targetGoal);
      const progressDelta = prevDist - nextDist; // positive if getting closer
      score += progressDelta * 60;
      score += (8 - nextDist) * 15; // Reward being generally closer to goal

      if (nextDist === 0) {
        score += 5000; // Lands on goal!
        reason = "goal-reached";
      }
    }

    // 3. Combat / Capture Evaluation
    if (targetPiece && targetPiece.side === opponent) {
      score += 220; // Major reward for eating an opponent piece
      reason = "capture";

      // Bonus if this capture causes an opponent type to be on the verge of extinction
      const enemyCountRemaining = state.pieceCounts[opponent][targetPiece.type];
      if (enemyCountRemaining <= 2) {
        score += 150;
      }
    }

    // 4. Tactical Safety & Threat Detection in next state
    const nextEnemyMoves = getLegalMoves(nextState, opponent);
    const destinationThreatened = nextEnemyMoves.some((em) => em.to === move.to);

    if (destinationThreatened) {
      if (targetPiece) {
        // Trade: captured, but will be recaptured
        score -= 90;
      } else {
        // Blunder: moved into enemy line of fire without capturing
        score -= 260;
      }
    }

    // 5. Escaping a currently endangered piece
    const wasEndangered = endangeredSquares.has(move.from);
    if (wasEndangered && !destinationThreatened) {
      score += 130; // Great move: safely dodged an enemy attack!
      if (reason === "normal") reason = "escape";
    }

    // 6. Home Goal Defense
    // If enemy pieces are threatening our home goal, prioritize intercepting / blocking
    if (enemyGoal) {
      const enemyDistToOurGoal = chebyshevDistance(move.to, enemyGoal);
      if (enemyDistToOurGoal <= 2 && targetPiece) {
        score += 180; // Intercepted a dangerous attacker near our base
        reason = "defense";
      }
    }

    // 7. Central positioning & advancement
    const pos = coordinateToPosition(move.to);
    const centerScore = 4 - Math.abs(pos.fileIndex - 4);
    score += centerScore * 4;

    // 8. Slight micro-jitter (0..6) to break ties organically
    score += Math.random() * 6;

    scoredMoves.push({ move, score, reason });
  }

  if (scoredMoves.length === 0) return legalMoves[0] ?? null;

  scoredMoves.sort((a, b) => b.score - a.score);
  return scoredMoves[0].move;
}
