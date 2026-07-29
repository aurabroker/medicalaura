/**
 * Buduje worker OpenNext zaraz po instalacji zależności — ale wyłącznie
 * w środowisku CI.
 *
 * Po co to istnieje:
 * Cloudflare Workers Builds wykonuje `npm clean-install`, a następnie komendę
 * deploy. Jeśli w panelu nie wypełniono pola "Build command", katalog
 * .open-next nigdy nie powstaje, a `wrangler deploy` kończy się błędem
 * "Could not find compiled Open Next config".
 *
 * Sprawdzone: hook `build` w wrangler.jsonc tego nie ratuje — wrangler
 * wykrywa OpenNext i przekazuje sterowanie do `opennextjs-cloudflare deploy`
 * zanim ten hook zdąży się wykonać.
 *
 * Instalacja zależności to jedyny krok, który w tym potoku wykonuje się
 * zawsze, więc budowanie podpinamy właśnie tutaj. Lokalnie skrypt nic nie
 * robi, żeby `npm install` nie uruchamiał produkcyjnego builda.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const wCI = Boolean(process.env.CI || process.env.WORKERS_CI);

if (!wCI) {
  process.exit(0);
}

if (existsSync(".open-next")) {
  console.log("[postinstall] .open-next już istnieje — pomijam budowanie.");
  process.exit(0);
}

console.log("[postinstall] Środowisko CI — buduję worker OpenNext.");

try {
  execSync("npm run cf:build", { stdio: "inherit" });
} catch {
  // Nie przerywamy instalacji: gdy w panelu ustawiono własne pole
  // "Build command", zbuduje ono projekt w kolejnym kroku. Błąd i tak
  // ujawni się przy deployu, z czytelniejszym komunikatem.
  console.warn(
    "[postinstall] Budowanie nie powiodło się. Jeśli w panelu ustawiono " +
      "osobną komendę build, zostanie użyta w następnym kroku.",
  );
}
