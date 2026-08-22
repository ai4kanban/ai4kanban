// The agents the board can run. One file per agent beside this one, and this list is the
// whole of what the rest of the CLI sees — nothing outside this folder learns an agent's
// name. What a harness declares, and what a new file has to answer, is in ./types.

import { checkHarnesses } from './check'
import { CLAUDE_CODE } from './claude-code'
import { CODEX } from './codex'
import { CURSOR } from './cursor'
import { DSH } from './dsh'
import { OPENCODE } from './opencode'
import type { Harness } from './types'
import { ZCODE } from './zcode'

export { SKILL_SENTENCE, namesFlag, type Harness } from './types'

/** Every agent the board can run, in the order they are listed. */
export const HARNESSES: Harness[] = [CLAUDE_CODE, CODEX, CURSOR, OPENCODE, DSH, ZCODE]

/** What runs when the config names no agent, or names one we don't know. */
export const DEFAULT_HARNESS = CLAUDE_CODE

export function harnessByName(name: string | undefined): Harness | undefined {
  return HARNESSES.find((h) => h.name === name)
}

checkHarnesses(HARNESSES)
