import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Baza placówek — MEDICALAURA" };

type Placowka = {
  id: string;
  siec_bazowa: string | null;
  wojewodztwo: string | null;
  miejscowosc: string | null;
  adres: string | null;
  nazwa_oddzialu: string | null;
  telefon: string | null;
};

export default async function StronaPlacowek({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const fraza = q?.trim() ?? "";

  const supabase = await createClient();
  let zapytanie = supabase
    .from("placowki_medyczne")
    .select("id, siec_bazowa, wojewodztwo, miejscowosc, adres, nazwa_oddzialu, telefon", {
      count: "exact",
    })
    .eq("aktywna", true)
    .order("miejscowosc")
    .limit(100);

  if (fraza) {
    // Escapowanie znaków specjalnych PostgREST, by fraza nie rozbiła filtra.
    const bezpieczna = fraza.replace(/[%,()]/g, " ");
    zapytanie = zapytanie.or(
      `miejscowosc.ilike.%${bezpieczna}%,nazwa_oddzialu.ilike.%${bezpieczna}%,adres.ilike.%${bezpieczna}%`,
    );
  }

  const { data, count, error } = await zapytanie.returns<Placowka[]>();

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-base font-bold text-brand-navy">Baza placówek</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          {count?.toLocaleString("pl-PL") ?? "—"} placówek spełnia kryteria
          {fraza ? ` · filtr: „${fraza}”` : ""}
        </p>

        <form method="get" className="mt-4 flex gap-2">
          <input
            name="q"
            defaultValue={fraza}
            placeholder="Miasto, nazwa oddziału lub adres…"
            className="flex-grow rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-brand-pink focus:bg-white"
          />
          <button
            type="submit"
            className="rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Szukaj
          </button>
        </form>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Błąd odczytu: {error.message}
        </p>
      ) : (
        <div className="custom-scroll overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-brand-navy text-[11px] uppercase tracking-wider text-white">
                <th className="px-4 py-3 text-left">Sieć</th>
                <th className="px-4 py-3 text-left">Miejscowość</th>
                <th className="px-4 py-3 text-left">Oddział</th>
                <th className="px-4 py-3 text-left">Adres</th>
                <th className="px-4 py-3 text-left">Telefon</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-b border-slate-100 even:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-semibold text-brand-navy">
                    {p.siec_bazowa ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.miejscowosc ?? "—"}
                    {p.wojewodztwo && (
                      <span className="ml-1 text-[10px] uppercase text-slate-400">
                        {p.wojewodztwo}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {p.nazwa_oddzialu ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.adres ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{p.telefon ?? "—"}</td>
                </tr>
              ))}
              {!data?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    Brak wyników.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(count ?? 0) > 100 && (
        <p className="text-center text-xs text-slate-400">
          Pokazano pierwszych 100 wyników — zawęź wyszukiwanie.
        </p>
      )}
    </div>
  );
}
