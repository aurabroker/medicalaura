"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schemat = z.object({
  email: z.string().email("Nieprawidłowy adres e-mail."),
  haslo: z.string().min(1, "Podaj hasło."),
  powrot: z.string().optional(),
});

export type StanLogowania = { blad?: string };

export async function zaloguj(
  _stan: StanLogowania,
  formData: FormData,
): Promise<StanLogowania> {
  const dane = schemat.safeParse({
    email: formData.get("email"),
    haslo: formData.get("haslo"),
    powrot: formData.get("powrot") ?? undefined,
  });

  if (!dane.success) {
    return { blad: dane.error.errors[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: dane.data.email,
    password: dane.data.haslo,
  });

  if (error) {
    // Celowo nie rozróżniamy "zły e-mail" od "złe hasło" — inaczej formularz
    // stałby się narzędziem do sprawdzania, które adresy są zarejestrowane.
    return { blad: "Nieprawidłowy e-mail lub hasło." };
  }

  const cel = dane.data.powrot?.startsWith("/") ? dane.data.powrot : "/porownaj";
  revalidatePath("/", "layout");
  redirect(cel);
}

export async function wyloguj() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
