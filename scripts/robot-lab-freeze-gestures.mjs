import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

// Extract only verified styles from the original, untrusted demo. Never execute its scripts.
const sourcePath = resolve("C:/Users/Admin/.codex/visualizations/2026/09/26/01a0dc09-a9e7-7943-a3ec-1b2dcbe866e2/ott-robot-lab-board-v02.html");
const source = await readFile(sourcePath, "utf8");
const rule = (selector) => {
  const start = source.indexOf(`${selector}{`);
  if (start < 0) throw new Error(`Original artwork rule missing: ${selector}`);
  return source.slice(start + selector.length + 1, source.indexOf("}", start));
};
const symbol = rule("#ott-robot-lab-board .rl-symbol");
const white = rule('#ott-robot-lab-board .rl-window[data-hand="white"] .rl-symbol');
const cuff = rule('#ott-robot-lab-board .rl-window[data-hand="white"] .rl-piece .rl-cuff');
for (const css of [symbol, white, cuff]) {
  if (/[<>{}]|url\(|@|expression\(/i.test(css)) throw new Error("External or executable artwork CSS rejected");
}
const output = "apps/web/src/assets/pieces";
await mkdir(output, { recursive: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = { source: sourcePath, sourceSha256: sha256(source), extraction: "Original demo Segoe UI Emoji rendering frozen at 4x DPI; no live font, emoji filter or network dependency in application", files: [] };
if (process.argv.includes("--check")) {
  const recorded = JSON.parse(await readFile(`${output}/provenance.json`, "utf8"));
  if (recorded.sourceSha256 !== manifest.sourceSha256) throw new Error("Original reference source has changed");
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 4 });
  for (const [gesture, glyph] of Object.entries({ fist: "✊", palm: "✋", peace: "✌️" })) {
    for (const token of [false, true]) {
      const dimension = token ? 52 : 40;
      await page.setContent(`<style>html,body{margin:0;background:transparent}.capture{width:${dimension}px;height:${dimension}px;position:relative;display:grid;place-items:center}.symbol{${symbol};font-size:34px;${white}}.cuff{${cuff}}</style><div class="capture"><span class="symbol">${glyph}</span>${token ? '<span class="cuff"></span>' : ""}</div>`);
      await page.evaluate(() => document.fonts.ready);
      const bytes = await page.locator(".capture").screenshot({ omitBackground: true, animations: "disabled" });
      const name = `white-glove-${gesture}${token ? "-token" : ""}.png`;
      if (process.argv.includes("--check")) {
        const existing = await readFile(`${output}/${name}`);
        if (sha256(existing) !== sha256(bytes)) throw new Error(`${name}: original render differs from frozen artwork`);
      } else await writeFile(`${output}/${name}`, bytes);
      manifest.files.push({ name, sha256: sha256(bytes), width: dimension * 4, height: dimension * 4, glyph, token });
    }
  }
} finally { await browser.close(); }
if (!process.argv.includes("--check")) await writeFile(`${output}/provenance.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${process.argv.includes("--check") ? "Verified" : "Captured"} six original demo gesture assets; source scripts never executed.`);
