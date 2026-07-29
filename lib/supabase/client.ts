import { createBrowserClient } from "@supabase/ssr";

/** Klient Supabase dla komponentów działających w przeglądarce. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
