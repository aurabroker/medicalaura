# MEDICALAURA

Narzędzie brokerskie do porównywania pakietów opieki medycznej dla firm.

Aplikacja **Next.js 15** (App Router) na **Cloudflare Workers**, dane w
**Supabase** (PostgreSQL 17). Cały dostęp kontrolowany przez RLS —
opis w [`docs/BEZPIECZENSTWO.md`](docs/BEZPIECZENSTWO.md).

---

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env.local     # uzupełnij sekrety
npm run dev                    # http://localhost:3000
```

Do samego przeglądania wystarczą dwie zmienne publiczne z `.env.example`.
`SUPABASE_SERVICE_ROLE_KEY` nie jest potrzebny — aplikacja go nie używa
(patrz „Zasady bezpieczeństwa" niżej). `PDFSHIFT_API_KEY` jest wymagany
wyłącznie do generowania PDF.

## Wdrożenie na Cloudflare

> ⚠️ **To jest projekt Workers, nie Pages.**
> Cloudflare Pages z adapterem `@cloudflare/next-on-pages` **nie zadziała** —
> ten adapter jest w trybie utrzymaniowym i wymaga runtime `edge` na każdej
> trasie. Objaw pomyłki: w logu builda pojawia się
> `Did you mean to use wrangler.toml to configure Pages?`
> oraz konflikt zależności `@cloudflare/workers-types`.

### Z linii poleceń

```bash
npx wrangler login
npm run cf:build       # build przez @opennextjs/cloudflare
npm run cf:preview     # podgląd lokalny w środowisku Workers
npm run cf:deploy      # wdrożenie
```

### Z repozytorium (Workers Builds)

W panelu Cloudflare: **Workers & Pages → Create → Workers → Connect to Git**.

Domyślne ustawienia wystarczą — nie trzeba wypełniać pola „Build command":

| Ustawienie | Wartość |
|---|---|
| Build command | *(puste)* |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

Worker buduje się w kroku `postinstall` (`scripts/postinstall.mjs`), który
uruchamia się wyłącznie w CI. Lokalne `npm install` pozostaje szybkie.

**Dlaczego przez postinstall, a nie przez pole „Build command":**
`wrangler deploy` wykrywa OpenNext i natychmiast przekazuje sterowanie do
`opennextjs-cloudflare deploy`, który sam **nie buduje** — oczekuje gotowego
katalogu `.open-next/`. Przy pustym polu build kończy się to błędem
`Could not find compiled Open Next config`. Hook `build` w `wrangler.jsonc`
tego nie ratuje (sprawdzone — wykonuje się za późno), a instalacja
zależności to jedyny krok potoku wykonywany zawsze.

Kto woli jawne kroki, może zamiast tego ustawić w panelu:

| Ustawienie | Wartość |
|---|---|
| Deploy command | `npm run cf:release` |

`cf:release` buduje i wdraża w jednej komendzie. Skrypt `postinstall`
wykryje wtedy gotowy katalog `.open-next` i nie zbuduje projektu po raz drugi.

Projekt typu **Pages** utworzony wcześniej dla tego repozytorium trzeba
usunąć — nie da się go przestawić na Workers.

### Sekrety

Nie trzymamy ich w repozytorium:

```bash
npx wrangler secret put PDFSHIFT_API_KEY
```

### Znane ostrzeżenia przy budowaniu

`npm audit` zgłasza podatności w `sharp`, `postcss` i `brace-expansion`.
Wszystkie pochodzą z zależności **build-time** (optymalizacja obrazów,
bundler) i nie trafiają do kodu Workera. Ich naprawa wymaga
`npm audit fix --force`, co łamie Next.js i OpenNext — dlatego zostają.

---

## Struktura

```
app/
  (app)/            trasy za logowaniem — layout sprawdza aktywację konta
    porownaj/       zestawienie porównawcze (rdzeń produktu)
    placowki/       wyszukiwarka 10 417 placówek
    konto/          dane konta i zakres dostępu
    admin/          zarządzanie użytkownikami (tylko admin)
  login/            logowanie e-mail + hasło
  api/pdf/          generowanie PDF przez PDFShift
components/         komponenty widoku
lib/
  supabase/         klienci: przeglądarka, serwer, middleware
  compare/wiersze   model zestawienia porównawczego
supabase/migrations/ migracje bazy (0001–0006 zastosowane)
docs/BEZPIECZENSTWO.md  audyt i architektura zabezpieczeń
```

Pliki `index.html`, `index2.html` i `admin/index.html` to **poprzednia
wersja**. Nie działają od migracji 0002, która zamknęła odczyt danych bez
logowania. Zostają w repozytorium jako materiał źródłowy do czasu
przeniesienia pozostałych funkcji (biblioteka, kalkulator, deduplikator).

---

## Zasady bezpieczeństwa

Cztery reguły, których nie łamiemy:

1. **Aplikacja nigdy nie używa `service_role`.** Operacje administracyjne
   idą przez funkcje bazodanowe (`med_ustaw_dostep`), które same sprawdzają
   `med.is_admin()`. Klucz omijający RLS nie jest potrzebny nigdzie w kodzie.
2. **Sesja w ciasteczkach httpOnly**, nie w `localStorage` — nieosiągalna
   dla JavaScriptu, odporna na XSS.
3. **`getUser()`, nigdy `getSession()`** przy decyzjach o dostępie.
   `getSession()` czyta ciasteczko, którego treść może być podrobiona.
4. **Middleware to wygoda, nie zabezpieczenie.** Prawdziwą kontrolą jest RLS.
   Ominięcie middleware nie daje dostępu do żadnych danych.

Nowe konta powstają **nieaktywne** i nie widzą niczego, dopóki administrator
ich nie aktywuje w panelu `/admin`.
