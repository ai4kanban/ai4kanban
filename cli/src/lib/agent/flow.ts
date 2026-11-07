
import fs from 'node:fs'
import path from 'node:path'

import { locate, locateArchived } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { say } from '../io'
import { findGuide } from '../guide'
import { PLANNER, agentMemoryDir, memoryFile } from '../memory'
import { die, rel, AGENT_MEMORY, ARCHIVE, BOARD_FLAG, MEMORY, PROJECT_MD, REPO_ROOT } from '../paths'
import { workflowRefusal } from './start'
import type { Meta, MoveResult } from '../types'
import { boardCommandFor } from './command'
import { activeDelivery, deliveryFor, withWorkflow } from './deliveries'
import { field, metaLine, numbered } from './facts'
import { taskChatsToReview, type ChatToReview } from './memory-review'
import { dismissalsToReview, rejectionsToReview, withdrawnSources } from './dismissal-review'
import { buildAsk, frozenRules, landBlock, reflectedCards, settingsBlock, workflowRulesBlock } from './prompts'
import { ruleFor, ruleOwner, ruleOwnerSays } from './rules'
import { openOf } from '../view/rules'
import { cardStage, cardStages, workflowFor } from './workflows'
import { isRetired, type AgentRequest, type DeliveryRecord, type StartableAction } from './types'

// The run id an agent works under. It lives in agent/env.ts, which imports nothing, so
// the delivery lock can ask the same question without pulling this module in behind it.
export { insideRun, runEnv, RUN_ENV } from './env'

// How many of a card's remaining steps are printed before the rest are counted instead. A
// long card's whole plan is in the file the flow names; the point here is to show what is
// left, not to copy the card.
const MAX_STEPS = 12

// Small candidates arrive inline. Large ones get a complete per-file summary without
// spending the run's context on a patch it can open selectively.

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

// Where one flow reads its card. Everything works a card still on the board; a reflection
// works one that has just left it (#534), which `locate` no longer finds.
type CardHome = 'board' | 'archive'

function readCard(id: number, home: CardHome = 'board'): CardFacts {
  const pending = activeDelivery(id)?.completions?.some((c) => !c.finished)
  const found = home === 'archive' ? locateArchived(id) : locate(id) ?? (pending ? locateArchived(id) : null)
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

function memoryLines(modules: string[], name: string): string[] {
  const file = rel(memoryFile(name))
  if (name === 'readme.md') return modules.length ? [`${file} — under \`## ${modules.join('\`, \`## ')}\``] : [file]
  const own = modules.filter((m) => memoryFile(name, m) !== memoryFile(name))
  if (!own.length) return [file]
  return [...own.map((m) => `${rel(memoryFile(name, m))} — the card's module \`${m}\``), `${file} — what spans modules`]
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
function workspaceField(delivery: DeliveryRecord | undefined): string[] {
  return field('workspace', [
    `authorized project: ${REPO_ROOT}; board: ${boardCommandFor()}.`,
    ...(delivery ? [
      `delivery ${delivery.deliveryId}; target branch: ${delivery.targetBranch ?? 'inspect the project'}.`,
      `existing context: ${JSON.stringify({ worktree: delivery.worktree, branch: delivery.branch, base: delivery.base, landing: delivery.landing, completions: delivery.completions })}`,
      'Inspect existing files, commits, staged changes and unfinished Git operations before continuing. Use `git worktree list --porcelain` to find existing checkouts. Preserve completed work.',
    ] : []),
  ])
}

// The `update` flags a card takes.
const EDITABLE_FIELDS = '--title|--priority|--modules|--blocked-by|--related'

// What to do with the body a card was created with.
const bodyScaffoldClose = (lead = 'fill the existing'): string[] =>
  [`${lead} body scaffold; do not rename or translate its section titles, and leave empty scaffold sections in place`]

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

// The approval a card is on, when its previews make several (#2154).
function stageField(meta: Meta): string[] {
  const flow = workflowFor(meta.workflow)
  const stages = cardStages(meta, flow).length
  return stages > 1 ? field('stage', `${cardStage(meta, flow)} of ${stages}`) : []
}

// A stage before the last ends on the board's Approve, never on a question (#1790).
const stageClose = (meta: Meta): string[] => {
  const flow = workflowFor(meta.workflow)
  return cardStage(meta, flow) < cardStages(meta, flow).length
    ? ["end the stage with its previews; ask no question about approving it — the board's Approve moves the card on"]
    : []
}

function committingClose(delivery: DeliveryRecord | undefined): string[] {
  if (!delivery) return []
  return [
    'Keep board files at the board path and out of task commits.',
    ...(delivery.workflow?.needsArtifact ? ['Record each delivered file or folder in a new ticked `Output:` todo.'] : []),
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
  implement: ['board', 'archive', 'implement'],
  // Nor a scheduled agent's pass (#1401), nor a sub-run (#1421).
  scheduled: [],
  sub: [],
  // One planning session (#1203): the page that plans, and the two it writes the card by.
  clarify: ['refine', 'writing', 'update-questions'],
  resolve: ['writing', 'resolve', 'update-questions'],
  approve: ['board', 'writing', 'update-questions'],
  edit: ['writing', 'revise', 'update-questions'],
  archive: ['archive'],
  // A prune gets the memory set's own definition and the rules for squeezing it, and NOT
  // the rest of `board`: it rewrites memory files and writes no card at all.
  'prune-memory': ['board', 'prune-memory'],
  // A review gets the memory set's own definition and "What earns a note" — the bar it
  // judges by — plus its own flow, and NOT the rest of `board`: it writes memory files and
  // no card at all.
  'review-memory': ['board', 'review-memory'],
  'review-dismissals': ['review-rejections'],
  'describe-project': ['describe-project'],
  reflect: ['reflect'],
  // The prompt names `preview-agent`; the agent reads it if it has not already.
  spec: [],
}

// One card as the memory review is handed it (#1322, #165, #188): the card on the block itself,
// then its modules, its agents with their memory files, its summary, what it settled and the
// trimmed transcript. Nothing of a card is printed outside its block.
function conversationBlock(chat: ChatToReview): string[] {
  const card = `#${chat.card.id} ${chat.card.title}`.trim().replace(/"/g, "'")
  return [
    `<conversation card="${card}" kind="card">`,
    `modules: ${chat.modules.length ? chat.modules.join(', ') : '(none)'}`,
    ...(chat.agents.length
      ? ['agents:', ...chat.agents.map((a) => `  \`${a.name}\` — ${a.dir}/: ${a.files.join(', ') || 'no files yet'}`)]
      : ['agents: (none)']),
    ...(chat.summary ? ['summary:', chat.summary] : []),
    ...(chat.settled ? ['settled on the card:', chat.settled] : []),
    ...(chat.transcript ? ['transcript:', chat.transcript] : []),
    '</conversation>',
  ]
}

// A retired action is only ever read back off an old record (#438, #1203) — nothing starts
// one, and there is no flow left to print for it.
const guidesFor = (req: AgentRequest): string[] =>
  isRetired(req.action) ? [] : GUIDES_FOR[req.action as StartableAction]

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
      close.push(
        ...committingClose(delivery),
        ...(settled
          ? ['honour the notes above as requirements — they are decisions already settled on this card, and nothing here reopens them']
          : []),
        'tick each box in ## Todo as you finish it — they are the record of what was built',
        `write the shipped line in the memory file above — \`akb guide archive\``,
        delivery
          ? `${self} delivery complete ${delivery.deliveryId} — finish your step and follow its handoff; software steps in a git project supply --commit <full-sha> --branch <target>`
          : `${raw} archive ${req.id} — once every box is ticked and the card's goal is met`,
      )
      if (openOf(card.meta.questions).length) {
        next.push(
          `${self} card resolve ${req.id} --print — first: the card has open questions, and building on a guess is what they are there to stop`,
        )
      }
      break
    }
    case 'clarify': {
      facts.push(...stepsField(card!), ...questionsField(card!.meta), ...stageField(card!.meta))
      close.push(
        'settle and write the card as `akb guide refine` says',
        ...stageClose(card!.meta),
        `${raw} update ${req.id} --status ready — once the card validates`,
      )
      break
    }
    case 'resolve': {
      facts.push(...questionsField(card!.meta), ...stageField(card!.meta))
      // The build these answers land on top of, where there is one (#637).
      const building = activeDelivery(req.id!)
      if (building) {
        facts.push(...answeringField(building, self))
        facts.push(...notesField(card!))
      }
      if (building) close.push(answeredClose(building, self))
      close.push(...stageClose(card!.meta))
      break
    }
    case 'approve': {
      facts.push(...stageField(card!.meta))
      close.push(...stageClose(card!.meta), `${raw} update ${req.id} --status ready — once the card validates`)
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
    case 'archive': {
      facts.push(...stepsCount(card!))
      facts.push(...field('memory', memoryLines(card!.meta.modules, 'readme.md')))
      close.push(
        'write the shipped line first — one line for what a user can now see or do, nothing for an internal-only change',
        `${raw} archive ${req.id} — it files the card, drops it from the index, and prints what still mentions it`,
      )
      break
    }
    case 'spec': {
      next.push('Return to the workflow that requested this preview and continue it in this session. No background follow-up is scheduled.')
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
    // Reading back over a Runner's archived tasks (#748, #2065, #165). The facts are the cards'
    // settled sections and chats, each in a block of its own, so the run opens no file for them.
    case 'review-memory': {
      const chats = taskChatsToReview(req.tasks ?? [])
      facts.push(
        ...field(
          'cards',
          chats.length === 0
            ? '(none) — no archived card has anything waiting, so there is nothing to review'
            : `${chats.length} to review, each in its own <conversation> block below`,
        ),
      )
      facts.push(
        ...field('memory', [
          `${rel(agentMemoryDir(PLANNER))}/<module>/ — decisions.md, rejected.md, redesign.md: where a planning note goes, the planner's own files for one spanning modules`,
          `${rel(AGENT_MEMORY)}/<agent>/ — an agent's own files, which its AGENT.md names, and its redesign.md`,
        ]),
      )
      for (const chat of chats) facts.push('', ...conversationBlock(chat))
      close.push(
        'write the notes into the memory files named above — that is the whole job',
        'rewrite or delete a note an earlier review wrote that a conversation has since overturned, rather than adding a second one',
        'writing nothing at all is a complete result, and most conversations earn it',
        'change nothing else — not a card, not the project description, not the code',
      )
      break
    }
    // The rejection review (#929, #1497): the lists are the job, decided before any run starts.
    case 'review-dismissals': {
      const rejections = rejectionsToReview()
      const dismissals = dismissalsToReview()
      const withdrawn = withdrawnSources()
      facts.push(
        ...field(
          'rejections',
          rejections.length === 0
            ? '(none)'
            : rejections.flatMap((r) => [`  #${r.id} — ${r.title || '(untitled)'}`, `    file: ${r.file}`, `    reason: ${r.reason}`]),
        ),
      )
      facts.push(
        ...field(
          'dismissals',
          dismissals.length === 0
            ? '(none)'
            : dismissals.flatMap((d) => [`  ${d.sourceId} — ${d.title || '(untitled)'}`, `    file: ${d.file}`, `    reason: ${d.reason}`]),
        ),
      )
      facts.push(...field('withdrawn', withdrawn.length === 0 ? '(none)' : withdrawn.join(', ')))
      close.push(
        `write those rejected.md files and nothing else — writing nothing is a complete result`,
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
    // Reflecting on a card that has just completed (#534). The cards, and the scheduled agents
    // it leaves work to, are in the ask; the guide names the memory it reads (#1498).
    case 'reflect': {
      for (const id of reflectedCards(req)) readCard(id, 'archive')
      close.push(
        `${self} triage add --title ".." --slug <short-english-slug> --source "#<id>" --workflow <that card's workflow> --text ".." — one call per proposal, each naming the archived file of the card it traces to`,
        'propose nothing at all when nothing follows: that is a complete result, and most batches are it',
        'change nothing else — no card is created, edited or archived, and no memory file is written',
      )
      break
    }
  }

  return { lead: leadLine(req, program), facts, guides: guidesFor(req), close, next }
}

// One word a POSIX shell hands back unchanged, on one line: `'…'`, or `$'…'` when it holds a
// line break or another control character.

// What the flow opens with: the action, what it is on, and — plainly — that nothing started.
function leadLine(req: AgentRequest, program: string): string {
  const what =
    req.id !== undefined
      ? `#${req.id}`
      : req.deliveryId
        ? `delivery ${req.deliveryId}`
          : ''
  const action = req.action === 'spec' ? 'previews' : req.action
  return `${action}${what ? ` ${what}` : ''} — printed, not started. Do it here, in this session (${program}).`
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
  for (const section of sections) {
    say('')
    say(section.head)
    say('')
    // A line that carries its own block — the ask's spec-agent catalog — is indented all
    // the way through, or the block falls out of the section it belongs to.
    for (const line of section.lines) say(indent(line))
  }
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
  for (const block of [workflowRulesBlock(req), landBlock(req), settingsBlock(req)].filter(Boolean)) {
    say('')
    say(block)
  }
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
