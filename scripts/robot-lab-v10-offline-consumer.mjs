import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';

const origin = process.env.OTT_PREVIEW_URL ?? 'http://127.0.0.1:4176';
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Local fixture acceptance only');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'allow' });
const evidence = { measuredAt: new Date().toISOString(), origin, consumer: 'production build UI', fixedFixturesOnly: true, playerCodeExecuted: false, cases: [], errors: [] };
const runtimeErrors = [];
const consoleErrors = []; const failedRequests = [];
const observe = page => {
  page.on('pageerror', error => runtimeErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
};
const ready = async page => {
  for (const name of ['Bot Xanh', 'Bot Đỏ']) {
    const region = page.getByRole('region', { name, exact: true });
    await region.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
    const button = region.getByRole('button', { name: 'Sẵn sàng', exact: true });
    await expect(button).toBeEnabled({ timeout: 60000 });
    await button.click();
  }
};
const snapshot = async page => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất checkpoint', exact: true }).click();
  const download = await downloadPromise;
  return JSON.parse(await readFile(await download.path(), 'utf8'));
};
const step = async (page, count) => {
  await expect(page.getByRole('button', { name: 'Từng nước', exact: true })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Từng nước', exact: true }).click();
  await page.getByText(`${count} lượt đã commit · checkpoint sau mỗi lượt`, { exact: true }).waitFor({ timeout: 60000 });
};
try {
  const page = await context.newPage(); observe(page);
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED', message: 'Guest fixture' } }));
  await page.route('http://localhost:3001/**', route => route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED', message: 'Guest fixture' } }));
  await page.goto(`${origin}/dau-chuong-trinh/offline`);
  await page.getByRole('heading', { name: 'Bot Offline', exact: true }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole('button', { name: 'Tải Offline kit', exact: true }).click();
  await page.getByText('Offline kit đã sẵn sàng và sandbox đã được xác minh; Bot Offline không cần server.', { exact: true }).waitFor({ timeout: 60000 });
  for (const button of await page.getByRole('button', { name: 'Bot mẫu', exact: true }).all()) await button.click();
  await ready(page);
  evidence.cases.push({ name: 'builtUiActualIsolatedPreflightBothSlots', pass: true });
  await page.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await step(page, 1);
  const committed = await snapshot(page);
  assert.equal(committed.history.length, 1);
  assert.equal(committed.state.currentTurn, 'RED');
  assert.equal(committed.status, 'PAUSED');
  evidence.cases.push({ name: 'builtUiSingleMoveCheckpoint', pass: true });
  await page.close();
  await context.setOffline(true);
  const cold = await context.newPage(); observe(cold);
  await cold.goto(`${origin}/dau-chuong-trinh/offline`);
  await cold.getByText(/Đã khôi phục checkpoint/).waitFor({ timeout: 15000 });
  await cold.getByText("Offline sandbox đã được xác minh; Bot chỉ chạy trong iframe opaque-origin + Worker cô lập.", { exact: true }).waitFor({ timeout: 120000 });
  assert.equal(await cold.getByRole('button', { name: 'Sẵn sàng', exact: true }).first().isDisabled(), true);
  const restored = await snapshot(cold);
  assert.deepEqual(restored.state, committed.state);
  assert.equal(restored.history.length, 1);
  await ready(cold);
  await step(cold, 2);
  evidence.cases.push({ name: 'coldOfflineNewDocumentRestorePreflightStep', pass: true });
  // Persist a pending strategy while paused before any further move occurs.
  await cold.getByRole('textbox').first().fill("def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n# immutable pending fixture\n");
  await cold.getByRole('button', { name: 'Kiểm tra', exact: true }).first().click();
  await cold.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Sẵn sàng')?.disabled, null, { timeout: 60000 });
  await cold.getByRole('button', { name: 'Sẵn sàng', exact: true }).first().click();
  const pending = await snapshot(cold);
  assert.equal(pending.pendingSlots.BLUE.ready, true);
  assert.notEqual(pending.pendingSlots.BLUE.revision, pending.slots.BLUE.revision);
  await cold.reload();
  await cold.getByText(/Đã khôi phục checkpoint/).waitFor();
  await cold.getByText("Offline sandbox đã được xác minh; Bot chỉ chạy trong iframe opaque-origin + Worker cô lập.", { exact: true }).waitFor({ timeout: 120000 });
  const pendingRestored = await snapshot(cold);
  assert.equal(pendingRestored.pendingSlots.BLUE.source, pending.pendingSlots.BLUE.source);
  assert.equal(pendingRestored.pendingSlots.BLUE.ready, false);
  assert.equal(pendingRestored.history.length, 2);
  evidence.cases.push({ name: 'coldPendingPersistenceWithoutNextTurn', pass: true });
  await ready(cold);
  await cold.getByRole('button', { name: 'Chạy', exact: true }).click();
  await cold.getByText('Đang tính lượt Xanh…', { exact: true }).waitFor({ timeout: 15000 });
  await cold.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await cold.getByText('3 lượt đã commit · checkpoint sau mỗi lượt', { exact: true }).waitFor({ timeout: 60000 });
  const activated = await snapshot(cold);
  assert.equal(activated.pendingSlots.BLUE, undefined);
  assert.equal(activated.slots.BLUE.revision, pendingRestored.pendingSlots.BLUE.revision);
  evidence.cases.push({ name: 'restoredPendingRunPauseOwnTurnActivation', pass: true });
  cold.once('dialog', dialog => dialog.accept());
  await expect(cold.getByRole('button', { name: 'Xóa checkpoint', exact: true })).toBeEnabled({ timeout: 60000 });
  await cold.getByRole('button', { name: 'Xóa checkpoint', exact: true }).click();
  await cold.getByText('Đã xóa checkpoint local; không xóa dữ liệu tài khoản.', { exact: true }).waitFor();
  await cold.getByRole('textbox').first().fill("def choose_move(state, memory):\n    if state['turn_number'] >= 3:\n        raise Exception('FIXTURE_AUTHOR_FAULT')\n    return state['legal_moves'][0], {'fixture': 1}\n");
  await cold.getByRole('textbox').nth(1).fill("def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n");
  await ready(cold);
  await cold.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await step(cold, 1); await step(cold, 2);
  await cold.getByRole('button', { name: 'Từng nước', exact: true }).click();
  await cold.getByText('Kết quả: Đỏ thắng', { exact: true }).waitFor({ timeout: 60000 });
  const terminal = await snapshot(cold);
  assert.equal(terminal.status, 'FINISHED');
  assert.equal(terminal.endingReason, 'BOT_RUNTIME_FAILED');
  assert.deepEqual(terminal.memories, { BLUE: null, RED: null });
  assert.equal(terminal.history.length, 2);
  evidence.cases.push({ name: 'builtUiAuthorFaultLossTerminalMemoryCleanup', pass: true });
  assert.deepEqual(runtimeErrors, []);
  evidence.status = 'PASS_FIXED_FIXTURE_CONSUMER_SCOPE';
} catch (error) {
  evidence.status = 'FAIL'; evidence.failure = String(error.stack ?? error); process.exitCode = 1;
  const failedPage = context.pages().at(-1);
  if (failedPage) {
    evidence.visibleFailure = (await failedPage.locator('body').innerText().catch(() => '')).slice(0, 3500);
    evidence.documentFailure = (await failedPage.content().catch(() => '')).slice(0, 1800);
    evidence.cachedUrls = await failedPage.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat()).catch(() => []);
  }
}
finally {
  evidence.errors = runtimeErrors;
  evidence.consoleErrors = consoleErrors;
  evidence.failedRequests = failedRequests;
  await browser.close();
  await writeFile('docs/robot-lab-visual-reference/v10-offline-consumer.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
