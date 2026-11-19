import fs from 'node:fs';

const src = fs.readFileSync('C:/Users/LENOVO/TaniSM/js/admin.js', 'utf8');
const startMarker = '  // ---- Impor Produk dari CSV/TSV (Master Produk) ----';
const endMarker = '  // ==========================================\r\n  // 6. MANAJEMEN PENJUALAN';
const i = src.indexOf(startMarker);
const j = src.indexOf(endMarker, i);
const block = src.slice(i, j).trim();
const m = src.match(/MASTER_CATEGORIES:\s*\[([\s\S]*?)\]/);
const masterCats = m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
const startN = src.indexOf('_normalizeCategory(name) {');
const startU = src.indexOf('productUnit(p) {', startN);
const normMethod = src.slice(startN, startU).trim();
const AdminImport = new Function(`
  const MASTER_CATEGORIES = ${JSON.stringify(masterCats)};
  globalThis.window = { taniStore: { getProducts: () => [
    { id: 'PRD-001', code: 'PRD-001' },
    { id: 'PRD-016', code: 'PRD-016' }
  ] } };
  return {
    MASTER_CATEGORIES,
${block}
${normMethod}
  };
`)();

// Generate 250-row CSV
const cats = ['Bibit & Benih', 'Pupuk Tanaman', 'Obat Hama & Penyakit', 'Alat & Mesin Tani', 'Media & Perlengkapan', 'Hasil Panen Segar'];
const units = ['Karung 5 Kg', 'Sak', 'Sachet 10 Gram', 'Unit', 'Botol'];
const lines = ['Nama Produk,Kategori,Harga,Stok,Satuan,Bobot'];
for (let n = 1; n <= 250; n++) {
  const name = `Produk Tani No. ${String(n).padStart(3, '0')}`;
  const cat = cats[(n - 1) % cats.length];
  const price = 100000 + (n % 900) * 1000;
  const stock = 50 + (n % 400);
  const unit = units[(n - 1) % units.length];
  const weight = (n % 20 + 1) * 500;
  lines.push(`${name},${cat},${price},${stock},${unit},${weight}`);
}

const parsed = AdminImport._parseImport(lines.join('\r\n'));
console.log('rows in CSV:', lines.length - 1, '| products parsed:', parsed.products.length, '| errors:', parsed.errors);

const first = parsed.products[0];
const last = parsed.products[parsed.products.length - 1];
console.log('first:', first.id, '|', first.name, '|', first.categoryName, '|', first.price, '|', first.stock);
console.log('last :', last.id, '|', last.name, '|', last.unit, '|', last.weightGram);

const ids = new Set(parsed.products.map(p => p.id));
const catCount = {};
parsed.products.forEach(p => { catCount[p.categoryName] = (catCount[p.categoryName] || 0) + 1; });

let fail = 0;
if (parsed.products.length !== 250) { console.log('FAIL: expected 250 products, got', parsed.products.length); fail++; }
if (parsed.errors !== 0) { console.log('FAIL: expected 0 errors, got', parsed.errors); fail++; }
if (first.id !== 'PRD-017') { console.log('FAIL: first id should be PRD-017, got', first.id); fail++; }
if (last.id !== 'PRD-266') { console.log('FAIL: last id should be PRD-266, got', last.id); fail++; }
if (ids.size !== 250) { console.log('FAIL: duplicate ids'); fail++; }
console.log('categories:', JSON.stringify(catCount));
console.log(fail ? 'BULK TEST FAILED' : 'BULK TEST PASSED (250 products)');
process.exit(fail ? 1 : 0);
