// The languages AI4Kanban works in (#334).
//
// The spelling is `web/lib/i18n.ts`'s, so the site, the board UI and the language a run is
// started in all name a language the same way.
//
// Pure types and constants, no imports — so the board UI takes a copy
// (scripts/sync-format.mjs) and names the same shapes the command does.

/** Every language this build knows. English is the source. */
export const LANGUAGES = ['en', 'zh'] as const

export type Language = (typeof LANGUAGES)[number]

/** What a machine that has never said reads as. */
export const DEFAULT_LANGUAGE: Language = 'en'

/** Each language written in its own name — what a switcher shows. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  zh: '中文',
}

/** BCP 47 tags for `<html lang>`. Chinese is tagged by script because the copy is
 *  Simplified — a bare `zh` would also claim the Traditional readers we don't serve. */
export const LANGUAGE_TAGS: Record<Language, string> = {
  en: 'en',
  zh: 'zh-Hans',
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

/** The language a BCP 47 tag reads as — `en-GB` is English, and any `zh-*` is Simplified
 *  Chinese, the only Chinese copy this build has. Null when this build has no language for
 *  the tag, so a walk down a reader's preferred languages carries on to the next one
 *  instead of stopping on English at the first entry. */
export function languageForTag(tag: string): Language | null {
  const primary = tag.split('-')[0]?.toLowerCase()
  return isLanguage(primary) ? primary : null
}

// ---- optional usage reporting (#293) ----------------------------------------

/** What this machine has answered about usage reporting. The board UI draws the disclosure
 *  step and the Configuration row from it, so the shape is here rather than beside the file
 *  it is read from (./telemetry.ts, which touches disk). */
export interface UsageReporting {
  /** Whether anything may be sent. On when the machine has never answered. */
  on: boolean
  /** Whether the disclosure step has been shown and answered — the only thing that step is
   *  gated on, so an answer typed with `akb telemetry off` still brings it up. */
  disclosed: boolean
  /** The id this machine's reports carry, or `''` before the first event is queued. */
  installId: string
  /** The settings file is there and cannot be read. Nothing is sent, the step is held back,
   *  and every write refuses until it can be read again. */
  unreadable: boolean
}
