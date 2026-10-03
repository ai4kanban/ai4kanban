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
// card's stage back, starting the refines that follow. Nothing is
// watching an agent that followed a printed flow, so every one of these ends by naming the
// command that closes the job, and the action it hands over to when it hands over.

import fs from 'node:fs'
import path from 'node:path'

import { idPrefix, locate, locateArchived } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { say } from '../io'
import { findGuide } from '../guide'
import { findSpecAgent } from '../agents'
import { specAgentCatalog } from '../agents/catalog'
import { parseStamp } from '../cadence'
import { PLANNER, agentMemoryDir, agentMemoryFile, memoryFile, PROPOSER, PROPOSER_MISSED, proposerMissedFile } from '../memory'
import { die, rel, AGENT_MEMORY, ARCHIVE, CONFIG, BOARD_FLAG, KANBAN, MEMORY, MODULES_MD, PROJECT_MD, REPO_ROOT, SETUP_CHECKLIST, TODO, TRIAGE } from '../paths'
import { workflowRefusal } from './start'
import { scheduledMembers, workflows } from './workflows'
import { changelogRefusal, quoteId, readNewestClose, readReleaseEntries } from '../releases'
import { findSetupQuestionsCard, readSetupChecklist } from '../setup'
import type { Meta, MoveResult } from '../types'
import { moduleNames } from '../validate'
import { candidateFileStats, candidateOf, candidatePatch, candidateStat } from './candidate'
import { changedPaths, conflictedPaths, worktreeDir } from './worktree'
import { boardCommandFor } from './command'
import { activeDelivery, deliveryFor, withWorkflow } from './deliveries'
import { field, metaLine, numbered } from './facts'
import { reviewBatch, type ChatToReview } from './memory-review'
import { dismissalReview } from './settings'
import { dismissalsToReview, dismissedMemoryPath, withdrawnSources } from './dismissal-review'
import { translating } from './language'
import { buildAsk, frozenRules, leadBlock, reflectedCards, settingsBlock } from './prompts'
import { ruleFor, ruleOwner, ruleOwnerSays } from './rules'
import { openOf } from '../view/rules'
import { setupInstruction } from './resolve'
import { isRetired, type AgentAction, type AgentRequest, type DeliveryRecord, type StartableAction } from './types'

// The run id an agent works under. It lives in agent/env.ts, which imports nothing, so
// the delivery lock can ask the same question without pulling this module in behind it.
export { insideRun, runEnv, RUN_ENV } from './env'

// How many of a card's remaining steps are printed before the rest are counted instead. A
// long card's whole plan is in the file the flow names; the point here is to show what is
// left, not to copy the card.
const MAX_STEPS = 12

// Small candidates arrive inline. Large ones get a complete per-file summary without
// spending the run's context on a patch it can open selectively.
const MAX_DIFF = 40_000

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
}

function missedLine(): string {
  return fs.existsSync(agentMemoryFile(PROPOSER, PROPOSER_MISSED)) ? proposerMissedFile() : `${proposerMissedFile()} — none yet`
}

// Where one flow reads its card. Everything works a card still on the board; a reflection
// works one that has just left it (#534), which `locate` no longer finds.
type CardHome = 'board' | 'archive'

function readCard(id: number, home: CardHome = 'board'): CardFacts {
  const found = home === 'archive' ? locateArchived(id) : locate(id)
  if (!found) {
    die(
      home === 'archive'
        ? `no card #${id} in ${rel(ARCHIVE)}. A reflection reads the card the archive holds.`
        : `no card #${id} on this board. \`akb raw list\` says what is open.`,
      { kind: 'card-not-found', id },
    )
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
    die(`${rel(file)} has no frontmatter — run \`akb raw migrate\` before working on it.`, {
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

// Where a note goes — "Who owns a memory file" in `akb guide board`, read only. `readme.md` is
// one file with a `## <module>` topic per module; a planner file has a copy per module
// (#1484), listed whether or not it exists yet. It never scaffolds, because printing a flow
// must not write to the board.
function memoryLines(modules: string[], name: string): string[] {
  const file = rel(memoryFile(name))
  if (name === 'readme.md') return modules.length ? [`${file} — under \`## ${modules.join('\`, \`## ')}\``] : [file]
  const own = modules.filter((m) => memoryFile(name, m) !== memoryFile(name))
  if (!own.length) return [file]
  return [...own.map((m) => `${rel(memoryFile(name, m))} — the card's module \`${m}\``), `${file} — what spans modules`]
}

// What a reflection must not propose again (#1479): the global rejections, plus the triage
// preferences and the card's own modules' rejections and preferences once they exist.
function rejectedLines(modules: string[]): string[] {
  const extra = [
    ...modules.flatMap((m) => [memoryFile('rejected.md', m), memoryFile('dismissed.md', m)]),
    agentMemoryFile(PLANNER, 'dismissed.md'),
  ]
  return [...new Set([agentMemoryFile(PLANNER, 'rejected.md'), ...extra.filter((file) => fs.existsSync(file))])].map(rel)
}

// The scheduled agents switched on, whose own work a reflection leaves to them (#1494).
function scheduledLines(): string[] {
  const on = new Set(workflows().flatMap((flow) => scheduledMembers(flow).filter((h) => !h.off).map((h) => h.agent)))
  return specAgentCatalog().agents.filter((a) => on.has(a.name)).map((a) => `${a.name} — ${a.description}`)
}

// The jobs `akb guide board` tells to read the project's settings before they start:
// adding and refining. For those it is a certain read, and a certain read costs less
// printed here than fetched in a round of its own.
const CONFIG_FOR = new Set<AgentAction>(['create'])

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
function approvedField(delivery: DeliveryRecord | undefined): string[] {
  if (!delivery) return []
  const approved = delivery.approved.trim()
  // A build with no card was given a sentence, not a file (#428): there is nothing it could
  // have moved on from, so the warning that belongs to a card is left off.
  const lead =
    delivery.cardId === null
      ? ['build exactly this — it is the whole of what was asked for, and there is no card:']
      : [
          'build THIS, not the card file as it reads now — it is the card as it was approved when',
          'the delivery started, and the file may have moved on since:',
        ]
  return [
    ...field('delivery', `${delivery.deliveryId} — you are working inside it`),
    ...field(
      'approved',
      approved
        ? [...lead, '', ...approved.split('\n')]
        : delivery.cardId === null
          ? 'nothing was captured when this delivery started — there is nothing to build'
          : 'nothing was captured when this delivery started — build the card as it reads',
    ),
  ]
}

// The code a delivery has built so far. A small patch is printed in full; a large one gets
// every changed file and its line counts so the run can open only what it needs.
function candidateField(delivery: DeliveryRecord | undefined): string[] {
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
  const patch = candidatePatch(candidate)
  const command =
    delivery.worktree && delivery.branch
      ? `git diff ${delivery.base.slice(0, 12)} ${delivery.branch}`
      : `git diff ${delivery.base.slice(0, 12)}`
  const shown = files?.length ? ['changed files:', ...files.map((file) => `  ${file}`)] : ['no file changed']
  let diff: string[] = []
  if (patch === null) diff = ['', 'the diff could not be read']
  else if (patch.length > MAX_DIFF) {
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

// The checkout this job works in, and how it reaches the board from there. It is only ever
// said when the two are not the same folder: a delivery with a worktree of its own writes
// code there and the board's own files in the project, and a relative `node cli/bin/…`
// would run the worktree's copy of a command the delivery may be halfway through
// rewriting.
function workspaceField(delivery: DeliveryRecord | undefined): string[] {
  // A delivery of a workflow whose output is files (#874), whatever the workflow says now.
  if (delivery?.commitMode === 'files') {
    return field('workspace', [
      'Advanced > Use a Git worktree: disabled for this delivery.',
      `work in ${REPO_ROOT}. Keep this delivery's settings even if the workflow changes during the run.`,
    ])
  }
  if (!delivery?.worktree) return []
  return field('workspace', [
    `write code in ${delivery.worktree} — this delivery's own worktree, on branch ${delivery.branch}.`,
    path.resolve(process.cwd()).startsWith(worktreeDir(delivery.worktree))
      ? `it is your working folder already; the board's own files are NOT in it and never go on that branch.`
      : `cd into it first — you are in the project checkout, and code written here is not part of this build. The board's own files are NOT in it and never go on that branch.`,
    `every board command names the project's own copy: \`${boardCommandFor()} <command>\`.`,
    `${rel(REPO_ROOT)} is the project — the card, the memory files and the docs are changed there, not here.`,
  ])
}

// The `update` flags a card takes.
const EDITABLE_FIELDS = '--title|--priority|--roi|--release|--modules|--blocked-by|--related'

// What to do with the body a card was created with.
const bodyScaffoldClose = (lead = 'fill the existing'): string[] =>
  [`${lead} body scaffold; do not rename or translate its section titles, and leave empty scaffold sections in place`]

// The conflict a landing's rebase stopped on: the files, the branch it clashed with, and
// the cards on the other side — everything the run needs to see both intentions rather
// than only the markers in front of it.
function conflictField(delivery: DeliveryRecord | undefined): string[] {
  if (!delivery?.worktree) return field('conflict', 'no delivery with a worktree is landing right now')
  const files = conflictedPaths(worktreeDir(delivery.worktree))
  const overlap = delivery.landing?.overlap ?? []
  return field('conflict', [
    ...(delivery.landing?.why ? [`landing: ${delivery.landing.why}`] : []),
    files.length
      ? `${files.length} file${files.length === 1 ? '' : 's'} to resolve in ${delivery.worktree}:`
      : `the rebase onto ${delivery.targetBranch} stopped, but no file is conflicted right now — check \`git status\` there`,
    ...files.map((f) => `  ${f}`),
    `the other side is ${delivery.targetBranch} as it stands now; \`git log ${delivery.base?.slice(0, 12) ?? delivery.targetBranch}..${delivery.targetBranch}\` is what arrived while this was being built.`,
    ...(overlap.length
      ? [`${overlap.map((c) => `#${c}`).join(', ')} ${overlap.length === 1 ? 'is' : 'are'} being built over the same files — read ${overlap.length === 1 ? 'that card' : 'those cards'} before you decide what to keep.`]
      : []),
  ])
}

// What a delivery already building this card is judged against, said to the pass that is
// about to rewrite that card (#637).
//
// Applying answers is the one thing that moves a card under a build, so this pass is the one
// thing that can say whether the build is still the right build: it read the question, it
// read what it wrote, and nobody downstream has either. The board used to work it out by
// comparing text, which called a tidied sentence a changed plan and never matched a card
// written from a plan at all (#613).
function answeringField(delivery: DeliveryRecord, self: string): string[] {
  const approved = delivery.approved.trim()
  const say = (flag: string) => `  ${self} delivery answered ${delivery.deliveryId} ${flag}`
  return [
    ...field('delivery', [
      `${delivery.deliveryId} is already building this card, from the copy below — frozen when it started.`,
      `once your answers are on the card, say what they did to it:`,
      `${say('--unchanged "<why>"')} — it carries on`,
      `${say('--changed "<why>"')} — the board ends it and builds the card as it then reads`,
      `judge the MEANING, not the words. Confirming an option that is already built, writing down a decision`,
      `the card already carries and tidying prose are all --unchanged. Adding, dropping or changing a`,
      `requirement is --changed — and so is confirming an implementation that contradicts the copy below,`,
      `however finished it is.`,
      `say nothing and the board carries on as --unchanged.`,
    ]),
    ...field(
      'approved',
      approved
        ? [`what ${delivery.deliveryId} is building:`, '', ...approved.split('\n')]
        : 'nothing was captured when this delivery started',
    ),
  ]
}

// The closing step a pass that applies answers owes the build under it (#637): the
// conclusion, written down before the questions go, because dropping the last one is what
// puts the board back in motion.
const answeredClose = (delivery: DeliveryRecord, self: string): string =>
  `${self} delivery answered ${delivery.deliveryId} --changed|--unchanged "<why>" — before you drop the questions; ` +
  `dropping the last one with nothing said carries the build on as --unchanged`

// The card's post-implementation notes as they read right now — NOT part of the approved
// copy, and the one place the user records an exception they have approved for this exact
// candidate. A build that never reads them reopens what has already been settled.
function notesLines(card: CardFacts): string[] {
  const lines: string[] = []
  let inside = false
  for (const line of card.text.split('\n')) {
    if (/^##(?!#)\s/.test(line)) {
      inside = /^##\s+Worth noting after implementation\s*$/i.test(line)
      continue
    }
    if (inside && line.trim()) lines.push(line)
  }
  return lines
}

function notesField(card: CardFacts): string[] {
  const lines = notesLines(card)
  return field(
    'notes',
    lines.length
      ? ['## Worth noting after implementation, as the card reads now:', ...lines.map((l) => `  ${l}`)]
      : 'the card has no ## Worth noting after implementation yet',
  )
}

// The open questions, numbered as the board numbers them — the numbers are what
// `update-questions` and `tag` take, so a flow that lists them differently is a flow that
// gets the wrong question answered. A skipped one keeps its number and says so (#831).
function questionsField(meta: Meta): string[] {
  const open = openOf(meta.questions).length
  if (!meta.questions.length) return field('questions', 'none open')
  const lines = meta.questions.map(
    (q, i) =>
      `${i + 1}. ${q.skipped ? '(skipped by the user — leave it) ' : ''}${q.text}` +
      `${q.options?.length ? ` (${q.options.length} options)` : ''}`,
  )
  return field('questions', [`${open} open:`, ...lines.map((s) => `  ${s}`)])
}

// What a run that wrote code has to leave behind for whatever reads it next. In a worktree
// the board commits the whole change onto the delivery's branch as the run closes — so the
// one thing asked of the run is to leave nothing of the board's own in there, which
// is what a commit would be refused for. In manual commit mode nothing is committed at all:
// the code stays in the user's checkout and the commit is theirs. What comes next is the
// landing itself.
function committingClose(delivery: DeliveryRecord | undefined): string[] {
  if (!delivery) return []
  if (delivery.commitMode === 'files') {
    return [
      'record each output file on the card by its path — a ticked `## Todo` line naming it in backticks; a missing record or file means not delivered',
      'do not create a branch or worktree, commit, or merge',
      'change no tracked file outside the board. New changes there stop the delivery; never revert them automatically',
    ]
  }
  if (delivery.worktree) {
    return [
      `leave your work in ${delivery.worktree} — the board commits all of it onto ${delivery.branch} when this run ends, and the landing takes that branch`,
      `never write the board's own files into the worktree: a commit that reaches one is refused, and the delivery stops`,
    ]
  }
  return [
    `leave your work uncommitted — this build has no branch of its own, so the user commits it themselves once this run ends`,
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

/** Guides supplied upfront, general rules before the action's own flow. */
const GUIDES_FOR: Record<StartableAction, string[]> = {
  implement: ['board', 'implement', 'document-feature'],
  conflict: ['conflict'],
  // The board starts a hook itself (#1328); it has no page and nothing prints it.
  hook: [],
  // Nor a scheduled agent's pass (#1401), nor a sub-run (#1421).
  scheduled: [],
  sub: [],
  // One planning session (#1203): the page that plans, and the two it writes the card by.
  clarify: ['refine', 'writing', 'update-questions'],
  resolve: ['board', 'writing', 'resolve', 'update-questions'],
  edit: ['writing', 'revise', 'update-questions'],
  create: ['board', 'evaluate-task', 'add-task'],
  'plan-release': ['board', 'releases', 'plan-release', 'evaluate-task', 'add-task'],
  // A changelog run gets its own flow and NOT `board`: it writes no card, so the card
  // format, the memory set and the tracks are a page of rules about work it cannot do.
  changelog: ['changelog'],
  archive: ['board'],
  reject: ['board', 'reject'],
  setup: ['board', 'setup', 'add-task'],
  // A prune gets the memory set's own definition and the rules for squeezing it, and NOT
  // the rest of `board`: it rewrites memory files and writes no card at all.
  'prune-memory': ['board', 'prune-memory'],
  // A review gets the memory set's own definition and "What earns a note" — the bar it
  // judges by — plus its own flow, and NOT the rest of `board`: it writes memory files and
  // no card at all.
  'review-memory': ['board', 'review-memory'],
  'review-dismissals': ['review-dismissals'],
  'describe-project': ['describe-project'],
  // A reflection gets its own flow and `evaluate-task`, the bar an idea is held to before
  // it is worth anyone's time. NOT `board`: what it writes is an inbox item, and the card
  // format and the memory set are a page about work it may not do.
  reflect: ['reflect', 'evaluate-task'],
  // A sort is the board's own loop (#1263): no agent reads a guide for it.
  triage: [],
  // Specialist instructions apply to both printed flows and separate runs.
  spec: ['spec-agent'],
}

// One conversation as the memory review is handed it (#1322): the card it belongs to on the
// block itself, then its modules, its card's agents with their memory files, and the
// trimmed transcript. Nothing of a conversation is printed outside its block.
function conversationBlock(chat: ChatToReview): string[] {
  const card = `#${chat.card.id} ${chat.card.title}`.trim().replace(/"/g, "'")
  return [
    `<conversation card="${card}" kind="card chat">`,
    `modules: ${chat.modules.length ? chat.modules.join(', ') : '(none)'}`,
    ...(chat.agents.length
      ? ['agents:', ...chat.agents.map((a) => `  \`${a.name}\` — ${a.dir}/: ${a.files.join(', ') || 'no files yet'}`)]
      : ['agents: (none)']),
    'transcript:',
    chat.transcript,
    '</conversation>',
  ]
}

// A retired action is only ever read back off an old record (#438, #1203) — nothing starts
// one, and there is no flow left to print for it.
const guidesFor = (req: AgentRequest): string[] => (isRetired(req.action) ? [] : GUIDES_FOR[req.action as StartableAction])

/** Build the flow for one action. A `board` command spelled out here is spelled with the
 *  program the caller was typed as, so what is printed can be pasted back. */
function buildFlow(req: AgentRequest, program: string): Flow {
  // How this job spells the board's command. A delivery working in its own worktree names
  // the project's copy outright (#303) — a relative path there would run the worktree's own
  // half-rewritten copy, and no `--dir` would leave the board to be guessed at.
  const delivery = deliveryFor(req)
  const self = delivery?.worktree ? boardCommandFor(req.id) : `${program}${BOARD_FLAG}`
  const raw = `${self} raw`
  const facts: string[] = []
  const close: string[] = []
  const next: string[] = []
  const card = req.id !== undefined ? readCard(req.id, req.action === 'reflect' ? 'archive' : 'board') : null

  // The refine a job hands over to. A run starts each follow-up refine as its own run,
  // never inside the job that wrote the card — so the handover says fresh run, or an
  // agent reading the flow refines right here, in a context already full of the writing.
  const refineNext = (target: number | '<id>', when: string) =>
    `${self} card refine ${target} --print — ${when}; in a fresh run, not this one — the board gives each refine its own clean context, and so should you`

  // Every card action opens the same way: where the card is, and what it says about itself.
  if (card) {
    facts.push(...field('card', card.file), ...field('meta', metaLine(card.meta)))
  }

  switch (req.action) {
    case 'implement': {
      facts.push(...approvedField(delivery))
      facts.push(...workspaceField(delivery))
      // A build with no card (#428): the typed sentence is the whole requirement, so there
      // is no plan to work through, nothing on the board to tick and no memory line to
      // write — the flow says so rather than leaving the reader to look for a card.
      if (!card) {
        close.push(
          ...committingClose(delivery),
          'build exactly the sentence above and nothing more — no card was written, so nothing else records what this was for',
          'write no card, tick nothing, raise no question, and archive nothing: this build leaves a delivery and a commit, and that is all',
        )
        break
      }
      // The decisions an earlier delivery on this card already settled (#637). They sit
      // outside the approved copy, so a delivery reopened over the top of one would drop them
      // on the floor without this. Most cards carry none, and say nothing here.
      const settled = notesLines(card).length > 0
      if (settled) facts.push(...notesField(card))
      facts.push(...stepsField(card))
      if (card.meta.questions.length) facts.push(...questionsField(card.meta))
      facts.push(...field('memory', memoryLines(card.meta.modules, 'readme.md')))
      // Inside a delivery the build is not the end of the job: the board lands it, and
      // archives the card once it has landed (#304, #307). Outside a delivery — a card built
      // by hand from a printed flow — the build closes the card exactly as it always has.
      close.push(
        ...committingClose(delivery),
        ...(settled
          ? ['honour the notes above as requirements — they are decisions already settled on this card, and nothing here reopens them']
          : []),
        'tick each box in ## Todo as you finish it — they are the record of what was built',
        `write the shipped line in the memory file above — "Finish a task" in \`akb guide board\``,
        delivery?.commitMode === 'files'
          ? 'leave the card on the board. The board archives it after the output files pass the delivery checks'
          : delivery
            ? `leave the card on the board — the board archives the card itself once the delivery has landed`
            : `${raw} archive ${req.id} — once every box is ticked and the card's goal is met`,
      )
      if (openOf(card.meta.questions).length) {
        next.push(
          `${self} card resolve ${req.id} --print — first: the card has open questions, and building on a guess is what they are there to stop`,
        )
      }
      break
    }
    // Resolving the conflict a landing's rebase stopped on (#304). It reads this card's
    // approved outcome and the newer target implementation it has to fit.
    case 'conflict': {
      facts.push(...approvedField(delivery))
      facts.push(...workspaceField(delivery))
      facts.push(...conflictField(delivery))
      facts.push(...candidateField(delivery))
      close.push(
        'treat the target branch as the current implementation; preserve it and replay only what the approved copy above requires',
        'repair Git state failures while preserving the delivery; `git add` each file you resolved, then stop: the board runs `git rebase --continue` and lands the composed result',
        'change nothing the conflict does not name, change nothing on the board, and create no cards or follow-up tasks',
      )
      break
    }
    case 'clarify': {
      facts.push(...stepsField(card!), ...questionsField(card!.meta))
      close.push(
        'settle and write the card as `akb guide refine` says; leave only `[user]` questions',
        `${raw} update ${req.id} --status ready — once the card validates`,
      )
      break
    }
    case 'resolve': {
      facts.push(...questionsField(card!.meta))
      // The build these answers land on top of, where there is one (#637).
      const building = activeDelivery(req.id!)
      if (building) {
        facts.push(...answeringField(building, self))
        facts.push(...notesField(card!))
      }
      facts.push(...field('memory', memoryLines(card!.meta.modules, 'decisions.md')))
      if (building) close.push(answeredClose(building, self))
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
          ...memoryLines(card!.meta.modules, 'decisions.md').map((file) => `  ${file}`),
          ...memoryLines(card!.meta.modules, 'redesign.md').map((file) => `  ${file}`),
        ]),
      )
      close.push(
        `${raw} update ${req.id} [${EDITABLE_FIELDS}] — the fields are the command's, never hand-written`,
        ...bodyScaffoldClose(),
      )
      break
    }
    case 'create':
    case 'plan-release': {
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
      close.push(
        // `--slug` only on a board that isn't English (#337): a non-English title slugifies
        // to nothing, and every card would be named `<id>-task.md`.
        `${raw} create --title ".."${translating() ? ' --slug <short-english-slug>' : ''}${req.release ? ` --release ${req.release}` : ''} — one call per card; it takes the id, writes the fields and indexes it`,
        ...bodyScaffoldClose('then fill only the existing'),
      )
      break
    }
    case 'archive': {
      facts.push(...stepsCount(card!))
      facts.push(...field('memory', memoryLines(card!.meta.modules, 'readme.md')))
      close.push(
        'write the shipped line first — one line for what a user can now see or do, nothing for an internal-only change',
        `${raw} archive ${req.id} — it files the card, drops it from the index, and prints what still mentions it`,
      )
      break
    }
    // Setting the board up (#173). The checklist is the plan, so the facts are the boxes
    // left rather than a card's steps — and the flow's own last tick is what closes the
    // job, which is why nothing here names a command that finishes it.
    case 'spec': {
      next.push('Return to the workflow that requested this spec and continue it in this session. No background follow-up is scheduled.')
      break
    }
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
        `${raw} setup-done <step> — one tick per box, as each step finishes`,
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
        `write the lines to a file, then ${raw} release changelog ${quoteId(version)} --file <path> — it owns the placement, and running it again replaces the changelog rather than adding one`,
        'change nothing else — not a card, not the release list, not the code',
      )
      break
    }
    // Squeezing the memory back down (#514). The facts are the files, because the files
    // ARE the job: there is no card to read and nothing on the board to tick afterwards.
    case 'prune-memory': {
      // Folders, not files: a prune covers everything in each of them, and what that is is
      // `akb guide board`'s to define rather than this flow's to list.
      facts.push(...field('memory', [`${rel(MEMORY)} — the board's own record`]))
      facts.push(...field('agents', `${rel(AGENT_MEMORY)}/<agent>/ — one folder per agent that keeps memory, ${rel(agentMemoryDir(PLANNER))}/ among them`))
      close.push(
        'rewrite the files above in place — that is the whole job',
        'raise nothing for anyone: there is no card to question, so what you cannot settle stays in the file',
        'change nothing else — not a card, not the project description, not the code',
      )
      break
    }
    // Reading back over the conversations (#748, #1322). The facts are the conversations
    // themselves, each in a block of its own with everything the review needs of it, so the
    // run opens no transcript and looks up no card.
    case 'review-memory': {
      const { chats, remaining } = reviewBatch()
      facts.push(
        ...field(
          'chats',
          chats.length === 0
            ? '(none) — no archived card has a conversation waiting, so there is nothing to review'
            : `${chats.length} to review, each in its own <conversation> block below${remaining ? ' — more are waiting, and the next review takes them' : ''}`,
        ),
      )
      facts.push(
        ...field('memory', [
          `${rel(agentMemoryDir(PLANNER))}/<module>/ — decisions.md, rejected.md, redesign.md: where a planning note goes, the planner's own files for one spanning modules`,
          `${proposerMissedFile()} — a follow-up the user says the proposer missed`,
          `${rel(AGENT_MEMORY)}/<agent>/ — an agent's own files, which its AGENT.md names`,
        ]),
      )
      for (const chat of chats) facts.push('', ...conversationBlock(chat))
      close.push(
        'write the notes into the memory files named above — that is the whole job',
        'rewrite or delete a note an earlier review wrote that a conversation has since overturned, rather than adding a second one',
        'writing nothing at all is a complete result, and most conversations earn it',
        'change nothing else — not a card, not the project description, not the code',
      )
      if (chats.length) {
        close.push(
          'last, mark these conversations reviewed with the command given here, exactly as written' +
            `\n   ${raw} chats-reviewed ${chats.map((c) => c.key).join(' ')}`,
        )
      }
      break
    }
    // The dismissal review (#929): the two lists are the job, decided before any run starts.
    case 'review-dismissals': {
      const lastRun = dismissalReview().lastRun
      const dismissals = dismissalsToReview(parseStamp(lastRun)?.getTime() ?? 0)
      const withdrawn = withdrawnSources()
      facts.push(...field('window', lastRun ? `since the last review that passed, ${lastRun}` : 'every dismissal — none has been reviewed yet'))
      facts.push(
        ...field(
          'dismissals',
          dismissals.length === 0
            ? '(none)'
            : dismissals.flatMap((d) => [`  ${d.sourceId} — ${d.title || '(untitled)'}`, `    file: ${d.file}`, `    reason: ${d.reason}`]),
        ),
      )
      facts.push(...field('withdrawn', withdrawn.length === 0 ? '(none)' : withdrawn.join(', ')))
      facts.push(...field('memory', [dismissedMemoryPath(), `${rel(agentMemoryDir(PLANNER))}/<module>/dismissed.md — a module's own`]))
      facts.push(...field('modules', rel(MODULES_MD)))
      close.push(
        `write those dismissed.md files and nothing else — writing nothing is a complete result`,
        'raise nothing for anyone: there is no card to question',
      )
      break
    }
    // The project description (#1268): the file is the whole job, and the one thing it writes.
    case 'describe-project': {
      facts.push(...field('project', rel(PROJECT_MD)))
      close.push(`rewrite ${rel(PROJECT_MD)} and nothing else`, 'raise nothing for anyone: there is no card to question')
      break
    }
    // Reflecting on a card that has just completed (#534). The facts are what it was asked
    // from, what it shipped and the proposer's past misses (#1211), plus where a follow-up may
    // already be accounted for; the close is the one thing it may write.
    case 'reflect': {
      // The cards themselves, one `<card>` block each, are in the ask.
      const modules = [...new Set(reflectedCards(req).flatMap((id) => readCard(id, 'archive').meta.modules))]
      facts.push(...field('missed', missedLine()))
      facts.push(...field('rejected', rejectedLines(modules)))
      const scheduled = scheduledLines()
      if (scheduled.length) facts.push(...field('scheduled', scheduled))
      facts.push(...field('triage', `${rel(TRIAGE)}/ — what is already waiting to be triaged`))
      close.push(
        `${self} triage add --title ".." --slug <short-english-slug> --source "#<id>" --text ".." — one call per proposal, each naming the archived file of the card it traces to`,
        'propose nothing at all when nothing follows: that is a complete result, and most batches are it',
        'change nothing else — no card is created, edited or archived, and no memory file is written',
      )
      break
    }
    case 'reject': {
      facts.push(...field('reason', req.reason ?? '(none given)'))
      // A discard writes no memory at all (#601), so it is handed no memory file to write
      // into and nothing is judged — the one difference between the two is right here.
      // The reason travels in the command, already quoted: retyped by hand, a multi-line one drifts.
      const reason = req.reason?.trim() ? ` --reason ${shellWord(req.reason.trim())}` : ''
      if (req.discard === true) {
        close.push(
          `${raw} reject ${req.id} --discard${reason} — this files the card in the archive as rejected and writes no memory`,
        )
      } else {
        facts.push(...field('memory', memoryLines(card!.meta.modules, 'rejected.md')))
        close.push(
          'write the rejection note first when this rejection earns one — the idea and why we said no; a duplicate or a routine drop earns none, and writing nothing is a complete result',
          `${raw} reject ${req.id}${reason} — this files the card in the archive as rejected`,
        )
      }
      break
    }
  }

  return { lead: leadLine(req, program), facts, guides: guidesFor(req), close, next }
}

// One word a POSIX shell hands back unchanged, on one line: `'…'`, or `$'…'` when it holds a
// line break or another control character.
function shellWord(text: string): string {
  if (!/[\x00-\x1f\x7f]/.test(text)) return `'${text.replace(/'/g, `'\\''`)}'`
  const named: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t' }
  const escaped = text
    .replace(/[\\']/g, '\\$&')
    .replace(/[\x00-\x1f\x7f]/g, (c) => named[c] ?? `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
  return `$'${escaped}'`
}

// What the flow opens with: the action, what it is on, and — plainly — that nothing started.
function leadLine(req: AgentRequest, program: string): string {
  const what =
    req.id !== undefined
      ? `#${req.id}`
      : req.deliveryId
        ? `delivery ${req.deliveryId}`
        : req.release
          ? `"${req.release}"`
          : ''
  return `${req.action}${what ? ` ${what}` : ''} — printed, not started. Do it here, in this session (${program}).`
}

// ---- printing it -----------------------------------------------------------

/** Print the flow for one action and start nothing. The result is the same flow as data, so
 *  a caller reading `--json` gets what the terminal was shown. */
export function printFlow(rawReq: AgentRequest, program = 'akb'): MoveResult {
  // A card finishing in planning is archived, never built (#1057) — printed or not.
  const unbuilt = rawReq.action === 'implement' ? workflowRefusal(rawReq) : null
  if (unbuilt?.reason === 'planDelivered') die(unbuilt.error, { kind: 'plan-delivered' })
  const req = withWorkflow(rawReq)
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
    // A line that carries its own block — the ask's spec-agent catalog — is indented all
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
  const guides = flow.guides
    .map((name) => findGuide(name))
    .filter((g): g is NonNullable<typeof g> => g !== null)
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
  for (const block of [leadBlock(req), settingsBlock(req)].filter(Boolean)) {
    say('')
    say(block)
  }
  // Last of all: the rule of the agent this run is done by, in the user's words (#306,
  // #420). A started run is given one block of words and reads the rule wherever it sits; a
  // printed flow is several sections and pages of guides, so a rule left up in the ask
  // would be read before everything that buries it. Here the reader ends on it.
  const owner = ruleOwner(req)
  if (rule && owner) {
    say('')
    say(`this board's ${ruleOwnerSays(owner)} — the user's words, and yours to follow here too:`)
    say('')
    say(rule)
  }
  return {
    mode: 'print',
    action: req.action,
    cardId: req.id ?? null,
    ...(req.deliveryId ? { deliveryId: req.deliveryId } : {}),
    prompt,
    guides: flow.guides,
    close: flow.close,
    next: flow.next,
    ...(rule ? { rule } : {}),
  }
}
