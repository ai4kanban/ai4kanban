// Plan tasks is said into the discussion's own session (#1026), and Start now forks it (#1246).
//
// The promise: the create run resumes the session the discussion holds rather than opening a
// blank one, it is the conversation's one turn while it goes, and a discussion with no
// session to resume is refused rather than started fresh. The build forks that session into
// its worktree, leaving the discussion's own as it was.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { answeringOn, chatRunEnded, readChat, sendChatMessage, takeChatSession } from '../src/lib/agent/chat.ts'
import { closeRun, openResume, openRun, resumeSessionId } from '../src/lib/agent/sessions.ts'
import { readRuns } from '../src/lib/agent/store.ts'
import { CHATS_DIR, PLANS, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-plan-chat-'))
const kanban = path.join(root, 'docs', 'kanban')
const KEY = 'discussion-00000000-0000-4000-8000-000000000001'

// A build opens a worktree, so the project is a repository.
for (const args of [['init', '--quiet', '-b', 'main'], ['-c', 'user.email=t@e', '-c', 'user.name=t', 'commit', '--quiet', '--allow-empty', '-m', 'start']]) {
  spawnSync('git', args, { cwd: root })
}
fs.writeFileSync(path.join(root, '.gitignore'), 'docs/\n.akb/\n')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(path.join(kanban, 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '1\n')
  fs.writeFileSync(
    path.join(kanban, 'ui.config.json'),
    JSON.stringify({
      runtimes: [
        { id: 'global', name: 'Global default', harness: 'claude-code', settings: {} },
        { id: 'kimi', name: 'Kimi', harness: 'kimi', settings: {} },
      ],
    }),
  )
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const discussion = (extra: Record<string, unknown> = { resumeId: 'held-session' }): void => {
  fs.mkdirSync(CHATS_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(CHATS_DIR, `${KEY}.json`),
    JSON.stringify({ cardId: KEY, harness: 'claude-code', messages: [{ role: 'you', text: 'hi', at: 1 }], ...extra }),
  )
}

// The create a Plan tasks press opens, the way `startRun` opens it.
function plan(): string {
  const said = takeChatSession(KEY)
  assert.ok(!('error' in said))
  try {
    const opened = openRun({ action: 'create', plan: 'x.md', chat: KEY }, 'the add-task prompt', [], undefined, said)
    assert.ok(!('error' in opened))
    // A finished run is kept only while its log is on disk.
    fs.mkdirSync(path.dirname(opened.run.logPath), { recursive: true })
    fs.writeFileSync(opened.run.logPath, '')
    return opened.run.sessionId
  } finally {
    said.release()
  }
}

describe('Plan tasks carries the discussion session on', () => {
  it('resumes the session the discussion holds', () => {
    discussion()
    const said = takeChatSession(KEY)
    assert.ok(!('error' in said))
    said.release()
    const plan = said.plan(root, 'unused')
    assert.equal(plan.resumeId, 'held-session')
    assert.ok(plan.argv.includes('held-session'))
  })

  it('refuses a discussion with no session rather than opening one', () => {
    discussion({})
    const said = takeChatSession(KEY)
    assert.ok('error' in said && said.reason === 'chatNoSession')
  })

  it('holds the conversation while the run goes, and resumes by its id', async () => {
    discussion()
    const id = plan()
    assert.equal(answeringOn(KEY), true)
    const busy = takeChatSession(KEY)
    assert.ok('error' in busy && busy.reason === 'chatBusy')
    const chat = await sendChatMessage(KEY, 'meanwhile')
    assert.ok('error' in chat && chat.reason === 'chatBusy')
    await closeRun(id, { status: 'error', code: 1 })
    assert.equal(answeringOn(KEY), false)
    const run = readRuns().find((r) => r.sessionId === id)!
    assert.equal(resumeSessionId(run), 'held-session')
    const resumed = await openResume(id)
    assert.ok(!('error' in resumed))
    assert.equal(resumed.run.chat, KEY)
    assert.ok(resumed.spec.plan.argv.includes('held-session'))
  })

  it('refuses a resume while a reply is being written', async () => {
    discussion()
    const id = plan()
    await closeRun(id, { status: 'error', code: 1 })
    const dir = path.join(CHATS_DIR, `${KEY}.answering`)
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'owner'), `${process.pid}\n`)
    const resumed = await openResume(id)
    assert.ok('error' in resumed && resumed.reason === 'chatBusy')
  })

  it('leaves the conversation on the id the run ended on', () => {
    discussion()
    chatRunEnded(KEY, 'next-session')
    assert.equal(readChat(KEY)?.resumeId, 'next-session')
  })
})

// The Start now a discussion's plan opens, the way `startRun` opens it.
function build(): string {
  fs.mkdirSync(PLANS, { recursive: true })
  fs.writeFileSync(path.join(PLANS, '1-widget.md'), '# A widget\n\nBuild it.\n')
  const said = takeChatSession(KEY, true)
  assert.ok(!('error' in said))
  try {
    const opened = openRun({ action: 'implement', plan: 'plans/1-widget.md', chat: KEY }, 'prompt', [], undefined, said)
    if ('error' in opened) throw new Error(opened.error)
    fs.mkdirSync(path.dirname(opened.run.logPath), { recursive: true })
    fs.writeFileSync(opened.run.logPath, '')
    return opened.run.sessionId
  } finally {
    said.release()
  }
}

describe('Start now forks the discussion session', () => {
  it('forks into the worktree under its own id, holding the discussion only while written down', () => {
    discussion()
    const id = build()
    assert.equal(answeringOn(KEY), false)
    const run = readRuns().find((r) => r.sessionId === id)!
    assert.notEqual(run.cwd, root)
    assert.equal(run.chat, undefined)
    assert.ok(run.argv?.includes('--fork-session') && run.argv.includes('held-session'))
    assert.equal(resumeSessionId(run), id)
    assert.equal(run.origin?.discussion, KEY)
    assert.equal(run.origin?.resumeId, 'held-session')
  })

  it('leaves the discussion session alone, and continues its own after a stop', async () => {
    discussion()
    const id = build()
    await closeRun(id, { status: 'error', code: 1 })
    assert.equal(readChat(KEY)?.resumeId, 'held-session')
    const resumed = await openResume(id)
    assert.ok(!('error' in resumed))
    assert.equal(resumed.run.chat, undefined)
    assert.ok(resumed.spec.plan.argv.includes(id))
    assert.ok(!resumed.spec.plan.argv.includes('held-session'))
  })

  it('refuses a discussion with no session, keeping the plan', () => {
    discussion({})
    const said = takeChatSession(KEY, true)
    assert.ok('error' in said && said.reason === 'chatNoSession')
  })

  it('refuses a connector that cannot fork, so the screen can plan instead', () => {
    discussion({ resumeId: 'held-session', harness: 'kimi', runtime: 'kimi' })
    const said = takeChatSession(KEY, true)
    assert.equal('error' in said && said.reason, 'chatNoFork', JSON.stringify(said))
    assert.equal(answeringOn(KEY), false)
    assert.ok(!('error' in takeChatSession(KEY)))
  })

  it('opens a fresh session for a Start now with no discussion', () => {
    fs.mkdirSync(PLANS, { recursive: true })
    fs.writeFileSync(path.join(PLANS, '1-widget.md'), '# A widget\n')
    const opened = openRun({ action: 'implement', plan: 'plans/1-widget.md' }, 'prompt', [])
    if ('error' in opened) throw new Error(opened.error)
    assert.ok(!opened.spec.plan.argv.includes('--fork-session'))
    assert.equal(opened.run.origin, undefined)
  })
})
