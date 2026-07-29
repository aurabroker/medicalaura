import { createClient } from "@/lib/supabase/server";
import { Porownywarka } from "@/components/Porownywarka";
import type { Dostawca, PakietZDostawca } from "@/lib/types";

export const metadata = { title: "Porównaj pakiety — MEDICALAURA" };

type WierszPakietu = Omit<PakietZDostawca, "dostawca_nazwa"> & {
  dostawcy: { nazwa: string } | null;
};

type Liczniki = {
  pakiet_id: number;
  rtg: number | null;
  tk: number | null;
  mri: number | null;
  usg: number | null;
};

export default async function StronaPorownania() {
  const supabase = await createClient();

  const [
    { data: dostawcy, error: bladDostawcow },
    { data: pakiety, error: bladPakietow },
    { data: liczniki },
  ] = await Promise.all([
    supabase
      .from("dostawcy")
      .select("id, nazwa, typ, skrot, aktywny, www")
      .order("nazwa")
      .returns<Dostawca[]>(),
    supabase
      .from("pakiety")
      .select("*, dostawcy(nazwa)")
      .order("dostawca_id")
      .order("tier")
      .returns<WierszPakietu[]>(),
    supabase
      .from("pakiety_liczniki")
      .select("pakiet_id, rtg, tk, mri, usg")
      .returns<Liczniki[]>(),
  ]);

  if (bladDostawcow || bladPakietow) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
        Nie udało się wczytać danych z bazy.
        {bladDostawcow?.message || bladPakietow?.message
          ? ` (${bladDostawcow?.message ?? bladPakietow?.message})`
          : ""}
      </div>
    );
  }

  const wgPakietu = new Map((liczniki ?? []).map((l) => [l.pakiet_id, l]));

  const pakietyZDostawca: PakietZDostawca[] = (pakiety ?? []).map(
    ({ dostawcy: d, ...reszta }) => {
      const l = wgPakietu.get(reszta.id);

      // Liczniki obrazowe bierzemy z tabel szczegółowych, bo index2.html
      // pokazywał tu zera — jego licznik nie miał wartości zapasowej, a dane
      // były zablokowane przez RLS. Kolumna z pakiety zostaje jako zapas.
      //
      // Świadomie NIE nadpisujemy liczba_badan_lab ani liczba_specjalizacji:
      // wyliczenia z pakiety_badania dają inne wartości niż kolumny (986 vs
      // 626 dla „Pakiet F"), a te kolumny wyświetlały się dotąd poprawnie.
      // Zmiana tych liczb to decyzja biznesowa, nie techniczna.
      return {
        ...reszta,
        dostawca_nazwa: d?.nazwa ?? "—",
        liczba_rtg: l?.rtg ?? reszta.liczba_rtg,
        liczba_tk: l?.tk ?? reszta.liczba_tk,
        liczba_mri: l?.mri ?? reszta.liczba_mri,
        liczba_usg: l?.usg ?? reszta.liczba_usg,
      };
    },
  );

  return (
    <Porownywarka dostawcy={dostawcy ?? []} pakiety={pakietyZDostawca} />
  );
}
