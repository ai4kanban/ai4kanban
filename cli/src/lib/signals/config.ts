// Where the board pulls its market signals from (#453).
//
// Two settings, in the two places the board already keeps settings: the endpoint is a line
// in `config.md`, like every other project setting, and the token is a key in
// `docs/kanban/.env`, like every other key. There is no configuration screen in this first
// version — both are filled in by hand.
//
// The token never leaves this module except as the one header the fetch sends. Nothing
// here puts it in a message, and nothing that reports a gap says more than that it is
// missing.

import fs from 'node:fs'
import path from 'node:path'

import { readEnvFile } from '../agent/settings'
import { CONFIG, ENV_FILE, rel } from '../paths'
import type { SignalConfigGap } from '../view/types'

/** The key the token is held under, in `docs/kanban/.env`. */
export const TOKEN_KEY = 'SIGNAL_ENDPOINT_TOKEN'

/** The setting's name in `config.md`, the way every other one is written there. */
export const ENDPOINT_SETTING = 'Signal endpoint'

const LINE = /^- \*\*Signal endpoint\*\*\s*[—-]\s*(.+)$/m

const boardRel = (file: string): string => rel(file).split(path.sep).join('/')

/** The endpoint this board pulls from, or empty when it names none. A line still carrying
 *  the `<url>` placeholder counts as none: it is the shape of the setting, not a value. */
export function signalEndpoint(): string {
  let text: string
  try {
    text = fs.readFileSync(CONFIG, 'utf8')
  } catch {
    return ''
  }
  const found = (LINE.exec(text)?.[1] ?? '').trim()
  return /^https?:\/\/\S+$/.test(found) ? found : ''
}

/** The token to send, or empty when the board holds none. */
export const signalToken = (): string => readEnvFile()[TOKEN_KEY] ?? ''

/** What is still to be filled in before a fetch can run, each with the file it goes in.
 *  Empty when the board is ready to pull. */
export function signalConfigGaps(): SignalConfigGap[] {
  const gaps: SignalConfigGap[] = []
  if (!signalEndpoint()) gaps.push({ what: 'endpoint', file: boardRel(CONFIG) })
  if (!signalToken()) gaps.push({ what: 'token', file: boardRel(ENV_FILE) })
  return gaps
}

/** One line naming what a gap is and where it goes — what `akb signals fetch` prints when
 *  it refuses for want of configuration. */
export function sayGap(gap: SignalConfigGap): string {
  return gap.what === 'endpoint'
    ? `no signal endpoint — add \`- **${ENDPOINT_SETTING}** — <url>\` to ${gap.file}`
    : `no signal token — set \`${TOKEN_KEY}\` in ${gap.file}`
}
