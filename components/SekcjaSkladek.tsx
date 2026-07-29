"use client";

import type { NadpisaneSkladki, PakietZDostawca } from "@/lib/types";

/**
 * Składki dla konkretnego klienta.
 *
 * Kwoty są wynegocjowane osobno przy każdej ofercie, więc NIE trafiają do
 * katalogu — zapis nadpisywałby cenę wszystkim użytkownikom kwotą z jednej
 * sprawy. Żyją wyłącznie w obrębie tego porównania i trafiają do PDF.
 *
 * Katalog opisuje zakres pakietu; cena jest zawsze sprawą pojedynczej oferty.
 */
export function SekcjaSkladek({
  pakiety,
  skladki,
  onZmiana,
}: {
  pakiety: PakietZDostawca[];
  skladki: NadpisaneSkladki;
  onZmiana: (pakietId: number, cena: number | null) => void;
}) {
  const wypelnione = pakiety.filter((p) => wartosc(p, skladki) !== null).length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-brand-navy">
            Składki z ofert
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Kwoty dla tego klienta — wpisane tutaj trafią do zestawienia i PDF.
            Wypełnione: {wypelnione} z {pakiety.length}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
          Nie zapisujemy ich w katalogu
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pakiety.map((p) => {
          const senior = p.nazwa.toLowerCase().includes("senior");
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-4 ${
                senior
                  ? "border-amber-300 bg-amber-50/50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="text-sm font-bold text-brand-navy">
                {p.dostawca_nazwa}
              </div>
              <div className="mb-3 text-xs font-bold text-brand-pink">
                {p.nazwa}
              </div>

              <label
                htmlFor={`skladka-${p.id}`}
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Składka pracownicza (zł/mies)
              </label>
              <input
                id={`skladka-${p.id}`}
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={skladki[p.id] ?? ""}
                placeholder="0.00"
                onChange={(e) => {
                  const v = e.target.value;
                  onZmiana(p.id, v === "" ? null : Number(v));
                }}
                className="h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-lg font-bold outline-none transition focus:border-brand-navy"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Kwota użyta w zestawieniu i w PDF — wyłącznie to, co wpisał broker.
 *
 * Katalog nie zawiera cen (wszystkie 41 pakietów ma puste kolumny cenowe),
 * a nawet gdyby zawierał, byłyby to wartości z innej sprawy. Puste pole to
 * „brak wyceny", nie sygnał do sięgnięcia po cokolwiek innego.
 */
export function wartosc(
  p: PakietZDostawca,
  skladki: NadpisaneSkladki,
): number | null {
  const wpisana = skladki[p.id];
  if (wpisana === null || wpisana === undefined || Number.isNaN(wpisana)) {
    return null;
  }
  return wpisana;
}
