// What the Model box offers, and where each connector reads it from.
//
// The point of all of this is that the board keeps no list of models. What is asked here is
// that each connector reads the list its own CLI already maintains, in that CLI's own order,
// and that everything about the read is unable to hurt anybody: a missing file, a damaged
// one, or a shape nobody expected is no suggestions and never a throw, because the box works
// without them.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { HARNESSES, harnessByName } from '../src/lib/agent/harnesses/index.ts'

let home = ''
let realHome: string | undefined

const models = (name: string): string[] => harnessByName(name)?.models?.() ?? []

const write = (file: string, data: unknown): void => {
  const at = path.join(home, file)
  fs.mkdirSync(path.dirname(at), { recursive: true })
  fs.writeFileSync(at, typeof data === 'string' ? data : JSON.stringify(data))
}

beforeEach(() => {
  realHome = process.env.HOME
  // `os.homedir()` answers $HOME on this platform, which is the whole of what these readers
  // look at. The XDG pair is cleared so OpenCode's read lands in the fake home too.
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-models-'))
  process.env.HOME = home
  delete process.env.XDG_CACHE_HOME
  delete process.env.XDG_DATA_HOME
})

afterEach(() => {
  if (realHome === undefined) delete process.env.HOME
  else process.env.HOME = realHome
  fs.rmSync(home, { recursive: true, force: true })
})

describe('the models a connector offers', () => {
  it('is empty on a machine with none of these CLIs, and throws for none of them', () => {
    // Claude Code apart: its aliases are names rather than a list read off anything, so they
    // are there before its CLI is.
    for (const harness of HARNESSES) {
      if (harness.name === 'claude-code') continue
      assert.deepEqual(harness.models?.() ?? [], [], harness.name)
    }
  })

  it('survives a damaged file', () => {
    write('.codex/models_cache.json', '{ not json')
    assert.deepEqual(models('codex'), [])
  })

  it('survives a file whose shape is nothing like the one expected', () => {
    write('.codex/models_cache.json', { models: 'gpt-5' })
    write('.grok/models_cache.json', [1, 2, 3])
    assert.deepEqual(models('codex'), [])
    assert.deepEqual(models('grok'), [])
  })

  it('re-reads a file that changed', () => {
    write('.grok/models_cache.json', { models: { 'grok-4.6': {} } })
    assert.deepEqual(models('grok'), ['grok-4.6'])
    write('.grok/models_cache.json', { models: { 'grok-4.6': {}, 'grok-5': {} } })
    assert.deepEqual(models('grok'), ['grok-4.6', 'grok-5'])
  })
})

describe('Claude Code', () => {
  it('leads with the aliases, which are the answer to a model launch', () => {
    assert.deepEqual(models('claude-code'), ['opus', 'sonnet', 'haiku', 'fable'])
  })

  it('adds whatever else the login may use, after them', () => {
    write('.claude.json', {
      additionalModelOptionsCache: [{ value: 'claude-fable-5-1[1m]', label: 'Fable' }],
    })
    assert.deepEqual(models('claude-code'), ['opus', 'sonnet', 'haiku', 'fable', 'claude-fable-5-1[1m]'])
  })
})

describe('Codex', () => {
  const cache = {
    models: [
      { slug: 'gpt-5.6-sol', visibility: 'list', priority: 6 },
      { slug: 'codex-auto-review', visibility: 'hide', priority: 43 },
      { slug: 'gpt-6-astra', visibility: 'list', priority: 1 },
    ],
  }

  it('offers its cached list in Codex’s own order, without the models it hides', () => {
    write('.codex/models_cache.json', cache)
    assert.deepEqual(models('codex'), ['gpt-6-astra', 'gpt-5.6-sol'])
  })
})

describe('ZCode', () => {
  it('offers bare ids, once each, across every provider its config names', () => {
    write('.zcode/v2/config.json', {
      provider: {
        'builtin:zai': { models: { 'GLM-5.3': {}, 'GLM-5.2': {} } },
        'builtin:bigmodel': { models: { 'GLM-5.3': {} } },
      },
    })
    assert.deepEqual(models('zcode'), ['GLM-5.3', 'GLM-5.2'])
  })
})

describe('OpenCode', () => {
  const catalogue = {
    anthropic: { models: { 'claude-opus-5': {} } },
    'some-provider-nobody-here-uses': { models: { 'a-model': {} } },
  }

  it('offers provider/model, for the providers this machine has a login for', () => {
    write('.local/share/opencode/auth.json', { anthropic: { type: 'oauth' } })
    write('.cache/opencode/models.json', catalogue)
    assert.deepEqual(models('opencode'), ['anthropic/claude-opus-5'])
  })

  it('offers nothing at all when nobody is logged in', () => {
    write('.cache/opencode/models.json', catalogue)
    assert.deepEqual(models('opencode'), [])
  })

  it('follows a login added after the catalogue was cached', () => {
    write('.local/share/opencode/auth.json', { anthropic: { type: 'oauth' } })
    write('.cache/opencode/models.json', catalogue)
    assert.deepEqual(models('opencode'), ['anthropic/claude-opus-5'])
    write('.local/share/opencode/auth.json', {
      anthropic: { type: 'oauth' },
      'some-provider-nobody-here-uses': { type: 'api' },
    })
    assert.deepEqual(models('opencode'), [
      'anthropic/claude-opus-5',
      'some-provider-nobody-here-uses/a-model',
    ])
  })
})

describe('a connector whose CLI publishes no list', () => {
  it('reads nothing rather than guessing at one', () => {
    for (const name of ['cursor', 'dsh', 'kimi']) {
      assert.equal(harnessByName(name)?.models, undefined)
    }
  })
})
