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

**Status: WSZYSTKIE ZASTOSOWANE NA PRODUKCJI 2026-07-29**, w kolejności
0001 → 0004 → 0003 → 0002 (bezpieczne przed łamiącą).

### Skutek uboczny — zrealizowany

Migracja 0002 była **zmianą łamiącą** i została uruchomiona świadomie:
`index.html`, `index2.html` i `admin/index.html` nie czytają już danych
bez zalogowania. Tak zamknięto wyciek cennika. Do czasu uruchomienia
aplikacji Next.js pliki te pozostają niefunkcjonalne — to stan oczekiwany,
nie awaria.

---

## 5a. Wyniki weryfikacji po wdrożeniu

| Test | Wynik |
|---|---|
| `anon` czyta `pakiety` | `permission denied` — odcięcie na poziomie GRANT, przed RLS |
| Aktywny admin | 41 pakietów, 3 216 + 1 482 + 1 015 wierszy rdzenia, 10 417 placówek |
| **Nieaktywny** broker | 0 wszędzie — deny-by-default działa |
| **Aktywny** broker: `DELETE` na placówkach | **0 usuniętych wierszy**, `ma_odczyt = true`, `ma_zapis = false` |
| `med.members` po migracji | 1 × admin aktywny, 10 × broker nieaktywny |

Advisors — porównanie przed/po:

| Ostrzeżenie | Przed | Po |
|---|---:|---:|
| `rls_enabled_no_policy` | 42 | **29** |
| — w tym tabele MEDICALAURY | 13 | **0** |
| `function_search_path_mutable` | 16 | 15 |
| poziom ERROR | 0 | 0 |

Pozostałe 29 ostrzeżeń dotyczy tabel innych projektów (`cms.*`, `ads_*`,
`life_*`, `ezb_*`, `crm_settings`) — poza zakresem zgodnie z decyzją D4.

---

## 6. Decyzje oczekujące na Ciebie

| # | Decyzja | Status |
|---|---|---|
| **D5** | Konta wyłącznie na zaproszenie; `aktywny = false` domyślnie | ✅ zatwierdzone, wdrożone w 0001 |
| **D6** | Wszystko za logowaniem — brak odczytu bez konta | ✅ zatwierdzone, wdrożone w 0002 |
| **D7** | Sposób przetwarzania ofert bazowych (PDF/XLSX) | ⏳ etap 2 |

---

## 7. Następne kroki

**Do wyklikania w panelu Supabase** (nie da się zrobić z SQL):

1. Authentication → Providers → Email: włączyć **ochronę przed wyciekłymi
   hasłami** (advisor nadal zgłasza jako wyłączoną), minimalna długość 12.
2. Authentication → Multi-Factor: TOTP, wymuszone dla `med.members.rola = 'admin'`.
3. Authentication → Sign In: **wyłączyć rejestrację e-mail** (decyzja D5).
4. Storage: zawęzić polityki SELECT na bucketach `logos`, `article-images`,
   `apk-pdfs` — obecnie pozwalają listować zawartość.

**Aktywacja użytkowników.** 10 kont czeka nieaktywnych. Nadanie dostępu:

```sql
update med.members set aktywny = true, plan = 'pro'
 where user_id = '<uuid>';
```

**Etap 2 (aplikacja).** Next.js na Cloudflare Workers, `@supabase/ssr`,
`service_role` wyłącznie jako sekret Workers, wycofanie `admin/index.html`.
Model porównania projektujemy po otrzymaniu ofert bazowych.
