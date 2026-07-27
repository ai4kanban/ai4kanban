import type { Locale } from "@/lib/i18n";
import type { SiteCopy } from "./types";
import en from "./en";
import zh from "./zh";
import es from "./es";
import ja from "./ja";
import fr from "./fr";

const COPY: Record<Locale, SiteCopy> = { en, zh, es, ja, fr };

/** Every word the site renders, in one language. */
export function getCopy(locale: Locale): SiteCopy {
  return COPY[locale];
}
