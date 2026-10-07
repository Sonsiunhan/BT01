export const OFFLINE_KIT_VERSION = "r11-pyodide-0.27.3";
export const OFFLINE_KIT_CACHE = `ottv2-offline-kit-${OFFLINE_KIT_VERSION}`;
export const OFFLINE_KIT_ASSETS = [
  "/pyodide/pyodide.mjs",
  "/pyodide/pyodide.asm.js",
  "/pyodide/pyodide.asm.wasm",
  "/pyodide/python_stdlib.zip",
  "/pyodide/pyodide-lock.json",
] as const;

export type OfflineKitStatus = {
  version: string;
  ready: boolean;
  cached: number;
  total: number;
  missing: readonly string[];
  message: string;
};

async function cache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  return caches.open(OFFLINE_KIT_CACHE);
}

export async function getOfflineKitStatus(): Promise<OfflineKitStatus> {
  const current = await cache();
  if (!current) return { version: OFFLINE_KIT_VERSION, ready: false, cached: 0, total: OFFLINE_KIT_ASSETS.length, missing: [...OFFLINE_KIT_ASSETS], message: "Trình duyệt chưa hỗ trợ bộ nhớ Offline kit." };
  const missing: string[] = [];
  for (const asset of OFFLINE_KIT_ASSETS) if (!(await current.match(asset))) missing.push(asset);
  const cached = OFFLINE_KIT_ASSETS.length - missing.length;
  return { version: OFFLINE_KIT_VERSION, ready: missing.length === 0, cached, total: OFFLINE_KIT_ASSETS.length, missing, message: missing.length === 0 ? "Offline kit đã sẵn sàng trên thiết bị này." : "Offline kit chưa đủ; hãy tải lại khi có mạng." };
}

export async function installOfflineKit(onProgress?: (done: number, total: number) => void): Promise<OfflineKitStatus> {
  const current = await cache();
  if (!current) throw new Error("OFFLINE_CACHE_UNAVAILABLE");
  let done = 0;
  for (const asset of OFFLINE_KIT_ASSETS) {
    const response = await fetch(asset, { cache: "no-store" });
    if (!response.ok) throw new Error(`OFFLINE_KIT_ASSET_FAILED:${asset}`);
    await current.put(asset, response.clone());
    done += 1;
    onProgress?.(done, OFFLINE_KIT_ASSETS.length);
  }
  return getOfflineKitStatus();
}

export async function clearOfflineKit(): Promise<void> {
  if (typeof caches !== "undefined") await caches.delete(OFFLINE_KIT_CACHE);
}

/** Public runtime assets only; never cache API/SSE/private bot source. */
export function registerOfflineServiceWorker(): void {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator && window.isSecureContext) void navigator.serviceWorker.register("/offline-sw.js", { scope: "/" }).catch(() => undefined);
}
