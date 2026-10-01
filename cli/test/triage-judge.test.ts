// Judging triage items one at a time with Jev, for Pro (#1221).
//
// Jev's answer is mocked at Cloud's door. What is covered is everything around it: the seven
// options become four verdicts, the state fits Jev's window in the card's order, the verdict
// sticks to the item through every move, and a sort never sends a judged item back.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { printFlow } from '../src/lib/agent/flow.ts'
import { triageWaiting } from '../src/lib/agent/auto-triage.ts'
import { cmdTriageAdd, cmdTriageArchive, cmdTriageDismiss, cmdTriageRestore } from '../src/commands/triage.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { reconcileTriage } from '../src/lib/signals/carded.ts'
import { readAllDismissed, readArchived, readInbox } from '../src/lib/signals/inbox.ts'
import {
  CONFIDENT,
  MAX_TOKENS,
  judgementState,
  nextStep,
  questionsFor,
  tokensOf,
  verdictOf,
  type Answer,
} from '../src/lib/signals/judge.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { runAgent } from '../src/lib/agent-cli.ts'
import { runBoard } from '../src/lib/board-cli.ts'
import { restoreMachineHome } from './helpers/board.ts'
import { triageShut } from './helpers/triage.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'
const SUBJECT = '11111111-1111-4111-8111-111111111111'

let root = ''
let home = ''
const realFetch = globalThis.fetch
let sent: { url: string; body: { state: Record<string, unknown>; questions: Record<string, unknown> } }[] = []

const kanban = (): string => path.join(root, 'docs', 'kanban')
const todo = (): string => path.join(kanban(), 'todo')
const planner = (): string => path.join(kanban(), 'memory', 'agents', 'planner')

function write(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

function card(id: number, title: string, body = 'What it does.'): string {
  const file = path.join(todo(), `${id}-card-${id}.md`)
  write(file, `---\ntitle: ${title}\npriority: med\nroi: med\nstatus: todo\n---\n\n${body}\n`)
  return file
}

async function waiting(title: string): Promise<string> {
  startCollecting()
  try {
    await triageShut(() => cmdTriageAdd({ title, text: `The words of ${title}.` }))
  } finally {
    stopCollecting()
  }
  return readInbox().find((item) => item.title === title)!.sourceId
}

function quiet<T>(work: () => T): { value: T; said: string } {
  const sink = startCollecting()
  try {
    return { value: work(), said: sink.out.join('\n') }
  } finally {
    stopCollecting()
  }
}

function signIn(pro: boolean): void {
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 60 * 60 * 1000,
    subject: SUBJECT,
  })
  if (pro) fs.writeFileSync(path.join(home, 'pro.json'), JSON.stringify({ subject: SUBJECT, checkedAt: Date.now(), periodEnd: null }))
}

const choice = (pick: string, confidence = 0.9): Answer => ({ choice: pick, confidence })

function answer(res: () => Response): void {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null })
    return res()
  }) as typeof fetch
}

const jev = (verdict: Answer, duplicate: Answer = choice('none')) => () =>
  new Response(JSON.stringify({ answers: { verdict, duplicate }, model: 'typesafe/jev-1.13' }), { status: 200 })

async function akb(argv: string[], run: typeof runAgent = runAgent): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = []
  const err: string[] = []
  const [log, error] = [console.log, console.error]
  console.log = (line: unknown) => void out.push(String(line))
  console.error = (line: unknown) => void err.push(String(line))
  try {
    const code = await run(['--dir', root, ...argv], { program: 'akb', cwd: root })
    return { code, out: out.join('\n'), err: err.join('\n') }
  } finally {
    console.log = log
    console.error = error
  }
}

const item = (sourceId: string) => [...readInbox(), ...readArchived(), ...readAllDismissed()].find((one) => one.sourceId === sourceId)!

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-triage-judge-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-judge-home-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_CLOUD_URL = API
  write(path.join(todo(), 'README.md'), '# Open tasks\n')
  write(path.join(kanban(), 'next-id'), '100\n')
  setBoardRoot(root)
  sent = []
})

afterEach(() => {
  globalThis.fetch = realFetch
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_CLOUD_URL
})

describe('the verdict', () => {
  it('turns each of the seven options into one of the four ends', () => {
    const ends = Object.fromEntries(
      ['supported', 'rejected', 'duplicate', 'low-value', 'needs-user', 'small', 'plan'].map((pick) => {
        const v = verdictOf({ verdict: choice(pick) })
        return [pick, `${v.verdict}/${v.reason}`]
      }),
    )
    assert.deepEqual(ends, {
      supported: 'skip/supported',
      rejected: 'skip/rejected',
      duplicate: 'skip/duplicate',
      'low-value': 'skip/low-value',
      'needs-user': 'human-review/needs-user',
      small: 'plan-without-refine/small',
      plan: 'plan/plan',
    })
  })

  it('holds for the user whatever was picked below the confidence floor', () => {
    assert.equal(CONFIDENT, 0.6)
    for (const pick of ['supported', 'plan', 'small']) {
      const v = verdictOf({ verdict: choice(pick, 0.59) })
      assert.deepEqual([v.verdict, v.reason], ['human-review', 'unsure'])
    }
    assert.equal(verdictOf({ verdict: choice('plan', 0.6) }).verdict, 'plan')
  })

  it('names the duplicated card when one was picked, and none otherwise', () => {
    const named = verdictOf({ verdict: choice('duplicate'), duplicate: choice('#1180') })
    assert.equal(named.card, 1180)
    assert.match(nextStep('t3_a', named), /--reason "duplicates #1180"/)
    const unnamed = verdictOf({ verdict: choice('duplicate'), duplicate: choice('none') })
    assert.equal(unnamed.card, null)
    assert.match(nextStep('t3_a', unnamed), /--reason "duplicates an open card"/)
    assert.equal(verdictOf({ verdict: choice('plan'), duplicate: choice('#1180') }).card, null)
  })

  it('prints the command that lands each end', () => {
    const at = (pick: string, confidence = 0.9) => nextStep('t3_a', verdictOf({ verdict: choice(pick, confidence) }))
    assert.equal(at('supported'), 'akb triage dismiss t3_a --reason "already supported"')
    assert.equal(at('needs-user'), 'leave it waiting — the user decides')
    assert.match(at('plan'), /raw create .* --schedule refine --body-file <path>, then akb triage archive t3_a --card <id>$/)
    const direct = at('small')
    assert.doesNotMatch(direct, /--schedule/)
    assert.match(direct, /raw update <id> --status ready, then akb triage archive t3_a --card <id>$/)
  })
})

describe('the state', () => {
  it('carries the item, the product, the decisions and every rejected.md and dismissed.md', async () => {
    const id = await waiting('Dark mode')
    write(path.join(kanban(), 'memory', 'product.md'), '# Product\n\nA board.\n')
    write(path.join(planner(), 'decisions.md'), '# Decisions\n\n- keep it plain\n')
    write(path.join(planner(), 'rejected.md'), '# Rejected\n\n- a database\n')
    write(path.join(planner(), 'cloud', 'rejected.md'), '# Rejected\n\n- a second cloud\n')
    write(path.join(planner(), 'dismissed.md'), '# Triage preferences\n\n- no themes\n')
    const { state, trimmed } = judgementState(item(id), [card(7, 'Themes')], questionsFor([]))
    assert.match(String(state.item), /The words of Dark mode/)
    assert.match(String(state.item), /source_id:/)
    assert.match(String(state.product), /A board/)
    assert.match(String(state.decisions), /keep it plain/)
    assert.match(String(state['docs/kanban/memory/agents/planner/rejected.md']), /a database/)
    assert.match(String(state['docs/kanban/memory/agents/planner/cloud/rejected.md']), /a second cloud/)
    assert.match(String(state['docs/kanban/memory/agents/planner/dismissed.md']), /no themes/)
    assert.deepEqual(state.cards, [{ card: '#7 Themes', text: fs.readFileSync(path.join(todo(), '7-card-7.md'), 'utf8') }])
    assert.equal(state.readme, undefined)
    assert.deepEqual(trimmed, [])
  })

  it('reads the README when the product description is empty, and judges with no decisions', async () => {
    const id = await waiting('Dark mode')
    write(path.join(kanban(), 'memory', 'product.md'), "# Product\n\nWhat the product is today, from its users' side. Rewritten whole by `akb describe-product`;\nedits here do not last.\n")
    write(path.join(root, 'README.md'), '# The project\n\nIt sorts cards.\n')
    const { state } = judgementState(item(id), [], questionsFor([]))
    assert.match(String(state.readme), /It sorts cards/)
    assert.equal(state.product, undefined)
    assert.equal(state.decisions, undefined)
  })

  it('cuts to fit in order — card bodies, the README, then the oldest memory — and never the item', async () => {
    const id = await waiting('Dark mode')
    const big = (n: number) => 'x'.repeat(n)
    const questions = questionsFor([])
    write(path.join(root, 'README.md'), `# Readme\n\n${big(60_000)}\n`)
    const lines = Array.from({ length: 300 }, (_, i) => `- entry ${i} ${big(200)}`)
    write(path.join(planner(), 'rejected.md'), `# Rejected\n\n${lines.join('\n')}\n`)
    const named = card(7, 'Themes', big(40_000))

    const { state, trimmed } = judgementState(item(id), [named], questions)
    assert.ok(tokensOf({ state, questions }) <= MAX_TOKENS)
    assert.deepEqual(trimmed, [
      '#7 Themes — its body',
      'README.md — its second half',
      'docs/kanban/memory/agents/planner/rejected.md — its oldest entries',
    ])
    assert.deepEqual(state.cards, [{ card: '#7 Themes' }])
    const kept = String(state['docs/kanban/memory/agents/planner/rejected.md'])
    assert.doesNotMatch(kept, /entry 0 /)
    assert.match(kept, /entry 299 /)
    assert.match(String(state.item), /The words of Dark mode/)
  })

  it('cuts nothing that fits', async () => {
    const id = await waiting('Dark mode')
    const { trimmed } = judgementState(item(id), [card(7, 'Themes')], questionsFor([]))
    assert.deepEqual(trimmed, [])
  })
})

describe('akb triage judge', () => {
  it('asks Cloud, records the verdict on the item, and prints one line', async () => {
    signIn(true)
    card(1180, 'Themes')
    const id = await waiting('Dark mode')
    answer(jev(choice('duplicate', 0.82), choice('#1180')))
    const { code, out } = await akb(['triage', 'judge', id, '--files', 'docs/kanban/todo/1180-card-1180.md'])

    assert.equal(code, 0)
    assert.equal(out, `${id} — skip: duplicates #1180 (confidence 0.82) — next: akb --dir ${root} triage dismiss ${id} --reason "duplicates #1180"`)
    assert.equal(sent.length, 1)
    assert.equal(sent[0]!.url, `${API}/v1/judge`)
    const criteria = (sent[0]!.body.questions.duplicate as { criteria: Record<string, string> }).criteria
    assert.deepEqual(criteria, { '#1180': 'Themes', none: 'no open card owns this work.' })
    assert.equal((sent[0]!.body.state.cards as { card: string }[])[0]!.card, '#1180 Themes')
    const judged = item(id)
    assert.deepEqual([judged.verdict, judged.verdictReason, judged.verdictCard], ['skip', 'duplicate', 1180])
    assert.match(fs.readFileSync(path.join(root, judged.relPath), 'utf8'), /verdict_confidence: "?0.82"?/)
  })

  it('judges an item once', async () => {
    signIn(true)
    const id = await waiting('Dark mode')
    answer(jev(choice('needs-user')))
    assert.equal((await akb(['triage', 'judge', id])).code, 0)
    const again = await akb(['triage', 'judge', id])
    assert.notEqual(again.code, 0)
    assert.match(again.err, /already judged: human-review/)
    assert.equal(sent.length, 1)
  })

  it('refuses a file outside the board', async () => {
    signIn(true)
    const id = await waiting('Dark mode')
    write(path.join(root, 'secret.md'), 'no')
    answer(jev(choice('plan')))
    const refused = await akb(['triage', 'judge', id, '--files', 'secret.md'])
    assert.notEqual(refused.code, 0)
    assert.match(refused.err, /only files under docs\/kanban\//)
    assert.equal(sent.length, 0)
  })

  it('records nothing when Cloud cannot be reached', async () => {
    signIn(true)
    const id = await waiting('Dark mode')
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    const failed = await akb(['triage', 'judge', id])
    assert.notEqual(failed.code, 0)
    assert.match(failed.err, /Cloud could not be reached — leave .* waiting and go on to the next item/)
    assert.equal(item(id).verdict, '')
  })

  it('stops the sort on pro_required and forgets the kept Pro answer', async () => {
    signIn(true)
    const id = await waiting('Dark mode')
    answer(() => new Response(JSON.stringify({ error: { code: 'pro_required', message: 'This needs Pro.' } }), { status: 403 }))
    const refused = await akb(['triage', 'judge', id])
    assert.notEqual(refused.code, 0)
    assert.match(refused.err, /pro_required: .* Stop judging/)
    assert.equal(fs.existsSync(path.join(home, 'pro.json')), false)
    assert.equal(item(id).verdict, '')
  })
})

describe('the sort', () => {
  async function judged(title: string, pick: string, confidence = 0.9): Promise<string> {
    const id = await waiting(title)
    answer(jev(choice(pick, confidence)))
    assert.equal((await akb(['triage', 'judge', id])).code, 0)
    return id
  }

  it('names the tool, lists what is left to judge and to card, and never a held item', async () => {
    signIn(true)
    card(7, 'Themes')
    const fresh = await waiting('Fresh')
    const plan = await judged('Worth planning', 'plan')
    const small = await judged('Small fix', 'small')
    const held = await judged('Direction', 'needs-user')
    const { said } = quiet(() => printFlow({ action: 'triage' }))

    assert.match(said, /triage judge <source-id> \[--files <paths>\]/)
    assert.match(said, /#7 Themes — docs\/kanban\/todo\/7-card-7\.md/)
    assert.match(said, new RegExp(`1 in docs/kanban/triage/, judge each one:\\n\\s+${fresh} — Fresh`))
    assert.match(said, new RegExp(`${plan} — Worth planning .* — plan\\n`))
    assert.match(said, new RegExp(`${small} — Small fix .* — plan-without-refine`))
    assert.doesNotMatch(said, new RegExp(held))
    assert.match(said, /with no --schedule, then akb.* raw update <id> --status ready/)
    assert.doesNotMatch(said, /memory\/agents\/planner\/decisions\.md/)
  })

  it('never sends a held or restored item again, and keeps one judged worth a card', async () => {
    signIn(true)
    const fresh = await waiting('Fresh')
    const held = await judged('Direction', 'plan', 0.4)
    const plan = await judged('Worth planning', 'plan')
    const skipped = await judged('Supported', 'supported')
    quiet(() => cmdTriageDismiss(skipped, 'already supported'))
    quiet(() => cmdTriageRestore(skipped))

    assert.equal(item(skipped).verdict, 'skip')
    assert.deepEqual(new Set(triageWaiting()), new Set([fresh, plan]))
    assert.equal(item(held).verdict, 'human-review')
  })

  it('keeps the verdict through archive and dismiss', async () => {
    signIn(true)
    const plan = await judged('Worth planning', 'plan')
    const skip = await judged('Too little', 'low-value')
    quiet(() => cmdTriageArchive(plan, 7))
    quiet(() => cmdTriageDismiss(skip, 'too little worth'))
    assert.deepEqual([item(plan).verdict, item(plan).cardId], ['plan', 7])
    assert.deepEqual([item(skip).verdict, item(skip).verdictReason], ['skip', 'low-value'])
  })

  it('archives a card written before a stop onto its item, rather than carding it twice', async () => {
    signIn(true)
    const plan = await judged('Worth planning', 'small')
    card(101, 'Worth planning', `What it does.\n\n## Source\n\n- ${plan}`)
    const [done] = reconcileTriage()
    assert.deepEqual([done!.sourceId, done!.cardId], [plan, 101])
    assert.deepEqual(triageWaiting(), [])
    assert.equal(item(plan).verdict, 'plan-without-refine')
  })

  it('makes a plan-without-refine card ready to build', async () => {
    const body = path.join(root, 'body.md')
    write(body, '\nWhat it does.\n\n## Todo\n- [ ] Build it.\n')
    const created = await akb(['create', '--title', 'Small fix', '--body-file', body], runBoard)
    assert.equal(created.code, 0, created.err)
    const id = 100
    const ready = await akb(['update', String(id), '--status', 'ready'], runBoard)
    assert.equal(ready.code, 0, ready.err)
    const file = fs.readdirSync(todo()).find((name) => name.startsWith(`${id}-`))!
    const text = fs.readFileSync(path.join(todo(), file), 'utf8')
    assert.match(text, /^status: ready$/m)
    assert.doesNotMatch(text, /^schedule:/m)
  })
})
