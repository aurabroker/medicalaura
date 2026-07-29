import type { PakietZDostawca } from "@/lib/types";

/**
 * Definicja wierszy zestawienia porównawczego.
 *
 * Model przeniesiony z index2.html i uporządkowany: zamiast funkcji
 * formatujących zwracających HTML, wiersz opisuje wyłącznie **czym jest**
 * dana wartość. O sposobie wyświetlenia decyduje komponent, dzięki czemu
 * ten sam model obsługuje ekran i wydruk PDF.
 */

export type TypWiersza = "tekst" | "liczba" | "tak_nie" | "cena";

export type Wiersz = {
  klucz: keyof PakietZDostawca;
  etykieta: string;
  typ: TypWiersza;
  /** true = niższa wartość jest korzystniejsza (dotyczy składki). */
  nizszaLepsza?: boolean;
  /** Wiersz pokazywany nawet wtedy, gdy wszystkie wartości są puste. */
  zawszeWidoczny?: boolean;
};

export type Sekcja = {
  tytul: string;
  wiersze: Wiersz[];
};

export const SEKCJE: Sekcja[] = [
  {
    tytul: "Identyfikacja",
    wiersze: [
      { klucz: "dostawca_nazwa", etykieta: "Sieć medyczna", typ: "tekst" },
      { klucz: "nazwa", etykieta: "Pakiet", typ: "tekst" },
      { klucz: "tier", etykieta: "Tier / poziom", typ: "tekst" },
    ],
  },
  {
    tytul: "Główne limity",
    wiersze: [
      { klucz: "liczba_specjalizacji", etykieta: "Specjalizacje", typ: "liczba" },
      { klucz: "liczba_badan_lab", etykieta: "Badania laboratoryjne", typ: "liczba" },
      { klucz: "liczba_rtg", etykieta: "RTG", typ: "liczba" },
      { klucz: "liczba_usg", etykieta: "USG", typ: "liczba" },
      { klucz: "liczba_tk", etykieta: "Tomografia (TK)", typ: "liczba" },
      { klucz: "liczba_mri", etykieta: "Rezonans (MRI)", typ: "liczba" },
    ],
  },
  {
    tytul: "Zakres świadczeń",
    wiersze: [
      { klucz: "telemedycyna", etykieta: "Telemedycyna", typ: "tak_nie" },
      { klucz: "ciaza", etykieta: "Prowadzenie ciąży", typ: "tak_nie" },
      { klucz: "rehabilitacja", etykieta: "Rehabilitacja", typ: "tak_nie" },
      { klucz: "wizyty_domowe", etykieta: "Wizyty domowe", typ: "tak_nie" },
      { klucz: "leczenie_szpitalne", etykieta: "Szpital 1-dniowy", typ: "tak_nie" },
      { klucz: "stomatologia", etykieta: "Stomatologia", typ: "tak_nie" },
      { klucz: "opieka_psychiatryczna", etykieta: "Psychiatria", typ: "tak_nie" },
      { klucz: "hotline_24h", etykieta: "Infolinia 24h", typ: "tak_nie" },
      { klucz: "refundacja", etykieta: "Refundacja", typ: "tak_nie" },
      { klucz: "swoboda_leczenia", etykieta: "Swoboda leczenia", typ: "tak_nie" },
    ],
  },
  {
    tytul: "Warunki przystąpienia",
    wiersze: [
      { klucz: "min_pracownicy", etykieta: "Min. liczba pracowników", typ: "liczba", nizszaLepsza: true },
      { klucz: "karencja_dni", etykieta: "Karencja (dni)", typ: "liczba", nizszaLepsza: true },
      { klucz: "wiek_max_przystapienia", etykieta: "Maks. wiek przystąpienia", typ: "liczba" },
      { klucz: "zasieg_placowek", etykieta: "Zasięg placówek", typ: "tekst" },
    ],
  },
  {
    tytul: "Składka",
    wiersze: [
      // Zawsze widoczny: to jedyne miejsce, gdzie pojawia się kwota z oferty
      // wpisana przez brokera. Ukrycie go przy pustych polach odcięłoby
      // dostęp do najważniejszej pozycji zestawienia.
      { klucz: "cena_grup_mies", etykieta: "Składka pracownicza", typ: "cena", nizszaLepsza: true, zawszeWidoczny: true },
      { klucz: "cena_ind_mies", etykieta: "Składka indywidualna", typ: "cena", nizszaLepsza: true },
      { klucz: "cena_rodzina_mies", etykieta: "Składka rodzinna", typ: "cena", nizszaLepsza: true },
    ],
  },
];

/** Wartość nadająca się do porównania liczbowego. */
function liczbowa(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Wskazuje indeks najlepszej i najgorszej wartości w wierszu.
 * Zwraca -1, gdy podświetlenie nie ma sensu — bo wartości jest mniej niż dwie
 * albo wszystkie są identyczne (wtedy żadna nie jest "lepsza").
 */
export function najlepszaNajgorsza(
  wiersz: Wiersz,
  wartosci: unknown[],
): { najlepszy: number; najgorszy: number } {
  const brak = { najlepszy: -1, najgorszy: -1 };
  if (wiersz.typ !== "liczba" && wiersz.typ !== "cena") return brak;

  const liczby = wartosci.map(liczbowa);
  const konkretne = liczby.filter((n): n is number => n !== null);
  if (konkretne.length < 2) return brak;

  const min = Math.min(...konkretne);
  const max = Math.max(...konkretne);
  if (min === max) return brak;

  const [lepsza, gorsza] = wiersz.nizszaLepsza ? [min, max] : [max, min];
  return {
    najlepszy: liczby.indexOf(lepsza),
    najgorszy: liczby.indexOf(gorsza),
  };
}

/**
 * Czy wiersz ma sens w zestawieniu.
 *
 * Katalog bywa niekompletny — np. żaden z 41 pakietów nie ma dziś wypełnionej
 * składki indywidualnej ani rodzinnej. Wiersz złożony z samych kresek nic nie
 * wnosi, a rozprasza przy dokumencie dla klienta. Wartość `false` w wierszu
 * typu tak/nie jest informacją, nie brakiem, więc nie ukrywa wiersza.
 */
export function czyPokazac(wiersz: Wiersz, wartosci: unknown[]): boolean {
  if (wiersz.zawszeWidoczny) return true;
  return wartosci.some((v) => v !== null && v !== undefined && v !== "");
}

/** Zamienia wartość na tekst gotowy do wyświetlenia. */
export function sformatuj(wiersz: Wiersz, wartosc: unknown): string {
  if (wartosc === null || wartosc === undefined || wartosc === "") return "–";

  switch (wiersz.typ) {
    case "tak_nie":
      return wartosc ? "TAK" : "NIE";
    case "cena": {
      const n = liczbowa(wartosc);
      return n === null ? "–" : `${n.toFixed(2)} zł`;
    }
    case "liczba": {
      const n = liczbowa(wartosc);
      return n === null ? "–" : n.toLocaleString("pl-PL");
    }
    default:
      return String(wartosc);
  }
}
