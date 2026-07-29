-- ============================================================================
-- MEDICALAURA — 0006 — Funkcje panelu administracyjnego
-- ----------------------------------------------------------------------------
-- Pozwalają zarządzać dostępem BEZ udostępniania aplikacji klucza
-- service_role. Obie funkcje sprawdzają uprawnienia w pierwszej instrukcji,
-- więc próba wywołania przez nie-admina kończy się błędem po stronie bazy —
-- niezależnie od tego, co zrobi przeglądarka.
--
-- STATUS: ZASTOSOWANE na produkcji 2026-07-29.
-- ============================================================================

create or replace function public.med_lista_uzytkownikow()
returns table (
  user_id uuid, email text, rola text, aktywny boolean, plan text,
  plan_do date, firma text, utworzony timestamptz, ostatnie_logowanie timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not med.is_admin() then
    raise exception 'Brak uprawnien administratora' using errcode = '42501';
  end if;

  return query
    select m.user_id, u.email::text, m.rola, m.aktywny, m.plan, m.plan_do,
           m.firma, u.created_at, u.last_sign_in_at
    from med.members m
    join auth.users u on u.id = m.user_id
    order by m.aktywny desc, u.created_at;
end;
$$;

create or replace function public.med_ustaw_dostep(
  p_user uuid, p_aktywny boolean, p_rola text default null, p_plan text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not med.is_admin() then
    raise exception 'Brak uprawnien administratora' using errcode = '42501';
  end if;

  -- Admin nie moze odebrac uprawnien samemu sobie: to najczestsza droga
  -- do zablokowania sie poza systemem bez mozliwosci powrotu.
  if p_user = (select auth.uid()) and (p_aktywny = false or p_rola <> 'admin') then
    raise exception 'Nie mozna odebrac uprawnien wlasnemu kontu' using errcode = '42501';
  end if;

  update med.members
     set aktywny = p_aktywny,
         rola    = coalesce(p_rola, rola),
         plan    = coalesce(p_plan, plan)
   where user_id = p_user;

  if not found then
    raise exception 'Nie znaleziono uzytkownika' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.med_lista_uzytkownikow() from public, anon;
revoke all on function public.med_ustaw_dostep(uuid, boolean, text, text) from public, anon;
grant execute on function public.med_lista_uzytkownikow() to authenticated;
grant execute on function public.med_ustaw_dostep(uuid, boolean, text, text) to authenticated;
