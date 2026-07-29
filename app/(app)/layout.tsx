import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { wyloguj } from "@/app/login/actions";
import { Nawigacja } from "@/components/Nawigacja";
import type { CzlonekMed } from "@/lib/types";

export default async function LayoutAplikacji({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dostep } = await supabase
    .from("moj_dostep")
    .select("user_id, rola, aktywny, plan, plan_do, firma")
    .single<CzlonekMed>();

  // Deny-by-default: konto istnieje, ale admin go jeszcze nie aktywował.
  if (!dostep?.aktywny) {
    return <KontoNieaktywne email={user.email ?? ""} />;
  }

  const jestAdmin = dostep.rola === "admin";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 bg-brand-navy text-white shadow-md">
        <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-4 px-6 py-4 md:flex-row">
          <div className="flex items-center gap-3">
            <Link href="/porownaj" className="text-2xl font-black tracking-tight">
              MEDICAL<span className="text-brand-pink">AURA</span>
            </Link>
            <span className="rounded-md bg-brand-pink px-2 py-1 text-[10px] font-bold tracking-widest shadow-sm">
              V 2.0
            </span>
          </div>

          <Nawigacja jestAdmin={jestAdmin} />

          <form action={wyloguj} className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-300 lg:inline">
              {dostep.firma || user.email}
            </span>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              Wyloguj
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] flex-grow px-6 py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        MEDICALAURA · plan {dostep.plan}
        {dostep.plan_do ? ` · ważny do ${dostep.plan_do}` : ""}
      </footer>
    </div>
  );
}

function KontoNieaktywne({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-6 text-2xl font-black tracking-tight text-brand-navy">
          MEDICAL<span className="text-brand-pink">AURA</span>
        </div>

        <div className="mb-4 inline-flex rounded-full bg-amber-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
          Konto oczekuje na aktywację
        </div>

        <p className="text-sm leading-relaxed text-slate-600">
          Konto <strong>{email}</strong> zostało utworzone, ale nie ma jeszcze
          przyznanego dostępu do danych. Aktywuje je administrator.
        </p>

        <form action={wyloguj} className="mt-8">
          <button
            type="submit"
            className="text-sm font-semibold text-brand-pink hover:underline"
          >
            Wyloguj się
          </button>
        </form>
      </div>
    </main>
  );
}
