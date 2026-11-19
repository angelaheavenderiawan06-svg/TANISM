/**
 * Konfigurasi Firebase untuk sinkronisasi data TaniSM antar perangkat.
 *
 * CARA SETUP:
 * 1. Buka https://console.firebase.google.com/ dan buat project (atau pakai yang ada).
 * 2. Tambahkan aplikasi Web (ikon </>) ke project, lalu salin objek firebaseConfig.
 * 3. Aktifkan Cloud Firestore: Build > Firestore Database > Create database.
 *    - Untuk mulai cepat bisa pilih mode test, lalu amankan rules sebelum produksi.
 * 4. Tempel nilai config di bawah ini dan set `enabled` ke true.
 * 5. (Opsional) Ubah `storeCollection` jika ingin nama koleksi berbeda.
 *
 * Setelah diisi, semua data bersama (produk, stok, pesanan, dll.) akan disimpan
 * di Firestore dan tersinkron real-time ke semua perangkat yang membuka aplikasi ini.
 */
window.TaniFirebaseConfig = {
  enabled: false, // Ubah ke true setelah mengisi firebaseConfig
  storeCollection: 'tanism_store', // Koleksi Firestore untuk dokumen data bersama
  firebaseConfig: {
    apiKey: 'ISI_API_KEY',
    authDomain: 'ISI_PROJECT_ID.firebaseapp.com',
    projectId: 'ISI_PROJECT_ID',
    storageBucket: 'ISI_PROJECT_ID.appspot.com',
    messagingSenderId: 'ISI_SENDER_ID',
    appId: 'ISI_APP_ID'
  }
};
