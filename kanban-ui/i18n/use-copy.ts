"use client";

import { useLanguage } from "@/components/language";
import { getCopy } from ".";
import type { UiCopy } from "./types";

/** The words this screen draws in, in the language the machine is set to
 *  (`components/language.tsx`). The language is in the first paint, so a screen
 *  never draws English and corrects itself. */
export function useCopy(): UiCopy {
  return getCopy(useLanguage());
}
