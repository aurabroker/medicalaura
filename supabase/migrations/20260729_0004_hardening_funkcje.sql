-- ============================================================================
-- MEDICALAURA — 0004 — Utwardzenie funkcji
-- ----------------------------------------------------------------------------
-- Advisors zgłaszają 16 funkcji z modyfikowalnym search_path. W funkcji
-- SECURITY DEFINER to realny wektor eskalacji: atakujący, który potrafi
-- utworzyć obiekt we własnym schemacie, może podstawić go pod niekwalifikowaną
-- nazwę i wykonać własny kod z uprawnieniami właściciela funkcji.
--
-- ZAKRES: świadomie ograniczony do funkcji używanych przez MEDICALAURĘ.
-- Pozostałe (crm_*, izba_*, bond_*, apk_*, ud_*) należą do innych projektów
-- w tej bazie — ich zmiana bez znajomości tamtego kodu mogłaby je zepsuć.
-- Lista do osobnego przeglądu znajduje się na końcu pliku.
--
-- STATUS: NIEZASTOSOWANE. Do przeglądu przed uruchomieniem.
-- ============================================================================

begin;

-- ─── public.is_admin() ──────────────────────────────────────────────────────
-- Miała search_path = 'public' i odwoływała się do niekwalifikowanego
-- "profiles". Kwalifikujemy nazwę i domykamy search_path.
-- Zachowanie bez zmian — inne projekty korzystające z tej funkcji nie ucierpią.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.rola = 'admin'
      and p.aktywny = true
  );
$$;

-- ─── public.is_authenticated() ──────────────────────────────────────────────
-- Nie miała search_path w ogóle. Ciało odwołuje się wyłącznie do auth.uid(),
-- które jest już w pełni kwalifikowane — zmiana jest bezpieczna.
create or replace function public.is_authenticated()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null;
$$;

commit;

-- ============================================================================
-- POZOSTAŁE FUNKCJE DO PRZEGLĄDU (poza zakresem tej migracji)
--
-- Lista funkcji SECURITY DEFINER bez ustawionego search_path:
--
--   select n.nspname, p.proname,
--          coalesce(array_to_string(p.proconfig, ','), 'BRAK') as config
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.prosecdef
--     and (p.proconfig is null
--          or not exists (select 1 from unnest(p.proconfig) c
--                         where c like 'search_path=%'))
--   order by p.proname;
--
-- Każdą trzeba poprawić razem z właścicielem jej projektu: dopisać
-- SET search_path = '' i zakwalifikować wszystkie nazwy obiektów w ciele.
--
-- Osobna pozycja: public.fix_auth_user_null_tokens() — trigger na auth.users,
-- SECURITY DEFINER, brak search_path. Dotyczy WSZYSTKICH projektów w bazie,
-- więc wymaga oddzielnego okna serwisowego i testu logowania po zmianie.
-- ============================================================================


-- ============================================================================
-- USTAWIENIA POZA SQL — do wyklikania w panelu Supabase
--
--  1. Authentication → Providers → Email
--       ✅ "Leaked password protection"  (advisor: WYŁĄCZONE)
--       ✅ minimalna długość hasła 12 znaków
--
--  2. Authentication → Multi-Factor
--       ✅ TOTP włączone; wymuszone dla kont z med.members.rola = 'admin'
--
--  3. Authentication → Sign In / Providers
--       ❌ "Enable email signups" — WYŁĄCZYĆ, jeśli model kont ma być
--          wyłącznie na zaproszenie (patrz docs/BEZPIECZENSTWO.md, decyzja D2)
--
--  4. Storage → buckets logos / article-images / apk-pdfs
--       Publiczne bucket-y mają szerokie polityki SELECT pozwalające
--       LISTOWAĆ zawartość. Do odczytu plików po URL to zbędne — zawęzić.
--
--  5. Settings → API
--       Po przejściu na Next.js rozważyć rotację klucza anon.
-- ============================================================================
