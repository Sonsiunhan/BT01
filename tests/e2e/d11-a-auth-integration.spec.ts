import { expect, test, type Page } from "playwright/test";

type Credentials = { id: string; username: string; password: string };
type Fixture = {
  admin: Credentials;
  ta: Credentials;
  player: Credentials;
  referee: Credentials;
};

const fixture = JSON.parse(process.env.D11A_FIXTURE_JSON ?? "{}") as Partial<Fixture>;

function requireFixture(): Fixture {
  if (!fixture.admin || !fixture.ta || !fixture.player || !fixture.referee) {
    throw new Error("D11-A fixture is missing; run scripts/d11a-auth-e2e.mjs");
  }
  return fixture as Fixture;
}

async function login(page: Page, account: Credentials): Promise<void> {
  await page.goto("/dang-nhap");
  await page.locator("#login-username").fill(account.username);
  await page.locator("#login-password").fill(account.password);
  await page.locator("form button[type='submit']").click();
  await expect(page).toHaveURL(/\/ho-so/);
}

async function assertAuthenticatedAdminShell(page: Page): Promise<void> {
  await expect(page.getByTestId("admin-shell")).toBeVisible();
  await expect(page.getByTestId("admin-guard-unauthenticated")).toHaveCount(0);
}

test.describe("D11-A authorization and integration reproduction", () => {
  test.describe.configure({ mode: "serial" });

  test("P01: direct admin list route admits every authenticated actor and serves fixture data", async ({ page, browser }) => {
    const data = requireFixture();

    await page.goto("/admin/tournaments");
    await expect(page.getByTestId("admin-guard-unauthenticated")).toBeVisible();
    await expect(page.getByTestId("tournament-list-page")).toHaveCount(0);

    for (const account of [data.player, data.referee, data.ta, data.admin]) {
      const context = await browser.newContext();
      const actorPage = await context.newPage();
      const listApiRequests: string[] = [];
      actorPage.on("request", (request) => {
        if (new URL(request.url()).pathname === "/api/tournaments") {
          listApiRequests.push(request.url());
        }
      });

      await login(actorPage, account);
      await actorPage.goto("/admin/tournaments");
      await assertAuthenticatedAdminShell(actorPage);
      await expect(actorPage.getByTestId("tournament-list-page")).toBeVisible();
      await expect(actorPage.getByTestId("tournament-list-page")).toContainText("Robot Lab");
      expect(listApiRequests, `${account.username} unexpectedly called the authoritative list API`).toEqual([]);

      await context.close();
    }
  });

  test("P03: URL role manipulation does not grant server detail access, while the UI guard still admits the route", async ({ browser }) => {
    const data = requireFixture();

    for (const account of [data.player, data.referee, data.ta, data.admin]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const detailResponses: number[] = [];
      page.on("response", (response) => {
        if (new URL(response.url()).pathname === "/api/tournaments/foreign-id") {
          detailResponses.push(response.status());
        }
      });

      await login(page, account);
      await page.goto("/admin/tournaments/foreign-id?role=SYSTEM_ADMIN");
      await assertAuthenticatedAdminShell(page);
      await expect(page.getByTestId("tournament-detail-error")).toBeVisible();
      expect(detailResponses.some((status) => status >= 400), `${account.username} did not receive a protected detail error`).toBeTruthy();

      await context.close();
    }
  });

  test("P14: direct audit route admits every authenticated actor and serves fixture audit data", async ({ browser }) => {
    const data = requireFixture();

    for (const account of [data.player, data.referee, data.ta, data.admin]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const auditApiRequests: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/api/admin/audit-logs") {
          auditApiRequests.push(request.url());
        }
      });

      await login(page, account);
      await page.goto("/admin/audit");
      await assertAuthenticatedAdminShell(page);
      await expect(page.getByTestId("audit-page-title")).toBeVisible();
      await expect(page.getByText("CREATE_DRAFT", { exact: true })).toBeVisible();
      expect(auditApiRequests, `${account.username} unexpectedly called the authoritative audit API`).toEqual([]);

      await context.close();
    }
  });
});
