import { expect, test } from "playwright/test";

const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
const revision = {
  id: "r10-revision",
  revisionNumber: 1,
  status: "PASSED",
  sdkVersion: "0.1.0",
  schemaVersion: "1",
  sourceDigest: "b".repeat(64),
  sourceBytes: source.length,
  createdAt: "2026-10-04T01:00:00.000Z",
  updatedAt: "2026-10-04T01:00:00.000Z",
  memoryPolicy: "RESET_ON_NEW_REVISION",
  availability: ["ONLINE", "OFFLINE"],
};
const bot = {
  id: "r10-bot",
  name: "Bot thử nghiệm",
  createdAt: revision.createdAt,
  updatedAt: revision.updatedAt,
  usedBytes: revision.sourceBytes,
  revisions: [revision],
};

test("R10 Bot Online custom room exposes role toggles and gates room creation on preflight", async ({ page }) => {
  await page.route("**/auth/me", async (route) =>
    route.fulfill({
      status: 200,
      json: {
        user: {
          id: "r10-owner",
          username: "r10_owner",
          displayName: "Hoàng",
          theme: "dark",
          avatarPreset: "robot",
          stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 },
        },
      },
    })
  );
  await page.route("http://localhost:3001/bot-library", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ bots: [bot], quotaBytes: 262144, usedBytes: revision.sourceBytes }),
    })
  );
  await page.route("http://localhost:3001/bot-library/bots/r10-bot/revisions/r10-revision/test", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        revision: { ...revision, status: "PASSED" },
        legalPreview: ["a1-b1"],
        privateLog: ["Preflight test passed"],
      }),
    })
  );

  await page.goto("/dau-chuong-trinh/online?custom=1");

  await expect(page.getByRole("heading", { name: "Tạo phòng Bot riêng" })).toBeVisible();
  await expect(page.getByLabel("Có Trọng tài")).toBeVisible();
  await expect(page.getByLabel("Có Khán giả")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tạo phòng Bot Online" })).toBeDisabled();

  await page.getByRole("button", { name: "Kiểm tra code" }).click();
  await expect(page.getByRole("button", { name: "Tạo phòng Bot Online" })).toBeEnabled();
});
