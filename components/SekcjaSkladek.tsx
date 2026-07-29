"use client";

import { useState, useTransition } from "react";
import type { NadpisaneSkladki, PakietZDostawca } from "@/lib/types";
import { zapiszSkladki } from "@/app/(app)/porownaj/actions";

/**
 * Wpisywanie składek z otrzymanych ofert.
 *
 * Wartość z katalogu jest tylko punktem wyjścia — broker wpisuje kwotę
 * wynegocjowaną dla konkretnego klienta, a zestawienie i PDF liczą z tego,
 * co wpisał. Odtworzone z priceSection w index2.html.
 */
export function SekcjaSkladek({
  pakiety,
  skladki,
  onZmiana,
  jestAdmin,
}: {
  pakiety: PakietZDostawca[];
  skladki: NadpisaneSkladki;
  onZmiana: (pakietId: number, cena: number | null) => void;
  jestAdmin: boolean;
}) {
  const [oczekuje, startTransition] = useTransition();
  const [komunikat, setKomunikat] = useState<{
    tekst: string;
    ok: boolean;
  } | null>(null);

  const wypelnione = pakiety.filter(
    (p) => wartosc(p, skladki) !== null,
  ).length;

  function zapisz() {
    setKomunikat(null);
    const doZapisu = pakiety
      .map((p) => ({ pakietId: p.id, cena: wartosc(p, skladki) }))
      .filter((x): x is { pakietId: number; cena: number } => x.cena !== null);

    if (!doZapisu.length) return;

    startTransition(async () => {
      const wynik = await zapiszSkladki({ skladki: doZapisu });
      setKomunikat(
        wynik.blad
          ? { tekst: wynik.blad, ok: false }
          : { tekst: `✓ Zapisano składki: ${wynik.zapisano}`, ok: true },
      );
    });
  }

  return (
    <section className="rounded-3xl border-2 border-brand-navy bg-white p-6 shadow-lg">
      <header className="mb-5">
        <h2 className="text-base font-bold text-brand-navy">
          Składki z ofert
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Wpisz kwoty z otrzymanych ofert — zestawienie i PDF policzą z nich.
          Wypełnione: {wypelnione} z {pakiety.length}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pakiety.map((p) => {
          const senior = p.nazwa.toLowerCase().includes("senior");
          const biezaca = skladki[p.id];
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
                value={biezaca ?? ""}
                placeholder={
                  p.cena_grup_mies !== null
                    ? `katalog: ${Number(p.cena_grup_mies).toFixed(2)}`
                    : "0.00"
                }
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

      {jestAdmin && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={zapisz}
            disabled={oczekuje || wypelnione === 0}
            className="rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {oczekuje ? "Zapisywanie…" : "Zapisz składki w katalogu"}
          </button>
          <span className="text-xs text-slate-400">
            Nadpisze ceny katalogowe dla wszystkich użytkowników.
          </span>
        </div>
      )}

      {komunikat && (
        <p
          role="status"
          className={`mt-4 rounded-xl border p-3 text-sm font-semibold ${
            komunikat.ok
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-red-400 bg-red-50 text-red-700"
          }`}
        >
          {komunikat.tekst}
        </p>
      )}
    </section>
  );
}

/**
 * Kwota użyta w zestawieniu i w PDF.
 *
 * Pole składki jest zasiewane ceną katalogową przy dodaniu pakietu, więc od
 * tego momentu decyduje wyłącznie zawartość pola. Puste pole to świadome
 * „brak wyceny", a nie sygnał do sięgnięcia po cenę z katalogu — inaczej PDF
 * dla klienta mógłby przedstawić cenę katalogową jako złożoną ofertę.
 */
export function wartosc(
  p: PakietZDostawca,
  skladki: NadpisaneSkladki,
): number | null {
  if (p.id in skladki) {
    const wpisana = skladki[p.id];
    return wpisana === null || Number.isNaN(wpisana) ? null : wpisana;
  }
  return p.cena_grup_mies === null ? null : Number(p.cena_grup_mies);
}
