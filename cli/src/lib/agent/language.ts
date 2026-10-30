// What language a run replies and writes in (#337, #11, #47, #104): one short line at the very end
// of every prompt, and the same ask in the connector's own system prompt so it holds on every turn
// (harnesses/types.ts, `systemPrompt`). A Cloud run gets Cloud's line as it is; only a run started
// here reads this machine's setting, and an English one is told nothing. Which headings and keys
// stay English is the board's rule (`akb guide board`, `writing`), not this line's.

import { readLanguage } from '../machine/settings'
import type { Language } from '../machine/types'

/** Set by the Runner (#47): Cloud's language line for a Cloud run, passed on as it is — even
 *  empty, it stands over this machine's setting. */
export const LANGUAGE_LINE_ENV = 'AI4KANBAN_LANGUAGE_LINE'

const LINES: Record<Language, string> = {
  en: '',
  zh: '请用中文回复和写作。',
}

// What a known line says in a system prompt, where it has to outlast an English-heavy context.
const SYSTEM: Record<string, string> = {
  [LINES.zh]: '无论对话里的卡片、代码和贴进来的内容是什么语言，回复和写下的内容都用中文。代码、命令、文件名和字段名保持原文。',
}

/** The line that ends a prompt; empty when there is nothing to say. */
export function languageNote(): string {
  return process.env[LANGUAGE_LINE_ENV] ?? LINES[readLanguage()]
}

const asksForTranslation = (line: string): boolean => line !== '' && !/\bEnglish\b/.test(line)

/** Whether this run is told to write something other than English. */
export const translating = (): boolean => asksForTranslation(languageNote())

/** What the connector's system prompt is told for `line`; empty for English, which changes nothing. */
export const systemLanguage = (line: string): string => (asksForTranslation(line) ? (SYSTEM[line] ?? line) : '')

/** The prompt with the line at its very end. */
export const inLanguage = (prompt: string): string => [prompt, languageNote()].filter(Boolean).join('\n\n')
