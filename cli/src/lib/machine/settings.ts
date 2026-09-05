// What this MACHINE holds: `~/.ai4kanban/settings.json` (#334).
//
// One file beside the Cloud session, read and written through the board's rules, so the
// desktop app, the browser app and a bare `akb` in a terminal reach one answer. It is a
// fact about the reader rather than about a board, so it never lands in `docs/kanban/` —
// there it would be cloned along with the repository and shared with everyone on it.
//
// A preference never fails: a missing file, an unreadable one, or a value this build does
// not know reads as English, and a preference is never worth taking a screen down over.
// An answer that is ON when absent is a different case — see `heldSettings` below.

import fs from 'node:fs'
import path from 'node:path'

import type { WriteResult } from '../view/types'
import { machineHome } from './home'
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './types'

export const settingsFile = (): string => path.join(machineHome(), 'settings.json')

/** The file as it stands, and whether it could be read at all.
 *
 *  A missing file is no settings and reads fine — every default below stands. One that is
 *  there and will not parse is `unreadable`, which is NOT the same answer: usage reporting
 *  is on when its key is absent (#293), so a reader that could not tell the two apart would
 *  start sending from a machine whose user had already said no. Writing is refused for the
 *  same reason — a merge over an unreadable file would drop the answer it holds. */
export function heldSettings(): { unreadable: boolean; values: Record<string, unknown> } {
  let text: string
  try {
    text = fs.readFileSync(settingsFile(), 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { unreadable: false, values: {} }
    return { unreadable: true, values: {} }
  }
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { unreadable: true, values: {} }
    return { unreadable: false, values: parsed as Record<string, unknown> }
  } catch {
    return { unreadable: true, values: {} }
  }
}

const held = (): Record<string, unknown> => heldSettings().values

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
  return saveSettings({ language: value })
}

/** Whether this machine's system notifications are silenced (#319).
 *
 *  One switch, beside the sign-in rather than on a board: the interruptions it stops arrive
 *  from every enabled board, and a per-board switch would be reachable only by opening that
 *  project first. The bell keeps filling either way — this stops the alert, not the news. */
export function notificationsSilenced(): boolean {
  return held().notificationsSilenced === true
}

export function setNotificationsSilenced(on: boolean): WriteResult {
  return saveSettings({ notificationsSilenced: !!on })
}

/** Write these keys, keeping whatever else the file holds; a key given `undefined` is
 *  removed. Refused while the file cannot be read, since the merge would write the keys it
 *  could not parse out of existence. */
export function saveSettings(patch: Record<string, unknown>): WriteResult {
  const { unreadable, values } = heldSettings()
  if (unreadable) return { ok: false, error: `${settingsFile()} cannot be read — fix or remove it, then try again` }
  const next = { ...values, ...patch }
  for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key]
  try {
    fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
    const file = settingsFile()
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`)
    fs.renameSync(tmp, file)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
