-- ==========================================
-- Tani.SM - Tabel data bersama Supabase (Real-time sync)
--
-- Jalankan di SQL Editor (Project Settings -> SQL Editor).
-- Semua perintah aman di-run ulang (idempoten).
-- ==========================================

-- Tabel: satu baris per "kunci data" (mirror key lokal storage Tani.SM).
create table if not exists tanism_store (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz default now()
);

-- Realtime: aktifkan siaran perubahan tabel ini (idempoten).
do $$
  begin
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tanism_store'
    ) then
      alter publication supabase_realtime add table public.tanism_store;
    end if;
  end
$$;

-- Izin untuk role "anon" (role yang dipakai Tani.SM di browser)
-- Opsional: lepas RLS sehingga klien bebas baca/tulis.
grant select, insert, update, delete on public.tanism_store to anon;
grant select on public.tanism_store to authenticated;
alter table public.tanism_store disable row level security;

-- Opsional (alternatif): pakai policy RLS hanya untuk anon/public.
-- create policy "Bebas publik: lihat & ubah data Tani.SM"
--   on public.tanism_store
--   for all using (true) with check (true);
