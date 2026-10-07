import type { MatchPauseCategory } from "@ottv2/contracts";

export type RefereePauseCategory = MatchPauseCategory;

export const refereePauseCategoryLabels: Record<RefereePauseCategory, string> = {
  TECHNICAL_ISSUE: "Sự cố kỹ thuật",
  RULE_QUESTION: "Thắc mắc luật",
  OTHER: "Lý do khác",
};

export function pauseCategoryLabel(category: RefereePauseCategory): string { return refereePauseCategoryLabels[category]; }
