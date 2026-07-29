-- ============================================================================
-- MEDICALAURA — 0005 — Widok dostępu dla aplikacji
-- ----------------------------------------------------------------------------
-- Aplikacja musi odczytać rolę i plan zalogowanego użytkownika, ale schemat
-- med celowo NIE jest wystawiony przez PostgREST — wystawienie go otworzyłoby
-- też med.audit_log i całą tabelę członkostwa.
--
-- Zamiast tego dajemy wąskie okno w schemacie public. security_invoker = on
-- sprawia, że widok dziedziczy RLS tabeli źródłowej, więc polityka
-- members_read_own ogranicza wynik do własnego wiersza.
--
-- STATUS: ZASTOSOWANE na produkcji 2026-07-29.
-- ============================================================================

create or replace view public.moj_dostep
with (security_invoker = on) as
  select user_id, rola, aktywny, plan, plan_do, firma
  from med.members;

revoke all on public.moj_dostep from anon;
grant select on public.moj_dostep to authenticated;

comment on view public.moj_dostep is
  'Członkostwo MEDICALAURY zalogowanego użytkownika. RLS ogranicza do własnego wiersza.';
