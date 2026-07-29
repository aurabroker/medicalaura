"use client";

import { useState, useTransition } from "react";
import { ustawDostep } from "@/app/(app)/admin/actions";
import type { UzytkownikAdmin } from "@/app/(app)/admin/page";

export function WierszUzytkownika({ uzytkownik }: { uzytkownik: UzytkownikAdmin }) {
  const [oczekuje, startTransition] = useTransition();
  const [blad, setBlad] = useState<string | null>(null);

  function przelacz() {
    setBlad(null);
    startTransition(async () => {
      const wynik = await ustawDostep({
        userId: uzytkownik.user_id,
        aktywny: !uzytkownik.aktywny,
      });
      if (wynik.blad) setBlad(wynik.blad);
    });
  }

  return (
    <tr className="border-b border-slate-100 even:bg-slate-50/60">
      <td className="px-4 py-3">
        <span className="block font-semibold text-slate-700">
          {uzytkownik.email}
        </span>
        {uzytkownik.firma && (
          <span className="block text-[11px] text-slate-400">
            {uzytkownik.firma}
          </span>
        )}
        {blad && (
          <span className="mt-1 block text-[11px] font-semibold text-red-600">
            {blad}
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
            uzytkownik.rola === "admin"
              ? "bg-brand-pink text-white"
              : "bg-slate-200 text-slate-600"
          }`}
        >
          {uzytkownik.rola}
        </span>
      </td>

      <td className="px-4 py-3 text-slate-600">{uzytkownik.plan}</td>

      <td className="px-4 py-3 text-slate-500">
        {uzytkownik.ostatnie_logowanie
          ? new Date(uzytkownik.ostatnie_logowanie).toLocaleString("pl-PL")
          : "nigdy"}
      </td>

      <td className="px-4 py-3 text-center">
        {uzytkownik.aktywny ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase text-emerald-700">
            aktywny
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase text-amber-700">
            oczekuje
          </span>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={przelacz}
          disabled={oczekuje}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
            uzytkownik.aktywny
              ? "text-slate-500 hover:bg-slate-100"
              : "bg-brand-emerald text-white hover:bg-emerald-600"
          }`}
        >
          {oczekuje
            ? "…"
            : uzytkownik.aktywny
              ? "Dezaktywuj"
              : "Aktywuj"}
        </button>
      </td>
    </tr>
  );
}
