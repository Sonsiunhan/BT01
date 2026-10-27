import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createInitialState } from "../packages/game-rules/dist/index.js";
import { createBotTurnState } from "../packages/bot-sdk/dist/index.js";

const botPath = process.argv[2];
assert.ok(botPath, "Usage: node scripts/run-bot-py-file.mjs <path-to-bot.py>");

const origin = process.env.OTT_PREVIEW_URL ?? "http://127.0.0.1:4175";
assert.equal(new URL(origin).hostname, "127.0.0.1", "Local file harness only");
const source = await readFile(botPath, "utf8");
const state = createBotTurnState(createInitialState(), "BLUE", [], { BLUE: 30000, RED: 30000 }, 1);
const evidence = {
  measuredAt: new Date().toISOString(),
  origin,
  fileName: botPath.replaceAll("\\", "/").split("/").at(-1),
  execution: "browser-pyodide-opaque-origin-module-worker",
  sourceReadFromDisk: true,
  sourcePrinted: false,
};
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const context = await browser.newContext();
const page = await context.newPage();
const diagnostics = [];
page.on("console", (message) => {
  if (message.type() === "error") diagnostics.push(message.text());
});
page.on("pageerror", (error) => diagnostics.push(String(error)));

try {
  await page.goto(origin);
  await page.evaluate(async () => {
    const kit = await import("/src/services/local/offlineKit.ts");
    await kit.installOfflineKit();
    localStorage.setItem("ott-private-sentinel", "NOT_FOR_BOT");
    document.cookie = "ott_fixture_cookie=NOT_FOR_BOT";
  });

  const result = await page.evaluate(async ({ source, state }) => {
    const { executeOfflineIsolated } = await import("/src/services/bot-offline/offlineCompartment.ts");
    const controller = new AbortController();
    return executeOfflineIsolated({ source, state, memory: null, seed: 42 }, controller.signal);
  }, { source, state });

  assert.equal(result.move.from, "a1");
  assert.equal(result.move.to, "a2");
  assert.deepEqual(result.memory, { seen: 1 });
  assert.equal(result.isolationProof.parentDenied, true);
  assert.equal(result.isolationProof.storageDenied, true);
  assert.equal(result.isolationProof.cookieDenied, true);
  assert.equal(result.isolationProof.networkDenied, true);
  assert.equal(result.isolationProof.memoryMaximumPages, 1024);

  evidence.ok = true;
  evidence.move = result.move;
  evidence.memory = result.memory;
  evidence.computeMs = result.computeMs;
  evidence.isolationProof = result.isolationProof;
  console.log(JSON.stringify({
    fileName: evidence.fileName,
    ok: evidence.ok,
    move: evidence.move,
    memory: evidence.memory,
    computeMs: evidence.computeMs,
    execution: evidence.execution,
    isolationProof: evidence.isolationProof,
  }));
} catch (error) {
  evidence.ok = false;
  evidence.errorCode = error?.code ?? "BOT_FILE_HARNESS_FAILED";
  evidence.errorMessage = error?.message ?? String(error);
  throw error;
} finally {
  evidence.diagnostics = diagnostics;
  await writeFile(
    "docs/robot-lab-visual-reference/v10-bot-py-file.json",
    JSON.stringify(evidence, null, 2),
  );
  await browser.close();
}
