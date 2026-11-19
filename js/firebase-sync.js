/**
 * TaniSM - Firebase/Firestore Sync (real-time)
 * Menyinkronkan data bersama TaniStore ke Cloud Firestore agar perubahan
 * terlihat di semua perangkat. Bergantung pada Firebase compat SDK yang
 * dimuat sebelum file ini, serta window.TaniFirebaseConfig.
 */
(function () {
  'use strict';

  var cfg = window.TaniFirebaseConfig || {};
  var firebaseConfig = cfg.firebaseConfig || {};
  var ENABLED = !!(cfg.enabled && window.firebase && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'ISI_API_KEY' && firebaseConfig.projectId && firebaseConfig.projectId !== 'ISI_PROJECT_ID');
  var COLLECTION = cfg.storeCollection || 'tanism_store';

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
  var applyingRemote = false; // cegah echo tulis-balik saat menerapkan snapshot remote
  var readyCallbacks = [];
  var initialLoaded = {};

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
    return !!SHARED_KEYS[key];
  }

  function getStore() {
    return window.taniStore || null;
  }

  function ensureFirebase() {
    if (!ENABLED) return false;
    if (db) return true;
    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      } else {
        // gunakan app default jika sudah ada
        firebase.app();
      }
      db = firebase.firestore();
      return true;
    } catch (e) {
      console.warn('[TaniSync] Gagal inisialisasi Firebase:', e);
      ENABLED = false;
      return false;
    }
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
      // Tulis ke cache+localStorage tanpa memicu sync balik
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
      db.collection(COLLECTION).doc(key).set({
        value: cloneValue(value),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(function (err) {
        console.warn('[TaniSync] Gagal menyimpan', key, err);
      });
    } catch (e) {
      console.warn('[TaniSync] Gagal menyimpan', key, e);
    }
  }

  function markReady() {
    if (ready) return;
    ready = true;
    try { window.dispatchEvent(new CustomEvent('tanism:sync-ready')); } catch (e) {}
    readyCallbacks.forEach(function (fn) { try { fn(); } catch (e) {} });
    readyCallbacks = [];
  }

  function subscribeKey(key) {
    if (!db) return;
    db.collection(COLLECTION).doc(key).onSnapshot(function (doc) {
      if (!doc.exists) {
        // Dokumen belum ada di cloud: unggah data lokal/seed saat ini
        initialLoaded[key] = true;
        var store = getStore();
        if (store) pushKey(key, store.readKey(key));
        checkAllInitial();
        return;
      }
      var data = doc.data() || {};
      if (Object.prototype.hasOwnProperty.call(data, 'value')) {
        initialLoaded[key] = true;
        applyRemoteValue(key, data.value);
      }
      checkAllInitial();
    }, function (err) {
      console.warn('[TaniSync] Listener error', key, err);
      initialLoaded[key] = true;
      checkAllInitial();
    });
  }

  function checkAllInitial() {
    var keys = Object.keys(SHARED_KEYS);
    for (var i = 0; i < keys.length; i++) {
      if (!initialLoaded[keys[i]]) return;
    }
    markReady();
  }

  function start() {
    if (!ENABLED) return;
    if (!ensureFirebase()) return;
    var keys = Object.keys(SHARED_KEYS);
    // Timeout fallback: jangan blokir selamanya jika koneksi lambat
    setTimeout(markReady, 8000);
    keys.forEach(subscribeKey);
    console.log('[TaniSync] Sinkronisasi Firebase aktif (real-time).');
  }

  // API publik yang dipanggil oleh TaniStore
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

  // Mulai otomatis setelah store siap (defer scripts menjaga urutan)
  if (ENABLED) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }
})();
