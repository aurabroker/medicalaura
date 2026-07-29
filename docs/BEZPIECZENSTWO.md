# MEDICALAURA — Architektura bezpieczeństwa

Audyt i projekt: 2026-07-29
Baza: `aurabroker` (`kukvgsjrmrqtzhkszzum`), PostgreSQL 17, eu-west-1
Decyzja: **zostajemy we wspólnej bazie**, zabezpieczenia budujemy w miejscu.

---

## 1. Punkt wyjścia

Baza nie należy wyłącznie do MEDICALAURY. To ~130 tabel obsługujących równolegle
kilka żywych produktów:

| Sąsiad w bazie | Wolumen | Charakter danych |
|---|---:|---|
| `crm_prospects` / `crm_clients` | 6 147 / 1 301 | dane osobowe (RODO) |
| `izba_diagnostician_pii` | 2 | **PESEL** |
| `crm_policies` / `crm_policy_payments` | 99 / 202 | dane finansowe |
| `ads_oauth_tokens` | 3 | **tokeny OAuth** |

Każdy błąd w politykach MEDICALAURY ma promień rażenia obejmujący te dane.
Stąd nadrzędna zasada projektu: **MEDICALAURA nie dziedziczy i nie nadaje
uprawnień poza własną domeną.**

---

## 2. Ustalenia audytu

Wszystkie punkty zweryfikowane zapytaniami do bazy produkcyjnej, nie z kodu.

### 2.1 Silnik porównania jest martwy

13 tabel ma RLS włączony i **zero polityk**. PostgreSQL domyślnie odmawia
wtedy wszystkiego. Pomiar wykonany jako rola `anon`:

| Tabela | W bazie | Widzi klient |
|---|---:|---:|
| `pakiety` | 41 | 41 |
| `placowki_medyczne` | 10 417 | 10 417 |
| `pakiety_badania` | 3 216 | **0** |
| `pakiety_specjalizacje` | 1 482 | **0** |
| `badania` | 1 015 | **0** |

`index2.html` odpytuje `pakiety_badania` i `pakiety_specjalizacje` po 8 razy
i za każdym razem dostaje pustkę. Dotyczy to również zalogowanych — brak
polityki oznacza odmowę dla `anon` **i** `authenticated`; przechodzi wyłącznie
`service_role`. **4 698 wierszy stanowiących istotę produktu jest niedostępnych.**

### 2.2 Każdy zalogowany może skasować bazę placówek

```
placowki_medyczne (10 417 wierszy)
polityka "Edycja placówek admin", cmd = ALL
USING (auth.role() = 'authenticated')
```

Nazwa mówi „admin", warunek sprawdza wyłącznie fakt zalogowania. `ALL`
obejmuje `UPDATE` i `DELETE`. Identycznie w `relacje_sieci`. Ktokolwiek
uzyska konto, może jednym żądaniem wyczyścić bazę placówek.

### 2.3 Pozostałe

| # | Ustalenie | Waga |
|---|---|---|
| 1 | `pakiety` i `dostawcy`: `SELECT USING (true)` → pełny cennik do pobrania bez logowania | 🔴 |
| 2 | 11 kont w `auth.users`, **1** rekord w `profiles`; trigger zakładający profile **nie istnieje** | 🟠 |
| 3 | `profiles` ma wyłącznie politykę SELECT → panel admina nie może edytować użytkowników | 🟠 |
| 4 | 19 funkcji `SECURITY DEFINER` wywoływalnych przez `anon`; 16 bez `search_path` | 🟠 |
| 5 | 10 polityk `WITH CHECK (true)` — niekontrolowany zapis | 🟠 |
| 6 | 3 publiczne bucket-y pozwalają listować zawartość | 🟠 |
| 7 | Ochrona przed wyciekłymi hasłami **wyłączona**, brak MFA dla admina | 🟠 |
| 8 | `admin/index.html` wykonuje `update`/`delete` kluczem `anon` z przeglądarki | 🔴 |

Dwie rzeczy działają dobrze i zostają: brak polityki UPDATE na `profiles`
uniemożliwia samodzielne podniesienie roli, a widok `v_admin_users`
(zawierający `auth.users.email`) nie ma grantów dla `anon`/`authenticated`.

---

## 3. Decyzje projektowe

### D1. Własna domena uprawnień zamiast współdzielonego `profiles`

`profiles.rola = 'admin'` jest sprawdzane przez polityki **pięciu innych
projektów**: `aura_articles`, `aura_reviews`, `cms_platforms`, `div_review`,
`ud_review`. Nadanie komuś admina MEDICALAURY uczyniłoby go automatycznie
adminem tamtych modułów.

Dlatego MEDICALAURA dostaje własny schemat `med` z tabelą `med.members`
i funkcjami `med.is_admin()` / `med.has_access()`. `profiles` zostaje
nietknięte — inne projekty działają bez zmian.

### D2. Sprawdzanie uprawnień w bazie, nie w JWT

Rozważaliśmy Custom Access Token Hook wstrzykujący rolę do tokenu (slot jest
wolny — żaden projekt go nie zajmuje). Byłby szybszy, ale **odebranie dostępu
działałoby dopiero po wygaśnięciu tokenu**. Przy narzędziu z danymi cenowymi
i osobowymi natychmiastowe odcięcie jest ważniejsze niż kilka milisekund.

Wybór: funkcje `STABLE SECURITY DEFINER`. Deaktywacja konta działa od razu,
przy następnym zapytaniu.

### D3. Deny-by-default na każdym poziomie

- `med.members.aktywny` = **`false`** domyślnie — nowe konto nie widzi nic,
  dopóki admin świadomie go nie aktywuje.
- Wszystkie polityki jawnie `TO authenticated`. Rola `anon` nie ma żadnej
  pasującej polityki → jest odcięta całkowicie.
- Dodatkowo `REVOKE ALL ... FROM anon` jako pas bezpieczeństwa niezależny
  od RLS: nawet gdyby ktoś w przyszłości dodał politykę dla `anon`,
  brak GRANT-u i tak zablokuje dostęp.

### D4. Zakres zmian ograniczony do MEDICALAURY

Funkcje `crm_*`, `izba_*`, `bond_*`, `apk_*`, `ud_*` mają te same wady
(`search_path`), ale należą do innych projektów. Ich naprawa bez znajomości
tamtego kodu mogłaby je zepsuć — trafiają na osobną listę w migracji 0004.

---

## 4. Warstwy zabezpieczeń

```
┌─ Cloudflare ────────── WAF, Rate Limiting, Turnstile, sekrety Workers
├─ Next.js ───────────── @supabase/ssr (httpOnly cookies), Server Actions,
│                        walidacja Zod na każdej granicy, middleware tras
├─ PostgreSQL RLS ────── deny-by-default, med.is_admin() / med.has_access()
├─ Rejestr audytowy ──── med.audit_log, niezmienny, tylko dopisywanie
└─ Supabase Auth ─────── MFA dla adminów, ochrona przed wyciekłymi hasłami
```

Klucz `service_role` **wyłącznie** jako sekret w Cloudflare Workers, nigdy
w przeglądarce. Panel administracyjny przechodzi na Server Actions —
`admin/index.html` (edytor RAW na kluczu `anon`) zostaje wycofany.

---

## 5. Migracje

| Plik | Zakres |
|---|---|
| `0001_med_core.sql` | schemat `med`, `med.members`, funkcje, trigger na nowe konta, przeniesienie istniejących kont |
| `0002_rls_medicalaura.sql` | polityki dla 18 tabel; naprawa 2.1, 2.2 i wycieku cennika |
| `0003_audit_log.sql` | `med.audit_log` + triggery na tabelach wrażliwych |
| `0004_hardening_funkcje.sql` | `search_path` w funkcjach MEDICALAURY + lista ustawień panelu |
| `ROLLBACK.sql` | powrót do stanu sprzed utwardzenia |

**Żadna nie została uruchomiona.** Wymagają przeglądu i decyzji o oknie
serwisowym.

### Skutek uboczny do zaakceptowania

Migracja 0002 jest **zmianą łamiącą**: po niej `index.html`, `index2.html`
i `admin/index.html` przestaną czytać dane bez zalogowania. To celowe —
tak zamyka się wyciek cennika. Uruchamiać razem z przełączeniem na Next.js
albo w świadomie przyjętym oknie przestoju.

### Kolejność

1. `0001` — bezpieczna, nic nie psuje (dodaje nowe obiekty).
2. `0004` — bezpieczna, zachowanie funkcji bez zmian.
3. `0003` — bezpieczna, sam rejestr.
4. `0002` — **zmiana łamiąca**, wymaga okna serwisowego.

Po każdej: `select * from med.audit_log order by ts desc limit 20;`
oraz ponowne uruchomienie advisorów.

---

## 6. Decyzje oczekujące na Ciebie

| # | Pytanie | Przyjęte założenie |
|---|---|---|
| **D5** | Kto może założyć konto? | Wyłącznie zaproszenie od admina; `aktywny = false` domyślnie |
| **D6** | Czy porównywarka ma być widoczna bez logowania? | Nie — wszystko za logowaniem (zamyka wyciek cennika) |
| **D7** | Jak przetwarzamy oferty bazowe (PDF/XLSX)? | Do ustalenia; **brak plików uniemożliwia projekt schematu porównania** |

Założenia D5 i D6 są zaszyte w migracjach 0001 i 0002. Zmiana któregokolwiek
wymaga korekty polityk **przed** uruchomieniem.

---

## 7. Czego wciąż brakuje

- **Oferty bazowe do zmapowania** — bez nich nie zaprojektuję docelowego
  modelu porównania ani mapowania na `pakiety_*`.
- Rozstrzygnięcia D5–D7.
- Okna serwisowego dla migracji 0002.
