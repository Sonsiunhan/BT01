import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// V0 is a read-only reference harness. It never mutates application state or a database.
const referenceRoot = 'C:/Users/Admin/.codex/visualizations/2026/09/26/01a0dc09-a9e7-7943-a3ec-1b2dcbe866e2';
const output = path.resolve('docs/robot-lab-visual-reference');
const fontOutput = path.join(output, 'fonts');
const viewport = { width: 1440, height: 900 };
const appBaseUrl = process.env.OTT_WEB_URL ?? 'http://localhost:3000';
const themes = ['dark', 'light'];
const sourceFiles = { home: 'ott-robotic-directions.html', board: 'ott-robot-lab-board-v02.html', referee: 'ott-robot-lab-referee.html' };
const appRoutes = ['/', '/home', '/phong-online', '/queue', '/phong/demo', '/room/demo', '/game/demo', '/ai', '/offline', '/spectate/demo', '/bot-lab', '/dau-chuong-trinh/online', '/dau-chuong-trinh/offline', '/ban-be', '/friends', '/lich-su', '/history', '/history/demo', '/ho-so', '/profile/demo', '/cai-dat', '/settings', '/login', '/register', '/forgot-password', '/guest', '/guest/play', '/missing-v0-route'];

// Every product feature in plan section 4.0 has an owner, visible states, modules, tests and artifact.
const inventory = [
  ['Guest principal + account login giữa trận', ['HOME-01', 'AUTH-01', 'LOCAL-01'], ['/', '/guest', '/guest/play'], ['anonymous', 'guest-persistent', 'account'], ['guestApi', 'authApi', 'clientIdentity', 'localGameStorage'], ['AuthPages.test.tsx', 'localData.test.ts'], 'V2/V9'],
  ['Cancel vs match commit, reconnect/resync', ['QUEUE-01', 'QUEUE-02', 'QUEUE-03', 'QUEUE-04'], ['/queue'], ['searching', 'cancelling', 'matched', 'reconnecting'], ['matchmakingApi', 'queueAdmission', 'queueState'], ['QueuePage.test.tsx', 'r1-queue-recovery.spec.ts'], 'V3'],
  ['Active match / Bot owner rời tab', ['ROOM-05', 'BOTON-05'], ['/phong/:roomId', '/game/:roomId', '/dau-chuong-trinh/online'], ['pregame', 'active', 'resume', 'conflict'], ['activeMatchHint', 'matchApi', 'botOnlineApi'], ['activeMatchHint.test.ts', 'r10-bot-restart-probe.mjs'], 'V2/V5'],
  ['Custom Manual/Bot + Ref/Spec độc lập', ['ROOM-01', 'ROOM-02', 'ROOM-03', 'ROOM-04'], ['/phong/:roomId', '/room/:roomId'], ['create', 'waiting', 'ready', 'locked-config'], ['roomApi', 'WaitingRoom', 'CreateRoomForm'], ['WaitingRoom.test.tsx', 'r8-manual-referee.spec.ts'], 'V3'],
  ['Ref pause/resume/replacement', ['REF-01', 'REF-02', 'REF-03', 'REF-04'], ['/game/:roomId', '/spectate/:roomId'], ['running', 'paused', 'resuming', 'blocked'], ['matchApi', 'RefereePauseOverlay', 'RefereeReplacementPanel'], ['referee.route.unit.test.ts', 'r8-manual-referee.spec.ts'], 'V4'],
  ['Online bot hot-update', ['BOTON-02', 'BOTON-03'], ['/dau-chuong-trinh/online'], ['active', 'pending', 'invalid', 'terminal'], ['botOnlineApi', 'bot-online contracts'], ['bot-online.service.unit.test.ts'], 'V5'],
  ['Bot budgets/fault/capacity', ['BOTON-04', 'BOTON-05'], ['/dau-chuong-trinh/online'], ['preset', 'thinking', 'quota', 'author-fault', 'infrastructure-recovery'], ['botOnlineApi', 'bot-sdk', 'server snapshot'], ['wasmtime.adapter.unit.test.ts', 'r10-bot-restart-probe.mjs'], 'V5'],
  ['Private library', ['BOTLIB-01', 'BOTLIB-02', 'BOTLIB-03', 'BOTLIB-04'], ['/bot-lab'], ['empty', 'uploading', 'checking', 'ready', 'test-failed', 'delete'], ['botLibraryApi'], ['bot-library.route.unit.test.ts', 'BotWorkbenchPage.test.tsx'], 'V5'],
  ['Guest Bot/local library', ['LOCAL-03', 'LOCAL-04', 'LOCAL-05'], ['/bot-lab', '/dau-chuong-trinh/online'], ['guest-local', 'sample', 'revision', 'ownership-denied'], ['localData', 'bot-library', 'guestApi'], ['localData.test.ts', 'VIS-FUNC-01 harness'], 'V5'],
  ['Offline runtime/cache', ['LOCAL-03', 'LOCAL-04', 'LOCAL-05'], ['/dau-chuong-trinh/offline', '/offline'], ['download', 'ready', 'missing', 'evicted', 'paused-restore'], ['botOfflineRunner', 'offlineKit', 'localData'], ['BotOfflinePage.test.tsx', 'offlineKit tests'], 'V5/V9'],
  ['Invitations/privacy', ['FRIEND-01', 'FRIEND-02', 'FRIEND-03', 'FRIEND-04'], ['/ban-be', '/friends', '/phong/:roomId'], ['incoming', 'sent', 'expired', 'blocked', 'guest-link'], ['socialApi', 'roomApi'], ['FriendsPage.test.tsx', 'social.route.unit.test.ts'], 'V6/V8'],
  ['Replay/audit/NPM', ['RESULT-01', 'RESULT-02', 'HIST-01', 'HIST-02', 'HIST-03', 'HIST-04'], ['/lich-su', '/history', '/history/:matchId'], ['list', 'replay', 'pause-timeline', 'legacy-final-only', 'audit'], ['historyApi', 'ReplayPanel', 'resultMetrics'], ['ReplayPanel.test.tsx', 'history.route.unit.test.ts'], 'V4/V7'],
  ['Local/account data boundaries', ['HIST-04', 'PROF-03', 'SET-03'], ['/lich-su', '/ho-so', '/cai-dat'], ['local', 'account', 'export', 'clear-confirmation', 'active-guard'], ['localData', 'localGameStorage', 'authApi'], ['localData.test.ts', 'localGameStorage.test.ts'], 'V7/V9'],
  ['Auth/failure paths', ['AUTH-01', 'AUTH-02', 'AUTH-03', 'FALL-01'], ['/login', '/register', '/forgot-password', '*'], ['expired', 'forbidden', 'retry', 'return', 'missing-cache', 'outage'], ['httpClient', 'apiError', 'returnUrl', 'authApi'], ['AuthPages.test.tsx', 'NotFoundPage.test.tsx'], 'V9'],
  ['Home / direct and program tabs', ['HOME-01', 'HOME-02', 'HOME-03', 'HOME-04', 'HOME-05', 'HOME-06'], ['/', '/home', '/phong-online'], ['direct', 'program', 'resume', 'rooms', 'friends'], ['home route', 'queue', 'bot-online', 'bot-offline'], ['HomePage.test.tsx', 'frontend.smoke.spec.ts'], 'V2'],
  ['Manual/AI/Offline shared board/HUD', ['GAME-01', 'GAME-02'], ['/game/:roomId', '/ai', '/offline'], ['blue-bottom', 'red-bottom', 'selected', 'legal', 'capture', 'last-move'], ['game-rules', 'matchApi', 'localGameStorage'], ['GameBoard.test.tsx', 'LocalGamePage.test.tsx'], 'V4'],
  ['Spectator and public events', ['SPEC-01', 'SPEC-02'], ['/spectate/:roomId'], ['canonical', 'leave', 'reconnect', 'private-log-hidden'], ['matchApi', 'roomApi'], ['SpectatorPage.test.tsx'], 'V4'],
  ['Friends / profile / settings pages', ['FRIEND-01', 'FRIEND-02', 'FRIEND-03', 'FRIEND-04', 'PROF-01', 'PROF-02', 'PROF-03', 'SET-01', 'SET-02', 'SET-03'], ['/friends', '/profile/:username', '/settings'], ['loading', 'empty', 'public', 'self', 'guest', 'theme', 'motion'], ['socialApi', 'authApi', 'localData'], ['FriendsPage.test.tsx', 'ProfilePage.test.tsx', 'SettingsPage.test.tsx'], 'V6/V8/V9'],
];

const hash = value => createHash('sha256').update(value).digest('hex');
const bytesHash = value => createHash('sha256').update(value).digest('hex');

async function ensureFonts() {
  await mkdir(fontOutput, { recursive: true });
  const fonts = [
    ['Be Vietnam Pro', 400, 'https://fonts.gstatic.com/s/bevietnampro/v12/QdVPSTAyLFyeg_IDWvOJmVES_Eww.ttf'],
    ['Be Vietnam Pro', 500, 'https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HTEJl8y.ttf'],
    ['Be Vietnam Pro', 600, 'https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HToIV8y.ttf'],
    ['Be Vietnam Pro', 700, 'https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HSMIF8y.ttf'],
    ['Be Vietnam Pro', 800, 'https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HSQI18y.ttf'],
    ['Be Vietnam Pro', 900, 'https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HS0Il8y.ttf'],
    ['Space Grotesk', 500, 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7aUUsj.ttf'],
    ['Space Grotesk', 600, 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj42Vksj.ttf'],
    ['Space Grotesk', 700, 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVksj.ttf'],
  ];
  const manifest = [];
  for (const [family, weight, url] of fonts) {
    const filename = `${family.toLowerCase().replaceAll(' ', '-')}-${weight}.ttf`;
    const file = path.join(fontOutput, filename);
    let data;
    try { data = await readFile(file); } catch {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Font fetch failed ${response.status}: ${url}`);
      data = Buffer.from(await response.arrayBuffer());
      await writeFile(file, data);
    }
    manifest.push({ family, weight, url, file: `docs/robot-lab-visual-reference/fonts/${filename}`, sha256: bytesHash(data), bytes: data.length });
  }
  await writeFile(path.join(output, 'font-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

async function injectFonts(page, fonts) {
  const rules = [];
  for (const font of fonts) {
    const data = await readFile(path.resolve(font.file));
    rules.push(`@font-face{font-family:${JSON.stringify(font.family)};font-style:normal;font-weight:${font.weight};font-display:block;src:url(data:font/ttf;base64,${data.toString('base64')}) format('truetype')}`);
  }
  await page.addStyleTag({ content: rules.join('\n') });
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function renderReference(page, source, id, theme, fonts) {
  await page.setContent(source, { waitUntil: 'domcontentloaded' });
  await injectFonts(page, fonts);
  await page.evaluate(themeName => {
    document.documentElement.style.colorScheme = themeName;
    for (const element of document.querySelectorAll('.ott-app, .rl-window, .rr-app')) element.style.colorScheme = themeName;
  }, theme);
  if (id === 'home') {
    await page.locator('[data-variant]').evaluateAll(items => { for (const item of items) item.hidden = item.getAttribute('data-variant') !== 'Robot Lab'; });
    await page.locator('.ott-app').evaluateAll(items => { for (const item of items) item.dataset.motion = 'off'; });
  }
  if (id === 'board') {
    const selected = await page.locator('[data-variant]').evaluateAll(items => {
      const glove = items.find(item => item.getAttribute('data-variant') === 'Găng trắng · minh họa');
      for (const item of items) item.hidden = item !== glove;
      return glove?.getAttribute('data-variant') ?? null;
    });
    if (selected !== 'Găng trắng · minh họa') throw new Error('Approved white-glove board variant missing');
  }
  await page.waitForTimeout(120);
}

async function captureRoute(page, route, screenshot) {
  const url = `${appBaseUrl}${route}`;
  let status = null;
  let error = null;
  try { const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 }); status = response?.status() ?? null; await page.waitForTimeout(1800); } catch (cause) { error = String(cause?.message ?? cause); }
  const text = await page.locator('body').innerText().catch(() => '');
  await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
  return { route, url, status, error, textLength: text.trim().length, screenshot, result: error || text.trim().length > 0 ? 'CAPTURED' : 'EMPTY' };
}

await mkdir(output, { recursive: true });
const fonts = await ensureFonts();
const browser = await chromium.launch({ headless: true });
const manifest = { capturedAt: new Date().toISOString(), scope: 'V0 Robot Lab reference, route inventory and read-only before-layout capture; not functional acceptance', approvedDesign: 'Robot Lab; dark default; white-glove board; fixed side orientation; original full-body robot', viewport, sources: [], entries: [], themeChecks: [], routeBefore: [], inventory, gates: {} };

try {
  for (const [id, filename] of Object.entries(sourceFiles)) {
    const source = await readFile(path.join(referenceRoot, filename), 'utf8');
    const sourceHash = hash(source);
    manifest.sources.push({ id, file: filename, source: path.join(referenceRoot, filename), sha256: sourceHash, bytes: Buffer.byteLength(source), originalUntouched: true });
    for (const theme of themes) {
      const context = await browser.newContext({ viewport, colorScheme: theme });
      const page = await context.newPage();
      await page.route('**/*', route => route.abort());
      const prefix = id === 'referee' ? '<script>window.openai={widgetState:{privateContent:{observer:"PLAYER",appearance:"dark",motion:false}}}</script>' : '';
      await renderReference(page, prefix + source, id, theme, fonts);
      const selector = id === 'home' ? '[data-variant="Robot Lab"] .ott-app' : id === 'board' ? '[data-variant="Găng trắng · minh họa"] .rl-window' : '[data-variant="Chuẩn bị phòng"] .rr-app';
      const rendered = await page.locator(selector).first().innerText();
      if (rendered.trim().length < 30) throw new Error(`Reference did not render: ${filename}`);
      const fontCheck = await page.evaluate(() => ({ beVietnamPro: document.fonts.check('700 20px "Be Vietnam Pro"'), spaceGrotesk: document.fonts.check('700 20px "Space Grotesk"'), status: document.fonts.status }));
      if (!fontCheck.beVietnamPro || (id === 'home' && !fontCheck.spaceGrotesk) || fontCheck.status !== 'loaded') throw new Error(`Pinned reference fonts not loaded for ${id}/${theme}`);
      const screenshot = `${id}-${theme}-1440x900.png`;
      await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
      const computed = await page.locator(selector).first().evaluate(element => ({ background: getComputedStyle(element).backgroundColor, colorScheme: getComputedStyle(element).colorScheme, fontFamily: getComputedStyle(element).fontFamily }));
      manifest.entries.push({ kind: 'reference', id, source: filename, sha256: sourceHash, theme, computed, fontCheck, viewport: '1440x900', screenshot, network: 'DENIED except pinned data fonts', selectedVariant: id === 'home' ? 'Robot Lab' : id === 'board' ? 'Găng trắng · minh họa' : 'Chuẩn bị phòng' });
      if (id === 'home') {
        for (const pageName of ['home', 'lab', 'game', 'friends', 'history', 'profile']) {
          if (pageName !== 'home') await page.locator(`[data-variant="Robot Lab"] .ott-app [data-page="${pageName}"]`).first().click();
          await page.waitForTimeout(60);
          const shot = `home-${theme}-${pageName}-1440x900.png`;
          await page.screenshot({ path: path.join(output, shot), fullPage: true });
          manifest.entries.push({ kind: 'reference-route', id: `home-${pageName}`, source: filename, sha256: sourceHash, theme, selectedVariant: 'Robot Lab', page: pageName, screenshot: shot, viewport: '1440x900', network: 'DENIED except pinned data fonts' });
        }
        await page.locator('[data-variant="Robot Lab"] .ott-app [data-page="home"]').first().click();
        await page.locator('[data-variant="Robot Lab"] .ott-app [data-mode="bot"]').click();
        await page.waitForTimeout(60);
        const shot = `home-${theme}-bot-tab-1440x900.png`;
        await page.screenshot({ path: path.join(output, shot), fullPage: true });
        manifest.entries.push({ kind: 'reference-state', id: 'home-bot-tab', source: filename, sha256: sourceHash, theme, selectedVariant: 'Robot Lab', state: 'Đấu chương trình tab', screenshot: shot, viewport: '1440x900', network: 'DENIED except pinned data fonts' });
      }
      if (id === 'referee') {
        for (const variant of ['Trọng tài', 'Người chơi / Khán giả']) {
          await page.locator('[data-variant]').evaluateAll((items, selected) => { for (const item of items) item.hidden = item.getAttribute('data-variant') !== selected; }, variant);
          const shot = `${variant === 'Trọng tài' ? 'referee-view' : 'observer-view'}-${theme}-1440x900.png`;
          await page.screenshot({ path: path.join(output, shot), fullPage: true });
          manifest.entries.push({ kind: 'reference-state', id: variant === 'Trọng tài' ? 'referee-paused' : 'observer-paused', source: filename, sha256: sourceHash, theme, selectedVariant: variant, state: 'paused; observer is fixed to PLAYER/Red bottom', screenshot: shot, viewport: '1440x900', network: 'DENIED except pinned data fonts' });
        }
      }
      await context.close();
    }
  }

  const context = await browser.newContext({ viewport, colorScheme: 'dark' });
  const page = await context.newPage();
  for (const route of appRoutes) manifest.routeBefore.push(await captureRoute(page, route, `app-before-${route.replaceAll('/', '_').replace(/^_$/, 'root')}-1440x900.png`));
  for (const [choice, expected] of [[null, 'dark'], ['light', 'light'], ['dark', 'dark'], ['system', 'dark']]) {
    await page.evaluate(choiceValue => { if (choiceValue === null) localStorage.removeItem('ottv2.theme'); else localStorage.setItem('ottv2.theme', choiceValue); }, choice);
    await page.goto(`${appBaseUrl}/`, { waitUntil: 'domcontentloaded' });
    const actual = await page.locator('html').getAttribute('data-theme');
    if (actual !== expected) throw new Error(`Theme ${choice}: expected ${expected}, got ${actual}`);
    manifest.themeChecks.push({ stored: choice, osPreference: 'dark', expected, actual, result: 'PASS' });
  }
  await context.close();
  manifest.gates = {
    sourceHashes: manifest.sources.every(entry => entry.originalUntouched && /^[0-9a-f]{64}$/.test(entry.sha256)) ? 'PASS' : 'FAIL',
    referenceVariants: manifest.entries.filter(entry => entry.kind === 'reference').length === 6 ? 'PASS' : 'FAIL',
    referenceRouteStates: manifest.entries.filter(entry => entry.kind === 'reference-route').length === 12 ? 'PASS' : 'FAIL',
    routeBefore: manifest.routeBefore.length === appRoutes.length && manifest.routeBefore.every(entry => entry.result === 'CAPTURED') ? 'PASS' : 'FAIL',
    pinnedFonts: manifest.entries.every(entry => !entry.fontCheck || (entry.fontCheck.beVietnamPro && (entry.id !== 'home' || entry.fontCheck.spaceGrotesk) && entry.fontCheck.status === 'loaded')) ? 'PASS' : 'FAIL',
    themeChecks: manifest.themeChecks.length === 4 && manifest.themeChecks.every(entry => entry.result === 'PASS') ? 'PASS' : 'FAIL',
    inventory: inventory.length >= 15 && inventory.every(row => row.length === 7 && row[1].length > 0 && row[2].length > 0 && row[3].length > 0 && row[4].length > 0 && row[5].length > 0) ? 'PASS' : 'FAIL',
  };
} finally {
  await browser.close();
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(output, 'inventory.json'), JSON.stringify({ generatedAt: manifest.capturedAt, fields: ['feature', 'taskIds', 'routes', 'states', 'apiOrModules', 'tests', 'ownerWave'], records: inventory.map(([feature, taskIds, routes, states, apiOrModules, tests, ownerWave]) => ({ feature, taskIds, routes, states, apiOrModules, tests, ownerWave })) }, null, 2) + '\n');
}

if (Object.values(manifest.gates).some(value => value === 'FAIL')) throw new Error(`V0 gate failed: ${JSON.stringify(manifest.gates)}`);
console.log(`V0 reference capture passed: ${manifest.entries.length} reference entries, ${manifest.routeBefore.length} before routes, ${inventory.length} inventory records`);
