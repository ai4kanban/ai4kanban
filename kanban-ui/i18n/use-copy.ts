"use client";

import { copy } from ".";
import type { UiCopy } from "./types";

/** The words this screen draws in. One language ships today, so this hands back
 *  English; #336 makes it read the machine's language (`components/language.tsx`)
 *  and every caller here follows without changing. */
export function useCopy(): UiCopy {
  return copy;
}
