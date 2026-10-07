import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';
import { buildApp } from '../apps/server/src/app.ts';
import { PrismaDatabase } from '../apps/server/src/plugins/prisma.ts';

const target = new URL(process.env.DATABASE_URL ?? 'http://missing');
assert.equal(target.hostname, '127.0.0.1');
assert.match(target.pathname, /^\/ottv2_r20_acceptance_/);
for (const key of ['R10_WASMTIME_PATH', 'R10_CPYTHON_WASI_DIR', 'R10_WASMTIME_SHA256', 'R10_CPYTHON_WASM_SHA256']) assert.ok(process.env[key], key);
const evidence = { measuredAt: new Date().toISOString(), consumer: 'production build + real local API + disposable PostgreSQL + pinned WASI', database: target.pathname.slice(1), fixedFixturesOnly: true, productionMutation: false, cases: [], errors: [] };
const app = await buildApp({ database: new PrismaDatabase(), env: {
  NODE_ENV: 'test', HOST: '127.0.0.1', PORT: 0, LOG_LEVEL: 'silent', DATABASE_URL: process.env.DATABASE_URL, CORS_ORIGINS: '', corsOrigins: [], REALTIME_ADAPTER: 'disabled',
  BOT_WASMTIME_PATH: process.env.R10_WASMTIME_PATH, BOT_CPYTHON_WASI_DIR: process.env.R10_CPYTHON_WASI_DIR, BOT_WASMTIME_SHA256: process.env.R10_WASMTIME_SHA256, BOT_CPYTHON_WASM_SHA256: process.env.R10_CPYTHON_WASM_SHA256,
} });
const origin = await app.listen({ host: '127.0.0.1', port: 0 });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const contexts = [];
async function prepare() {
  const context = await browser.newContext(); contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', error => evidence.errors.push(String(error)));
  page.on('response', async response => {
    if (response.url().includes('/guest/bot-library/') && response.url().endsWith('/test') && response.ok()) {
      const body = await response.json().catch(() => ({}));
      if (body.revision?.status !== 'PASSED') evidence.errors.push({ phase: 'Preflight rejected', status: body.revision?.status, code: body.revision?.validationCode, message: body.revision?.validationMessage });
    }
    if (response.url().includes('/guest/bot-library/') && response.status() >= 400) {
      const body = await response.json().catch(() => ({}));
      evidence.errors.push({ phase: 'Guest API', path: new URL(response.url()).pathname, status: response.status(), code: body.code, message: body.message, issues: body.details?.issues?.map(issue => ({ path: issue.path, code: issue.code })) });
    }
  });
  await page.goto(`${origin}/bot-lab`);
  await page.getByRole('heading', { name: 'Workbench chiến thuật', exact: true }).waitFor();
  await page.getByRole('button', { name: /Bot mẫu|Dùng bot mẫu/ }).click();
  await page.getByRole('button', { name: /Lưu/ }).click();
  await expect(page.getByRole('button', { name: 'Dùng Online', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Dùng Online', exact: true }).click();
  await page.getByRole('heading', { name: 'Chuẩn bị Bot Online', exact: true }).waitFor();
  const selectionUrl = page.url();
  await page.getByRole('button', { name: 'Chạy preflight bắt buộc' }).click();
  await expect(page.getByRole('button', { name: 'Tạo phòng Bot Online', exact: true })).toBeEnabled({ timeout: 60000 });
  return { page, context, selectionUrl };
}
try {
  const blue = await prepare();
  const queuedResponse = blue.page.waitForResponse(response => new URL(response.url()).pathname === '/matchmaking/queue' && response.request().method() === 'POST');
  await blue.page.getByRole('button', { name: 'Tìm đối thủ Bot', exact: true }).click();
  const queued = await queuedResponse;
  assert.equal(queued.status(), 200);
  const queueId = (await queued.json()).queue.queueId;
  await blue.page.getByRole('button', { name: 'Huỷ tìm trận', exact: true }).click();
  await blue.page.waitForURL(origin + '/');
  const cancelled = await blue.context.request.get(`${origin}/matchmaking/queue/${queueId}`);
  assert.equal(cancelled.status(), 200);
  assert.equal((await cancelled.json()).queue.status, 'CANCELLED');
  evidence.cases.push({ name: 'guestBotQueueUiCancelAuthoritative', pass: true });
  await blue.page.goto(blue.selectionUrl);
  await expect(blue.page.getByRole('button', { name: 'Tạo phòng Bot Online', exact: true })).toBeDisabled();
  await blue.page.getByRole('button', { name: 'Chạy preflight bắt buộc' }).click();
  await expect(blue.page.getByRole('button', { name: 'Tạo phòng Bot Online', exact: true })).toBeEnabled({ timeout: 60000 });
  const red = await prepare();
  evidence.cases.push({ name: 'twoGuestLocalLibrariesOnlinePreflight', pass: true });
  await blue.page.getByRole('button', { name: 'Tạo phòng Bot Online', exact: true }).click();
  await blue.page.waitForURL(/\/phong\/[A-Z0-9]{6}/);
  const roomId = new URL(blue.page.url()).pathname.split('/').at(-1);
  await red.page.goto(`${origin}/phong-online`);
  await red.page.locator('.room-card').filter({ hasText: `#${roomId}` }).getByRole('button', { name: 'Tham gia', exact: true }).click();
  await red.page.getByRole('dialog').getByRole('button', { name: 'Tham gia', exact: true }).click();
  await red.page.getByRole('heading', { name: 'Chọn Bot vào phòng', exact: true }).waitFor();
  await red.page.getByRole('button', { name: 'Chạy preflight bắt buộc' }).click();
  await expect(red.page.getByRole('button', { name: 'Gắn Bot & vào phòng' })).toBeEnabled({ timeout: 60000 });
  await red.page.getByRole('button', { name: 'Gắn Bot & vào phòng' }).click();
  await red.page.waitForURL(/\/phong\/[A-Z0-9]{6}/);
  await blue.page.reload();
  const blueSnap = await blue.context.request.get(`${origin}/bot-online/${roomId}`);
  assert.equal(blueSnap.status(), 200);
  assert.ok((await blueSnap.json()).snapshot.players.find(player => player.owner)?.botId);
  evidence.cases.push({ name: 'customGuestUiDiscoveryJoinAttachReloadOwnerPin', pass: true });
  for (const client of [blue, red]) {
    await expect(client.page.getByRole('button', { name: 'Sẵn sàng', exact: true })).toBeEnabled({ timeout: 20000 });
    await client.page.getByRole('button', { name: 'Sẵn sàng', exact: true }).click();
  }
  const input = blue.page.getByLabel('Tải chiến thuật Python mới');
  await expect(input).toBeEnabled({ timeout: 60000 });
  await input.setInputFiles({ name: 'fixed-next.py', mimeType: 'text/x-python', buffer: Buffer.from("def choose_move(state, memory):\n    return state['legal_moves'][0], {'revision': 2}\n") });
  await blue.page.getByText(/Đã kiểm tra r2/).waitFor({ timeout: 60000 });
  evidence.cases.push({ name: 'liveOwnerRevisionUploadActualWasi', pass: true });
  await expect.poll(async () => {
    const response = await blue.context.request.get(`${origin}/bot-online/${roomId}`);
    const snapshot = (await response.json()).snapshot;
    return snapshot.players.find(player => player.owner)?.activeRevisionNumber;
  }, { timeout: 60000 }).toBe(2);
  evidence.cases.push({ name: 'candidateActivatesAtOwnTurn', pass: true });
  const ownerBeforeLogin = (await (await blue.context.request.get(`${origin}/bot-online/${roomId}`)).json()).snapshot.players.find(player => player.owner)?.userId;
  const registration = await blue.context.request.post(`${origin}/auth/register`, { data: { fullName: 'Acceptance Player', displayName: 'Tài khoản mới', username: `gb${Date.now()}`.slice(0, 20), password: 'guest-acceptance-fixed-password' } });
  assert.equal(registration.status(), 201);
  await blue.page.reload();
  await expect(blue.page.getByLabel('Tải chiến thuật Python mới')).toBeEnabled({ timeout: 20000 });
  const afterLogin = (await (await blue.context.request.get(`${origin}/bot-online/${roomId}`)).json()).snapshot;
  assert.equal(afterLogin.players.find(player => player.owner)?.userId, ownerBeforeLogin);
  assert.match(ownerBeforeLogin, /^guest:/);
  evidence.cases.push({ name: 'inFlightReloadAfterLoginKeepsGuestOwner', pass: true });
  await blue.page.screenshot({ path: 'docs/robot-lab-visual-reference/guest-bot-online-live.png', fullPage: true });
  // UI surrender carries the same client lock; terminal summary belongs to
  // the original Guest even though this browser now also has an account.
  await blue.page.getByRole('button', { name: 'Đầu hàng', exact: true }).click();
  await blue.page.getByRole('dialog').getByRole('button', { name: 'Đầu hàng', exact: true }).click();
  await expect.poll(async () => (await (await blue.context.request.get(`${origin}/bot-online/${roomId}`)).json()).snapshot.status, { timeout: 20000 }).toBe('FINISHED');
  // Server completion may precede the HTTP response/SSE consumer. Observe
  // the product terminal view before leaving, rather than aborting delivery.
  await blue.page.getByRole('heading', { name: 'THUA CUỘC', exact: true }).waitFor();
  await blue.page.goto(`${origin}/lich-su?mode=BOT_ONLINE`);
  await blue.page.getByText('Bot Online · Guest', { exact: true }).waitFor();
  evidence.cases.push({ name: 'guestTerminalResultDeviceHistoryAfterLogin', pass: true });
  await red.page.getByRole('heading', { name: 'CHIẾN THẮNG', exact: true }).waitFor();
  await red.page.goto(`${origin}/lich-su?mode=BOT_ONLINE`);
  await red.page.getByText('Lịch sử Guest được lưu trên thiết bị này.', { exact: true }).waitFor();
  await red.page.getByText('Bot Online · Guest', { exact: true }).waitFor();
  assert.equal(new URL(red.page.url()).pathname, '/lich-su');
  evidence.cases.push({ name: 'unauthenticatedGuestCanReadDeviceBotHistory', pass: true });
  await blue.page.getByRole('button', { name: 'Nhập lịch sử Bot Guest', exact: true }).click();
  await blue.page.getByRole('dialog').getByRole('button', { name: 'Xác nhận nhập tóm tắt', exact: true }).click();
  await blue.page.getByText('Đã nhập 1; bỏ qua 0 bản trùng. Dữ liệu thiết bị được giữ nguyên.', { exact: true }).waitFor();
  await blue.page.getByRole('button', { name: 'Nhập lịch sử Bot Guest', exact: true }).click();
  await blue.page.getByRole('dialog').getByRole('button', { name: 'Xác nhận nhập tóm tắt', exact: true }).click();
  await blue.page.getByText('Đã nhập 0; bỏ qua 1 bản trùng. Dữ liệu thiết bị được giữ nguyên.', { exact: true }).waitFor();
  const archive = await blue.context.request.get(`${origin}/guest/history/bot-imports`);
  assert.equal((await archive.json()).records.length, 1);
  assert.ok(!JSON.stringify(await archive.json()).includes('choose_move'));
  await blue.page.getByText('Bot Online · Guest', { exact: true }).waitFor();
  const officialHistory = await blue.context.request.get(`${origin}/history`);
  assert.equal((await officialHistory.json()).summary.total, 0);
  evidence.cases.push({ name: 'explicitBotGuestImportPreviewRetryDedupeNoRankedEffect', pass: true });
  assert.deepEqual(evidence.errors, []);
} catch (error) {
  evidence.failure = String(error); process.exitCode = 1;
  for (let index = 0; index < contexts.length; index++) {
    const page = contexts[index].pages()[0];
    if (page) {
      evidence.errors.push({ phase: 'UI failure', alert: await page.getByRole('alert').allTextContents(), status: await page.getByRole('status').allTextContents() });
      await page.screenshot({ path: `docs/robot-lab-visual-reference/guest-bot-online-failure-${index}.png`, fullPage: true });
    }
  }
}
finally {
  for (const context of contexts) await context.close();
  await browser.close(); await app.close();
  await writeFile('docs/robot-lab-visual-reference/guest-bot-online-browser.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
