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

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
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
