// The agents the board can run. One file per agent beside this one, and this list is the
// whole of what the rest of the CLI sees — nothing outside this folder learns an agent's
// name. What a harness declares, and what a new file has to answer, is in ./types.

import { checkHarnesses } from './check'
import { CLAUDE_CODE } from './claude-code'
import { CODEX } from './codex'
import { CURSOR } from './cursor'
import { DSH } from './dsh'
import { KIMI } from './kimi'
import { OPENCODE } from './opencode'
import { RAW_ARGS, type Harness } from './types'
import { ZCODE } from './zcode'

export { SKILL_SENTENCE, RAW_ARGS_KEY, namesFlag, type Harness } from './types'

// The raw arguments are every harness's, added here rather than written into each file: it
// is the same setting on all of them, and one that only some carried would be a gap nobody
// could explain. It goes last, under the settings the connector has words for.
const withRawArgs = (harness: Harness): Harness => ({
  ...harness,
  settings: [...harness.settings, RAW_ARGS],
})

/** Every agent the board can run, in the order they are listed. */
export const HARNESSES: Harness[] = [CLAUDE_CODE, CODEX, CURSOR, OPENCODE, KIMI, DSH, ZCODE].map(withRawArgs)

/** What runs when the config names no agent, or names one we don't know. */
export const DEFAULT_HARNESS = HARNESSES[0]!

export function harnessByName(name: string | undefined): Harness | undefined {
  return HARNESSES.find((h) => h.name === name)
}

checkHarnesses(HARNESSES)
