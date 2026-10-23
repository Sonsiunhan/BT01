import { expect, test, type Page } from "playwright/test";

type Account = { username: string; password: string };
type Fixture = {
  serverUrl: string;
  webUrl: string;
  admin: Account;
  ta: Account;
  player: Account;
  referee: Account;
};

const fixture = JSON.parse(process.env.D11C_FIXTURE_JSON ?? "{}") as Partial<Fixture>;

function requireFixture(): Fixture {
  if (!fixture.admin || !fixture.ta || !fixture.player || !fixture.referee || !fixture.serverUrl || !fixture.webUrl) {
    throw new Error("D11-C fixture is missing; run scripts/d11c-security-e2e.mjs");
  }
  return fixture as Fixture;
}

async function login(page: Page, account: Account): Promise<void> {
  await page.goto("/dang-nhap");
  await page.locator("#login-username").fill(account.username);
  await page.locator("#login-password").fill(account.password);
  await page.locator("form button[type='submit']").click();
  await expect(page).toHaveURL(/\/ho-so/);
}

async function assertAdminShell(page: Page): Promise<void> {
  await expect(page.getByTestId("admin-shell")).toBeVisible();
  await expect(page.getByTestId("admin-guard-unauthenticated")).toHaveCount(0);
}

test.describe("D11-C P14/P15 security and privacy review", () => {
  test.describe.configure({ mode: "serial" });

  test("P15 real capability denial/network failure is fail-open in the rendered Hub", async ({ page }) => {
    const data = requireFixture();
    await login(page, data.player);
    const capabilityResponse = page.waitForResponse((response) => response.url().includes("/admin/offline/capabilities"));
    await page.goto("/admin/offline");
    await expect(page.getByText("Trung tâm công cụ Offline")).toBeVisible();
    await expect(page.getByRole("link", { name: /Kho Bot/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Truy cập công cụ" })).toHaveCount(4);
    // The frontend currently requests /admin/offline/capabilities, while the
    // authoritative server route is /api/admin/offline/capabilities. The real
    // browser therefore observes a 404/network failure and still receives the
    // permissive fallback UI; the runner separately verifies the real 403 API.
    expect((await capabilityResponse).status()).toBe(404);
  });

  test("P15 unresolved capability loading still exposes protected actions", async ({ page }) => {
    const data = requireFixture();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/admin/offline/capabilities", async (route) => {
      await pending;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          capabilities: { "offline.hub.read": true, "offline.bot.read": true, "offline.practice.humanBot": true, "offline.practice.humanHuman": true },
          runtime: { status: "READY", policy: "NO_SERVER_RUNNER", isolation: "BROWSER_WORKER_CPYTHON" },
          modes: [],
        }),
      });
    });
    await login(page, data.admin);
    await page.goto("/admin/offline");
    await expect(page.getByRole("link", { name: "Truy cập công cụ" })).toHaveCount(4);
    release();
  });

  test("P15 API/network failure renders READY fallback and Bot error has no Retry action", async ({ page }) => {
    const data = requireFixture();
    await page.route("**/admin/offline/capabilities", async (route) => {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "synthetic outage" }) });
    });
    await login(page, data.admin);
    await page.goto("/admin/offline");
    await expect(page.getByText("Trung tâm công cụ Offline")).toBeVisible();
    await expect(page.getByText(/sẵn sàng|READY/i).first()).toBeVisible();

    await page.unroute("**/admin/offline/capabilities");
    await page.route("**/api/bot-library", async (route) => {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "synthetic bot outage" }) });
    });
    await page.goto("/admin/offline/bots");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: /Thử lại|Retry/i })).toHaveCount(0);
  });

  test("P15 direct Admin routes are admitted to every authenticated account, while Guest is denied by the shell", async ({ browser }) => {
    const data = requireFixture();
    const actors: Array<[string, Account]> = [
      ["SYSTEM_ADMIN", data.admin],
      ["TOURNAMENT_ADMIN", data.ta],
      ["PLAYER", data.player],
      ["REFEREE", data.referee],
    ];
    const routes = [
      ["/admin/offline", /Trung tâm công cụ Offline/],
      ["/admin/offline/bots", /Kho Bot của tôi/],
      ["/admin/offline/practice/human-bot", /Phòng tập Người – Bot/],
      ["/admin/offline/practice/human-human", /Phòng tập Người – Người/],
    ] as const;

    for (const [label, account] of actors) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, account);
      for (const [path, heading] of routes) {
        await page.goto(path);
        await assertAdminShell(page);
        await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      }
      await context.close();
      test.info().annotations.push({ type: "actor", description: `${label}: admitted to all P15 Admin routes` });
    }

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto("/admin/offline");
    await expect(guestPage.getByTestId("admin-guard-unauthenticated")).toBeVisible();
    await guestContext.close();
  });
});
