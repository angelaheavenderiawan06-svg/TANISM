/**
 * Tani.SM - Konfigurasi Supabase (real-time sync multi-perangkat).
 *
 * CARA SETUP:
 * 1. Buka https://supabase.com/dashboard -> buat project (atau pakai yang ada).
 * 2. Buat tabel terlebih dahulu via SQL Editor (lihat migrations/supabase/001_tanism_store.sql).
 * 3. Dari dashboard ambil dua nilai berikut:
 *    - Supabase URL (Project Settings -> General -> "Project URL")
 *    - Anon/public key (Project Settings -> API Keys -> "anon/public" key)
 * 4. Tempel ke bawah, lalu set `enabled` ke true.
 *
 * Setelah diisi, semua data bersama (produk, stok, pesanan, dll.) disimpan
 * di Supabase dan tersinkron real-time ke semua perangkat yang membuka aplikasi.
 */
window.TaniSupabaseConfig = {
  enabled: true, // Ubah ke true setelah mengisi supabaseUrl & supabaseKey
  table: 'tanism_store',
  supabaseUrl: 'https://sgcmdjotzsfbdoajduuc.supabase.co',
  supabaseKey: 'sb_publishable_9EbHslLuEK2Q5WnRsyzEUw_dRAD-x-H'
};
