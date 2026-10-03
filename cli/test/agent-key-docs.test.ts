// The written table of `AGENT.md` keys — `akb guide write-agent` — against the keys and
// values the parser accepts.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import cliGuide from '../src/guide/write-agent.md'
import { WORKFLOW_STAGES } from '../src/lib/agent/workflows.ts'
import { AGENT_KEYS, SCHEDULE_HOOK } from '../src/lib/agents/parse.ts'

// What `akb.hook` takes: a stage, or the cadence that is none (#1401).
const HOOK_VALUES = [...WORKFLOW_STAGES, SCHEDULE_HOOK]

const sorted = (values: Iterable<string>) => [...values].sort()

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
    // One comment line per value above the key: `# plan: …`, `# execute: …`, `# schedule: …`.
    const at = lines.findIndex((line) => line.startsWith('  hook:'))
    const stages: string[] = []
    for (let i = at - 1; i >= 0 && /^\s*#\s*\w+:/.test(lines[i]!); i--) stages.push(lines[i]!.replace(/^\s*#\s*/, '').split(':')[0]!)
    assert.deepEqual(sorted(stages), sorted(HOOK_VALUES))
  })
})
