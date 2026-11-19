import fs from 'node:fs';

const code = fs.readFileSync('./js/supabase-sync.js', 'utf8');

// ---- Mock supabase client ----
const supabaseRows = new Map(); // key -> row (supabase side)
const upsertCalls = [];
let capturedOnCb = null;

const mockChannel = {
  on: (_e, _f, cb) => { capturedOnCb = cb; return mockChannel; },
  subscribe: (cb) => { try { cb('subscribed'); } catch (e) {} return mockChannel; }
};
const mockSupabase = {
  createClient: () => ({
    channel: () => mockChannel,
    from: () => ({
      select: () => ({ then: async (onOk) => onOk({ data: [...supabaseRows.values()] }) }),
      upsert: (row, opts) => { upsertCalls.push({ row, opts }); supabaseRows.set(row.key, row); return { catch: () => {} }; }
    })
  })
};

// ---- Mock taniStore (minimal, mirror of store.js API used by supabase-sync) ----
const local = new Map();
globalThis.localStorage = {
  getItem: (k) => (local.has(k) ? local.get(k) : null),
  setItem: (k, v) => { local.set(k, v); },
  removeItem: (k) => { local.delete(k); }
};
globalThis.CustomEvent = class {
  constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; }
};
const dispatched = [];

const taniStore = {
  STORAGE_KEYS: { PRODUCTS: 'tanism_products', MEMBER_SETTINGS: 'tanism_member_settings' },
  _cache: new Map(),
  _productIndex: null,
  _clearTierCache: function () {},
  readKey: function (k) {
    if (this._cache.has(k)) return this._cache.get(k);
    const raw = globalThis.localStorage.getItem(k);
    const v = raw !== null ? JSON.parse(raw) : null;
    this._cache.set(k, v);
    return v;
  },
  writeKey: function (k, v) { this._cache.set(k, v); globalThis.localStorage.setItem(k, JSON.stringify(v)); }
};

globalThis.document = { readyState: 'complete', addEventListener: () => {} };
globalThis.window = {
  TaniSupabaseConfig: {
    enabled: true,
    table: 'tanism_store',
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'anon.key'
  },
  supabase: mockSupabase,
  taniStore,
  dispatchEvent: (e) => { dispatched.push(e.type); },
  addEventListener: () => {}
};

// Seed data lokal (seperti seed lama yang sudah di localStorage)
local.set('tanism_products', JSON.stringify([{ id: 'LOCAL-1' }]));

(0, eval)(code);

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? 'PASS' : 'FAIL'), label, '->', JSON.stringify(actual));
  if (ok) pass++; else fail++;
}

await new Promise((r) => setTimeout(r, 50));

// 1. TaniSync di-expose
check('TaniSync defined', typeof window.TaniSync, 'object');

// 2. reloadRemote: local -> supabase (mirror firebase-sync subscribeKey)
check('local uploaded to supabase', supabaseRows.get('tanism_products') && JSON.stringify(supabaseRows.get('tanism_products').value), JSON.stringify([{ id: 'LOCAL-1' }]));
check('upsert uses onConflict key', upsertCalls.some((c) => c.row.key === 'tanism_products' && c.opts && c.opts.onConflict === 'key'), true);

// 3. push (simulasi writeKey) -> upsert
window.TaniSync.push('tanism_products', [{ id: 'PRD-017' }]);
await new Promise((r) => setTimeout(r, 10));
check('push -> new upsert', upsertCalls.some((c) => c.row.key === 'tanism_products' && JSON.stringify(c.row.value) === JSON.stringify([{ id: 'PRD-017' }])), true);

// 4. remote apply via postgres_changes (simulasi device lain)
const newProducts = [{ id: 'PRD-020' }];
capturedOnCb({ event: 'UPDATE', new: { key: 'tanism_products', value: newProducts } });
check('remote applied to store', taniStore.readKey('tanism_products'), newProducts);
check('remote applied to localStorage', local.has('tanism_products') ? JSON.parse(local.get('tanism_products')) : null, newProducts);

// 5. deepEqual no-op
capturedOnCb({ event: 'UPDATE', new: { key: 'tanism_products', value: newProducts } });
check('still same value', taniStore.readKey('tanism_products'), newProducts);

// 6. non-shared key ignored
capturedOnCb({ event: 'UPDATE', new: { key: 'other_key', value: { a: 1 } } });
check('non-shared key ignored', local.has('other_key'), false);

// 7. ready + event
check('ready', window.TaniSync.isReady(), true);
check('tanism:store-updated dispatched', dispatched.includes('tanism:store-updated'), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
