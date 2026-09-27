// The seed partner page's copy, in the languages the pricing page that links to it is published in.
import type { PricingLocale } from "@/i18n/pricing";
import en from "./en";
import zh from "./zh";
import type { SeedCopy } from "./types";

const copy: Record<PricingLocale, SeedCopy> = { en, zh };

export function getSeedCopy(locale: PricingLocale): SeedCopy {
  return copy[locale];
}
