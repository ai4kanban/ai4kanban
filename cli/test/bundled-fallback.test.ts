// A `codex` on the PATH that cannot start gives way to the copy a desktop app ships (#1270):
// a wrapper left pointing at ChatGPT.app's old layout exits 126 on every run otherwise.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { openRun, patch } from '../src/lib/agent/sessions.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { harnessByName } from '../src/lib/agent/harnesses/index.ts'
import { openPlan, planRun, startableBinary } from '../src/lib/agent/resolve.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { writeSetupChecklist } from '../src/lib/setup.ts'
import { forgetMachineState } from './helpers/board.ts'

const CODEX = harnessByName('codex')!
const held = { PATH: process.env.PATH, CODEX_CLI_PATH: process.env.CODEX_CLI_PATH }
let root = ''

function script(at: string, body: string): string {
  fs.mkdirSync(path.dirname(at), { recursive: true })
  fs.writeFileSync(at, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
  return at
}

/** The PATH's `codex`, and a bundled copy that leaves `ran` behind when it runs. */
function codexes(onPath: string): { bundled: string; ran: string } {
  const bin = path.join(root, 'bin')
  script(path.join(bin, 'codex'), onPath)
  process.env.PATH = `${bin}${path.delimiter}/usr/bin${path.delimiter}/bin`
  const ran = path.join(root, 'ran')
  const bundled = script(path.join(root, 'ChatGPT.app', 'Contents', 'codex'), `touch "${ran}"\necho codex-cli 1.0`)
  process.env.CODEX_CLI_PATH = bundled
  return { bundled, ran }
}

const BROKEN = 'echo "/old/codex: cannot execute: No such file or directory" >&2\nexit 126'
const STARTS = '[ "$1" = --version ] && { echo codex-cli 1.0; exit 0; }\necho "boom" >&2\nexit 1'

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-bundled-fallback-'))
  forgetMachineState(root)
  setBoardRoot(root)
  setBoardProvider(null)
  fs.mkdirSync(path.join(root, 'docs/kanban/todo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '1\n')
  fs.writeFileSync(path.join(root, 'docs/kanban/todo/README.md'), '# Tasks\n')
  fs.writeFileSync(
    path.join(root, 'docs/kanban/ui.config.json'),
    JSON.stringify({ runtimes: [{ id: 'global', name: 'Global default', harness: 'codex', settings: {} }] }),
  )
})

afterEach(() => {
  for (const [key, value] of Object.entries(held)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a PATH copy that cannot start', { skip: process.platform === 'win32' }, () => {
  it('runs the bundled copy instead, and says so once in the log', async () => {
    const { ran } = codexes(BROKEN)
    writeSetupChecklist()
    const opened = openRun({ action: 'setup' }, 'Set up this board.', [])
    if ('error' in opened) throw new Error(opened.error)
    assert.equal(opened.spec.plan.argv[0], 'codex')
    fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
    patch(opened.run.sessionId, (r) => {
      r.pid = process.pid
    })
    fs.writeFileSync(opened.run.logPath, '')
    await watchRun(opened.run.sessionId, async () => ({ error: 'no resume' }))
    assert.ok(fs.existsSync(ran))
    const log = fs.readFileSync(opened.run.logPath, 'utf8')
    assert.equal(log.match(/\[board\] The codex on your PATH can't start, so this run uses the one inside ChatGPT\./g)?.length, 1)
    assert.doesNotMatch(log, /cannot execute/)
  })

  it('hands the bundled copy to the spawn, the renderer and the login check alike', () => {
    const { bundled } = codexes(BROKEN)
    const active = openPlan(planRun('s1', root))
    assert.equal(active.argv[0], bundled)
    assert.match(active.startNote ?? '', /inside ChatGPT\.$/)
    assert.equal(startableBinary('codex', CODEX).binary, bundled)
  })

  it('keeps a PATH copy that starts, however its run then fails', () => {
    codexes(STARTS)
    const active = openPlan(planRun('s1', root))
    assert.equal(active.argv[0], 'codex')
    assert.equal(active.startNote, undefined)
  })

  it('changes nothing when there is no bundled copy', () => {
    codexes(BROKEN)
    process.env.CODEX_CLI_PATH = path.join(root, 'gone', 'codex')
    const none = { ...CODEX, bundled: () => [path.join(root, 'gone', 'codex')] }
    assert.deepEqual(startableBinary('codex', none), { binary: 'codex' })
    assert.deepEqual(startableBinary('codex', { ...CODEX, bundled: undefined }), { binary: 'codex' })
  })
})
