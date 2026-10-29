// What language a run replies and writes in (#337, #11): one short line in that language, at
// the very end of every prompt. An English run is told nothing. Which headings and keys stay
// English is the board's rule (`akb guide board`, `writing`), not this line's.

import { readLanguage } from '../machine/settings'
import { DEFAULT_LANGUAGE, isLanguage, type Language } from '../machine/types'

/** Set by the Runner (#11): the language of the message that started a Cloud run, over this
 *  machine's own setting. */
export const RUN_LANGUAGE_ENV = 'AI4KANBAN_RUN_LANGUAGE'

const LINES: Record<Language, string> = {
  en: '',
  zh: '请用中文回复和写作。',
}

/** The language this run writes in. */
export function runLanguage(): Language {
  const asked = process.env[RUN_LANGUAGE_ENV]
  return isLanguage(asked) ? asked : readLanguage()
}

/** Whether this run writes in something other than English. */
export function translating(language: Language = runLanguage()): boolean {
  return language !== DEFAULT_LANGUAGE
}

/** The line that ends a prompt, or nothing in English. */
export function languageNote(language: Language = runLanguage()): string {
  return LINES[language]
}

/** The prompt with the line at its very end. */
export const inLanguage = (prompt: string, language: Language = runLanguage()): string =>
  [prompt, languageNote(language)].filter(Boolean).join('\n\n')
