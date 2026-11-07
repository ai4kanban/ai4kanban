// ---- create / update / update-questions / tag ------------------------------
//
// The commands that write a live card's frontmatter. The script owns the meta;
// Write/Edit are for the body only.

import fs from 'node:fs'
import path from 'node:path'

import { die, warn, rel, TODO } from '../lib/paths'
import { say } from '../lib/io'
import { countBoardEvent, type BoardCount } from '../lib/machine/usage'
import { slugify, validModules, parseIdList, dependencyCycle } from '../lib/validate'
import { cardStages, knownWorkflow, noWorkflowMessage, previewAgents, workflowById, workflowFor, workflows } from '../lib/agent/workflows'
import { readAllDismissed, readArchived, readInbox } from '../lib/signals/inbox'
import { collectQuestions, readQuestionOps, parseQuestionPositions, openOf, type QuestionOp, type QuestionOpsInput } from '../lib/questions'
import { serializeFrontmatter, parseFrontmatter } from '../lib/frontmatter'
import { locate, locateArchived, enclosingGroupRoot } from '../lib/cards'
import { sourceRefFrom } from '../lib/source'
import { cardCreation, readStore } from '../lib/agent/store'
import { switchWorkflow } from '../lib/agent/workflow-cards'
import { canonicalSpecAgent } from '../lib/spec-agent-names'
import { insideRun } from '../lib/agent/env'
import { workspaceTask } from '../lib/cloud/tasks'
import { activeDelivery } from '../lib/agent/deliveries'
import { recordAnswer, takeUnchanged } from '../lib/agent/answers'
import { findSpecAgent } from '../lib/agents'
import { findCard } from '../lib/view/read'
import { creationRefusal } from '../lib/view/rules'
import { TASKS_HEADING, addReadmeRef, stripReadmeRefs, repointReadmeLink } from '../lib/readme'
import { formatContractErrors, scanCardLines, validateSpec } from '../lib/spec-contract'
import { reconcileBoard } from '../lib/reconcile'
import type { Meta, MoveResult, Question } from '../lib/types'

export type { QuestionOpsInput }

// A one-shot todo item in any accepted form: `- [ ]`, `- []`, `- [x]`, `* [X]`, … — the
// shape counts, not the literal string.
const TODO_ITEM = /^[ \t]*[-*+][ \t]*\[[ xX]?\]/m

function defaultBody(summary = '<用一小段话先讲发生了什么、用户遇到什么，再讲这张卡要达到的结果。>') {
  return [
    summary,
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
  blockedBy?: string[]
  related?: string[]
  modules?: string[]
  slug?: string
  /** `--no-body`: Commander stores the negation, so this is false only when it was typed. */
  body?: boolean
  /** `--body-file`: a short draft or full card body. */
  bodyFile?: string
  /** `--workflow`: which workflow the card runs on (#715). Left off, the board's default. */
  workflow?: string
  /** `--previews`: the preview agents the card chose; `""` chooses none. */
  previews?: string[]
  /** `--triage`: the source id of the triage item this card is made of. */
  triage?: string
  /** `--source`, repeatable: a plan, a card or an address the card came from (#1306). */
  source?: string[]
  /** `--question` and the choices that qualify it, in the order they were typed. */
  asked: [key: string, value: string][]
  /** `--id`: the number Cloud gave the card's task (#2063); a card has no other. */
  id?: number
  /** The Cloud task a Runner workspace made this card from, kept as its first source. */
  fromTask?: string
}

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
  return text!
}

function normalizeBody(text: string, file: string) {
  let rows = text.replace(/\r\n/g, '\n').split('\n').map((text, i) => ({ text, line: i + 1 }))
  const trim = (lines: typeof rows) => {
    while (lines.length && !lines[0]!.text.trim()) lines.shift()
    while (lines.length && !lines.at(-1)!.text.trim()) lines.pop()
    return lines
  }
  const { visible } = scanCardLines(rows.map((row) => row.text))
  const sections = visible.flatMap((line, index) => {
    const heading = line.match(/^ {0,3}(#{1,3})\s+(.+?)\s*#*\s*$/)
    return heading ? [{ index, level: heading[1]!.length, title: heading[2]! }] : []
  })
  const acceptance = sections.filter((h) => h.title === 'Done when' && h.level >= 2)
  if (acceptance.length > 1) die(`${file}:${acceptance[1]!.index + 1} [duplicate-section] Duplicate Done when. Keep one ### Done when under ## Scope.`)
  const source = sections.find((h) => h.level === 2 && h.title === 'Source')
  if (source) {
    die(`${file}:${source.index + 1}: the body carries a \`## Source\` section — drop it and pass --source <plan path | plan:<id> | #<id> | URL> instead`, { kind: 'needs-input' })
  }
  const boundary = (line: string) => /^\s*<!--\s*agent\s*-->\s*$/.test(line)
  const sectionEnd = (line: string) => /^ {0,3}#{1,2}\s/.test(line) || boundary(line)
  const formal = sections.some((h) => h.level <= 2 && h.title !== 'Done when') || visible.some(boundary)
  const done = acceptance.find((h) => h.level === 2)
  let checklist: typeof rows = []
  if (done) {
    const end = visible.findIndex((line, i) => i > done.index && sectionEnd(line))
    checklist = trim(rows.splice(done.index, (end < 0 ? rows.length : end) - done.index))
    checklist[0]!.text = '### Done when'
  }
  if (!formal) {
    rows = [...trim(rows), ...defaultBody('').split('\n').slice(1).map((text) => ({ text, line: 1 }))]
  }
  if (checklist.length) {
    const scan = scanCardLines(rows.map((row) => row.text)).visible
    const scope = scan.findIndex((line) => /^ {0,3}##\s+Scope\s*#*\s*$/.test(line))
    const next = scope < 0 ? -1 : scan.findIndex((line, i) => i > scope && sectionEnd(line))
    rows.splice(next < 0 ? rows.length : next, 0, ...checklist, { text: '', line: 1 })
  }
  rows = trim(rows)
  return { body: rows.map((row) => row.text).join('\n') + '\n', lines: rows.map((row) => row.line) }
}

// Create writes one card under the number Cloud gave its task, and indexes it.
// The script owns the meta; fill the body with your editor and leave the frontmatter alone.
export function validateCreate(opts: CreateOptions) {
  const title = opts.title.trim()
  if (!title) die('--title must not be empty')
  const priority = opts.priority ?? 'med'
  const blocked_by = parseIdList(opts.blockedBy ?? [], 'blocked-by')
  const related = parseIdList(opts.related ?? [], 'related')
  const modules = validModules(opts.modules ?? [])
  const triage = (opts.triage ?? '').trim()
  const workflow = workflowFlag(opts.workflow ?? (triage ? itemWorkflow(triage) : undefined))
  const flow = workflowFor(workflow)
  const previews = opts.previews === undefined ? undefined : previewsFlag(opts.previews, flow)
  const stages = previews ? cardStages({ previews }, flow).length : 0
  const source = sourceFlag(opts.source ?? [], 'source')
  if (opts.fromTask && !source.includes(opts.fromTask)) source.unshift(opts.fromTask)
  const questions = collectQuestions(opts.asked ?? [])
  const draft = bodyFromFile(opts)
  const normalized = draft ? normalizeBody(draft, opts.bodyFile!) : null
  const written = normalized?.body ?? null
  if (written) {
    const header = serializeFrontmatter({ title, priority, status: 'todo', blocked_by, related, modules, workflow, previews, stages, triage, source, questions }) + '\n\n'
    const errors = validateSpec(opts.bodyFile!, header + written)
    const offset = header.split('\n').length - 1
    for (const error of errors) error.line = normalized!.lines[error.line - offset - 1] ?? 1
    if (errors.length) die(formatContractErrors(errors))
  }
  return { title, priority, blocked_by, related, modules, triage, workflow, previews, stages, source, questions, written }
}

export function cmdCreate(opts: CreateOptions): MoveResult {
  const { title, priority, blocked_by, related, modules, triage, workflow, previews, stages, source, questions, written } = validateCreate(opts)
  if (opts.id === undefined) die('请通过 `akb raw create` 创建卡片，由 Cloud 分配编号', { kind: 'needs-cloud' })
  const start = opts.id
  const slug = slugify(opts.slug !== undefined ? opts.slug : title)
  const fileRel = `${start}-${slug}.md`
  const file = path.join(TODO, fileRel)
  const held = locate(start) ?? locateArchived(start)
  // Cloud answered a retry with the task already made: its card is the one written then.
  if (held && path.basename(held.target) === `${start}-${slug}.md`) {
    say(start)
    say(`  ${rel(held.target)} was already written`)
    return { id: start, ids: [start], title, file: rel(held.target), indexed: false }
  }
  if (held) die(`#${start} is already a card here (${rel(held.target)})`, { kind: 'id-taken', id: start })
  if (fs.existsSync(file)) die(`${rel(file)} already exists — pick a different --slug`)

  // validation passed → write
  countBoardEvent(triage ? 'cards_created_proposed' : 'cards_created_asked')
  const meta: Partial<Meta> = { title, priority, status: 'todo', blocked_by, related, modules, workflow, previews, stages, triage, source, questions }
  const scaffolded = !written && opts.body !== false
  const body = written ?? (scaffolded ? defaultBody() : '')
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n\n' + body)
  const indexed = addReadmeRef(start, title, fileRel)
  say(start)
  say(
    `  wrote ${rel(file)} — frontmatter is set` +
      (written ? '; the body came from --body-file' : scaffolded ? '; fill the body with your editor, leave the frontmatter to the script' : ''),
  )
  if ((scaffolded || written) && !TODO_ITEM.test(body)) warn(`#${start} has no todos — every task needs a \`- [ ]\` list under ## Todo`)
  if (indexed) say(`  indexed under "## ${TASKS_HEADING}"`)
  reconcileBoard()
  return { id: start, ids: [start], title, file: rel(file), indexed }
}

/** `akb raw update`, as its command declares it (lib/cli/board.ts). */
export interface UpdateOptions {
  title?: string
  priority?: string
  status?: string
  blockedBy?: string[]
  related?: string[]
  addBlockedBy?: string[]
  addRelated?: string[]
  modules?: string[]
  slug?: string
  source?: string[]
  addSource?: string[]
  phase?: string
  /** `--previews`: the preview agents the card chose (#2154); `""` chooses none. */
  previews?: string[]
  /** `--workflow`: move the card to another workflow; `""` is the default (#1849). */
  workflow?: string
}

// What `--source` names, as `source:` stores it. A plan's path becomes `plan:<id>`, which
// outlives a rename and the move into `plans/archive/`.
function sourceFlag(said: string[], flag: string): string[] {
  const out: string[] = []
  for (const one of said) {
    if (!one.trim()) continue
    const ref = sourceRefFrom(one)
    if (!ref) die(`--${flag} ${JSON.stringify(one)} is not a source — pass a plan's path, plan:<id>, #<id> or a URL`, { kind: 'needs-input' })
    if (!out.includes(ref!)) out.push(ref!)
  }
  return out
}

// Which workflow a card runs on: the one asked for, else the only one — inside a task's run,
// the task's own. Never a guess among several (#498).
function workflowFlag(asked: string | undefined): string {
  const wanted = (asked ?? '').trim()
  if (wanted) return knownWorkflow(wanted)
  const all = workflows()
  if (!all[0]) die(noWorkflowMessage(''), { kind: 'no-workflow', workflow: '' })
  if (all.length > 1 && !workspaceTask()) {
    die(`--workflow is required on a board with several workflows. Pick one: ${all.map((w) => w.id).join(', ')}`, { kind: 'needs-input' })
  }
  return all[0]!.id
}

// The workflow a triage item named, when this board still has it: the card made of it runs on it.
function itemWorkflow(sourceId: string): string | undefined {
  const item = [...readInbox(), ...readArchived(), ...readAllDismissed()].find((signal) => signal.sourceId === sourceId)
  return item?.workflow && workflowById(item.workflow) ? item.workflow : undefined
}

// `--previews`: the chosen preview agents, in their workflow's order; `""` chooses none.
function previewsFlag(said: string[], flow: ReturnType<typeof workflowFor>): string[] {
  const offered = flow ? previewAgents(flow).map((h) => h.agent) : []
  const asked = new Set(said.map((name) => canonicalSpecAgent(name.trim())).filter(Boolean))
  const unknown = [...asked].filter((name) => !offered.includes(name))
  if (unknown.length) {
    die(`${unknown.map((n) => `\`${n}\``).join(', ')} ${unknown.length > 1 ? 'are not previews' : 'is not a preview'} of its workflow. It offers: ${offered.join(', ') || 'none'}.`, { kind: 'needs-input' })
  }
  return offered.filter((name) => asked.has(name))
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
  if (flags.status !== undefined) {
    meta.status = flags.status
    changes.push('status')
  }
  const hadBlockedBy = meta.blocked_by
  if (flags.blockedBy !== undefined) {
    meta.blocked_by = parseIdList(flags.blockedBy, 'blocked-by')
    changes.push('blocked_by')
  }
  if (flags.related !== undefined) {
    meta.related = parseIdList(flags.related, 'related')
    changes.push('related')
  }
  // Only the new ids are checked: one already listed stays even if its card has since closed.
  if (flags.addBlockedBy !== undefined) {
    meta.blocked_by = appendIds(meta.blocked_by, parseIdList(flags.addBlockedBy, 'add-blocked-by'))
    changes.push('blocked_by')
  }
  // Only new edges are checked, so a cycle already on the board can still be edited apart.
  for (const dep of meta.blocked_by.filter((d) => !hadBlockedBy.includes(d))) {
    if (dep === id) die(`#${id} cannot be blocked by itself.`, { kind: 'dependency-cycle', cycle: [id, id] })
    const cycle = dependencyCycle(id, dep)
    if (cycle) die(`#${id} blocked by #${dep} makes a cycle: ${cycle.map((n) => `#${n}`).join(' → ')}`, { kind: 'dependency-cycle', cycle })
  }
  if (flags.addRelated !== undefined) {
    meta.related = appendIds(meta.related, parseIdList(flags.addRelated, 'add-related'))
    changes.push('related')
  }
  if (flags.modules !== undefined) {
    meta.modules = validModules(flags.modules)
    changes.push('modules')
  }
  // `--source ""` clears the list.
  if (flags.source !== undefined) {
    meta.source = sourceFlag(flags.source, 'source')
    changes.push('source')
  }
  if (flags.addSource !== undefined) {
    meta.source = [...new Set([...meta.source, ...sourceFlag(flags.addSource, 'add-source')])]
    changes.push('source')
  }
  if (flags.workflow !== undefined && switchWorkflow(id, meta, flags.workflow)) {
    changes.push(`workflow→${meta.workflow}`, 'status→todo')
  }
  const flow = workflowFor(meta.workflow)
  if (flags.previews !== undefined) {
    meta.previews = previewsFlag(flags.previews, flow)
    changes.push('previews')
  }
  // Derived, for whatever reads the card without the board's agents (Cloud).
  meta.stages = meta.previews ? cardStages(meta, flow).length : 0
  if (flags.phase !== undefined) {
    const n = Number(flags.phase)
    const stages = cardStages(meta, flow).length
    if (!Number.isInteger(n) || n < 1 || n > stages) die(`--phase must be 1 to ${stages}, the approvals its previews make (got "${flags.phase}")`)
    meta.phase = n
    changes.push('phase')
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
  say(`updated #${id}: ${changes.join(', ') || '(nothing changed)'}`)
  return { id, changes, file: rel(dest) }
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
    die('only the user skips or reopens a question — a run leaves questions for them to answer')
  }

  const changes: string[] = []
  let skipped = 0
  let unskipped = 0
  const asker = specRunAgent()
  // How each question closed (#1472), counted once the write lands.
  const closed: BoardCount[] = []
  const verifying = !!activeDelivery(id)
  const close = (qs: Question[]): void => {
    for (const q of qs) {
      closed.push(verifying ? 'questions_closed_verify' : 'questions_closed_user')
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
  const open = openOf(meta.questions).length
  // The same invariant cmdUpdate holds: a `ready` card has no open questions.
  if (open > 0 && meta.status === 'ready') {
    meta.status = 'todo'
    changes.push('status→todo (open questions)')
  }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  for (const kind of closed) countBoardEvent(kind)
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
