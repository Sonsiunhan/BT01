import { expect, test, type Page } from "playwright/test";

type Account = { username: string; password: string };
type Fixture = { serverUrl: string; webUrl: string; taA: Account; viewer: Account; tournamentA: string; tournamentB: string };
const fixture = JSON.parse(process.env.D12A_FIXTURE_JSON ?? "{}") as Partial<Fixture>;

function data(): Fixture {
  if (!fixture.taA || !fixture.viewer || !fixture.serverUrl || !fixture.webUrl || !fixture.tournamentA || !fixture.tournamentB) throw new Error("D12-A browser fixture is missing");
  return fixture as Fixture;
}

async function login(page: Page, account: Account): Promise<void> {
  await page.goto("/dang-nhap");
  await page.locator("#login-username").fill(account.username);
  await page.locator("#login-password").fill(account.password);
  await page.locator("form button[type='submit']").click();
  await expect(page).toHaveURL(/\/ho-so/);
}

test.describe("D12-A permission and secret boundary browser checks", () => {
  test.describe.configure({ mode: "serial" });

  test("normal account cannot obtain P10 admin access by direct URL", async ({ page }) => {
    const d = data();
    await login(page, d.viewer);
    const response = page.waitForResponse((candidate) => candidate.request().resourceType() === "fetch" && new URL(candidate.url()).pathname.endsWith(`/admin/tournaments/${d.tournamentA}/roster`));
    await page.goto(`/admin/tournaments/${d.tournamentA}/roster`);
    expect((await response).status()).toBe(403);
    // The API denies data access, but the current route still renders the
    // administrative shell. The runner records that as D12-F02.
    await expect(page.getByTestId("tournament-roster-page")).toBeVisible();
    test.info().annotations.push({ type: "D12-A", description: "P10 shell rendered after normal-user API 403; no roster data assertion passed" });
  });

  test("TA direct foreign P10 navigation records the current authorization result", async ({ page }) => {
    const d = data();
    await login(page, d.taA);
    const response = page.waitForResponse((candidate) => candidate.request().resourceType() === "fetch" && new URL(candidate.url()).pathname.endsWith(`/admin/tournaments/${d.tournamentB}/roster`));
    await page.goto(`/admin/tournaments/${d.tournamentB}/roster`);
    const rosterResponse = await response;
    // D12-A evidence deliberately records the currently observed result. A
    // 200 here is a finding, not a reason to patch production in this review.
    expect([200, 403, 404]).toContain(rosterResponse.status());
    if (rosterResponse.status() === 200) await expect(page.getByText("D12_FOREIGN_ROSTER_SENTINEL")).toBeVisible();
    test.info().annotations.push({ type: "D12-A", description: `P10 foreign direct-ID response: ${rosterResponse.status()}` });
  });
});
