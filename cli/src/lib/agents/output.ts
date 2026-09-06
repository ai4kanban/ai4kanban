// Who a spec agent's finished output is for (#445).
//
// The board's own setting, on every spec agent: an `AGENT.md` declares nothing for it, and
// an agent this project added has it too. It is drawn as one more row on the agent's page,
// first, above whatever settings the agent declares for itself.
//
// It saves under `output` inside that agent's entry in ui.config.json, which is the board's
// key the way `enabled` and `runtime` are — so no agent can declare a setting that fights
// it (../agents/parse.ts).
//
// The words never mention the card's halves. "Human review" and "Agent use" say who reads
// the output, which is the whole of what the user is choosing; where that lands on the card
// is the board's business, spelled out in `akb guide spec-agent`.

import { SPEC_OUTPUTS, type SpecAgentSetting } from '../agent/types'
import type { Language } from '../machine/types'
import type { SettingLines, SpecAgent } from './parse'

/** The key it saves under, in that agent's entry. */
export const OUTPUT_KEY = 'output'

const CHOICES: Record<string, { label: string; cost: string }> = {
  human: { label: 'Human review', cost: 'written on the card, where you see it at a glance' },
  agent: { label: 'Agent use', cost: 'kept for the agent that builds it; you never have to read it' },
}

// The row's own words in the languages the board reads (#334). An agent's `akb.i18n` can't
// carry them — the setting is not the agent's to declare — so they live here, beside the
// English, and are looked up the same way an agent's are (./index.ts).
const SAID: Record<string, SettingLines> = {
  zh: {
    label: '产出',
    choices: {
      human: { label: '给人审', cost: '直接写在卡片上，你打开就能看到' },
      agent: { label: '给 agent 用', cost: '留给实现的 agent 读，你不用过目' },
    },
  },
}

/** The row, for one agent — its default is where that agent's section starts on a card, which
 *  is the only part of it an `AGENT.md` has a say in. */
export const outputSetting = (agent: SpecAgent): SpecAgentSetting => ({
  key: OUTPUT_KEY,
  label: 'Output',
  choices: SPEC_OUTPUTS.map((value) => ({ value, ...CHOICES[value]! })),
  default: agent.output,
})

/** Every setting one agent's page draws, in that order: the board's own row, then the ones
 *  the agent declares. A `write` agent writes files rather than a card's section, so the row
 *  is not on it — it would be a choice with nothing to act on. */
export const agentSettings = (agent: SpecAgent): SpecAgentSetting[] =>
  agent.kind === 'spec' ? [outputSetting(agent), ...agent.settings] : agent.settings

/** What the row says in one language, or nothing when it is only English there. */
export const outputLines = (language: Language): SettingLines | undefined => SAID[language]
