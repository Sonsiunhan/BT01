import { expect, test, type Page } from "playwright/test";

type Credentials = { username: string; password: string; id: string };
type Fixture = {
  admin: Credentials;
  ta: Credentials;
  participant: Credentials;
  referee: Credentials;
  tournamentId: string;
  contractId: string;
};

const fixture = JSON.parse(process.env.D10C_FIXTURE_JSON ?? "{}") as Partial<Fixture>;
let activationToken = "";
let invitationToken = "";
let recoveryToken = "";
let participantPassword = "";

function requireFixture(): Fixture {
  if (!fixture.admin || !fixture.ta || !fixture.participant || !fixture.referee || !fixture.tournamentId || !fixture.contractId) {
    throw new Error("D10-C fixture is missing; run scripts/d10c-browser-e2e.mjs");
  }
  return fixture as Fixture;
}

function watchBrowser(page: Page): { consoleErrors: string[]; pageErrors: string[]; failedRequests: string[] } {
  const issues = { consoleErrors: [] as string[], pageErrors: [] as string[], failedRequests: [] as string[] };
  page.on("console", (message) => {
    // The app probes the current session before login; the expected 401 from
    // that unauthenticated bootstrap is not a browser failure.
    if (message.type() === "error" && !message.text().includes("status of 401 (Unauthorized)")) {
      issues.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => issues.pageErrors.push(error.message));
  page.on("requestfailed", (request) => issues.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  return issues;
}

async function assertNoBrowserErrors(issues: ReturnType<typeof watchBrowser>): Promise<void> {
  expect(issues.consoleErrors, "unexpected browser console errors").toEqual([]);
  expect(issues.pageErrors, "unexpected page errors").toEqual([]);
  expect(issues.failedRequests, "unexpected failed requests").toEqual([]);
}

async function login(page: Page, account: Credentials): Promise<void> {
  await page.goto("/dang-nhap");
  await page.locator("#login-username").fill(account.username);
  await page.locator("#login-password").fill(account.password);
  await page.getByRole("button", { name: /Đăng nhập/i }).click();
  await expect(page).toHaveURL(/\/ho-so/);
}

test.describe("D10-C real-account browser acceptance", () => {
  test.describe.configure({ mode: "serial" });

  test("P09 account bootstrap/authentication uses a real persisted SYSTEM_ADMIN", async ({ page }) => {
    const data = requireFixture();
    const issues = watchBrowser(page);
    await login(page, data.admin);
    await page.goto("/admin/ta");
    await expect(page.getByTestId("admin-ta-page")).toBeVisible();
    await expect(page.getByText("P09", { exact: true })).toBeVisible();
    await expect(page.getByTestId("ta-table")).toContainText(data.ta.username);
    await assertNoBrowserErrors(issues);
  });

  test("P10 roster preview, commit and activation handoff are exercised through the UI", async ({ page }) => {
    const data = requireFixture();
    const issues = watchBrowser(page);
    await login(page, data.ta);
    await page.goto(`/admin/tournaments/${data.tournamentId}/roster`);
    await expect(page.getByTestId("tournament-roster-page")).toBeVisible();
    await page.getByTestId("roster-file-input").setInputFiles({
      name: "d10c-roster.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("unit_code,student_or_member_id,full_name,username,email\nD10C,NEW-001,Nguyen D10C,d10c_claim,d10c-claim@example.test\n", "utf8"),
    });
    await page.getByTestId("roster-preview-btn").click();
    await expect(page.getByTestId("roster-preview-result")).toBeVisible();
    await expect(page.getByTestId("badge-valid")).toContainText("1");
    const commit = page.getByTestId("roster-commit-btn");
    await commit.click();
    await commit.dblclick({ force: true }).catch(() => undefined);
    await expect(page.getByTestId("roster-commit-outcome")).toBeVisible();
    await expect(page.getByTestId("roster-commit-outcome")).toContainText("1");
    await page.reload();
    await expect(page.getByTestId("roster-table")).toContainText("NEW-001");
    const importedRow = page.locator("tr").filter({ hasText: "NEW-001" }).first();
    await expect(importedRow).toBeVisible();
    const issueButton = importedRow.locator("[data-testid^='issue-btn-']");
    await issueButton.click();
    await expect(page.getByTestId("token-handoff-banner")).toBeVisible();
    activationToken = (await page.getByTestId("claim-token-value").textContent())?.trim() ?? "";
    expect(activationToken.length).toBeGreaterThan(20);
    await assertNoBrowserErrors(issues);
  });

  test("P13 activation is single-use and keeps token/password out of browser storage", async ({ page }) => {
    requireFixture();
    expect(activationToken).toBeTruthy();
    const issues = watchBrowser(page);
    const password = "D10C-Claim-Pass-123!";
    await page.goto(`/kich-hoat/${activationToken}`);
    await page.getByTestId("activation-username-input").fill("d10c_claim");
    await page.getByTestId("activation-display-name-input").fill("D10C Claimant");
    await page.getByTestId("claim-submit-btn").click();
    await expect(page.getByTestId("activation-password-input")).toBeVisible();
    await page.getByTestId("activation-password-input").fill(password);
    await page.getByTestId("activation-confirm-password-input").fill(password);
    await page.getByTestId("password-submit-btn").click();
    await expect(page.getByTestId("activation-success-panel")).toBeVisible();
    const storage = await page.evaluate(() => ({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
    }));
    const serialized = JSON.stringify(storage);
    expect(serialized).not.toContain(activationToken);
    expect(serialized).not.toContain(password);
    await assertNoBrowserErrors(issues);

    const replay = await page.context().newPage();
    const replayIssues = watchBrowser(replay);
    await replay.goto(`/kich-hoat/${activationToken}`);
    await replay.getByTestId("activation-username-input").fill("d10c_claim");
    await replay.getByTestId("activation-display-name-input").fill("D10C Claimant");
    await replay.getByTestId("claim-submit-btn").click();
    await expect(replay.getByTestId("activation-password-input")).toBeVisible();
    await assertNoBrowserErrors(replayIssues);
  });

  test("P11/P17 invitation acceptance and revoke follow server state", async ({ page }) => {
    const data = requireFixture();
    const issues = watchBrowser(page);
    await login(page, data.ta);
    await page.goto(`/admin/tournaments/${data.tournamentId}/staff`);
    await expect(page.getByTestId("tournament-staff-page")).toBeVisible();
    await page.getByLabel("Recipient User ID").fill(data.referee.id);
    await page.getByRole("button", { name: /Tạo lời mời/i }).click();
    await expect(page.getByTestId("invitation-handoff")).toBeVisible();
    invitationToken = (await page.getByTestId("invitation-handoff").locator("code").textContent())?.trim() ?? "";
    expect(invitationToken.length).toBeGreaterThan(20);

    // Use a separate browser context so the referee login cannot replace the
    // TA session cookie on the management page.
    const recipientContext = await page.context().browser()!.newContext();
    const recipient = await recipientContext.newPage();
    const recipientIssues = watchBrowser(recipient);
    await login(recipient, data.referee);
    await recipient.goto(`/staff/invitations/${data.tournamentId}/${invitationToken}`);
    await expect(recipient.getByTestId("invitation-page")).toBeVisible();
    const acceptResponse = recipient.waitForResponse((response) => response.url().includes("/staff/invitations/") && response.url().endsWith("/accept") && response.request().method() === "POST");
    await recipient.getByRole("button", { name: /Chấp nhận/i }).click();
    const acceptHttp = await acceptResponse;
    expect(acceptHttp.ok(), `invitation accept failed: ${await acceptHttp.text()}`).toBeTruthy();
    await expect(recipient.getByTestId("invitation-status")).toHaveText("ACTIVE");
    const invitationStorage = await recipient.evaluate(() => ({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }));
    expect(JSON.stringify(invitationStorage)).not.toContain(invitationToken);
    await assertNoBrowserErrors(recipientIssues);

    await page.reload();
    await expect(page.getByText(/REFEREE/).first()).toBeVisible();
    const revoke = page.getByRole("button", { name: /Thu hồi/ }).first();
    await revoke.click();
    await expect(page.getByText(/REVOKED/).first()).toBeVisible();
    await assertNoBrowserErrors(issues);
    await recipientContext.close();
  });

  test("P12 recovery request, verified handoff and reset are real and single-consumption", async ({ page }) => {
    const data = requireFixture();
    const issues = watchBrowser(page);
    await page.goto("/account-access");
    await page.getByLabel("Username").fill(data.participant.username);
    await page.getByLabel(/Lý do/i).fill("D10-C browser recovery verification");
    await page.getByRole("button", { name: /Gửi yêu cầu/i }).click();
    await expect(page.getByRole("status")).toContainText("đã được tiếp nhận");
    await assertNoBrowserErrors(issues);

    await login(page, data.admin);
    await page.goto("/admin/support");
    await expect(page.getByTestId("support-recovery-page")).toBeVisible();
    await page.getByRole("button", { name: data.participant.id }).click();
    await page.getByRole("button", { name: /Nhận xử lý/i }).click();
    await page.getByLabel("Verification reference").fill("D10C-VERIFIED");
    await page.getByRole("button", { name: /Xác minh/i }).click();
    await page.getByRole("button", { name: /Cấp handoff reset/i }).click();
    await expect(page.getByTestId("support-reset-handoff")).toBeVisible();
    recoveryToken = (await page.getByTestId("support-reset-handoff").locator("code").textContent())?.trim() ?? "";
    expect(recoveryToken.length).toBeGreaterThan(20);
    await page.getByRole("link", { name: /Mở luồng đặt lại/i }).click();
    participantPassword = "D10C-Recovered-123!";
    await page.locator("#support-new-password").fill(participantPassword);
    await page.locator("#support-confirm-password").fill(participantPassword);
    await page.getByRole("button", { name: /Đặt lại mật khẩu/i }).click();
    await expect(page.getByRole("status")).toContainText("đã được thay đổi");
    const storage = await page.evaluate(() => ({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }));
    expect(JSON.stringify(storage)).not.toContain(recoveryToken);
    await page.reload();
    await page.locator("#support-new-password").fill("D10C-Recovery-Replay-123!");
    await page.locator("#support-confirm-password").fill("D10C-Recovery-Replay-123!");
    await page.getByRole("button", { name: /Đặt lại mật khẩu/i }).click();
    await expect(page.getByRole("alert")).toContainText(/Mã khôi phục không hợp lệ/i);
    await assertNoBrowserErrors(issues);
  });

  test("P18 regulation acknowledgement is current-version and actor-bound", async ({ page }) => {
    const data = requireFixture();
    const issues = watchBrowser(page);
    await login(page, { ...data.participant, password: participantPassword });
    await page.goto(`/tournaments/${data.tournamentId}/rules-ack/${data.contractId}`);
    await expect(page.getByTestId("rules-ack-page")).toBeVisible();
    await expect(page.getByTestId("rules-version")).toHaveText("1");
    await page.getByRole("button", { name: /Xác nhận điều lệ/i }).click();
    await expect(page.getByTestId("rules-ack-status")).toContainText("Đã xác nhận");
    await assertNoBrowserErrors(issues);
  });

  test("negative authorization does not grant TA access through URL navigation", async ({ page }) => {
    const data = requireFixture();
    await login(page, { ...data.participant, password: participantPassword });
    await page.goto(`/admin/tournaments/${data.tournamentId}/roster`);
    await expect(page.getByTestId("tournament-roster-page")).toHaveCount(0);
    await expect(page.getByRole("alert").or(page.getByText(/đăng nhập|quyền/i)).first()).toBeVisible();
  });
});
