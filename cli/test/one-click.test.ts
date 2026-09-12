// One Implement click, from the card to landed and off the board (#307).
//
// Three things are asked here, and all three are about the ends of the flow: the card is
// completed by the BOARD once its delivery has landed and not by the review that passed it,
// a card with an open question holds outside the landing queue until it is answered, and an
// answer that changed what the card asks for starts a fresh delivery instead of landing the
// old one.
//
// A real git repository with real worktrees, like the landing tests: every question below
// ends in what the target branch holds and what is left on the board.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { recordAnswer } from '../src/lib/agent/answers.ts'
import {
  activeDelivery,
  adoptDirectCard,
  answeredReview,
  findDelivery,
  listDeliveries,
  openQuestions,
} from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { advanceLanding } from '../src/lib/agent/landing.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { claimCard, closeRun, discardDelivery, openRun, peekRun, stopRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit } from '../src/lib/agent/settings.ts'
import { withStore } from '../src/lib/agent/store.ts'
import type { AgentAction, DeliveryRecord } from '../src/lib/agent/types.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import { board } from '../src/lib/board/index.ts'
import { PLANS, SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { move } from './helpers/board.ts'
import { findCard } from '../src/lib/view/read.ts'

let root = ''

const cardText = (
  id: number,
  title: string,
  questions: string[] = [],
  scope = 'a requirement',
  status = 'ready',
  // `## Worth noting after implementation` — decisions the build's own review settled, which
  // sit outside the approved copy and travel to the next delivery on the card (#637).
  notes: string[] = [],
): string =>
  [
    '---',
    `title: ${title}`,
    'priority: med',
    'roi: med',
    `status: ${status}`,
    'release: ""',
    'blocked_by: []',
    'related: []',
    'modules: []',
    questions.length ? `questions:\n${questions.map((q) => `  - ${JSON.stringify(q)}`).join('\n')}` : 'questions: []',
    '---',
    '',
    'What this card is for.',
    '',
    ...(notes.length ? ['## Worth noting after implementation', ...notes, ''] : []),
    '<!-- agent -->',
    '',
    '## Scope',
    `- **A requirement**: ${scope}.`,
    '',
  ].join('\n')

const cardPath = (id: number): string => path.join(root, 'docs', 'kanban', 'todo', 'features', `${id}-card.md`)

const git = (args: string[], cwd = root): string => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-one-click-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'README.md'), '# Open tasks\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '9\n')
  fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  fs.writeFileSync(cardPath(1), cardText(1, 'card one'))
  fs.writeFileSync(cardPath(2), cardText(2, 'card two'))
  setAutoCommit(true)
  delete process.env[RUN_ENV]
})

afterEach(() => {
  delete process.env[RUN_ENV]
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

// Build a card and pass its review — everything one click does before landing.
async function reviewed(id: number, title: string, text: string, file = 'shared.txt'): Promise<DeliveryRecord> {
  const built = run('implement', id, title)
  const delivery = activeDelivery(id)!
  // Auto mode builds in a worktree of its own; manual mode is the user's own checkout.
  fs.writeFileSync(path.join(delivery.worktree ? worktreeDir(delivery.worktree) : root, file), text)
  await end(built)
  await passReview(id, title)
  return delivery
}

const landingOf = (deliveryId: string): DeliveryRecord['landing'] =>
  listDeliveries().find((d) => d.deliveryId === deliveryId)?.landing

const log = (ref = 'main'): string[] => git(['log', '--format=%s', ref]).split('\n')

const archived = (id: number): boolean =>
  fs.existsSync(path.join(root, 'docs', 'kanban', '.archive', `${id}-card.md`))

const setStatus = (id: number, status: string): void =>
  fs.writeFileSync(cardPath(id), fs.readFileSync(cardPath(id), 'utf8').replace(/^status: .*$/m, `status: ${status}`))

// What the run that applied the answers concluded about them (#637). The board reads this
// rather than the card's text, so nothing carries on or reopens until it is written.
const said = (id: number, outcome: 'unchanged' | 'changed', why = 'what it is building is unchanged'): void => {
  recordAnswer(activeDelivery(id)!.deliveryId, outcome, why)
}

// The card as it reads once the question has been answered and the answer moved the plan.
const answered = (id: number, scope: string, status = 'ready'): void => {
  said(id, 'changed', 'the requirement it was approved to build is a different one now')
  fs.writeFileSync(cardPath(id), cardText(id, 'card one', [], scope, status))
}

describe('completion is the last step', () => {
  it('leaves the card on the board while review passes, and archives it once it has landed', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    // Review passed, and the card is still there: the code has not landed yet.
    assert.equal(fs.existsSync(cardPath(1)), true)
    assert.equal(landingOf(delivery.deliveryId)?.status, 'waiting')

    await advanceLanding()

    assert.deepEqual(log(), ['card one (#1)', 'start'])
    assert.equal(fs.existsSync(cardPath(1)), false)
    assert.equal(archived(1), true)
  })

  it('archives a card whose delivery passed review having changed nothing', async () => {
    const built = run('implement', 1, 'card one')
    await end(built)
    const review = run('review', 1, 'card one')
    await end(review)

    await advanceLanding()
    assert.deepEqual(log(), ['start'])
    assert.equal(archived(1), true)
  })
})

describe('a card with an open question', () => {
  it('holds at landing, takes no slot, and lands once the question is answered', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const held = await reviewed(1, 'card one', 'one\n')
    const other = await reviewed(2, 'card two', 'two\n', 'other.txt')

    await advanceLanding()
    // The held card is still on the board and still on its own branch; the other card
    // went past it and landed, so the hold cost the queue nothing.
    assert.equal(fs.existsSync(cardPath(1)), true)
    assert.equal(landingOf(held.deliveryId)?.status, 'waiting')
    assert.match(landingOf(held.deliveryId)?.why ?? '', /open question/)
    assert.equal(landingOf(other.deliveryId)?.status, 'landed')
    assert.deepEqual(log(), ['card two (#2)', 'start'])

    // The card page says what it waits on and what answers it.
    const state = deliveryState(listDeliveries().find((d) => d.deliveryId === held.deliveryId)!, 1)
    assert.equal(state.stage, 'held')
    assert.equal(state.label, 'Held at landing')
    assert.equal(state.paused, true)

    // Answered — the same delivery carries on, with no second click.
    fs.writeFileSync(cardPath(1), cardText(1, 'card one'))
    said(1, 'unchanged')
    assert.equal(openQuestions(1), 0)
    // The other card landed in a file this one never touched, so the rebase keeps the
    // review it passed and the same pass lands it.
    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(held.deliveryId)?.status, 'landed')
    assert.equal(archived(1), true)
  })

  it('says so before it starts, and warns rather than refusing', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    assert.equal(findCard(1)?.questions.length, 1)
    const built = run('implement', 1, 'card one')
    // The click still starts the delivery: the question is a reason not to LAND one.
    assert.equal(activeDelivery(1)?.deliveryId !== undefined, true)
    await end(built)
  })
})

describe('an answer that changed the plan', () => {
  it('ends the held delivery and starts a fresh one on the card as it now reads', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const first = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    assert.equal(landingOf(first.deliveryId)?.status, 'waiting')

    // Answered, and the answer rewrote what the card asks for.
    said(1, 'changed', 'the requirement it was approved to build is a different one now')
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', [], 'a different requirement'))
    const wants = await advanceLanding()

    assert.deepEqual(wants, { action: 'implement', id: 1, title: 'card one' })
    const ended = listDeliveries().find((d) => d.deliveryId === first.deliveryId)!
    assert.equal(ended.status, 'cancelled')
    assert.equal(ended.steps[ended.steps.length - 1]?.step, 'superseded')
    // Nothing landed, and the card is still on the board for the fresh delivery to build.
    assert.deepEqual(log(), ['start'])
    assert.equal(fs.existsSync(cardPath(1)), true)
  })

  it('hands the card back to the stage it had, so nothing rests at implementing', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    await reviewed(1, 'card one', 'one\n')
    await advanceLanding()

    // The delivery put `implementing` on the card, the way its first run does.
    setStatus(1, 'implementing')
    answered(1, 'a different requirement', 'implementing')
    await advanceLanding()

    // Back to `ready` — the stage the delivery found. A card left at `implementing` with no
    // delivery on it is one nothing on the board would ever pick up.
    assert.match(fs.readFileSync(cardPath(1), 'utf8'), /^status: ready$/m)

    // And a card a supersede written down before the hand-back existed left stuck there is
    // put back too, rather than needing a board command by hand.
    setStatus(1, 'implementing')
    await advanceLanding()
    assert.match(fs.readFileSync(cardPath(1), 'utf8'), /^status: ready$/m)
  })

  it('offers the fresh delivery again until one actually starts', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    answered(1, 'a different requirement')

    const wants = { action: 'implement', id: 1, title: 'card one' }
    assert.deepEqual(await advanceLanding(), wants)
    // Nobody started it — a dirty checkout, a board that was closed, a refusal nobody read.
    // The next pass asks again rather than losing the card.
    assert.deepEqual(await advanceLanding(), wants)
    assert.deepEqual(await advanceLanding(), wants)

    // And stops the moment a delivery does open on the card.
    const built = run('implement', 1, 'card one')
    assert.equal(await advanceLanding(), null)
    await end(built)
    assert.equal(await advanceLanding(), null)
  })

  it('drops the fresh delivery when the user discards the superseded one instead', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const first = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    answered(1, 'a different requirement')
    assert.deepEqual(await advanceLanding(), { action: 'implement', id: 1, title: 'card one' })

    // Discard is the user asking for the card back — the board must not build it anyway.
    assert.equal((await discardDelivery(first.deliveryId)).ok, true)
    assert.equal(await advanceLanding(), null)
  })

  it('carries the same delivery on when the answer left the plan alone', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const first = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()

    fs.writeFileSync(cardPath(1), cardText(1, 'card one'))
    said(1, 'unchanged')
    assert.equal(await advanceLanding(), null)

    assert.equal(listDeliveries().find((d) => d.deliveryId === first.deliveryId)?.status, 'finished')
    assert.deepEqual(log(), ['card one (#1)', 'start'])
    assert.equal(archived(1), true)
  })

  // What the answer DID is read, never worked out from the card's text (#637). The two cases
  // that used to get it wrong are the ones the board now gets from the run that applied it.
  it('lands a build whose answer rewrote the card without changing what it asks for', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const first = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()

    // Every approved section reads differently, and none of it asks for anything new: the
    // wording was tidied and the decision already on the card was written down again.
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', [], 'a requirement, said more plainly'))
    said(1, 'unchanged', 'the wording moved; what it asks for did not')
    assert.equal(await advanceLanding(), null)

    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.equal(archived(1), true)
  })

  it('reopens a build whose answer changed it even when the card reads the same', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    await reviewed(1, 'card one', 'one\n')
    await advanceLanding()

    // The card's approved sections are byte for byte what the delivery froze — the answer
    // landed in a spec section's wording — and the answer still changed a requirement.
    said(1, 'changed', 'the answer picked the behaviour the approved copy rules out')
    fs.writeFileSync(cardPath(1), cardText(1, 'card one'))
    assert.deepEqual(await advanceLanding(), { action: 'implement', id: 1, title: 'card one' })
    assert.deepEqual(log(), ['start'])
  })

  it('reopens once, however many passes look at it', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const first = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    answered(1, 'a different requirement')

    await advanceLanding()
    const ended = listDeliveries().find((d) => d.deliveryId === first.deliveryId)!
    assert.equal(ended.steps.filter((s) => s.step === 'superseded').length, 1)
    // Every pass after it offers the same restart rather than superseding again — the
    // conclusion was taken when it was acted on.
    await advanceLanding()
    assert.equal(ended.answers?.every((a) => a.actedAt), true)
    assert.equal(
      listDeliveries().find((d) => d.deliveryId === first.deliveryId)!.steps.filter((s) => s.step === 'superseded').length,
      1,
    )
  })

  it('holds, lands nothing and says what settles it when no run judged the answers', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const first = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()

    // Answered by hand in the card file, so nothing recorded what it did.
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', [], 'a different requirement'))
    assert.equal(await advanceLanding(), null)

    // Not landed, not cancelled: the board waits to be told rather than comparing text.
    assert.equal(landingOf(first.deliveryId)?.status, 'waiting')
    assert.match(landingOf(first.deliveryId)?.why ?? '', /delivery answered/)
    assert.equal(listDeliveries().find((d) => d.deliveryId === first.deliveryId)?.status, 'active')
    assert.deepEqual(log(), ['start'])
    const state = deliveryState(listDeliveries().find((d) => d.deliveryId === first.deliveryId)!, 0)
    assert.equal(state.paused, true)
    assert.match(state.line, /delivery answered/)

    // And carries straight on once it is.
    said(1, 'changed', 'the requirement it was approved to build is a different one now')
    assert.deepEqual(await advanceLanding(), { action: 'implement', id: 1, title: 'card one' })
  })

  it('keeps a real change from being answered away by the round after it', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    await reviewed(1, 'card one', 'one\n')
    await advanceLanding()

    said(1, 'changed', 'the first round dropped a requirement')
    said(1, 'unchanged', 'the second only tidied the wording')
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', [], 'a different requirement'))
    assert.deepEqual(await advanceLanding(), { action: 'implement', id: 1, title: 'card one' })
  })

  it('starts the fresh delivery with no conclusion of its own', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    answered(1, 'a different requirement')
    await advanceLanding()

    const next = run('implement', 1, 'card one')
    assert.equal(activeDelivery(1)?.answers, undefined)
    await end(next)
  })

  // The other wait on the same answers: review stopped to ask, so the delivery has no landing
  // record at all. One conclusion covers both (#637).
  it('reopens a delivery its own review stopped, once the answer is judged a change', async () => {
    const built = run('implement', 1, 'card one')
    const first = activeDelivery(1)!
    fs.writeFileSync(path.join(worktreeDir(first.worktree!), 'shared.txt'), 'one\n')
    await end(built)

    // Review appends a decision for the user and stops on it.
    const review = run('review', 1, 'card one')
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    await end(review)
    assert.equal(listDeliveries().find((d) => d.deliveryId === first.deliveryId)?.review?.stopped?.reason, 'ask')
    assert.equal(landingOf(first.deliveryId), undefined)

    said(1, 'changed', 'the answer asks for a behaviour the approved copy rules out')
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', [], 'a different requirement'))
    // Nothing reviews this build against the copy it froze — the landing pass reopens it.
    assert.equal(answeredReview(1), null)
    assert.deepEqual(await advanceLanding(), { action: 'implement', id: 1, title: 'card one' })
    assert.equal(listDeliveries().find((d) => d.deliveryId === first.deliveryId)?.status, 'cancelled')
  })

  it('leaves a delivery nobody asked a question of alone, however the card is edited', async () => {
    const first = await reviewed(1, 'card one', 'one\n')
    // No question was ever open on this card, so no answer is in and nothing is judged: an
    // edit in the user's own editor never reaches any of this.
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', [], 'a different requirement'))
    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
  })

  it('waits while part of the round is still open, conclusion or not', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade?', '[user] and which size?']))
    const first = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()

    // One answered, one still open, and the first round already judged a change.
    said(1, 'changed', 'the first answer dropped a requirement')
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] and which size?'], 'a different requirement'))
    assert.equal(await advanceLanding(), null)
    assert.equal(listDeliveries().find((d) => d.deliveryId === first.deliveryId)?.status, 'active')
    assert.match(landingOf(first.deliveryId)?.why ?? '', /open question/)
    assert.deepEqual(log(), ['start'])
  })

  it('reopens once the rest of that round is answered, whatever the round after it says', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade?', '[user] and which size?']))
    const first = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()

    // A change with a question still open: the pass that holds on that question must not
    // spend the conclusion the supersede is still owed.
    said(1, 'changed', 'the first answer dropped a requirement')
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] and which size?'], 'a different requirement'))
    assert.equal(await advanceLanding(), null)

    // The round that closes the card only tidied the wording, and the change still stands.
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', [], 'a different requirement'))
    said(1, 'unchanged', 'this one only tidied the wording')
    assert.deepEqual(await advanceLanding(), { action: 'implement', id: 1, title: 'card one' })
    assert.equal(listDeliveries().find((d) => d.deliveryId === first.deliveryId)?.status, 'cancelled')
  })

  it('does not let an earlier round answer for a later one', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const first = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    fs.writeFileSync(cardPath(1), cardText(1, 'card one'))
    said(1, 'unchanged')

    // A second question opens before the board acted on the first round, and nothing judged
    // this one. The old conclusion is spent, so the build waits rather than landing on it.
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] and which size?']))
    assert.equal(await advanceLanding(), null)
    fs.writeFileSync(cardPath(1), cardText(1, 'card one'))
    assert.equal(await advanceLanding(), null)

    assert.match(landingOf(first.deliveryId)?.why ?? '', /delivery answered/)
    assert.deepEqual(log(), ['start'])
  })

  it('is unmoved by the delivery writing its own card', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const first = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    fs.writeFileSync(cardPath(1), cardText(1, 'card one'))
    said(1, 'unchanged')

    // A ticked todo and a verify line the build left behind: the delivery's own bookkeeping,
    // written after the copy was frozen and no part of what it was approved to build.
    fs.appendFileSync(cardPath(1), '\n## Todo\n- [x] the one step\n\n')
    await move(root, ['update-verify', '1', '--append', 'check the shade by hand'])
    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
  })

  it('hands the reopened delivery the decisions the card already settled', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    await reviewed(1, 'card one', 'one\n')
    await advanceLanding()

    // The build's review settled this one, so it sits outside the approved copy — and the
    // answer that follows changes a requirement, so a fresh delivery is opened over the top.
    said(1, 'changed', 'the requirement it was approved to build is a different one now')
    fs.writeFileSync(
      cardPath(1),
      cardText(1, 'card one', [], 'a different requirement', 'ready', ['- **Which timeout?**: two seconds.']),
    )
    await advanceLanding()

    const sink = startCollecting()
    try {
      printFlow({ action: 'implement', id: 1, title: 'card one' })
    } finally {
      stopCollecting()
    }
    const flow = sink.out.join('\n')
    assert.match(flow, /Which timeout\?/)
    assert.match(flow, /decisions already settled on this card/)

    // And says none of it on a card that settled nothing — which is most of them.
    const plain = startCollecting()
    try {
      printFlow({ action: 'implement', id: 2, title: 'card two' })
    } finally {
      stopCollecting()
    }
    assert.doesNotMatch(plain.out.join('\n'), /decisions already settled on this card/)
  })
})

// What the pass that applies the answers is given, so it can judge them (#637).
describe('answering a card with a build on it', () => {
  it('hands the resolve the delivery, the copy it is building and the command', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const delivery = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()

    const sink = startCollecting()
    try {
      printFlow({ action: 'resolve', id: 1, title: 'card one' })
    } finally {
      stopCollecting()
    }
    const flow = sink.out.join('\n')
    assert.match(flow, new RegExp(`${delivery.deliveryId} is already building this card`))
    // The copy it froze, so the judgement is made against what was approved…
    assert.match(flow, /what .* is building:[\s\S]*A requirement/)
    // …and both ways to record the conclusion, in the flow and in its closing steps.
    assert.match(flow, new RegExp(`delivery answered ${delivery.deliveryId} --unchanged`))
    assert.match(flow, new RegExp(`delivery answered ${delivery.deliveryId} --changed`))
    assert.match(flow, /before you drop the questions/)

    // A spawned run is told the same thing in its own words.
    assert.match(buildPrompt({ action: 'resolve', id: 1 }), new RegExp(`delivery answered ${delivery.deliveryId}`))
    assert.match(buildPrompt({ action: 'decide', id: 1 }), new RegExp(`delivery answered ${delivery.deliveryId}`))
  })

  it('says none of it on a card nothing is building', () => {
    const sink = startCollecting()
    try {
      printFlow({ action: 'resolve', id: 2, title: 'card two' })
    } finally {
      stopCollecting()
    }
    // The guide still carries the rule — every resolve reads it. What is absent is this
    // board's own answer: no delivery, no copy to judge against, no closing step.
    assert.doesNotMatch(sink.out.join('\n'), /is already building this card/)
    assert.doesNotMatch(buildPrompt({ action: 'resolve', id: 2 }), /delivery answered/)
  })
})

// The #613 case: a **Build now** starts from a typed sentence and writes its own card, so the
// copy it froze and the card it is judged against are two different documents. Nothing
// compares them any more (#637) — the conclusion is the same one either way in.
describe('a build that wrote its own card', () => {
  const TYPED = 'add a widget'
  const PLAN = '# Add a widget\n\nThe whole plan, in a file of its own.\n'

  // A **Build now** off a typed sentence, and one off a plan — the two ways in, and the
  // only difference between them is where the words came from.
  async function wrote(from: 'sentence' | 'plan'): Promise<DeliveryRecord> {
    let opened
    if (from === 'plan') {
      fs.mkdirSync(PLANS, { recursive: true })
      fs.writeFileSync(path.join(PLANS, '7-a-widget.md'), PLAN)
      opened = openRun({ action: 'implement', plan: 'plans/7-a-widget.md' }, 'prompt', [])
    } else {
      opened = openRun({ action: 'implement', description: TYPED }, 'prompt', [])
    }
    if ('error' in opened) throw new Error(opened.error)
    const deliveryId = opened.run.deliveryId as string
    // The copy it froze is the words it was handed, and on a plan it is a whole document no
    // card body could ever match.
    assert.equal(findDelivery(deliveryId)?.approved, from === 'plan' ? PLAN.trim() : TYPED)

    // `raw create` lands on a card that is still the scaffold; the run writes the body after.
    adoptDirectCard(opened.run.sessionId, 3)
    fs.writeFileSync(cardPath(3), cardText(3, 'card three', ['[user] which shade of blue?']))
    fs.writeFileSync(path.join(worktreeDir(findDelivery(deliveryId)!.worktree!), 'three.txt'), 'three\n')
    await end(opened.run.sessionId)
    return findDelivery(deliveryId)!
  }

  for (const from of ['sentence', 'plan'] as const) {
    it(`lands when the answer on a ${from} build confirms what it already built`, async () => {
      const delivery = await wrote(from)
      await advanceLanding()
      assert.match(landingOf(delivery.deliveryId)?.why ?? '', /open question/)

      fs.writeFileSync(cardPath(3), cardText(3, 'card three'))
      said(3, 'unchanged', 'the option it confirms is the one already built')
      assert.equal(await advanceLanding(), null)

      assert.equal(landingOf(delivery.deliveryId)?.status, 'landed')
      assert.equal(archived(3), true)
    })

    it(`reopens when the answer on a ${from} build really changed the card`, async () => {
      const delivery = await wrote(from)
      await advanceLanding()

      said(3, 'changed', 'the answer asks for a second widget')
      fs.writeFileSync(cardPath(3), cardText(3, 'card three', [], 'a different requirement'))
      assert.equal((await advanceLanding())?.id, 3)
      assert.equal(listDeliveries().find((d) => d.deliveryId === delivery.deliveryId)?.status, 'cancelled')
      assert.equal(fs.existsSync(cardPath(3)), true)
    })
  }
})

describe('discarding a build', () => {
  it('puts the card back at the stage the delivery took it from, not at todo', async () => {
    const built = run('implement', 1, 'card one')
    setStatus(1, 'implementing') // what the run's claim writes
    await end(built, 'error')

    assert.equal((await discardDelivery(activeDelivery(1)!.deliveryId)).ok, true)
    // `ready`: throwing the work away is not the same as unsettling the plan.
    assert.match(fs.readFileSync(cardPath(1), 'utf8'), /^status: ready$/m)
  })

  it('rests the card at todo when a question is waiting on the user', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const built = run('implement', 1, 'card one')
    setStatus(1, 'implementing')
    await end(built, 'error')

    await discardDelivery(activeDelivery(1)!.deliveryId)
    assert.match(fs.readFileSync(cardPath(1), 'utf8'), /^status: todo$/m)
  })
})

describe('where a delivery stands', () => {
  it('reads its stage off what is already recorded', async () => {
    const base: DeliveryRecord = {
      deliveryId: 'aaa',
      cardId: 1,
      title: 'card one',
      status: 'active',
      startedAt: 1,
      sessions: [],
      approved: '',
      steps: [],
      commitMode: 'auto',
      targetBranch: 'main',
    }
    assert.equal(deliveryState(base, 0).stage, 'working')
    assert.equal(deliveryState(base, 3).stage, 'working') // no landing yet — nothing to hold

    const queued = { ...base, landing: { status: 'waiting' as const, attempts: 0, at: 1 } }
    assert.equal(deliveryState(queued, 0).stage, 'working')
    assert.equal(deliveryState(queued, 1).stage, 'held')

    const landed = { ...base, landing: { status: 'landed' as const, attempts: 0, at: 1, commit: 'abc1234def' } }
    assert.equal(deliveryState(landed, 0).label, 'Landed as abc1234')
    assert.equal(deliveryState({ ...landed, landing: { ...landed.landing, commit: undefined } }, 0).label,
      'Landed — nothing to commit')

    const stopped = {
      ...queued,
      review: { rounds: [], stopped: { reason: 'ask' as const, why: 'review found something', at: 1 } },
    }
    assert.equal(deliveryState(stopped, 1).stage, 'stopped')

    const manual: DeliveryRecord = { ...base, commitMode: 'manual', reviewed: { mark: 'x', at: 1 } }
    assert.equal(deliveryState(manual, 0).label, 'Waiting for your commit')
    assert.equal(deliveryState(manual, 0).paused, true)

    const changed: DeliveryRecord = {
      ...base,
      commitMode: 'manual',
      next: 'review',
      review: { rounds: [{ sessionId: 's', verdict: 'pass', findings: [], at: 1 }] },
    }
    assert.equal(deliveryState(changed, 0).label, 'Code changed after review')
    assert.equal(deliveryState(changed, 0).paused, false)

    // Landing refused it and said why. Without this the pill read "In progress" over a
    // delivery nothing was building.
    const refused = { ...queued, landing: { ...queued.landing, why: 'you have changes in `a.ts`' } }
    assert.equal(deliveryState(refused, 0).stage, 'refused')
    assert.equal(deliveryState(refused, 0).label, "Can't land yet")
    assert.equal(deliveryState(refused, 0).paused, true)
    // Landing's own words, taken as the sentence they are: capitalised, closed, and with
    // the marks it put round the names left alone.
    assert.equal(deliveryState(refused, 0).line, 'You have changes in `a.ts`.')
    // A refusal that already ends in one keeps its own punctuation.
    assert.match(deliveryState({ ...refused, landing: { ...refused.landing, why: 'main is gone.' } }, 0).line, /gone\.$/)
    // The card's own questions still come first: answering them is what moves it.
    assert.equal(deliveryState(refused, 1).stage, 'held')
    // And the hold's own `why` outlives the hold. Answering leaves it on the record until
    // the next pass, and it must not read back as a refusal.
    const answered = { ...queued, landing: { ...queued.landing, why: 'held on an open question: #1 has 1 of them' } }
    assert.equal(deliveryState(answered, 0).stage, 'working')
  })
})

describe('a manual delivery waiting on the user\'s commit', () => {
  beforeEach(() => setAutoCommit(false))

  // The supersede lives in the landing pass, and a manual delivery never enters it: the
  // commit is the user's. So a change has nothing to act on it here, and the answered review
  // is still what comes next — waiting for a supersede nobody can make is a wedged build.
  it('reviews again on an answer that changed the plan, because nothing can reopen it', async () => {
    const built = run('implement', 1, 'card one')
    const first = activeDelivery(1)!
    assert.equal(first.worktree, undefined)
    fs.writeFileSync(path.join(root, 'shared.txt'), 'one\n')
    await end(built)

    const review = run('review', 1, 'card one')
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    await end(review)
    assert.equal(listDeliveries().find((d) => d.deliveryId === first.deliveryId)?.review?.stopped?.reason, 'ask')

    fs.writeFileSync(cardPath(1), cardText(1, 'card one', [], 'a different requirement'))
    said(1, 'changed', 'the answer asks for a different requirement')
    assert.equal(answeredReview(1)?.action, 'review')
    assert.equal(deliveryState(activeDelivery(1)!, 0).stage, 'rereview')
  })

  it('leaves the card alone while the code is still uncommitted', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    assert.equal(delivery.worktree, undefined)

    const card = await board().readCard(1)
    assert.equal(card?.delivery?.state.label, 'Waiting for your commit')
    assert.equal(listDeliveries().find((d) => d.deliveryId === delivery.deliveryId)?.status, 'active')
    assert.equal(archived(1), false)
  })

  it('ends and archives the card once they have committed what review passed', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    git(['add', '-A'])
    git(['commit', '--quiet', '-m', 'mine'])

    // The read is what notices — and it is awaited, so by the time it answers the archive
    // has happened and the card has gone.
    assert.equal(await board().readCard(1), null)
    assert.equal(listDeliveries().find((d) => d.deliveryId === delivery.deliveryId)?.status, 'finished')
    assert.equal(archived(1), true)
  })
})

describe('claiming the card for a run', () => {
  it('remembers the stage on the record and leaves the write to its caller', async () => {
    const started = run('implement', 1, 'card one')
    const record = peekRun(started)!
    // The card is `ready` on the board, and the claim only says what to write.
    const claim = claimCard(record)
    assert.deepEqual(claim, { cardId: 1, status: 'implementing' })
    assert.equal(record.priorStatus, 'ready')
    assert.match(fs.readFileSync(cardPath(1), 'utf8'), /^status: ready$/m)
  })

  it('claims nothing for a run with no card of its own', async () => {
    const opened = run('plan-release', 0, '')
    assert.equal(claimCard(peekRun(opened)!), undefined)
  })
})

describe('a run that ends before it spawns', () => {
  it('is closed out by the watcher itself, which waits for that close', async () => {
    const started = run('implement', 1, 'card one')
    // A finished run with no log is pruned from the record, so give it one to be found by.
    fs.writeFileSync(peekRun(started)!.logPath, 'log\n')
    // No plan on disk is the watcher's first early exit: nothing to spawn, so it closes the
    // run out — and the close is awaited, so the record has settled by the time it returns.
    fs.rmSync(path.join(SESSIONS_DIR, `${started}.plan.json`))
    assert.equal(await watchRun(started), 1)
    assert.equal(peekRun(started)?.status, 'interrupted')
  })

  it('is closed out as stopped', async () => {
    const started = run('implement', 1, 'card one')
    // A finished run with no log is pruned from the record, so give it one to be found by.
    fs.writeFileSync(peekRun(started)!.logPath, 'log\n')
    assert.equal((await stopRun(started)).ok, true)
    assert.equal(peekRun(started)?.status, 'stopped')
  })

  it('is closed out as errored', async () => {
    const started = run('implement', 1, 'card one')
    await end(started, 'error')
    assert.equal(peekRun(started)?.status, 'error')
  })
})

describe('removed raw commands', () => {
  it('rejects run-blocker as an unknown command', async () => {
    await assert.rejects(() => move(root, ['run-blocker', '1']), /unknown command/)
  })
})
