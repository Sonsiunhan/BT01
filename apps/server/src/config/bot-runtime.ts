import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CPYTHON_WASM_SHA256, DEFAULT_WASMTIME_LINUX_SHA256 } from "../modules/bot-online/wasmtime.adapter.js";

type GeneratedRuntimeConfig = Readonly<{
  status: unknown;
  consumerPreflightPassed: unknown;
  wasmtimePath: unknown;
  cpythonDir: unknown;
  wasmtimeSha256: unknown;
  cpythonWasmSha256: unknown;
}>;

export type BotRuntimeOptions = Readonly<{
  wasmtimePath: string;
  cpythonDir: string;
  wasmtimeSha256: string;
  cpythonWasmSha256: string;
}>;

function inside(baseDir: string, candidate: string): boolean {
  const relativePath = relative(baseDir, candidate);
  return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

export function parseGeneratedBotRuntimeConfig(value: unknown, deployedDist: string): BotRuntimeOptions | undefined {
  if (!value || typeof value !== "object") return undefined;
  const config = value as GeneratedRuntimeConfig;
  if (config.status !== "PROVEN" || config.consumerPreflightPassed !== true) return undefined;
  if (typeof config.wasmtimePath !== "string" || typeof config.cpythonDir !== "string") return undefined;
  if (typeof config.wasmtimeSha256 !== "string" || typeof config.cpythonWasmSha256 !== "string") return undefined;
  if (config.wasmtimeSha256 !== DEFAULT_WASMTIME_LINUX_SHA256 || config.cpythonWasmSha256 !== DEFAULT_CPYTHON_WASM_SHA256) return undefined;
  if (isAbsolute(config.wasmtimePath) || isAbsolute(config.cpythonDir)) return undefined;
  const baseDir = resolve(deployedDist);
  const wasmtimePath = resolve(baseDir, config.wasmtimePath);
  const cpythonDir = resolve(baseDir, config.cpythonDir);
  if (!inside(baseDir, wasmtimePath) || !inside(baseDir, cpythonDir)) return undefined;
  return { wasmtimePath, cpythonDir, wasmtimeSha256: config.wasmtimeSha256, cpythonWasmSha256: config.cpythonWasmSha256 };
}

export async function loadGeneratedBotRuntimeConfig(): Promise<BotRuntimeOptions | undefined> {
  const configUrl = new URL("../bot-runtime-config.json", import.meta.url);
  try {
    const value = JSON.parse(await readFile(fileURLToPath(configUrl), "utf8")) as unknown;
    return parseGeneratedBotRuntimeConfig(value, fileURLToPath(new URL("../", import.meta.url)));
  } catch {
    return undefined;
  }
}
