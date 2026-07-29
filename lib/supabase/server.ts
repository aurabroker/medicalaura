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

/*
 * Celowo NIE ma tu klienta z kluczem service_role.
 *
 * Operacje administracyjne idą przez funkcje bazodanowe
 * (med_lista_uzytkownikow, med_ustaw_dostep), które same sprawdzają
 * med.is_admin(). Uprawnienia egzekwuje baza, nie aplikacja.
 *
 * Gdyby taki klient tu istniał — nawet nieużywany — wystarczyłby jeden
 * import, żeby ominąć RLS. Nie trzymamy go w zasięgu ręki.
 */
