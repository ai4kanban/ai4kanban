// The template catalog's copy, in the two languages it is published in. Kept
// out of `SiteCopy` for the reason `i18n/training/index.ts` gives.
import en from "./en";
import zh from "./zh";
import type { TemplatesCopy } from "./types";

export const TEMPLATES_LOCALES = ["en", "zh"] as const;
export type TemplatesLocale = (typeof TEMPLATES_LOCALES)[number];

const copy: Record<TemplatesLocale, TemplatesCopy> = { en, zh };

export function getTemplatesCopy(locale: TemplatesLocale): TemplatesCopy {
  return copy[locale];
}

export const isTemplatesLocale = (value: string): value is TemplatesLocale =>
  (TEMPLATES_LOCALES as readonly string[]).includes(value);
