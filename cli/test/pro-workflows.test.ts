// Pro workflows (#1038): who may run and copy one, and how the answer is kept.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { proRefusal, startRun } from '../src/lib/agent/start.ts'
import { duplicateWorkflowIfAllowed, workflowById } from '../src/lib/agent/workflows.ts'
import { signOutOfCloud } from '../src/lib/cloud/account.ts'
import { proAccess } from '../src/lib/cloud/pro.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { nextWork } from '../src/lib/view/dispatch.ts'
import { restoreMachineHome, uiConfigOf } from './helpers/board.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'
const MIN = 60_000
const DAY = 24 * 60 * MIN

let home = ''
let root = ''
let asked = 0
const realFetch = globalThis.fetch

const kanban = (): string => path.join(root, 'docs', 'kanban')

const signIn = (subject = '11111111-1111-4111-8111-111111111111'): void =>
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 60 * MIN,
    subject,
  })

/** Cloud answers `/v1/billing` with this, or cannot be reached at all. */
const billing = (answer: { plan: 'free' | 'pro'; periodEnd?: string | null; grantEnd?: string | null } | 'offline' | 'unavailable'): void => {
  globalThis.fetch = (async () => {
    asked++
    if (answer === 'offline') throw new TypeError('fetch failed')
    if (answer === 'unavailable') {
      return new Response(JSON.stringify({ error: { code: 'billing_unavailable', message: 'x' } }), { status: 503 })
    }
    return new Response(JSON.stringify({ billing: { state: 'active', period: 'monthly', periodEnd: null, ...answer } }), { status: 200 })
  }) as typeof fetch
}

const card = (id: number, workflow: string, schedule?: 'refine' | 'implement'): void => {
  fs.writeFileSync(
    path.join(kanban(), 'todo', `${id}-card.md`),
    [
      '---',
      `title: card ${id}`,
      'priority: med',
      'roi: med',
      'status: todo',
      'release: ""',
      'blocked_by: []',
      'related: []',
      'modules: []',
      'questions: []',
      `workflow: ${workflow}`,
      ...(schedule ? [`schedule: ${schedule}`] : []),
      '---',
      '',
      'What this card is for.',
      '',
    ].join('\n'),
  )
}

beforeEach(() => {
  asked = 0
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-pro-home-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-pro-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon-key'
  process.env.AI4KANBAN_CLOUD_URL = API
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '10\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  setBoardRoot(root)
})

afterEach(() => {
  globalThis.fetch = realFetch
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

describe('which workflows are Pro', () => {
  it('marks the video, deck, carousel and blog built-ins, not Coding', () => {
    assert.deepEqual(
      ['coding', 'hyperframes-video', 'slide-deck', 'carousel-post', 'blog-post'].map((id) => workflowById(id)!.pro),
      [false, true, true, true, true],
    )
  })

  it('leaves a copy made before Pro existed free', () => {
    fs.writeFileSync(
      uiConfigOf(kanban()),
      JSON.stringify({ workflows: { added: [{ id: 'wf-2', name: 'Video 2', needsArtifact: true, delivers: 'plan' }] } }),
    )
    assert.equal(workflowById('wf-2')!.pro, false)
  })
})

describe('the account', () => {
  it('reads signed out without asking Cloud', async () => {
    billing({ plan: 'pro' })
    assert.equal(await proAccess(), 'signed-out')
    assert.equal(asked, 0)
  })

  it('keeps a Pro answer for ten minutes, and a free one not at all', async () => {
    signIn()
    const now = Date.now()
    billing({ plan: 'pro' })
    assert.equal(await proAccess(now), 'pro')
    assert.equal(await proAccess(now + 9 * MIN), 'pro')
    assert.equal(asked, 1)
    billing({ plan: 'free' })
    assert.equal(await proAccess(now + 11 * MIN), 'free')
    assert.equal(await proAccess(now + 11 * MIN), 'free')
    assert.equal(asked, 3)
    // A purchase counts on the next try.
    billing({ plan: 'pro' })
    assert.equal(await proAccess(now + 12 * MIN), 'pro')
  })

  it('stands on a kept Pro answer offline until seven days past its period end', async () => {
    signIn()
    const now = Date.now()
    const end = new Date(now + DAY).toISOString()
    billing({ plan: 'pro', periodEnd: end })
    await proAccess(now)
    billing('offline')
    assert.equal(await proAccess(now + 7 * DAY), 'pro')
    assert.equal(await proAccess(now + 9 * DAY), 'unconfirmed')
    billing('unavailable')
    assert.equal(await proAccess(now + 7 * DAY), 'pro')
  })

  it('holds a seed partner offline until seven days past whichever ends later (#1039)', async () => {
    signIn()
    const now = Date.now()
    const lapsed = new Date(now - 30 * DAY).toISOString()
    const grant = new Date(now + 30 * DAY).toISOString()
    billing({ plan: 'pro', periodEnd: lapsed, grantEnd: grant })
    await proAccess(now)
    billing('offline')
    assert.equal(await proAccess(now + 36 * DAY), 'pro')
    assert.equal(await proAccess(now + 38 * DAY), 'unconfirmed')
  })

  it('cannot confirm with nothing kept', async () => {
    signIn()
    billing('offline')
    assert.equal(await proAccess(), 'unconfirmed')
  })

  it('drops the kept answer on sign-out and on another account', async () => {
    signIn()
    billing({ plan: 'pro' })
    await proAccess()
    signIn('22222222-2222-4222-8222-222222222222')
    billing('offline')
    assert.equal(await proAccess(), 'unconfirmed')
    signIn()
    billing({ plan: 'pro' })
    await proAccess()
    signOutOfCloud()
    signIn()
    billing('offline')
    assert.equal(await proAccess(), 'unconfirmed')
  })
})

describe('running a Pro card', () => {
  it('refuses every run but archive and reject, in the words the account needs', async () => {
    card(1, 'slide-deck')
    billing({ plan: 'free' })
    assert.equal((await proRefusal({ action: 'clarify', id: 1 }))?.reason, 'proSignIn')
    signIn()
    const free = await proRefusal({ action: 'implement', id: 1 })
    assert.equal(free?.reason, 'proRequired')
    assert.equal(free?.error, 'Slide deck needs Pro.')
    assert.deepEqual(free?.args, { workflow: 'slide-deck', name: 'Slide deck' })
    assert.equal(await proRefusal({ action: 'archive', id: 1 }), null)
    assert.equal(await proRefusal({ action: 'reject', id: 1 }), null)
    billing('offline')
    assert.equal((await proRefusal({ action: 'clarify', id: 1 }))?.reason, 'proUnconfirmed')
    const started = await startRun({ action: 'clarify', id: 1 })
    assert.equal('error' in started && started.reason, 'proUnconfirmed')
  })

  it('never asks Cloud for a Coding card', async () => {
    card(2, 'coding')
    billing('offline')
    assert.equal(await proRefusal({ action: 'clarify', id: 2 }), null)
    assert.equal(asked, 0)
  })
})

describe('copying a Pro workflow', () => {
  it('is refused without Pro, and the copy stays Pro', async () => {
    signIn()
    billing({ plan: 'free' })
    const refused = await duplicateWorkflowIfAllowed('hyperframes-video')
    assert.equal(refused.ok, false)
    assert.equal(refused.reason, 'proRequired')
    billing({ plan: 'pro' })
    const copy = await duplicateWorkflowIfAllowed('hyperframes-video')
    assert.equal(copy.ok, true)
    assert.equal(workflowById(copy.id!)!.pro, true)
    signOutOfCloud()
    card(3, copy.id!)
    assert.equal((await proRefusal({ action: 'clarify', id: 3 }))?.reason, 'proSignIn')
  })
})

describe('a scheduled Pro card', () => {
  // Only the scheduled runs are read back.
  const tick = async (cleared: number[]) =>
    (await nextWork((id) => (cleared.push(id), Promise.resolve(true)))).filter((w) => w.id !== undefined)

  it('keeps its mark without Pro, and lets a free card take the tick', async () => {
    signIn()
    billing({ plan: 'free' })
    card(1, 'slide-deck', 'refine')
    card(2, 'hyperframes-video', 'refine')
    card(3, 'coding', 'implement')
    const cleared: number[] = []
    const work = await tick(cleared)
    assert.deepEqual(work.map((w) => w.id), [3])
    assert.deepEqual(cleared, [3])
    assert.equal(asked, 1, 'Cloud is asked once for both Pro cards')
  })

  it('waits while signed out or offline, and starts once Pro is on', async () => {
    card(1, 'slide-deck', 'refine')
    const cleared: number[] = []
    assert.deepEqual(await tick(cleared), [])
    signIn()
    billing('offline')
    assert.deepEqual(await tick(cleared), [])
    assert.deepEqual(cleared, [])
    billing({ plan: 'pro' })
    const work = await tick(cleared)
    assert.deepEqual(work.map((w) => [w.action, w.id]), [['clarify', 1]])
    assert.deepEqual(cleared, [1])
  })
})

describe('a recurring Pro card', () => {
  const recurring = (id: number, workflow: string, priority: string): void => {
    fs.mkdirSync(path.join(kanban(), 'todo', 'recurring'), { recursive: true })
    fs.writeFileSync(
      path.join(kanban(), 'todo', 'recurring', `${id}-job.md`),
      [
        '---',
        `title: job ${id}`,
        `priority: ${priority}`,
        'roi: med',
        'status: todo',
        'release: ""',
        'blocked_by: []',
        'related: []',
        'modules: []',
        'questions: []',
        `workflow: ${workflow}`,
        'cadence: 7d',
        '---',
        '',
        'What this job is for.',
        '',
      ].join('\n'),
    )
  }
  const tick = async () => (await nextWork(() => Promise.resolve(true))).filter((w) => w.action === 'run').map((w) => w.id)

  it('is passed over without Pro, and the next due card runs', async () => {
    signIn()
    billing({ plan: 'free' })
    recurring(1, 'slide-deck', 'high')
    recurring(2, 'hyperframes-video', 'high')
    recurring(3, 'coding', 'low')
    assert.deepEqual(await tick(), [3])
    assert.equal(asked, 1, 'Cloud is asked once for both Pro cards')
  })

  it('asks Cloud only when a Pro card is due', async () => {
    recurring(1, 'coding', 'med')
    assert.deepEqual(await tick(), [1])
    assert.equal(asked, 0)
  })

  it('runs on the first tick after Pro is on', async () => {
    signIn()
    billing({ plan: 'free' })
    recurring(1, 'slide-deck', 'med')
    assert.deepEqual(await tick(), [])
    billing({ plan: 'pro' })
    assert.deepEqual(await tick(), [1])
  })
})
