import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WierszUzytkownika } from "@/components/WierszUzytkownika";
import type { CzlonekMed } from "@/lib/types";

export const metadata = { title: "Administracja — MEDICALAURA" };

export type UzytkownikAdmin = {
  user_id: string;
  email: string;
  rola: "admin" | "broker" | "viewer";
  aktywny: boolean;
  plan: "trial" | "pro" | "enterprise";
  plan_do: string | null;
  firma: string | null;
  utworzony: string;
  ostatnie_logowanie: string | null;
};

export default async function StronaAdmina() {
  const supabase = await createClient();

  // Bramka nawigacyjna. Właściwą kontrolą jest med.is_admin() wewnątrz
  // funkcji bazodanowych — bez uprawnień zwrócą błąd niezależnie od UI.
  const { data: dostep } = await supabase
    .from("moj_dostep")
    .select("rola")
    .single<Pick<CzlonekMed, "rola">>();
  if (dostep?.rola !== "admin") redirect("/porownaj");

  const { data, error } = await supabase.rpc("med_lista_uzytkownikow");
  const uzytkownicy = (data ?? []) as UzytkownikAdmin[];
  const aktywnych = uzytkownicy.filter((u) => u.aktywny).length;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-base font-bold text-brand-navy">
          Zarządzanie użytkownikami
        </h1>
        <p className="mt-0.5 text-xs text-slate-400">
          {uzytkownicy.length} kont · {aktywnych} aktywnych ·{" "}
          {uzytkownicy.length - aktywnych} oczekuje na aktywację
        </p>
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
                <th className="px-4 py-3 text-left">Użytkownik</th>
                <th className="px-4 py-3 text-left">Rola</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Ostatnie logowanie</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Akcja</th>
              </tr>
            </thead>
            <tbody>
              {uzytkownicy.map((u) => (
                <WierszUzytkownika key={u.user_id} uzytkownik={u} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
        Nowe konta powstają nieaktywne i nie widzą żadnych danych, dopóki nie
        zostaną tu aktywowane. Nie można odebrać uprawnień własnemu kontu —
        zabezpieczenie przed zablokowaniem się poza systemem.
      </p>
    </div>
  );
}
