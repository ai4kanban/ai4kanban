// Printing a board action instead of running it.
//
// Every command that starts a run has a second mode: `--print` says what to do and starts
// nothing. It is for the agent that is already in the conversation — asked for a board
// action by the person typing, it does the job itself rather than paying for a second agent
// to do the job it is sitting there to do. The rule for choosing between the two modes is
// written beside each command in `akb help`, so it is read where the choice is made.
//
// What comes out is filled in from THIS board: the card's own path, the steps it has left,
// the memory file its modules point at, the tracks this project uses, the release it is in.
// A page of general advice is a page the reader has to go and look everything up from.
//
// And it is only what the job needs — asking about one card never prints the manual. The
// flows this action needs come out in full (`lib/guide.ts`), because a pointer to a second
// command is a step an agent skips; every other flow is `akb guide <topic>` away.
//
// The words at the top are `buildPrompt`'s, unchanged. That is the point: a job done from a
// printed flow and the same job done by a button are given the same instruction, so both
// land the same result.
//
// One thing a printed flow has to say that a run never does: how the job closes. A run the
// board started is watched, and the watcher does the bookkeeping at the end — putting the
// card's stage back, stamping a recurring run, starting the refines that follow. Nothing is
// watching an agent that followed a printed flow, so every one of these ends by naming the
// command that closes the job, and the action it hands over to when it hands over.

import fs from 'node:fs'
import path from 'node:path'

import { idPrefix, locate } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { say } from '../io'
import { findGuide } from '../guide'
import { die, rel, CONFIG, DIR_FLAG, GOAL, KANBAN, MEMORY, MODULES_MD, REPO_ROOT, SETUP_CHECKLIST, TODO } from '../paths'
import { changelogRefusal, quoteId, readNewestClose, readReleaseEntries } from '../releases'
import { findSetupQuestionsCard, readSetupChecklist } from '../setup'
import type { Meta, MoveResult } from '../types'
import { moduleNames } from '../validate'
import { candidateFileStats, candidateOf, candidatePatch, candidateStat } from './candidate'
import { changedPaths, conflictedPaths, worktreeDir } from './worktree'
import { boardCommandFor } from './command'
import { activeDelivery } from './deliveries'
import { lastRound, openFindings } from './review'
import { field, metaLine, numbered, trackNames } from './facts'
import { buildAsk, frozenRules } from './prompts'
import { flowByAction } from './flows'
import { ruleFor } from './rules'
import { setupInstruction } from './resolve'
import type { AgentAction, AgentRequest } from './types'

// The run id an agent works under. It lives in agent/env.ts, which imports nothing, so
// the delivery lock can ask the same question without pulling this module in behind it.
export { insideRun, runEnv, RUN_ENV } from './env'

// How many of a card's remaining steps are printed before the rest are counted instead. A
// long card's whole plan is in the file the flow names; the point here is to show what is
// left, not to copy the card.
const MAX_STEPS = 12

// Small candidates arrive inline. Large ones get a complete per-file summary without
// spending the review's context on a patch it can open selectively.
const MAX_REVIEW_DIFF = 40_000

// ---- what the board says right now -----------------------------------------

/** One card, as a printed flow reads it. */
interface CardFacts {
  id: number
  /** The card file, repo-relative — the path as it really is, ready to open. */
  file: string
  /** The whole card. A revise certainly reads it, so its printed flow carries it. */
  text: string
  meta: Meta
  /** The unticked `## Todo` boxes, in order. */
  steps: string[]
  /** How many boxes are already ticked. Ticked boxes are history, so this is what the job
   *  must not touch. */
  ticked: number
  /** The card carries a `## Process` — the run instructions of a recurring card. */
  hasProcess: boolean
  /** The card sits in `todo/recurring/`, so it is a job that repeats and never finishes. */
  recurring: boolean
}

function readCard(id: number): CardFacts {
  const found = locate(id)
  if (!found) {
    die(`no card #${id} on this board. \`akb board list\` says what is open.`, {
      kind: 'card-not-found',
      id,
    })
  }
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    die(`#${id} is on the board but ${rel(file)} can't be read.`, { kind: 'card-unreadable', id })
  }
  const { meta, body } = parseFrontmatter(text)
  if (!meta) {
    die(`${rel(file)} has no frontmatter — run \`akb board migrate\` before working on it.`, {
      kind: 'card-unreadable',
      id,
    })
  }
  const { steps, ticked } = readTodo(body)
  return {
    id,
    file: rel(file),
    text,
    meta,
    steps,
    ticked,
    hasProcess: /^##\s+Process\s*$/im.test(body),
    recurring: found.rel.split(path.sep)[0] === 'recurring',
  }
}

// The `## Todo` boxes: what is left, and how many are ticked. A card body hard-wraps, so a
// step runs over several lines — the continuation lines are folded back onto the box they
// belong to, because half a sentence is not a step.
function readTodo(body: string): { steps: string[]; ticked: number } {
  const steps: string[] = []
  let ticked = 0
  let inTodo = false
  let open = false // the last box read was an unticked one, so a wrapped line belongs to it
  for (const line of body.split('\n')) {
    if (/^##\s/.test(line)) {
      inTodo = /^##\s+Todo\s*$/i.test(line)
      open = false
      continue
    }
    if (!inTodo) continue
    const box = line.match(/^\s*[-*]\s+\[([ xX])\]\s*(.*)$/)
    if (box) {
      if (box[1] === ' ') {
        steps.push(box[2]!.trim())
        open = true
      } else {
        ticked++
        open = false
      }
      continue
    }
    if (open && /^\s+\S/.test(line)) steps[steps.length - 1] += ` ${line.trim()}`
    else if (!line.trim()) open = false
  }
  return { steps, ticked }
}

// Which copy of a memory file a note belongs in — "The memory set" in `akb guide board`, read
// only: the named module's copy, both when the card names two, the project-wide one when it
// names none. It never scaffolds, because printing a flow must not write to the board.
function memoryFiles(modules: string[], name: string): string[] {
  const dirs = modules.length ? modules.map((m) => path.join(MEMORY, m)) : [MEMORY]
  return dirs.map((dir) => rel(path.join(dir, name)))
}

// The jobs `akb guide board` tells to read the project's settings before they start:
// proposing, adding, refining. For those it is a certain read, and a certain read costs
// less printed here than fetched in a round of its own.
const CONFIG_FOR = new Set<AgentAction>(['propose', 'create', 'refine'])

// The settings file as it stands, or null when the board has none.
function configText(): string | null {
  try {
    return fs.readFileSync(CONFIG, 'utf8').trim() || null
  } catch {
    return null
  }
}

// ---- laying one out --------------------------------------------------------

// A flow is built as sections, then printed. Keeping it as data until the end is what lets
// `--json` hand a caller the same flow the terminal shows.
interface Section {
  head: string
  lines: string[]
}

const indent = (line: string): string =>
  line
    .split('\n')
    .map((l) => (l.trim() ? `  ${l}` : ''))
    .join('\n')

// What is left of the plan. The remaining boxes are the job; the ticked ones are history and
// are counted rather than listed, so nobody re-does them.
function stepsField(card: CardFacts): string[] {
  if (!card.steps.length) {
    return field('steps', card.ticked ? `none left — all ${card.ticked} ticked` : 'the card has no ## Todo yet')
  }
  const shown = card.steps.slice(0, MAX_STEPS)
  const head = `${card.steps.length} left${card.ticked ? `, ${card.ticked} ticked already` : ''}:`
  const rest = card.steps.length > shown.length ? [`… and ${card.steps.length - shown.length} more in the card`] : []
  return field('steps', [head, ...numbered(shown).map((s) => `  ${s}`), ...rest])
}

// The same plan, counted rather than listed — for a job that isn't working through the
// steps and only needs to know whether any are left.
function stepsCount(card: CardFacts): string[] {
  if (!card.steps.length) return field('steps', `all ${card.ticked} ticked`)
  return field(
    'steps',
    `${card.steps.length} of ${card.steps.length + card.ticked} still unticked — read them in the card before you go on`,
  )
}

// What the delivery in flight on this card was approved to build.
//
// A delivery takes a copy of the card's approved requirements when it starts and builds
// from THAT, so a card edited underneath it never changes what it is building. So the flow
// prints the copy, not the card as it reads now — and says which is which, because the two
// sit next to each other on disk and only one of them is the job.
//
// `## Todo` is deliberately not in the copy: it is the one requirement-shaped section a
// delivery writes to as it works, so it stays live and is printed from the card below.
function approvedField(cardId: number): string[] {
  const delivery = activeDelivery(cardId)
  if (!delivery) return []
  const approved = delivery.approved.trim()
  return [
    ...field('delivery', `${delivery.deliveryId} — you are working inside it`),
    ...field(
      'approved',
      approved
        ? [
            'build THIS, not the card file as it reads now — it is the card as it was approved when',
            'the delivery started, and the file may have moved on since:',
            '',
            ...approved.split('\n'),
          ]
        : 'nothing was captured when this delivery started — build the card as it reads',
    ),
  ]
}

// The code a delivery has built so far. A small patch is printed in full; a large one gets
// every changed file and its line counts so review can open only what needs inspection.
function candidateField(cardId: number, includePatch = true): string[] {
  const delivery = activeDelivery(cardId)
  if (!delivery) return []
  if (!delivery.base) {
    return field('changes', [
      'this project is not a git repository, so there is no base to diff against —',
      'judge the working tree as it stands, and say so in your findings.',
    ])
  }
  const candidate = candidateOf(delivery)
  const stat = candidateStat(candidate)
  const files = candidateFileStats(candidate)
  const patch = includePatch ? candidatePatch(candidate) : ''
  const command =
    delivery.worktree && delivery.branch
      ? `git diff ${delivery.base.slice(0, 12)} ${delivery.branch}`
      : `git diff ${delivery.base.slice(0, 12)}`
  const shown = files?.length ? ['changed files:', ...files.map((file) => `  ${file}`)] : ['no file changed']
  let diff: string[] = []
  if (!includePatch) {
    diff = ['', `patch omitted for this focused rebase review; open \`${command}\` only where the target changes interact.`]
  } else if (patch === null) diff = ['', 'the diff could not be read']
  else if (patch.length > MAX_REVIEW_DIFF) {
    const where = delivery.worktree
      ? `the full patch is \`${command}\``
      : `the tracked patch is \`${command}\`; new files are listed above`
    diff = ['', `diff omitted at ${patch.length.toLocaleString()} characters; ${where}.`]
  } else if (patch) diff = ['', 'diff:', '```diff', ...patch.trimEnd().split('\n'), '```']
  return field('changes', [
    ...(stat ? [`${stat}.`] : []),
    ...shown,
    ...diff,
    ...(!delivery.worktree ? ['this is the shared working tree; report changes that do not belong to the delivery.'] : []),
  ])
}

// A clean rebase that touched the same path on both sides needs only an integration pass:
// the delivery itself already passed. Name the intersection so the reviewer does not
// repeat the full requirements review and repository-wide checks.
function rebaseReviewField(cardId: number): string[] {
  const delivery = activeDelivery(cardId)
  const landing = delivery?.landing
  if (
    !delivery?.base ||
    !delivery.branch ||
    !delivery.worktree ||
    landing?.rebaseKind !== 'overlap' ||
    !landing.rebasedFrom ||
    !landing.rebasedAt ||
    (lastRound(delivery)?.at ?? 0) >= landing.rebasedAt
  ) {
    return []
  }
  const dir = worktreeDir(delivery.worktree)
  const targetFiles = changedPaths(landing.rebasedFrom, delivery.base, dir)
  const targetSet = new Set(targetFiles)
  const shared = changedPaths(delivery.base, delivery.branch, dir).filter((file) => targetSet.has(file))
  return field('scope', [
    'focused post-rebase integration review — this delivery already passed before the clean rebase.',
    `inspect only how ${delivery.targetBranch} changed since ${landing.rebasedFrom.slice(0, 12)} and how that interacts with the delivery.`,
    `shared path${shared.length === 1 ? '' : 's'}: ${shared.length ? shared.join(', ') : '(none could be read — inspect the two diffs)'}.`,
    `target delta: \`git diff ${landing.rebasedFrom.slice(0, 12)} ${delivery.base.slice(0, 12)}\`.`,
    'rely on the previous pass for unchanged requirements and unaffected checks; run only checks affected by this intersection.',
  ])
}

// The checkout this job works in, and how it reaches the board from there. It is only ever
// said when the two are not the same folder: a delivery with a worktree of its own writes
// code there and the board's own files in the project, and a relative `node cli/bin/…`
// would run the worktree's copy of a command the delivery may be halfway through
// rewriting.
function workspaceField(cardId: number): string[] {
  const delivery = activeDelivery(cardId)
  if (!delivery?.worktree) return []
  return field('workspace', [
    `write code in ${delivery.worktree} — this delivery's own worktree, on branch ${delivery.branch}.`,
    `it is your working folder already; the board's own files are NOT in it and never go on that branch.`,
    `every board command names the project's own copy: \`${boardCommandFor(cardId)} <command>\`.`,
    `${rel(REPO_ROOT)} is the project — the card, the memory files and the docs are changed there, not here.`,
  ])
}

// Where review stands on this delivery. Historical correction verdicts are named so a
// review resumed after upgrade can fix their findings in this run.
function reviewField(cardId: number): string[] {
  const delivery = activeDelivery(cardId)
  const review = delivery?.review
  if (!review?.rounds.length) return field('review', 'the first pass on this delivery — nothing has judged it yet')
  const last = review.rounds[review.rounds.length - 1]
  const passes = review.rounds.map((r, i) => `${i + 1}. ${r.verdict}${r.findings.length ? ` — ${r.findings.map((f) => f.title).join('; ')}` : ''}`)
  return field('review', [
    `${review.rounds.length} pass${review.rounds.length === 1 ? '' : 'es'} so far:`,
    ...passes.map((line) => `  ${line}`),
    ...(last?.verdict === 'correct'
      ? [
          'this delivery came from an older review flow — fix these findings in this run before recording pass or ask:',
          ...last.findings.map((finding) => `  - **${finding.title}**: ${finding.detail}`),
        ]
      : []),
  ])
}

// The conflict a landing's rebase stopped on: the files, the branch it clashed with, and
// the cards on the other side — everything the run needs to see both intentions rather
// than only the markers in front of it.
function conflictField(cardId: number): string[] {
  const delivery = activeDelivery(cardId)
  if (!delivery?.worktree) return field('conflict', 'no delivery with a worktree is landing this card')
  const files = conflictedPaths(worktreeDir(delivery.worktree))
  const overlap = delivery.landing?.overlap ?? []
  return field('conflict', [
    files.length
      ? `${files.length} file${files.length === 1 ? '' : 's'} to resolve in ${delivery.worktree}:`
      : `the rebase onto ${delivery.targetBranch} stopped, but no file is conflicted right now — check \`git status\` there`,
    ...files.map((f) => `  ${f}`),
    `the other side is ${delivery.targetBranch} as it stands now; \`git log ${delivery.base?.slice(0, 12) ?? delivery.targetBranch}..${delivery.targetBranch}\` is what arrived while this card was being built.`,
    ...(overlap.length
      ? [`${overlap.map((c) => `#${c}`).join(', ')} ${overlap.length === 1 ? 'is' : 'are'} being built over the same files — read ${overlap.length === 1 ? 'that card' : 'those cards'} before you decide what to keep.`]
      : []),
  ])
}

// Findings needed only by a legacy correction run already in flight during an upgrade.
function findingsField(cardId: number): string[] {
  const delivery = activeDelivery(cardId)
  const findings = delivery ? openFindings(delivery) : []
  if (!findings.length) return field('findings', 'none recorded')
  const verdict = delivery ? lastRound(delivery)?.verdict : undefined
  return field('findings', [
    `${findings.length} from the last review (${verdict ?? 'unknown'}):`,
    ...findings.map((f) => `  - **${f.title}**: ${f.detail}`),
  ])
}

// The card's post-implementation notes as they read right now — NOT part of the approved
// copy, and the one place the user records an exception they have approved for this exact
// candidate. A reviewer that never reads them re-raises what has already been settled.
function notesField(card: CardFacts): string[] {
  const lines: string[] = []
  let inside = false
  for (const line of card.text.split('\n')) {
    if (/^##(?!#)\s/.test(line)) {
      inside = /^##\s+Worth noting after implementation\s*$/i.test(line)
      continue
    }
    if (inside && line.trim()) lines.push(line)
  }
  return field(
    'notes',
    lines.length
      ? ['## Worth noting after implementation, as the card reads now:', ...lines.map((l) => `  ${l}`)]
      : 'the card has no ## Worth noting after implementation yet',
  )
}

// The open questions, numbered as the board numbers them — the numbers are what
// `update-questions` and `tag` take, so a flow that lists them differently is a flow that
// gets the wrong question answered.
function questionsField(meta: Meta): string[] {
  if (!meta.questions.length) return field('questions', 'none open')
  const lines = meta.questions.map((q, i) => `${i + 1}. ${q.text}${q.options?.length ? ` (${q.options.length} options)` : ''}`)
  return field('questions', [`${meta.questions.length} open:`, ...lines.map((s) => `  ${s}`)])
}

// The hand-checks already on the card, numbered as `update-verify --drop` takes them. Only
// printed when the card carries some: the point is to stop a job appending a line that is
// already there, not to remind every card that the field exists.
function verifyField(meta: Meta): string[] {
  if (!meta.verify.length) return []
  return field('verify', [
    `${meta.verify.length} already left for the user to check by hand:`,
    ...numbered(meta.verify).map((s) => `  ${s}`),
  ])
}

// What a run that wrote code has to leave behind for review to read it. In a worktree the
// board commits the whole change onto the delivery's branch as the run closes — so the one
// thing asked of the run is to leave nothing of the board's own in there, which
// is what a commit would be refused for. In manual commit mode nothing is committed at all:
// the code stays in the user's checkout and the commit is theirs, after review passes.
function committingClose(cardId: number): string[] {
  const delivery = activeDelivery(cardId)
  if (!delivery) return []
  if (delivery.worktree) {
    return [
      `leave your work in ${delivery.worktree} — the board commits all of it onto ${delivery.branch} when this run ends, and review reads that branch`,
      `never write the board's own files into the worktree: a commit that reaches one is refused, and the delivery stops`,
    ]
  }
  return [
    'leave your work uncommitted — automatic Git commits are off, so the user commits it themselves once review passes',
  ]
}

// ---- the flows -------------------------------------------------------------

// One printed flow, before it is printed.
interface Flow {
  /** The line that says what this is and that nothing started. */
  lead: string
  /** What the board says about the job, filled in from this board. */
  facts: string[]
  /** The guides this action is done by, by name — printed in full, in this order. */
  guides: string[]
  /** The steps that close the job, in order — the bookkeeping no watcher will do. */
  close: string[]
  /** The action this job hands over to, and when. */
  next: string[]
}

/** The flows each action is done by. `board` opens every card action, because the card
 *  format, the memory set and the layout are what all of them are written against — the
 *  short note installed in a project no longer carries any of it.
 *
 *  Order matters: the general rules first, then the flow for this one job. */
const GUIDES_FOR: Record<AgentAction, string[]> = {
  implement: ['board', 'document-feature'],
  // Review writes on the card — a post-implementation note, a follow-up card, an open
  // question — so it needs the card format as much as the review flow itself.
  review: ['board', 'review'],
  // Kept only for a correction run resumed from an older delivery.
  correct: [],
  conflict: ['conflict'],
  run: ['board', 'recurring-task'],
  refine: ['board', 'refine', 'resolve'],
  resolve: ['board', 'resolve'],
  edit: ['board', 'revise'],
  create: ['board', 'add-task'],
  propose: ['board', 'propose', 'add-task'],
  'plan-release': ['board', 'releases', 'plan-release', 'add-task'],
  // A changelog run gets its own flow and NOT `board`: it writes no card, so the card
  // format, the memory set and the tracks are a page of rules about work it cannot do.
  changelog: ['changelog'],
  archive: ['board'],
  reject: ['board', 'reject'],
  setup: ['board', 'setup'],
  // A spec agent gets its own flow and NOT `board`: it writes one section, never a card,
  // so the card format, the memory set and the tracks are a page of rules about work it is
  // not allowed to do. `akb spec` has no --print, so this is only ever read by the run.
  spec: ['spec-agent'],
}

/** Build the flow for one action. A `board` command spelled out here is spelled with the
 *  program the caller was typed as, so what is printed can be pasted back. */
function buildFlow(req: AgentRequest, program: string): Flow {
  // How this job spells the board's command. A delivery working in its own worktree names
  // the project's copy outright (#303) — a relative path there would run the worktree's own
  // half-rewritten copy, and no `--dir` would leave the board to be guessed at.
  const inWorktree = req.id !== undefined && !!activeDelivery(req.id)?.worktree
  const self = inWorktree ? boardCommandFor(req.id) : `${program}${DIR_FLAG}`
  const board = `${self} board`
  const facts: string[] = []
  const close: string[] = []
  const next: string[] = []
  const card = req.id !== undefined ? readCard(req.id) : null

  // The refine a job hands over to. A run starts each follow-up refine as its own run,
  // never inside the job that wrote the card — so the handover says fresh run, or an
  // agent reading the flow refines right here, in a context already full of the writing.
  const refineNext = (target: number | '<id>', when: string) =>
    `${self} refine ${target === '<id>' ? target : String(target)} --print — ${when}; in a fresh run, not this one — the board gives each refine its own clean context, and so should you`

  // Every card action opens the same way: where the card is, and what it says about itself.
  if (card) {
    facts.push(...field('card', card.file), ...field('meta', metaLine(card.meta)))
  }

  switch (req.action) {
    case 'implement': {
      facts.push(...approvedField(req.id!))
      facts.push(...workspaceField(req.id!))
      facts.push(...stepsField(card!))
      if (card!.meta.questions.length) facts.push(...questionsField(card!.meta))
      facts.push(...verifyField(card!.meta))
      facts.push(...field('memory', memoryFiles(card!.meta.modules, 'readme.md')))
      // Inside a delivery the build is not the end of the job: a fresh run reviews what
      // it made against the approved copy, the board lands it, and the board archives the
      // card once it has landed (#302, #307). Outside one — a card built by hand from a
      // printed flow — the build closes the card exactly as it always has.
      const reviewed = !!activeDelivery(req.id!)
      close.push(
        ...committingClose(req.id!),
        'tick each box in ## Todo as you finish it — they are the record of what was built',
        `${board} update-verify ${req.id} --append ".." — add one short note for each manual check left to the user; a decision that needs an answer goes to \`update-questions\` instead`,
        `write the shipped line in the memory file above — "Finish a task" in \`akb guide board\``,
        reviewed
          ? `leave the card on the board — review comes next in this delivery, and the board archives the card itself once the delivery has landed`
          : `${board} archive ${req.id} — once every box is ticked and the card's goal is met`,
      )
      if (card!.meta.questions.length) {
        next.push(
          `${self} resolve ${req.id} --print — first: the card has open questions, and building on a guess is what they are there to stop`,
        )
      }
      if (reviewed) {
        next.push(
          `${self} review ${req.id} --print — the review this delivery makes next. A run the board started has its review started for it; an agent that built this from a printed flow runs it itself, in a fresh run`,
        )
      }
      break
    }
    // Judging a delivery's work against the card it was approved to build (#302). The
    // approved copy and the diff are the whole of what a reviewer is given — never the
    // run that wrote it, because a reviewer that reads the implementer's reasoning
    // agrees with it.
    case 'review': {
      const focused = rebaseReviewField(req.id!)
      if (focused.length) {
        facts.push(...workspaceField(req.id!))
        facts.push(...focused)
        facts.push(...candidateField(req.id!, false))
        facts.push(...reviewField(req.id!))
      } else {
        facts.push(...approvedField(req.id!))
        facts.push(...workspaceField(req.id!))
        facts.push(...candidateField(req.id!))
        facts.push(...reviewField(req.id!))
        facts.push(...stepsField(card!))
        facts.push(...notesField(card!))
        facts.push(...questionsField(card!.meta))
      }
      close.push(
        `${board} review-verdict ${req.id} --verdict pass|ask [--file <findings>] — the ONE way a review is recorded. Without it the delivery stops and asks the user, whatever you wrote in your last message`,
        'write each finding as `- **<short title>**: <the approved requirement or the changed code it concerns, and the evidence to act on it>` — the title is its identity, so the same mistake keeps the same one',
        'a finding that needs awareness but no decision is not a finding: put it under `## Worth noting after implementation` on the card, and it stops nothing',
        `leave the card on the board — a pass is not the end of the delivery, and the board archives the card itself once the work has landed`,
      )
      break
    }
    // Kept only for a legacy correction run already in flight during an upgrade.
    case 'correct': {
      facts.push(...approvedField(req.id!))
      facts.push(...workspaceField(req.id!))
      facts.push(...findingsField(req.id!))
      facts.push(...candidateField(req.id!))
      facts.push(...stepsField(card!))
      close.push(
        ...committingClose(req.id!),
        'fix the recorded findings; a combined review follows',
        'tick a ## Todo box your fix completes; never untick one',
        'change nothing else on the card — the delivery builds the approved copy above, not the file as it reads now',
      )
      next.push(`${self} review ${req.id} --print — review and fix the resulting delivery`)
      break
    }
    // Resolving the conflict a landing's rebase stopped on (#304). It is the only run
    // that reads TWO cards: this one, and whatever is on the target branch it clashed with.
    case 'conflict': {
      facts.push(...approvedField(req.id!))
      facts.push(...workspaceField(req.id!))
      facts.push(...conflictField(req.id!))
      facts.push(...candidateField(req.id!))
      close.push(
        'resolve every conflicted file so both sides survive — the other side is already on the target branch, and this card is what the approved copy above asks for',
        '`git add` each file you resolved, and leave the rebase alone: the board runs `git rebase --continue` after this run, and a fresh review judges the result from scratch',
        'change nothing the conflict does not name, and change nothing on the card',
      )
      break
    }
    case 'run': {
      facts.push(
        ...field('process', card!.hasProcess ? `the job is the card's ## Process — do its steps in order` : `the card has no ## Process — there is nothing to run`),
      )
      close.push(
        `${board} record-run ${req.id} — counts this pass and stamps last_run`,
        `${board} update-verify ${req.id} --append ".." — add one short note for each manual check this pass left to the user`,
        `never archive it: a recurring card has no end state`,
      )
      next.push(
        `${self} resolve ${req.id} --print — for any question this pass left on the card; nothing else on the board resolves a recurring card`,
      )
      break
    }
    case 'refine': {
      facts.push(...stepsField(card!), ...questionsField(card!.meta))
      facts.push(...field('tracks', trackNames().join(', ') || '(none)'))
      facts.push(...field('goal', rel(GOAL)))
      close.push(
        `${board} update-questions ${req.id} --append ".." — for each call that is really the user's`,
        `${board} tag ${req.id} <n> user — hand the ones only they can settle over`,
        `${board} update ${req.id} --status ready — when you are highly confident the plan is ready to build: no substantive gap left, no question open. Otherwise leave it todo, and a fresh pass takes it on`,
      )
      if (card!.meta.questions.length) {
        next.push(`${self} resolve ${req.id} --print — first: a card with open questions can't be refined`)
      }
      break
    }
    case 'resolve': {
      facts.push(...questionsField(card!.meta))
      facts.push(...verifyField(card!.meta))
      facts.push(...field('memory', memoryFiles(card!.meta.modules, 'decisions.md')))
      close.push(
        `${board} update-verify ${req.id} --append ".." — first, for any entry that is a hand-check and not a question; then drop it from the question list`,
        `${board} update-questions ${req.id} --drop <n> — take each question you answered off`,
        `${board} tag ${req.id} <n> user — for the ones only the user can settle, worded as they stand`,
        `write what you decided on the card, one line each — a call the user could reasonably refuse goes under "## Worth noting", the rest under "## Decided by the agent"`,
      )
      next.push(
        req.andImplement
          ? `${self} implement ${req.id} --print — carry straight on, but only if nothing real is left for the user`
          : `${self} implement ${req.id} --print — once every question is settled`,
      )
      break
    }
    case 'edit': {
      facts.push(
        ...field('contents', [
          'the whole card, printed so you do not have to open it:',
          ...card!.text.trimEnd().split('\n').map((line) => `  ${line}`),
        ]),
      )
      facts.push(
        ...field('memory', [
          'open only when the request needs planning context:',
          ...memoryFiles(card!.meta.modules, 'decisions.md').map((file) => `  ${file}`),
          ...memoryFiles(card!.meta.modules, 'redesign.md').map((file) => `  ${file}`),
        ]),
      )
      close.push(
        `${board} update ${req.id} [--title|--priority|--roi|--release|--modules|--track|--blocked-by|--related] — the fields are the command's, never hand-written`,
        'the body is yours to write — the human half (the opening paragraph, ## Worth noting), the <!-- agent --> marker, then the agent half',
      )
      next.push(refineNext(req.id!, 'the follow-up the board would have started'))
      break
    }
    case 'create':
    case 'propose':
    case 'plan-release': {
      facts.push(...field('tracks', trackNames().join(', ') || '(none)'))
      facts.push(...field('modules', (moduleNames() ?? []).join(', ') || `(none — ${rel(MODULES_MD)})`))
      if (req.action === 'plan-release') {
        const entry = readReleaseEntries().find((e) => e.id === req.release)
        facts.push(
          ...field('release', entry ? `${entry.id} — ${entry.goal || '(no goal on its line)'}` : `${req.release} — not on the release list`),
        )
      } else {
        const releases = readReleaseEntries().map((e) => e.id)
        facts.push(...field('releases', releases.join(', ') || '(none open)'))
      }
      if (req.action === 'propose') facts.push(...field('goal', rel(GOAL)), ...field('memory', rel(MEMORY)))
      close.push(
        `${board} create --title ".." --track <track>${req.release ? ` --release ${req.release}` : ''} — one call per card; it takes the id, writes the fields and indexes it`,
        'then write only the body: the human half (the opening paragraph, ## Worth noting), the <!-- agent --> marker, then the agent half — ## Scope, ## Todo',
      )
      next.push(refineNext('<id>', 'for each new card'))
      break
    }
    case 'archive': {
      facts.push(...stepsCount(card!))
      facts.push(...field('memory', memoryFiles(card!.meta.modules, 'readme.md')))
      close.push(
        'write the shipped line first — one line for what a user can now see or do, nothing for an internal-only change',
        `${board} archive ${req.id} — it files the card, drops it from the index, and prints what still mentions it`,
      )
      break
    }
    // Setting the board up (#173). The checklist is the plan, so the facts are the boxes
    // left rather than a card's steps — and the flow's own last tick is what closes the
    // job, which is why nothing here names a command that finishes it.
    case 'setup': {
      const steps = readSetupChecklist()
      const left = steps?.filter((s) => !s.done) ?? []
      if (!steps) {
        facts.push(...field('checklist', `gone — ${rel(SETUP_CHECKLIST)} is not there, so this board is already set up`))
        close.push('nothing to close — there is no unfinished setup here, so do none of it')
        break
      }
      facts.push(...field('checklist', rel(SETUP_CHECKLIST)))
      facts.push(
        ...field('steps', [
          `${left.length} of ${steps.length} left:`,
          ...numbered(left.map((s) => `\`${s.name}\` (${s.owner}) — ${s.text}`)).map((s) => `  ${s}`),
        ]),
      )
      facts.push(...field('goal', rel(GOAL)))
      const questions = findSetupQuestionsCard()
      facts.push(
        ...field(
          'questions',
          questions
            ? `#${questions.id} — every call you can't settle is appended there, never asked`
            : '(no questions card — append nothing; settle what you can and say what you left)',
        ),
      )
      close.push(
        `${board} setup-done <step> — one tick per box, as each step finishes`,
        'the last tick deletes the checklist by itself — never delete it, and never edit it by hand',
      )
      next.push(refineNext('<id>', 'for each of the first cards, once the board is set up'))
      break
    }
    // One closed version's changelog (#232). The facts are the section the close wrote —
    // its goal and its shipped cards — because that section IS the source, and a run that
    // has it printed here needs no read to start.
    case 'changelog': {
      const version = req.release ?? ''
      const record = readNewestClose(version)
      const refusal = changelogRefusal(version)
      facts.push(...field('version', version || '(none named)'))
      if (refusal) {
        facts.push(...field('nothing', refusal))
        close.push('write nothing — say the line above and stop')
        break
      }
      facts.push(...field('summary', `${record!.file} — ${record!.heading}`))
      facts.push(...field('goal', record!.goal || '(the release had no goal)'))
      facts.push(
        ...field('shipped', [
          `${record!.shipped.length} card${record!.shipped.length === 1 ? '' : 's'}:`,
          ...record!.shipped.map((line) => `  ${line}`),
        ]),
      )
      if (record!.hasChangelog) {
        facts.push(...field('already', 'that section carries a changelog — writing again replaces it'))
      }
      close.push(
        `write the lines to a file, then ${board} release changelog ${quoteId(version)} --file <path> — it owns the placement, and running it again replaces the changelog rather than adding one`,
        'change nothing else — not a card, not the release list, not the code',
      )
      break
    }
    case 'reject': {
      facts.push(...field('reason', req.reason ?? '(none given)'))
      facts.push(...field('memory', memoryFiles(card!.meta.modules, 'rejected.md')))
      close.push(
        'write the rejection note first — the idea and why we said no',
        `${board} reject ${req.id} — this deletes the card; the receipt prints it out one last time`,
      )
      break
    }
  }

  return { lead: leadLine(req, program), facts, guides: GUIDES_FOR[req.action], close, next }
}

// What the flow opens with: the action, what it is on, and — plainly — that nothing started.
function leadLine(req: AgentRequest, program: string): string {
  const what = req.id !== undefined ? `#${req.id}` : req.release ? `"${req.release}"` : ''
  return `${req.action}${what ? ` ${what}` : ''} — printed, not started. Do it here, in this session (${program}).`
}

// ---- printing it -----------------------------------------------------------

/** Print the flow for one action and start nothing. The result is the same flow as data, so
 *  a caller reading `--json` gets what the terminal was shown. */
export function printFlow(req: AgentRequest, program = 'akb'): MoveResult {
  const flow = buildFlow(req, program)
  // The ask WITHOUT this board's own rule for the action (#306). A printed flow gets the
  // same rule a started run does, but at the very end — see below.
  const prompt = buildAsk(req)
  const rule = ruleFor(req, frozenRules(req))
  const sections: Section[] = [
    { head: 'the ask — the same words a run would have been given:', lines: [prompt] },
  ]
  if (flow.facts.length) sections.push({ head: 'this board:', lines: flow.facts })
  sections.push({
    head: 'closing it — no run is watching this one finish, so the bookkeeping is yours:',
    lines: numbered(flow.close),
  })
  // Named, not left to a guess: a job that hands over part-way is where an agent working
  // without a run to follow it most often stops.
  if (flow.next.length) sections.push({ head: 'handing over — the action to reach for, and when:', lines: flow.next })

  say(flow.lead)
  // The flows below are the shipped text and spell the command `akb` throughout. On a
  // machine without one, that is a page of lines the reader can't run — so the translation
  // is given once, before any of them, rather than rewriting text this command didn't write.
  if (program !== 'akb') {
    say('')
    say(`there is no \`akb\` on this machine — every \`akb\` below, in the flows too, is \`${program}\` here.`)
  }
  // The setup gate, when it is up. Not a refusal: setup's own last step is to write the
  // first cards, and refusing would block the one flow that has to run while the checklist
  // is still there. Nor is it said to the setup job itself, which is the very job it asks
  // for.
  if (req.action !== 'setup' && fs.existsSync(SETUP_CHECKLIST)) {
    say('')
    say(`this board is not set up yet — ${rel(SETUP_CHECKLIST)} is still there.`)
    say(`finish it first: ${setupInstruction()}`)
  }
  for (const section of sections) {
    say('')
    say(section.head)
    say('')
    // A line that carries its own block — the ask's spec-agent roster — is indented all
    // the way through, or the block falls out of the section it belongs to.
    for (const line of section.lines) say(indent(line))
  }
  // The settings, for the jobs that are told to read them. Printed before the flows, because
  // the flows are what send the reader here.
  const config = CONFIG_FOR.has(req.action) ? configText() : null
  if (config) {
    say('')
    say(`this project's settings — ${rel(CONFIG)}, printed so you don't have to open it:`)
    say('')
    say(config)
  }
  // Last, and unindented: the flows themselves, in full. They are markdown and they are
  // long, so they go after the short board-specific part rather than burying it — and they
  // are printed rather than named, because a pointer to a second command is a step that
  // gets skipped, and the job is then done from memory instead of from the flow.
  const guides = flow.guides.map(findGuide).filter((g): g is NonNullable<typeof g> => g !== null)
  if (guides.length) {
    say('')
    say(`the flows this is done by — each one is also \`${program} guide <topic>\`:`)
    for (const guide of guides) {
      say('')
      say(`——— ${program} guide ${guide.name} ———`)
      say('')
      say(guide.text.trimEnd())
    }
  }
  // Last of all: this board's own rule for the action, in the user's words (#306). A
  // started run is given one block of words and reads the rule wherever it sits; a
  // printed flow is several sections and pages of guides, so a rule left up in the ask
  // would be read before everything that buries it. Here the reader ends on it.
  if (rule) {
    say('')
    say(
      `this board's own rule for \`${flowByAction(req.action)?.command}\` — the user's words, ` +
        `added to the end of every ${req.action} run, and yours to follow here too:`,
    )
    say('')
    say(rule)
  }
  return {
    mode: 'print',
    action: req.action,
    cardId: req.id ?? null,
    prompt,
    guides: flow.guides,
    close: flow.close,
    next: flow.next,
    ...(rule ? { rule } : {}),
  }
}
