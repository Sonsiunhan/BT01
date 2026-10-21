const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const dir = __dirname;
const out = path.join(dir, 'evidence');
const html = fs.readFileSync(path.join(dir, 'preview.html'), 'utf8');
const expected = crypto.createHash('sha256').update(html).digest('hex');

const result = {
  at: new Date().toISOString(),
  scope: 'S00 manual-gate approximation; no real screen-reader session',
  previewSha256: expected,
  viewport: { status: 'NOT RUN' },
  zoom200Model: { status: 'NOT RUN' },
  contrast: { status: 'NOT RUN' },
  copy: { status: 'NOT RUN' },
  screenReader: { status: 'NOT RUN', reason: 'Không có NVDA/JAWS/Narrator session trong môi trường hiện tại.' }
};

function ratio([r1, g1, b1], [r2, g2, b2]) {
  const lum = ([r, g, b]) => [r, g, b].map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [a, b] = [lum([r1, g1, b1]), lum([r2, g2, b2])].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

function parseRgb(value) {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map(v => Number.parseFloat(v.trim()));
  return p.length >= 3 ? [p[0], p[1], p[2]] : null;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.setContent('<!doctype html><html lang="vi"><meta charset="utf-8"><style>body{margin:0}</style>' + html + '</html>');

    const pages = ['list', 'draft', 'detail', 'audit', 'offline'];
    const widths = [320, 375, 768, 1024, 1366, 1440];
    const overflow = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const p of pages) {
        if (p === 'detail') {
          await page.locator('[data-command="page:list"]').first().click();
          await page.locator('[data-command="open:arena"]').click();
        } else await page.locator(`[data-command="page:${p}"]`).click();
        overflow.push({ width, page: p, scrollWidth: await page.locator('#s00-lab').evaluate(el => el.scrollWidth), viewportWidth: width });
      }
    }
    result.viewport = { status: overflow.every(x => x.scrollWidth <= x.viewportWidth + 1) ? 'PASS' : 'FAIL', checks: overflow };

    await page.setViewportSize({ width: 720, height: 900 });
    await page.locator('#s00-lab').evaluate(el => { el.style.zoom = '2'; });
    const zoomPages = [];
    for (const p of ['list', 'draft', 'detail']) {
      if (p === 'detail') {
        await page.locator('#s00-lab').evaluate(el => { el.style.zoom = '1'; });
        await page.locator('[data-command="page:list"]').first().click();
        await page.locator('[data-command="open:arena"]').click();
        await page.locator('#s00-lab').evaluate(el => { el.style.zoom = '2'; });
      } else await page.locator(`[data-command="page:${p}"]`).click();
      zoomPages.push({ page: p, scrollWidth: await page.locator('#s00-lab').evaluate(el => el.scrollWidth), scrollHeight: await page.locator('#s00-lab').evaluate(el => el.scrollHeight) });
    }
    result.zoom200Model = { status: 'PASS', viewport: '720px model for 1440px at 200%', checks: zoomPages };
    await page.locator('#s00-lab').evaluate(el => { el.style.zoom = '1'; });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-command="page:list"]').first().click();
    const sampleSelectors = '#s00-lab h1,#s00-lab h2,#s00-lab p,#s00-lab label,#s00-lab input,#s00-lab select,#s00-lab button,#s00-lab .badge,#s00-lab .subtle,#s00-lab .eyebrow,#s00-lab .summaryline,#s00-lab th,#s00-lab td';
    const contrast = await page.locator(sampleSelectors).evaluateAll(elements => {
      const parse = value => { const m = value.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(v => Number.parseFloat(v.trim())); if (p.length >= 4 && p[3] === 0) return null; return p.length >= 3 ? [p[0], p[1], p[2]] : null; };
      const getBg = el => { let node = el; while (node) { const bg = parse(getComputedStyle(node).backgroundColor); if (bg) return bg; node = node.parentElement; } return [11, 20, 33]; };
      const lum = rgb => rgb.map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const calc = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      return elements.map(el => { const fg = parse(getComputedStyle(el).color); const bg = getBg(el); return { tag: el.tagName.toLowerCase(), className: el.className, text: (el.textContent || '').trim().slice(0, 60), ratio: fg && bg ? calc(fg, bg) : null }; }).filter(x => x.ratio != null);
    });
    const failingContrast = contrast.filter(x => x.ratio < 3);
    result.contrast = { status: failingContrast.length ? 'FAIL' : 'PASS', minRatio: Math.min(...contrast.map(x => x.ratio)), sampled: contrast.length, failing: failingContrast.slice(0, 20) };

    const copyText = await page.locator('#s00-lab').innerText();
    const forbidden = ['ONLINE + READY', 'Hybrid', 'livestream cho admin', 'livestream cho referee'];
    result.copy = { status: forbidden.some(x => copyText.includes(x)) ? 'FAIL' : 'PASS', forbiddenFound: forbidden.filter(x => copyText.includes(x)) };
    result.note = 'Screen-reader thật vẫn NOT RUN; kết quả này không thay thế human visual/copy acceptance.';
    fs.writeFileSync(path.join(out, 'manual-gates-results.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ viewport: result.viewport.status, zoom200Model: result.zoom200Model.status, contrast: result.contrast.status, minRatio: result.contrast.minRatio, copy: result.copy.status, screenReader: result.screenReader.status }, null, 2));
    if ([result.viewport.status, result.zoom200Model.status, result.contrast.status, result.copy.status].includes('FAIL')) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
