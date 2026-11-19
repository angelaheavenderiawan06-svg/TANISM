import fs from 'node:fs';

const d = fs.readFileSync('C:/Users/LENOVO/TaniSM/js/data.js', 'utf8');
const m = d.match(/products:\s*\[([\s\S]*?)\n\s*\],/);
if (!m) {
  console.log('products array not found');
  process.exit(0);
}
const body = m[1];
const ids = body.match(/id:\s*'PRD-\d+'/g) || [];
console.log('products in data.js:', ids.length);
console.log('unique ids:', new Set(ids).size);
console.log('data.js size:', d.length);
