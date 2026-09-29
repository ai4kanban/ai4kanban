// What diff approval left behind on a board (#1209): a real git repository with real
// worktrees, like the landing tests.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { activeDelivery, listDeliveries } from '../src/lib/agent/deliveries.ts'
import { advanceLanding } from '../src/lib/agent/landing.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit } from '../src/lib/agent/settings.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import type { AgentAction, DeliveryRecord } from '../src/lib/agent/types.ts'
import { SESSIONS, setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'

let root = ''

const card = (id: number, title: string): string =>
  [
    '---',
    `title: ${title}`,
    'priority: med',
    'roi: med',
    'status: ready',
    'release: ""',
    'blocked_by: []',
    'related: []',
    'modules: []',
    'questions: []',
    '---',
    '',
    'What this card is for.',
    '',
    '<!-- agent -->',
    '',
    '## Scope',
    `- **A requirement**: ${id}.`,
    '',
  ].join('\n')

const git = (args: string[], cwd = root): string => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-legacy-approval-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
  fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  for (const [id, title] of [
    [1, 'card one'],
    [2, 'card two'],
  ] as const) {
    fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', `${id}-card.md`), card(id, title))
  }
  setAutoCommit(true)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

function run(action: AgentAction, id: number, title: string): string {
  const opened = openRun({ action, id, title }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

async function end(sessionId: string, status: 'done' | 'error' = 'done'): Promise<void> {
  const record = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(record!.logPath, 'log\n')
  await closeRun(sessionId, { status, ok: status === 'done', code: 0 })
}

async function passReview(id: number, title: string): Promise<void> {
  const review = run('review', id, title)
  await end(review)
}

// Build a card and pass its review: everything that happens before a landing.
async function reviewed(id: number, title: string, text: string): Promise<DeliveryRecord> {
  const built = run('implement', id, title)
  const delivery = activeDelivery(id)!
  fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), 'shared.txt'), text)
  await end(built)
  await passReview(id, title)
  return delivery
}

const live = (deliveryId: string): DeliveryRecord => listDeliveries().find((d) => d.deliveryId === deliveryId)!
const log = (): string[] => git(['log', '--format=%s', 'main']).split('\n')

// A board from before diff approval was removed (#1209): the setting still in its config and a
// delivery still parked on the approval. Both are ignored, and the delivery lands.
describe('left over from diff approval', () => {
  it('lands a delivery that was waiting on the approval, whatever the config says', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    const config = JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')) as Record<string, unknown>
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ ...config, requireDiffApproval: true }))
    const store = JSON.parse(fs.readFileSync(SESSIONS, 'utf8')) as { deliveries: Record<string, unknown>[] }
    const row = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)!
    row.approval = { required: true, events: [] }
    row.landing = { ...(row.landing as object), status: 'waiting', why: 'held on your approval: waiting' }
    fs.writeFileSync(SESSIONS, JSON.stringify(store))

    assert.notEqual(deliveryState(live(delivery.deliveryId), 0).stage, 'approval')
    await advanceLanding()
    assert.equal(live(delivery.deliveryId).landing?.status, 'landed')
    assert.deepEqual(log(), ['card one (#1)', 'start'])
    assert.equal(JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')).requireDiffApproval, true, 'the file is not rewritten')
  })
})
