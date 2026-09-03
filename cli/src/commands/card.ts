// ---- create / update / update-questions / tag ------------------------------
//
// The commands that write a live card's frontmatter. The script owns the meta;
// Write/Edit are for the body only.

import fs from 'node:fs'
import path from 'node:path'

import { die, warn, rel, readNextId, writeNextId, TODO } from '../lib/paths'
import { say } from '../lib/io'
import { bumpMetric } from '../lib/metrics'
import { countsForRecord, recordFact, type Answerer, type Origin } from '../lib/record'
import { slugify, validTrack, validModules, parseIdList, normalizeRelease } from '../lib/validate'
import { QUESTION_TAGS, parseQuestion, formatQuestion, warnBadQuestionTags, collectQuestions, readQuestionOps, parseQuestionPositions, type QuestionOpsInput } from '../lib/questions'
import { readVerifyOps, parseVerifyPositions, type VerifyOpsInput } from '../lib/verify'
import { serializeFrontmatter, parseFrontmatter } from '../lib/frontmatter'
import { CADENCE_FORMS, formatCadence, parseCadence } from '../lib/cadence'
import { locate, enclosingGroupRoot, isRecurringCard, trackOf } from '../lib/cards'
import { RECURRING } from '../lib/recurring'
import { validRelease, setSubtreeRelease } from '../lib/releases'
import { asScheduledAction, SCHEDULED_ACTIONS } from '../lib/schedule'
import { scheduleRefineOnBlock, setCardSchedule } from '../lib/view/edit'
import { findCard } from '../lib/view/read'
import type { ScheduledAction } from '../lib/view/types'
import { readmeHeadingFor, addReadmeRef, stripReadmeRefs, repointReadmeLink } from '../lib/readme'
import { reconcileBoard } from '../lib/reconcile'
import type { Meta, MoveResult, Question } from '../lib/types'

export type { QuestionOpsInput, VerifyOpsInput }

// A one-shot todo item in any accepted form: `- [ ]`, `- []`, `- [x]`, `* [X]`, … — the
// shape counts, not the literal string. Recurring cards have a Process instead.
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

function recurringBody() {
  return [
    '<one short paragraph: what the job is for and why it repeats.>',
    '',
    '## Run state',
    '<only what the next run needs; update in place after each run, or write "None">',
    '',
    '## Process',
    '1. <one pass, in order>',
    '',
  ].join('\n')
}

// How often a recurring card repeats, as `--cadence` gives it: one of the forms in
// lib/cadence.ts, written back in that module's own spelling so every card reads the
// same. An empty value is "no cadence" — the card goes back to running only when a
// human clicks Run. Anything the grammar doesn't cover is refused with the accepted
// forms, never written half-parsed.
function cadenceFlag(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  const parsed = parseCadence(text)
  if (!parsed) die(`--cadence "${text}" isn't a cadence. Accepted: ${CADENCE_FORMS}`)
  return formatCadence(parsed)
}

/** `akb raw create`, as its command declares it (lib/cli/board.ts). */
export interface CreateOptions {
  title: string
  track: string
  priority: string
  roi: string
  release?: string
  blockedBy?: string[]
  related?: string[]
  modules?: string[]
  slug?: string
  /** `--no-body`: Commander stores the negation, so this is false only when it was typed. */
  body?: boolean
  cadence?: string
  proposed?: boolean
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
function createSchedule(action: ScheduledAction, track: string, questions: Question[]): ScheduledAction {
  if (track === RECURRING) die('--schedule is not for a recurring card: its cadence is its schedule.')
  if (
    action === 'refine' &&
    questions.length > 0 &&
    questions.every((q) => parseQuestion(q.text).tag === 'user')
  ) {
    die('a refine would not move a card whose every question is a [user] call — leave --schedule off')
  }
  return action
}

// Where a card came from. `--proposed` is what the flows that go looking for work pass —
// propose, extract-ideas, plan-release; every other way of adding a card is a person
// asking for it. Kept for the board's own score (lib/record.ts), not shown on the card.
const originOf = (opts: CreateOptions): Origin => (opts.proposed ? 'proposed' : 'asked')

// Create allocates one id, writes one card's frontmatter + body template, and indexes it.
// The script owns the meta; fill the body with your editor and leave the frontmatter alone.
export function cmdCreate(opts: CreateOptions): MoveResult {
  const title = opts.title.trim()
  if (!title) die('--title must not be empty')
  const track = opts.track.trim()
  validTrack(track)
  const { priority, roi } = opts
  // No --release means no release: the card is wanted, not promised to a version. Any
  // other value has to name a release on the list — a typo must not invent a version.
  const release = validRelease(normalizeRelease(opts.release))
  const start = readNextId()
  const blocked_by = parseIdList(opts.blockedBy ?? [], 'blocked-by', start)
  const related = parseIdList(opts.related ?? [], 'related', start)
  const modules = validModules(opts.modules ?? [])
  // Only a card that repeats can have a cadence — a one-shot task is built once.
  let cadence = ''
  if (opts.cadence !== undefined) {
    if (track !== RECURRING) die(`--cadence is for recurring cards only (--track ${RECURRING}); a one-shot task is built once, not repeated.`)
    cadence = cadenceFlag(opts.cadence)
  }
  const questions = collectQuestions(opts.asked ?? [])
  warnBadQuestionTags(questions)
  const wantedSchedule = opts.schedule ? createSchedule(opts.schedule, track, questions) : null
  const slug = slugify(opts.slug !== undefined ? opts.slug : title)
  const fileRel = path.join(track, `${start}-${slug}.md`)
  const file = path.join(TODO, fileRel)
  if (fs.existsSync(file)) die(`${rel(file)} already exists — pick a different --slug`)

  // validation passed → allocate + write
  writeNextId(start + 1)
  bumpMetric('created')
  const meta: Partial<Meta> = { title, track, priority, roi, status: 'todo', release, blocked_by, related, modules, cadence, questions }
  const body = opts.body === false ? '' : track === RECURRING ? recurringBody() : defaultBody()
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n\n' + body)
  if (countsForRecord(file)) recordFact('card-created', start, originOf(opts))
  const indexed = addReadmeRef(track, start, title, fileRel)
  // An asked-for schedule wins over the default one a blocked card gets — it is the same
  // field, and the user named the action.
  let scheduled: ScheduledAction | null = null
  if (wantedSchedule) {
    setCardSchedule(start, { action: wantedSchedule, notes: '' })
    scheduled = wantedSchedule
  } else if (scheduleRefineOnBlock(start, false)) {
    scheduled = 'refine'
  }
  say(start)
  say(`  wrote ${rel(file)} — frontmatter is set; fill the body with your editor, leave the frontmatter to the script`)
  if (scheduled) say(`  ${scheduleReceipt(start, scheduled)}`)
  if (track !== RECURRING && !TODO_ITEM.test(body)) warn(`#${start} has no todos — every task needs a \`- [ ]\` list under ## Todo`)
  if (indexed) say(`  indexed under "## ${readmeHeadingFor(track)}"`)
  reconcileBoard()
  return { id: start, ids: [start], title, track, file: rel(file), indexed, schedule: scheduled }
}

/** `akb raw update`, as its command declares it (lib/cli/board.ts). */
export interface UpdateOptions {
  title?: string
  track?: string
  priority?: string
  roi?: string
  status?: string
  release?: string
  blockedBy?: string[]
  related?: string[]
  modules?: string[]
  slug?: string
  cadence?: string
}

// Rewrite a card's frontmatter fields. Also the sanctioned way to move a card between
// tracks (--track moves the file + fixes the index) or rename it (--slug). Body is
// untouched, and so is the question list — that's cmdUpdateQuestions' job.
export function cmdUpdate(id: number, flags: UpdateOptions): MoveResult {
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)
  const wasBlocked = meta.blocked_by.length > 0

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
  if (flags.blockedBy !== undefined) {
    meta.blocked_by = parseIdList(flags.blockedBy, 'blocked-by', ceiling)
    changes.push('blocked_by')
  }
  if (flags.related !== undefined) {
    meta.related = parseIdList(flags.related, 'related', ceiling)
    changes.push('related')
  }
  if (flags.modules !== undefined) {
    meta.modules = validModules(flags.modules)
    changes.push('modules')
  }
  // How often the card repeats, and so whether the local UI runs it in the
  // background at all. `--cadence ""` clears it and the card goes back to
  // running only when someone clicks Run.
  if (flags.cadence !== undefined) {
    if (!isRecurringCard(found)) die(`#${id} is not recurring (${found.rel} is not under ${RECURRING}/) — only a card that repeats can have a cadence.`)
    meta.cadence = cadenceFlag(flags.cadence)
    changes.push(`cadence→${meta.cadence || '(none)'}`)
  }
  // A `ready` card has no open questions by definition (see STATUSES). Open questions
  // mean the plan is not settled, so a `--status ready` with them pending lands as
  // `todo`. This holds the invariant no matter who set the status.
  if (meta.questions.length > 0 && meta.status === 'ready') {
    meta.status = 'todo'
    changes.push('status→todo (open questions)')
  }

  const curRel = path.relative(TODO, file)
  const curTrack = trackOf(curRel, meta.track)
  const isSubtask = found.kind === 'file' && enclosingGroupRoot(file) !== null
  let newTrack = curTrack
  if (flags.track !== undefined) {
    if (found.kind === 'group') die('moving a group task between tracks by script is not supported — move the folder by hand')
    if (isSubtask) die('moving a group subtask between tracks by script is not supported — move the file by hand')
    newTrack = flags.track.trim()
    validTrack(newTrack)
  }
  let base = path.basename(file)
  if (flags.slug !== undefined) {
    if (found.kind === 'group') die('renaming a group root by script is not supported')
    base = `${id}-${slugify(flags.slug)}.md`
  }
  meta.track = newTrack
  // A card moved out of recurring/ leaves its cadence behind: nothing runs a
  // one-shot task on a schedule, so the line would only mislead whoever reads it.
  if (flags.track !== undefined && newTrack !== RECURRING && meta.cadence) {
    meta.cadence = ''
    changes.push('cadence cleared (no longer recurring)')
  }
  // Only a standalone card can change folders (--track). A subtask and a group
  // root stay in their own folder; --slug at most renames the file there.
  const standalone = found.kind === 'file' && !isSubtask
  const destRel = standalone ? path.join(newTrack, base) : path.join(path.dirname(curRel), base)
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
    addReadmeRef(newTrack, id, meta.title, destRel)
    changes.push(`moved → ${destRel.split(path.sep).join('/')}`)
  } else if (changes.includes('title')) {
    stripReadmeRefs({ kind: 'file', rel: curRel })
    addReadmeRef(curTrack, id, meta.title, curRel)
  }
  if (flags.blockedBy !== undefined && scheduleRefineOnBlock(id, wasBlocked)) {
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

  const changes: string[] = []
  // Who cleared each question, in the order the ops ran. A question the board handed over
  // carries the `[user]` tag, so the card already says whether the person answered it or
  // the board settled it — no flag, and nothing for a flow to remember to pass.
  const closed: Answerer[] = []
  const answerer = (q: Question): Answerer => (parseQuestion(q.text).tag === 'user' ? 'user' : 'board')
  let moved = 0
  for (const op of ops) {
    if (op.kind === 'clear') {
      closed.push(...meta.questions.map(answerer))
      meta.questions = []
      changes.push('cleared')
    } else if (op.kind === 'drop') {
      const ns = parseQuestionPositions(op.ns, meta.questions.length, 'drop')
      closed.push(...meta.questions.filter((_, i) => ns.includes(i + 1)).map(answerer))
      meta.questions = meta.questions.filter((_, i) => !ns.includes(i + 1))
      changes.push(`dropped ${ns.join(',')}`)
    } else if (op.kind === 'to-verify') {
      // A hand-check filed as a question: it moves to `verify:` as it stands, minus the
      // `[user]` tag a note never carries, and counts as moved rather than as answered.
      const ns = parseQuestionPositions(op.ns, meta.questions.length, 'to-verify')
      for (const q of meta.questions.filter((_, i) => ns.includes(i + 1))) {
        const line = parseQuestion(q.text).text.trim()
        if (!line) die(`question ${ns.join(',')} on #${id} is empty — there is nothing to move to verify`)
        meta.verify.push(line)
        closed.push('verify')
        moved++
      }
      meta.questions = meta.questions.filter((_, i) => !ns.includes(i + 1))
      changes.push(`moved ${ns.join(',')} to verify`)
    } else if (op.kind === 'append') {
      meta.questions.push(op.question!)
      changes.push('appended')
    } else {
      const [n] = parseQuestionPositions(String(op.n), meta.questions.length, 'update')
      // parseQuestionPositions refused anything out of range, so the slot is there.
      meta.questions[n! - 1] = op.question!
      changes.push(`rewrote ${n}`)
    }
  }
  warnBadQuestionTags(meta.questions)
  // The same invariant cmdUpdate holds: a `ready` card has no open questions.
  if (meta.questions.length > 0 && meta.status === 'ready') {
    meta.status = 'todo'
    changes.push('status→todo (open questions)')
  }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  if (countsForRecord(file)) for (const by of closed) recordFact('question-closed', id, by)
  say(
    `updated #${id} questions: ${changes.join(', ')} (${meta.questions.length} open` +
      (moved ? `, ${meta.verify.length} to check by hand` : '') +
      ')',
  )
  return { id, changes, open: meta.questions.length, verify: meta.verify.length, file: rel(file) }
}

// Patch a card's verify list — what the user should check by hand before accepting the
// finished work. The same three edits `update-questions` makes, applied in the order they
// were typed, so a build that ends with two hand-checks writes them one call at a time
// without re-passing the ones already there.
//
// Nothing here touches the card's status: a verify line is a note, not a question, so it
// never takes a `ready` card back to `todo` and never stands between the card and archive.
export function cmdUpdateVerify(id: number, input: VerifyOpsInput): MoveResult {
  const ops = readVerifyOps(input.ops ?? [])
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)

  const changes: string[] = []
  for (const op of ops) {
    if (op.kind === 'clear') {
      meta.verify = []
      changes.push('cleared')
    } else if (op.kind === 'drop') {
      const ns = parseVerifyPositions(op.ns, meta.verify.length)
      meta.verify = meta.verify.filter((_, i) => !ns.includes(i + 1))
      changes.push(`dropped ${ns.join(',')}`)
    } else {
      meta.verify.push(op.line!)
      changes.push('appended')
    }
  }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  say(`updated #${id} verify: ${changes.join(', ')} (${meta.verify.length} to check by hand)`)
  return { id, changes, verify: meta.verify.length, file: rel(file) }
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
