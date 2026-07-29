-- ============================================================================
-- MEDICALAURA — 0002 — Polityki RLS (deny-by-default)
-- ----------------------------------------------------------------------------
-- Naprawia dwie klasy problemów ustalone w audycie:
--
--  A) MARTWY SILNIK PORÓWNANIA
--     13 tabel ma RLS włączony i ZERO polityk → Postgres odmawia wszystkiego.
--     Zmierzone jako rola anon: pakiety_badania 0/3216, pakiety_specjalizacje
--     0/1482, badania 0/1015. Rdzeń porównywarki nie działa dla nikogo.
--
--  B) KAŻDY ZALOGOWANY MOŻE SKASOWAĆ BAZĘ PLACÓWEK
--     placowki_medyczne (10 417) i relacje_sieci mają politykę cmd = ALL
--     z warunkiem auth.role() = 'authenticated'. Nazwana "admin", ale admina
--     NIE sprawdza. ALL obejmuje UPDATE i DELETE.
--
--  C) WYCIEK CENNIKA
--     pakiety i dostawcy mają SELECT USING (true) → pełny cennik i lista
--     dostawców do pobrania bez logowania, kluczem anon z repozytorium.
--
-- Zasada: wszystkie polityki jawnie TO authenticated. Rola anon nie ma
-- ŻADNEJ pasującej polityki, więc jest odcięta całkowicie.
--
-- ⚠️  ZMIANA ŁAMIĄCA: po tej migracji index.html / index2.html / admin
--     przestaną czytać dane bez zalogowania. To celowe — zamyka punkt C.
--     Uruchamiać razem z przełączeniem na aplikację Next.js.
--
-- STATUS: NIEZASTOSOWANE. Do przeglądu przed uruchomieniem.
-- ============================================================================

begin;

-- ─── Usunięcie odziedziczonych, niebezpiecznych polityk ─────────────────────
-- Nazwy dokładnie jak w bazie (polskie znaki, spacje).

-- B) Krytyczne: ALL dla dowolnego zalogowanego
drop policy if exists "Edycja placówek admin"      on public.placowki_medyczne;
drop policy if exists "Edycja relacji admin"       on public.relacje_sieci;

-- C) Wyciek: odczyt bez logowania
drop policy if exists "Publiczny odczyt placówek"  on public.placowki_medyczne;
drop policy if exists "Publiczny odczyt relacji"   on public.relacje_sieci;
drop policy if exists "Odczyt pakietow dla wszystkich"   on public.pakiety;
drop policy if exists "Odczyt dostawcow dla wszystkich"  on public.dostawcy;

-- Stare polityki admina oparte o współdzielone public.profiles.
-- Zastępujemy je med.is_admin(), by nie mieszać uprawnień między projektami.
drop policy if exists "Zarzadzanie pakietami tylko dla admina"   on public.pakiety;
drop policy if exists "Zarzadzanie dostawcami tylko dla admina"  on public.dostawcy;


-- ─── Jednolite polityki dla wszystkich tabel treści ─────────────────────────
--   odczyt : aktywny użytkownik z ważnym planem
--   zapis  : wyłącznie admin MEDICALAURY
do $$
declare
  t text;
  tabele text[] := array[
    -- rdzeń porównania (dziś martwy — zero polityk)
    'specjalizacje', 'badania', 'badania_kategorie', 'kategorie_badan',
    'pakiety_badania', 'pakiety_specjalizacje', 'pakiety_zakresy_dodatkowe',
    'pakiet_badania', 'pakiet_specjalizacje', 'pakiet_rehabilitacja',
    'pakiet_stomatologia', 'pakiet_telemedycyna', 'pakiet_skladki_historia',
    -- tabele z politykami do wymiany
    'pakiety', 'dostawcy', 'placowki_medyczne', 'relacje_sieci'
  ];
begin
  foreach t in array tabele loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists med_read  on public.%I', t);
    execute format('drop policy if exists med_write on public.%I', t);

    execute format($f$
      create policy med_read on public.%I
        for select to authenticated
        using (med.has_access())
    $f$, t);

    execute format($f$
      create policy med_write on public.%I
        for all to authenticated
        using (med.is_admin())
        with check (med.is_admin())
    $f$, t);
  end loop;
end $$;


-- ─── Historia wyszukiwań — dane osobowe użytkownika ─────────────────────────
-- Porządkujemy zduplikowane polityki (były 2 × INSERT i 2 × SELECT
-- o identycznej treści) i wiążemy admina z med.is_admin().
drop policy if exists "Zapis historii wyszukiwan"  on public.historia_wyszukiwan;
drop policy if exists "User dodaje historię"       on public.historia_wyszukiwan;
drop policy if exists "Odczyt wlasnej historii"    on public.historia_wyszukiwan;
drop policy if exists "User widzi swoją historię"  on public.historia_wyszukiwan;
drop policy if exists "Admin widzi całą historię"  on public.historia_wyszukiwan;

alter table public.historia_wyszukiwan enable row level security;

create policy hw_read_own on public.historia_wyszukiwan
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy hw_insert_own on public.historia_wyszukiwan
  for insert to authenticated
  with check (user_id = (select auth.uid()) and med.has_access());

-- Użytkownik może skasować własną historię (RODO: prawo do usunięcia).
create policy hw_delete_own on public.historia_wyszukiwan
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy hw_admin_all on public.historia_wyszukiwan
  for all to authenticated
  using (med.is_admin())
  with check (med.is_admin());


-- ─── Odcięcie roli anon od danych MEDICALAURY ───────────────────────────────
-- Pas bezpieczeństwa niezależny od RLS: nawet gdyby ktoś w przyszłości dodał
-- politykę dla anon, brak GRANT-u i tak zablokuje dostęp.
do $$
declare
  t text;
  tabele text[] := array[
    'specjalizacje', 'badania', 'badania_kategorie', 'kategorie_badan',
    'pakiety_badania', 'pakiety_specjalizacje', 'pakiety_zakresy_dodatkowe',
    'pakiet_badania', 'pakiet_specjalizacje', 'pakiet_rehabilitacja',
    'pakiet_stomatologia', 'pakiet_telemedycyna', 'pakiet_skladki_historia',
    'pakiety', 'dostawcy', 'placowki_medyczne', 'relacje_sieci',
    'historia_wyszukiwan'
  ];
begin
  foreach t in array tabele loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Widok pakiety_pelne ma security_invoker=on, więc dziedziczy RLS tabel
-- źródłowych. Odcinamy go od anon dla spójności.
revoke all on public.pakiety_pelne from anon;

commit;

-- ============================================================================
-- WERYFIKACJA PO URUCHOMIENIU
--
-- 1) anon nie widzi nic (oczekiwane: same zera):
--    begin;
--      set local role anon;
--      select (select count(*) from public.pakiety)          as pakiety,
--             (select count(*) from public.placowki_medyczne) as placowki;
--    rollback;
--
-- 2) aktywny użytkownik widzi rdzeń porównania (oczekiwane: 3216 / 1482):
--    -- test przez aplikację na koncie z med.members.aktywny = true
--
-- 3) brak tabel MEDICALAURY bez polityk:
--    select c.relname
--    from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
--      and c.relname in ('badania','pakiety_badania','pakiety_specjalizacje')
--      and not exists (select 1 from pg_policies p
--                      where p.schemaname='public' and p.tablename=c.relname);
--    -- oczekiwane: 0 wierszy
-- ============================================================================
