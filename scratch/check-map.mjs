import fs from 'node:fs';
const src = fs.readFileSync('C:/Users/LENOVO/TaniSM/js/admin.js', 'utf8');
const i = src.indexOf('IMPORT_MAP: {');
const j = src.indexOf('}', src.indexOf('badge', i));
console.log(src.slice(i, j + 1).split('\n').filter(l => /lokasi|shelf|location/.test(l)).join('\n'));
