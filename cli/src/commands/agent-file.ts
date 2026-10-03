// ---- agent-file ------------------------------------------------------------
//
// Print one file from an agent's own folder (#860), its AGENT.md included (#1308). A built-in
// agent's files ship inside the command, with no path to open — this is the door onto those.

import { findSpecAgent, specAgentNamesOnBoard } from '../lib/agents'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'

const AGENT_FILE = 'AGENT.md'

export function cmdAgentFile(askedName: string, askedFile: string): MoveResult {
  const name = askedName.trim()
  const agent = findSpecAgent(name)
  if (!agent) {
    die(`"${name}" is not an agent on this board. It has: ${specAgentNamesOnBoard().join(', ')}.`, {
      kind: 'no-such-agent',
      agent: name,
    })
  }
  const file = askedFile.trim().replace(/^\.\//, '')
  // Checked against the agent's own list, so a path that climbs out of the folder is not one.
  const offered = [AGENT_FILE, ...agent.files]
  if (!offered.includes(file)) {
    die(`the \`${agent.name}\` agent has no \`${file}\`. Its files are: ${offered.join(', ')}.`, {
      kind: 'no-such-agent-file',
      agent: agent.name,
      file,
    })
  }
  // A project agent still on the old name keeps its rules in SKILL.md.
  const text = agent.file(file) ?? (file === AGENT_FILE ? agent.file('SKILL.md') : null)
  if (text === null) die(`can't read \`${file}\` from the \`${agent.name}\` agent`, { kind: 'no-such-agent-file', agent: agent.name, file })
  say(text)
  return { agent: agent.name, file, text }
}
