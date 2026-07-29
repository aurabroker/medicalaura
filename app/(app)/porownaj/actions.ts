"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Pozycja zakresu w zestawieniu: jedna nazwa świadczenia i informacja,
 * które z porównywanych pakietów ją obejmują.
 *
 * `wPakiecie[id]` zawiera treść limitu, gdy jest znana, albo pusty ciąg,
 * gdy świadczenie jest w pakiecie bez sprecyzowanego limitu. Brak klucza
 * oznacza, że pakiet tego świadczenia nie obejmuje.
 */
export type PozycjaZakresu = {
  nazwa: string;
  wPakiecie: Record<number, string>;
};

export type Zakres = {
  specjalizacje: PozycjaZakresu[];
  badania: PozycjaZakresu[];
  dodatkowe: PozycjaZakresu[];
  blad?: string;
};

const schemat = z.array(z.number().int().positive()).min(2).max(8);

type WierszNazwany = {
  pakiet_id: number;
  nazwa: string | null;
  limit_info: string | null;
};

/**
 * Zestawia zakresy wybranych pakietów.
 *
 * Grupujemy po nazwie zapisanej małymi literami, bo ten sam zabieg bywa
 * wpisany różnie w różnych sieciach. Do wyświetlenia zachowujemy pierwszy
 * napotkany zapis oryginalny.
 */
export async function pobierzZakres(idPakietow: number[]): Promise<Zakres> {
  const pusty: Zakres = { specjalizacje: [], badania: [], dodatkowe: [] };

  const wejscie = schemat.safeParse(idPakietow);
  if (!wejscie.success) return { ...pusty, blad: "Wybierz od 2 do 8 pakietów." };

  const supabase = await createClient();
  const ids = wejscie.data;

  const [spec, bad, dod] = await Promise.all([
    supabase
      .from("pakiety_specjalizacje")
      .select("pakiet_id, specjalizacja_nazwa, limit_info")
      .in("pakiet_id", ids),
    supabase
      .from("pakiety_badania")
      .select("pakiet_id, badanie_nazwa, limit_info")
      .in("pakiet_id", ids),
    supabase
      .from("pakiety_zakresy_dodatkowe")
      .select("pakiet_id, nazwa, limit_info")
      .in("pakiet_id", ids),
  ]);

  const blad = spec.error ?? bad.error ?? dod.error;
  if (blad) return { ...pusty, blad: blad.message };

  const jako = (
    wiersze: Record<string, unknown>[] | null,
    poleNazwy: string,
  ): WierszNazwany[] =>
    (wiersze ?? []).map((w) => ({
      pakiet_id: Number(w.pakiet_id),
      nazwa: (w[poleNazwy] as string | null) ?? null,
      limit_info: (w.limit_info as string | null) ?? null,
    }));

  return {
    specjalizacje: zgrupuj(jako(spec.data, "specjalizacja_nazwa")),
    badania: zgrupuj(jako(bad.data, "badanie_nazwa")),
    dodatkowe: zgrupuj(jako(dod.data, "nazwa")),
  };
}

function zgrupuj(wiersze: WierszNazwany[]): PozycjaZakresu[] {
  const wg = new Map<string, PozycjaZakresu>();

  for (const w of wiersze) {
    const surowa = (w.nazwa ?? "").trim();
    if (!surowa) continue;

    const klucz = surowa.toLowerCase();
    let poz = wg.get(klucz);
    if (!poz) {
      poz = { nazwa: surowa, wPakiecie: {} };
      wg.set(klucz, poz);
    }

    // Limit bywa uzupełniony tylko w części wierszy — zachowujemy pierwszy
    // niepusty, żeby nie nadpisać go późniejszym pustym.
    const limit = (w.limit_info ?? "").trim();
    if (!(w.pakiet_id in poz.wPakiecie) || (limit && !poz.wPakiecie[w.pakiet_id])) {
      poz.wPakiecie[w.pakiet_id] = limit;
    }
  }

  return [...wg.values()].sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl"));
}
