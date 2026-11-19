import fs from 'node:fs';
const src = fs.readFileSync('C:/Users/LENOVO/TaniSM/js/admin.js', 'utf8');
console.log('CRLF count:', (src.match(/\r\n/g) || []).length);
const k = src.indexOf('MANAJEMEN PENJUALAN');
console.log('idx MANAJEMEN:', k);
console.log('segment:', JSON.stringify(src.slice(k - 120, k + 60)));
