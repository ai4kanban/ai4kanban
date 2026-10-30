// The language ask in each connector's own system prompt (#104), so it holds on every turn.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { splitCommand } from '../src/lib/agent/argv.ts'
import { harnessByName } from '../src/lib/agent/harnesses/index.ts'
import { withSystemLanguage } from '../src/lib/agent/run-settings.ts'

const ZH = '请用中文回复和写作。'
const ASK = /都用中文。代码、命令、文件名和字段名保持原文。/

let home = ''
const saved = process.env.AI4KANBAN_HOME

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-system-'))
  process.env.AI4KANBAN_HOME = home
})

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true })
  if (saved === undefined) delete process.env.AI4KANBAN_HOME
  else process.env.AI4KANBAN_HOME = saved
})

const told = (name: string, line = ZH, command?: string) => {
  const harness = harnessByName(name)!
  return withSystemLanguage(harness, splitCommand(command ?? harness.command), {}, line)
}

describe('the language in the system prompt', () => {
  it('goes in right after the binary of every connector that takes one', () => {
    assert.deepEqual(told('claude-code').argv.slice(0, 2), ['claude', '--append-system-prompt'])
    assert.match(told('claude-code').argv[2]!, ASK)
    assert.deepEqual(told('codex').argv.slice(0, 3).slice(0, 2), ['codex', '-c'])
    assert.match(told('codex').argv[2]!, /^developer_instructions="无论.*保持原文。"$/)
    assert.deepEqual(told('grok').argv.slice(0, 2), ['grok', '--rules'])
    assert.equal(told('grok').argv.at(-1), 'stdio')
    const kimi = told('kimi').argv
    assert.deepEqual(kimi.slice(0, 2), ['kimi', '--agent-file'])
    assert.match(fs.readFileSync(kimi[2]!, 'utf8'), /\$\{base_prompt\}\n\n无论/)
  })

  it('rides the environment where the CLI reads it there, keeping what was there', () => {
    const dsh = told('dsh').env.DSH_SYSTEM_PROMPT!
    assert.match(dsh, /^You are a coding assistant powered by the \{\{model\}\} model/)
    assert.match(dsh, ASK)
    process.env.DSH_SYSTEM_PROMPT = 'You are Ada.'
    process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ instructions: ['/mine.md'], username: 'me' })
    try {
      assert.match(told('dsh').env.DSH_SYSTEM_PROMPT!, /^You are Ada\.\n\n无论/)
      const config = JSON.parse(told('opencode').env.OPENCODE_CONFIG_CONTENT!)
      assert.equal(config.username, 'me')
      assert.equal(config.instructions[0], '/mine.md')
      assert.ok(config.instructions[1].startsWith(home))
      assert.match(fs.readFileSync(config.instructions[1], 'utf8'), ASK)
    } finally {
      delete process.env.DSH_SYSTEM_PROMPT
      delete process.env.OPENCODE_CONFIG_CONTENT
    }
  })

  it('leaves alone a flag the user set, a resumed Kimi session, and a connector with no way in', () => {
    for (const [name, command] of [
      ['claude-code', 'claude -p --append-system-prompt mine'],
      ['codex', 'codex exec -c developer_instructions=mine'],
      ['grok', 'grok --rules mine agent stdio'],
      ['kimi', 'kimi --session s1 -p'],
      ['dsh', 'dsh-acp --persona mine'],
      ['cursor', undefined],
      ['zcode', undefined],
    ] as const) {
      const harness = harnessByName(name)!
      const argv = splitCommand(command ?? harness.command)
      assert.deepEqual(told(name, ZH, command), { argv, env: {} }, name)
    }
  })

  it('changes nothing in English', () => {
    for (const line of ['', 'Reply and write in English.']) {
      const argv = splitCommand(harnessByName('claude-code')!.command)
      assert.deepEqual(told('claude-code', line), { argv, env: {} })
      assert.deepEqual(told('dsh', line).env, {})
    }
  })

  it("passes on another line as it is, so Cloud's own languages still reach it", () => {
    assert.equal(told('claude-code', 'Responde y escribe en español.').argv[2], 'Responde y escribe en español.')
  })
})
