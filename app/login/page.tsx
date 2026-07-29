"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { zaloguj, type StanLogowania } from "./actions";

function Formularz() {
  const powrot = useSearchParams().get("powrot") ?? "";
  const [stan, akcja, oczekuje] = useActionState<StanLogowania, FormData>(
    zaloguj,
    {},
  );

  return (
    <form action={akcja} className="space-y-4">
      <input type="hidden" name="powrot" value={powrot} />

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
        >
          Adres e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-brand-pink focus:bg-white"
          placeholder="broker@firma.pl"
        />
      </div>

      <div>
        <label
          htmlFor="haslo"
          className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
        >
          Hasło
        </label>
        <input
          id="haslo"
          name="haslo"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-brand-pink focus:bg-white"
          placeholder="••••••••••••"
        />
      </div>

      {stan.blad && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          {stan.blad}
        </p>
      )}

      <button
        type="submit"
        disabled={oczekuje}
        className="w-full rounded-xl bg-brand-pink py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {oczekuje ? "Logowanie…" : "Zaloguj się"}
      </button>
    </form>
  );
}

export default function StronaLogowania() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-3xl font-black tracking-tight text-brand-navy">
            MEDICAL<span className="text-brand-pink">AURA</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Porównywarka pakietów medycznych B2B
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <Suspense
            fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-100" />}
          >
            <Formularz />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          Dostęp wyłącznie dla zaproszonych brokerów.
          <br />
          Po konto zgłoś się do administratora.
        </p>
      </div>
    </main>
  );
}
