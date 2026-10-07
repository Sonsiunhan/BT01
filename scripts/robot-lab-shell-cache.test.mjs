import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../apps/web/public/offline-sw.js', import.meta.url), 'utf8');
function harness({ offline = false } = {}) {
  const handlers = new Map();
  const writes = [];
  const stale = new Response('old-build');
  const cache = { match: async () => stale, put: async (_, response) => writes.push(await response.text()) };
  const caches = { match: async () => stale, open: async () => cache };
  runInNewContext(source, { self: { location: { origin: 'https://ott.test' }, addEventListener: (name, fn) => handlers.set(name, fn) }, caches, URL, fetch: async () => { if (offline) throw new Error('offline'); return new Response('new-build'); } });
  return { handlers, writes };
}
test('online navigation bypasses stale HTML and updates the current shell cache', async () => {
  const { handlers, writes } = harness();
  let response;
  handlers.get('fetch')({ request: { url: 'https://ott.test/offline', method: 'GET', mode: 'navigate' }, respondWith: value => { response = value; } });
  assert.equal(await (await response).text(), 'new-build');
  assert.deepEqual(writes, ['new-build']);
});
test('offline navigation retains the last successfully cached shell', async () => {
  const { handlers } = harness({ offline: true });
  let response;
  handlers.get('fetch')({ request: { url: 'https://ott.test/offline', method: 'GET', mode: 'navigate' }, respondWith: value => { response = value; } });
  assert.equal(await (await response).text(), 'old-build');
});
test('API and cross-origin requests never enter the shell cache', () => {
  const { handlers } = harness();
  for (const url of ['https://ott.test/api/private.json', 'https://foreign.test/font.ttf', 'https://ott.test/bot-library/private.json', 'https://ott.test/auth/me.json']) {
    handlers.get('fetch')({ request: { url, method: 'GET', mode: 'cors' }, respondWith: () => assert.fail('private response must not be cached') });
  }
});

test('public module requests reuse precache despite hosting Vary: Origin', async () => {
  const handlers = new Map();
  runInNewContext(source, {
    self: { location: { origin: 'https://ott.test' }, addEventListener: (name, fn) => handlers.set(name, fn) },
    caches: { match: async (_, options) => options?.ignoreVary ? new Response('cached-module') : undefined },
    URL, fetch: async () => { throw new Error('offline'); },
  });
  let response;
  handlers.get('fetch')({ request: { url: 'https://ott.test/assets/main-abc.js', method: 'GET', mode: 'cors' }, respondWith: value => { response = value; } });
  assert.equal(await (await response).text(), 'cached-module');
});

test('installation pre-caches the shell and every generated public lazy chunk', async () => {
  const handlers = new Map(); const batches = [];
  runInNewContext(source, {
    self: { skipWaiting() {}, addEventListener: (name, fn) => handlers.set(name, fn) },
    caches: { open: async () => ({ addAll: async urls => batches.push([...urls]) }) },
    fetch: async () => new Response(JSON.stringify({ assets: ['/assets/BotOffline-abc.js', '/assets/main-abc.css'] })), URL,
  });
  let installed;
  handlers.get('install')({ waitUntil: promise => { installed = promise; } });
  await installed;
  assert.ok(batches[0].includes('/'));
  assert.ok(batches[0].some(path => path.endsWith('.ttf')));
  assert.deepEqual(batches[1], ['/assets/BotOffline-abc.js', '/assets/main-abc.css']);
});

test('installation rejects API/private/cross-origin paths in a forged manifest', async () => {
  for (const path of ['/api/private.json', '/bot-library/private.js', 'https://foreign.test/assets/code.js']) {
    const handlers = new Map(); const batches = [];
    runInNewContext(source, {
      self: { skipWaiting() {}, addEventListener: (name, fn) => handlers.set(name, fn) },
      caches: { open: async () => ({ addAll: async urls => batches.push([...urls]) }) },
      fetch: async () => new Response(JSON.stringify({ assets: [path] })), URL,
    });
    let installed;
    handlers.get('install')({ waitUntil: promise => { installed = promise; } });
    await assert.rejects(installed, /INVALID_PUBLIC_CACHE_MANIFEST/);
    assert.equal(batches.length, 1);
    assert.ok(!batches.flat().includes(path));
  }
});
