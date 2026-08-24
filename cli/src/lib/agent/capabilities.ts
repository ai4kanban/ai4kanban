// What one connector can do that another one can't.
//
// Every agent the board runs answers the same commands, but not with the same things: one
// names the model that did the work and another never does, one lets go of a card the moment
// it is rate-limited and the rest hold it. None of that is a fault — it is what those CLIs
// report and what their flags allow — but it changes what the board can show, so it is said
// where the agent is picked rather than found out on a run.
//
// A capability is DERIVED wherever the harness already answers it (`resumes`,
// `adoptsSessionId`, `skillCall`), and read from a field declared for it only where nothing
// existing could (`reports`, `stopsOnRateLimit`). One answer per capability, so a connector
// can't claim one thing here and do another on a run.
//
// Adding a capability is one entry in the list below. Nothing outside this file learns a
// connector's name: the gaps go out on `HarnessOption`, and every screen draws whatever it
// is handed.

import { SKILL_SENTENCE, type Harness } from './harnesses'
import type { HarnessGap } from './types'

interface Capability extends HarnessGap {
  /** True when this connector has it. */
  has(harness: Harness): boolean
}

// A label short enough to scan and a consequence short enough to read at a glance — what
// the user loses, never why the CLI is that way. Both are read side by side on one line, so
// neither wraps: keep the label under ~20 characters and the line under ~60.
const CAPABILITIES: Capability[] = [
  {
    id: 'resume',
    label: 'Chat and resume',
    blurb: 'No conversations, and a session that stops short starts over.',
    has: (h) => h.resumes,
  },
  {
    id: 'early-resume',
    label: 'Early-crash resume',
    blurb: 'A session that fails in its first seconds starts over.',
    has: (h) => h.adoptsSessionId,
  },
  {
    id: 'cost',
    label: 'Run cost',
    blurb: 'No price in the runs panel.',
    has: (h) => h.reports.includes('cost'),
  },
  {
    id: 'tokens',
    label: 'Token counts',
    blurb: 'No token numbers in the runs panel.',
    has: (h) => h.reports.includes('tokens'),
  },
  {
    id: 'model',
    label: 'Model name',
    blurb: 'The runs panel shows no model.',
    has: (h) => h.reports.includes('model'),
  },
  {
    id: 'rate-limit',
    label: 'Rate-limit exit',
    blurb: 'A rate-limited session waits it out, holding its card.',
    has: (h) => h.stopsOnRateLimit,
  },
  {
    id: 'skill-call',
    label: 'Direct skill call',
    blurb: 'Prompts ask for the board skill in a sentence.',
    has: (h) => h.skillCall !== SKILL_SENTENCE,
  },
]

/** What this connector can't do that another on the list can, in the order above. Empty for
 *  one that lacks nothing. */
export function harnessGaps(harness: Harness): HarnessGap[] {
  return CAPABILITIES.filter((c) => !c.has(harness)).map(({ id, label, blurb }) => ({ id, label, blurb }))
}
