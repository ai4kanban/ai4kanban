// The blank `docs/kanban/config.md`, shipped inside the command.
//
// It used to be a third file in the installed skill folder, copied into every project
// beside SKILL.md and kanban.mjs. It isn't a file a project needs a copy of: `init` reads
// it once to seed the board's own config, and the repair step reads it to spot a setting
// this release added. So it lives here, inlined into the built file by the same `.md`
// loader the flows use (see lib/guide.ts) — which leaves the installed folder at exactly
// two files: the short note, and the command itself.

import template from '../templates/config.md'
import marketing from '../templates/config-marketing.md'

import type { Solution } from './solution'

export const CONFIG_TEMPLATE = template

/** The blank config for one solution — the marketing board's names its solution, and its
 *  planning sources are the product board's memory rather than the codebase (#407). */
export const configTemplateFor = (name: Solution): string => (name === 'marketing' ? marketing : template)

// A setting a newer release added that the board's own config has never heard of. Both
// files list their settings the same way — `- **Name** — …` — so the names are the
// comparison. Naming them is all a script can do; the value is the user's to choose.
const SETTING = /^- \*\*(.+?)\*\*/gm

export function missingConfigKeys(current: string): string[] {
  const keys = (text: string): string[] => [...text.matchAll(SETTING)].map((m) => m[1]!)
  const have = keys(current)
  return keys(CONFIG_TEMPLATE).filter((k) => !have.includes(k))
}
