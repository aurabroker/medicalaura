import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CiasteczkaDoUstawienia = {
  name: string;
  value: string;
  options: CookieOptions;
}[];

/** Ścieżki dostępne bez zalogowania. */
const PUBLICZNE = ["/login", "/auth"];

/**
 * Odświeża sesję przy każdym żądaniu i pilnuje dostępu do tras.
 *
 * To wyłącznie wygoda nawigacyjna — prawdziwą kontrolą dostępu jest RLS
 * w bazie. Nawet gdyby ktoś ominął middleware, nie zobaczy żadnych danych.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CiasteczkaDoUstawienia) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() weryfikuje token u dostawcy. getSession() czyta wyłącznie
  // ciasteczko, którego treść może być podrobiona — dlatego nie używamy go
  // do decyzji o dostępie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sciezka = request.nextUrl.pathname;
  const jestPubliczna = PUBLICZNE.some((p) => sciezka.startsWith(p));

  if (!user && !jestPubliczna) {
    // Trasy API odpowiadają błędem, a nie przekierowaniem: fetch() po stronie
    // klienta podąża za przekierowaniem i dostałby HTML strony logowania
    // zamiast czytelnego statusu 401.
    if (sciezka.startsWith("/api/")) {
      return NextResponse.json({ blad: "Wymagane zalogowanie." }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("powrot", sciezka);
    return NextResponse.redirect(url);
  }

  if (user && sciezka === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/porownaj";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
