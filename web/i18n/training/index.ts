// The training page's copy, in the two languages it is published in.
//
// Deliberately not part of `SiteCopy`: every other folder here carries five
// files because every other page exists in five languages, and `getCopy` would
// demand a Spanish training page that is not written and not sold. The page
// asks for its own copy instead, and `PATH_LOCALES` in `lib/i18n.ts` is what
// keeps the routes, the links and the hreflang set agreeing with this list.
import en from "./en";
import zh from "./zh";
import type { TrainingCopy } from "./types";

/** The languages the training page exists in. */
export const TRAINING_LOCALES = ["en", "zh"] as const;
export type TrainingLocale = (typeof TRAINING_LOCALES)[number];

const copy: Record<TrainingLocale, TrainingCopy> = { en, zh };

export function getTrainingCopy(locale: TrainingLocale): TrainingCopy {
  return copy[locale];
}

export const isTrainingLocale = (value: string): value is TrainingLocale =>
  (TRAINING_LOCALES as readonly string[]).includes(value);
