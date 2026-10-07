/* global self, caches, URL, fetch */
const STATIC_CACHE = "ottv2-shell-v11";
const PUBLIC_ASSET = /^\/(?:assets\/[a-zA-Z0-9_.-]+\.(?:js|css|png|svg|woff2?|ttf)|fonts\/[a-zA-Z0-9_.-]+\.(?:woff2?|ttf|otf)|pyodide\/(?:pyodide\.mjs|pyodide\.asm\.js|pyodide\.asm\.wasm|python_stdlib\.zip|pyodide-lock\.json))$/;
// Fonts may load before this worker controls the first page and then bypass fetch
// via the browser font cache. Pin the public local font set during installation.
const SHELL_FONTS = [
  ...[400, 500, 600, 700, 800, 900].map((weight) => `/fonts/be-vietnam-pro-${weight}.ttf`),
  ...[500, 600, 700].map((weight) => `/fonts/space-grotesk-${weight}.ttf`),
];
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(["/", ...SHELL_FONTS]);
    // Generated from this build only. Never enumerate APIs or cache a private
    // source response. Cache lazy chunks before the initial document closes.
    const response = await fetch("/offline-assets.json", { cache: "no-store" });
    if (!response.ok) return; // Development server has no build manifest.
    const manifest = await response.json();
    if (!Array.isArray(manifest.assets) || manifest.assets.length > 512 || manifest.assets.some(path => typeof path !== "string" || !/^\/assets\/[a-zA-Z0-9_.-]+\.(?:js|css|png|svg|woff2?|ttf)$/.test(path))) throw new Error("INVALID_PUBLIC_CACHE_MANIFEST");
    await cache.addAll(manifest.assets);
  })());
});
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.includes("/sse")) return;
  if (!PUBLIC_ASSET.test(url.pathname) && url.pathname !== "/" && request.mode !== "navigate") return;
  event.respondWith((async () => {
    if (request.mode === "navigate" || url.pathname === "/") {
      try {
        const response = await fetch(request);
        if (response.ok) {
          try { await (await caches.open(STATIC_CACHE)).put(request, response.clone()); }
          catch { /* Navigation remains available when storage is full. */ }
        }
        return response;
      } catch (error) {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request) ?? await cache.match("/") ?? await caches.match(request);
        if (cached) return cached;
        throw error;
      }
    }
    // Public immutable build assets are identical for all request Origins.
    // Vite/hosting CORS can emit Vary: Origin; precache requests and module/font
    // requests have different Origin headers despite sharing this same URL.
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    const response = await fetch(request);
    // Complete the write within the fetch event lifetime, before a page can close.
    if (response.ok) {
      try { await (await caches.open(STATIC_CACHE)).put(request, response.clone()); }
      catch { /* Online response remains usable if the device cache is unavailable. */ }
    }
    return response;
  })());
});
