import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createInitialState } from "../packages/game-rules/dist/index.js";
import { createBotTurnState } from "../packages/bot-sdk/dist/index.js";

const origin = process.env.OTT_PREVIEW_URL ?? "http://127.0.0.1:4175";
assert.equal(new URL(origin).hostname, "127.0.0.1", "Local fixed-fixture harness only");
const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const diagnostics = [];
const liveWorkers = new Set();
page.on("worker", (worker) => { liveWorkers.add(worker); worker.on("close", () => liveWorkers.delete(worker)); });
page.on("console", (message) => { if (message.type() === "error") diagnostics.push(message.text()); });
page.on("pageerror", (error) => diagnostics.push(String(error)));
const state = createBotTurnState(createInitialState(), "BLUE", [], { BLUE: 30000, RED: 30000 }, 1);
const fixture = "def choose_move(state, memory):\n    return state['legal_moves'][0], {'seen': 1}\n";
const results = [];
try {
  await page.goto(origin);
  await page.evaluate(async () => {
    const kit = await import("/src/services/local/offlineKit.ts");
    await kit.installOfflineKit();
    localStorage.setItem("ott-private-sentinel", "NOT_FOR_BOT");
    document.cookie = "ott_fixture_cookie=NOT_FOR_BOT";
  });
  const guestSaved = await page.evaluate(async ({ source }) => {
    const { guestBotLibraryApi: api } = await import("/src/services/bot-library/guestBotLibrary.ts");
    const saved = await api.createBot({ name: 'Guest fixture', source });
    const second = await api.createBotRevision(saved.bot.id, { source: source + '# revision two\n' });
    await api.deleteBotRevision(saved.bot.id, second.revision.id);
    const third = await api.createBotRevision(saved.bot.id, { source });
    if (third.revision.revisionNumber !== 3) throw new Error('Immutable revision numbering failed');
    let wrongOwnerDenied = false;
    try { await api.getBotSource('guest-bot:other', saved.revision.id); } catch { wrongOwnerDenied = true; }
    if (!wrongOwnerDenied) throw new Error('Wrong bot/revision pair was accepted');
    return { botId: saved.bot.id, revisionId: saved.revision.id, thirdId: third.revision.id };
  }, { source: fixture });
  await page.reload();
  const retainedSource = await page.evaluate(async ({ botId, revisionId }) => {
    const { guestBotLibraryApi: api } = await import("/src/services/bot-library/guestBotLibrary.ts");
    return (await api.getBotSource(botId, revisionId)).source;
  }, guestSaved);
  assert.equal(retainedSource, fixture);
  results.push({ name: 'guestIndexedDbRevisionReloadOwnership', ok: true });
  await page.evaluate(async ({ botId, revisionId, thirdId, source }) => {
    const { guestBotLibraryApi: api } = await import("/src/services/bot-library/guestBotLibrary.ts");
    await api.deleteBotRevision(botId, revisionId); await api.deleteBotRevision(botId, thirdId);
    const created = [];
    for (let i = 0; i < 4; i++) created.push(await api.createBot({ name: `Quota ${i}`, source: source + '#' + 'x'.repeat(60000) }));
    const race = await Promise.allSettled([0, 1].map(i => api.createBot({ name: `Concurrent ${i}`, source: source + '#' + 'x'.repeat(16000) })));
    if (race.filter(result => result.status === 'fulfilled').length !== 1) throw new Error('Quota transaction race failed');
    for (const result of race) if (result.status === 'fulfilled') created.push(result.value);
    if ((await api.getBotLibrary()).usedBytes > 262144) throw new Error('Quota exceeded');
    for (const saved of created) await api.deleteBotRevision(saved.bot.id, saved.revision.id);
  }, { ...guestSaved, source: fixture });
  results.push({ name: 'guestIndexedDbConcurrentQuota', ok: true });
  const run = (source, mode = "turn", seed = 42) => page.evaluate(async ({ source, state, mode, seed }) => {
    const { executeOfflineIsolated } = await import("/src/services/bot-offline/offlineCompartment.ts");
    const controller = new AbortController();
    if (mode === "abort") setTimeout(() => controller.abort(), 40);
    try { return { ok: true, result: await executeOfflineIsolated({ source, state, memory: null, seed }, controller.signal, mode === "preflight", () => { if (mode === 'compute-abort') setTimeout(() => controller.abort(), 40); }) }; }
    catch (error) { return { ok: false, code: error.code, message: error.message }; }
  }, { source, state, mode, seed });
  const record = async (name, source, expectedCode, mode) => {
    const result = await run(source, mode);
    results.push({ name, ...result });
    console.log(JSON.stringify({ name, ...result }));
    if (expectedCode) assert.equal(result.code, expectedCode);
    else assert.equal(result.ok, true);
    assert.equal(await page.locator("iframe").count(), 0, "frame reclaimed");
    await page.waitForTimeout(50);
    assert.equal(liveWorkers.size, 0, "worker reclaimed");
    return result;
  };
  const first = await record("actualCompartmentAbi", fixture);
  for (const capability of ["parentDenied", "storageDenied", "cookieDenied", "memoryMaximumEnforced", "networkDenied", "storageAbsent"]) assert.equal(first.result.isolationProof[capability], true, capability);
  assert.equal(first.result.isolationProof.memoryMaximumPages, 1024);
  const second = await record("deterministicFreshTurn", fixture);
  assert.deepEqual(first.result.move, second.result.move);
  const seeded = "def choose_move(state, memory):\n    return state['legal_moves'][0], hash('robot-lab')\n";
  const seededFirst = await record("deterministicHashSeed", seeded);
  const seededSecond = await record("deterministicHashSeedRepeat", seeded);
  assert.equal(seededFirst.result.memory, seededSecond.result.memory);
  assert.notEqual((await run(seeded, 'turn', 43)).result.memory, seededFirst.result.memory);
  await record("isolatedPreflight", fixture, undefined, "preflight");
  await record("jsBridgeDenied", "import js\ndef choose_move(state, memory):\n    return state['legal_moves'][0], None\n", "IMPORT_NOT_ALLOWED");
  await record("namespaceEscapeDenied", "def choose_move(state, memory):\n    return state['legal_moves'][0], ().__class__.__mro__\n", "FORBIDDEN_API");
  await record("trustedTypingEvalDenied", "import typing\ndef choose_move(state, memory):\n    return state['legal_moves'][0], typing.get_type_hints(choose_move)\n", "BOT_RUNTIME_FAILED");
  await record("outputBudget", "def choose_move(state, memory):\n    return state['legal_moves'][0], 'x' * 20000\n", "OUTPUT_BUDGET");
  await record("legalMoveGuard", "def choose_move(state, memory):\n    return {'from': 'a1', 'to': 'i9'}, None\n", "ILLEGAL_OUTPUT");
  await record("memoryOutputBudget", "def choose_move(state, memory):\n    return state['legal_moves'][0], 'x' * 9000\n", "ILLEGAL_OUTPUT");
  await record("computeWatchdog", "def choose_move(state, memory):\n    for i in range(10**9):\n        pass\n    return state['legal_moves'][0], None\n", "TURN_TIMEOUT");
  await record("cancelReclaim", fixture, "ABORTED", "abort");
  await record("computeCancelReclaim", "def choose_move(state, memory):\n    for i in range(10**9):\n        pass\n    return state['legal_moves'][0], None\n", "ABORTED", "compute-abort");
  await record("replacementUnaffected", fixture);
  await context.setOffline(true);
  await record("cachedRuntimeNetworkDisabled", fixture);
  await page.evaluate(async () => {
    const { OFFLINE_KIT_CACHE, OFFLINE_KIT_ASSETS } = await import("/src/services/local/offlineKit.ts");
    const cache = await caches.open(OFFLINE_KIT_CACHE);
    await cache.put(OFFLINE_KIT_ASSETS[0], new Response('tampered fixture'));
  });
  await record("tamperedCachedRuntimeDenied", fixture, "RUNTIME_HASH_MISMATCH");
} finally {
  await writeFile("docs/robot-lab-visual-reference/v10-offline-runtime.json", JSON.stringify({ measuredAt: new Date().toISOString(), origin, fixedFixturesOnly: true, playerCodeExecuted: false, results, diagnostics }, null, 2));
  await browser.close();
}
