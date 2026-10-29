const fs = require('fs');

const server = fs.readFileSync('server.js', 'utf8');
console.log('--- MOUNTED ROUTES IN SERVER.JS ---');
const appUse = [...server.matchAll(/app\.use\(['"]([^'"]+)['"],\s*([a-zA-Z0-9_]+)\)/g)];
appUse.forEach(m => console.log(m[1], '->', m[2]));

console.log('\n--- ROUTES IN portalRoutes.js ---');
const portal = fs.readFileSync('src/routes/portalRoutes.js', 'utf8');
const pRoutes = [...portal.matchAll(/router\.(get|post|put|delete)\(['"]([^'"]+)['"]/g)];
pRoutes.forEach(m => console.log(m[1].toUpperCase(), m[2]));
