// `user-docs` was folded into `copywriting` (#1582): what a board saved for it joins
// copywriting's own, once, and nothing copywriting already had is overwritten.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { readRule } from '../src/lib/agent/rules.ts'
import { foldedSettingsNotes } from '../src/lib/agent/settings.ts'
import { readAgentMemory } from '../src/lib/memory.ts'
import { AGENT_MEMORY, RULES, setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-fold-'))

after(() => fs.rmSync(root, { recursive: true, force: true }))

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  setBoardRoot(root)
  fs.mkdirSync(RULES, { recursive: true })
})

const write = (file: string, text: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

describe('folding `user-docs` into `copywriting`', () => {
  it('appends its rule to the one copywriting has, once', () => {
    write(path.join(RULES, 'copywriting.md'), 'Keep it short.\n')
    write(path.join(RULES, 'user-docs.md'), 'Task first.\n')
    assert.equal(readRule('copywriting'), 'Keep it short.\n\nTask first.')
    assert.equal(fs.existsSync(path.join(RULES, 'user-docs.md')), false)
    write(path.join(RULES, 'user-docs.md'), 'Task first.\n')
    assert.equal(readRule('copywriting'), 'Keep it short.\n\nTask first.')
  })

  it('moves its rule over when copywriting has none', () => {
    write(path.join(RULES, 'user-docs.md'), 'Task first.\n')
    assert.equal(readRule('copywriting'), 'Task first.')
  })

  it('adds its notes under a Docs heading, keeping what copywriting wrote', () => {
    write(path.join(AGENT_MEMORY, 'copywriting', 'writing.md'), '- Say "board".\n')
    write(path.join(AGENT_MEMORY, 'user-docs', 'writing.md'), '- Steps before reasons.\n')
    const text = readAgentMemory('copywriting').find((m) => m.name === 'writing.md')!.text
    assert.equal(text, '- Say "board".\n\n## Docs\n\n- Steps before reasons.')
    assert.equal(fs.existsSync(path.join(AGENT_MEMORY, 'user-docs')), false)
    write(path.join(AGENT_MEMORY, 'user-docs', 'writing.md'), '- Steps before reasons.\n')
    assert.equal(readAgentMemory('copywriting').find((m) => m.name === 'writing.md')!.text, text)
  })

  it("uses copywriting's settings, and says so only when the two differ", () => {
    write(UI_CONFIG, JSON.stringify({ agentRuntime: { 'user-docs': 'fast' } }))
    assert.deepEqual(foldedSettingsNotes('copywriting'), [])
    write(UI_CONFIG, JSON.stringify({ agentRuntime: { copywriting: 'slow', 'user-docs': 'fast' } }))
    assert.equal(foldedSettingsNotes('copywriting').length, 1)
    assert.match(foldedSettingsNotes('copywriting')[0]!, /`copywriting`'s are used/)
    write(UI_CONFIG, JSON.stringify({ agentRuntime: { copywriting: 'fast', 'user-docs': 'fast' } }))
    assert.deepEqual(foldedSettingsNotes('copywriting'), [])
  })
})
