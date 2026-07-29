import { createClient } from "@/lib/supabase/server";
import { Porownywarka } from "@/components/Porownywarka";
import type { Dostawca, PakietZDostawca } from "@/lib/types";

export const metadata = { title: "Porównaj pakiety — MEDICALAURA" };

type WierszPakietu = Omit<PakietZDostawca, "dostawca_nazwa"> & {
  dostawcy: { nazwa: string } | null;
};

export default async function StronaPorownania() {
  const supabase = await createClient();

  const [{ data: dostawcy, error: bladDostawcow }, { data: pakiety, error: bladPakietow }] =
    await Promise.all([
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

  // Spłaszczamy zagnieżdżoną nazwę dostawcy do postaci używanej w zestawieniu.
  const pakietyZDostawca: PakietZDostawca[] = (pakiety ?? []).map(
    ({ dostawcy: d, ...reszta }) => ({
      ...reszta,
      dostawca_nazwa: d?.nazwa ?? "—",
    }),
  );

  return (
    <Porownywarka
      dostawcy={dostawcy ?? []}
      pakiety={pakietyZDostawca}
    />
  );
}
