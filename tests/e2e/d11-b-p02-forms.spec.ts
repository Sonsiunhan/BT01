import { expect, test, type Page, type Route } from "playwright/test";

const NOW = "2026-10-24T08:00:00.000Z";

function draftDto(id = "draft-001", name = "D11-B Draft") {
  return {
    id,
    contractId: "contract-d11b",
    contractCode: "D11B-CONTRACT",
    unitId: "unit-d11b",
    ownerTaUserId: "ta-d11b",
    status: "DRAFT",
    revision: 1,
    activeConfigVersionId: null,
    activeConfigVersionNumber: 0,
    approvedSnapshot: null,
    everApproved: false,
    quotaRefunded: false,
    coreConfig: {
      tournamentCode: "D11B_DRAFT",
      tournamentName: name,
      shortDescription: "D11-B",
      organizersText: "D11-B Test",
      competitionMode: "HUMAN_ONLINE",
      audienceScope: "INTERNAL_UNIT",
      allowedUnitCodes: ["unit-d11b"],
      registrationIntakeMode: "IMPORT_ONLY",
      maxParticipants: 32,
      minParticipantsToStart: 4,
      timezone: "Asia/Ho_Chi_Minh",
      registrationOpenAt: null,
      registrationCloseAt: null,
      checkinRequired: false,
      checkinOpenAt: null,
      checkinCloseAt: null,
      scheduledStartAt: "2026-10-25T08:00:00.000Z",
      scheduledEndAt: "2026-10-25T18:00:00.000Z",
      format: "ARENA_CONTINUOUS",
      pairingMethod: "SWISS_SCORE_ADJACENT",
      maxMatchesPerPlayer: null,
      maxPairMeetings: 2,
      rematchCooldownMinutes: 5,
      maxConcurrentMatches: 8,
      byeScorePoints: 0,
      spectatorPolicy: "ROSTER_ONLY",
      chatPolicy: "SPECTATOR_MUTED",
      leaderboardVisibility: "LIVE_PUBLIC",
      topNExportCount: 10,
      finalizationMode: "AUTO_FINAL",
      scoringFormulaPreset: "ELO_WEIGHTED_V1",
      initialScore: 1000,
      initialElo: 1000,
      kFactor: 32,
      scoreFloor: 0,
      botDeadlineAt: null,
    },
    ruleProfile: {
      gamePreset: "STANDARD_9X9",
      boardSize: 9,
      rankedMode: "UNRANKED",
      roundTimeLimitSeconds: 60,
      turnTimeLimitSeconds: 15,
      maxTurnsPerGame: 100,
    },
    createdAt: NOW,
    updatedAt: NOW,
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    changesRequestedAt: null,
    lastReviewNote: null,
    lastReviewFieldNotes: {},
    startedAt: null,
    pausedAt: null,
    pauseReason: null,
    endedAt: null,
    cancelledAt: null,
    cancelReason: null,
    finalizedAt: null,
    copiedFromTournamentId: null,
  };
}

async function prepareAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class SilentEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      close() {}
    }
    Object.defineProperty(window, "EventSource", { configurable: true, value: SilentEventSource });
  });

  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "ta-d11b",
          fullName: "D11-B TA",
          displayName: "D11-B TA",
          username: "ta_d11b",
          theme: "system",
          avatarPreset: "robot",
          role: "TOURNAMENT_ADMIN",
          capabilities: ["ADMIN_VIEW", "ADMIN_MANAGE", "tournament.create"],
          privacy: { presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" },
          stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 },
        },
      }),
    });
  });

  await page.route("**/health", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
  });
}

async function openNewWizard(page: Page): Promise<void> {
  await prepareAdmin(page);
  await page.goto("/admin/tournaments/new");
  await expect(page.getByTestId("wizard-name-input")).toBeVisible();
}

async function selectCompetitionMode(page: Page, mode: "HUMAN_ONLINE" | "BOT_VS_BOT"): Promise<void> {
  await page.getByTestId("wizard-step-3-btn").click();
  await page.locator("select:has(option[value='BOT_VS_BOT'])").selectOption(mode);
}

async function setCheckin(page: Page, required: boolean): Promise<void> {
  await page.getByTestId("wizard-step-3-btn").click();
  const checkbox = page.locator("input[type='checkbox']").first();
  if (required) await checkbox.check();
  else await checkbox.uncheck();
}

async function saveNewDraft(page: Page): Promise<void> {
  await page.getByTestId("wizard-step-4-btn").click();
  await page.getByTestId("wizard-save-draft-btn").click();
}

test.describe("D11-B P02 forms, conditional defaults, and recovery", () => {
  test("normalizes hidden conditional fields in the outgoing draft payload", async ({ page }) => {
    const payloads: unknown[] = [];
    await page.route("**/api/tournaments/drafts", async (route: Route) => {
      if (route.request().method() !== "POST") return route.continue();
      payloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ tournament: { id: "server-d11b-001", revision: 1 } }),
      });
    });
    await openNewWizard(page);
    await page.getByTestId("wizard-name-input").fill("D11-B conditional payload");

    await selectCompetitionMode(page, "BOT_VS_BOT");
    await setCheckin(page, true);
    await page.getByTestId("wizard-step-2-btn").click();
    await page.getByTestId("wizard-start-at-input").fill("2026-10-25T08:00");
    await page.getByTestId("wizard-bot-deadline-input").fill("2026-10-24T20:00");
    await page.getByTestId("wizard-checkin-open-input").fill("2026-10-24T18:00");
    await page.getByTestId("wizard-checkin-close-input").fill("2026-10-24T19:00");

    await selectCompetitionMode(page, "HUMAN_ONLINE");
    await setCheckin(page, false);
    await page.getByTestId("wizard-step-1-btn").click();
    await page.locator("select:has(option[value='PUBLIC'])").selectOption("PUBLIC");
    await saveNewDraft(page);

    await expect.poll(() => payloads.length).toBe(1);
    const coreConfig = (payloads[0] as { coreConfig: Record<string, unknown> }).coreConfig;
    expect(coreConfig.competitionMode).toBe("HUMAN_ONLINE");
    expect(coreConfig.botDeadlineAt).toBeNull();
    expect(coreConfig.checkinRequired).toBe(false);
    expect(coreConfig.checkinOpenAt).toBeNull();
    expect(coreConfig.checkinCloseAt).toBeNull();
    expect(coreConfig.audienceScope).toBe("PUBLIC_REGISTERED");
    expect(coreConfig.allowedUnitCodes).toEqual([]);
  });

  test("reproduces UNLISTED visibility being mapped to INTERNAL_UNIT", async ({ page }) => {
    let payload: { coreConfig: Record<string, unknown> } | undefined;
    await page.route("**/api/tournaments/drafts", async (route: Route) => {
      if (route.request().method() !== "POST") return route.continue();
      payload = route.request().postDataJSON() as { coreConfig: Record<string, unknown> };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ tournament: { id: "server-d11b-unlisted", revision: 1 } }),
      });
    });

    await openNewWizard(page);
    await page.getByTestId("wizard-name-input").fill("D11-B unlisted mapping");
    await page.locator("select:has(option[value='UNLISTED'])").selectOption("UNLISTED");
    await saveNewDraft(page);

    await expect.poll(() => payload).toBeDefined();
    expect(payload?.coreConfig.audienceScope).toBe("INTERNAL_UNIT");
    expect(payload?.coreConfig.allowedUnitCodes).toEqual(["unit-fit-vnu"]);
  });

  test("reproduces stale hidden values returning after a mode cycle", async ({ page }) => {
    await openNewWizard(page);
    await selectCompetitionMode(page, "BOT_VS_BOT");
    await page.getByTestId("wizard-step-2-btn").click();
    const deadline = page.getByTestId("wizard-bot-deadline-input");
    await deadline.fill("2026-10-24T20:00");
    const enteredDeadline = await deadline.inputValue();

    await selectCompetitionMode(page, "HUMAN_ONLINE");
    await selectCompetitionMode(page, "BOT_VS_BOT");
    await page.getByTestId("wizard-step-2-btn").click();

    await expect(page.getByTestId("wizard-bot-deadline-input")).toHaveValue(enteredDeadline);
  });

  test("reproduces create-network failure being converted into a mock success", async ({ page }) => {
    await page.route("**/api/tournaments/drafts", (route) => route.abort("failed"));
    await openNewWizard(page);
    await page.getByTestId("wizard-name-input").fill("D11-B network failure");
    await saveNewDraft(page);

    await expect(page).toHaveURL(/\/admin\/tournaments\/draft-/);
    await expect(page.getByTestId("wizard-save-status")).toContainText("r1");
    await expect(page.locator("[role='alert']")).toHaveCount(0);
  });

  test("preserves edits through PATCH conflict and provides reload recovery", async ({ page }) => {
    let conflictTriggered = false;
    await prepareAdmin(page);
    await page.route("**/api/tournaments/edit-draft", async (route) => {
      if (route.request().method() === "GET") {
        const dto = draftDto("edit-draft", conflictTriggered ? "Authoritative latest" : "Original server draft");
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tournament: dto, configVersions: [] }) });
        return;
      }
      conflictTriggered = true;
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "CONFLICT", message: "stale revision" }) });
    });

    await page.goto("/admin/tournaments/edit-draft/edit");
    await expect(page.getByTestId("wizard-name-input")).toHaveValue("Original server draft");

    await page.getByTestId("wizard-name-input").fill("Local edit survives conflict");
    await page.getByTestId("wizard-save-draft-btn").click();
    await expect(page.getByTestId("wizard-conflict-banner")).toBeVisible();
    await expect(page.getByTestId("wizard-name-input")).toHaveValue("Local edit survives conflict");

    await page.getByTestId("wizard-conflict-banner").getByRole("button").first().click();
    await expect(page.getByTestId("wizard-name-input")).toHaveValue("Authoritative latest");
  });

  test("prevents duplicate create submits while the authoritative response is pending", async ({ page }) => {
    let createCount = 0;
    await page.route("**/api/tournaments/drafts", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      createCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ tournament: { id: "server-d11b-double", revision: 1 } }) });
    });

    await openNewWizard(page);
    const save = page.getByTestId("wizard-save-draft-btn");
    await save.click();
    await expect(save).toBeDisabled();
    await save.click({ force: true }).catch(() => undefined);
    await expect.poll(() => createCount).toBe(1);
  });
});
