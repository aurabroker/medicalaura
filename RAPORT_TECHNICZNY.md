# RAPORT TECHNICZNY — MEDICALAURA
**Data raportu:** 7 czerwca 2026  
**Wersja aplikacji:** 1.4.0 PRO (index2.html) / 1.0.10 Basic (index.html)  
**Repozytorium:** aurabroker/medicalaura  
**Przygotowany przez:** Claude Code (analiza automatyczna)

---

## 1. STRESZCZENIE WYKONAWCZE

MEDICALAURA to polska platforma B2B/B2C do porównywania i zarządzania pakietami ubezpieczeń zdrowotnych. Aplikacja umożliwia brokerom ubezpieczeniowym i pracodawcom zestawianie ofert różnych dostawców medycznych, wyszukiwanie placówek oraz generowanie raportów cenowych.

Projekt jest w aktywnym rozwoju — repozytorium liczy 50 commitów wykonanych w ciągu 7 dni (8–15 marca 2026). Cała aplikacja działa po stronie klienta (client-side), bez własnego serwera backendowego, z bazą danych w chmurze Supabase.

---

## 2. ARCHITEKTURA SYSTEMU

### 2.1 Diagram komponentów

```
┌─────────────────────────────────────────────────────────┐
│                     PRZEGLĄDARKA UŻYTKOWNIKA            │
│                                                         │
│  ┌─────────────┐  ┌─────────────────┐  ┌────────────┐  │
│  │  index.html │  │  index2.html    │  │admin/      │  │
│  │  V 1.0.10   │  │  V 1.4.0 PRO   │  │index.html  │  │
│  │  Basic      │  │  (główna wersja)│  │(panel adm.)│  │
│  └─────────────┘  └─────────────────┘  └────────────┘  │
│         │                  │                  │         │
│         └──────────────────┼──────────────────┘         │
│                            │                            │
└────────────────────────────┼────────────────────────────┘
                             │ HTTPS / REST API
                 ┌───────────▼──────────────┐
                 │    SUPABASE (BaaS)        │
                 │  ┌─────────────────────┐ │
                 │  │   PostgreSQL DB      │ │
                 │  │   (PostgREST API)    │ │
                 │  ├─────────────────────┤ │
                 │  │   Supabase Auth      │ │
                 │  │   (email/magic link) │ │
                 │  ├─────────────────────┤ │
                 │  │   Supabase Storage   │ │
                 │  │   (bucket: logos)    │ │
                 │  └─────────────────────┘ │
                 └──────────────────────────┘
```

### 2.2 Model wdrożenia

- **Frontend:** statyczne pliki HTML (bez procesu budowania, bez frameworka)
- **Backend:** Supabase (projekt ID: `kukvgsjrmrqtzhkszzum`)
- **CDN:** Tailwind CSS i Supabase JS ładowane z publicznych CDN
- **Czcionki:** Google Fonts (Inter)

---

## 3. STOS TECHNOLOGICZNY

| Warstwa | Technologia | Wersja/Źródło |
|---------|------------|---------------|
| Markup | HTML5 | — |
| Style | Tailwind CSS | CDN (`cdn.tailwindcss.com`) |
| Logika | Vanilla JavaScript (ES6+) | wbudowany w HTML |
| Czcionki | Inter (Google Fonts) | CDN |
| BaaS / DB | Supabase | `@supabase/supabase-js@2` (CDN) |
| Baza danych | PostgreSQL (przez Supabase) | hostowany w chmurze |
| Autentykacja | Supabase Auth | email + magic link |
| Storage | Supabase Storage | bucket `logos` |

**Brak:**
- procesu budowania (Webpack, Vite, Parcel)
- frameworka frontendowego (React, Vue, Angular)
- testów automatycznych
- zależności zarządzanych przez npm/yarn
- pliku `.env` lub konfiguracji środowiskowej

---

## 4. STRUKTURA PLIKÓW

```
medicalaura/
├── index.html           (1 433 linie)  — wersja Basic V1.0.10
├── index2.html          (1 997 linii)  — wersja PRO V1.4.0 (aktywna)
├── admin/
│   └── index.html       (  454 linie)  — panel administracyjny DB
└── README.md            (minimalny)
```

Wszystkie trzy pliki to monolityczne dokumenty HTML zawierające jednocześnie markup, CSS (inline + Tailwind) i JavaScript. Łącznie: **3 884 linie kodu**.

---

## 5. SCHEMAT BAZY DANYCH

### 5.1 Tabele główne

| Tabela | Rola | Kluczowe pola |
|--------|------|---------------|
| `dostawcy` | Dostawcy ubezpieczeń zdrowotnych | `id`, `nazwa`, `skrot`, `aktywny` |
| `pakiety` | Pakiety/plany ubezpieczeń | `id`, `nazwa`, `dostawca_id`, `tier`, `aktywna`, `cena_grup_mies`, `liczba_specjalizacji`, `liczba_badan_lab` |
| `pakiety_specjalizacje` | Specjalizacje przypisane do pakietów | `pakiet_id`, `specjalizacja_nazwa` |
| `pakiety_badania` | Badania lekarskie w pakietach | `pakiet_id`, `badanie_nazwa` |
| `pakiety_pelne` | Zmaterializowany widok pełnych danych pakietu | (agregacja) |
| `placowki_medyczne` | Baza placówek/przychodni | `id`, `miejscowosc`, `adres`, `nazwa_oddzialu`, `siec_bazowa`, `dostawcy_tagi`, `powiat` |
| `profiles` | Profile zalogowanych użytkowników | `id`, `rola`, `full_name`, `firma`, `telefon`, `nip`, `logo_url`, `plan`, `plan_do` |
| `historia_wyszukiwan` | Dziennik wyszukiwań użytkowników | `user_id`, `typ`, `parametry`, `wynik_count`, `created_at` |
| `v_admin_users` | Widok administracyjny użytkowników | (widok PostgreSQL) |

### 5.2 Relacje

```
dostawcy (1) ─────── (N) pakiety
pakiety  (1) ─────── (N) pakiety_specjalizacje
pakiety  (1) ─────── (N) pakiety_badania
profiles (1) ─────── (N) historia_wyszukiwan
profiles (1) ─────── (1) Supabase Auth user
```

### 5.3 Storage

- Bucket `logos` — loga firm użytkowników (do eksportu PDF)

---

## 6. FUNKCJONALNOŚCI APLIKACJI

### 6.1 Wersja Basic (index.html — V1.0.10)

| Zakładka | Opis |
|----------|------|
| 🔍 Porównaj | Wybór dostawców i pakietów, generowanie tabeli porównawczej, eksport PDF/CSV |
| 🔎 Wyszukaj Pakiety | Wyszukiwanie pakietów po specjalizacji lub badaniu z autouzupełnianiem |
| 🏥 Baza Placówek | Wyszukiwanie placówek wg miasta, powiatu lub sieci dostawcy |
| 📚 Biblioteka | Przeglądanie i edycja pakietów (liczba specjalizacji, badań, ceny, funkcje dodatkowe) |
| 🧮 Kalkulator | Kalkulacja składki grupowej dla wybranej liczby pracowników |
| 🔒 Admin | Ręczna konfiguracja połączenia z Supabase (URL + klucz API) |

### 6.2 Wersja PRO (index2.html — V1.4.0)

Zawiera wszystkie funkcje wersji Basic plus:

| Zakładka | Opis |
|----------|------|
| 🤖 Smart Konsultant | Inteligentne wyszukiwanie po objawach/potrzebach medycznych z kategoryzacją AI |
| 👤 Moje Konto | Profil użytkownika, logo firmy, śledzenie historii wyszukiwań, plan subskrypcji |
| Zaawansowany Admin | Zarządzanie użytkownikami, wykrywanie i scalanie duplikatów placówek |

### 6.3 Panel Administracyjny (admin/index.html)

Surowy edytor bazy danych Supabase — CRUD bezpośrednio na tabelach, widok logów, zarządzanie strukturą.

---

## 7. KLUCZOWE ALGORYTMY I LOGIKA BIZNESOWA

### 7.1 Silnik porównywania pakietów

- Deduplikacja nazw dostawców (np. `"TU ZDROWIE!!!"` → `"TU ZDROWIE"`)
- Zliczanie specjalizacji i badań per pakiet
- Klasyfikacja badań obrazowych przez wyrażenia regularne:
  - `RTG|RENTGEN` → licznik RTG
  - `TOMOGRAF|TOMOGRAFIA|TK` → licznik CT
  - `MR|MRI|REZONANS` → licznik MRI

### 7.2 Smart Konsultant Medyczny

- Separacja specjalizacji dorosłych vs. pediatrycznych
- Grupowanie badań wg typu (USG, EKG, RTG, etc.)
- Kategoryzacja usług: telemedycyna, szczepienia, rehabilitacja, stomatologia, psychiatria, opieka nad kobietą w ciąży

### 7.3 Deduplicator placówek (PRO Admin)

- Wyszukiwanie placówek z identycznym adresem w tym samym mieście
- Scalanie rekordów z zachowaniem tagów i powiązań dostawców
- Operacje Delete/Merge na bazie danych

### 7.4 Generowanie PDF

- Generowanie po stronie klienta przez `window.open()` z nowym oknem HTML
- Osadzanie logo firmy (jeśli wgrane)
- Tabele cenowe i porównawcze w formacie drukowania

---

## 8. BEZPIECZEŃSTWO

### 8.1 Potencjalne problemy

| # | Problem | Lokalizacja | Poziom ryzyka |
|---|---------|-------------|---------------|
| 1 | **Klucz API Supabase widoczny w kodzie** | `index2.html`, `admin/index.html` | Niski (klucz `anon` jest publiczny z założenia) |
| 2 | **PIN admina zakodowany w HTML** (`aura2026`) | `index.html` | Średni — każdy kto widzi kod, zna PIN |
| 3 | **Brak sanitizacji danych wejściowych** po stronie JS | Wszystkie pliki | Niski (PostgREST parametryzuje zapytania) |
| 4 | **Rola admina sprawdzana client-side** | `index2.html` | Średni — logika ról powinna być w Row Level Security |
| 5 | **Brak Content Security Policy (CSP)** | wszystkie pliki | Niski-Średni (zagrożenie XSS) |
| 6 | **Zależności z CDN bez integrity hash** | wszystkie pliki | Niski (podatność na supply chain attack) |

### 8.2 Mocne strony

- Cała logika po stronie klienta ogranicza powierzchnię ataku na serwer
- Supabase Auth zapewnia bezpieczną autentykację (email + magic link)
- Klucz `anon` Supabase daje dostęp tylko do danych publicznych (jeśli RLS jest skonfigurowane poprawnie)
- Pliki logotypów przechowywane w izolowanym buckecie Storage

### 8.3 Rekomendacje bezpieczeństwa

1. Zastąpić PIN admina (`aura2026`) autentykacją przez Supabase Auth z rolą `admin`
2. Zdefiniować Row Level Security (RLS) w Supabase dla wszystkich tabel
3. Dodać `integrity` hash do tagów `<script>` ładowanych z CDN
4. Dodać nagłówek CSP na poziomie serwera hostingowego

---

## 9. JAKOŚĆ KODU

### 9.1 Metryki

| Metryka | Wartość |
|---------|---------|
| Łączna liczba linii kodu | 3 884 |
| Liczba plików | 3 główne |
| Liczba commitów | 50 |
| Okres rozwoju | 7 dni (8–15 marca 2026) |
| Testy automatyczne | Brak |
| Dokumentacja | Minimalna (README.md) |
| Process budowania | Brak |

### 9.2 Wzorce stosowane w kodzie

- `async/await` dla wywołań API
- Event delegation dla dynamicznie tworzonych elementów
- `Set` do deduplikacji danych
- `localStorage` dla trwałości po stronie klienta
- Wyrażenia regularne do klasyfikacji tekstów medycznych
- Inline CSS + Tailwind utility classes

### 9.3 Obszary wymagające refaktoryzacji

1. **Monolityczna architektura** — 2 000 linii w jednym pliku HTML utrudnia utrzymanie; wskazany podział na moduły JS
2. **Duplikacja kodu** między `index.html` a `index2.html` — wspólne funkcje powinny być w osobnym pliku
3. **Brak obsługi błędów sieciowych** — niepowodzenie fetch nie zawsze jest komunikowane użytkownikowi
4. **Brak typowania** — TypeScript lub JSDoc poprawiłyby bezpieczeństwo typów
5. **Brak testów** — krytyczne algorytmy (porównywanie, klasyfikacja) bez pokrycia testowego

---

## 10. WYDAJNOŚĆ

### 10.1 Ładowanie aplikacji

- Tailwind CSS ładowany z CDN (~300 KB) — zalecane build z purge CSS w produkcji
- Supabase JS ładowany z CDN (~200 KB)
- Google Fonts — dodatkowy request sieciowy przy każdym ładowaniu
- Brak kompresji (gzip/brotli) na poziomie hostingu (zależy od hosta)

### 10.2 Zapytania do bazy danych

- Zapytania wykonywane przy każdym otwarciu zakładki (brak cache)
- Brak paginacji przy pobieraniu placówek medycznych (ryzyko przy dużych zbiorach)
- `pakiety_pelne` jako widok materializowany — dobra praktyka dla ciężkich agregacji

---

## 11. REKOMENDACJE ROZWOJOWE

### Priorytet wysoki

| # | Rekomendacja | Uzasadnienie |
|---|-------------|--------------|
| 1 | Wdrożyć Row Level Security w Supabase | Kluczowe dla bezpieczeństwa danych użytkowników |
| 2 | Zastąpić PIN admina rolą w Supabase Auth | Eliminacja zakodowanego hasła w kodzie źródłowym |
| 3 | Dodać obsługę błędów API z komunikatami dla użytkownika | Poprawa UX przy problemach sieciowych |

### Priorytet średni

| # | Rekomendacja | Uzasadnienie |
|---|-------------|--------------|
| 4 | Wydzielić wspólny JS do osobnego pliku `app.js` | Eliminacja duplikacji kodu |
| 5 | Dodać paginację do bazy placówek | Wydajność przy rosnącej bazie danych |
| 6 | Skonfigurować proces budowania (Vite/Parcel) | Umożliwi bundle, minifikację, tree-shaking |
| 7 | Dodać `integrity` hash dla zasobów CDN | Zabezpieczenie przed supply chain attacks |

### Priorytet niski

| # | Rekomendacja | Uzasadnienie |
|---|-------------|--------------|
| 8 | Pisać testy jednostkowe dla algorytmów klasyfikacji | Zapewnienie poprawności reguł medycznych |
| 9 | Rozbudować README.md o dokumentację wdrożenia | Ułatwienie onboardingu nowych deweloperów |
| 10 | Skonfigurować CI/CD (GitHub Actions) | Automatyzacja wdrożeń |

---

## 12. PODSUMOWANIE

MEDICALAURA jest funkcjonalną i dobrze zaprojektowaną wizualnie aplikacją B2B, która skutecznie realizuje swój cel biznesowy — porównywanie pakietów medycznych. Wybór Supabase jako backendu to trafna decyzja architektoniczna, która pozwoliła na szybki development bez potrzeby budowania własnego API.

Główne obszary do poprawy to: **bezpieczeństwo** (Row Level Security, PIN admina), **skalowalność kodu** (rozbicie monolitu) oraz **brak testów automatycznych**.

Aplikacja jest gotowa do użytku produkcyjnego w obecnej formie, jednak przed skalowaniem bazy użytkowników zalecane jest wdrożenie powyższych rekomendacji bezpieczeństwa.

---

*Raport wygenerowany automatycznie na podstawie analizy kodu źródłowego repozytorium `aurabroker/medicalaura`.*
