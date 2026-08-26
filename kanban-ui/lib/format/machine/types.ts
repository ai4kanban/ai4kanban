// Copied from cli/src/lib/machine/types.ts by scripts/sync-format.mjs — do not edit here.
// Edit the original and re-run `node scripts/sync-format.mjs`.

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
