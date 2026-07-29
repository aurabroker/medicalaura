"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schemat = z.object({
  userId: z.string().uuid(),
  aktywny: z.boolean(),
  rola: z.enum(["admin", "broker", "viewer"]).optional(),
  plan: z.enum(["trial", "pro", "enterprise"]).optional(),
});

export type StanAkcji = { blad?: string; ok?: boolean };

/**
 * Zmiana uprawnień użytkownika.
 *
 * Nie używamy tu klucza service_role: funkcja med_ustaw_dostep sama sprawdza
 * med.is_admin(). Dzięki temu aplikacja nigdy nie dysponuje kluczem
 * omijającym RLS, a próba wywołania przez nie-admina kończy się błędem
 * po stronie bazy — niezależnie od tego, co zrobi przeglądarka.
 */
export async function ustawDostep(dane: z.input<typeof schemat>): Promise<StanAkcji> {
  const wejscie = schemat.safeParse(dane);
  if (!wejscie.success) {
    return { blad: "Nieprawidłowe dane wejściowe." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("med_ustaw_dostep", {
    p_user: wejscie.data.userId,
    p_aktywny: wejscie.data.aktywny,
    p_rola: wejscie.data.rola ?? null,
    p_plan: wejscie.data.plan ?? null,
  });

  if (error) {
    return { blad: error.message };
  }

  revalidatePath("/admin");
  return { ok: true };
}
