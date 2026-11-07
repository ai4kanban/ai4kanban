// The written table of `AGENT.md` keys — `akb guide write-agent` — against the keys and
// values the parser accepts.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import cliGuide from '../src/guide/write-agent.md'
import { AGENT_KEYS } from '../src/lib/agents/parse.ts'

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
})
