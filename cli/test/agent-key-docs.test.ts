// The two written tables of `AGENT.md` keys — `akb guide write-agent` and the board UI's
// drawer — against the keys and values the parser accepts.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import uiGuide from '../../kanban-ui/public/guides/agents.md'
import cliGuide from '../src/guide/write-agent.md'
import { SPEC_OUTPUTS } from '../src/lib/agent/types.ts'
import { WORKFLOW_STAGES } from '../src/lib/agent/workflows.ts'
import { AGENT_KEYS, AGENT_KINDS } from '../src/lib/agents/parse.ts'

const sorted = (values: Iterable<string>) => [...values].sort()

describe('the board UI key table', () => {
  // One entry per `- **<key>**` bullet under `## Keys`, with its continuation lines.
  const section = uiGuide.split(/^## /m).find((part) => part.startsWith('Keys\n')) ?? ''
  const entries = new Map(
    section
      .split(/^(?=- \*\*)/m)
      .slice(1)
      .map((entry) => [/^- \*\*([^*]+)\*\*/.exec(entry)?.[1] ?? '', entry] as const),
  )
  const values = (key: string) => sorted([...(entries.get(key) ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]))

  it('lists the keys the parser reads', () => {
    assert.deepEqual(sorted([...entries.keys()].filter((key) => key !== 'description')), sorted(AGENT_KEYS))
  })

  it('names the values the parser accepts', () => {
    assert.deepEqual(values('stage'), sorted(WORKFLOW_STAGES))
    assert.deepEqual(values('kind'), sorted(AGENT_KINDS))
    assert.deepEqual(values('output'), sorted(SPEC_OUTPUTS))
  })
})

describe('akb guide write-agent', () => {
  const blocks = [...cliGuide.matchAll(/^```yaml\n([\s\S]*?)^```/gm)].map((m) => m[1].split('\n'))

  it('lists the keys the parser reads', () => {
    const keys = new Set<string>()
    for (const lines of blocks) {
      let underAkb = false
      for (const line of lines) {
        if (/^\S/.test(line)) underAkb = line === 'akb:'
        const key = /^ {2}([A-Za-z0-9_]+):/.exec(line)?.[1]
        if (underAkb && key) keys.add(key)
      }
    }
    assert.deepEqual(sorted(keys), sorted(AGENT_KEYS))
  })

  it('names the stages the parser accepts', () => {
    const lines = blocks.flat()
    // One comment line per stage above the key: `# plan: …`, `# execute: …`.
    const at = lines.findIndex((line) => line.startsWith('  stage:'))
    const stages: string[] = []
    for (let i = at - 1; i >= 0 && /^\s*#\s*\w+:/.test(lines[i]!); i--) stages.push(lines[i]!.replace(/^\s*#\s*/, '').split(':')[0]!)
    assert.deepEqual(sorted(stages), sorted(WORKFLOW_STAGES))
  })
})
