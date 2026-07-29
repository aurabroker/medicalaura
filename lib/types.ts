/**
 * Typy odwzorowujące schemat bazy MEDICALAURA.
 *
 * Celowo napisane ręcznie i wąsko, zamiast generowane przez
 * `supabase gen types`: baza zawiera ~130 tabel należących do kilku
 * odrębnych projektów (CRM, PISKP, ads), a interesuje nas ich ułamek.
 */

export type Dostawca = {
  id: number;
  nazwa: string;
  typ: string | null;
  skrot: string | null;
  aktywny: boolean | null;
  www: string | null;
};

export type Pakiet = {
  id: number;
  dostawca_id: number;
  nazwa: string;
  tier: number | null;
  wersja: string | null;
  aktywna: boolean | null;

  // składki
  cena_ind_mies: number | null;
  cena_grup_mies: number | null;
  cena_rodzina_mies: number | null;

  // limity ilościowe
  liczba_specjalizacji: number | null;
  liczba_badan_lab: number | null;
  liczba_rtg: number | null;
  liczba_tk: number | null;
  liczba_mri: number | null;
  liczba_usg: number | null;
  liczba_ekg: number | null;
  liczba_echo: number | null;

  // zakres świadczeń
  telemedycyna: boolean | null;
  ciaza: boolean | null;
  rehabilitacja: boolean | null;
  wizyty_domowe: boolean | null;
  leczenie_szpitalne: boolean | null;
  stomatologia: boolean | null;
  opieka_psychiatryczna: boolean | null;
  hotline_24h: boolean | null;
  refundacja: boolean | null;
  swoboda_leczenia: boolean | null;
  aplikacja_mobilna: boolean | null;
  jdg: boolean | null;

  // warunki przystąpienia
  min_pracownicy: number | null;
  min_ubezpieczonych: number | null;
  wiek_max_przystapienia: number | null;
  karencja_dni: number | null;
  czas_oczekiwania_poz: number | null;
  czas_oczekiwania_spec: number | null;
  zasieg_placowek: string | null;
};

/** Pakiet wzbogacony o nazwę dostawcy — kształt używany w porównaniu. */
export type PakietZDostawca = Pakiet & {
  dostawca_nazwa: string;
};

export type CzlonekMed = {
  user_id: string;
  rola: "admin" | "broker" | "viewer";
  aktywny: boolean;
  plan: "trial" | "pro" | "enterprise";
  plan_do: string | null;
  firma: string | null;
};

/** Składki wpisane ręcznie przez brokera, poza bazą (per pakiet). */
export type NadpisaneSkladki = Record<number, number | null>;
