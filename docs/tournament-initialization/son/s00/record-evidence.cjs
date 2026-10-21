const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname;
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const manual=JSON.parse(read('evidence/manual-gates-results.json'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,p))).digest('hex');
const browser=JSON.parse(read('evidence/browser-results.json'));
const axe=JSON.parse(read('evidence/accessibility-results.json'));
const expected=hash('preview.html');
if(browser.sha256!==expected||axe.sha256!==expected)throw new Error('Evidence source hash mismatch');
if(browser.checks.some(c=>!c.pass)||axe.results.some(r=>r.violations.length))throw new Error('Evidence contains failing assertions/violations');
const ids=[...read('S00-TRACEABILITY.md').matchAll(/^\| (F\d{2}) \|/gm)].map(m=>m[1]);
if(ids.length!==82||new Set(ids).size!==82)throw new Error('Field traceability is incomplete');
const broken=[];
for(const file of fs.readdirSync(dir).filter(n=>n.endsWith('.md'))){
 for(const m of read(file).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
  const target=m[1].split('#')[0];
  if(target&&!/^(https?:|[A-Za-z]:)/.test(target)&&!fs.existsSync(path.resolve(dir,target)))broken.push({file,target});
 }
}
if(broken.length)throw new Error('Broken links: '+JSON.stringify(broken));
const sources=['preview.html','preview-app.js','preview-shell.html','preview-base.css','preview-extra.css','build-preview.cjs','verify-complete.cjs','verify-accessibility.cjs','verify-manual-gates.cjs','implementation_plan.md','S00-TRACEABILITY.md','S00-ACCEPTANCE.md','S00-INDEPENDENT-REVIEW.md','S00-REQUIREMENT-DELTA-2026-10-21.md'];
const result={at:new Date().toISOString(),status:'READY FOR HUMAN REVIEW / PARTIAL VALIDATION',scope:'S00 synthetic prototype/design only · revision 4 delta',sourceSha256:expected,browser:browser.browser,assertions:{passed:browser.checks.length,failed:0},axe:{screens:axe.results.length,violations:0,incomplete:[...new Set(axe.results.flatMap(r=>r.incomplete.map(i=>i.id))) ]},manualGates:{viewport:manual.viewport.status,zoom200Model:manual.zoom200Model.status,contrast:manual.contrast.status,copy:manual.copy.status,screenReader:manual.screenReader.status},fieldIds:ids.length,brokenLinks:broken,commands:['node docs/tournament-initialization/s00/build-preview.cjs','node docs/tournament-initialization/s00/verify-complete.cjs','node docs/tournament-initialization/s00/verify-accessibility.cjs','node docs/tournament-initialization/s00/verify-manual-gates.cjs','node docs/tournament-initialization/s00/record-evidence.cjs'],sources:sources.map(p=>({path:p,sha256:hash(p)})),pending:['Human visual/copy acceptance','Real screen reader session','Real browser zoom/device manual','Axe color-contrast incomplete manual evaluation','L00/G1 contract freeze'],historicalNonFinal:['evidence/browser-failure.json','S00-INDEPENDENT-REVIEW.md revision 3 verdict'],productionCodeChanged:false,databaseMutations:false,pushed:false};
fs.writeFileSync(path.join(dir,'evidence/manifest.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,hash:expected,assertions:result.assertions,axe:result.axe,fieldIds:ids.length,brokenLinks:broken.length},null,2));
