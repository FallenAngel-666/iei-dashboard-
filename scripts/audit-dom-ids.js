const fs = require('fs');

const code = fs.readFileSync('public/js/portal-modules.js', 'utf8') + '\n' + fs.readFileSync('public/js/app.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');

const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
const ids = new Set();
let match;
while ((match = regex.exec(code)) !== null) {
  ids.add(match[1]);
}

console.log(`Total getElementById calls in JS: ${ids.size}`);
const missing = [];
const found = [];

for (const id of Array.from(ids).sort()) {
  const inHtml = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
  if (inHtml) {
    found.push(id);
  } else {
    missing.push(id);
  }
}

console.log(`\n=== FOUND IN HTML (${found.length}) ===`);
console.log(found.join(', '));

console.log(`\n=== MISSING IN HTML (${missing.length}) ===`);
missing.forEach(id => console.log('MISSING:', id));
