// Telling a logged-out CLI from a ready one (#392).
//
// Two things are held here. The readings, against output copied verbatim off each CLI in
// both states — run once with the machine's own login, once under a throwaway HOME — so a
// regex written to the wrong shape is caught here rather than by a warning on somebody's
// working agent. And who gets asked at all, which is the whole of what keeps a probe off an
// agent whose login decides nothing.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { HARNESSES, harnessByName, type Harness } from '../src/lib/agent/harnesses/index.ts'
import { readLogin, toAsk } from '../src/lib/agent/login.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-login-'))
const kanban = path.join(root, 'docs', 'kanban')
const bin = path.join(root, 'bin')
const PATH = process.env.PATH

function board(config: Record<string, unknown>, env = ''): void {
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'ui.config.json'), JSON.stringify(config))
  fs.writeFileSync(path.join(kanban, '.env'), env)
  setBoardRoot(root)
}

/** A PATH holding exactly these commands, so what the machine running the tests has
 *  installed changes nothing. */
function onPath(...binaries: string[]): void {
  fs.rmSync(bin, { recursive: true, force: true })
  fs.mkdirSync(bin, { recursive: true })
  for (const name of binaries) fs.writeFileSync(path.join(bin, name), '', { mode: 0o755 })
  process.env.PATH = bin
}

const harness = (name: string): Harness => {
  const found = harnessByName(name)
  assert.ok(found, `no harness "${name}"`)
  return found
}

const asked = (): string[] => toAsk().map((one) => one.harness.name)

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
})

after(() => {
  process.env.PATH = PATH
  fs.rmSync(root, { recursive: true, force: true })
})

// What each CLI actually printed, on 2026-09-01, logged in and then logged out under a
// throwaway HOME. Copied rather than paraphrased: these are the strings the readings are
// written against, and a CLI that changes its wording should fail here first.
const SAID: Record<string, { ready: string; loggedOut: string }> = {
  'claude-code': {
    ready: '{\n  "loggedIn": true,\n  "authMethod": "claude.ai",\n  "subscriptionType": "max"\n}\n',
    loggedOut: '{\n  "loggedIn": false,\n  "authMethod": "none",\n  "apiProvider": "firstParty"\n}\n',
  },
  codex: {
    ready: 'Logged in using ChatGPT\n',
    loggedOut: 'Not logged in\n',
  },
  cursor: {
    ready: '{\n  "status": "authenticated",\n  "isAuthenticated": true,\n  "hasAccessToken": true\n}\n',
    loggedOut:
      '{\n  "status": "unauthenticated",\n  "isAuthenticated": false,\n  "message": "Not logged in"\n}\n',
  },
  opencode: {
    ready: '\u001B[0m\n┌  Credentials \u001B[90m~/.local/share/opencode/auth.json\n│\n●  Z.AI Coding Plan \u001B[90mapi\n│\n└  2 credentials\n',
    loggedOut: '\u001B[0m\n┌  Credentials \u001B[90m~/.local/share/opencode/auth.json\n│\n└  0 credentials\n',
  },
}

describe('what a probe makes of its CLI', () => {
  for (const [name, said] of Object.entries(SAID)) {
    it(`reads ${name} as ready when its CLI says it is`, () => {
      assert.equal(readLogin(harness(name), said.ready), 'ready')
    })

    it(`reads ${name} as logged out when its CLI says it is`, () => {
      assert.equal(readLogin(harness(name), said.loggedOut), 'logged-out')
    })

    it(`reads ${name} as unknown when the CLI answered something else`, () => {
      const other = harness(name)
      assert.equal(readLogin(other, ''), 'unknown')
      assert.equal(readLogin(other, `${name}: command not found\n`), 'unknown')
      assert.equal(readLogin(other, 'error: unknown option --format\n'), 'unknown')
    })
  }

  it('has a reading for every connector that declares a probe', () => {
    const declared = HARNESSES.filter((h) => h.login).map((h) => h.name).sort()
    assert.deepEqual(declared, Object.keys(SAID).sort())
  })

  it('never calls a connector without a probe logged out', () => {
    for (const one of HARNESSES.filter((h) => !h.login)) {
      assert.equal(readLogin(one, 'Not logged in\n'), 'unknown')
      assert.equal(readLogin(one, '0 credentials\n'), 'unknown')
    }
  })
})

describe('who gets asked', () => {
  it('asks every installed connector that declares a probe', () => {
    board({})
    onPath('claude', 'codex', 'cursor-agent', 'opencode')
    assert.deepEqual(asked().sort(), ['claude-code', 'codex', 'cursor', 'opencode'])
  })

  it('skips a connector whose CLI is not on the PATH', () => {
    board({})
    onPath('claude')
    assert.deepEqual(asked(), ['claude-code'])
  })

  it('skips a connector that declares no probe, however it is set up', () => {
    board({ harness: 'dsh' })
    onPath('dsh-acp', 'zcode', 'kimi')
    assert.deepEqual(asked(), [])
  })

  it('probes the binary a command override names, not the connector default', () => {
    board({ harnessSettings: { 'claude-code': { command: 'my-claude -p' } } })
    onPath('my-claude')
    assert.deepEqual(toAsk().map((one) => one.binary), ['my-claude'])
  })

  it("skips an agent whose saved setup supplies its own key", () => {
    board({ harnessSettings: { 'claude-code': { provider: 'anthropic-api' } } }, 'ANTHROPIC_API_KEY=sk-ant\n')
    onPath('claude', 'codex')
    assert.deepEqual(asked(), ['codex'])
  })

  it('skips a connector with an optional key once that key is set', () => {
    board({}, 'CURSOR_API_KEY=key_1\n')
    onPath('cursor-agent')
    assert.deepEqual(asked(), [])
  })

  it('still asks when the key belongs to a provider nobody picked', () => {
    // The subscription doesn't need the key, so a run under it never sends one: the CLI's
    // own login is what decides, and it is worth asking about.
    board({ harnessSettings: { 'claude-code': { provider: 'subscription' } } }, 'ANTHROPIC_API_KEY=sk-ant\n')
    onPath('claude')
    assert.deepEqual(asked(), ['claude-code'])
  })
})
