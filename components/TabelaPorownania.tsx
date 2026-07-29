"use client";

import { useState } from "react";
import type { NadpisaneSkladki, PakietZDostawca } from "@/lib/types";
import {
  SEKCJE,
  czyPokazac,
  najlepszaNajgorsza,
  sformatuj,
} from "@/lib/compare/wiersze";
import { wartosc } from "./SekcjaSkladek";

export function TabelaPorownania({
  pakiety,
  skladki,
}: {
  pakiety: PakietZDostawca[];
  skladki: NadpisaneSkladki;
}) {
  const [generujePdf, setGenerujePdf] = useState(false);
  const [bladPdf, setBladPdf] = useState<string | null>(null);

  async function pobierzPdf() {
    setGenerujePdf(true);
    setBladPdf(null);
    try {
      const odp = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Wysyłamy wpisane składki — PDF ma pokazać kwoty z ofert,
        // a nie ceny katalogowe. Reszta danych pobierana jest w bazie.
        body: JSON.stringify({
          idPakietow: pakiety.map((p) => p.id),
          skladki: pakiety
            .map((p) => ({ pakietId: p.id, cena: wartosc(p, skladki) }))
            .filter((x): x is { pakietId: number; cena: number } =>
              x.cena !== null,
            ),
        }),
      });

      if (!odp.ok) {
        const tresc = await odp.json().catch(() => ({}));
        throw new Error(tresc.blad ?? `Błąd ${odp.status}`);
      }

      const blob = await odp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medicalaura-zestawienie-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBladPdf(e instanceof Error ? e.message : "Nie udało się wygenerować PDF.");
    } finally {
      setGenerujePdf(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h2 className="text-base font-bold text-brand-navy">
            Zestawienie porównawcze
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {pakiety.length} pakiety · zielony = najkorzystniejszy, czerwony =
            najmniej korzystny
          </p>
        </div>

        <div className="flex items-center gap-3">
          {bladPdf && (
            <span className="text-xs font-semibold text-red-600">{bladPdf}</span>
          )}
          <button
            type="button"
            onClick={pobierzPdf}
            disabled={generujePdf}
            className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generujePdf ? "Generowanie…" : "📄 Pobierz PDF"}
          </button>
        </div>
      </header>

      <div className="custom-scroll overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[200px] bg-brand-navy px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-white"
              >
                Parametr
              </th>
              {pakiety.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className="min-w-[150px] bg-brand-navy px-4 py-3 text-center text-[11px] font-bold text-white"
                >
                  <span className="block uppercase tracking-wider">
                    {p.dostawca_nazwa}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-normal opacity-80">
                    {p.nazwa}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {SEKCJE.map((sekcja) => (
              <FragmentSekcji
                key={sekcja.tytul}
                sekcja={sekcja}
                pakiety={pakiety}
                skladki={skladki}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentSekcji({
  sekcja,
  pakiety,
  skladki,
}: {
  sekcja: (typeof SEKCJE)[number];
  pakiety: PakietZDostawca[];
  skladki: NadpisaneSkladki;
}) {
  // Składka pracownicza to kwota z oferty wpisana przez brokera;
  // katalogowa wartość służy tylko jako zapasowa.
  const widoczne = sekcja.wiersze
    .map((wiersz) => ({
      wiersz,
      wartosci: pakiety.map((p) =>
        wiersz.klucz === "cena_grup_mies"
          ? wartosc(p, skladki)
          : p[wiersz.klucz],
      ),
    }))
    .filter(({ wiersz, wartosci }) => czyPokazac(wiersz, wartosci));

  // Nagłówek sekcji bez wierszy byłby pustą etykietą.
  if (!widoczne.length) return null;

  return (
    <>
      <tr>
        <th
          scope="colgroup"
          colSpan={pakiety.length + 1}
          className="bg-slate-100 px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-brand-navy"
        >
          {sekcja.tytul}
        </th>
      </tr>

      {widoczne.map(({ wiersz, wartosci }) => {
        const { najlepszy, najgorszy } = najlepszaNajgorsza(wiersz, wartosci);

        return (
          <tr key={String(wiersz.klucz)} className="even:bg-slate-50/60">
            <th
              scope="row"
              className="sticky left-0 z-10 bg-inherit px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              {wiersz.etykieta}
            </th>

            {wartosci.map((wartosc, i) => {
              const tekst = sformatuj(wiersz, wartosc);
              const klasa =
                i === najlepszy
                  ? "diff-best"
                  : i === najgorszy
                    ? "diff-worst"
                    : wiersz.typ === "tak_nie"
                      ? wartosc
                        ? "text-brand-emerald font-bold"
                        : "text-slate-300"
                      : "text-slate-700";

              return (
                <td
                  key={`${String(wiersz.klucz)}-${i}`}
                  className={`px-4 py-2.5 text-center ${klasa}`}
                >
                  {wiersz.typ === "tak_nie" ? (wartosc ? "✓" : "—") : tekst}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
