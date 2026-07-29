import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  SEKCJE,
  czyPokazac,
  najlepszaNajgorsza,
  sformatuj,
} from "@/lib/compare/wiersze";
import type { PakietZDostawca } from "@/lib/types";

const zadanie = z.object({
  idPakietow: z.array(z.number().int().positive()).min(2).max(8),
  // Kwoty z ofert wpisane przez brokera. To jedyne dane, które przyjmujemy
  // od klienta — z natury nie ma ich w bazie. Reszta zestawienia pochodzi
  // z bazy, po samych identyfikatorach.
  skladki: z
    .array(
      z.object({
        pakietId: z.number().int().positive(),
        cena: z.number().nonnegative().max(1_000_000),
      }),
    )
    .max(8)
    .optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ blad: "Wymagane zalogowanie." }, { status: 401 });
  }

  const cialo = zadanie.safeParse(await request.json().catch(() => null));
  if (!cialo.success) {
    return NextResponse.json(
      { blad: "Podaj od 2 do 8 identyfikatorów pakietów." },
      { status: 400 },
    );
  }

  // Dane pobieramy z bazy po samych identyfikatorach. Gdybyśmy przyjęli
  // gotowe wartości od klienta, do PDF-a trafiłoby to, co podeśle przeglądarka.
  // RLS i tak odfiltruje pakiety, do których użytkownik nie ma prawa.
  const { data, error } = await supabase
    .from("pakiety")
    .select("*, dostawcy(nazwa)")
    .in("id", cialo.data.idPakietow);

  if (error) {
    return NextResponse.json({ blad: "Błąd odczytu z bazy." }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json(
      { blad: "Brak dostępu do wskazanych pakietów." },
      { status: 403 },
    );
  }

  const pakiety: PakietZDostawca[] = cialo.data.idPakietow
    .map((id) => data.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => {
      const { dostawcy, ...reszta } = p as Record<string, unknown> & {
        dostawcy: { nazwa: string } | null;
      };
      return {
        ...reszta,
        dostawca_nazwa: dostawcy?.nazwa ?? "—",
      } as PakietZDostawca;
    });

  const klucz = process.env.PDFSHIFT_API_KEY;
  if (!klucz) {
    return NextResponse.json(
      { blad: "PDFShift nie jest skonfigurowany (brak PDFSHIFT_API_KEY)." },
      { status: 503 },
    );
  }

  const odpowiedz = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(`api:${klucz}`)}`,
    },
    body: JSON.stringify({
      source: zbudujHtml(pakiety, new Map(
        (cialo.data.skladki ?? []).map((s) => [s.pakietId, s.cena]),
      )),
      landscape: pakiety.length > 3,
      format: "A4",
      margin: "12mm",
    }),
  });

  if (!odpowiedz.ok) {
    const szczegol = await odpowiedz.text().catch(() => "");
    console.error("PDFShift:", odpowiedz.status, szczegol);
    return NextResponse.json(
      { blad: "Usługa generowania PDF zwróciła błąd." },
      { status: 502 },
    );
  }

  return new NextResponse(await odpowiedz.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="medicalaura-zestawienie.pdf"',
    },
  });
}

/** Zabezpiecza wartości przed wstrzyknięciem znaczników do dokumentu. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function zbudujHtml(
  pakiety: PakietZDostawca[],
  skladki: Map<number, number>,
): string {
  const naglowki = pakiety
    .map(
      (p) =>
        `<th>${esc(p.dostawca_nazwa)}<br/><span class="pkg">${esc(p.nazwa)}</span></th>`,
    )
    .join("");

  const tresc = SEKCJE.map((sekcja) => {
    const widoczne = sekcja.wiersze
      .map((wiersz) => ({
        wiersz,
        wartosci: pakiety.map((p) =>
          wiersz.klucz === "cena_grup_mies"
            ? (skladki.get(p.id) ??
              (p.cena_grup_mies === null ? null : Number(p.cena_grup_mies)))
            : p[wiersz.klucz],
        ),
      }))
      .filter(({ wiersz, wartosci }) => czyPokazac(wiersz, wartosci));

    if (!widoczne.length) return "";

    const naglowekSekcji = `<tr class="sep"><td colspan="${
      pakiety.length + 1
    }">${esc(sekcja.tytul)}</td></tr>`;

    const wiersze = widoczne
      .map(({ wiersz, wartosci }) => {
        const { najlepszy, najgorszy } = najlepszaNajgorsza(wiersz, wartosci);

        const komorki = wartosci
          .map((w, i) => {
            const klasa =
              i === najlepszy ? "best" : i === najgorszy ? "worst" : "";
            return `<td class="${klasa}">${esc(sformatuj(wiersz, w))}</td>`;
          })
          .join("");

        return `<tr><td class="lbl">${esc(wiersz.etykieta)}</td>${komorki}</tr>`;
      })
      .join("");

    return naglowekSekcji + wiersze;
  }).join("");

  const data = new Date().toLocaleString("pl-PL");

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"/><style>
    body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#1e293b;padding:20px}
    h1{font-size:16px;color:#1e294a;margin:0 0 2px}
    .sub{font-size:9px;color:#64748b;margin-bottom:16px}
    table{width:100%;border-collapse:collapse}
    th{background:#1e294a;color:#fff;padding:7px 9px;font-size:9px;text-align:center}
    th:first-child{text-align:left}
    .pkg{font-weight:400;opacity:.85}
    td{padding:6px 9px;border-bottom:1px solid #e2e8f0;font-size:9px;text-align:center}
    td.lbl{font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.04em;text-align:left}
    .sep td{background:#f1f5f9;font-weight:800;font-size:8px;letter-spacing:.1em;
            text-transform:uppercase;color:#1e294a;text-align:left}
    .best{background:#ecfdf5;color:#065f46;font-weight:800}
    .worst{background:#fef2f2;color:#b91c1c;font-weight:700}
    .foot{font-size:8px;color:#94a3b8;text-align:right;margin-top:16px}
  </style></head><body>
    <h1>MEDICALAURA — Zestawienie porównawcze</h1>
    <div class="sub">Data wygenerowania: ${esc(data)}</div>
    <table>
      <thead><tr><th>Parametr</th>${naglowki}</tr></thead>
      <tbody>${tresc}</tbody>
    </table>
    <div class="foot">Dokument wygenerowany przez system MEDICALAURA</div>
  </body></html>`;
}
