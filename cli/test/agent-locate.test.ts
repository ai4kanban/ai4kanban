// Every connector finds its CLI wherever it was installed and runs the newest copy that starts,
// and all of them answer the same way (#131).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { HARNESSES, harnessByName } from '../src/lib/agent/harnesses/index.ts'
import { compareVersions, locate, pick, spawnName, versionIn, warm, type Copy } from '../src/lib/agent/locate.ts'
import { agentInfo, commandOf, openPlan, planRun } from '../src/lib/agent/resolve.ts'
import { forgetMachineState } from './helpers/board.ts'

const OUTPUT = [
  ['claude-code', '2.1.314 (Claude Code)', '2.1.314'],
  ['codex', 'codex-cli 0.132.0', '0.132.0'],
  ['cursor', '2026.10.01-e373342', '2026.10.01-e373342'],
  ['opencode', '1.18.30', '1.18.30'],
  ['kimi', '2.4.0', '2.4.0'],
  ['dsh', '@openma/deepseek-harness-acp 0.4.14', '0.4.14'],
  ['zcode', 'zcode-app-cli 3.14.4-29\nzcode-runtime 0.16.9', '3.14.4-29'],
  ['grok', 'grok 1.0.70 (f50904eaee6c) [stable]', '1.0.70'],
] as const

const copy = (file: string, version: string | null, extra: Partial<Copy> = {}): Copy => ({ file, version, entry: false, starts: true, ...extra })

describe('reading a version', () => {
  for (const [name, output, version] of OUTPUT) {
    it(`reads ${name}`, () => assert.equal(versionIn(output), version))
  }

  it('names every connector', () => assert.deepEqual(OUTPUT.map(([name]) => name).sort(), HARNESSES.map((h) => h.name).sort()))

  it('reads nothing from output without a version', () => assert.equal(versionIn('usage: claude [options]'), null))
})

describe('comparing versions', () => {
  it('compares numbers, not text', () => {
    assert.ok(compareVersions('0.10.0', '0.9.0')! > 0)
    assert.ok(compareVersions('2026.10.01', '2026.09.28')! > 0)
    assert.equal(compareVersions('1.2', '1.2.0'), 0)
  })

  it('compares a ZCode revision with another', () => assert.ok(compareVersions('3.14.4-29', '3.14.4-9')! > 0))

  it('puts a pre-release before its release', () => {
    assert.ok(compareVersions('1.2.0', '1.2.0-beta.1')! > 0)
    assert.ok(compareVersions('1.2.0-rc.2', '1.2.0-rc.1')! > 0)
  })

  it('refuses what it cannot order', () => {
    assert.equal(compareVersions('2026.10.01-e373342', '2026.10.01-abc1234'), null)
    assert.equal(compareVersions('3.14.4-29', '3.14.4'), null)
    assert.equal(compareVersions('1.0.0-beta', '1.0.0-rc'), null)
  })
})

describe('picking a copy', () => {
  it('takes the newest copy over the entry', () => {
    assert.equal(pick([copy('a', '1.0.0', { entry: true }), copy('b', '2.0.0')])?.file, 'b')
  })

  it('stays on the entry for a tie', () => {
    assert.equal(pick([copy('b', '1.0.0'), copy('a', '1.0.0', { entry: true })])?.file, 'a')
  })

  it('stays on the entry when a version is unread or incomparable', () => {
    assert.equal(pick([copy('a', '1.0.0', { entry: true }), copy('b', null), copy('c', '9.0.0')])?.file, 'a')
    assert.equal(pick([copy('a', '1.0-abc', { entry: true }), copy('b', '1.0-def')])?.file, 'a')
  })

  it('falls past a copy that cannot start', () => {
    assert.equal(pick([copy('a', null, { entry: true, starts: false }), copy('b', '1.0.0'), copy('c', '2.0.0', { starts: false })])?.file, 'b')
  })

  it('still names a copy when none starts', () => {
    assert.equal(pick([copy('b', null, { starts: false }), copy('a', null, { entry: true, starts: false })])?.file, 'a')
    assert.equal(pick([]), null)
  })
})

describe('locating a CLI', { skip: process.platform === 'win32' }, () => {
  const pathOnly = process.env.AI4KANBAN_PATH_ONLY
  const CLAUDE = harnessByName('claude-code')!
  const CODEX = harnessByName('codex')!
  const held = { PATH: process.env.PATH, HOME: process.env.HOME, AI4KANBAN_HOME: process.env.AI4KANBAN_HOME, NVM_DIR: process.env.NVM_DIR, CODEX_CLI_PATH: process.env.CODEX_CLI_PATH }
  let root = ''

  const script = (at: string, version: string, tail = '') => {
    fs.mkdirSync(path.dirname(at), { recursive: true })
    fs.writeFileSync(at, `#!/bin/sh\n[ "$1" = --version ] && { echo "${version}"; exit 0; }\n${tail}\n`, { mode: 0o755 })
    return at
  }
  const broken = (at: string) => {
    fs.mkdirSync(path.dirname(at), { recursive: true })
    fs.writeFileSync(at, '#!/bin/sh\necho nope >&2\nexit 127\n', { mode: 0o755 })
    return at
  }
  const nvm = (version: string, name: string) => path.join(root, '.nvm', 'versions', 'node', version, 'bin', name)
  const board = (settings: Record<string, string> = {}, harness = 'claude-code') =>
    fs.writeFileSync(path.join(root, 'docs/kanban/ui.config.json'), JSON.stringify({ runtimes: [{ id: 'global', name: 'Global default', harness, settings }] }))

  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-locate-')))
    forgetMachineState(root)
    process.env.HOME = root
    process.env.AI4KANBAN_HOME = path.join(root, 'home')
    process.env.PATH = path.join(root, 'bin')
    delete process.env.NVM_DIR
    delete process.env.AI4KANBAN_PATH_ONLY
    delete process.env.CODEX_CLI_PATH
    setBoardRoot(root)
    setBoardProvider(null)
    fs.mkdirSync(path.join(root, 'docs/kanban/todo'), { recursive: true })
    fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '1\n')
    fs.writeFileSync(path.join(root, 'docs/kanban/todo/README.md'), '# Tasks\n')
    board()
  })

  afterEach(() => {
    process.env.AI4KANBAN_PATH_ONLY = pathOnly
    for (const [key, value] of Object.entries(held)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('runs the newest copy, from a Node version manager', () => {
    script(path.join(root, 'bin', 'claude'), '1.0.0')
    const newer = script(nvm('v24.0.0', 'claude'), '2.0.0 (Claude Code)')
    script(nvm('v20.0.0', 'claude'), '1.5.0 (Claude Code)')
    assert.equal(locate(CLAUDE)?.file, newer)
    assert.equal(openPlan(planRun('s1', root)).argv[0], newer)
  })

  it('uses a copy the PATH has never heard of', () => {
    const only = script(path.join(root, '.claude', 'local', 'claude'), '1.0.0')
    assert.ok(commandOf({}, CLAUDE).replaceAll('"', '').startsWith(`${only} `))
    assert.equal(agentInfo().options.find((o) => o.name === 'claude-code')?.installed, true)
    assert.equal(agentInfo().options.find((o) => o.name === 'claude-code')?.version, '1.0.0')
  })

  it('reads every installer folder, keeping the two highest versions', () => {
    const versions = path.join(root, '.local', 'share', 'claude', 'versions')
    script(path.join(versions, '2.1.9'), '2.1.9')
    script(path.join(versions, '2.1.10'), '2.1.10')
    assert.equal(locate(CLAUDE)?.file, path.join(versions, '2.1.10'))
  })

  it('finds nothing where nothing is installed', () => {
    assert.equal(locate(CLAUDE), null)
    assert.equal(spawnName(locate(CLAUDE), 'claude'), 'claude')
    assert.equal(agentInfo().options.find((o) => o.name === 'claude-code')?.installed, false)
  })

  it('stays on the PATH copy when another will not say its version', () => {
    script(path.join(root, 'bin', 'claude'), '1.0.0')
    script(nvm('v24.0.0', 'claude'), 'no version here')
    assert.equal(locate(CLAUDE)?.entry, true)
    assert.equal(commandOf({}, CLAUDE), CLAUDE.command)
  })

  it('moves past a newest copy that cannot start, and a broken entry', () => {
    broken(path.join(root, 'bin', 'claude'))
    broken(nvm('v24.0.0', 'claude'))
    const good = script(nvm('v20.0.0', 'claude'), '1.0.0')
    assert.equal(locate(CLAUDE)?.file, good)
  })

  it('tells the log which copy took over from a broken entry', () => {
    broken(path.join(root, 'bin', 'claude'))
    const good = script(nvm('v20.0.0', 'claude'), '1.0.0')
    const active = openPlan(planRun('s1', root))
    assert.equal(active.argv[0], good)
    assert.equal(active.startNote, `The claude on your PATH can't start, so this run uses ${good}.`)
  })

  it('leaves a command naming a path or another binary alone', () => {
    const newer = script(nvm('v24.0.0', 'claude'), '9.0.0')
    const mine = script(path.join(root, 'mine', 'claude'), '1.0.0')
    board({ command: `${mine} -p` })
    assert.equal(commandOf({ command: `${mine} -p` }, CLAUDE), `${mine} -p`)
    assert.equal(openPlan(planRun('s1', root)).argv[0], mine)
    assert.equal(commandOf({ command: 'ccr code' }, CLAUDE), 'ccr code')
    assert.notEqual(newer, mine)
  })

  it('keeps a bare hand-written command on the located copy, its flags as written', () => {
    const newer = script(nvm('v24.0.0', 'claude'), '9.0.0')
    assert.equal(commandOf({ command: 'claude -p --mine' }, CLAUDE), `${newer} -p --mine`)
  })

  it('lets CODEX_CLI_PATH stand against a newer copy', () => {
    script(path.join(root, 'bin', 'codex'), 'codex-cli 9.0.0')
    process.env.CODEX_CLI_PATH = script(path.join(root, 'mine', 'codex'), 'codex-cli 1.0.0')
    assert.equal(locate(CODEX)?.file, process.env.CODEX_CLI_PATH)
  })

  it('starts each copy once: a second look only reads the disk', () => {
    const count = path.join(root, 'started')
    const file = path.join(root, 'bin', 'claude')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `#!/bin/sh\necho x >> "${count}"\necho 1.0.0\n`, { mode: 0o755 })
    locate(CLAUDE)
    locate(CLAUDE)
    locate(CLAUDE)
    assert.equal(fs.readFileSync(count, 'utf8').trim().split('\n').length, 1)
  })

  it('warms every copy at once for a long-lived process', async () => {
    const newer = script(nvm('v24.0.0', 'claude'), '2.0.0')
    script(path.join(root, 'bin', 'claude'), '1.0.0')
    await warm(CLAUDE)
    assert.equal(locate(CLAUDE)?.file, newer)
  })

  it('reads a script through the node beside it', () => {
    const dir = path.dirname(nvm('v24.0.0', 'zcode'))
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'fakenode'), '#!/bin/sh\necho zcode-app-cli 3.1.4-2\n', { mode: 0o755 })
    const file = path.join(dir, 'zcode')
    fs.writeFileSync(file, '#!/usr/bin/env fakenode\n', { mode: 0o755 })
    assert.equal(locate(harnessByName('zcode')!)?.version, '3.1.4-2')
  })
})
