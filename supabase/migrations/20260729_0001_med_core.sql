-- ============================================================================
-- MEDICALAURA — 0001 — Rdzeń kontroli dostępu
-- ----------------------------------------------------------------------------
-- Cel: dać MEDICALAURZE własną, odizolowaną domenę uprawnień w bazie
--      współdzielonej z CRM / PISKP / ads / life.
--
-- Dlaczego NIE używamy public.profiles:
--   profiles.rola = 'admin' jest współdzielone przez 5 innych projektów
--   (aura_articles, aura_reviews, cms_platforms, div_review, ud_review).
--   Nadanie komuś admina w MEDICALAURZE uczyniłoby go adminem tamtych
--   projektów. To wyciek uprawnień — rozdzielamy je twardo.
--
-- STATUS: NIEZASTOSOWANE. Do przeglądu przed uruchomieniem.
-- ============================================================================

begin;

-- ─── Schemat ────────────────────────────────────────────────────────────────
create schema if not exists med;

-- Domyślnie nikt nie ma nic. Dostęp nadajemy punktowo, niżej.
revoke all on schema med from public;
revoke all on all tables in schema med from public, anon, authenticated;

-- authenticated musi widzieć schemat, by móc wywołać funkcje pomocnicze
-- w wyrażeniach polityk RLS. anon nie dostaje nic — jest odcięty całkowicie.
grant usage on schema med to authenticated;


-- ─── Członkostwo w MEDICALAURA ──────────────────────────────────────────────
-- aktywny = false DOMYŚLNIE. Nowe konto nie ma dostępu do niczego,
-- dopóki admin świadomie go nie aktywuje (deny-by-default).
create table if not exists med.members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  rola       text        not null default 'broker'
                         check (rola in ('admin','broker','viewer')),
  aktywny    boolean     not null default false,
  plan       text        not null default 'trial'
                         check (plan in ('trial','pro','enterprise')),
  plan_do    date,
  firma      text,
  notatka    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table  med.members is
  'Dostęp do MEDICALAURY. Celowo odseparowane od public.profiles, które jest współdzielone z innymi projektami.';
comment on column med.members.aktywny is
  'Deny-by-default: false do czasu ręcznej aktywacji przez admina.';

alter table med.members enable row level security;

-- Nowa tabela w schemacie niestandardowym nie dziedziczy domyślnych grantów
-- Supabase (te dotyczą wyłącznie schematu public). Bez tego GRANT-u polityka
-- members_read_own byłaby martwa — użytkownik nie odczytałby własnego planu.
revoke all on med.members from anon;
grant select on med.members to authenticated;


-- ─── Funkcje pomocnicze ─────────────────────────────────────────────────────
-- search_path = '' + nazwy w pełni kwalifikowane = odporność na przejęcie
-- przez podstawiony obiekt w cudzym schemacie (wektor eskalacji uprawnień).
--
-- Decyzja projektowa: sprawdzamy uprawnienia ZAPYTANIEM DO BAZY, nie claimem
-- w JWT. JWT byłby szybszy, ale odebranie dostępu działałoby dopiero po
-- wygaśnięciu tokenu. Tutaj deaktywacja konta działa natychmiast.
create or replace function med.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from med.members m
    where m.user_id = (select auth.uid())
      and m.rola    = 'admin'
      and m.aktywny
  );
$$;

create or replace function med.has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from med.members m
    where m.user_id = (select auth.uid())
      and m.aktywny
      and (m.plan_do is null or m.plan_do >= current_date)
  );
$$;

comment on function med.is_admin()   is 'TRUE gdy bieżący użytkownik jest aktywnym adminem MEDICALAURY.';
comment on function med.has_access() is 'TRUE gdy bieżący użytkownik jest aktywny i ma ważny plan.';

revoke all on function med.is_admin(), med.has_access() from public, anon;
grant execute on function med.is_admin(), med.has_access() to authenticated;


-- ─── RLS na samej tabeli członkostwa ────────────────────────────────────────
drop policy if exists members_read_own on med.members;
drop policy if exists members_admin_all on med.members;

-- Użytkownik widzi wyłącznie swój wiersz i nie może go zmienić.
create policy members_read_own on med.members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Admin zarządza wszystkimi. Brak polityki UPDATE dla zwykłego usera oznacza,
-- że NIKT nie podniesie sobie roli do 'admin' — to zamyka eskalację uprawnień.
create policy members_admin_all on med.members
  for all to authenticated
  using (med.is_admin())
  with check (med.is_admin());


-- ─── Automatyczne zakładanie członkostwa ────────────────────────────────────
-- Ustalono w audycie: 11 kont w auth.users, tylko 1 profil. Nie istnieje
-- żaden trigger tworzący profile — jedyny to fix_auth_user_null_tokens.
-- Ten trigger domyka lukę, ale bez przyznawania dostępu (aktywny = false).
create or replace function med.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into med.members (user_id, aktywny, rola)
  values (new.id, false, 'broker')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists med_on_auth_user_created on auth.users;
create trigger med_on_auth_user_created
  after insert on auth.users
  for each row execute function med.handle_new_user();


-- ─── Znacznik czasu modyfikacji ─────────────────────────────────────────────
create or replace function med.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists med_members_touch on med.members;
create trigger med_members_touch
  before update on med.members
  for each row execute function med.touch_updated_at();


-- ─── Zasiedlenie: przeniesienie istniejących kont ───────────────────────────
-- Wszystkie istniejące konta dostają członkostwo NIEAKTYWNE.
insert into med.members (user_id, aktywny, rola)
select u.id, false, 'broker'
from auth.users u
on conflict (user_id) do nothing;

-- Dotychczasowy admin z public.profiles zachowuje uprawnienia administratora.
update med.members m
set rola = 'admin', aktywny = true
where exists (
  select 1 from public.profiles p
  where p.id = m.user_id and p.rola = 'admin' and p.aktywny
);

commit;

-- ============================================================================
-- WERYFIKACJA PO URUCHOMIENIU:
--   select rola, aktywny, count(*) from med.members group by 1,2;
--   -- oczekiwane: 1 × (admin, true) + 10 × (broker, false)
-- ============================================================================
