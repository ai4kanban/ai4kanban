import { getCopy } from "@/i18n";
import type { UiCopy } from "@/i18n/types";
import { boardRules } from "./cli";
import { DEFAULT_LANGUAGE, isLanguage, type Language, type WriteResult } from "./types";

// --- the language this MACHINE works in (#334) -------------------------------
// Not a board setting: it is a fact about the reader, so one answer covers every project
// the app has open and every terminal on the machine. The board's rules hold it, in a file
// outside every repository — nothing here knows which file or what shape it has.

/** What every screen draws in. Rules older than the setting draw English, which is what
 *  they always did — failing to draw instead would take the app down over a preference. */
export async function machineLanguage(): Promise<Language> {
  const rules = await boardRules();
  const held = rules.readLanguage?.();
  return isLanguage(held) ? held : DEFAULT_LANGUAGE;
}

export async function setMachineLanguage(value: Language): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setLanguage) {
    return { ok: false, error: (await machineCopy()).messages.tooOld.language };
  }
  return rules.setLanguage(value);
}

/** The words the server writes in — `getCopy()` on the language this machine is set to.
 *  What `useCopy()` is to a client component, this is to `lib/` and to a server action.
 *  Rules that cannot say fall back to English rather than failing the render. */
export async function machineCopy(): Promise<UiCopy> {
  return getCopy(await machineLanguage().catch(() => DEFAULT_LANGUAGE));
}
