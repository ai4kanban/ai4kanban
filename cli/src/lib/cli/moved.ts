// Where a word that used to be a command went.
//
// The commands were regrouped under the thing each one acts on — `akb refine 12` is
// `akb card refine 12` — and none of the old spellings was kept as an alias. Commander's
// own "did you mean" only looks at the words beside the one typed, so it cannot see that
// `refine` is still here, one level down. This table can, and says so in one line.
//
// It is not a fallback: nothing runs. It only answers the question the refusal raises.

import { FLOWS, flowPath } from '../agent/flows'

/** The old word, and the line to type now. Built from the flows themselves so a flow that
 *  moves again brings its own answer with it. */
export const MOVED: Record<string, string> = {
  ...Object.fromEntries(FLOWS.filter((flow) => flow.group).map((flow) => [flow.command, flowPath(flow)])),
  runs: 'run list',
  log: 'run log',
  stop: 'run stop',
  resume: 'run resume',
  cancel: 'delivery cancel',
  discard: 'delivery discard',
  approve: 'delivery approve',
  board: 'raw',
  // Not part of the regrouping: `version` was a command until the tree became one
  // Commander program, and it is what INSTALL_PROMPT tells a first-time reader to run.
  version: '--version',
}

/** The whole refusal for a word that used to be a command, or '' when it never was. It
 *  REPLACES Commander's own line rather than following it: Commander guesses at the nearest
 *  word beside the one typed, which here is a guess next to a known answer — and sometimes a
 *  wrong one, `board` being read as `card`. */
export function movedTo(word: string, program: string): string {
  const now = MOVED[word]
  return now ? `\`${program} ${word}\` is now \`${program} ${now}\`.` : ''
}

/** The word a Commander refusal was about — `unknown command 'refine'`. */
export function unknownWord(message: string): string {
  return /unknown command '([^']+)'/.exec(message)?.[1] ?? ''
}
