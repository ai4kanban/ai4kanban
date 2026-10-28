// ---- rule ------------------------------------------------------------------
//
// The one door a board's rules are written through (#420).
//
// A rule belongs to an AGENT — a role the board ships, or a specialist a card asks for —
// and is appended to the end of every run that agent does. Setting one used to be the board
// UI's alone, one row per flow; this is the same write, keyed the way the rules now are.

import fs from 'node:fs'
import path from 'node:path'

import { say } from '../lib/io'
import { die, rel, RULES } from '../lib/paths'
import { agentRoster } from '../lib/agent/roles'
import { notOnTheRoster, setAgentRule } from '../lib/agent/rules'
import type { MoveResult } from '../lib/types'

/** `akb raw rule`, as its command declares it (lib/cli/board.ts). */
export interface RuleOptions {
  file?: string
  text?: string
}

export function cmdRule(askedName: string, flags: RuleOptions): MoveResult {
  const agent = askedName.trim()
  if (!agentRoster().some((a) => a.name === agent)) {
    die(notOnTheRoster(askedName), { kind: 'no-such-agent', agent: askedName })
  }
  const rule = readRuleText(flags.file, flags.text)
  const res = setAgentRule(agent, rule)
  if (!res.ok) die(res.error!)

  const file = rel(path.join(RULES, `${agent}.md`))
  say(rule ? `wrote the \`${agent}\` rule (${file})` : `cleared the \`${agent}\` rule`)
  return { agent, file, cleared: !rule }
}

// The rule, from a file or straight off the command line. A file is what a flow uses: a rule
// is markdown, and a shell eats markdown. Either one empty clears the rule.
function readRuleText(file: string | undefined, text: string | undefined): string {
  if (file !== undefined && text !== undefined) die('pass --file or --text, not both')
  if (file !== undefined) {
    try {
      return fs.readFileSync(file, 'utf8').trim()
    } catch {
      die(`can't read ${file} — write the rule to a file, then pass its path`)
    }
  }
  if (text !== undefined) return text.trim()
  die('the rule has to come from somewhere: --file <path>, --text "..." for a one-liner, or --text "" to clear it')
}
