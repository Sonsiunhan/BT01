import assert from "node:assert/strict";
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const origin = process.env.OTT_DEV_URL ?? "http://127.0.0.1:4177";
assert.equal(new URL(origin).hostname, "127.0.0.1", "Local adversarial acceptance only");

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ serviceWorkers: "allow" });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", error => pageErrors.push(String(error)));

const evidence = {
  measuredAt: new Date().toISOString(),
  origin,
  scope: "real source Offline compartment via Vite module import",
  playerCodeExecuted: false,
  status: "FAIL",
  cases: [],
  errors: [],
};

async function expectRejected(label, source, expectedCode, expectedLeak = "") {
  const result = await page.evaluate(async ({ source, expectedCode, expectedLeak }) => {
    const runner = await import("/src/services/bot-offline/botOfflineRunner.ts");
    const state = { sdkVersion: "1.0.0", schemaVersion: "1.0", side: "BLUE", board: {}, legalMoves: [{ from: "a1", to: "b2" }], turnNumber: 1, clocksMs: { BLUE: 30_000, RED: 30_000 }, history: [] };
    try {
      await runner.runOfflineBotTurn({ source, state, memory: null, preflight: true });
      return { ok: false, code: "DID_NOT_REJECT" };
    } catch (error) {
      const code = error?.code ?? "UNKNOWN";
      const message = String(error?.message ?? error);
      return { ok: code === expectedCode && !message.includes(expectedLeak) && !message.includes(source), code, message };
    }
  }, { source, expectedCode, expectedLeak });
  assert.equal(result.ok, true, `${label}: ${JSON.stringify(result)}`);
  evidence.cases.push({ name: label, pass: true, observedCode: result.code });
}

async function runMemory(source, memory) {
  return page.evaluate(async ({ source, memory }) => {
    const runner = await import("/src/services/bot-offline/botOfflineRunner.ts");
    const state = { sdkVersion: "1.0.0", schemaVersion: "1.0", side: "BLUE", board: {}, legalMoves: [{ from: "a1", to: "b2" }], turnNumber: 1, clocksMs: { BLUE: 30_000, RED: 30_000 }, history: [] };
    const result = await runner.runOfflineBotTurn({ source, state, memory, preflight: true });
    return result.memory;
  }, { source, memory });
}

try {
  await page.goto(`${origin}/dau-chuong-trinh/offline`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Bot Offline", exact: true }).waitFor();
  await page.getByRole("button", { name: "Tải Offline kit", exact: true }).click();
  await page.getByText(/Offline kit đã sẵn sàng và sandbox đã được xác minh/, { exact: false }).waitFor({ timeout: 120000 });

  const runtime = await page.evaluate(async () => {
    const runner = await import("/src/services/bot-offline/botOfflineRunner.ts");
    return runner.OFFLINE_RUNTIME_STATUS;
  });
  assert.equal(runtime.ready, true, "real browser attestation must unlock runtime");
  evidence.cases.push({ name: "dynamicAttestationReady", pass: true, memoryRoundTrip: runtime.memoryRoundTrip === true });

  await expectRejected(
    "hostileImportIsRejectedWithoutLeak",
    "def choose_move(state, memory):\n    import os\n    return state['legal_moves'][0], memory\n",
    "IMPORT_NOT_ALLOWED",
    "HOSTILE_SECRET_IMPORT",
  );
  await expectRejected(
    "hostileForbiddenApiIsRejectedWithoutLeak",
    "def choose_move(state, memory):\n    return open('HOSTILE_SECRET_FILE').read(), memory\n",
    "FORBIDDEN_API",
    "HOSTILE_SECRET_FILE",
  );
  await expectRejected(
    "hostileOutputBudgetIsRejectedWithoutLeak",
    "def choose_move(state, memory):\n    return state['legal_moves'][0], 'HOSTILE_SECRET_OUTPUT_' * 2000\n",
    "OUTPUT_BUDGET",
    "HOSTILE_SECRET_OUTPUT",
  );
  await expectRejected(
    "hostileComputeTimeoutIsRejectedWithoutLeak",
    "def choose_move(state, memory):\n    total = 0\n    for index in range(1000000000):\n        total += index\n    return state['legal_moves'][0], memory\n",
    "TURN_TIMEOUT",
    "HOSTILE_SECRET_TIMEOUT",
  );

  const memorySource = "# ottv2-memory-schema: adversarial-v1\ndef choose_move(state, memory):\n    current = memory if isinstance(memory, dict) else {}\n    return state['legal_moves'][0], {'schema': 'adversarial-v1', 'counter': int(current.get('counter', 0)) + 1}\n";
  const firstMemory = await runMemory(memorySource, null);
  assert.deepEqual(firstMemory, { schema: "adversarial-v1", counter: 1 });
  const secondMemory = await runMemory(memorySource, firstMemory);
  assert.deepEqual(secondMemory, { schema: "adversarial-v1", counter: 2 });
  const resetMemory = await runMemory(memorySource, null);
  assert.deepEqual(resetMemory, { schema: "adversarial-v1", counter: 1 });
  evidence.cases.push({ name: "memoryRoundTripAndExplicitReset", pass: true, first: firstMemory, second: secondMemory, reset: resetMemory });

  // The timeout path disposes its iframe/Worker. A fresh invocation must work,
  // proving the killed Worker does not poison or retain the next turn.
  const recovered = await runMemory(memorySource, null);
  assert.deepEqual(recovered, { schema: "adversarial-v1", counter: 1 });
  evidence.cases.push({ name: "workerKillReclaimFreshInvocation", pass: true, recovered });

  const unexpectedDiagnostics = [...consoleErrors, ...pageErrors]
    .filter((entry) => !/Failed to load resource: the server responded with a status of 404|ERR_CONNECTION_REFUSED/.test(entry));
  assert.deepEqual(unexpectedDiagnostics, [], "no runtime console errors or private diagnostics");
  evidence.expectedDiagnostics = [...consoleErrors, ...pageErrors].filter((entry) => !unexpectedDiagnostics.includes(entry));
  assert.deepEqual(pageErrors, [], "no page errors or private diagnostics");
  evidence.status = "PASS_REAL_COMPARTMENT_ADVERSARIAL_SCOPE";
} catch (error) {
  evidence.failure = String(error?.stack ?? error);
  process.exitCode = 1;
} finally {
  evidence.errors = [...consoleErrors, ...pageErrors];
  await writeFile("docs/robot-lab-visual-reference/r11-offline-adversarial-browser.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await browser.close();
}
