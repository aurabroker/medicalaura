"use client";

import { useMemo, useState } from "react";
import type { Dostawca, PakietZDostawca } from "@/lib/types";
import { TabelaPorownania } from "./TabelaPorownania";

export function Porownywarka({
  dostawcy,
  pakiety,
}: {
  dostawcy: Dostawca[];
  pakiety: PakietZDostawca[];
}) {
  const [dostawcaId, setDostawcaId] = useState<number | null>(null);
  const [zaznaczone, setZaznaczone] = useState<number[]>([]);

  const licznikiPakietow = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of pakiety) m.set(p.dostawca_id, (m.get(p.dostawca_id) ?? 0) + 1);
    return m;
  }, [pakiety]);

  const pakietyDostawcy = useMemo(
    () => pakiety.filter((p) => p.dostawca_id === dostawcaId),
    [pakiety, dostawcaId],
  );

  // Kolejność zestawienia idzie za kolejnością zaznaczania — broker sam
  // decyduje, co porównuje jako pierwsze.
  const doPorownania = useMemo(
    () =>
      zaznaczone
        .map((id) => pakiety.find((p) => p.id === id))
        .filter((p): p is PakietZDostawca => Boolean(p)),
    [zaznaczone, pakiety],
  );

  function przelacz(id: number) {
    setZaznaczone((biezace) =>
      biezace.includes(id) ? biezace.filter((x) => x !== id) : [...biezace, id],
    );
  }

  return (
    <div className="space-y-5">
      {/* Pasek stanu */}
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

      {/* Wybór: dostawca → pakiety */}
      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:flex-row">
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
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setDostawcaId(d.id)}
                      aria-pressed={aktywny}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        aktywny
                          ? "border-brand-pink bg-rose-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-brand-navy"
                      }`}
                    >
                      <span
                        className={`block text-xs font-bold leading-tight ${
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
                  onClick={() => setZaznaczone([])}
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
              <ul className="space-y-2">
                {pakietyDostawcy.map((p) => {
                  const wybrany = zaznaczone.includes(p.id);
                  const senior = p.nazwa.toLowerCase().includes("senior");
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                          wybrany
                            ? senior
                              ? "border-brand-senior bg-amber-50"
                              : "border-brand-navy bg-slate-50"
                            : "border-slate-200 hover:border-brand-navy"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={wybrany}
                          onChange={() => przelacz(p.id)}
                          className="h-4 w-4 accent-brand-navy"
                        />
                        <span className="flex-grow text-sm font-bold text-slate-700">
                          {p.nazwa}
                        </span>
                        {p.tier !== null && (
                          <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">
                            T{p.tier}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Zestawienie */}
      {doPorownania.length < 2 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
          Zaznacz minimum 2 pakiety, aby zobaczyć zestawienie. Możesz wybierać
          pakiety różnych dostawców — przełączaj się między nimi, zaznaczenia
          nie znikają.
        </p>
      ) : (
        <TabelaPorownania pakiety={doPorownania} />
      )}
    </div>
  );
}
