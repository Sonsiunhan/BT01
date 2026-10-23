import { expect, test } from "playwright/test";

const adminUser = {
  id: "system-admin-1",
  fullName: "Quản trị hệ thống",
  displayName: "System Admin",
  username: "system-admin",
  theme: "dark",
  avatarPreset: "robot",
  privacy: {
    presenceVisibility: "FRIENDS",
    friendListVisibility: "PRIVATE",
    fullNameVisibility: "PRIVATE",
  },
  stats: { elo: 1200, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 },
};

async function mockAdminShell(page: import("playwright/test").Page) {
  await page.route("**/health", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        service: "ottv2-server",
        version: "n11-route-smoke",
        protocolVersion: "0.1",
        timestamp: new Date().toISOString(),
        components: {
          application: { status: "ok" },
          database: { status: "ok" },
          realtime: { status: "ok" },
        },
      }),
    })
  );
  await page.route("**/auth/me", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ user: adminUser }) })
  );
  await page.route("**/api/admin/units", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ units: [] }) })
  );
  await page.route("**/api/admin/contracts**", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ contracts: [] }) })
  );
  await page.route("**/api/admin/approvals**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ initialSubmissions: [], changeRequests: [] }),
    })
  );
}

test.describe("N11 — Long admin routes", () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminShell(page);
  });

  test("P06, P07 and P08 are reachable directly and discoverable from the admin shell", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/admin/units", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: /Quản lý Đơn vị & Tổ chức/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("link", { name: "Đơn vị" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Hợp đồng" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Xét duyệt" })).toBeVisible();

    await page.getByRole("link", { name: "Hợp đồng" }).click();
    await expect(page.getByRole("heading", { name: /Quản lý Hợp đồng, Hạn mức/ })).toBeVisible();

    await page.getByRole("link", { name: "Xét duyệt" }).click();
    await expect(page.getByRole("heading", { name: /Hàng đợi Phê duyệt Giải đấu/ })).toBeVisible();
  });
});
