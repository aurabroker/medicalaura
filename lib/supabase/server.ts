import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CiasteczkaDoUstawienia = {
  name: string;
  value: string;
  options: CookieOptions;
}[];

/**
 * Klient Supabase dla Server Components, Server Actions i Route Handlers.
 * Sesja żyje w ciasteczkach httpOnly — nie w localStorage, więc jest
 * nieosiągalna dla JavaScriptu w przeglądarce (odporność na XSS).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CiasteczkaDoUstawienia) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Wywołanie z Server Componentu — odświeżeniem sesji zajmuje się
            // middleware, więc ten błąd można bezpiecznie pominąć.
          }
        },
      },
    },
  );
}

/**
 * Klient omijający RLS. Wyłącznie do operacji administracyjnych
 * po stronie serwera (np. zarządzanie użytkownikami przez admina).
 *
 * Każde wywołanie MUSI być poprzedzone sprawdzeniem uprawnień —
 * ten klient nie egzekwuje żadnych polityk.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Brak SUPABASE_SERVICE_ROLE_KEY. Ustaw sekret: npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
