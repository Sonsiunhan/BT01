const fs = require('fs');

const content = fs.readFileSync('docs/team-handoff/network-core/implementation_plan.md', 'utf-8');

const frsList = ['L01', 'L02', 'L03', 'L04', 'L05', 'L06', 'L07'];

// Extract common sections
const extractSection = (regex) => {
  const match = content.match(regex);
  return match ? match[1] : '';
};

// Common preamble: everything up to section 6
const preambleMatch = content.match(/^(.*?)## 6\. Bảng wave/s);
const preamble = preambleMatch ? preambleMatch[1] : '';

// Postamble: Section 8 and 9
const postambleMatch = content.match(/(## 8\. Timeline 36 giờ.*)/s);
const postamble = postambleMatch ? postambleMatch[1] : '';

// For each FRS, extract its wave table and mapping
frsList.forEach(frs => {
  // Wave table
  const waveRegex = new RegExp(`### 6\\.\\d+ FRS-${frs}(.*?)(?=\\n### 6\\.\\d+|\\n## 7\\.)`, 's');
  const waveMatch = content.match(waveRegex);
  const waveContent = waveMatch ? waveMatch[0] : `### Bảng wave FRS-${frs}\n(Trống)`;

  // Mapping
  const mapRegex = new RegExp(`### 7\\.\\d+ FRS-${frs}(.*?)(?=\\n### 7\\.\\d+|\\n## 8\\.)`, 's');
  const mapMatch = content.match(mapRegex);
  const mapContent = mapMatch ? mapMatch[0] : `### Mapping FRS-${frs}\n(Trống)`;

  const fileContent = `# Implementation Plan - FRS-${frs}\n\n` +
    `*Note: This is a split from the master implementation plan.*\n\n` +
    preamble +
    `## Bảng wave cho FRS-${frs}\n\n` + waveContent + `\n\n` +
    `## Mapping yêu cầu cho FRS-${frs}\n\n` + mapContent + `\n\n` +
    postamble;

  fs.writeFileSync(`docs/team-handoff/network-core/implementation_plan_FRS_${frs}.md`, fileContent);
});

console.log('Split complete.');
