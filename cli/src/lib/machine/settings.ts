// What this MACHINE holds: `~/.ai4kanban/settings.json` (#334).
//
// One file beside the Cloud session, read and written through the board's rules, so the
// desktop app, the browser app and a bare `akb` in a terminal reach one answer. It is a
// fact about the reader rather than about a board, so it never lands in `docs/kanban/` —
// there it would be cloned along with the repository and shared with everyone on it.
//
// Nothing here fails: a missing file, an unreadable one, or a value this build does not
// know reads as English. A preference is never worth taking a screen down over.

import fs from 'node:fs'
import path from 'node:path'

import type { WriteResult } from '../view/types'
import { machineHome } from './home'
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './types'

export const settingsFile = (): string => path.join(machineHome(), 'settings.json')

/** The file as it stands. Anything that is not an object — absent, half-written, an array —
 *  is no settings, so every reader below falls back rather than throwing. */
function held(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** The language every screen draws in. */
export function readLanguage(): Language {
  const value = held().language
  return isLanguage(value) ? value : DEFAULT_LANGUAGE
}

/** Whether this machine has ever said which language to read in. `readLanguage` cannot
 *  answer that — it reads `en` both for a file holding nothing and for a reader who picked
 *  English — and the desktop app guesses from the system only on the first (#339). A saved
 *  `language` this build cannot read still counts as said, so an older app never guesses
 *  over a newer one's pick. */
export function languageChosen(): boolean {
  return held().language !== undefined
}

/** Save it. Through a temporary file, so a reader never sees half of one, and keeping
 *  whatever else the file holds — a setting a later release added is not this one's to drop. */
export function setLanguage(value: Language): WriteResult {
  if (!isLanguage(value)) return { ok: false, error: `${String(value)} is not a language this build knows` }
  try {
    fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
    const file = settingsFile()
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify({ ...held(), language: value }, null, 2)}\n`)
    fs.renameSync(tmp, file)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
