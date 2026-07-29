import { createClient } from "@/lib/supabase/server";
import type { CzlonekMed } from "@/lib/types";

export const metadata = { title: "Konto — MEDICALAURA" };

export default async function StronaKonta() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: dostep } = await supabase
    .from("moj_dostep")
    .select("user_id, rola, aktywny, plan, plan_do, firma")
    .single<CzlonekMed>();

  const pola: Array<[string, string]> = [
    ["Adres e-mail", user?.email ?? "—"],
    ["Firma", dostep?.firma ?? "—"],
    ["Rola", dostep?.rola ?? "—"],
    ["Plan", dostep?.plan ?? "—"],
    ["Plan ważny do", dostep?.plan_do ?? "bezterminowo"],
    [
      "Ostatnie logowanie",
      user?.last_sign_in_at
        ? new Date(user.last_sign_in_at).toLocaleString("pl-PL")
        : "—",
    ],
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-base font-bold text-brand-navy">Twoje konto</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Dane konta i zakres dostępu
        </p>

        <dl className="mt-6 divide-y divide-slate-100">
          {pola.map(([etykieta, wartosc]) => (
            <div key={etykieta} className="flex justify-between gap-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {etykieta}
              </dt>
              <dd className="text-sm font-semibold text-slate-700">{wartosc}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
        Zmianę firmy, planu lub roli wykonuje administrator. Hasło zmienisz
        przez formularz odzyskiwania na stronie logowania.
      </p>
    </div>
  );
}
