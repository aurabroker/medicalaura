-- ============================================================================
-- MEDICALAURA — 0009 — Naprawa widoku moj_dostep
-- ----------------------------------------------------------------------------
-- Błąd: adminowi widok zwracał WSZYSTKICH członków zamiast jego samego.
--
-- Polityka members_admin_all (migracja 0001) celowo daje adminowi wgląd
-- w całą tabelę med.members — jest potrzebna do zarządzania użytkownikami.
-- Widok moj_dostep dziedziczył tę politykę przez security_invoker, więc dla
-- konta admina zwracał 11 wierszy zamiast jednego.
--
-- Aplikacja wywołuje na nim .single(), co przy wielu wierszach kończy się
-- błędem. Layout traktował to jak brak dostępu i pokazywał adminowi ekran
-- „konto oczekuje na aktywację", mimo że konto było aktywne.
--
-- Widok nazywa się „mój dostęp" — semantycznie ma zwracać jeden wiersz.
-- Filtr wpisujemy w jego definicję, zamiast polegać na szerokości polityk.
--
-- STATUS: ZASTOSOWANE na produkcji 2026-07-30.
-- ============================================================================

create or replace view public.moj_dostep
with (security_invoker = on) as
  select user_id, rola, aktywny, plan, plan_do, firma
  from med.members
  where user_id = (select auth.uid());

-- Weryfikacja: dla każdego zalogowanego dokładnie jeden wiersz.
--   begin;
--     set local role authenticated;
--     set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
--     select count(*) from public.moj_dostep;  -- oczekiwane: 1
--   rollback;
