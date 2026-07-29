"use client";

import { useEffect, useMemo, useState } from "react";
import type { PakietZDostawca } from "@/lib/types";
import {
  pobierzZakres,
  type PozycjaZakresu,
  type Zakres,
} from "@/app/(app)/porownaj/actions";

type Karta = "specjalizacje" | "badania" | "dodatkowe";

const KARTY: { klucz: Karta; etykieta: string }[] = [
  { klucz: "specjalizacje", etykieta: "Specjalizacje" },
  { klucz: "badania", etykieta: "Badania" },
  { klucz: "dodatkowe", etykieta: "Zakresy dodatkowe" },
];

export function PorownanieZakresu({ pakiety }: { pakiety: PakietZDostawca[] }) {
  const [zakres, setZakres] = useState<Zakres | null>(null);
  const [laduje, setLaduje] = useState(false);
  const [karta, setKarta] = useState<Karta>("specjalizacje");
  const [tylkoRoznice, setTylkoRoznice] = useState(true);
  const [szukaj, setSzukaj] = useState("");

  const idPakietow = pakiety.map((p) => p.id);
  const klucz = idPakietow.join(",");

  useEffect(() => {
    let aktualne = true;
    setLaduje(true);
    pobierzZakres(klucz.split(",").map(Number))
      .then((w) => {
        if (aktualne) setZakres(w);
      })
      .finally(() => {
        if (aktualne) setLaduje(false);
      });
    return () => {
      aktualne = false;
    };
  }, [klucz]);

  const pozycje = zakres?.[karta] ?? [];

  const widoczne = useMemo(() => {
    const fraza = szukaj.trim().toLowerCase();
    return pozycje.filter((poz) => {
      if (fraza && !poz.nazwa.toLowerCase().includes(fraza)) return false;
      if (!tylkoRoznice) return true;
      // Różnica = świadczenie jest w części pakietów, a w części nie.
      const ile = idPakietow.filter((id) => id in poz.wPakiecie).length;
      return ile > 0 && ile < idPakietow.length;
    });
  }, [pozycje, szukaj, tylkoRoznice, idPakietow]);

  const podsumowanie = useMemo(
    () =>
      idPakietow.map(
        (id) => pozycje.filter((poz) => id in poz.wPakiecie).length,
      ),
    [pozycje, idPakietow],
  );

  const roznic = useMemo(
    () =>
      pozycje.filter((poz) => {
        const ile = idPakietow.filter((id) => id in poz.wPakiecie).length;
        return ile > 0 && ile < idPakietow.length;
      }).length,
    [pozycje, idPakietow],
  );

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 p-5">
        <h2 className="text-base font-bold text-brand-navy">
          Porównanie zakresów
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Co dokładnie obejmuje każdy pakiet — pozycja po pozycji
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {KARTY.map(({ klucz: k, etykieta }) => {
            const ile = zakres?.[k]?.length ?? 0;
            const aktywna = k === karta;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKarta(k)}
                aria-pressed={aktywna}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  aktywna
                    ? "bg-brand-navy text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {etykieta}
                <span
                  className={`ml-2 text-xs ${aktywna ? "opacity-70" : "text-slate-400"}`}
                >
                  {ile}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <input
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
            placeholder="Filtruj po nazwie…"
            className="min-w-[220px] flex-grow rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-brand-pink focus:bg-white"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={tylkoRoznice}
              onChange={(e) => setTylkoRoznice(e.target.checked)}
              className="h-4 w-4 accent-brand-pink"
            />
            Tylko różnice
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-brand-pink">
              {roznic}
            </span>
          </label>
        </div>
      </header>

      {zakres?.blad && (
        <p className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {zakres.blad}
        </p>
      )}

      <div className="custom-scroll max-h-[600px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 min-w-[260px] bg-brand-navy px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-white">
                Świadczenie
              </th>
              {pakiety.map((p, i) => (
                <th
                  key={p.id}
                  className="min-w-[130px] bg-brand-navy px-4 py-3 text-center text-[11px] font-bold text-white"
                >
                  <span className="block uppercase tracking-wide">
                    {p.dostawca_nazwa}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-normal opacity-80">
                    {p.nazwa}
                  </span>
                  <span className="mt-1 block text-[10px] font-black opacity-90">
                    {podsumowanie[i]} poz.
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {laduje && (
              <tr>
                <td
                  colSpan={pakiety.length + 1}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  Wczytywanie zakresów…
                </td>
              </tr>
            )}

            {!laduje && !widoczne.length && (
              <tr>
                <td
                  colSpan={pakiety.length + 1}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  {pozycje.length
                    ? "Brak pozycji spełniających filtr."
                    : "Dla tych pakietów nie ma danych szczegółowych w bazie."}
                </td>
              </tr>
            )}

            {!laduje &&
              widoczne.map((poz) => (
                <WierszZakresu
                  key={poz.nazwa}
                  pozycja={poz}
                  idPakietow={idPakietow}
                />
              ))}
          </tbody>
        </table>
      </div>

      {!laduje && widoczne.length > 0 && (
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          Pokazano {widoczne.length} z {pozycje.length} pozycji.
          {tylkoRoznice && " Odznacz „Tylko różnice”, aby zobaczyć pełny zakres."}
        </p>
      )}
    </section>
  );
}

function WierszZakresu({
  pozycja,
  idPakietow,
}: {
  pozycja: PozycjaZakresu;
  idPakietow: number[];
}) {
  return (
    <tr className="border-b border-slate-100 even:bg-slate-50/60">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-inherit px-4 py-2.5 text-left text-sm font-semibold text-slate-700"
      >
        {pozycja.nazwa}
      </th>

      {idPakietow.map((id) => {
        const jest = id in pozycja.wPakiecie;
        const limit = pozycja.wPakiecie[id];

        return (
          <td
            key={id}
            className={`px-4 py-2.5 text-center ${
              jest ? "bg-emerald-50/60" : "bg-red-50/40"
            }`}
          >
            {jest ? (
              limit ? (
                <span className="text-xs font-bold text-emerald-800">
                  {limit}
                </span>
              ) : (
                <span className="font-bold text-brand-emerald">✓</span>
              )
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
