// What language a run writes the board in (#337).
//
// One helper behind every path words reach an agent by — the ask a run is given
// (agent/prompts.ts), every turn of a conversation (agent/chat.ts), and the setup line a
// user pastes into their own agent (agent/resolve.ts) — so a board is never half translated.
//
// An English machine is told nothing at all: the flows are written in English, so an English
// board's prompts stay exactly as they were and cost nothing.
//
// The boundary rides in the line rather than only in `akb guide board`, because the flows
// that write the most prose — `writing`, `qa-loop`, `revise`, `spec-agent` and `changelog` —
// are never given that guide. A run told to write Chinese without the boundary translates a
// section heading, and that is a card the board can no longer read.

import { readLanguage } from '../machine/settings'
import { DEFAULT_LANGUAGE, LANGUAGE_NAMES, type Language } from '../machine/types'

/** Whether this board is read in something other than English. For the caller that only
 *  needs to know a rule applies — a printed `create` line spelling out `--slug` — rather
 *  than what the rule says. */
export function translating(language: Language = readLanguage()): boolean {
  return language !== DEFAULT_LANGUAGE
}

/** The sentence that tells one run which language the board is read in, or nothing at all
 *  when it is English. */
export function languageNote(language: Language = readLanguage()): string {
  if (!translating(language)) return ''
  const name = LANGUAGE_NAMES[language]
  return [
    `Write this board's prose in ${name}: card titles and bodies, open questions and their options, \`verify:\` lines, memory notes, changelogs, and what you say back to me.`,
    `Keep English whatever the language: frontmatter keys and their fixed values, \`##\` and \`###\` section headings, the \`<!-- agent -->\` boundary, todo checkboxes, the \`[user]\` tag, track and module names, and card filenames. Never rename or translate a section title — the board matches those by literal English text, so a changed one is a card it can no longer read, and a title that is not English needs \`akb board create --slug\` a short English slug.`,
    `Rewriting a card or a memory file that already exists keeps the language that file is already in; only what you write for me to read personally — an open question, its options and a \`verify:\` line — follows ${name} on every card, and so does the first note in a memory file still holding nothing but its seeded header.`,
    `This governs the board's prose alone: code, comments, commit messages and the repository's own documents follow the repository, not me. \`akb guide board\` carries the rule in full.`,
  ].join(' ')
}
