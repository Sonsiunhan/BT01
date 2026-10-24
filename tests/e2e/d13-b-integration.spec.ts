import { expect, test, type Page } from "playwright/test";

type Account = { id: string; username: string; password: string };
type Fixture = {
  serverUrl: string;
  webUrl: string;
  admin: Account;
  taA: Account;
  viewer: Account;
  wrongRecipient: Account;
  browserUser: Account;
  tournamentA: string;
  tournamentA2: string;
  tournamentB: string;
  contractA: string;
};

const fixture = JSON.parse(process.env.D13B_FIXTURE_JSON ?? "{}") as Partial<Fixture>;
let browserUserPassword = "";

function data(): Fixture {
  if (!fixture.admin || !fixture.taA || !fixture.viewer || !fixture.wrongRecipient || !fixture.browserUser || !fixture.tournamentA || !fixture.tournamentA2 || !fixture.tournamentB || !fixture.contractA) {
    throw new Error("D13-B browser fixture is incomplete");
  }
  browserUserPassword ||= fixture.browserUser.password;
  return fixture as Fixture;
}

async function login(page: Page, account: Account): Promise<void> {
  await page.goto("/dang-nhap");
  await page.locator("#login-username").fill(account.username);
  await page.locator("#login-password").fill(account.password);
  await page.locator("form button[type='submit']").click();
  await expect(page).toHaveURL(/\/ho-so/);
}

test.describe("D13-B real frontend, Fastify and PostgreSQL integration", () => {
  test.describe.configure({ mode: "serial" });

  test("P09 system administrator sees the persisted TA administration page", async ({ page }) => {
    const d = data();
    await login(page, d.admin);
    await page.goto("/admin/ta");
    await expect(page.getByTestId("admin-ta-page")).toBeVisible();
    await expect(page.getByTestId("ta-table")).toContainText(d.taA.username);
  });

  test("P10 allows own roster, denies foreign direct-ID and preserves D12-F02 server denial", async ({ page, browser }) => {
    const d = data();
    await login(page, d.taA);

    const ownResponse = page.waitForResponse((response) => response.request().resourceType() === "fetch" && response.request().method() === "GET" && new URL(response.url()).pathname.endsWith(`/admin/tournaments/${d.tournamentA}/roster`));
    await page.goto(`/admin/tournaments/${d.tournamentA}/roster`);
    expect((await ownResponse).status()).toBe(200);
    await expect(page.getByTestId("tournament-roster-page")).toBeVisible();
    await expect(page.getByTestId("roster-table")).toContainText("D12-A participant");

    const foreignResponse = page.waitForResponse((response) => response.request().resourceType() === "fetch" && response.request().method() === "GET" && new URL(response.url()).pathname.endsWith(`/admin/tournaments/${d.tournamentB}/roster`));
    await page.goto(`/admin/tournaments/${d.tournamentB}/roster`);
    expect((await foreignResponse).status()).toBe(403);
    await expect(page.getByText("D12_FOREIGN_ROSTER_SENTINEL")).toHaveCount(0);

    const normalContext = await browser.newContext();
    const normalUserPage = await normalContext.newPage();
    await login(normalUserPage, d.browserUser);
    const normalResponse = normalUserPage.waitForResponse((response) => response.request().resourceType() === "fetch" && response.request().method() === "GET" && new URL(response.url()).pathname.endsWith(`/admin/tournaments/${d.tournamentA}/roster`));
    await normalUserPage.goto(`/admin/tournaments/${d.tournamentA}/roster`);
    expect((await normalResponse).status()).toBe(403);
    // Preserve the known UI-shell finding: the API is authoritative but Sơn's
    // route guard remains an explicit handoff, not a Đức-owned backend gap.
    await expect(normalUserPage.getByTestId("tournament-roster-page")).toBeVisible();
    await normalContext.close();
  });

  test("P11/P17 authorized invite, recipient acceptance and browser-storage boundary", async ({ page, browser }) => {
    const d = data();
    await login(page, d.taA);
    await page.goto(`/admin/tournaments/${d.tournamentA}/staff`);
    await expect(page.getByTestId("tournament-staff-page")).toBeVisible();
    await page.getByLabel("Recipient User ID").fill(d.wrongRecipient.id);
    await page.getByRole("button", { name: /Tạo lời mời/i }).click();
    await expect(page.getByTestId("invitation-handoff")).toBeVisible();
    const invitationToken = (await page.getByTestId("invitation-handoff").locator("code").textContent())?.trim() ?? "";
    expect(invitationToken.length).toBeGreaterThan(20);

    const recipientContext = await browser.newContext();
    const recipientPage = await recipientContext.newPage();
    await login(recipientPage, d.wrongRecipient);
    await recipientPage.goto(`/staff/invitations/${d.tournamentA}/${invitationToken}`);
    await expect(recipientPage.getByTestId("invitation-page")).toBeVisible();
    const acceptedResponse = recipientPage.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/staff/invitations/") && response.url().endsWith("/accept"));
    await recipientPage.getByRole("button", { name: /Chấp nhận/i }).click();
    expect((await acceptedResponse).status()).toBe(200);
    await expect(recipientPage.getByTestId("invitation-status")).toHaveText("ACTIVE");
    const storage = await recipientPage.evaluate(() => JSON.stringify({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }));
    expect(storage).not.toContain(invitationToken);
    await recipientContext.close();
  });

  test("P12 recovery request, verified handoff and reset are single-use", async ({ page }) => {
    const d = data();
    await page.goto("/account-access");
    await page.getByLabel("Username").fill(d.browserUser.username);
    await page.getByLabel(/Lý do/i).fill("D13-B browser recovery verification");
    await page.getByRole("button", { name: /Gửi yêu cầu/i }).click();
    await expect(page.getByRole("status").first()).toBeVisible();

    await login(page, d.admin);
    await page.goto("/admin/support");
    await expect(page.getByTestId("support-recovery-page")).toBeVisible();
    await page.getByRole("button", { name: d.browserUser.id }).click();
    await page.getByRole("button", { name: /Nhận xử lý/i }).click();
    await page.getByLabel("Verification reference").fill("D13B-VERIFIED");
    await page.getByRole("button", { name: /Xác minh/i }).click();
    await page.getByRole("button", { name: /Cấp handoff reset/i }).click();
    await expect(page.getByTestId("support-reset-handoff")).toBeVisible();
    const recoveryToken = (await page.getByTestId("support-reset-handoff").locator("code").textContent())?.trim() ?? "";
    expect(recoveryToken.length).toBeGreaterThan(20);
    await page.getByRole("link", { name: /Mở luồng đặt lại/i }).click();

    browserUserPassword = "D13B-Recovered-Password-123!";
    await page.locator("#support-new-password").fill(browserUserPassword);
    await page.locator("#support-confirm-password").fill(browserUserPassword);
    await page.getByRole("button", { name: /Đặt lại mật khẩu/i }).click();
    await expect(page.getByRole("status")).toBeVisible();
    const storage = await page.evaluate(() => JSON.stringify({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }));
    expect(storage).not.toContain(recoveryToken);
    await page.reload();
    await page.locator("#support-new-password").fill("D13B-Replay-Password-123!");
    await page.locator("#support-confirm-password").fill("D13B-Replay-Password-123!");
    await page.getByRole("button", { name: /Đặt lại mật khẩu/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("P13 activation claim succeeds through the real UI without browser-storage token persistence", async ({ page }) => {
    const d = data();
    await login(page, d.taA);
    await page.goto(`/admin/tournaments/${d.tournamentA2}/roster`);
    await expect(page.getByTestId("tournament-roster-page")).toBeVisible();
    const row = page.locator("tr").filter({ hasText: "D12-A Browser Activation" }).first();
    await expect(row).toBeVisible();
    await row.locator("[data-testid^='issue-btn-']").click();
    await expect(page.getByTestId("token-handoff-banner")).toBeVisible();
    const claimToken = (await page.getByTestId("claim-token-value").textContent())?.trim() ?? "";
    expect(claimToken.length).toBeGreaterThan(20);
    await page.goto(`/kich-hoat/${claimToken}`);
    await page.getByTestId("activation-username-input").fill("d13b_browser_claim");
    await page.getByTestId("activation-display-name-input").fill("D13-B Browser Claim");
    await page.getByTestId("claim-submit-btn").click();
    await expect(page.getByTestId("activation-password-input")).toBeVisible();
    const password = "D13B-Activation-Password-123!";
    await page.getByTestId("activation-password-input").fill(password);
    await page.getByTestId("activation-confirm-password-input").fill(password);
    await page.getByTestId("password-submit-btn").click();
    await expect(page.getByTestId("activation-success-panel")).toBeVisible();
    const storage = await page.evaluate(() => JSON.stringify({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }));
    expect(storage).not.toContain(claimToken);
    expect(storage).not.toContain(password);
  });

  test("P18 browser account acknowledges the current regulation version", async ({ page }) => {
    const d = data();
    await login(page, { ...d.browserUser, password: browserUserPassword });
    await page.goto(`/tournaments/${d.tournamentA}/rules-ack/${d.contractA}`);
    await expect(page.getByTestId("rules-ack-page")).toBeVisible();
    await expect(page.getByTestId("rules-version")).toHaveText("1");
    await page.getByRole("button", { name: /Xác nhận điều lệ/i }).click();
    await expect(page.getByTestId("rules-ack-status")).toContainText("Đã xác nhận");
  });
});
