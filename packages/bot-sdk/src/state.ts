import {
  LEGACY_RULE_PROFILE,
  getActiveGoal,
  getBoardCoordinates,
  getLegalDestinations,
  type RuleState,
  type Side,
} from "@ottv2/game-rules";
import type { BotMove, BotMoveRecord, BotTurnState } from "./types.js";
import { BOT_SDK_VERSION, BOT_STATE_SCHEMA_VERSION } from "./version.js";

function publicMoves(state: RuleState, side: Side): readonly BotMove[] {
  const profile = state.ruleProfile ?? LEGACY_RULE_PROFILE;
  const effectiveState: RuleState = state.currentTurn === side
    ? { ...state, ruleProfile: profile }
    : { ...state, ruleProfile: profile, currentTurn: side, status: "PLAYING", winner: null, resultReason: null };
  return getBoardCoordinates(profile.board).flatMap((from) => getLegalDestinations(effectiveState, side, from).map((to) => ({ from, to })));
}

export function createBotTurnState(
  state: RuleState,
  side: Side,
  history: readonly BotMoveRecord[],
  clocksMs: Readonly<{ BLUE: number; RED: number }>,
  turnNumber = history.length + 1,
): BotTurnState {
  const profile = state.ruleProfile ?? LEGACY_RULE_PROFILE;
  const board = Object.fromEntries(getBoardCoordinates(profile.board).map((coordinate) => [coordinate, state.board[coordinate] ?? null]));
  const goals = state.progress?.activeGoalBySide ?? {
    BLUE: getActiveGoal(profile, "BLUE"),
    RED: getActiveGoal(profile, "RED"),
  };
  return Object.freeze({
    sdkVersion: BOT_SDK_VERSION,
    schemaVersion: BOT_STATE_SCHEMA_VERSION,
    side,
    board: Object.freeze(board) as RuleState["board"],
    legalMoves: Object.freeze(publicMoves(state, side)),
    dimensions: Object.freeze({ rows: profile.board.rows, cols: profile.board.cols }),
    goals: Object.freeze({ BLUE: goals.BLUE ?? null, RED: goals.RED ?? null }),
    rules: Object.freeze({ version: profile.version, winConditions: Object.freeze([...(profile.winConditions ?? ["EXTINCTION", "GOAL_REACHED"])]) }),
    turnNumber,
    clocksMs: Object.freeze({ BLUE: clocksMs.BLUE, RED: clocksMs.RED }),
    history: Object.freeze(history.map((move) => ({ ...move }))),
  });
}
