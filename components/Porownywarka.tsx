"use client";

import { useMemo, useState } from "react";
import type { Dostawca, NadpisaneSkladki, PakietZDostawca } from "@/lib/types";
import { TabelaPorownania } from "./TabelaPorownania";
import { SekcjaSkladek } from "./SekcjaSkladek";
import { PorownanieZakresu } from "./PorownanieZakresu";

export function Porownywarka({
  dostawcy,
  pakiety,
}: {
  dostawcy: Dostawca[];
  pakiety: PakietZDostawca[];
}) {
  const [dostawcaId, setDostawcaId] = useState<number | null>(null);
  const [zaznaczone, setZaznaczone] = useState<number[]>([]);
  const [skladki, setSkladki] = useState<NadpisaneSkladki>({});

  const licznikiPakietow = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of pakiety) m.set(p.dostawca_id, (m.get(p.dostawca_id) ?? 0) + 1);
    return m;
  }, [pakiety]);

  const zaznaczoneWgDostawcy = useMemo(() => {
    const m = new Map<number, number>();
    for (const id of zaznaczone) {
      const p = pakiety.find((x) => x.id === id);
      if (p) m.set(p.dostawca_id, (m.get(p.dostawca_id) ?? 0) + 1);
    }
    return m;
  }, [zaznaczone, pakiety]);

  const pakietyDostawcy = useMemo(
    () => pakiety.filter((p) => p.dostawca_id === dostawcaId),
    [pakiety, dostawcaId],
  );

  // Kolejność zestawienia idzie za kolejnością zaznaczania.
  const doPorownania = useMemo(
    () =>
      zaznaczone
        .map((id) => pakiety.find((p) => p.id === id))
        .filter((p): p is PakietZDostawca => Boolean(p)),
    [zaznaczone, pakiety],
  );

  function przelacz(id: number) {
    setZaznaczone((b) =>
      b.includes(id) ? b.filter((x) => x !== id) : [...b, id],
    );
  }

  function wyczysc() {
    setZaznaczone([]);
    setSkladki({});
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <span className="flex items-center gap-2 text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-emerald" />
          Baza: <strong className="text-slate-700">połączona</strong>
        </span>
        <span className="text-slate-500">
          Dostawcy: <strong className="text-slate-700">{dostawcy.length}</strong>
        </span>
        <span className="text-slate-500">
          Pakiety: <strong className="text-slate-700">{pakiety.length}</strong>
        </span>
      </div>

      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:flex-row">
        {/* Dostawcy */}
        <section className="flex w-full flex-col border-slate-200 bg-slate-50 md:w-1/2 md:border-r">
          <header className="border-b border-slate-200 bg-slate-100 p-5">
            <h2 className="text-base font-bold text-brand-navy">
              1. Wybierz dostawcę
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Sieć medyczna (partner)
            </p>
          </header>

          <div className="custom-scroll max-h-[380px] flex-grow overflow-y-auto p-4">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {dostawcy.map((d) => {
                const aktywny = d.id === dostawcaId;
                const ileZaznaczonych = zaznaczoneWgDostawcy.get(d.id) ?? 0;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setDostawcaId(d.id)}
                      aria-pressed={aktywny}
                      className={`relative w-full rounded-xl border p-3 text-left transition ${
                        aktywny
                          ? "border-brand-pink bg-rose-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-brand-navy hover:shadow-sm"
                      }`}
                    >
                      {ileZaznaczonych > 0 && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-pink text-[10px] font-black text-white">
                          {ileZaznaczonych}
                        </span>
                      )}
                      <span
                        className={`block pr-5 text-xs font-bold leading-tight ${
                          aktywny ? "text-brand-pink" : "text-brand-navy"
                        }`}
                      >
                        {d.nazwa}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {licznikiPakietow.get(d.id) ?? 0} pakietów
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Pakiety — chipy */}
        <section className="flex w-full flex-col md:w-1/2">
          <header className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-base font-bold text-brand-navy">
                2. Zaznacz pakiety
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {dostawcaId
                  ? `${pakietyDostawcy.length} dostępnych`
                  : "Wybierz dostawcę z lewej strony"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-brand-navy px-3 py-1.5 text-xs font-bold text-white">
                {zaznaczone.length} zaznaczonych
              </span>
              {zaznaczone.length > 0 && (
                <button
                  type="button"
                  onClick={wyczysc}
                  className="text-xs font-semibold text-brand-pink hover:underline"
                >
                  ✕ Wyczyść
                </button>
              )}
            </div>
          </header>

          <div className="custom-scroll max-h-[380px] flex-grow overflow-y-auto p-5">
            {!dostawcaId ? (
              <p className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-300">
                <span className="text-4xl text-slate-200">←</span>
                Oczekuję na wybór dostawcy
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pakietyDostawcy.map((p) => {
                  const wybrany = zaznaczone.includes(p.id);
                  const senior = p.nazwa.toLowerCase().includes("senior");
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => przelacz(p.id)}
                      aria-pressed={wybrany}
                      className={chipKlasa(wybrany, senior)}
                    >
                      <span className={kwadratKlasa(wybrany, senior)}>
                        {wybrany ? "✓" : ""}
                      </span>
                      <span className="font-bold">{p.nazwa}</span>
                      {p.tier !== null && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-black ${
                            wybrany
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          T{p.tier}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Pasek zaznaczonych */}
      {zaznaczone.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Do porównania:
          </span>
          {doPorownania.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-2 text-xs"
            >
              <span className="font-bold text-brand-navy">
                {p.dostawca_nazwa}
              </span>
              <span className="text-slate-500">{p.nazwa}</span>
              <button
                type="button"
                onClick={() => przelacz(p.id)}
                aria-label={`Usuń ${p.nazwa} z porównania`}
                className="rounded px-1 font-bold text-slate-400 transition hover:bg-red-50 hover:text-brand-pink"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {doPorownania.length < 2 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
          Zaznacz minimum 2 pakiety, aby zobaczyć zestawienie. Możesz łączyć
          pakiety różnych dostawców — przełączanie nie kasuje zaznaczeń.
        </p>
      ) : (
        <>
          <TabelaPorownania pakiety={doPorownania} skladki={skladki} />
          <PorownanieZakresu pakiety={doPorownania} />
          <SekcjaSkladek
            pakiety={doPorownania}
            skladki={skladki}
            onZmiana={(id, cena) =>
              setSkladki((s) => ({ ...s, [id]: cena }))
            }
          />
        </>
      )}
    </div>
  );
}

/** Odpowiednik .pkg-chip z index2.html, z wariantem senior. */
function chipKlasa(wybrany: boolean, senior: boolean): string {
  const bazowa =
    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition select-none";
  if (wybrany) {
    return senior
      ? `${bazowa} border-brand-senior bg-brand-senior text-white shadow-sm`
      : `${bazowa} border-brand-navy bg-brand-navy text-white shadow-sm`;
  }
  return senior
    ? `${bazowa} border-amber-200 bg-amber-50 text-slate-700 hover:border-brand-senior`
    : `${bazowa} border-slate-200 bg-white text-slate-700 hover:border-brand-navy hover:shadow-sm`;
}

/** Odpowiednik .chk — kwadracik zaznaczenia wewnątrz chipa. */
function kwadratKlasa(wybrany: boolean, senior: boolean): string {
  const bazowa =
    "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 text-[10px] font-black";
  if (!wybrany) return `${bazowa} border-slate-300`;
  return senior
    ? `${bazowa} border-white bg-white text-brand-senior`
    : `${bazowa} border-white bg-white text-brand-navy`;
}
