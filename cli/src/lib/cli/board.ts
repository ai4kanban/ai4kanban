// The board's bookkeeping, declared once.
//
// Every move below says what it takes and what each option means, and that declaration IS
// the help: `akb raw help` is the summaries, `akb raw help <move>` the whole of one.
// Nothing is written twice, so a flag that is added is a flag the help already knows about.
//
// The two front doors — `akb raw <move>` and the `kanban.mjs` an installed skill folder
// runs — are the same tree. They differ only in how they are spelled in a message.

import { CADENCE_FORMS } from '../cadence'
import { CHANNEL_NAMES, CHANNEL_STATUSES } from '../channels'
import { insideRun } from '../agent/env'
import { recordCreatedCards } from '../agent/store'
import { board, moveTarget, openBoard, withLease, type MoveOutput, type OpResult } from '../board'
import { BOARD_MOVES, READ_ONLY_MOVES } from '../board/local'
import { BoardError, say, warn } from '../io'
import { KANBAN } from '../paths'
import { resolveBoard, sayIfOffline, useBoard } from '../board-cli'
import { SCHEDULED_ACTIONS } from '../schedule'
import { SOLUTIONS } from '../solution'
import { LEVELS, STATUSES } from '../validate'
import { QUESTION_TAGS } from '../view/rules'
import {
  cardId,
  collectList,
  ctxOf,
  newCommand,
  oneOf,
  ordered,
  runAction,
  withShared,
  type Command,
  type Typed,
} from './shared'

/** What the door hands in — see `runBoard`. */
export interface BoardCliOptions {
  program: string
  cwd: string
  installHint: string
  version: string | null
  /** The move's own fields, handed over as it finishes. `--json` already carries them; this
   *  is for a caller that ran the move in-process and wants the value rather than the text. */
  onAnswer?: (data: Record<string, unknown>) => void
}

// The one thing every move does before its own work: find the board, open it, then either
// read it or take a lease and write it. Lifted here so a move's own declaration is only
// what that move takes.
async function dispatch(
  move: string,
  cmd: Command,
  args: string[],
  opts: Record<string, unknown>,
  cli: BoardCliOptions,
): Promise<void> {
  const ctx = ctxOf(cmd, cli.program)
  // `board:` is read INSIDE the work, not beside it: which board this is is only settled by
  // `useBoard` a line below, and a field read before that names the last board this process
  // had open (#407).
  const data = await runAction(ctx, {}, async () => {
    const found = resolveBoard(move, { board: ctx.board, dir: ctx.dir, cwd: cli.cwd, installHint: cli.installHint })
    useBoard(found, ctx.dir !== null)
    const root = found.root
    // Which board this checkout opens — the folder, or the workspace a committed pointer
    // names (#316). A Cloud board that cannot be opened refuses here, in the words that say
    // what to do about it.
    const opened = await openBoard(root)
    if (!opened.ok) throw new BoardError(opened.error, { kind: `cloud-${opened.reason}`, dir: root })
    sayIfOffline()
    const input = { args, opts }
    // A read answers straight off the board. A write is one operation of the contract, under
    // a lease taken for it — whoever typed this never read the card, so the lease is what
    // hands them the revision they write against (lib/board/ops.ts).
    const owner = move === 'create' ? insideRun() : null
    const data = READ_ONLY_MOVES.has(move)
      ? await board().readMove(move, input)
      : unwrap(
          await withLease(moveTarget(move, args), async (env) => {
            const result = await board().runMove(move, input, env)
            // A cardless create run cannot hold its cards through `cardId`. Attach each new
            // id before giving the board lease back, so another close cannot adopt it first.
            if (result.ok && owner && Array.isArray(result.data.ids)) {
              recordCreatedCards(owner, result.data.ids.filter((id): id is number => Number.isInteger(id)))
            }
            return result
          }),
        )
    // A board that ran the move somewhere else sends its prose back rather than printing it;
    // Local printed as it went and has none to add.
    const { output, warnings, ...fields } = data
    if (output) say(output)
    for (const line of (warnings as string[] | undefined) ?? []) warn(line)
    return { board: KANBAN, ...fields }
  })
  cli.onAnswer?.(data)
}

// What a mutation answered with: the move's own fields, or the refusal thrown so the door
// turns it into a message and an exit code.
function unwrap(res: OpResult<{ data: MoveOutput }>): MoveOutput {
  if (res.ok) return res.data
  // A conflict reaches a terminal only when something else wrote the same card in the
  // milliseconds between the lease and the write. Reading it again is the whole fix.
  throw new BoardError(res.error, res.kind === 'conflict' ? { kind: 'conflict' } : { kind: 'refused' })
}

const ID = "the card's id"

/** Build the whole tree. Fresh per call: the ordered-option accumulators below belong to
 *  one command line, not to the process. */
export function buildBoardProgram(cli: BoardCliOptions): Command {
  const program = withShared(newCommand(cli.program))
  program
    .description(
      "the board's bookkeeping. The agent calls these between runs; a person never has to type one. " +
        "They own docs/kanban/next-id, a card's frontmatter and metrics.csv — write and edit only a " +
        "card's body.",
    )
    .helpCommand('help [move]', 'this list, or one move in full')

  const move = (name: string) => withShared(program.command(name))

  // ---- cards ---------------------------------------------------------------

  // `--question`, and the choices that qualify it, are read in the order they were typed:
  // an `--option` belongs to the `--question` before it. One accumulator per command line.
  const asked: Typed[] = []
  const inOrder = ordered(asked)

  move('create')
    .summary('write exactly one card — its fields, its body template and its index entry')
    .description(
      'Write exactly ONE card: allocate its id, write its frontmatter and a body template, and index it. ' +
        'There is no separate id-reservation mode. --blocked-by and --related take ids of existing open ' +
        'cards; for a group, create the root first, then create each subtask related to its id (see ' +
        '"Group task" in `akb guide board`). The script owns the frontmatter and writes the body ' +
        'scaffold — recurring cards get Run state + Process; fill only the body by hand.',
    )
    .requiredOption('--title <title>', 'what the card is called')
    .option('--recurring', 'a job that repeats: it goes in recurring/ and gets a Run state + Process body')
    .option('--priority <level>', `how much it matters: ${LEVELS.join(' | ')}`, oneOf(LEVELS), 'med')
    .option('--roi <level>', `what it is worth: ${LEVELS.join(' | ')}`, oneOf(LEVELS), 'med')
    .option('--release <version>', 'the version it ships in. Left off, the card is wanted, not promised to one')
    .option('--blocked-by <ids>', 'ids of open cards this one waits on', collectList)
    .option('--related <ids>', 'ids of open cards this one relates to', collectList)
    .option('--modules <names>', 'the parts of the project it touches, validated against modules.md', collectList)
    .option('--question <text>', 'an open question. Repeatable; follow `akb guide update-questions`', inOrder('question'))
    .option('--option <text>', 'a choice for the --question before it', inOrder('option'))
    .option('--recommended-option <text>', 'a choice for the --question before it, ticked to start', inOrder('recommended-option'))
    .option('--mode <mode>', 'how many choices the --question before it takes: single | multi', inOrder('mode'))
    .option('--slug <slug>', 'the filename to write it under (default: from the title)')
    .option('--no-body', 'write the frontmatter and no body template')
    .option('--cadence <cadence>', `how often a recurring card repeats: ${CADENCE_FORMS}. --recurring only`)
    .option('--proposed', 'the board went looking for this work rather than a person asking for it')
    .option(
      '--schedule <action>',
      `hand the new card's first run to the board: ${SCHEDULED_ACTIONS.join(' | ')}`,
      oneOf(SCHEDULED_ACTIONS),
    )
    .action(async function (this: Command) {
      await dispatch('create', this, [], { ...this.opts(), asked }, cli)
    })

  move('update')
    .argument('<id>', ID, cardId)
    .summary("rewrite a card's fields")
    .description(
      "Rewrite a card's frontmatter fields. --slug renames it. Body, questions and verify lines are left " +
        'untouched — those have their own moves. Putting a group root in a release puts every subtask in ' +
        'it too.',
    )
    .option('--title <title>', 'what the card is called')
    .option('--priority <level>', LEVELS.join(' | '), oneOf(LEVELS))
    .option('--roi <level>', LEVELS.join(' | '), oneOf(LEVELS))
    .option('--status <status>', STATUSES.join(' | '), oneOf(STATUSES))
    .option('--release <version>', 'the version it ships in; "" takes it back out of one')
    .option('--blocked-by <ids>', 'ids of open cards this one waits on', collectList)
    .option('--related <ids>', 'ids of open cards this one relates to', collectList)
    .option('--modules <names>', 'the parts of the project it touches', collectList)
    .option(
      '--channels <names>',
      `the channels this topic goes to, LEAD FIRST: ${CHANNEL_NAMES.join(' | ')}. Marketing boards only`,
      collectList,
    )
    .option('--slug <slug>', 'rename the file')
    .option('--cadence <cadence>', `how often it repeats: ${CADENCE_FORMS}. "" clears it. Recurring cards only`)
    .action(async function (this: Command, id: number) {
      await dispatch('update', this, [String(id)], this.opts(), cli)
    })

  move('channel-status')
    .argument('<id>', ID, cardId)
    .argument('<channel>', `which channel: ${CHANNEL_NAMES.join(' | ')}`, oneOf(CHANNEL_NAMES))
    .argument('<status>', CHANNEL_STATUSES.join(' | '), oneOf(CHANNEL_STATUSES))
    .summary('move one of a topic\'s channels along')
    .description(
      "Set where one channel stands on this topic. Refused for a channel the card has not chosen — " +
        '`update <id> --channels <names>` is what chooses them, and this move never adds one. ' +
        '`akb channel <name> <id>` sets `draft` itself once it has written the file.',
    )
    .option('--url <url>', 'where it went up, once it is published')
    .action(async function (this: Command, id: number, channel: string, status: string) {
      await dispatch('channel-status', this, [String(id), channel, status], this.opts(), cli)
    })

  // Every op patches the list in place and they run in the order typed, so handing one
  // question to the user never means re-passing its siblings.
  const questionOps: Typed[] = []
  const opInOrder = ordered(questionOps)

  move('update-questions')
    .argument('<id>', ID, cardId)
    .summary("patch a card's open questions: append, rewrite, drop, move to verify, or clear")
    .description(
      'Patch the open-question list in place. Ops apply in the order they were typed, and a position is ' +
        'read against the list as it stands when its op runs. Positions are 1-based. A question handed to ' +
        'the user always carries choices to tick — follow `akb guide update-questions`. --option, ' +
        '--recommended-option and --mode attach to the --append or --update before them.',
    )
    .option('--append <text>', 'add one question to the end', opInOrder('append'))
    .option('--update <n> <text...>', 'rewrite question <n> whole', opInOrder('update'))
    .option('--drop <positions>', 'remove answered questions, e.g. 1 or 1,3', opInOrder('drop'))
    .option('--to-verify <positions>', 'move hand-checks into `verify:`', opInOrder('to-verify'))
    .option('--clear', 'remove every open question', opInOrder('clear'))
    .option('--option <text>', 'a choice for the op before it', opInOrder('option'))
    .option('--recommended-option <text>', 'a choice for the op before it, ticked to start', opInOrder('recommended-option'))
    .option('--mode <mode>', 'how many choices the op before it takes: single | multi', opInOrder('mode'))
    .action(async function (this: Command, id: number) {
      await dispatch('update-questions', this, [String(id)], { ops: questionOps }, cli)
    })

  const verifyOps: Typed[] = []
  const verifyInOrder = ordered(verifyOps)

  move('update-verify')
    .argument('<id>', ID, cardId)
    .summary('patch what the user checks by hand before accepting the work')
    .description(
      'Patch the `verify:` list — the hand-checks a finished build leaves for the user, one short line ' +
        'each. Ops apply in the order typed. A verify line is a NOTE, not a question: it carries no tag ' +
        'and no options, nothing waits on an answer, and it never stops a card reaching ready or being ' +
        'archived. A decision the user has to make is an open question instead.',
    )
    .option('--append <line>', 'add one hand-check', verifyInOrder('append'))
    .option('--drop <positions>', 'remove them by 1-based position, e.g. 1 or 1,3', verifyInOrder('drop'))
    .option('--clear', 'remove them all', verifyInOrder('clear'))
    .action(async function (this: Command, id: number) {
      await dispatch('update-verify', this, [String(id)], { ops: verifyOps }, cli)
    })

  move('schedule')
    .argument('<id>', ID, cardId)
    .summary('hand a run to the board, to start by itself')
    .description(
      'Have the board run that action on this card by itself, rather than starting a run here. An ' +
        "unblocked card is started on the board's next tick; a blocked one the moment every card it waits " +
        'on has left the board. The mark comes off as the run starts, so it fires once. A card holds one ' +
        'schedule at a time, so a second one replaces the first. Scheduling is what to use for work that ' +
        'must outlive this session: it lives in the card, so it survives a restart, a reboot and a clone.',
    )
    .option('--action <action>', `what to run: ${SCHEDULED_ACTIONS.join(' | ')}`, oneOf(SCHEDULED_ACTIONS))
    .option('--notes <text>', 'a note that rides along and reaches that run')
    .option('--clear', 'take the schedule off')
    .action(async function (this: Command, id: number) {
      await dispatch('schedule', this, [String(id)], this.opts(), cli)
    })

  move('tag')
    .argument('<id>', ID, cardId)
    .argument('<positions>', 'which open questions, 1-based, e.g. 1 or 1,2,3')
    .argument('<tag>', `${[...QUESTION_TAGS, 'none'].join(' | ')} — none strips it`, oneOf([...QUESTION_TAGS, 'none']))
    .summary("mark questions as the human's call, or clear the mark")
    .description(
      'Set the tag on one or more open questions. Used by the refine loop to hand questions to the human ' +
        'without rewriting the list.',
    )
    .action(async function (this: Command, id: number, positions: string, tag: string) {
      await dispatch('tag', this, [String(id), positions, tag], this.opts(), cli)
    })

  move('run-blocker')
    .argument('<id>', ID, cardId)
    .summary('pause an implementation on one actionable blocker')
    .description(
      'Record why the current implementation cannot safely continue and the one action that lets Resume ' +
        'carry it on. Each field is one short sentence. This belongs to the run, never to the card ' +
        'questions.',
    )
    .requiredOption('--step <text>', 'the step it stopped on')
    .requiredOption('--cause <text>', 'why it cannot safely continue')
    .requiredOption('--unblock <text>', 'the one action that lets Resume carry it on')
    .action(async function (this: Command, id: number) {
      await dispatch('run-blocker', this, [String(id)], this.opts(), cli)
    })

  move('validate')
    .argument('[id]', ID, cardId)
    .summary('validate card format and report file, line, and repair instructions')
    .description('Check one card, or every open card when no id is given. Reads only; exits non-zero with detailed errors until the format is valid.')
    .action(async function (this: Command, id?: number) {
      await dispatch('validate', this, id === undefined ? [] : [String(id)], this.opts(), cli)
    })

  move('spec-write')
    .argument('<id>', ID, cardId)
    .argument('<agent>', 'the spec agent whose section this is — `akb spec` lists them')
    .summary("write a spec agent's own section onto the card")
    .description(
      "Put a spec agent's answer on the card as one section headed `## By `<agent>` agent`, and change " +
        'nothing else. Run again for the same agent and the section is REPLACED, never added twice. The ' +
        'section goes before `## Decided by the agent`, or at the end. Told nothing, a new section goes ' +
        'below the agent boundary and a rewrite stays put. `--memory` writes the other file an agent may ' +
        'have — docs/kanban/memory/agents/<agent>.md, replaced whole, created with its heading on the ' +
        'first write.',
    )
    .option('--file <path>', 'the answer, as markdown written to a file first')
    .option('--text <text>', 'the answer, for a one-liner')
    .option(
      '--half <half>',
      'human — above the agent boundary, where a pick the user still has to make belongs; agent — below it',
      oneOf(['human', 'agent']),
    )
    .option(
      '--memory <path>',
      "what the agent remembers, curated whole and written to a file first — only for an agent whose AGENT.md declares `memory: project`",
    )
    .action(async function (this: Command, id: number, agent: string) {
      await dispatch('spec-write', this, [String(id), agent], this.opts(), cli)
    })

  move('rule')
    .argument('<agent>', 'the agent the rule is for — a role the board ships, or one of its specialists')
    .summary("set one agent's rule, in the user's own words")
    .description(
      "The rule is appended to the end of every run that agent does, after everything else the board " +
        'writes — so a rule on `builder` reaches `card implement`, `delivery conflict` and `card run` ' +
        'alike. It replaces whatever that agent carried; an empty rule clears it. The words are the ' +
        "user's: write one only when they ask you to.",
    )
    .option('--file <path>', 'the rule, as markdown written to a file first')
    .option('--text <text>', 'the rule, for a one-liner; empty clears it')
    .action(async function (this: Command, agent: string) {
      await dispatch('rule', this, [agent], this.opts(), cli)
    })

  move('list')
    .summary('the open cards: id, title, meta, summary, path')
    .description(
      'The open cards at a glance — one block per card with its id, title, meta (status, priority, roi, ' +
        'release, blockers, open questions, hand-checks), summary line and file path.',
    )
    .option('-m, --module <name>', 'only the cards tagged with that module, validated against modules.md')
    .action(async function (this: Command) {
      await dispatch('list', this, [], this.opts(), cli)
    })

  move('archive')
    .argument('<id>', ID, cardId)
    .summary('finish a card')
    .description(
      "File it to .archive/, strip its index entry, drop its id from every other card's blocked_by and " +
        'related, delete its mockups, and count it completed. Ends with a handoff: which memory file the ' +
        'note goes in, and every line elsewhere that still mentions the id — read that instead of ' +
        'grepping, because a bare id also matches dates.',
    )
    .action(async function (this: Command, id: number) {
      await dispatch('archive', this, [String(id)], this.opts(), cli)
    })

  move('reject')
    .argument('<id>', ID, cardId)
    .summary('drop a card')
    .description(
      'The same clean-up as archive, but the file or folder is DELETED and the card counts as rejected. ' +
        'Deleting is final — the receipt prints the card so its note can still be written from its own ' +
        'words.',
    )
    .action(async function (this: Command, id: number) {
      await dispatch('reject', this, [String(id)], this.opts(), cli)
    })

  move('record-run')
    .alias('run')
    .argument('<id>', ID, cardId)
    .summary('count one run of a recurring card and keep the card')
    .description('Record one run of a recurring card: +1 completed, and the card is kept rather than archived.')
    .action(async function (this: Command, id: number) {
      await dispatch('record-run', this, [String(id)], this.opts(), cli)
    })

  // ---- releases ------------------------------------------------------------

  const release = withShared(program.command('release'))
    .summary('the versions being planned')
    .description(
      'Add a release, say what it is for, read the list, close one that shipped, or drop one that will ' +
        'not. There is no rename and no reorder — docs/kanban/releases.md is a line or two a person can ' +
        'edit faster than any command could.',
    )
  const sub = (name: string) => withShared(release.command(name))

  sub('new')
    .argument('<version>', 'free text (v1, 0.5.0, august), kept as typed; it has to work as a filename')
    .summary('add a release, last in ship order')
    .description(
      'Add a release to the end of docs/kanban/releases.md — the open releases, in the order they ship. ' +
        'Refused: an empty id, and one already on the list.',
    )
    .option('--goal <text>', "what the version is for, in the user's own words. Folded to one line")
    .option(
      '--fill',
      'put the high-priority cards with no release in as the release is made: a card goes in when its ' +
        'priority is high, nothing open is blocking it, and it is not a group root',
    )
    .action(async function (this: Command, version: string) {
      await dispatch('release', this, ['new', version], this.opts(), cli)
    })

  sub('goal')
    .argument('<version>')
    .argument('<goal>', 'what the version is for; "" clears it')
    .summary('change what a release is for')
    .description('Change what a release is for, after it was made. An empty goal ("") clears it.')
    .action(async function (this: Command, version: string, goal: string) {
      await dispatch('release', this, ['goal', version, goal], this.opts(), cli)
    })

  sub('list')
    .summary('the releases in ship order, with their open and ready counts')
    .description(
      'The releases in ship order, each with what it is for, how many open cards name it and how many of ' +
        'those are ready to build; the cards in no release are counted last. Names any card pointing at a ' +
        'release that is not on the list.',
    )
    .action(async function (this: Command) {
      await dispatch('release', this, ['list'], this.opts(), cli)
    })

  sub('close')
    .argument('<version>')
    .summary('the version shipped')
    .description(
      'Write what it held to docs/kanban/.release-summaries/<version>.md (what shipped, from the archived ' +
        "cards naming it; what didn't, from the open ones), clear the release off every card still open in " +
        'it, and take its line off the list. Always allowed, whatever is still open. There is no second ' +
        'run — afterwards the id is unknown and no card names it. The summary is a card list, so the close ' +
        'then starts the run that writes what the version changed at the top of it.',
    )
    .action(async function (this: Command, version: string) {
      await dispatch('release', this, ['close', version], this.opts(), cli)
    })

  sub('drop')
    .argument('<version>')
    .summary('the version will not ship')
    .description(
      'Report the cards archived under it and the open ones sent back, clear the release off every open ' +
        'card in it, and take its line off the list. Writes no summary file or section; an existing ' +
        'summary for a reused id is left untouched.',
    )
    .action(async function (this: Command, version: string) {
      await dispatch('release', this, ['drop', version], this.opts(), cli)
    })

  sub('changelog')
    .argument('<version>')
    .summary("put a changelog at the top of that version's newest closed section")
    .description(
      'Write a few plain lines saying what the version changed into the newest ## Closed section of its ' +
        'summary file, under a heading of their own, above the goal and the card list. Every line must ' +
        'read as one thing the user can now see or do; six lines at most. Run it again for the same ' +
        'version and the changelog is REPLACED, never added twice. Refused for a version the board holds ' +
        'no closed record of, and for one that shipped no card. `akb release changelog <version>` is the run that ' +
        'writes it.',
    )
    .option('--file <path>', 'the changelog, as markdown written to a file first')
    .option('--text <text>', 'the changelog, for a one-liner')
    .action(async function (this: Command, version: string) {
      await dispatch('release', this, ['changelog', version], this.opts(), cli)
    })

  // ---- the board itself ----------------------------------------------------

  move('init')
    .option('--solution <name>', `what this board's work is: ${SOLUTIONS.join(' | ')}`, oneOf(SOLUTIONS))
    .summary('scaffold docs/kanban/; on an existing board add only what is missing')
    .description(
      'Scaffold the board — the folders, the project-wide memory set in memory/, and a blank config.md ' +
        'and releases.md. On an existing board it only adds the files that are missing, so it is safe to ' +
        're-run and is the repair step for a board written by an older version. `--solution` is read on a ' +
        "fresh board only: what an existing one is, its own config.md says.",
    )
    .action(async function (this: Command) {
      await dispatch('init', this, [], this.opts(), cli)
    })

  move('memory-init')
    .argument('<module>', 'the module whose memory folder to scaffold')
    .summary("scaffold one module's memory folder")
    .description(
      'Lazily scaffold docs/kanban/memory/<module>/ with the four-file set (readme, decisions, redesign, ' +
        'rejected — goal.md lives only at the board root). Idempotent — run it before the first write to ' +
        "a module's memory.",
    )
    .action(async function (this: Command, module: string) {
      await dispatch('memory-init', this, [module], this.opts(), cli)
    })

  move('setup-done')
    .argument('<step>', 'install | config | goal | decisions | modules | tasks')
    .summary('tick one setup step; the tick that closes the last one ends setup')
    .description(
      'Tick one box on docs/kanban/setup-checklist.md as that setup step finishes. The tick that closes ' +
        'the last box deletes the file, so a board without it is a board that is set up.',
    )
    .action(async function (this: Command, step: string) {
      await dispatch('setup-done', this, [step], this.opts(), cli)
    })

  move('setup-status')
    .summary('how far setup got and what comes next')
    .description('How far setup got, and which step comes next. Says setup is finished when there is no checklist.')
    .action(async function (this: Command) {
      await dispatch('setup-status', this, [], this.opts(), cli)
    })

  move('migrate')
    .summary('convert cards written before frontmatter')
    .description(
      'Convert old bold-header cards to frontmatter; missing meta falls back to empty / med. Skips cards ' +
        'that already have frontmatter.',
    )
    .option('--dry-run', 'say what would be migrated and change nothing')
    .action(async function (this: Command) {
      await dispatch('migrate', this, [], this.opts(), cli)
    })

  move('peek')
    .summary('the next free id, without taking it')
    .description('Print the current next-id. Nothing is allocated.')
    .action(async function (this: Command) {
      await dispatch('peek', this, [], this.opts(), cli)
    })

  move('metrics')
    .summary('print metrics.csv')
    .description('Print docs/kanban/metrics.csv as it stands.')
    .action(async function (this: Command) {
      await dispatch('metrics', this, [], this.opts(), cli)
    })

  // `version` answers without a board, because it is about the command rather than a
  // project. The skill folder's door carries no version of its own and says so.
  program
    .command('version')
    .summary('print the installed version')
    .action(function () {
      if (!cli.version) {
        throw new BoardError(`\`${cli.program}\` has no version move — \`akb version\` prints it.`, {
          kind: 'unknown-move',
          move: 'version',
        })
      }
      say(cli.version)
    })
  if (cli.version) program.version(cli.version, '-v, --version', 'print the installed version')

  assertEveryMoveDeclared(program)
  return program
}

// Every move the board answers to has a command above. A name that does not is a bug here
// rather than a command line someone typed, so it fails on the first build that has one.
function assertEveryMoveDeclared(program: Command): void {
  const declared = new Set(program.commands.flatMap((c) => [c.name(), ...c.aliases()]))
  const missing = [...BOARD_MOVES].filter((name) => !declared.has(name))
  if (missing.length) throw new Error(`board moves with no command declared: ${missing.join(', ')}`)
}
