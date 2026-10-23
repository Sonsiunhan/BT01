import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TournamentWizardPage } from "./TournamentWizardPage";
import type { TournamentApiPort } from "./tournamentApi";
import type { RulePreviewApiPort } from "./rules/rulePreviewApi";
import type { RuleVersionApiPort } from "./rules/ruleVersionApi";

const api = { getDraft: vi.fn(), listTournaments: vi.fn(), createDraft: vi.fn(), patchDraft: vi.fn(), deleteDraft: vi.fn(), getTournamentDetail: vi.fn(), getTournamentReadiness: vi.fn(), openScheduled: vi.fn(), startTournament: vi.fn(), pauseTournament: vi.fn(), resumeTournament: vi.fn() } as unknown as TournamentApiPort;
const validPreview = {
  tournamentId: "tour-1", contractId: "contract-1", expectedConfigRevision: 1, draftRevision: 1,
  schemaVersion: "tournament-rule-profile.v1" as const, engineProfileVersion: "rps-engine-v1", capabilitiesVersion: "rules-preview.v1" as const,
  profileDigest: "a".repeat(64), normalizedProfile: null, valid: true, errors: [], warnings: [],
  checks: { structural: "PASS" as const, initialNonTerminal: "PASS" as const, initialLegalMoves: "PASS" as const, goalReachability: "PASS" as const, runtime: "NOT_CHECKED" as const },
  progress: { acceptedPlies: 0, roundIndex: 0, activeGoalBySide: { BLUE: null, RED: null }, seedContext: null },
  goalReachabilityBySide: { BLUE: [], RED: [] }, legalMovesBySide: { BLUE: [], RED: [] }, runtimeStatus: "NOT_CHECKED" as const,
};

let previewApi: RulePreviewApiPort;
let versionApi: RuleVersionApiPort;

function renderWizard() {
  return render(<MemoryRouter><TournamentWizardPage apiClient={api} initialData={{ tournamentId: "tour-1" }} rulePreviewApi={previewApi} ruleVersionApi={versionApi} /></MemoryRouter>);
}

describe("N07 — RuleEditor in tournament wizard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    previewApi = { preview: vi.fn().mockResolvedValue(validPreview) };
    versionApi = { list: vi.fn().mockResolvedValue({ items: [], nextCursor: null, configRevision: 1 }), diff: vi.fn(), publish: vi.fn() };
  });

  it("gates publish on a valid, current preview and exposes status accessibly", async () => {
    renderWizard();
    fireEvent.click(screen.getByTestId("wizard-step-4-btn"));
    expect(screen.getByTestId("wizard-rule-section")).toBeTruthy();
    expect((screen.getByTestId("wizard-rule-publish-btn") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("wizard-rule-preview-btn"));
    await waitFor(() => expect(screen.getByTestId("wizard-rule-preview-status").textContent).toContain("Hợp lệ"));
    expect(screen.getByTestId("wizard-rule-preview-status").getAttribute("aria-live")).toBe("polite");
    fireEvent.change(screen.getByTestId("wizard-rule-reason-input"), { target: { value: "Cập nhật luật vòng mới" } });
    fireEvent.change(screen.getByTestId("wizard-rule-effective-input"), { target: { value: "2026-11-01T08:00" } });
    expect((screen.getByTestId("wizard-rule-publish-btn") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Số hàng bàn"), { target: { value: "6" } });
    expect(screen.queryByTestId("wizard-rule-preview-status")).toBeNull();
    expect((screen.getByTestId("wizard-rule-publish-btn") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("wizard-rule-publish-message").textContent).toContain("kiểm tra luật lại");
  });

  it("publishes the validated digest, refreshes authoritative revision, and requires a new preview", async () => {
    const publishedVersion = { id: "version-2", tournamentId: "tour-1", versionNumber: 2, profileRef: { draftId: "tour-1", revision: 1 }, profileDigest: "a".repeat(64), reason: "Cập nhật luật vòng mới", effectiveAt: "2026-11-01T01:00:00.000Z", createdAt: "2026-10-22T01:00:00.000Z", immutable: true as const };
    (versionApi.publish as ReturnType<typeof vi.fn>).mockResolvedValue({ outcome: "PUBLISHED", version: publishedVersion });
    (versionApi.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ items: [], nextCursor: null, configRevision: 1 }).mockResolvedValueOnce({ items: [publishedVersion], nextCursor: null, configRevision: 2 });
    renderWizard();
    fireEvent.click(screen.getByTestId("wizard-step-4-btn"));
    fireEvent.click(screen.getByTestId("wizard-rule-preview-btn"));
    await screen.findByText("Hợp lệ");
    fireEvent.change(screen.getByTestId("wizard-rule-reason-input"), { target: { value: "Cập nhật luật vòng mới" } });
    fireEvent.change(screen.getByTestId("wizard-rule-effective-input"), { target: { value: "2026-11-01T08:00" } });
    fireEvent.click(screen.getByTestId("wizard-rule-publish-btn"));
    await waitFor(() => expect(versionApi.publish).toHaveBeenCalledWith("tour-1", expect.objectContaining({ expectedRevision: 1, profileDigest: "a".repeat(64), reason: "Cập nhật luật vòng mới" })));
    await waitFor(() => expect(screen.getByTestId("wizard-rule-publish-message").textContent).toContain("v2"));
    expect(screen.getByText(/DRAFT r2/)).toBeTruthy();
    expect((screen.getByTestId("wizard-rule-publish-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders every diff field with before, after and impact", async () => {
    const version = { id: "version-1", tournamentId: "tour-1", versionNumber: 1, profileRef: { draftId: "tour-1", revision: 1 }, profileDigest: "b".repeat(64), reason: "Bản đầu", effectiveAt: "2026-11-01T01:00:00.000Z", createdAt: "2026-10-22T01:00:00.000Z", immutable: true as const };
    (versionApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [version], nextCursor: null, configRevision: 1 });
    (versionApi.diff as ReturnType<typeof vi.fn>).mockResolvedValue({ baseVersionId: "version-0", targetVersionId: "version-1", sameDigest: false, oldMatchesUnaffected: true, changes: [{ path: "ruleProfile.turnSeconds", before: 30, after: 45, impact: "NEW_MATCHES_ONLY" }] });
    renderWizard();
    fireEvent.click(screen.getByTestId("wizard-step-4-btn"));
    await screen.findByText(/v1/);
    fireEvent.click(screen.getByTestId("wizard-rule-diff-version-1"));
    const panel = await screen.findByTestId("wizard-rule-diff-panel");
    expect(panel.textContent).toContain("ruleProfile.turnSeconds");
    expect(panel.textContent).toContain("30");
    expect(panel.textContent).toContain("45");
    expect(panel.textContent).toContain("Chỉ trận tạo mới");
  });
});
