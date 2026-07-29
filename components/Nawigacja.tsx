"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const POZYCJE = [
  { href: "/porownaj", etykieta: "🔍 Porównaj" },
  { href: "/placowki", etykieta: "🏥 Baza Placówek" },
  { href: "/konto", etykieta: "👤 Konto" },
];

export function Nawigacja({ jestAdmin }: { jestAdmin: boolean }) {
  const sciezka = usePathname();
  const pozycje = jestAdmin
    ? [...POZYCJE, { href: "/admin", etykieta: "🔒 Admin" }]
    : POZYCJE;

  return (
    <nav className="custom-scroll flex gap-1 overflow-x-auto whitespace-nowrap rounded-xl bg-slate-800/50 p-1">
      {pozycje.map(({ href, etykieta }) => {
        const aktywna = sciezka.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={aktywna ? "page" : undefined}
            className={
              aktywna
                ? "rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm"
                : "rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
            }
          >
            {etykieta}
          </Link>
        );
      })}
    </nav>
  );
}
