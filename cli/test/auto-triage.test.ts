// Auto triage (#562): when the board sorts what is waiting without being asked.
//
// The judgement itself is an agent's and cannot be asserted here. What can, and what this
// covers, is exactly the decision to start a run: the switch is off until somebody asks for
// it and asks once before it goes on, a batch of nothing starts nothing, the switch and
// Cloud are read again at the moment a run would start, and the sort that follows a sort
// carries on only where the last one actually judged something.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { triageAfterAdding, triageRunAfter, triageWaiting } from '../src/lib/agent/auto-triage.ts'
import { agentRoster } from '../src/lib/agent/roles.ts'
import { autoTriageOn, setAutoTriage } from '../src/lib/agent/settings.ts'
import { readAgents } from '../src/lib/agents/roster.ts'
import { cmdTriageAdd, cmdTriageArchive, cmdTriageDismiss } from '../src/commands/triage.ts'
import { readRuns } from '../src/lib/agent/store.ts'
import { readInbox } from '../src/lib/signals/inbox.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'
import { writeSession, type CloudSession } from '../src/lib/cloud/session.ts'
import { restoreMachineHome } from './helpers/board.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'

let home = ''
let root = ''
const realFetch = globalThis.fetch

const kanban = (): string => path.join(root, 'docs', 'kanban')
const todo = (): string => path.join(kanban(), 'todo')

/** Cloud says this account is admitted, or is not. Triage reads it on every call. */
const admitted = (yes: boolean) => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ session: { admitted: yes, handle: 'someone' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
}

/** One item waiting to be sorted, and the source id it was given. The switch is held off
 *  across the add, so seeding a list never spawns the very run under test. */
async function waiting(title: string): Promise<string> {
  const was = autoTriageOn()
  setAutoTriage(false)
  startCollecting()
  try {
    await cmdTriageAdd({ title, text: `https://example.test/${title.replace(/\s+/g, '-')}` })
  } finally {
    stopCollecting()
    setAutoTriage(was)
  }
  return readInbox().find((item) => item.title === title)!.sourceId
}

/** A move that says rather than returns, with nothing printed. */
function quiet<T>(work: () => T): T {
  startCollecting()
  try {
    return work()
  } finally {
    stopCollecting()
  }
}

/** One open card whose `## Source` names `sourceId` — what a sort leaves behind when it
 *  died between writing the card and recording the item. */
function cardNaming(id: number, sourceId: string): void {
  fs.writeFileSync(
    path.join(todo(), `${id}-card.md`),
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
      '---',
      '',
      'What this card is for.',
      '',
      '<!-- agent -->',
      '',
      '## Source',
      `- ${sourceId}`,
      '',
    ].join('\n'),
  )
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-auto-triage-home-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-auto-triage-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon-key'
  process.env.AI4KANBAN_CLOUD_URL = API
  fs.mkdirSync(todo(), { recursive: true })
  fs.writeFileSync(path.join(todo(), 'README.md'), '# Open tasks\n')
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  setBoardRoot(root)
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 60 * 60 * 1000,
    subject: '11111111-1111-4111-8111-111111111111',
    handle: 'someone',
    name: 'Someone',
  } satisfies CloudSession)
  admitted(true)
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

describe('the switch', () => {
  it('is off until it is turned on, and only writes itself down when it is', () => {
    assert.equal(autoTriageOn(), false)

    assert.equal(setAutoTriage(true).ok, true)
    assert.equal(autoTriageOn(), true)
    assert.match(fs.readFileSync(UI_CONFIG, 'utf8'), /"autoTriage": true/)

    assert.equal(setAutoTriage(false).ok, true)
    assert.equal(autoTriageOn(), false)
    assert.doesNotMatch(fs.readFileSync(UI_CONFIG, 'utf8'), /autoTriage/)
  })

  it('is the triager’s own key, and asking before it goes on is the role’s own property', () => {
    const role = agentRoster().find((entry) => entry.name === 'triage')!
    assert.equal(role.setting, 'autoTriage')
    assert.equal(role.confirm, true)
    // The decider is the only other one, so no screen has to keep a list of names.
    assert.deepEqual(
      agentRoster().filter((entry) => entry.confirm).map((entry) => entry.name),
      ['decider', 'triage'],
    )
  })

  it('is on the roster where triage is open, and off it where triage is not', async () => {
    const named = async (): Promise<string[]> => (await readAgents()).agents.map((a) => a.name)
    assert.ok((await named()).includes('triage'))
    admitted(false)
    assert.ok(!(await named()).includes('triage'))

    // Cloud that cannot be asked reads as closed — the row goes, and the rest of the team
    // is still drawn.
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch
    const rest = await named()
    assert.ok(!rest.includes('triage'))
    assert.ok(rest.includes('planner'))
  })
})

describe('the sort a batch of new items starts', () => {
  it('starts none while the switch is off', async () => {
    await triageAfterAdding(1)
    assert.deepEqual(readRuns(), [])
  })

  it('starts none for a pull that brought nothing new', async () => {
    setAutoTriage(true)
    await triageAfterAdding(0)
    assert.deepEqual(readRuns(), [])
  })

  it('starts none where Cloud no longer says this account is admitted', async () => {
    setAutoTriage(true)
    admitted(false)
    await triageAfterAdding(1)
    assert.deepEqual(readRuns(), [])
  })

  // The add is the move; the sort is a best effort on top of it.
  it('leaves the item added when no sort could be started', async () => {
    setAutoTriage(true)
    admitted(false)
    startCollecting()
    try {
      const done = await cmdTriageAdd({ title: 'Written anyway', text: 'https://example.test/written-anyway' })
      assert.equal(done.title, 'Written anyway')
    } finally {
      stopCollecting()
    }
    assert.equal(readInbox().length, 1)
    assert.deepEqual(readRuns(), [])
  })
})

describe('the sort that follows a sort', () => {
  beforeEach(() => setAutoTriage(true))

  it('starts none while the switch is off', async () => {
    const given = [await waiting('Something new')]
    quiet(() => cmdTriageDismiss(given[0]!, 'too small'))
    await waiting('And another')
    setAutoTriage(false)
    assert.equal(await triageRunAfter(given), null)
  })

  it('starts none when Cloud stops saying this account is admitted', async () => {
    const given = [await waiting('Something new')]
    quiet(() => cmdTriageDismiss(given[0]!, 'too small'))
    await waiting('And another')
    admitted(false)
    assert.equal(await triageRunAfter(given), null)
  })

  it('starts none once nothing is waiting', async () => {
    const given = [await waiting('Something new')]
    quiet(() => cmdTriageDismiss(given[0]!, 'too small'))
    assert.equal(await triageRunAfter(given), null)
  })

  it('starts none when not one item it was given moved', async () => {
    const given = [await waiting('Nothing can judge this')]
    assert.equal(await triageRunAfter(given), null)
  })

  it('carries on where it judged some of them and left the rest', async () => {
    const first = await waiting('Judged')
    const given = [first, await waiting('Not reached')]
    quiet(() => cmdTriageDismiss(first, 'too small'))
    assert.deepEqual(await triageRunAfter(given), { action: 'triage' })
  })

  it('carries on over what arrived while it went', async () => {
    const first = await waiting('Judged')
    const given = [first]
    quiet(() => cmdTriageDismiss(first, 'too small'))
    await waiting('Arrived mid-sort')
    assert.deepEqual(await triageRunAfter(given), { action: 'triage' })
  })

  it('reconciles first, so an item already carded is not judged again', async () => {
    const carded = await waiting('Already carded')
    const given = [carded, await waiting('Still waiting')]
    cardNaming(4, carded)
    assert.deepEqual(await triageRunAfter(given), { action: 'triage' })
    // The card's item is out of the list, so the next sort is handed only the other one.
    assert.deepEqual(triageWaiting().length, 1)
  })

  it('stops where reconciling was the only thing that emptied the list', async () => {
    const carded = await waiting('Already carded')
    cardNaming(4, carded)
    assert.equal(await triageRunAfter([carded]), null)
    assert.deepEqual(triageWaiting(), [])
  })
})

describe('a judgement that landed', () => {
  beforeEach(() => setAutoTriage(true))

  it('counts as movement whichever way it went', async () => {
    const carded = await waiting('Worth a card')
    const given = [carded, await waiting('Left for the next one')]
    quiet(() => cmdTriageArchive(carded, 9))
    assert.deepEqual(await triageRunAfter(given), { action: 'triage' })
  })
})
