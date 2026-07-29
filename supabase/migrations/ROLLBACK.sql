-- ============================================================================
-- MEDICALAURA — WYCOFANIE migracji 0001–0004
-- ----------------------------------------------------------------------------
-- Przywraca stan bazy sprzed utwardzenia, odtwarzając polityki dokładnie
-- w brzmieniu zastanym podczas audytu z 2026-07-29.
--
-- ⚠️  UWAGA: wycofanie ŚWIADOMIE przywraca luki bezpieczeństwa:
--      • każdy zalogowany znów może modyfikować i kasować 10 417 placówek
--      • cennik i lista dostawców znów są czytelne bez logowania
--    Używać wyłącznie, gdy utwardzenie zepsuje działającą aplikację
--    i potrzebny jest natychmiastowy powrót do poprzedniego stanu.
-- ============================================================================

begin;

-- ─── Zdjęcie triggerów audytu ───────────────────────────────────────────────
do $$
declare
  t text;
  tabele text[] := array[
    'pakiety', 'dostawcy', 'placowki_medyczne',
    'pakiety_badania', 'pakiety_specjalizacje', 'pakiety_zakresy_dodatkowe'
  ];
begin
  foreach t in array tabele loop
    execute format('drop trigger if exists med_audit on public.%I', t);
  end loop;
end $$;

drop trigger if exists med_on_auth_user_created on auth.users;


-- ─── Zdjęcie nowych polityk ─────────────────────────────────────────────────
do $$
declare
  t text;
  tabele text[] := array[
    'specjalizacje', 'badania', 'badania_kategorie', 'kategorie_badan',
    'pakiety_badania', 'pakiety_specjalizacje', 'pakiety_zakresy_dodatkowe',
    'pakiet_badania', 'pakiet_specjalizacje', 'pakiet_rehabilitacja',
    'pakiet_stomatologia', 'pakiet_telemedycyna', 'pakiet_skladki_historia',
    'pakiety', 'dostawcy', 'placowki_medyczne', 'relacje_sieci'
  ];
begin
  foreach t in array tabele loop
    execute format('drop policy if exists med_read  on public.%I', t);
    execute format('drop policy if exists med_write on public.%I', t);
    execute format('grant select on public.%I to anon', t);
  end loop;
end $$;

drop policy if exists hw_read_own    on public.historia_wyszukiwan;
drop policy if exists hw_insert_own  on public.historia_wyszukiwan;
drop policy if exists hw_delete_own  on public.historia_wyszukiwan;
drop policy if exists hw_admin_all   on public.historia_wyszukiwan;


-- ─── Odtworzenie polityk zastanych ──────────────────────────────────────────
create policy "Publiczny odczyt placówek" on public.placowki_medyczne
  for select using (true);
create policy "Edycja placówek admin" on public.placowki_medyczne
  for all using (auth.role() = 'authenticated');

create policy "Publiczny odczyt relacji" on public.relacje_sieci
  for select using (true);
create policy "Edycja relacji admin" on public.relacje_sieci
  for all using (auth.role() = 'authenticated');

create policy "Odczyt pakietow dla wszystkich" on public.pakiety
  for select using (true);
create policy "Zarzadzanie pakietami tylko dla admina" on public.pakiety
  for all using (
    (select p.rola from public.profiles p where p.id = auth.uid()) = 'admin'
  );

create policy "Odczyt dostawcow dla wszystkich" on public.dostawcy
  for select using (true);
create policy "Zarzadzanie dostawcami tylko dla admina" on public.dostawcy
  for all using (
    (select p.rola from public.profiles p where p.id = auth.uid()) = 'admin'
  );

create policy "Odczyt wlasnej historii" on public.historia_wyszukiwan
  for select using (auth.uid() = user_id);
create policy "Zapis historii wyszukiwan" on public.historia_wyszukiwan
  for insert with check (auth.uid() = user_id);
create policy "Admin widzi całą historię" on public.historia_wyszukiwan
  for all using (public.is_admin());

commit;

-- ============================================================================
-- Schemat med pozostaje nienaruszony — samo jego istnienie niczego nie psuje,
-- a zachowuje rejestr audytowy i przypisania ról.
-- Pełne usunięcie (NIEODWRACALNE, kasuje audit_log):
--
--   drop schema med cascade;
-- ============================================================================
