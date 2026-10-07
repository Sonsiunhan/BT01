import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  BotOutputValidationError,
  DEFAULT_BOT_LIMITS,
  RuntimeCancelledError,
  type BotInvocationResult,
  type BotLimitManifest,
  type IsolatedRuntimeAdapter,
  type RuntimeAbortSignal,
} from "@ottv2/bot-sdk";
import { buildPythonRunner } from "./python.runner.js";

/**
 * Runtime errors which are not caused by the player are deliberately kept
 * separate from BotOutputValidationError.  BotOnlineService treats these as a
 * fail-closed infrastructure pause rather than awarding a loss.
 */
export class WasmtimeProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WasmtimeProviderError";
  }
}

export class WasmtimeBusyError extends WasmtimeProviderError {
  constructor() { super("Runtime đang phục vụ một lượt khác. Hãy thử lại."); this.name = "WasmtimeBusyError"; }
}

export type WasmtimeCpythonAdapterOptions = Readonly<{
  wasmtimePath: string;
  cpythonDir: string;
  wasmtimeSha256: string;
  cpythonWasmSha256: string;
  limits?: BotLimitManifest;
  workDir?: string;
}>;

const SHA256 = /^[a-f0-9]{64}$/i;
const MAX_CAPTURE_BYTES = DEFAULT_BOT_LIMITS.outputBytes * 4;

// Release pins from docs/r3-runtime-artifacts.json.  Windows deployments may
// override these with BOT_*_SHA256 because the checked-in R3 probe has a
// platform-specific Wasmtime binary digest.
export const DEFAULT_WASMTIME_LINUX_SHA256 = "d0a014e0d5b0cf48dd3549c38e2e6ecd78ff09fb3e3f10d751b87b72bdfd8635";
export const DEFAULT_CPYTHON_WASM_SHA256 = "d24bd98d3071af6b17d51d53a08700b9acef59172a0afcb6adb733645c2a1715";

function assertPath(path: string, name: string): string {
  if (!path || !isAbsolute(path)) throw new WasmtimeProviderError(`${name} phải là đường dẫn tuyệt đối.`);
  return resolve(path);
}

async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function makeReadOnly(path: string): Promise<void> {
  const details = await stat(path);
  if (details.isDirectory()) {
    for (const entry of await readdir(path, { withFileTypes: true })) await makeReadOnly(join(path, entry.name));
    await chmod(path, 0o555).catch(() => undefined);
  } else {
    await chmod(path, 0o444).catch(() => undefined);
  }
}

function parseResult(stdout: string): BotInvocationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    throw new BotOutputValidationError("Bot không trả về JSON hợp lệ.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new BotOutputValidationError("Bot trả về payload không hợp lệ.");
  return parsed as BotInvocationResult;
}

type ChildResult = Readonly<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; outputBytes: number; hostTimedOut: boolean; computeTimedOut: boolean; computeMs: number }>;

async function runChild(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, signal: RuntimeAbortSignal, timeoutMs: number, computeBudgetMs: number): Promise<ChildResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let hostTimedOut = false;
    let computeTimedOut = false;
    let computeStartedAt: number | undefined;
    let settled = false;
    let pollTimer: NodeJS.Timeout | undefined;
    let hostTimer: NodeJS.Timeout | undefined;
    let computeTimer: NodeJS.Timeout | undefined;
    const finish = (result: ChildResult) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (hostTimer) clearTimeout(hostTimer);
      if (computeTimer) clearTimeout(computeTimer);
      resolvePromise(result);
    };
    const kill = () => { try { child.kill("SIGKILL"); } catch { /* already exited */ } };
    const collect = (target: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (Buffer.concat(target).byteLength < MAX_CAPTURE_BYTES) target.push(chunk.subarray(0, MAX_CAPTURE_BYTES));
      if (outputBytes > MAX_CAPTURE_BYTES) kill();
    };
    child.stdout.on("data", (chunk: Buffer) => {
      collect(stdout, chunk);
      // Marker is emitted by the trusted wrapper before author code; author
      // print/import capabilities cannot forge it or reset this host timer.
      if (computeStartedAt === undefined && /^__OTT_STARTED__\r?\n/.test(Buffer.concat(stdout).toString("utf8"))) {
        computeStartedAt = performance.now();
        computeTimer = setTimeout(() => { computeTimedOut = true; kill(); }, computeBudgetMs);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", (error) => { if (!settled) { settled = true; if (pollTimer) clearInterval(pollTimer); if (hostTimer) clearTimeout(hostTimer); if (computeTimer) clearTimeout(computeTimer); rejectPromise(new WasmtimeProviderError(`Không khởi động được Wasmtime: ${String(error.message ?? error)}`)); } });
    child.once("close", (code, childSignal) => finish({ code, signal: childSignal, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), outputBytes, hostTimedOut, computeTimedOut, computeMs: computeStartedAt === undefined ? 0 : Math.max(0, performance.now() - computeStartedAt) }));
    pollTimer = setInterval(() => { if (signal.aborted) kill(); }, 5);
    hostTimer = setTimeout(() => { hostTimedOut = true; kill(); }, Math.max(timeoutMs + 1_500, 2_000));
  });
}

export function createWasmtimeCpythonAdapter(options: WasmtimeCpythonAdapterOptions): IsolatedRuntimeAdapter {
  const wasmtimePath = assertPath(options.wasmtimePath, "wasmtimePath");
  const cpythonDir = assertPath(options.cpythonDir, "cpythonDir");
  if (!SHA256.test(options.wasmtimeSha256) || !SHA256.test(options.cpythonWasmSha256)) throw new WasmtimeProviderError("Runtime pin phải là SHA-256 hợp lệ.");
  const limits = options.limits ?? DEFAULT_BOT_LIMITS;
  const workDir = assertPath(options.workDir ?? join(tmpdir(), "ottv2-bot-turns"), "workDir");
  let verification: Promise<void> | undefined;
  let occupied = false;
  let preflightWaiting = false;

  const verify = async () => {
    if (!await exists(wasmtimePath) || !await exists(join(cpythonDir, "python.wasm"))) throw new WasmtimeProviderError("Thiếu Wasmtime hoặc CPython-WASI artifact.");
    const [wasmtimeDigest, cpythonDigest] = await Promise.all([sha256(wasmtimePath), sha256(join(cpythonDir, "python.wasm"))]);
    if (wasmtimeDigest.toLowerCase() !== options.wasmtimeSha256.toLowerCase()) throw new WasmtimeProviderError("Wasmtime hash không khớp pin.");
    if (cpythonDigest.toLowerCase() !== options.cpythonWasmSha256.toLowerCase()) throw new WasmtimeProviderError("CPython-WASI hash không khớp pin.");
    await mkdir(workDir, { recursive: true });
    await makeReadOnly(cpythonDir);
  };

  return {
    profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
    async execute(request, signal) {
      // One bounded candidate may wait for the current turn. New turns yield
      // admission, not gameplay authority, so hot-update cannot starve forever.
      // Waiting is outside the unchanged sandbox compute/bootstrap budgets.
      if (occupied && request.phase === "PREFLIGHT" && !preflightWaiting) {
        preflightWaiting = true;
        const deadline = performance.now() + 5_000;
        try {
          while (occupied) {
            if (signal.aborted) throw new RuntimeCancelledError();
            if (performance.now() >= deadline) throw new WasmtimeBusyError();
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } finally { preflightWaiting = false; }
      } else if (occupied || preflightWaiting) throw new WasmtimeBusyError();
      if (signal.aborted) throw new RuntimeCancelledError();
      occupied = true;
      try {
      // Bootstrap is independently bounded. The trusted Python wrapper starts
      // the 250/500ms bot budget only after runtime initialization.
      const bootstrapWatchdogMs = 2_000;
      if (signal.aborted) throw new RuntimeCancelledError();
      verification ??= verify();
      await verification;
      if (signal.aborted) throw new RuntimeCancelledError();
      const turnDir = await mkdtemp(join(workDir, "turn-"));
      try {
        await writeFile(join(turnDir, "runner.py"), buildPythonRunner(request), { encoding: "utf8", flag: "wx" });
        await makeReadOnly(turnDir);
        const args = [
          "run",
          "--dir", `${cpythonDir}::/runtime`,
          "--dir", `${turnDir}::/turn`,
          "-W", `fuel=${limits.wasmStartupFuel}`,
          "-W", `timeout=${bootstrapWatchdogMs}ms`,
          "-W", `max-memory-size=${limits.wasmMemoryPages * 64 * 1024}`,
          "-W", "trap-on-grow-failure=y",
          "--env", "PYTHONHASHSEED=0",
          "--env", "TZ=UTC",
          "--env", "PYTHONHOME=/runtime",
          "--env", "PYTHONPATH=/runtime/lib/python3.14",
          "python.wasm",
          "/turn/runner.py",
        ];
        const computeBudgetMs = request.phase === "PREFLIGHT" ? limits.preflightMs : limits.perTurnMs;
        const result = await runChild(wasmtimePath, args, cpythonDir, { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", PYTHONHASHSEED: "0", TZ: "UTC", RAYON_NUM_THREADS: "1" }, signal, bootstrapWatchdogMs, computeBudgetMs);
        if (signal.aborted) throw new RuntimeCancelledError();
        if (result.outputBytes > MAX_CAPTURE_BYTES) throw new BotOutputValidationError("Bot vượt giới hạn output.");
        if (result.hostTimedOut) throw new WasmtimeProviderError("Supervisor không thu hồi được lượt Bot đúng hạn.");
        if (result.computeTimedOut || result.computeMs > computeBudgetMs) throw new BotOutputValidationError("Bot vượt ngân sách tính toán.");
        if (result.code !== 0) {
          if (!result.stdout.startsWith("__OTT_STARTED__\n") && !result.stdout.startsWith("__OTT_STARTED__\r\n")) throw new WasmtimeProviderError("Runtime không hoàn tất khởi tạo tin cậy.");
          const diagnostic = `${result.stderr}\n${result.stdout}`.toLowerCase();
          if (diagnostic.includes("fuel") || diagnostic.includes("timeout") || diagnostic.includes("out of bounds") || diagnostic.includes("trap")) throw new BotOutputValidationError("Bot vượt ngân sách tính toán.");
          throw new BotOutputValidationError("Bot gặp lỗi khi thực thi trong runtime cô lập.");
        }
        return { ...parseResult(result.stdout.replace(/^__OTT_STARTED__\r?\n/, "")), computeMs: result.computeMs };
      } finally {
        await rm(turnDir, { recursive: true, force: true }).catch(() => undefined);
      }
      } finally { occupied = false; }
    },
  };
}

