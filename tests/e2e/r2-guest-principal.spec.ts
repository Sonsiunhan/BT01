import { expect, test } from "playwright/test";

test("legacy Guest Arena play URL redirects to normal Offline2P", async ({ page }) => {
  await page.goto("/guest/play");
  await expect(page).toHaveURL(/\/offline$/);
  await expect(page.getByRole("heading", { name: "Hai người một máy" })).toBeVisible();
});

test("Guest onboarding generates a stable name and persists an edited nickname", async ({ page }) => {
  await page.goto("/guest");
  const name = page.getByLabel("Tên khách");
  await expect(name).toHaveValue(/^Khách /);
  const generated = await name.inputValue();
  await page.reload();
  await expect(name).toHaveValue(generated);
  await expect(name).toBeEditable();
  await name.fill("Khách kiểm thử");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page).toHaveURL(/\/offline$/);
  await page.goto("/guest");
  await expect(name).toHaveValue("Khách kiểm thử");
});

test("two tabs without Web Locks never overlap Guest bootstrap", async ({ page }, testInfo) => {
  const events: string[] = [];
  page.on("console", message => events.push("first: " + message.text()));
  page.on("requestfailed", request => events.push("first failed: " + request.url() + " " + request.failure()?.errorText));
  const context = page.context();
  await context.addInitScript(() => Object.defineProperty(navigator, "locks", { configurable: true, value: undefined }));
  const second = await context.newPage();
  second.on("console", message => events.push("second: " + message.text()));
  second.on("requestfailed", request => events.push("second failed: " + request.url() + " " + request.failure()?.errorText));
  const recordDiagnostics = async () => testInfo.attach("guest-bootstrap-diagnostics", { body: JSON.stringify({ events, active, maxActive, calls: cookiesSeen.length }), contentType: "application/json" });
  let active = 0;
  let maxActive = 0;
  const cookiesSeen: string[] = [];
  await context.route("**/guest/session", async (route) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    cookiesSeen.push(route.request().headers().cookie ?? "");
    await new Promise((resolve) => setTimeout(resolve, 250));
    active -= 1;
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "set-cookie": "ottv2_guest=stable; Path=/; HttpOnly" }, body: JSON.stringify({ principal: "GUEST", displayName: "Khách Test" }) });
  });
  await context.route("**/rooms/LOCKA/spectate", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "Cần đăng nhập" }) }));
  try {
    await Promise.all([page.goto("/spectate/LOCKA", { waitUntil: "domcontentloaded" }), second.goto("/spectate/LOCKA", { waitUntil: "domcontentloaded" })]);
    await expect(page.getByRole("heading", { name: "Cần mật khẩu phòng" })).toBeVisible();
    await expect(second.getByRole("heading", { name: "Cần mật khẩu phòng" })).toBeVisible();
    expect(maxActive).toBe(1);
    expect(cookiesSeen).toContain("");
    expect(cookiesSeen.length).toBe(2);
  } finally { await recordDiagnostics(); await second.close(); }
});
