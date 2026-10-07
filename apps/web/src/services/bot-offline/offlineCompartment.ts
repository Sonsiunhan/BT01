import { DEFAULT_BOT_LIMITS, createIsolatedRuntimeHarness, type BotInvocationRequest, type BotInvocationResult } from "@ottv2/bot-sdk";
import workerSource from "./offlineCompartment.worker.js?raw";
import { OFFLINE_KIT_ASSETS, OFFLINE_KIT_CACHE } from "../local/offlineKit";

const PINS: Record<string, string> = {
  "pyodide.mjs": "9f54a615c20b2aeb0514d25adbd5ae4c098f8604be1291959e760b6e85e8bc36",
  "pyodide.asm.js": "0ea527c5d589df084d79f306ddc9f99f1f67bb7d6529008c10d1a324a1a6dc22",
  "pyodide.asm.wasm": "abf462b9236af720a276be5a9db980aa31871972a323525abd33c1978cf844ce",
  "python_stdlib.zip": "cad21b7df47ac3d6efe8d97f0654feec8a51b089046100e9d21fba5954700a21",
  "pyodide-lock.json": "bb75898cd30da9530e25a9cb7336755db7c3cc85ddd0e3da20ae794a589b3972",
};
export class OfflineCompartmentError extends Error {
  constructor(public readonly code: string) { super(code); }
}

async function verifiedAssets(signal?: AbortSignal): Promise<Record<string, ArrayBuffer>> {
  if (typeof caches === "undefined" || !crypto.subtle) throw new OfflineCompartmentError("OFFLINE_KIT_MISSING");
  const cache = await caches.open(OFFLINE_KIT_CACHE);
  const assets: Record<string, ArrayBuffer> = {};
  for (const path of OFFLINE_KIT_ASSETS) {
    if (signal?.aborted) throw new OfflineCompartmentError("ABORTED");
    const response = await cache.match(path);
    if (!response?.ok) throw new OfflineCompartmentError("OFFLINE_KIT_MISSING");
    const bytes = await response.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (n) => n.toString(16).padStart(2, "0")).join("");
    const name = path.split("/").at(-1)!;
    if (hash !== PINS[name]) throw new OfflineCompartmentError("RUNTIME_HASH_MISMATCH");
    assets[name] = bytes;
  }
  return assets;
}

// Static trusted bootstrap only. Player text is never interpolated into HTML.
const FRAME_BOOTSTRAP = `window.addEventListener('message', function init(event) {
  if (event.source !== parent || event.data?.kind !== 'OTT_OFFLINE_INIT' || !event.ports[0]) return;
  window.removeEventListener('message', init);
  const port = event.ports[0];
  const url = URL.createObjectURL(new Blob([event.data.workerSource], {type:'text/javascript'}));
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  worker.onmessage = event => port.postMessage(event.data);
  worker.onerror = () => port.postMessage({kind:'result',ok:false,code:'BOT_WORKER_FAILED'});
  port.onmessage = event => {
    if (event.data.kind === 'dispose') { worker.terminate(); port.close(); return; }
    worker.postMessage(event.data);
  };
  port.start();
  let parentDenied = false, storageDenied = false, cookieDenied = false;
  try { void parent.document; } catch { parentDenied = true; }
  try { void localStorage.length; } catch { storageDenied = true; }
  try { void document.cookie; } catch { cookieDenied = true; }
  port.postMessage({kind:'frame-ready',proof:{parentDenied,storageDenied,cookieDenied}});
});`;

/** Fresh opaque frame/worker per invocation. Startup is not player compute. */
export async function executeOfflineIsolated(request: BotInvocationRequest, signal?: AbortSignal, preflight = false, onComputeStarted?: () => void): Promise<BotInvocationResult & { computeMs: number; isolationProof: Record<string, unknown> }> {
  if (signal?.aborted) throw new OfflineCompartmentError("ABORTED");
  if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 4294967295) throw new OfflineCompartmentError("INVALID_SEED");
  const assets = await verifiedAssets(signal);
  if (signal?.aborted) throw new OfflineCompartmentError("ABORTED");
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.title = "Runtime Bot cô lập";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.referrerPolicy = "no-referrer";
    const nonce = crypto.randomUUID().replaceAll("-", "");
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' blob: 'wasm-unsafe-eval'; worker-src blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><script nonce="${nonce}">${FRAME_BOOTSTRAP}</script>`;
    const channel = new MessageChannel();
    let settled = false;
    let phase = "FRAME";
    let isolationProof: Record<string, unknown> = {};
    let computeTimer: number | undefined;
    const cleanup = () => {
      window.clearTimeout(bootTimer);
      if (computeTimer !== undefined) window.clearTimeout(computeTimer);
      signal?.removeEventListener("abort", abort);
      channel.port1.postMessage({ kind: "dispose" });
      channel.port1.close(); channel.port2.close(); frame.remove();
    };
    const fail = (code: string) => { if (settled) return; settled = true; cleanup(); reject(new OfflineCompartmentError(code)); };
    const abort = () => fail("ABORTED");
    const bootTimer = window.setTimeout(() => fail(`BOOT_TIMEOUT_${phase}`), 20000);
    signal?.addEventListener("abort", abort, { once: true });
    channel.port1.onmessage = (event: MessageEvent) => {
      if (settled) return;
      const data = event.data;
      if (data?.kind === "frame-ready" && phase === "FRAME") {
        if (!data.proof?.parentDenied || !data.proof?.storageDenied || !data.proof?.cookieDenied) { fail("FRAME_ISOLATION_FAILED"); return; }
        isolationProof = { ...data.proof };
        phase = "RUNTIME"; channel.port1.postMessage({ kind: "boot", assets, limits: DEFAULT_BOT_LIMITS, seed: request.seed }, Object.values(assets)); return;
      }
      if (data?.kind === "booted") {
        if (phase !== "RUNTIME" || !data.proof?.memoryMaximumEnforced || !data.proof?.networkDenied || !data.proof?.storageAbsent || data.proof.memoryMaximumPages !== DEFAULT_BOT_LIMITS.wasmMemoryPages) { fail("RUNTIME_ISOLATION_FAILED"); return; }
        phase = "COMPUTE";
        isolationProof = { ...isolationProof, ...data.proof };
        window.clearTimeout(bootTimer);
        computeTimer = window.setTimeout(() => fail("TURN_TIMEOUT"), preflight ? DEFAULT_BOT_LIMITS.preflightMs : DEFAULT_BOT_LIMITS.perTurnMs);
        channel.port1.postMessage({ kind: "run", payload: JSON.stringify(request) });
        return;
      }
      if (data?.kind === "compute-started" && phase === "COMPUTE") { onComputeStarted?.(); return; }
      if (data?.kind !== "result" || data.ok !== true) { fail(typeof data?.code === "string" ? data.code : "BOT_WORKER_FAILED"); return; }
      try {
        if (typeof data.text !== "string" || new TextEncoder().encode(data.text).length > DEFAULT_BOT_LIMITS.outputBytes) throw new OfflineCompartmentError("OUTPUT_BUDGET");
        const result = JSON.parse(data.text) as BotInvocationResult;
        const computeMs = Number(data.computeMs);
        if (!Number.isFinite(computeMs) || computeMs < 0 || computeMs > (preflight ? DEFAULT_BOT_LIMITS.preflightMs : DEFAULT_BOT_LIMITS.perTurnMs)) throw new OfflineCompartmentError("TURN_TIMEOUT");
        // Reuse the SDK legal-move/finite-JSON/depth/byte checks at the host boundary.
        const harness = createIsolatedRuntimeHarness({ profile: { isolation: "PYODIDE_MODULE_WORKER", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false }, execute: async () => result });
        void harness.runTurn(request, signal ?? { aborted: false }).then((validated) => {
          if (settled) return;
          settled = true; cleanup(); resolve({ ...validated, computeMs, isolationProof });
        }).catch(() => fail("ILLEGAL_OUTPUT"));
      } catch (error) { fail(error instanceof OfflineCompartmentError ? error.code : "ILLEGAL_OUTPUT"); }
    };
    frame.onload = () => {
      if (settled) return;
      frame.contentWindow?.postMessage({ kind: "OTT_OFFLINE_INIT", workerSource }, "*", [channel.port2]);
    };
    document.body.append(frame);
    if (signal?.aborted) abort();
  });
}
