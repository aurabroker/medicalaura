"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schemat = z.object({
  skladki: z
    .array(
      z.object({
        pakietId: z.number().int().positive(),
        cena: z.number().nonnegative().max(1_000_000),
      }),
    )
    .min(1)
    .max(8),
});

export type StanZapisu = { blad?: string; zapisano?: number };

/**
 * Zapisuje składki wynegocjowane z ofert do katalogu pakietów.
 *
 * Uprawnienia sprawdza funkcja med_zapisz_skladke po stronie bazy — nie
 * ufamy tu temu, czy interfejs pokazał przycisk. Zapis trafia do rejestru
 * audytowego przez trigger na tabeli pakiety.
 */
export async function zapiszSkladki(
  dane: z.input<typeof schemat>,
): Promise<StanZapisu> {
  const wejscie = schemat.safeParse(dane);
  if (!wejscie.success) {
    return { blad: "Nieprawidłowe kwoty składek." };
  }

  const supabase = await createClient();

  for (const { pakietId, cena } of wejscie.data.skladki) {
    const { error } = await supabase.rpc("med_zapisz_skladke", {
      p_pakiet_id: pakietId,
      p_cena: cena,
    });

    if (error) {
      return {
        blad: error.message.includes("uprawnien")
          ? "Zapis do katalogu wymaga uprawnień administratora. Wpisane składki nadal działają w zestawieniu i w PDF."
          : error.message,
      };
    }
  }

  revalidatePath("/porownaj");
  return { zapisano: wejscie.data.skladki.length };
}
