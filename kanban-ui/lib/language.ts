import { getCopy } from "@/i18n";
import type { UiCopy } from "@/i18n/types";
import { boardRules } from "./cli";
import { refusalLine, type Refused } from "./start-failure";
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

/** A failure the board's rules answered, said in this machine's language (#955): its kind's
 *  sentence where the copy has one, or the board's own words marked `raw` for the screen to
 *  put under its own summary. An answer with no error passes untouched. */
export async function said<T extends Refused>(r: T): Promise<T> {
  if (!r.error || r.raw !== undefined) return r;
  const line = refusalLine(r, await machineCopy());
  return { ...r, error: line ?? r.error, raw: !line };
}

/** The same for something the rules threw. A refusal the board threw carries its kind in
 *  `kind` and its values in `details`. */
export async function saidThrown(e: unknown): Promise<{ error: string; raw?: boolean }> {
  const error = e instanceof Error ? e.message : String(e);
  const kinded = e as { kind?: unknown; details?: Record<string, string> } | null;
  const reason = typeof kinded?.kind === "string" ? kinded.kind : undefined;
  const out: Refused = await said({ error, reason, args: kinded?.details });
  return { error: out.error!, raw: out.raw };
}
