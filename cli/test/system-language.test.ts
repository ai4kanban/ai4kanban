// The language ask in each connector's own system prompt (#104), so it holds on every turn.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { splitCommand } from '../src/lib/agent/argv.ts'
import { harnessByName } from '../src/lib/agent/harnesses/index.ts'
import { SYSTEM_LANGUAGE_EN, SYSTEM_LANGUAGE_ZH, cloudLanguage, cloudPrompt, runLanguage, LANGUAGE_ENV, LANGUAGE_LINE_ENV } from '../src/lib/agent/language.ts'
import { withSystemLanguage } from '../src/lib/agent/run-settings.ts'

const ZH = 'zh' as const
const ASK = /用中文回复。给任务创建者看的用中文/

let home = ''
const saved = process.env.AI4KANBAN_HOME
const savedCodex = process.env.CODEX_HOME

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-system-'))
  process.env.AI4KANBAN_HOME = home
  process.env.CODEX_HOME = home
})

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true })
  if (savedCodex === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = savedCodex
  if (saved === undefined) delete process.env.AI4KANBAN_HOME
  else process.env.AI4KANBAN_HOME = saved
})

const told = (name: string, line: 'zh' | 'en' | null = ZH, command?: string) => {
  const harness = harnessByName(name)!
  return withSystemLanguage(harness, splitCommand(command ?? harness.command), { ...(process.env.DSH_SYSTEM_PROMPT ? { DSH_SYSTEM_PROMPT: process.env.DSH_SYSTEM_PROMPT } : {}), ...(process.env.OPENCODE_CONFIG_CONTENT ? { OPENCODE_CONFIG_CONTENT: process.env.OPENCODE_CONFIG_CONTENT } : {}) }, line)
}

describe('the language in the system prompt', () => {
  it('goes in right after the binary of every connector that takes one', () => {
    assert.deepEqual(told('claude-code').argv.slice(0, 2), ['claude', '--append-system-prompt'])
    assert.match(told('claude-code').argv[2]!, ASK)
    assert.deepEqual(told('codex').argv.slice(0, 3).slice(0, 2), ['codex', '-c'])
    assert.match(told('codex').argv[2]!, /^developer_instructions="用中文回复.*沿用项目语言。"$/)
    assert.deepEqual(told('grok').argv.slice(0, 2), ['grok', '--rules'])
    assert.equal(told('grok').argv.at(-1), 'stdio')
    const kimi = told('kimi').argv
    assert.deepEqual(kimi.slice(0, 2), ['kimi', '--agent-file'])
    assert.match(fs.readFileSync(kimi[2]!, 'utf8'), /\$\{base_prompt\}\n\n用中文回复/)
  })

  it('Node 包装命令将系统参数交给脚本，避免被 Node 当成自身参数', () => {
    const result = told('claude-code', 'en', 'node /tmp/agent.mjs -p')
    assert.deepEqual(result.argv, ['node', '/tmp/agent.mjs', '--append-system-prompt', SYSTEM_LANGUAGE_EN, '-p'])
  })

  it('rides the environment where the CLI reads it there, keeping what was there', () => {
    const dsh = told('dsh').env.DSH_SYSTEM_PROMPT!
    assert.match(dsh, /^You are a coding assistant powered by the \{\{model\}\} model/)
    assert.match(dsh, ASK)
    process.env.DSH_SYSTEM_PROMPT = 'You are Ada.'
    process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ instructions: ['/mine.md'], username: 'me' })
    try {
      assert.match(told('dsh').env.DSH_SYSTEM_PROMPT!, /^You are Ada\.\n\n用中文回复/)
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
      ['claude-code', 'claude -p --resume old'],
      ['claude-code', 'claude -p --resume old --system-prompt-snapshot on'],
      ['claude-code', 'claude -p --continue'],
      ['codex', 'codex exec -c developer_instructions=mine'],
      ['grok', 'grok --rules mine agent stdio'],
      ['kimi', 'kimi --session s1 -p'],
      ['dsh', 'dsh-acp --persona mine'],
      ['cursor', undefined],
      ['zcode', undefined],
    ] as const) {
      const harness = harnessByName(name)!
      const argv = splitCommand(command ?? harness.command)
      const { note, ...result } = told(name, ZH, command)
      assert.deepEqual(result, { argv, env: {} }, name)
      assert.match(note!, /语言规则未能更新/)
    }
  })

  it('子运行替换继承规则，空值清除继承注入，保留用户系统内容', () => {
    for (const name of ['dsh', 'opencode']) {
      const harness = harnessByName(name)!
      const argv = splitCommand(harness.command)
      const env = name === 'dsh' ? { DSH_SYSTEM_PROMPT: '用户规则' } : { OPENCODE_CONFIG_CONTENT: '{"instructions":["/mine.md"]}' }
      const zh = withSystemLanguage(harness, argv, env, 'zh')
      const en = withSystemLanguage(harness, argv, zh.env, 'en')
      const again = withSystemLanguage(harness, argv, en.env, 'en')
      assert.deepEqual(again, en)
      if (name === 'dsh') {
        assert.equal(en.env.DSH_SYSTEM_PROMPT, `用户规则\n\n${SYSTEM_LANGUAGE_EN}`)
      } else {
        const instructions = JSON.parse(en.env.OPENCODE_CONFIG_CONTENT!).instructions
        assert.equal(instructions.length, 2)
        assert.equal(instructions[0], '/mine.md')
        assert.equal(fs.readFileSync(instructions[1], 'utf8').trim(), SYSTEM_LANGUAGE_EN)
      }
      assert.deepEqual(withSystemLanguage(harness, argv, en.env, null).env, env)
    }
  })

  it('保留 Codex 配置中的自设系统指令并提示限制', () => {
    fs.writeFileSync(path.join(home, 'config.toml'), 'developer_instructions = "用户规则"')
    const result = told('codex')
    assert.match(result.note!, /语言规则未能更新/)
    assert.ok(!result.argv.some(arg => arg.includes(SYSTEM_LANGUAGE_ZH)))
  })

  it('不同语言的指令文件互不覆盖', () => {
    for (const name of ['kimi', 'opencode']) {
      const zh = told(name, 'zh')
      const en = told(name, 'en')
      const file = name === 'kimi' ? zh.argv[2]! : JSON.parse(zh.env.OPENCODE_CONFIG_CONTENT!).instructions[0]
      const other = name === 'kimi' ? en.argv[2]! : JSON.parse(en.env.OPENCODE_CONFIG_CONTENT!).instructions[0]
      assert.notEqual(file, other)
      assert.ok(fs.readFileSync(file, 'utf8').includes(SYSTEM_LANGUAGE_ZH))
      assert.ok(fs.readFileSync(other, 'utf8').includes(SYSTEM_LANGUAGE_EN))
    }
  })

  it('按语言代码仅注入对应常量，空值不注入', () => {
    assert.equal(told('claude-code', 'en').argv[2], SYSTEM_LANGUAGE_EN)
    assert.equal(told('claude-code', 'zh').argv[2], SYSTEM_LANGUAGE_ZH)
    assert.deepEqual(told('dsh', null).env, {})
  })

  it('续跑采用当前系统规则，不支持更新时保留会话并提示', () => {
    assert.equal(told('claude-code', 'en', 'claude -p --resume old --system-prompt-snapshot off').argv[2], SYSTEM_LANGUAGE_EN)
    assert.match(told('kimi', 'en', 'kimi --session old -p').note!, /could not be updated/)
  })

  it('只替换末尾已知平台段落，保留引用、用户内容及未知规则（#379）', () => {
    const harness = harnessByName('dsh')!
    const argv = splitCommand(harness.command)
    const old = [
      '无论对话里的卡片、代码和贴进来的内容是什么语言，回复和写下的内容都用中文。代码、命令、文件名和字段名保持原文。',
      '对话和解释使用中文；产物使用用户明确指定的语言，否则使用所属 agent 明确指定的语言，均未指定时使用中文。代码、命令、文件名和字段名保持原文。',
      'Use English for conversation and explanations. For artifacts, use the language explicitly specified by the user, otherwise the responsible agent, otherwise English. Keep code, commands, filenames, and field names unchanged.',
    ]
    for (const text of old) {
      const body = `用户引用：\n> ${text}\n\n${text}\n\n用户规则`
      const env = { DSH_SYSTEM_PROMPT: `${body}\n\n${text}\n\n${SYSTEM_LANGUAGE_ZH}\n\n${SYSTEM_LANGUAGE_EN}` }
      for (const language of ['zh', 'en', null] as const) {
        const result = withSystemLanguage(harness, argv, env, language)
        const suffix = language === 'zh' ? SYSTEM_LANGUAGE_ZH : language === 'en' ? SYSTEM_LANGUAGE_EN : ''
        assert.equal(result.env.DSH_SYSTEM_PROMPT, [body, suffix].filter(Boolean).join('\n\n'))
      }
      const unknown = { DSH_SYSTEM_PROMPT: `${body}\n\n${text}\n\n未知语言规则` }
      assert.deepEqual(withSystemLanguage(harness, argv, unknown, null).env, unknown)
    }
  })

  it('Cloud 代码和明确空值优先于旧环境变量及本机设置', () => {
    const saved = [process.env[LANGUAGE_ENV], process.env[LANGUAGE_LINE_ENV]]
    try {
      process.env[LANGUAGE_LINE_ENV] = '请用中文回复和写作。'
      assert.equal(runLanguage(), 'zh')
      process.env[LANGUAGE_ENV] = 'en'
      assert.equal(runLanguage(), 'en')
      process.env[LANGUAGE_ENV] = ''
      assert.equal(runLanguage(), null)
    } finally {
      for (const [index, key] of [LANGUAGE_ENV, LANGUAGE_LINE_ENV].entries()) {
        if (saved[index] === undefined) delete process.env[key]
        else process.env[key] = saved[index]
      }
    }
  })

  it('仅剥离旧 Cloud 自动追加的末尾行，保留用户正文与引用', () => {
    for (const [line, language] of [['请用中文回复和写作。', 'zh'], ['Reply and write in English.', 'en']] as const) {
      const prompt = `用户引用：\n> ${line}\n\n${line}`
      const old = { prompt: `${prompt}\n\n${line}`, languageLine: line }
      assert.equal(cloudLanguage(old), language)
      assert.equal(cloudPrompt(old), prompt)
      assert.equal(cloudPrompt({ prompt: line, languageLine: line }), '')
      assert.equal(cloudPrompt({ ...old, language: null }), old.prompt)
      assert.equal(cloudLanguage({ ...old, language: null }), null)
      assert.equal(cloudLanguage({ ...old, test: true }), null)
      for (const flags of [{ test: true }, { flow: {} }, { review: {} }, { agent: {} }]) {
        assert.equal(cloudPrompt({ ...old, ...flags }), old.prompt)
      }
      assert.equal(cloudPrompt({ prompt, languageLine: '' }), prompt)
    }
    for (const line of ['其他语言规则', 'toString']) {
      assert.equal(cloudLanguage({ prompt: '', languageLine: line }), null)
      assert.equal(cloudPrompt({ prompt: `正文\n\n${line}`, languageLine: line }), `正文\n\n${line}`)
    }
  })
})
