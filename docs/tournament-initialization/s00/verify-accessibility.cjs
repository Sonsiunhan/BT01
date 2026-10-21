const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const dir=__dirname,out=path.join(dir,'evidence');fs.mkdirSync(out,{recursive:true});
 const html=fs.readFileSync(path.join(dir,'preview.html'),'utf8');
 const results=[];
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  const page=await context.newPage();
  // A URL gives axe's isolated frame a stable same-origin execution context. No network requests.
  await page.route('http://s00.local/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="vi"><head><title>S00 preview</title><meta charset="utf-8"><style>body{margin:0}</style></head><body>'+html+'</body></html>'}));
  await page.goto('http://s00.local/');
  const click=c=>page.locator(`[data-command="${c}"]`).first().click();
  for(const theme of ['dark','light']){
   await page.locator('#theme').selectOption(theme);
   for(const name of ['list','draft','detail','audit','offline']){
    if(name==='detail'){await click('page:list');await click('open:arena')}
    else await click('page:'+name);
    const report=await new AxeBuilder({page}).include('#s00-lab').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    results.push({theme,page:name,violations:report.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:report.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))});
   }
  }
  if(html!==fs.readFileSync(path.join(dir,'preview.html'),'utf8'))throw new Error('Source changed during accessibility run');
  fs.writeFileSync(path.join(out,'accessibility-results.json'),JSON.stringify({at:new Date().toISOString(),browser:await browser.version(),sha256:require('node:crypto').createHash('sha256').update(html).digest('hex'),scope:'WCAG2A/AA + 2.1AA automated; not screen reader certification; incomplete items require manual review',results},null,2)+'\n');
  const failed=results.filter(r=>r.violations.length);console.log(JSON.stringify({screens:results.length,failed},null,2));if(failed.length)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
