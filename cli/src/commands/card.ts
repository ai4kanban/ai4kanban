// ---- create / update / update-questions / tag ------------------------------
//
// The commands that write a live card's frontmatter. The script owns the meta;
// Write/Edit are for the body only.

import fs from 'node:fs'
import path from 'node:path'

import { die, warn, rel, readNextId, writeNextId, TODO } from '../lib/paths'
import { say } from '../lib/io'
import { bumpMetric } from '../lib/metrics'
import { countBoardEvent, type BoardCount } from '../lib/machine/usage'
import { slugify, validModules, parseIdList, normalizeRelease, dependencyCycle } from '../lib/validate'
import { DEFAULT_WORKFLOW, knownWorkflow } from '../lib/agent/workflows'
import { QUESTION_TAGS, parseQuestion, formatQuestion, warnBadQuestionTags, collectQuestions, readQuestionOps, parseQuestionPositions, openOf, type QuestionOp, type QuestionOpsInput } from '../lib/questions'
import { serializeFrontmatter, parseFrontmatter } from '../lib/frontmatter'
import { locate, enclosingGroupRoot } from '../lib/cards'
import { hasSourceSection, sourceRefFrom } from '../lib/source'
import { validRelease, setSubtreeRelease } from '../lib/releases'
import { asScheduledAction, SCHEDULED_ACTIONS } from '../lib/schedule'
import { cardCreation, readStore } from '../lib/agent/store'
import { insideRun } from '../lib/agent/env'
import { activeDelivery } from '../lib/agent/deliveries'
import { recordAnswer, takeUnchanged } from '../lib/agent/answers'
import { findSpecAgent } from '../lib/agents'
import { scheduleRefineOnBlock, setCardSchedule } from '../lib/view/edit'
import { findCard } from '../lib/view/read'
import { creationRefusal } from '../lib/view/rules'
import type { ScheduledAction } from '../lib/view/types'
import { TASKS_HEADING, addReadmeRef, stripReadmeRefs, repointReadmeLink } from '../lib/readme'
import { reconcileBoard } from '../lib/reconcile'
import type { Meta, MoveResult, Question } from '../lib/types'

export type { QuestionOpsInput }

// A one-shot todo item in any accepted form: `- [ ]`, `- []`, `- [x]`, `* [X]`, … — the
// shape counts, not the literal string.
const TODO_ITEM = /^[ \t]*[-*+][ \t]*\[[ xX]?\]/m

function defaultBody() {
  return [
    '<one short paragraph: the observable result and the current behavior or constraint it changes.>',
    '',
    '## Worth noting',
    '',
    '<!-- agent -->',
    '',
    '## Scope',
    '- <the concrete steps>',
    '',
    '## Todo',
    '- [ ] every task must have todos — replace this line with the real steps.',
    '',
    '## Decided by the agent',
    '',
    '### Overruled by the user',
    '',
  ].join('\n')
}

/** `akb raw create`, as its command declares it (lib/cli/board.ts). */
export interface CreateOptions {
  title: string
  priority?: string
  roi?: string
  release?: string
  blockedBy?: string[]
  related?: string[]
  modules?: string[]
  slug?: string
  /** `--no-body`: Commander stores the negation, so this is false only when it was typed. */
  body?: boolean
  /** `--body-file`: the whole body, written to a file first (#561). */
  bodyFile?: string
  /** `--workflow`: which workflow the card runs on (#715). Left off, the board's default. */
  workflow?: string
  /** `--triage`: the source id of the triage item this card is made of. */
  triage?: string
  /** `--source`, repeatable: a plan, a card or an address the card came from (#1306). */
  source?: string[]
  schedule?: ScheduledAction
  /** `--question` and the choices that qualify it, in the order they were typed. */
  asked: [key: string, value: string][]
}

// `--schedule refine` hands the new card's first run to the board (lib/view/dispatch.ts)
// instead of starting one here: it survives this session and every other, and the board
// starts one scheduled run per tick rather than all of them at once. Read before the id is
// allocated, so a bad value never leaves a card behind.
//
// Which words are actions is the command's own check; what is left here is the two ways a
// perfectly-spelled one would still never fire.
function createSchedule(action: ScheduledAction, questions: Question[]): ScheduledAction {
  if (
    action === 'refine' &&
    openOf(questions).length > 0 &&
    openOf(questions).every((q) => parseQuestion(q.text).tag === 'user')
  ) {
    die('a refine would not move a card whose every question is a [user] call — leave --schedule off')
  }
  return action
}

// The whole body, written to a file first (#561) — one call that leaves a finished card,
// rather than a scaffold to fill in afterwards. It is read BEFORE the id is allocated, so a
// path that is not there leaves no half-made card behind.
//
// `--no-body` is the opposite instruction, so the two are refused together rather than one
// quietly winning.
function bodyFromFile(opts: CreateOptions): string | null {
  if (opts.bodyFile === undefined) return null
  if (opts.body === false) die('pass --body-file or --no-body, not both')
  let text: string
  try {
    text = fs.readFileSync(opts.bodyFile, 'utf8')
  } catch {
    die(`can't read ${opts.bodyFile} — write the body to a file, then pass its path`, { kind: 'needs-input' })
  }
  if (!text!.trim()) die(`${opts.bodyFile} is empty — a card's body has to say something`)
  return `${text!.trim()}\n`
}

// Create allocates one id, writes one card's frontmatter + body template, and indexes it.
// The script owns the meta; fill the body with your editor and leave the frontmatter alone.
export function cmdCreate(opts: CreateOptions): MoveResult {
  const title = opts.title.trim()
  if (!title) die('--title must not be empty')
  const priority = opts.priority ?? 'med'
  const roi = opts.roi ?? 'med'
  // No --release means no release: the card is wanted, not promised to a version. Any
  // other value has to name a release on the list — a typo must not invent a version.
  const release = validRelease(normalizeRelease(opts.release))
  const start = readNextId()
  const blocked_by = parseIdList(opts.blockedBy ?? [], 'blocked-by', start)
  const related = parseIdList(opts.related ?? [], 'related', start)
  const modules = validModules(opts.modules ?? [])
  const workflow = workflowFlag(opts.workflow)
  const triage = (opts.triage ?? '').trim()
  const source = sourceFlag(opts.source ?? [], 'source', start)
  const questions = collectQuestions(opts.asked ?? [])
  warnBadQuestionTags(questions)
  const wantedSchedule = opts.schedule ? createSchedule(opts.schedule, questions) : null
  const written = bodyFromFile(opts)
  if (written && hasSourceSection(written)) {
    die('the body carries a `## Source` section — drop it and pass --source <plan path | plan:<id> | #<id> | URL> instead', { kind: 'needs-input' })
  }
  const slug = slugify(opts.slug !== undefined ? opts.slug : title)
  const fileRel = `${start}-${slug}.md`
  const file = path.join(TODO, fileRel)
  if (fs.existsSync(file)) die(`${rel(file)} already exists — pick a different --slug`)

  // validation passed → allocate + write
  writeNextId(start + 1)
  bumpMetric('created')
  countBoardEvent(triage ? 'cards_created_proposed' : 'cards_created_asked')
  const meta: Partial<Meta> = { title, priority, roi, status: 'todo', release, blocked_by, related, modules, workflow, triage, source, questions }
  const scaffolded = !written && opts.body !== false
  const body = written ?? (scaffolded ? defaultBody() : '')
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n\n' + body)
  const indexed = addReadmeRef(start, title, fileRel)
  // An asked-for schedule wins over the default one a blocked card gets — it is the same
  // field, and the user named the action.
  let scheduled: ScheduledAction | null = null
  if (wantedSchedule) {
    setCardSchedule(start, { action: wantedSchedule, notes: '' })
    scheduled = wantedSchedule
  } else if (scheduleRefineOnBlock(start)) {
    scheduled = 'refine'
  }
  say(start)
  say(
    `  wrote ${rel(file)} — frontmatter is set` +
      (written ? '; the body came from --body-file' : scaffolded ? '; fill the body with your editor, leave the frontmatter to the script' : ''),
  )
  if (scheduled) say(`  ${scheduleReceipt(start, scheduled)}`)
  if ((scaffolded || written) && !TODO_ITEM.test(body)) warn(`#${start} has no todos — every task needs a \`- [ ]\` list under ## Todo`)
  if (indexed) say(`  indexed under "## ${TASKS_HEADING}"`)
  reconcileBoard()
  return { id: start, ids: [start], title, file: rel(file), indexed, schedule: scheduled }
}

/** `akb raw update`, as its command declares it (lib/cli/board.ts). */
export interface UpdateOptions {
  title?: string
  priority?: string
  roi?: string
  status?: string
  release?: string
  blockedBy?: string[]
  related?: string[]
  addBlockedBy?: string[]
  addRelated?: string[]
  modules?: string[]
  slug?: string
  source?: string[]
  addSource?: string[]
}

// What `--source` names, as `source:` stores it. A plan's path becomes `plan:<id>`, which
// outlives a rename and the move into `plans/archive/`.
function sourceFlag(said: string[], flag: string, ceiling: number): string[] {
  const out: string[] = []
  for (const one of said) {
    if (!one.trim()) continue
    const ref = sourceRefFrom(one)
    if (!ref) die(`--${flag} ${JSON.stringify(one)} is not a source — pass a plan's path, plan:<id>, #<id> or a URL`, { kind: 'needs-input' })
    const card = /^#(\d+)$/.exec(ref!)
    if (card && Number(card[1]) >= ceiling) die(`--${flag} ${ref}: no card has that id yet`)
    if (!out.includes(ref!)) out.push(ref!)
  }
  return out
}

// Which workflow a card runs on. Empty means the board's default and is written as no key at
// all, so a board that never picked a workflow keeps the frontmatter it always had.
function workflowFlag(asked: string | undefined): string {
  const wanted = (asked ?? '').trim()
  if (!wanted || wanted === DEFAULT_WORKFLOW) return ''
  return knownWorkflow(wanted)
}

function appendIds(have: number[], added: number[]): number[] {
  return [...new Set([...have, ...added])]
}

export function cmdUpdate(id: number, flags: UpdateOptions): MoveResult {
  // The terminal's spelling of the edit `patchCard` refuses (#564): one card, one answer,
  // whichever door the write comes through. The creator itself is let past — this is what it
  // fills the card in with.
  const creating = creationRefusal(id, cardCreation(id), 'edit')
  if (creating) die(creating, { kind: 'card-being-created', id })
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)
  if (flags.blockedBy !== undefined && flags.addBlockedBy !== undefined) die('--blocked-by replaces the list and --add-blocked-by appends to it — pass one')
  if (flags.related !== undefined && flags.addRelated !== undefined) die('--related replaces the list and --add-related appends to it — pass one')
  if (flags.source !== undefined && flags.addSource !== undefined) die('--source replaces the list and --add-source appends to it — pass one')

  const changes: string[] = []
  if (flags.title !== undefined) {
    const t = flags.title.trim()
    if (!t) die('--title must not be empty')
    meta.title = t
    changes.push('title')
  }
  if (flags.priority !== undefined) {
    meta.priority = flags.priority
    changes.push('priority')
  }
  if (flags.roi !== undefined) {
    meta.roi = flags.roi
    changes.push('roi')
  }
  if (flags.status !== undefined) {
    meta.status = flags.status
    changes.push('status')
  }
  // `--release ""` — an empty value — takes the card back out of a version.
  if (flags.release !== undefined) {
    meta.release = validRelease(normalizeRelease(flags.release))
    changes.push(`release→${meta.release || '(none)'}`)
  }
  const ceiling = readNextId()
  const hadBlockedBy = meta.blocked_by
  if (flags.blockedBy !== undefined) {
    meta.blocked_by = parseIdList(flags.blockedBy, 'blocked-by', ceiling)
    changes.push('blocked_by')
  }
  if (flags.related !== undefined) {
    meta.related = parseIdList(flags.related, 'related', ceiling)
    changes.push('related')
  }
  // Only the new ids are checked: one already listed stays even if its card has since closed.
  if (flags.addBlockedBy !== undefined) {
    meta.blocked_by = appendIds(meta.blocked_by, parseIdList(flags.addBlockedBy, 'add-blocked-by', ceiling))
    changes.push('blocked_by')
  }
  // Only new edges are checked, so a cycle already on the board can still be edited apart.
  for (const dep of meta.blocked_by.filter((d) => !hadBlockedBy.includes(d))) {
    if (dep === id) die(`#${id} cannot be blocked by itself.`, { kind: 'dependency-cycle', cycle: [id, id] })
    const cycle = dependencyCycle(id, dep)
    if (cycle) die(`#${id} blocked by #${dep} makes a cycle: ${cycle.map((n) => `#${n}`).join(' → ')}`, { kind: 'dependency-cycle', cycle })
  }
  if (flags.addRelated !== undefined) {
    meta.related = appendIds(meta.related, parseIdList(flags.addRelated, 'add-related', ceiling))
    changes.push('related')
  }
  if (flags.modules !== undefined) {
    meta.modules = validModules(flags.modules)
    changes.push('modules')
  }
  // `--source ""` clears the list.
  if (flags.source !== undefined) {
    meta.source = sourceFlag(flags.source, 'source', ceiling)
    changes.push('source')
  }
  if (flags.addSource !== undefined) {
    meta.source = [...new Set([...meta.source, ...sourceFlag(flags.addSource, 'add-source', ceiling)])]
    changes.push('source')
  }
  // A `ready` card has no open questions by definition (see STATUSES). Open questions
  // mean the plan is not settled, so a `--status ready` with them pending lands as
  // `todo`. This holds the invariant no matter who set the status.
  if (openOf(meta.questions).length > 0 && meta.status === 'ready') {
    meta.status = 'todo'
    changes.push('status→todo (open questions)')
  }

  const curRel = path.relative(TODO, file)
  const isSubtask = found.kind === 'file' && enclosingGroupRoot(file) !== null
  let base = path.basename(file)
  if (flags.slug !== undefined) {
    if (found.kind === 'group') die('renaming a group root by script is not supported')
    base = `${id}-${slugify(flags.slug)}.md`
  }
  // A card never changes folders: --slug at most renames the file where it sits.
  const destRel = path.join(path.dirname(curRel), base)
  const dest = path.join(TODO, destRel)
  const moving = dest !== file
  if (moving && fs.existsSync(dest)) die(`${rel(dest)} already exists`)

  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  // Putting a group root in a release puts the whole group in it — every subtask, and
  // the subtasks of a nested group too. Taking the root out takes them all out. Done
  // after the root is written so the group ends up on one release either way.
  if (flags.release !== undefined && found.kind === 'group') {
    const ids = setSubtreeRelease(found.target, meta.release)
    if (ids.length) changes.push(`release on ${ids.length} subtask${ids.length === 1 ? '' : 's'} (${ids.map((n) => `#${n}`).join(', ')})`)
  }
  if (moving) fs.renameSync(file, dest)
  if (isSubtask) {
    // A subtask never owns a top-level README entry — fix its nested bullet in place.
    if (moving || changes.includes('title')) repointReadmeLink(id, curRel, destRel, meta.title)
    if (moving) changes.push(`renamed → ${destRel.split(path.sep).join('/')}`)
  } else if (moving) {
    stripReadmeRefs({ kind: 'file', rel: curRel })
    addReadmeRef(id, meta.title, destRel)
    changes.push(`renamed → ${destRel.split(path.sep).join('/')}`)
  } else if (changes.includes('title')) {
    stripReadmeRefs({ kind: 'file', rel: curRel })
    addReadmeRef(id, meta.title, curRel)
  }
  if (scheduleRefineOnBlock(id)) {
    changes.push('schedule→refine when unblocked')
  }
  say(`updated #${id}: ${changes.join(', ') || '(nothing changed)'}`)
  return { id, changes, file: rel(dest) }
}

/** `akb raw schedule`, as its command declares it (lib/cli/board.ts). */
export interface ScheduleOptions {
  action?: ScheduledAction
  notes?: string
  clear?: boolean
}

/** One line saying when the board will start what was just scheduled. */
function scheduleReceipt(id: number, action: ScheduledAction): string {
  const card = findCard(id)
  return card && card.openBlockers.length > 0
    ? `#${id} is scheduled to ${action} once the cards it waits on are done`
    : `#${id} is queued for the board to ${action} on its own`
}

// Hand a run to the board, so it starts by itself — on its next tick, or the moment the last
// card in this one's way leaves the board — or take that schedule off again with `--clear`.
//
// A card holds one schedule at a time: a second one replaces the first, and the receipt says
// which one it replaced. Only the two actions a run can finish without anybody watching can
// be scheduled (see lib/schedule.ts).
export function cmdSchedule(id: number, flags: ScheduleOptions): MoveResult {
  if (flags.clear) {
    if (flags.action !== undefined || flags.notes !== undefined) {
      die('--clear takes a schedule off — it goes with nothing else')
    }
    const was = setCardSchedule(id, null)
    say(was ? `#${id} is no longer scheduled (was ${was.action})` : `#${id} had no schedule`)
    return { id, schedule: null, was: was?.action ?? null }
  }

  if (flags.action === undefined) {
    die(`schedule <id> needs --action ${SCHEDULED_ACTIONS.join('|')}, or --clear to take one off`)
  }
  const action = flags.action
  const notes = flags.notes?.trim() ?? ''
  const was = setCardSchedule(id, { action, notes })
  say(scheduleReceipt(id, action) + (was ? ` (replacing the ${was.action} that was scheduled)` : ''))
  return { id, schedule: action, notes, was: was?.action ?? null }
}

// Patch a card's open-question list. Every op edits in place — append one, rewrite
// one by position, drop answered ones, clear the list — so handing a single question
// to the user never means re-passing its siblings (wholesale rewrites silently lost
// options that weren't re-typed). Ops apply in the order they were typed, and a
// position is read against the list as it stands when its op runs.
export function cmdUpdateQuestions(id: number, input: QuestionOpsInput): MoveResult {
  const ops = readQuestionOps(input.ops ?? [])
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)

  // Skipping is the user's own call (#831): a run that skipped would be granting itself leave.
  if (insideRun() && ops.some((op) => op.kind === 'skip' || op.kind === 'unskip')) {
    die('only the user skips or reopens a question — a run leaves [user] questions for them to answer')
  }

  const changes: string[] = []
  let skipped = 0
  let unskipped = 0
  const asker = specRunAgent()
  // Who each closed question was waiting on (#1472), counted once the write lands.
  const closed: BoardCount[] = []
  const verifying = !!activeDelivery(id)
  const close = (qs: Question[]): void => {
    for (const q of qs) {
      closed.push(verifying ? 'questions_closed_verify' : parseQuestion(q.text).tag === 'user' ? 'questions_closed_user' : 'questions_closed_board')
    }
  }
  // A skipped question is the user's record (#831): no run answers, rewrites or drops it.
  const positions = (op: QuestionOp, flag: string): number[] => {
    const ns = parseQuestionPositions(op.ns ?? String(op.n), meta.questions.length, flag)
    const held = ns.find((n) => meta.questions[n - 1]!.skipped)
    if (held !== undefined && flag !== 'unskip' && flag !== 'skip') {
      die(`question ${held} on #${id} was skipped by the user — \`update-questions ${id} --unskip ${held}\` reopens it first`)
    }
    return ns
  }
  for (const op of ops) {
    if (op.question?.agent) {
      const agent = findSpecAgent(op.question.agent)
      if (!agent) die(`--agent "${op.question.agent}" is not an agent on this board`, { kind: 'no-such-spec-agent', specAgent: op.question.agent })
      op.question.agent = agent.name
    }
    if (op.kind === 'clear') {
      close(meta.questions.filter((q) => !q.skipped))
      meta.questions = meta.questions.filter((q) => q.skipped)
      changes.push('cleared')
    } else if (op.kind === 'drop') {
      const ns = positions(op, 'drop')
      close(ns.map((n) => meta.questions[n - 1]!))
      meta.questions = meta.questions.filter((_, i) => !ns.includes(i + 1))
      changes.push(`dropped ${ns.join(',')}`)
    } else if (op.kind === 'skip') {
      const ns = positions(op, 'skip')
      const notUser = ns.find((n) => parseQuestion(meta.questions[n - 1]!.text).tag !== 'user')
      if (notUser !== undefined) die(`question ${notUser} on #${id} is not a [user] question — only the user's own can be skipped`)
      close(ns.map((n) => meta.questions[n - 1]!).filter((q) => !q.skipped))
      for (const n of ns) meta.questions[n - 1] = { ...meta.questions[n - 1]!, skipped: true }
      skipped += ns.length
      changes.push(`skipped ${ns.join(',')}`)
    } else if (op.kind === 'unskip') {
      const ns = positions(op, 'unskip')
      const open = ns.find((n) => !meta.questions[n - 1]!.skipped)
      if (open !== undefined) die(`question ${open} on #${id} is not skipped`)
      for (const n of ns) {
        const { skipped: _, ...q } = meta.questions[n - 1]!
        meta.questions[n - 1] = q
      }
      unskipped += ns.length
      changes.push(`reopened ${ns.join(',')}`)
    } else if (op.kind === 'append') {
      const agent = op.question!.agent ?? asker
      const q = agent ? { ...op.question!, agent } : op.question!
      meta.questions.push(q)
      changes.push('appended')
    } else {
      const [n] = positions(op, 'update')
      // parseQuestionPositions refused anything out of range, so the slot is there.
      const was = meta.questions[n! - 1]!
      const agent = op.question!.agent ?? was.agent
      meta.questions[n! - 1] = { ...op.question!, ...(agent ? { agent } : {}) }
      changes.push(`rewrote ${n}`)
    }
  }
  warnBadQuestionTags(meta.questions)
  const open = openOf(meta.questions).length
  // The same invariant cmdUpdate holds: a `ready` card has no open questions.
  if (open > 0 && meta.status === 'ready') {
    meta.status = 'todo'
    changes.push('status→todo (open questions)')
  }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  for (const kind of closed) countBoardEvent(kind)
  if (scheduleRefineOnBlock(id)) changes.push('schedule→refine when unblocked')
  settleDelivery(id, skipped, unskipped)
  say(
    `updated #${id} questions: ${changes.join(', ')} (${open} open` +
      (meta.questions.length > open ? `, ${meta.questions.length - open} skipped` : '') +
      ')',
  )
  return { id, changes, open, file: rel(file) }
}

// A skip is an answer that changed nothing (#831), so the delivery in flight carries on once
// nothing else is open. A reopened question is a fresh round: what the last one concluded is
// spent, the way a newly appended question spends it at landing.
function settleDelivery(id: number, skipped: number, unskipped: number): void {
  if (!skipped && !unskipped) return
  const delivery = activeDelivery(id)
  if (!delivery) return
  if (unskipped) takeUnchanged(delivery)
  else recordAnswer(delivery.deliveryId, 'unchanged', `the user skipped ${skipped === 1 ? 'a question' : `${skipped} questions`}, keeping the card as it is`)
}

// A question a spec agent's own run appends is about that agent's section (#782).
function specRunAgent(): string | undefined {
  const id = insideRun()
  if (!id) return undefined
  const run = readStore().runs.find((r) => r.sessionId === id)
  return run?.action === 'spec' ? run.specAgent : undefined
}

// Set (or clear) the tag on open questions, so the refine loop can hand a
// batch of questions to the human in one call without rewriting the whole list.
// `nRaw` is one 1-based position or a comma-separated list (`1,2,3`); `tag` is
// user | none (none strips any tag). Reads and rewrites the frontmatter
// through the same path as `update`, so byte layout and group-root handling stay
// identical.
export function cmdTag(id: number, positions: string, tagRaw: string): MoveResult {
  const ns = positions
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
  if (ns.length === 0 || ns.some((n) => !Number.isInteger(n) || n < 1)) {
    die(`<positions> is one or more 1-based question numbers, e.g. 1 or 1,2,3 (got "${positions}")`)
  }
  const tag = tagRaw.toLowerCase()
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)
  const over = ns.find((n) => n > meta.questions.length)
  if (over !== undefined) {
    die(`#${id} has ${meta.questions.length} open question(s) — there's no question ${over} to tag.`)
  }
  for (const n of ns) {
    const q = meta.questions[n - 1]!
    const { text } = parseQuestion(q.text)
    q.text = formatQuestion(tag === 'none' ? null : tag, text)
  }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  const label = tag === 'none' ? '(untagged)' : `[${tag}]`
  say(`tagged #${id} question${ns.length > 1 ? 's' : ''} ${ns.join(', ')} as ${label}`)
  return { id, questions: ns, tag, file: rel(file) }
}
