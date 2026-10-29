// What language a run replies and writes in (#337, #11, #47): one short line at the very end of
// every prompt. A Cloud run gets Cloud's line as it is; only a run started here reads this
// machine's setting, and an English one is told nothing. Which headings and keys stay English is
// the board's rule (`akb guide board`, `writing`), not this line's.

import { readLanguage } from '../machine/settings'
import type { Language } from '../machine/types'

/** Set by the Runner (#47): Cloud's language line for a Cloud run, passed on as it is — even
 *  empty, it stands over this machine's setting. */
export const LANGUAGE_LINE_ENV = 'AI4KANBAN_LANGUAGE_LINE'

const LINES: Record<Language, string> = {
  en: '',
  zh: '请用中文回复和写作。',
}

/** The line that ends a prompt; empty when there is nothing to say. */
export function languageNote(): string {
  return process.env[LANGUAGE_LINE_ENV] ?? LINES[readLanguage()]
}

/** Whether this run is told to write something other than English. */
export function translating(): boolean {
  const line = languageNote()
  return line !== '' && !/\bEnglish\b/.test(line)
}

/** The prompt with the line at its very end. */
export const inLanguage = (prompt: string): string => [prompt, languageNote()].filter(Boolean).join('\n\n')
