/**
 * Tani.SM - Supabase real-time sync (multi-perangkat).
 *
 * Menyinkronkan data bersama TaniStore ke Supabase agar perubahan
 * terlihat di semua perangkat. Bergantung pada supabase-js
 * (js/lib/supabase.js, diimpor sebelum file ini) dan
 * window.TaniSupabaseConfig (js/supabase-config.js).
 *
 * Arsitektur mirip js/firebase-sync.js: satu tabel (tanism_store)
 * dengan kolom key/value/updated_at; setiap "kunci data" Tani.SM
 * (key lokal storage) disimpan sebagai satu baris supabase.
 *
 * API publik (window.TaniSync) ditahan agar TaniStore terintegrasi
 * secara otomatis: TaniStore.writeKey() -> TaniSync.push()
 * (lihat js/store.js).
 */
(function () {
  'use strict';

  var cfg = window.TaniSupabaseConfig || {};
  var supabaseUrl = cfg.supabaseUrl || '';
  var supabaseKey = cfg.supabaseKey || '';
  var ENABLED = !!(
    cfg.enabled &&
    supabaseUrl &&
    supabaseKey &&
    supabaseUrl.indexOf('ISI_SUPABASE_URL') < 0 &&
    supabaseKey.indexOf('ISI_ANON_KEY') < 0 &&
    typeof window.supabase === 'object' &&
    typeof window.supabase.createClient === 'function'
  );
  var TABLE = cfg.table || 'tanism_store';

  // Kunci data bersama yang disinkron ke server (lintas perangkat/pengguna).
  // AUTH/CART/WISHLIST tetap lokal per perangkat/sesi.
  var SHARED_KEYS = {
    'tanism_products': true,
    'tanism_categories': true,
    'tanism_customers': true,
    'tanism_orders': true,
    'tanism_vouchers': true,
    'tanism_tips': true,
    'tanism_reviews': true,
    'tanism_stock_logs': true,
    'tanism_banners': true,
    'tanism_member_settings': true,
    'tanism_barang_masuk': true,
    'tanism_barang_keluar': true,
    'tanism_purchase_orders': true,
    'tanism_stock_opnames': true
  };

  var db = null;
  var ready = false;
  var applyingRemote = false; // cegah echo tulis-balik saat menerapkan remote
  var readyCallbacks = [];

  function cloneValue(val) {
    try {
      return JSON.parse(JSON.stringify(val));
    } catch (e) {
      return val;
    }
  }

  function deepEqual(a, b) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return a === b;
    }
  }

  function isSharedKey(key) {
    return !!(SHARED_KEYS[key]);
  }

  function getStore() {
    return window.taniStore || null;
  }

  function dispatchUpdate(key, source) {
    try {
      window.dispatchEvent(new CustomEvent('tanism:store-updated', { detail: { key: key, source: source || 'remote' } }));
    } catch (e) {}
  }

  function applyRemoteValue(key, value) {
    var store = getStore();
    if (!store) return;
    if (!isSharedKey(key)) return;
    var next = cloneValue(value);
    var current = store.readKey(key);
    if (deepEqual(current, next)) return;
    applyingRemote = true;
    try {
      // Tulis ke cache+localStorage tanpa memicu push balik
      store._cache.set(key, next);
      if (key === store.STORAGE_KEYS.PRODUCTS) {
        store._productIndex = null;
        if (typeof store._clearTierCache === 'function') store._clearTierCache();
      }
      if (key === store.STORAGE_KEYS.MEMBER_SETTINGS && typeof store._clearTierCache === 'function') {
        store._clearTierCache();
      }
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch (e) {}
    } finally {
      applyingRemote = false;
    }
    dispatchUpdate(key, 'remote');
  }

  function pushKey(key, value) {
    if (!ENABLED || !db || applyingRemote) return;
    if (!isSharedKey(key)) return;
    try {
      db.from(TABLE).upsert({
        key: key,
        value: cloneValue(value),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' }).catch(function (err) {
        console.warn('[TaniSupabase] Gagal menyimpan "' + key + '"', err);
      });
    } catch (e) {
      console.warn('[TaniSupabase] Gagal menyimpan "' + key + '"', e);
    }
  }

  function markReady() {
    if (ready) return;
    ready = true;
    try { window.dispatchEvent(new CustomEvent('tanism:sync-ready')); } catch (e) {}
    readyCallbacks.forEach(function (fn) { try { fn(); } catch (e) {} });
    readyCallbacks = [];
  }

  function onPostgresChanges(payload) {
    if (!payload || !payload.new) return;
    var key = payload.new.key;
    var value = payload.new.value;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch (e) { return; }
    }
    applyRemoteValue(key, value);
  }

  var channelInstance = null;

  function subscribe() {
    if (!db) return;
    if (channelInstance) {
      try { db.removeChannel(channelInstance); } catch (e) {}
      channelInstance = null;
    }

    channelInstance = db.channel(TABLE + '_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE }, onPostgresChanges)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, onPostgresChanges)
      .subscribe(function (status, err) {
        if (status === 'subscribed') {
          markReady();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[TaniSupabase] Realtime status:', status, err || '');
          // Coba reconnect setelah jeda singkat
          setTimeout(function () {
            if (ENABLED && db) {
              subscribe();
              reloadRemote();
            }
          }, 3000);
        } else if (err) {
          console.warn('[TaniSupabase] Listener error', err);
        }
      });
  }

  function reloadRemote() {
    if (!db) return;
    db.from(TABLE).select('key, value').then(function (res) {
      if (res && res.error) {
        console.warn('[TaniSupabase] Query gagal:', res.error);
        markReady();
        return;
      }
      var rows = (res && res.data) || [];
      var remoteKeys = {};
      rows.forEach(function (row) {
        if (!row || typeof row.key !== 'string') return;
        remoteKeys[row.key] = true;
        applyRemoteValue(row.key, row.value);
      });
      // Jika kunci lokal ada tapi belum ada di supabase, unggah
      // (mirror js/firebase-sync.js subscribeKey).
      Object.keys(SHARED_KEYS).forEach(function (key) {
        if (remoteKeys[key]) return;
        var local = getStore() ? getStore().readKey(key) : null;
        if (local !== null && typeof local !== 'undefined') pushKey(key, local);
      });
      markReady();
    }).catch(function (err) {
      console.warn('[TaniSupabase] Query gagal', err);
      markReady();
    });
  }

  function start() {
    if (!ENABLED) return;
    if (!db) {
      try {
        db = window.supabase.createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false }
        });
      } catch (e) {
        console.warn('[TaniSupabase] Gagal inisialisasi client:', e);
        ENABLED = false;
        return;
      }
    }
    subscribe();
    reloadRemote();
    setTimeout(markReady, 8000); // fallback: jangan blokir selamanya jika realtime lambat
    console.log('[TaniSupabase] Sinkronisasi Supabase aktif (real-time).');
  }

  // API publik yang dipanggil oleh TaniStore (mirror js/firebase-sync.js)
  window.TaniSync = {
    enabled: ENABLED,
    sharedKeys: SHARED_KEYS,
    isSharedKey: isSharedKey,
    isReady: function () { return ready || !ENABLED; },
    onReady: function (fn) {
      if (ready || !ENABLED) { try { fn(); } catch (e) {} return; }
      readyCallbacks.push(fn);
    },
    push: pushKey,
    start: start
  };

  // Mulai otomatis setelah store siap (defer scripts menjaga urutan;
  // TaniStore sudah dibuat di store.js -> fallback via DOMContentLoaded)
  if (ENABLED) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }

    // Sinkronkan ulang saat user kembali ke tab/browser (mis. HP dinyalakan kembali)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && db) {
          reloadRemote();
        }
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', function () {
        if (db) {
          subscribe();
          reloadRemote();
        }
      });
    }
  }
})();
