import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { parseGeneratedBotRuntimeConfig } from "../../src/config/bot-runtime.js";
import { DEFAULT_CPYTHON_WASM_SHA256, DEFAULT_WASMTIME_LINUX_SHA256 } from "../../src/modules/bot-online/wasmtime.adapter.js";

const config = { status: "PROVEN", consumerPreflightPassed: true, wasmtimePath: "bot-runtime/wasmtime/wasmtime", cpythonDir: "bot-runtime/cpython", wasmtimeSha256: DEFAULT_WASMTIME_LINUX_SHA256, cpythonWasmSha256: DEFAULT_CPYTHON_WASM_SHA256 };
describe("build runtime handoff", () => {
  it("resolves verified artifacts relative to the deployed dist, not build temporary paths", () => {
    expect(parseGeneratedBotRuntimeConfig(config, "/deployed/dist")?.cpythonDir).toBe(resolve("/deployed/dist", "bot-runtime/cpython"));
  });
  it("requires real consumer preflight and pinned hashes", () => {
    expect(parseGeneratedBotRuntimeConfig({ ...config, consumerPreflightPassed: false }, "/deployed/dist")).toBeUndefined();
    expect(parseGeneratedBotRuntimeConfig({ ...config, wasmtimeSha256: "a".repeat(64) }, "/deployed/dist")).toBeUndefined();
    expect(parseGeneratedBotRuntimeConfig({ ...config, status: "NOT_PROVEN" }, "/deployed/dist")).toBeUndefined();
  });
  it("rejects paths outside the deployed artifact directory", () => {
    for (const wasmtimePath of ["../secret", "/tmp/wasmtime", "bot-runtime/../../secret"]) expect(parseGeneratedBotRuntimeConfig({ ...config, wasmtimePath }, "/deployed/dist")).toBeUndefined();
  });
});
