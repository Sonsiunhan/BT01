import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

const now = "2026-10-23T08:00:00.000Z";
const target = { targetContextRef: "brt_aaaaaaaaaaaaaaaaaaaaaaaa", configVersionNumber: 2, ruleVersion: "rps-v1", sdkVersion: "bot-sdk-v1", schemaVersion: "bot-state-v1", runtimeProfile: "WASMTIME_SUPERVISOR", policyVersion: "policy-v1", sourceDigestPrefix: "aaaaaaaaaaaa" };
const readyReceipt = { receiptId: "11111111-1111-4111-8111-111111111111", outcome: "ACCEPTED", code: "READY", completedAt: now, safeMessage: "Bot đã sẵn sàng." };

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    tournamentId: "t-1", applicable: true, notApplicableMessage: null,
    items: [{ enrollmentId: "e-1", tournamentId: "t-1", personKey: "SV001", displayName: "Nguyễn An", status: "READY", revision: 3, botId: "bot-1", revisionId: "rev-1", revisionNumber: 4, target, receipt: readyReceipt, safeReason: "READY", retryable: false, retryAfterMs: null, permittedActions: { canSelect: false, canRecheck: true }, updatedAt: now }],
    nextCursor: null, evaluatedAt: now, ...overrides,
  };
}

function job(state: "QUEUED" | "CHECKING" | "SUCCEEDED" = "SUCCEEDED") {
  return { jobId: "22222222-2222-4222-8222-222222222222", tournamentId: "t-1", enrollmentId: "e-1", targetContextRef: target.targetContextRef, state, status: state === "SUCCEEDED" ? "READY" : state, retryable: false, retryAfterMs: null, safeReason: state === "SUCCEEDED" ? "READY" : state === "CHECKING" ? "CHECKING" : "CHECK_QUEUED", receipt: state === "SUCCEEDED" ? readyReceipt : null, createdAt: now, updatedAt: now, completedAt: state === "SUCCEEDED" ? now : null };
}

async function prepareAdmin(page: Page) {
  await page.route("**/auth/me", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "ta-1", fullName: "Tournament Admin", displayName: "Tournament Admin", username: "ta", theme: "system", avatarPreset: "robot", privacy: { presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" }, stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 } } }) }));
  await page.route("**/health", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", service: "ottv2-server", version: "n08-test", protocolVersion: "0.1", timestamp: now, components: { application: { status: "ok" }, database: { status: "ok" }, realtime: { status: "ok" } } }) }));
}

test.describe("N08 P16 Bot readiness browser gate", () => {
  test("renders the authoritative table at mobile/tablet/desktop widths and has no serious axe violations", async ({ page }) => {
    await prepareAdmin(page);
    await page.route("**/api/tournaments/t-1/bot-readiness**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ snapshot: snapshot() }) }));

    for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/admin/tournaments/t-1/bot-readiness");
      await expect(page.getByRole("heading", { name: "Danh sách readiness" })).toBeVisible();
      await expect(page.getByText("Nguyễn An")).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        offenders: [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((element) => element.scrollWidth > document.documentElement.clientWidth)
          .slice(0, 8)
          .map((element) => ({ tag: element.tagName, className: element.className, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })),
      }));
      expect(dimensions.scrollWidth <= dimensions.clientWidth, JSON.stringify({ viewport, dimensions })).toBe(true);
    }

    const results = await new AxeBuilder({ page }).include(".bot-readiness-page").withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join(", ")).toEqual([]);
  });

  test("lets a Tournament Admin recheck a row and follows the job to a safe terminal receipt", async ({ page }) => {
    await prepareAdmin(page);
    let refreshCount = 0;
    await page.route("**/api/tournaments/t-1/bot-readiness**", async (route) => {
      if (route.request().method() === "GET") {
        refreshCount += 1;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ snapshot: snapshot(refreshCount > 1 ? { items: [{ ...snapshot().items[0], receipt: { ...readyReceipt, safeMessage: "Đã kiểm tra lại thành công." } }] } : {}) }) });
        return;
      }
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ item: snapshot().items[0], job: job("QUEUED"), idempotent: false }) });
    });
    await page.route("**/api/tournaments/t-1/bot-readiness/rechecks", async (route) => route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ item: snapshot().items[0], job: job("QUEUED"), idempotent: false }) }));
    await page.route("**/api/tournaments/t-1/bot-readiness/jobs/22222222-2222-4222-8222-222222222222", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ job: job("SUCCEEDED") }) }));

    await page.goto("/admin/tournaments/t-1/bot-readiness");
    await page.getByRole("button", { name: "Kiểm tra lại" }).click();
    await expect(page.getByText("Đã kiểm tra lại thành công.")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("heading", { name: "Danh sách readiness" })).toBeFocused();
  });

  test("renders a safe forbidden state", async ({ page }) => {
    await prepareAdmin(page);
    await page.route("**/api/tournaments/t-1/bot-readiness**", async (route) => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "Không có quyền" }) }));
    await page.goto("/admin/tournaments/t-1/bot-readiness");
    const heading = page.getByRole("heading", { name: "Không có quyền truy cập" });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
  });
});
