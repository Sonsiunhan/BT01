const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;
const target = path.join(dir, 'preview.html');
const base = path.join(dir, 'preview-base.css');
if (!fs.existsSync(base)) {
  const old = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(base, old.match(/<style>([\s\S]*?)<\/style>/)[1].trim() + '\n');
}
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const fragment = '<div id="s00-lab" role="region" aria-label="Bản thiết kế console Robot Lab tương tác">\n<style>\n' + read('preview-base.css') + read('preview-extra.css') + '</style>\n' + read('preview-shell.html') + '\n<script>\n' + read('preview-app.js') + '\n</script>\n</div>\n';
fs.writeFileSync(target, fragment);
console.log('Built preview.html from local S00 sources. No application code changed.');
