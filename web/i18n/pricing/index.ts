// The pricing page's copy, in the two languages it is published in. Kept out of
// `SiteCopy` for the reason `i18n/training/index.ts` gives.
import en from "./en";
import zh from "./zh";
import type { PricingCopy } from "./types";

export const PRICING_LOCALES = ["en", "zh"] as const;
export type PricingLocale = (typeof PRICING_LOCALES)[number];

const copy: Record<PricingLocale, PricingCopy> = { en, zh };

export function getPricingCopy(locale: PricingLocale): PricingCopy {
  return copy[locale];
}

export const isPricingLocale = (value: string): value is PricingLocale =>
  (PRICING_LOCALES as readonly string[]).includes(value);
