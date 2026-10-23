import React from "react";
import { TournamentWizardPage } from "./TournamentWizardPage";

/**
 * P04 entry point. It opens the shared RuleEditor V1 integration directly on
 * the rule step so P02 and P04 use one controlled component and one publish flow.
 */
export default function TournamentRulesPage() {
  return <TournamentWizardPage initialStep={4} />;
}

