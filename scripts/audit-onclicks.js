const fs = require('fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/js/portal-modules.js', 'utf8') + '\n' + fs.readFileSync('public/js/app.js', 'utf8');

const regex = /onclick=["']([^"']+)["']/g;
const onClicks = [];
let match;
while ((match = regex.exec(html)) !== null) {
  onClicks.push(match[1].trim());
}

console.log(`Found ${onClicks.length} onclick handlers in index.html.`);
const missingMethods = [];
const verifiedMethods = [];

for (const call of onClicks) {
  // Extract function name, e.g. PortalModules.community.createPost() -> createPost
  const fnMatch = call.match(/PortalModules\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/);
  if (fnMatch) {
    const mod = fnMatch[1];
    const fn = fnMatch[2];
    // check if fn is in js
    const fnRegex = new RegExp(`${fn}\\s*\\(`);
    const hasFn = fnRegex.test(js);
    if (hasFn) {
      verifiedMethods.push(`${mod}.${fn}`);
    } else {
      missingMethods.push({ full: call, mod, fn });
    }
  }
}

console.log(`Verified methods: ${Array.from(new Set(verifiedMethods)).join(', ')}`);
console.log(`\nMISSING OR UNDEFINED METHODS: ${missingMethods.length}`);
missingMethods.forEach(m => console.log(`  -> ${m.mod}.${m.fn} called in "${m.full}"`));
