import fs from 'node:fs';

const src = fs.readFileSync('C:/Users/LENOVO/TaniSM/js/admin.js', 'utf8');

// --- Extract the IMPORT block inserted into AdminApp ---
const startMarker = '  // ---- Impor Produk dari CSV/TSV (Master Produk) ----';
const endMarker = '  // ==========================================\r\n  // 6. MANAJEMEN PENJUALAN';
const i = src.indexOf(startMarker);
const j = src.indexOf(endMarker, i);
if (i < 0 || j < 0) throw new Error('markers not found (i=' + i + ', j=' + j + ')');
const block = src.slice(i, j).trim();

// --- Extract MASTER_CATEGORIES ---
const m = src.match(/MASTER_CATEGORIES:\s*\[([\s\S]*?)\]/);
const masterCats = m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];

// --- Extract _normalizeCategory method (needed by _buildImportedProduct) ---
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

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? 'PASS' : 'FAIL'), label, '->', JSON.stringify(actual));
  if (!ok) { fail++; } else { pass++; }
}

// 1. parseCsvText: comma CSV
check('csv comma',
  AdminImport.parseCsvText('Nama Produk,Satuan,Harga,Stok\nBenih Padi 1kg,Karung 5 Kg,95000,100'),
  [['Nama Produk', 'Satuan', 'Harga', 'Stok'], ['Benih Padi 1kg', 'Karung 5 Kg', '95000', '100']]);

// 2. parseCsvText: semicolon + quoted comma
check('csv semicolon quoted',
  AdminImport.parseCsvText('A;B\n"Benih, Padi";100'),
  [['A', 'B'], ['Benih, Padi', '100']]);

// 3. parseCsvText: quoted header
check('csv quoted header',
  AdminImport.parseCsvText('"Nama Produk";"Harga"'),
  [['Nama Produk', 'Harga']]);

// 4. parseCsvText: empty input
check('csv empty', AdminImport.parseCsvText(''), []);

// 5. _parseNum variants
check('num 1.500,50', AdminImport._parseNum('1.500,50'), 1500.5);
check('num 1,500.50', AdminImport._parseNum('1,500.50'), 1500.5);
check('num Rp 95.000', AdminImport._parseNum('Rp 95.000'), 95000);
check('num 95000', AdminImport._parseNum('95000'), 95000);
check('num 1.500', AdminImport._parseNum('1.500'), 1500);
check('num empty', Number.isNaN(AdminImport._parseNum('')), true);

// 6. _canonImportKey variants (input = normalized header, as _parseImport provides)
const n = AdminImport._normImportHeader;
check('norm Nama Produk Lengkap', n('Nama Produk Lengkap'), 'namaproduklengkap');
check('canon Nama Produk Lengkap', AdminImport._canonImportKey(n('Nama Produk Lengkap')), 'name');
check('canon Kategori', AdminImport._canonImportKey(n('Kategori')), 'category');
check('canon Lokasi Rak', AdminImport._canonImportKey(n('Lokasi Rak')), 'shelfLocation');
check('canon Lokasi Rak / Palet Gudang', AdminImport._canonImportKey(n('Lokasi Rak / Palet Gudang')), 'shelfLocation');
check('canon Batas Minimum Stok', AdminImport._canonImportKey(n('Batas Minimum Stok')), 'minStockWarning');
check('canon Deskripsi', AdminImport._canonImportKey(n('Deskripsi')), 'description');
check('canon Harga Jual Normal (Rp)', AdminImport._canonImportKey(n('Harga Jual Normal (Rp)')), 'price');
check('canon Jumlah Stok', AdminImport._canonImportKey(n('Jumlah Stok')), 'stock');
check('canon Satuan Kemasan', AdminImport._canonImportKey(n('Satuan Kemasan')), 'unit');
check('canon Bobot (Gram)', AdminImport._canonImportKey(n('Bobot (Gram)')), 'weightGram');
check('canon Bobot', AdminImport._canonImportKey(n('Bobot')), 'weightGram');
check('canon Kode Produk', AdminImport._canonImportKey(n('Kode Produk')), 'code');
check('canon Lokasi', AdminImport._canonImportKey(n('Lokasi')), 'location');
check('canon unknown', AdminImport._canonImportKey(n('Foo Bar')), null);

// 7. _parseImport: full pipeline (1 valid + 1 missing price)
const parsed = AdminImport._parseImport('Nama Produk,Harga,Stok,Kategori\nBenih Padi,95000,100,Bibit & Benih\nPupuk,,50,');
check('parse products len', parsed.products.length, 1);
check('parse errors', parsed.errors, 1);
const p1 = parsed.products[0];
check('parse product id', p1.id, 'PRD-017');
check('parse product code', p1.code, 'PRD-017');
check('parse product name', p1.name, 'Benih Padi');
check('parse product categoryId', p1.categoryId, 'cat-1');
check('parse product categoryName', p1.categoryName, 'Bibit & Benih');
check('parse product price', p1.price, 95000);
check('parse product stock', p1.stock, 100);
check('parse product unit default', p1.unit, 'Unit');
check('parse product minStockWarning', p1.minStockWarning, 20);
check('parse product weightGram default', p1.weightGram, 1000);
check('parse product shelfLocation default', p1.shelfLocation, 'Rak A-01');
check('parse product originalPrice', p1.originalPrice, null);
check('parse product expiryDate', p1.expiryDate, null);

// 8. next import ids continue after existing (PRD-017, PRD-018, ...)
check('next id 1', AdminImport._nextImportId(), 'PRD-018');
check('next id 2', AdminImport._nextImportId(), 'PRD-019');

// 9. _parseImport with Pupuk Tanaman category + satuan + bobot
const parsed2 = AdminImport._parseImport('Nama Produk,Kategori,Harga,Stok,Satuan,Bobot\nPupuk NPK,Pupuk Tanaman,185000,620,Sak,2500');
check('parse2 len', parsed2.products.length, 1);
check('parse2 categoryId', parsed2.products[0].categoryId, 'cat-2');
check('parse2 unit', parsed2.products[0].unit, 'Sak');
check('parse2 weightGram', parsed2.products[0].weightGram, 2500);
check('parse2 price', parsed2.products[0].price, 185000);
check('parse2 stock', parsed2.products[0].stock, 620);

// 10. _parseImport: empty text
check('parse empty', AdminImport._parseImport('   '), { products: [], errors: 0 });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
