import type {
  RulePreviewIssue,
  TournamentEngineRuleProfile,
  TournamentRuleGoalProfile,
  TournamentRuleMovementPattern,
  TournamentRulePreviewRequest,
  TournamentRuleProfileWidget,
} from "@ottv2/contracts";

export type RuleEditorValue = TournamentRuleProfileWidget;
export type RuleEditorProfile = TournamentEngineRuleProfile;
export type RuleEditorSide = "BLUE" | "RED";
export type RuleEditorPieceType = "R" | "P" | "S";
export type RuleEditorGoalProfile = TournamentRuleGoalProfile;
export type RuleEditorMovementPattern = TournamentRuleMovementPattern;

/** A field-addressable error seam for the wizard and the server preview response. */
export type RuleEditorError = Pick<RulePreviewIssue, "path" | "message"> & {
  code?: RulePreviewIssue["code"] | "LOCAL_VALIDATION";
};

export interface RuleEditorProps {
  value: RuleEditorValue;
  onChange: (value: RuleEditorValue) => void;
  errors?: readonly RuleEditorError[];
  previewRequest?: TournamentRulePreviewRequest | null;
  onPreviewRequestChange?: (request: TournamentRulePreviewRequest) => void;
  disabled?: boolean;
}

export type RuleEditorPreviewRequest = TournamentRulePreviewRequest;

export function createRulePreviewRequest(
  value: RuleEditorValue,
  expectedConfigRevision: number,
  draftRevision: number,
): RuleEditorPreviewRequest {
  return {
    expectedConfigRevision,
    draftRevision,
    profile: structuredClone(value),
  };
}
