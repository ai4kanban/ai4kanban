// Sorting triage with Jev, for Pro (#1221, #1263).
//
// Jev's answer is mocked at Cloud's door. What is covered is everything around it: the ten
// questions, their answers becoming four verdicts, the state fitting Jev's window, and each
// answer landing — a card named after its item, an ignore with its reason, or a hold.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { openSort, runSort, triageWaiting } from '../src/lib/agent/auto-triage.ts'
import { readRuns } from '../src/lib/agent/store.ts'
import { cmdTriageAdd, cmdTriageRestore } from '../src/commands/triage.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { addToInbox } from '../src/lib/signals/add.ts'
import { fileName, readAllDismissed, readArchived, readInbox, writeSignal } from '../src/lib/signals/inbox.ts'
import {
  CONFIDENT,
  DO_LINE,
  DROP_LINE,
  IGNORE_LINE,
  MAX_TOKENS,
  NEEDS_USER_LINE,
  SMALL_LINE,
  awaitsJudging,
  judgementState,
  picksOf,
  questionsFor,
  reasonWords,
  sortItems,
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

async function waiting(title: string, slug?: string): Promise<string> {
  startCollecting()
  try {
    await triageShut(() => cmdTriageAdd({ title, text: `The words of ${title}.`, slug }))
  } finally {
    stopCollecting()
  }
  return readInbox().find((item) => item.title === title)!.sourceId
}

/** An item a run of `agent` added — a reflection's is the proposer's. */
function addedBy(agent: string, title: string): string {
  const done = addToInbox({ title, text: `The words of ${title}.`, agent })
  assert.ok(done.ok)
  return readInbox().find((item) => item.title === title)!.sourceId
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

/** An answer carrying each option's probability, as Jev gives it. */
const odds = (pick: string, probabilities: Record<string, number>, confidence = 0.5): Answer => ({ choice: pick, confidence, probabilities })

/** A yes/no answer, by how likely Jev said yes. */
const yes = (p: number): Answer => odds(p >= 0.5 ? 'yes' : 'no', { yes: p, no: Math.round((1 - p) * 100) / 100 })

/** The six answers a verdict is read off: worth doing, and nothing against it, unless told. */
const judged = (more: Record<string, Answer> = {}): Record<string, Answer> => ({
  worth: yes(0.9),
  supported: yes(0.02),
  rejected: yes(0.02),
  duplicate: choice('none'),
  needsUser: yes(0.02),
  small: yes(0.1),
  ...more,
})

function answer(res: () => Response): void {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null })
    return res()
  }) as typeof fetch
}

const jev = (more: Record<string, Answer> = {}) => () =>
  new Response(
    JSON.stringify({
      answers: {
        ...judged(),
        modules: choice('docs'),
        priority: choice('high'),
        roi: choice('low'),
        workflow: choice('blog-post'),
        ...more,
      },
      model: 'typesafe/jev-1.13',
    }),
    { status: 200 },
  )

const MODULES = '# Modules\n\n- **skill** — the board machinery. `cli/`.\n- **docs** — the user guides.\n'

/** Sort everything waiting, with nothing printed. */
async function sort(): Promise<{ report: Awaited<ReturnType<typeof sortItems>>; said: string[] }> {
  const said: string[] = []
  return { report: await sortItems(triageWaiting(), (line) => void said.push(line)), said }
}

const cardFiles = (): string[] => fs.readdirSync(todo()).filter((name) => /^\d+-/.test(name))
const cardText = (name: string): string => fs.readFileSync(path.join(todo(), name), 'utf8')

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
  write(path.join(kanban(), 'modules.md'), MODULES)
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
  const end = (more: Record<string, Answer> = {}): string => {
    const v = verdictOf(judged(more))
    return `${v.verdict}/${v.reason}`
  }
  const owned = (p: number): Answer => odds('#1180', { '#1180': p, none: Math.round((1 - p) * 100) / 100 })

  it('reads the answers into one of the four ends', () => {
    assert.equal(end({ supported: yes(0.95) }), 'skip/supported')
    assert.equal(end({ rejected: yes(0.95) }), 'skip/rejected')
    assert.equal(end({ duplicate: owned(0.95) }), 'skip/duplicate')
    assert.equal(end({ worth: yes(0.1) }), 'skip/low-value')
    assert.equal(end({ needsUser: yes(0.7) }), 'human-review/needs-user')
    assert.equal(end({ small: yes(0.7) }), 'plan-without-refine/small')
    assert.equal(end(), 'plan/plan')
    assert.equal(end({ worth: yes(0.5) }), 'human-review/unsure')
  })

  it("reads a proposer's item off whether it needs the user and its size alone", () => {
    const of = (more: Record<string, Answer>) => verdictOf(more, 'proposer')
    const end = (v: ReturnType<typeof verdictOf>) => `${v.verdict}/${v.reason}`
    assert.equal(end(of({ needsUser: yes(0.7), small: yes(0.9) })), 'human-review/needs-user')
    assert.equal(end(of({ needsUser: yes(0.1), small: yes(0.7) })), 'plan-without-refine/small')
    assert.equal(end(of({ needsUser: yes(0.1), small: yes(0.2) })), 'plan/plan')
    assert.equal(end(of({ needsUser: yes(0.1), small: yes(0.2), worth: yes(0.01), supported: yes(0.99) })), 'plan/plan')
    assert.deepEqual([of({ small: yes(0.2) }).drop, of({ small: yes(0.2) }).do, of({ small: yes(0.2) }).confidence], [null, null, 0.8])
  })

  it('keeps two confidences: that it is worth doing, and the strongest case against it', () => {
    assert.deepEqual([IGNORE_LINE, NEEDS_USER_LINE, DROP_LINE, DO_LINE, SMALL_LINE], [0.9, 0.5, 0.8, 0.8, 0.6])
    const v = verdictOf(judged({ worth: yes(0.85), supported: yes(0.3), rejected: yes(0.1) }))
    assert.deepEqual([v.drop, v.do, v.confidence], [0.3, 0.85, 0.85])
    assert.deepEqual([v.verdict, v.reason], ['plan', 'plan'])
    const low = verdictOf(judged({ worth: yes(0.4) }))
    assert.deepEqual([low.drop, low.do, low.reason], [0.6, 0.4, 'unsure'])
  })

  it('ignores on a fact first, then holds what needs the user, then weighs its worth', () => {
    assert.equal(end({ supported: yes(0.95), needsUser: yes(0.9) }), 'skip/supported')
    assert.equal(end({ needsUser: yes(0.6), worth: yes(0.05) }), 'human-review/needs-user')
    assert.equal(end({ worth: yes(0.05), small: yes(0.9) }), 'skip/low-value')
  })

  it('draws each line at its own value', () => {
    assert.equal(end({ supported: yes(0.9) }), 'skip/supported')
    assert.equal(end({ supported: yes(0.89) }), 'plan/plan')
    assert.equal(end({ duplicate: owned(0.9) }), 'skip/duplicate')
    assert.equal(end({ duplicate: owned(0.89) }), 'plan/plan')
    assert.equal(end({ needsUser: yes(0.5) }), 'human-review/needs-user')
    assert.equal(end({ needsUser: yes(0.49) }), 'plan/plan')
    assert.equal(end({ worth: yes(0.2) }), 'skip/low-value')
    assert.equal(end({ worth: yes(0.21) }), 'human-review/unsure')
    assert.equal(end({ worth: yes(0.79) }), 'human-review/unsure')
    assert.equal(end({ worth: yes(0.8) }), 'plan/plan')
    assert.equal(end({ small: yes(0.6) }), 'plan-without-refine/small')
    assert.equal(end({ small: yes(0.59) }), 'plan/plan')
  })

  it('ignores for the likeliest fact, naming the card only for a duplicate', () => {
    const dup = verdictOf(judged({ supported: yes(0.92), duplicate: owned(0.95) }))
    assert.deepEqual([dup.verdict, dup.reason, dup.card, dup.confidence], ['skip', 'duplicate', 1180, 0.95])
    const done = verdictOf(judged({ supported: yes(0.96), duplicate: owned(0.95) }))
    assert.deepEqual([done.verdict, done.reason, done.card], ['skip', 'supported', null])
  })

  it('reads the pick and its confidence when no probabilities came', () => {
    assert.equal(CONFIDENT, 0.6)
    assert.equal(end({ supported: choice('yes', 0.9) }), 'skip/supported')
    assert.equal(end({ supported: choice('yes', 0.89) }), 'plan/plan')
    assert.equal(end({ supported: { choice: 'yes', confidence: 0.9, probabilities: {} } }), 'skip/supported')
    assert.equal(end({ worth: choice('no', 0.8) }), 'skip/low-value')
    assert.equal(end({ worth: choice('yes', 0.8) }), 'plan/plan')
    assert.equal(end({ duplicate: choice('#1180', 0.9) }), 'skip/duplicate')
    assert.equal(end({ duplicate: choice('#1180', 0.89) }), 'plan/plan')
  })

  it('says which way a held item leans, the worth-doing way when the two are level', () => {
    const words = (drop: number | null, worth: number | null): string => reasonWords({ reason: 'unsure', card: null, drop, do: worth })
    assert.equal(words(0.4, 0.57), 'likely worth doing, 57% sure')
    assert.equal(words(0.48, 0.3), 'likely to ignore, 48% sure')
    assert.equal(words(0.45, 0.45), 'likely worth doing, 45% sure')
    assert.equal(words(null, null), 'unsure')
  })

  it('names the duplicated card, and none when Jev picked none', () => {
    const named = verdictOf(judged({ duplicate: owned(0.95) }))
    assert.equal(named.card, 1180)
    assert.equal(reasonWords(named), 'duplicates #1180')
    assert.equal(reasonWords({ reason: 'duplicate', card: null, drop: 0.9, do: 0.1 }), 'duplicates an open card')
    assert.equal(end({ duplicate: odds('none', { none: 0.05, '#1180': 0.5, '#7': 0.45 }) }), 'plan/plan')
    assert.equal(verdictOf(judged({ duplicate: owned(0.5) })).card, null)
  })
})

describe('the questions', () => {
  it('asks ten of a fresh item, with the cards, modules and workflows this board has', () => {
    card(7, 'Themes')
    const asked = questionsFor([{ id: 7, title: 'Themes', file: '' }]) as Record<string, { criteria: Record<string, string> }>
    assert.deepEqual(Object.keys(asked), ['worth', 'supported', 'rejected', 'duplicate', 'needsUser', 'small', 'modules', 'priority', 'roi', 'workflow'])
    for (const name of ['worth', 'supported', 'rejected', 'needsUser', 'small']) assert.deepEqual(Object.keys(asked[name]!.criteria), ['yes', 'no'])
    assert.deepEqual(asked.duplicate!.criteria, { '#7': 'Themes', none: 'no open card owns this work.' })
    assert.deepEqual(asked.modules!.criteria, { skill: 'the board machinery. `cli/`.', docs: 'the user guides.' })
    assert.deepEqual(Object.keys(asked.priority!.criteria), ['high', 'med', 'low'])
    assert.deepEqual(Object.keys(asked.roi!.criteria), ['high', 'med', 'low'])
    assert.equal(asked.workflow!.criteria.coding, 'Plan and implement software changes.')
    assert.match(asked.workflow!.criteria['blog-post']!, /full article/)
    assert.equal(asked.workflow!.criteria.none, 'no workflow here can do this work.')
  })

  it('asks only what the card needs of an item already judged worth one', () => {
    assert.deepEqual(Object.keys(questionsFor([], 'card')), ['modules', 'priority', 'roi', 'workflow'])
  })

  it("asks a proposer's item only whether it needs the user, its size and its card", () => {
    assert.deepEqual(Object.keys(questionsFor([], 'proposer')), ['needsUser', 'small', 'modules', 'priority', 'roi', 'workflow'])
  })

  it('leaves the module question out when there are not two modules to pick from', () => {
    fs.rmSync(path.join(kanban(), 'modules.md'))
    assert.deepEqual(Object.keys(questionsFor([], 'card')), ['priority', 'roi', 'workflow'])
  })

  it('reads the picks, falling back where Jev was unsure or off the list', () => {
    const picks = (more: Record<string, Answer>) =>
      picksOf({ modules: choice('docs'), priority: choice('high'), roi: choice('low'), workflow: choice('blog-post'), ...more })
    assert.deepEqual(picks({}), { modules: ['docs'], priority: 'high', roi: 'low', workflow: 'blog-post' })
    assert.equal(picks({ workflow: choice('none') }).workflow, null)
    assert.equal(picks({ workflow: choice('none', 0.59) }).workflow, '')
    assert.equal(picks({ workflow: choice('blog-post', 0.59) }).workflow, '')
    assert.equal(picks({ workflow: choice('made-up') }).workflow, '')
    assert.deepEqual(picks({ modules: choice('made-up') }).modules, [])
    assert.deepEqual(picksOf({}), { modules: [], priority: 'med', roi: 'med', workflow: '' })
  })
})

describe('the state', () => {
  it('carries the item, the product, the decisions and every rejected.md — and no card', async () => {
    const id = await waiting('Dark mode')
    card(7, 'Themes')
    write(path.join(kanban(), 'memory', 'project.md'), '# Project\n\nA board.\n')
    write(path.join(planner(), 'decisions.md'), '# Decisions\n\n- keep it plain\n')
    write(path.join(planner(), 'rejected.md'), '# Rejected\n\n- a database\n')
    write(path.join(planner(), 'cloud', 'rejected.md'), '# Rejected\n\n- a second cloud\n')
    const { state, trimmed } = judgementState(item(id), questionsFor([]))
    assert.match(String(state.item), /The words of Dark mode/)
    assert.match(String(state.item), /source_id:/)
    assert.match(String(state.product), /A board/)
    assert.match(String(state.decisions), /keep it plain/)
    assert.match(String(state['docs/kanban/memory/agents/planner/rejected.md']), /a database/)
    assert.match(String(state['docs/kanban/memory/agents/planner/cloud/rejected.md']), /a second cloud/)
    assert.equal(state.cards, undefined)
    assert.equal(state.readme, undefined)
    assert.deepEqual(trimmed, [])
  })

  it("gives a proposer's item no rejected.md", () => {
    write(path.join(planner(), 'decisions.md'), '# Decisions\n\n- keep it plain\n')
    write(path.join(planner(), 'rejected.md'), '# Rejected\n\n- a database\n')
    const { state } = judgementState(item(addedBy('proposer', 'Dark mode')), questionsFor([], 'proposer'))
    assert.match(String(state.decisions), /keep it plain/)
    assert.equal(state['docs/kanban/memory/agents/planner/rejected.md'], undefined)
    const other = judgementState(item(addedBy('qa-manager', 'Light mode')), questionsFor([])).state
    assert.match(String(other['docs/kanban/memory/agents/planner/rejected.md']), /a database/)
  })

  it('reads the README when the product description is empty, and judges with no decisions', async () => {
    const id = await waiting('Dark mode')
    write(path.join(kanban(), 'memory', 'project.md'), "# Project\n\nWhat the project is today, from its users' side. Rewritten whole by `akb describe-project`;\nedits here do not last.\n")
    write(path.join(root, 'README.md'), '# The project\n\nIt sorts cards.\n')
    const { state } = judgementState(item(id), questionsFor([]))
    assert.match(String(state.readme), /It sorts cards/)
    assert.equal(state.product, undefined)
    assert.equal(state.decisions, undefined)
  })

  it('cuts to fit in order — the README, then the oldest memory — and never the item', async () => {
    const id = await waiting('Dark mode')
    const big = (n: number) => 'x'.repeat(n)
    const questions = questionsFor([])
    write(path.join(root, 'README.md'), `# Readme\n\n${big(60_000)}\n`)
    const lines = Array.from({ length: 300 }, (_, i) => `- entry ${i} ${big(200)}`)
    write(path.join(planner(), 'rejected.md'), `# Rejected\n\n${lines.join('\n')}\n`)

    const { state, trimmed } = judgementState(item(id), questions)
    assert.ok(tokensOf({ state, questions }) <= MAX_TOKENS)
    assert.deepEqual(trimmed, ['README.md — its second half', 'docs/kanban/memory/agents/planner/rejected.md — its oldest entries'])
    const kept = String(state['docs/kanban/memory/agents/planner/rejected.md'])
    assert.doesNotMatch(kept, /entry 0 /)
    assert.match(kept, /entry 299 /)
    assert.match(String(state.item), /The words of Dark mode/)
  })
})

describe("a new item's file name", () => {
  it('is the slug its writer gave, the endpoint sent, or the title made', async () => {
    await waiting('导出看板为 CSV', 'Export board as CSV')
    await waiting('Dark mode for the board')
    const sent = writeSignal(
      { sourceId: 't3_a', title: 'Whatever it says', summary: 'Words.', sourceType: '', meta: [], url: '', collectedAt: '2026-10-01 09:00' },
      '2026-10-01 09:00',
      'from-the-endpoint',
    )
    const names = fs.readdirSync(path.join(kanban(), 'triage')).filter((name) => name.endsWith('.md')).sort()
    assert.deepEqual(names, ['dark-mode-for-the-board.md', 'export-board-as-csv.md', 'from-the-endpoint.md'])
    assert.equal(sent.relPath, 'docs/kanban/triage/from-the-endpoint.md')
  })

  it('falls back to `item`, and numbers a name already taken', async () => {
    assert.equal(fileName('看板'), 'item.md')
    assert.equal(fileName('看板', '!!'), 'item.md')
    await waiting('Dark mode')
    startCollecting()
    try {
      await triageShut(() => cmdTriageAdd({ title: 'Dark mode', text: 'Another one entirely.' }))
      await triageShut(() => cmdTriageAdd({ title: 'Dark mode', text: 'And a third.' }))
    } finally {
      stopCollecting()
    }
    const names = fs.readdirSync(path.join(kanban(), 'triage')).filter((name) => name.endsWith('.md')).sort()
    assert.deepEqual(names, ['dark-mode-2.md', 'dark-mode-3.md', 'dark-mode.md'])
  })
})

describe('the sort', () => {
  it('asks Cloud once per item and writes the card from the item and the picks', async () => {
    signIn(true)
    card(7, 'Themes')
    const id = await waiting('写一篇暗色模式的博客', 'dark-mode-blog-post')
    answer(jev())
    const { report, said } = await sort()

    assert.equal(sent.length, 1)
    assert.equal(sent[0]!.url, `${API}/v1/judge`)
    assert.deepEqual(Object.keys(sent[0]!.body.questions), ['worth', 'supported', 'rejected', 'duplicate', 'needsUser', 'small', 'modules', 'priority', 'roi', 'workflow'])
    assert.equal(sent[0]!.body.state.cards, undefined)
    assert.deepEqual(report.cards, [{ id: 100, title: '写一篇暗色模式的博客' }])
    assert.deepEqual(said, ['#100 写一篇暗色模式的博客', 'sorted 1 item: 1 card, 0 ignored, 0 left for you'])

    assert.deepEqual(cardFiles(), ['100-dark-mode-blog-post.md', '7-card-7.md'])
    const text = cardText('100-dark-mode-blog-post.md')
    assert.match(text, /^title: "?写一篇暗色模式的博客"?$/m)
    assert.match(text, /^priority: high$/m)
    assert.match(text, /^roi: low$/m)
    assert.match(text, /^status: todo$/m)
    assert.match(text, /^modules: \[docs\]$/m)
    assert.match(text, /^workflow: blog-post$/m)
    assert.match(text, new RegExp(`^triage: ${id}$`, 'm'))
    assert.match(text, /^schedule:/m)
    assert.match(text, /\n\nThe words of 写一篇暗色模式的博客\.\n\n## Worth noting\n\n<!-- agent -->\n\n## Scope\n\n## Todo\n- \[ \] every task must have todos[^\n]*\n\n## Decided by the agent\n\n### Overruled by the user\n$/)
    assert.doesNotMatch(text, /## Source/)

    const filed = item(id)
    assert.deepEqual([filed.verdict, filed.verdictReason, filed.cardId], ['plan', 'plan', 100])
    assert.match(filed.relPath, /triage\/archived\/dark-mode-blog-post\.md$/)
    const valid = await akb(['validate', '100'], runBoard)
    assert.equal(valid.code, 0, valid.err + valid.out)
  })

  it("cards a proposer's item Jev would have ignored, and holds one that needs the user", async () => {
    signIn(true)
    card(7, 'Themes')
    const carded = addedBy('proposer', 'Dark mode')
    answer(jev({ worth: yes(0.01), supported: yes(0.99) }))
    const first = await sort()
    assert.deepEqual(Object.keys(sent[0]!.body.questions), ['needsUser', 'small', 'modules', 'priority', 'roi', 'workflow'])
    assert.deepEqual(first.report.cards, [{ id: 100, title: 'Dark mode' }])
    assert.deepEqual([item(carded).verdict, item(carded).verdictReason], ['plan', 'plan'])

    const held = addedBy('proposer', 'Pricing')
    answer(jev({ needsUser: yes(0.9) }))
    const second = await sort()
    assert.deepEqual(second.report.held, [{ title: 'Pricing', reason: 'needs your direction' }])
    assert.deepEqual([item(held).verdict, item(held).verdictReason], ['human-review', 'needs-user'])
  })

  it("judges another agent's item in full", async () => {
    signIn(true)
    const id = addedBy('qa-manager', 'Dark mode')
    answer(jev({ supported: yes(0.99) }))
    const { report } = await sort()
    assert.equal(Object.keys(sent[0]!.body.questions).length, 10)
    assert.equal(report.ignored.length, 1)
    assert.deepEqual([item(id).verdict, item(id).verdictReason], ['skip', 'supported'])
  })

  it('schedules a refine on a small card too, and writes no Source section', async () => {
    signIn(true)
    startCollecting()
    try {
      await triageShut(() => cmdTriageAdd({ title: 'Small fix', text: 'https://example.test/post' }))
    } finally {
      stopCollecting()
    }
    answer(jev({ small: yes(0.9) }))
    await sort()
    const text = cardText('100-small-fix.md')
    assert.match(text, /^status: todo$/m)
    assert.match(text, /^schedule:/m)
    assert.match(text, /## Worth noting\n\n<!-- agent -->/)
    assert.equal(item(readArchived()[0]!.sourceId).verdict, 'plan-without-refine')
  })

  it('fences an item whose own words would break the card', async () => {
    signIn(true)
    startCollecting()
    try {
      await triageShut(() => cmdTriageAdd({ title: 'A long one', text: 'Intro.\n\n## Scope\n\n```js\nrun()\n```\n' }))
    } finally {
      stopCollecting()
    }
    answer(jev())
    await sort()
    assert.match(cardText('100-a-long-one.md'), /\n\n````\nIntro\.\n\n## Scope\n\n```js\nrun\(\)\n```\n````\n\n## Worth noting\n/)
    const valid = await akb(['validate', '100'], runBoard)
    assert.equal(valid.code, 0, valid.err + valid.out)
  })

  it('names the card of an item written before #1263 after its old file', async () => {
    signIn(true)
    write(
      path.join(kanban(), 'triage', '2026-10-01-pro-pro-4e3a3454.md'),
      '---\nsource_id: old-1\ntitle: Pro 的 Pro\ncollected_at: "2026-10-01 09:00"\nimported_at: "2026-10-01 09:00"\n---\n\nIts words.\n',
    )
    answer(jev())
    await sort()
    assert.deepEqual(cardFiles(), ['100-2026-10-01-pro-pro-4e3a3454.md'])
    assert.match(cardText('100-2026-10-01-pro-pro-4e3a3454.md'), /^title: "?Pro 的 Pro"?$/m)
  })

  it('ignores a skip in the agent’s name with its reason, and holds what is the user’s', async () => {
    signIn(true)
    card(1180, 'Themes')
    const dup = await waiting('Dark mode')
    answer(jev({ duplicate: odds('#1180', { '#1180': 0.92, none: 0.08 }) }))
    let done = await sort()
    assert.deepEqual(done.report.ignored, [{ title: 'Dark mode', reason: 'duplicates #1180' }])
    assert.deepEqual(done.said, ['ignored: Dark mode — duplicates #1180', 'sorted 1 item: 0 cards, 1 ignored, 0 left for you'])
    const ignored = item(dup)
    assert.deepEqual([ignored.verdict, ignored.verdictReason, ignored.verdictCard], ['skip', 'duplicate', 1180])
    assert.deepEqual([ignored.dismissedBy, ignored.dismissedReason], ['agent', 'duplicates #1180'])
    const kept = fs.readFileSync(path.join(root, ignored.relPath), 'utf8')
    assert.match(kept, /verdict_confidence: "?0.92"?/)
    assert.match(kept, /drop_confidence: "?0.92"?\ndo_confidence: "?0.90"?/)
    assert.deepEqual([ignored.dropConfidence, ignored.doConfidence], [0.92, 0.9])

    const held = await waiting('Direction')
    const unsure = await waiting('Unsure')
    answer(jev({ needsUser: yes(0.7) }))
    await sortItems([held], () => {})
    answer(jev({ worth: yes(0.57), supported: yes(0.4) }))
    const said: string[] = []
    done = { report: await sortItems([unsure], (line) => void said.push(line)), said }
    assert.deepEqual(done.report.held, [{ title: 'Unsure', reason: 'likely worth doing, 57% sure' }])
    assert.equal(said[0], 'left for you: Unsure — likely worth doing, 57% sure')
    assert.deepEqual([item(unsure).verdictReason, item(unsure).dropConfidence, item(unsure).doConfidence], ['unsure', 0.43, 0.57])
    assert.deepEqual([item(held).verdict, item(held).verdictReason], ['human-review', 'needs-user'])
    assert.deepEqual(readInbox().map((one) => one.title).sort(), ['Direction', 'Unsure'])
    assert.deepEqual(triageWaiting(), [])
    assert.deepEqual(cardFiles(), ['1180-card-1180.md'])
  })

  it('ignores an item no workflow can do, and uses the default workflow when unsure', async () => {
    signIn(true)
    const none = await waiting('Record a podcast')
    answer(jev({ workflow: choice('none') }))
    let done = await sort()
    assert.deepEqual(done.report.ignored, [{ title: 'Record a podcast', reason: 'no workflow does it' }])
    assert.deepEqual([item(none).verdict, item(none).verdictReason, item(none).dismissedReason], ['skip', 'no-workflow', 'no workflow does it'])
    assert.deepEqual(cardFiles(), [])

    await waiting('Maybe a blog')
    answer(jev({ workflow: choice('none', 0.5) }))
    done = await sort()
    assert.equal(done.report.cards.length, 1)
    assert.doesNotMatch(cardText('100-maybe-a-blog.md'), /^workflow:/m)
  })

  it('asks only four questions of an item already judged worth a card', async () => {
    signIn(true)
    const id = await waiting('Worth planning')
    const file = path.join(root, item(id).relPath)
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('\n---\n\n', '\nverdict: plan\nverdict_reason: plan\n---\n\n'))
    assert.equal(item(id).verdict, 'plan')
    answer(() => new Response(JSON.stringify({ answers: { modules: choice('skill'), priority: choice('low'), roi: choice('high'), workflow: choice('coding') } }), { status: 200 }))
    const { report } = await sort()
    assert.deepEqual(Object.keys(sent[0]!.body.questions), ['modules', 'priority', 'roi', 'workflow'])
    assert.deepEqual(report.cards, [{ id: 100, title: 'Worth planning' }])
    const text = cardText('100-worth-planning.md')
    assert.match(text, /^modules: \[skill\]$/m)
    assert.doesNotMatch(text, /^workflow:/m)
    assert.equal(item(id).cardId, 100)
  })

  it('leaves an item that failed waiting and goes on to the next', async () => {
    signIn(true)
    await waiting('First')
    await waiting('Second')
    let calls = 0
    globalThis.fetch = (async () => {
      if (calls++ === 0) throw new TypeError('fetch failed')
      return jev()()
    }) as typeof fetch
    const { report, said } = await sort()
    assert.equal(report.failed.length, 1)
    assert.match(report.failed[0]!.why, /Cloud could not be reached/)
    assert.equal(report.cards.length, 1)
    assert.match(said.at(-1)!, /^sorted 1 item: 1 card, 0 ignored, 0 left for you, 1 failed$/)
    const left = readInbox()
    assert.equal(left.length, 1)
    assert.equal(left[0]!.verdict, '')
    assert.deepEqual(triageWaiting(), [left[0]!.sourceId])
  })

  it('stops on pro_required and forgets the kept Pro answer', async () => {
    signIn(true)
    await waiting('First')
    await waiting('Second')
    answer(() => new Response(JSON.stringify({ error: { code: 'pro_required', message: 'This needs Pro.' } }), { status: 403 }))
    const { report } = await sort()
    assert.equal(sent.length, 1)
    assert.deepEqual(report.failed.map((one) => one.why), ['this account no longer has Pro'])
    assert.equal(fs.existsSync(path.join(home, 'pro.json')), false)
    assert.equal(readInbox().length, 2)
  })

  it('never sends a held or restored item again', async () => {
    signIn(true)
    const fresh = await waiting('Fresh')
    const skipped = await waiting('Supported')
    answer(jev({ supported: yes(0.95) }))
    await sortItems([skipped], () => {})
    startCollecting()
    try {
      cmdTriageRestore(skipped)
    } finally {
      stopCollecting()
    }
    assert.equal(item(skipped).verdict, 'skip')
    assert.deepEqual(triageWaiting(), [fresh])
  })

  it('judges once more an item held as unsure before the two confidences were kept', async () => {
    signIn(true)
    const legacy = await waiting('Legacy')
    const direction = await waiting('Direction')
    // As a sort before #1356 left them: a verdict, and no two confidences.
    const before = (sourceId: string, reason: string): void => {
      const file = path.join(root, item(sourceId).relPath)
      const held = `verdict: human-review\nverdict_reason: ${reason}\nverdict_confidence: "0.40"\n---`
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^---$/m, '').replace(/^---$/m, held).replace(/^/, '---'))
    }
    before(legacy, 'unsure')
    before(direction, 'needs-user')
    assert.deepEqual([item(legacy).verdict, item(legacy).dropConfidence], ['human-review', null])
    assert.deepEqual([awaitsJudging(item(legacy)), awaitsJudging(item(direction))], [true, false])
    assert.deepEqual(triageWaiting(), [legacy])

    answer(jev({ worth: yes(0.3), rejected: yes(0.45) }))
    const done = await sort()
    assert.deepEqual(done.report.held, [{ title: 'Legacy', reason: 'likely to ignore, 70% sure' }])
    assert.equal(sent.filter((one) => one.url.endsWith('/v1/judge')).length, 1)
    assert.deepEqual([item(legacy).dropConfidence, item(legacy).doConfidence], [0.7, 0.3])
    assert.deepEqual(triageWaiting(), [])
  })
})

describe('a sort as a run', () => {
  it('archives a card written before a stop onto its item, rather than carding it twice', async () => {
    signIn(true)
    const id = await waiting('Worth planning')
    write(path.join(todo(), '101-card-101.md'), `---\ntitle: Worth planning\npriority: med\nroi: med\nstatus: todo\ntriage: ${id}\n---\n\nWhat it does.\n`)
    answer(jev())
    const opened = await openSort()
    assert.ok(!('error' in opened))
    const said: string[] = []
    const report = await runSort(opened.run.sessionId, (line) => void said.push(line))

    assert.equal(sent.filter((one) => one.url.endsWith('/v1/judge')).length, 0)
    assert.deepEqual(report!.cards, [])
    assert.match(said[0]!, new RegExp(`^${id} is already on #101 — archived: `))
    assert.equal(item(id).cardId, 101)
    assert.deepEqual(cardFiles(), ['101-card-101.md'])
  })

  it('runs one at a time, writes its report to the log, and closes done', async () => {
    signIn(true)
    await waiting('Dark mode')
    answer(jev())
    const opened = await openSort()
    assert.ok(!('error' in opened))
    const second = await openSort()
    assert.equal('error' in second ? second.error : '', 'triage is already being sorted')
    assert.equal(opened.run.harness, 'jev')

    await runSort(opened.run.sessionId)
    const run = readRuns().find((one) => one.sessionId === opened.run.sessionId)!
    assert.deepEqual([run.status, run.ok], ['done', true])
    assert.match(fs.readFileSync(run.logPath, 'utf8'), /^#100 Dark mode\nsorted 1 item: 1 card, 0 ignored, 0 left for you\n$/)
  })

  it('closes as failed when nothing could be judged', async () => {
    signIn(true)
    await waiting('Dark mode')
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    const opened = await openSort()
    assert.ok(!('error' in opened))
    await runSort(opened.run.sessionId)
    const run = readRuns().find((one) => one.sessionId === opened.run.sessionId)!
    assert.equal(run.status, 'error')
    assert.match(run.error ?? '', /Cloud could not be reached/)
    assert.equal(readInbox().length, 1)
  })
})

describe('akb triage run', () => {
  it('sorts in the command and prints the report', async () => {
    signIn(true)
    await waiting('Dark mode')
    const skip = await waiting('Already there')
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null
      return jev(String(body?.state?.item ?? '').includes(skip) ? { supported: yes(0.95) } : {})()
    }) as typeof fetch
    const { code, out, err } = await akb(['triage', 'run'])
    assert.equal(code, 0, err)
    assert.match(out, /#100 Dark mode/)
    assert.match(out, /ignored: Already there — already supported/)
    assert.match(out, /sorted 2 items: 1 card, 1 ignored, 0 left for you/)
  })

  it('is refused without Pro, and has no judge beside it', async () => {
    signIn(false)
    globalThis.fetch = (async () => new Response(JSON.stringify({ billing: { plan: 'free', periodEnd: null } }), { status: 200 })) as typeof fetch
    const refused = await akb(['triage', 'run'])
    assert.notEqual(refused.code, 0)
    assert.match(refused.err, /Sorting triage needs Pro/)
    assert.notEqual((await akb(['triage', 'judge', 'x'])).code, 0)
  })
})
