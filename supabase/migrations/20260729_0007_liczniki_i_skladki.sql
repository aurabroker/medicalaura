-- ============================================================================
-- MEDICALAURA — 0007 — Liczniki badań i zapis składek
-- ----------------------------------------------------------------------------
-- 1. Widok pakiety_liczniki odtwarza w SQL logikę fetchEnhancedPackages()
--    z index2.html: deduplikację nazw badań i klasyfikację RTG/TK/MRI/USG.
--    W oryginale liczyła to przeglądarka i przy zablokowanym RLS wychodziły
--    zera — kod nie miał wartości zapasowej dla tych trzech wierszy.
--
-- 2. med_zapisz_skladke pozwala zapisać kwotę wynegocjowaną z oferty.
--    Pod RLS z migracji 0002 update na pakiety przechodzi tylko adminowi;
--    funkcja mówi to wprost, zamiast kończyć się cichym brakiem zmian.
--
-- STATUS: ZASTOSOWANE na produkcji 2026-07-29.
-- ============================================================================

create or replace view public.pakiety_liczniki
with (security_invoker = on) as
select
  p.id as pakiet_id,
  b.badania_unikalne, b.rtg, b.tk, b.mri, b.usg,
  s.specjalizacje_unikalne
from public.pakiety p
left join (
  select pb.pakiet_id,
         count(distinct lower(btrim(pb.badanie_nazwa))) as badania_unikalne,
         count(distinct lower(btrim(pb.badanie_nazwa)))
           filter (where upper(pb.badanie_nazwa) ~ '\m(RTG|RENTGEN)\M') as rtg,
         count(distinct lower(btrim(pb.badanie_nazwa)))
           filter (where upper(pb.badanie_nazwa) ~ '\m(TK|TOMOGRAF|TOMOGRAFIA)\M') as tk,
         count(distinct lower(btrim(pb.badanie_nazwa)))
           filter (where upper(pb.badanie_nazwa) ~ '\m(MR|MRI|REZONANS)\M') as mri,
         count(distinct lower(btrim(pb.badanie_nazwa)))
           filter (where upper(pb.badanie_nazwa) ~ '\m(USG|ULTRASONO)\M') as usg
  from public.pakiety_badania pb
  where coalesce(btrim(pb.badanie_nazwa), '') <> ''
  group by pb.pakiet_id
) b on b.pakiet_id = p.id
left join (
  select ps.pakiet_id,
         count(distinct lower(btrim(ps.specjalizacja_nazwa))) as specjalizacje_unikalne
  from public.pakiety_specjalizacje ps
  where coalesce(btrim(ps.specjalizacja_nazwa), '') <> ''
  group by ps.pakiet_id
) s on s.pakiet_id = p.id;

revoke all on public.pakiety_liczniki from anon;
grant select on public.pakiety_liczniki to authenticated;

comment on view public.pakiety_liczniki is
  'Liczniki badan i specjalizacji z deduplikacja po nazwie. NULL = brak danych szczegolowych, wtedy stosuj kolumne z pakiety.';

create or replace function public.med_zapisz_skladke(
  p_pakiet_id integer,
  p_cena      numeric
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not med.is_admin() then
    raise exception 'Zapis skladki wymaga uprawnien administratora' using errcode = '42501';
  end if;

  if p_cena is not null and (p_cena < 0 or p_cena > 1000000) then
    raise exception 'Kwota poza dopuszczalnym zakresem' using errcode = '22003';
  end if;

  update public.pakiety set cena_grup_mies = p_cena where id = p_pakiet_id;

  if not found then
    raise exception 'Nie znaleziono pakietu' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.med_zapisz_skladke(integer, numeric) from public, anon;
grant execute on function public.med_zapisz_skladke(integer, numeric) to authenticated;

-- ============================================================================
-- UWAGA DO DANYCH
-- Wyliczone badania_unikalne rozni sie od kolumny liczba_badan_lab
-- (986 vs 626 dla „Pakiet F"). Kolumna liczy najwyrazniej wezszy zbior.
-- Aplikacja celowo NIE nadpisuje liczba_badan_lab ani liczba_specjalizacji —
-- te kolumny wyswietlaly sie dotad poprawnie, a zmiana ich znaczenia jest
-- decyzja biznesowa. Z widoku bierzemy tylko RTG/TK/MRI/USG.
-- ============================================================================
