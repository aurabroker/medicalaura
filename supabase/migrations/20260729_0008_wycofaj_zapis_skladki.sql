-- ============================================================================
-- MEDICALAURA — 0008 — Wycofanie zapisu składek do katalogu
-- ----------------------------------------------------------------------------
-- Funkcja med_zapisz_skladke z migracji 0007 była błędem projektowym.
--
-- Składka jest negocjowana osobno przy każdej ofercie i dla każdego klienta
-- wychodzi inna. Zapisanie jej do public.pakiety nadpisywałoby cenę
-- wszystkim użytkownikom kwotą z jednej konkretnej sprawy.
--
-- Katalog opisuje ZAKRES pakietu — specjalizacje, badania, świadczenia.
-- Cena należy do pojedynczej oferty i pozostaje w obrębie sesji porównania,
-- skąd trafia do wygenerowanego PDF.
--
-- STATUS: ZASTOSOWANE na produkcji 2026-07-29.
-- ============================================================================

drop function if exists public.med_zapisz_skladke(integer, numeric);
