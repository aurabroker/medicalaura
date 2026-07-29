-- ============================================================================
-- MEDICALAURA — 0003 — Rejestr audytowy
-- ----------------------------------------------------------------------------
-- Przy danych ubezpieczeniowych i osobowych sam RLS nie wystarcza: trzeba
-- wiedzieć KTO i KIEDY zmienił dane. Rejestr jest niezmienny — nikt, łącznie
-- z adminem, nie może z niego nic usunąć ani w nim niczego zmienić.
--
-- STATUS: NIEZASTOSOWANE. Do przeglądu przed uruchomieniem.
-- ============================================================================

begin;

create table if not exists med.audit_log (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  user_id    uuid,
  akcja      text        not null check (akcja in ('INSERT','UPDATE','DELETE')),
  tabela     text        not null,
  rekord_id  text,
  dane_przed jsonb,
  dane_po    jsonb
);

create index if not exists audit_log_ts_idx     on med.audit_log (ts desc);
create index if not exists audit_log_user_idx   on med.audit_log (user_id, ts desc);
create index if not exists audit_log_tabela_idx on med.audit_log (tabela, ts desc);

comment on table med.audit_log is
  'Niezmienny rejestr zmian w danych MEDICALAURY. Tylko dopisywanie.';

alter table med.audit_log enable row level security;

-- Admin czyta. NIKT nie pisze, nie zmienia i nie kasuje przez API —
-- wpisy powstają wyłącznie triggerem (SECURITY DEFINER).
drop policy if exists audit_admin_read on med.audit_log;
create policy audit_admin_read on med.audit_log
  for select to authenticated
  using (med.is_admin());

revoke all on med.audit_log from anon, authenticated;
grant select on med.audit_log to authenticated;


-- ─── Funkcja rejestrująca ───────────────────────────────────────────────────
create or replace function med.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
begin
  v_id := case
            when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id')
            else (to_jsonb(new) ->> 'id')
          end;

  insert into med.audit_log (user_id, akcja, tabela, rekord_id, dane_przed, dane_po)
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    v_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


-- ─── Podpięcie pod tabele wrażliwe na zmiany ────────────────────────────────
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
    execute format($f$
      create trigger med_audit
        after insert or update or delete on public.%I
        for each row execute function med.audit_trigger()
    $f$, t);
  end loop;
end $$;

-- Zmiany uprawnień to zdarzenie krytyczne — rejestrujemy zawsze.
drop trigger if exists med_audit on med.members;
create trigger med_audit
  after insert or update or delete on med.members
  for each row execute function med.audit_trigger();

commit;

-- ============================================================================
-- WERYFIKACJA:
--   select ts, akcja, tabela, rekord_id from med.audit_log order by ts desc limit 20;
-- ============================================================================
