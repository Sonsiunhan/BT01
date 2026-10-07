import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('docs/robot-lab-visual-reference');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const inventory = JSON.parse(await readFile(path.join(root, 'inventory.json'), 'utf8'));
const expectedSources = {
  'ott-robotic-directions.html': '31e961d0bcda2b929302758c06b6d91c0dbd5ca6a5e4a032bf2435b508b49290',
  'ott-robot-lab-board-v02.html': '518227e9fc32c5fab578b16301d642ff0c5b8855ad09b9eca415aaedc44242b8',
  'ott-robot-lab-referee.html': '1df5df0af87751254181ab01dba0ed34b13d1be29ef43247ea2d4fa55d00af44',
};
const hash = value => createHash('sha256').update(value).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(manifest.approvedDesign.includes('Robot Lab'), 'approved Robot Lab design is not recorded');
assert(manifest.viewport.width === 1440 && manifest.viewport.height === 900, 'reference viewport changed');
assert(manifest.sources.length === 3, 'expected exactly three immutable source references');
for (const source of manifest.sources) {
  assert(expectedSources[source.file] === source.sha256, `source hash drift: ${source.file}`);
  assert(source.originalUntouched === true, `source not marked untouched: ${source.file}`);
}
assert(manifest.gates.sourceHashes === 'PASS', 'source hash gate failed');
assert(manifest.gates.referenceVariants === 'PASS', 'reference variant gate failed');
assert(manifest.gates.referenceRouteStates === 'PASS', 'reference route-state gate failed');
assert(manifest.gates.routeBefore === 'PASS', 'application before-route gate failed');
assert(manifest.gates.pinnedFonts === 'PASS', 'font gate failed');
assert(manifest.gates.themeChecks === 'PASS', 'theme gate failed');
assert(manifest.gates.inventory === 'PASS', 'inventory gate failed');
assert(manifest.themeChecks.length === 4, 'fresh/light/dark/system checks incomplete');
assert(manifest.routeBefore.length === 28, 'before-route inventory incomplete');
assert(inventory.records.length === 18, 'feature inventory incomplete');
for (const entry of [...manifest.entries, ...manifest.routeBefore]) {
  assert(entry.screenshot, 'capture without screenshot metadata');
  await access(path.resolve(entry.screenshot.startsWith('app-before-') ? root : root, entry.screenshot));
}
for (const record of inventory.records) {
  assert(record.taskIds.length > 0 && record.routes.length > 0 && record.states.length > 0 && record.apiOrModules.length > 0 && record.tests.length > 0 && record.ownerWave, `incomplete inventory record: ${record.feature}`);
}
console.log(`V0 verifier PASS: ${manifest.sources.length} immutable sources, ${manifest.entries.length} reference states, ${manifest.routeBefore.length} app routes, ${inventory.records.length} feature records`);
