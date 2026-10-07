import { expect, test } from "playwright/test";

const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
const revision = { id: "r9-revision", revisionNumber: 1, status: "PASSED", sdkVersion: "0.1.0", schemaVersion: "1", sourceDigest: "a".repeat(64), sourceBytes: source.length, createdAt: "2026-10-04T01:00:00.000Z", updatedAt: "2026-10-04T01:00:00.000Z", memoryPolicy: "RESET_ON_NEW_REVISION", availability: ["ONLINE", "OFFLINE"] };
const bot = { id: "r9-bot", name: "Bot xanh", createdAt: revision.createdAt, updatedAt: revision.updatedAt, usedBytes: revision.sourceBytes, revisions: [revision] };

test("R9 Workbench keeps library, upload and private inspector regions explicit", async ({ page }) => {
  await page.route("**/auth/me", async (route) => route.fulfill({ status: 200, json: { user: { id: "r9-owner", username: "r9_owner", displayName: "Minh", theme: "dark", avatarPreset: "robot", stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 } } } }));
  await page.route("http://localhost:3001/bot-library", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bots: [bot], quotaBytes: 262144, usedBytes: revision.sourceBytes }) }));
  await page.route("http://localhost:3001/bot-library/sdk", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sdkVersion: "0.1.0", schemaVersion: "1", allowlist: ["math", "json"], template: source, limits: { sourceBytes: 65536, memoryBytes: 8192, perTurnMs: 500, wholeMatchMs: 30000 } }) }));
  await page.route("http://localhost:3001/bot-library/bots/r9-bot/revisions/r9-revision/source", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ botId: "r9-bot", revisionId: "r9-revision", source }) }));
  await page.goto("/bot-lab");
  await expect(page.getByRole("heading", { name: "Workbench chiến thuật" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Danh sách bot" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Nạp chiến thuật" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Kiểm tra và nhật ký riêng" })).toBeVisible();
  await expect(page.getByText("Chỉ chủ sở hữu mới xem được mã nguồn.")).toHaveCount(0);
  await page.getByRole("button", { name: "Xem mã nguồn" }).click();
  await expect(page.getByText("Chỉ chủ sở hữu mới xem được mã nguồn.")).toBeVisible();
  await expect(page.locator("pre")).toContainText("choose_move");
  await page.getByRole("button", { name: "Dùng Online" }).click();
  await expect(page).toHaveURL(/\/dau-chuong-trinh\/online\?botId=r9-bot&revisionId=r9-revision$/);
  await expect(page.getByRole("heading", { name: "Chuẩn bị Bot Online" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Bot", exact: true })).toHaveValue("r9-bot");
  await expect(page.getByRole("combobox", { name: "Revision", exact: true })).toHaveValue("r9-revision");
  await expect(page.getByRole("button", { name: "Tạo phòng Bot Online" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Chạy preflight bắt buộc" })).toBeEnabled();
});
