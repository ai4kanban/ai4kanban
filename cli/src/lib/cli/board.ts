import { externalGoalSession, cloudGoal } from '../../commands/goal-cloud'
// The board's bookkeeping, declared once.
//
// Every move below says what it takes and what each option means, and that declaration IS
// the help: `akb raw help` is the summaries, `akb raw help <move>` the whole of one.
// Nothing is written twice, so a flag that is added is a flag the help already knows about.
//
// The two front doors — `akb raw <move>` and the `kanban.mjs` an installed skill folder
// runs — are the same tree. They differ only in how they are spelled in a message.

import { insideRun } from '../agent/env'
import { recordCards } from '../agent/created-cards'
import { runAgent } from '../agent/scheduled'
import { board, moveTarget, withLease, type MoveOutput, type OpResult } from '../board'
import { BOARD_MOVES, READ_ONLY_MOVES } from '../board/local'
import { BoardError, say, warn } from '../io'
import crypto from 'node:crypto'
import { creationReceipt, readCreation, saveCreation, archiveCreation, creationError, triageFile } from '../agent/creation'
import { peekRun } from '../agent/sessions'
import { KANBAN, REPO_ROOT } from '../paths'
import { resolveBoard, sayIfRetiredPointer, useBoard } from '../board-cli'
import { syncWorkflows } from '../agent/cloud-workflows'
import { LEVELS, STATUSES } from '../validate'
import {
  cardId,
  collect,
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
import { Option } from 'commander'
import fs from 'node:fs'
import path from 'node:path'
import { creationProject, createProjectTask, linkedProject, createTask, workspaceTask } from '../cloud/tasks'
import { validateCreate, type CreateOptions } from '../../commands/card'
import { cmdGoal } from '../../commands/goal'

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
    await syncWorkflows()
    const root = found.root
    sayIfRetiredPointer(root)
    const creating = move === 'create' && insideRun() ? peekRun(insideRun()!) : undefined
    if (creating?.triage) {
      if (opts.triage && opts.triage !== creating.triage) throw new BoardError('Creation must keep its original triage source.', { kind: 'refused' })
      opts = { ...opts, triage: creating.triage }
    }
    const input = { args, opts }
    // A read answers straight off the board. A write is one operation of the contract, under
    // a lease taken for it — whoever typed this never read the card, so the lease is what
    // hands them the revision they write against (lib/board/ops.ts).
    const inRun = move === 'create' && insideRun() !== null
    const task = move === 'create' && opts.id === undefined ? workspaceTask() : null
    if (move === 'create' && opts.id === undefined) {
      const { workflow } = validateCreate(opts as unknown as CreateOptions)
      input.opts = (await cloudCard(task, task ? opts : { ...opts, workflow })).opts
    }
    const data = READ_ONLY_MOVES.has(move)
      ? await board().readMove(move, input)
      : unwrap(await withLease(moveTarget(move, args), (env) => board().runMove(move, input, env)))
    const created = move === 'create' && Array.isArray(data.ids) ? data.ids.filter((id): id is number => Number.isInteger(id)) : []
    if (inRun) await recordCards(insideRun()!, created)
    if (move === 'create' && typeof input.opts.triage === 'string' && created[0] !== undefined) archiveCreation(input.opts.triage, created[0])
    // A board that ran the move somewhere else sends its prose back rather than printing it;
    // Local printed as it went and has none to add.
    const { output, warnings, ...fields } = data
    if (output) say(output)
    for (const line of (warnings as string[] | undefined) ?? []) warn(line)
    return { board: KANBAN, ...fields }
  })
  cli.onAnswer?.(data)
}

/** A card made in a Runner workspace is a Cloud task first (#2063): written here under the
 *  task's number, so the board's next push files it as that task's card, and Cloud moves it on
 *  from there (#170). */
async function cloudCard(task: string | null, opts: Record<string, unknown>): Promise<{ opts: Record<string, unknown> }> {
  const run = insideRun() ? peekRun(insideRun()!) : undefined
  const triage = typeof opts.triage === 'string' ? opts.triage : run?.triage
  opts = { ...opts, ...(triage ? { triage } : {}) }
  const sourceFile = triage ? triageFile(triage) : undefined
  let request: string | undefined
  if (typeof opts.bodyFile === 'string') {
    try {
      request = fs.readFileSync(opts.bodyFile, 'utf8')
    } catch {
      // cmdCreate says so below.
    }
  }
  const said = {
    title: String(opts.title ?? '').trim(),
    request,
    workflow: typeof opts.workflow === 'string' && opts.workflow.trim() ? opts.workflow.trim() : undefined,
    slug: typeof opts.slug === 'string' ? opts.slug : undefined,
    triage: sourceFile,
    agent: runAgent() ?? undefined,
  }
  if (task) {
    const link = linkedProject(KANBAN, REPO_ROOT)
    if (!link.ok) throw new BoardError(creationError(link.error, triage), { kind: 'refused' })
    if (link.value) {
      const checked = await creationProject(KANBAN, REPO_ROOT, task)
      if (!checked.ok) throw new BoardError(creationError(checked.error, triage), { kind: 'refused' })
    }
    const made = await createTask(task, said)
    if (!made.ok) throw new BoardError(creationError(`Cloud did not make the task: ${made.error}`, triage), { kind: 'refused' })
    return { opts: { ...opts, id: made.value.number, fromTask: made.value.from.key } }
  }
  const checked = await creationProject(KANBAN, REPO_ROOT)
  if (!checked.ok) throw new BoardError(creationError(checked.error, triage), { kind: 'refused' })
  const requestId = triage ? `triage:${triage}` : run?.sessionId ?? crypto.randomUUID()
  const slot = triage ? triage : String(opts.slug ?? opts.title)
  const file = creationReceipt(`${checked.value}:${requestId}`, slot)
  const journal = readCreation(file, said)
  if (!journal.made) {
    const key = `akb-${path.basename(file, '.json').slice(0, 40)}`
    const made = await createProjectTask(checked.value, journal.said, key)
    if (!made.ok) throw new BoardError(creationError(`Cloud did not make the task: ${made.error}`, triage), { kind: 'refused' })
    journal.made = made.value
    saveCreation(file, journal)
  }
  const held = journal.made
  return { opts: { ...opts, title: journal.said.title, slug: journal.said.slug, id: held.number } }
}

// `--recurring` and `--cadence` are retired with the recurring card (#1414).
function refuseRecurring(command: Command): void {
  const { recurring, cadence } = command.opts()
  if (recurring === undefined && cadence === undefined) return
  command.error(
    `error: ${recurring !== undefined ? '--recurring' : '--cadence'} is gone — repeating work is a scheduled agent now, not a card. Write one with \`akb guide write-agent\`.`,
  )
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
        "They own a card's frontmatter — write and edit only a " +
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
        '"Group tasks" in `akb guide add-task`). The script owns the frontmatter and writes the body ' +
        'scaffold; fill only the body by hand. ' +
        'Without --id, Cloud assigns the number in the linked project (no source task required). ' +
        'A failed local write can resume the same creation without making another Cloud task. ' +
        'Missing or invalid project links and denied access exit with code 1 using the existing error envelope. ' +
        '--body-file accepts a short draft or full card body. Invalid bodies fail before allocating a task or writing a card, with repair instructions. Cloud moves the card on by itself once ' +
        'it reaches the board: do not refine it here. ' +
        'Example: akb raw create --title "Add a delete command" --workflow coding --body-file /tmp/delete-command.md',
    )
    .requiredOption('--title <title>', 'what the card is called')
    .addOption(new Option('--recurring').hideHelp())
    // No default here: `create` falls back to `med` itself.
    .option('--priority <level>', `how much it matters: ${LEVELS.join(' | ')} (default: med)`, oneOf(LEVELS))
    .option('--blocked-by <ids>', 'ids of open cards this one waits on', collectList)
    .option('--related <ids>', 'ids of open cards this one relates to', collectList)
    .option('--modules <names>', 'the parts of the project it touches, validated against modules.md', collectList)
    .option('--question <text>', 'an open question; needs its --option choices. Repeatable; follow `akb guide update-questions`', inOrder('question'))
    .option('--option <text>', 'a choice for the --question before it', inOrder('option'))
    .option('--recommended-option <text>', 'a choice for the --question before it, ticked to start', inOrder('recommended-option'))
    .option('--mode <mode>', 'how many choices the --question before it takes: single | multi', inOrder('mode'))
    .option('--slug <slug>', 'the filename to write it under (default: from the title)')
    .option('--no-body', 'write the frontmatter and no body template')
    .option('--body-file <path>', 'a short draft or full card body, written to a file first')
    .addOption(new Option('--cadence <cadence>').hideHelp())
    .option('--workflow <id>', "the workflow it runs through (`akb workflow list`). Required when the board has more than one, except inside a task run, which uses the task's own")
    .option('--previews <agents>', 'the preview agents it chose, from its workflow\'s; "" chooses none', collectList)
    .addOption(new Option('--id <n>', "the number Cloud gave this card's task; for the Runner").argParser(cardId).hideHelp())
    .option('--triage <source-id>', 'the triage item this card is made of, so the item is never carded twice')
    .option('--source <ref>', "where it came from: a plan's path, plan:<id>, #<id> or a URL. Repeatable", collect)
    .action(async function (this: Command) {
      refuseRecurring(this)
      await dispatch('create', this, [], { ...this.opts(), asked }, cli)
    })

  move('update')
    .argument('<id>', ID, cardId)
    .summary("rewrite a card's fields")
    .description(
      "Rewrite a card's frontmatter fields. --slug renames it. Body and questions are left " +
        'untouched — those have their own moves.',
    )
    .option('--title <title>', 'what the card is called')
    .option('--priority <level>', LEVELS.join(' | '), oneOf(LEVELS))
    .option('--status <status>', STATUSES.join(' | '), oneOf(STATUSES))
    .option('--blocked-by <ids>', 'ids of open cards this one waits on', collectList)
    .option('--related <ids>', 'ids of open cards this one relates to', collectList)
    .option('--add-blocked-by <ids>', 'append ids to blocked_by, keeping the ids already there', collectList)
    .option('--add-related <ids>', 'append ids to related, keeping the ids already there', collectList)
    .option('--modules <names>', 'the parts of the project it touches', collectList)
    .option('--source <ref>', "where it came from: a plan's path, plan:<id>, #<id> or a URL. Repeatable; \"\" clears the list", collect)
    .option('--add-source <ref>', 'append one source, keeping the ones already there. Repeatable', collect)
    .option('--previews <agents>', 'the preview agents it chose, from its workflow\'s; "" chooses none', collectList)
    .option('--phase <n>', 'the approval it is on, 1-based')
    .option('--slug <slug>', 'rename the file')
    .option('--workflow <id>', 'the workflow it runs through. The card goes back to todo and is re-planned')
    .addOption(new Option('--cadence <cadence>').hideHelp())
    .action(async function (this: Command, id: number) {
      refuseRecurring(this)
      await dispatch('update', this, [String(id)], this.opts(), cli)
    })

  // Every op patches the list in place and they run in the order typed, so handing one
  // question to the user never means re-passing its siblings.
  const questionOps: Typed[] = []
  const opInOrder = ordered(questionOps)

  move('update-questions')
    .argument('<id>', ID, cardId)
    .summary("patch a card's open questions: append, rewrite, drop, skip, or clear")
    .description(
      'Patch the open-question list in place. Ops apply in the order they were typed, and a position is ' +
        'read against the list as it stands when its op runs. Positions are 1-based. A question handed to ' +
        'the user always carries choices to tick — follow `akb guide update-questions`. --option, ' +
        '--recommended-option, --mode and --agent attach to the --append or --update before them.',
    )
    .option('--append <text>', 'add one question to the end', opInOrder('append'))
    .option('--update <n> <text...>', 'rewrite question <n> whole', opInOrder('update'))
    .option('--drop <positions>', 'remove answered questions, e.g. 1 or 1,3', opInOrder('drop'))
    .option('--skip <positions>', 'mark questions skipped: kept as a record, no longer open', opInOrder('skip'))
    .option('--unskip <positions>', 'reopen skipped questions', opInOrder('unskip'))
    .option('--clear', 'remove every open question', opInOrder('clear'))
    .option('--option <text>', 'a choice for the op before it', opInOrder('option'))
    .option('--recommended-option <text>', 'a choice for the op before it, ticked to start', opInOrder('recommended-option'))
    .option('--mode <mode>', 'how many choices the op before it takes: single | multi', opInOrder('mode'))
    .option('--agent <name>', 'the preview agent whose section the op before it is about', opInOrder('agent'))
    .action(async function (this: Command, id: number) {
      await dispatch('update-questions', this, [String(id)], { ops: questionOps }, cli)
    })

  move('goal').alias('idea')
    .argument('<move>', 'new, save, drop or start')
    .summary('保存讨论中的目标')
    .description('Only inside a goal discussion. Write a temporary draft, then goal new --title "…" --body-file <file> [--workflow <id>] [--previews <agents>]; update with goal save --id <goal> and any of --title, --body-file, --workflow, --previews. goal drop --id <goal> withdraws one; goal start --id <goal> turns it into a task when the turn ends. A `## Done when` list in the body is what counts as done. Workflows are the ones `akb workflow list` shows.')
    .option('--id <goal>', 'the goal to save, drop or start')
    .option('--title <title>', 'what the goal is called')
    .option('--body-file <path>', 'the outcome, then a `## Done when` list')
    .option('--workflow <id>', 'the workflow that does the work, from `akb workflow list`')
    .option('--previews <agents>', 'review points, comma-separated; empty clears the selection')
    .action(async function (this: Command, sub: string) {
      const data = await runAction(ctxOf(this, cli.program), {}, () => externalGoalSession() ? cloudGoal([sub], this.opts()) : cmdGoal([sub], this.opts()))
      cli.onAnswer?.(data)
    })

  move('validate')
    .argument('[id]', ID, cardId)
    .summary('validate card format and report file, line, and repair instructions')
    .description('Check one card, or every open card when no id is given. Reads only; exits non-zero with detailed errors until the format is valid.')
    .action(async function (this: Command, id?: number) {
      await dispatch('validate', this, id === undefined ? [] : [String(id)], this.opts(), cli)
    })

  move('rule')
    .argument('<agent>', 'the agent the rule is for — a role the board ships, or one of its specialists')
    .summary("set one agent's rule, in the user's own words")
    .description(
      "The rule is appended to the end of every run that agent does, after everything else the board " +
        'writes — so a rule on `builder` reaches `card implement` ' +
        'alike. It replaces whatever that agent carried; an empty rule clears it. The words are the ' +
        "user's: write one only when they ask you to.",
    )
    .option('--file <path>', 'the rule, as markdown written to a file first')
    .option('--text <text>', 'the rule, for a one-liner; empty clears it')
    .action(async function (this: Command, agent: string) {
      await dispatch('rule', this, [agent], this.opts(), cli)
    })

  move('agent-file')
    .argument('<agent>', 'the agent whose folder the file is in')
    .argument('<path>', "the file, as the run's own list spells it")
    .summary("print one file from an agent's own folder")
    .description(
      "Every run is told which files its agent's folder holds, and reads one when the work calls for it. " +
        "`AGENT.md` prints the agent's own rules. A built-in agent ships its files inside the command, so " +
        'this is the only way to open one; a path the agent does not offer is refused.',
    )
    .action(async function (this: Command, agent: string, file: string) {
      await dispatch('agent-file', this, [agent, file], this.opts(), cli)
    })

  move('memory-file')
    .argument('<name>', 'the global memory')
    .summary("print one global memory's rules, its MEMORY.md")
    .description(
      "A run is told which global memories its agent keeps and reads one's rules when the work calls for it. " +
        "A built-in memory's rules ship inside the command, so this is the only way to open them.",
    )
    .action(async function (this: Command, name: string) {
      await dispatch('memory-file', this, [name], this.opts(), cli)
    })

  move('list')
    .summary('the open cards: id, title, meta, summary, path — or, with --archived, the cards that landed')
    .description(
      'The open cards at a glance — one block per card with its id, title, meta (status, priority, ' +
        'blockers, open questions), summary line and file path.\n\n' +
        "`--stale` asks the other question: which cards have sat untouched past the board's **Stale after** " +
        'setting (config.md, 30 days by default), stalest first, each with the days it has sat and what is ' +
        'holding it — a blocker, an unanswered question, or a build. Age is the date git last saw ' +
        "the card's file; group roots and cards git cannot date are left out.\n\n" +
        '`--archived` answers "which cards landed in this period": one block per landing, oldest first, with ' +
        'the card id, title, workflow, landing time, landed commit and the archived card file (blank when ' +
        "the file is no longer in .archive/, e.g. deleted by hand; a card the daily cleanup deletes goes " +
        'with its finished delivery and is not listed). Only cards the board landed are listed — a card archived by hand, ' +
        'committed by hand, or built by a workflow that leaves files instead of a commit is not among them.',
    )
    .option('-m, --module <name>', 'only the cards tagged with that module, validated against modules.md')
    .option('--stale', 'only the cards untouched past the threshold, stalest first, with the days each has sat')
    .option('--archived', 'the cards that landed and were archived, oldest first, each with its landed commit')
    .option(
      '--since <time>',
      'with --archived: only landings after this time, written "YYYY-MM-DD HH:MM"; inside a scheduled ' +
        "agent's run, `last-run` is when its last run began",
    )
    .option('--workflow <id>', 'with --archived: only the cards of that workflow')
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
      'The same clean-up as archive: the file or folder moves to .archive/, marked `rejected: true`, and ' +
        'the card counts as rejected. It stays readable there and is listed as rejected. A reason is kept ' +
        'on the card, and on each subtask a group takes with it.',
    )
    .option('--discard', 'just drop it: nothing learns from it')
    .option('--reason <text>', 'why, kept on the archived card as `rejected_reason` and shown on its page')
    .action(async function (this: Command, id: number) {
      await dispatch('reject', this, [String(id)], this.opts(), cli)
    })

  // ---- the board itself ----------------------------------------------------

  move('init')
    .summary('scaffold docs/kanban/; on an existing board add only what is missing')
    .description(
      "Scaffold the board — the folders, the board's own memory in memory/ with the planner's beside it, and a blank config.md. " +
        'On an existing board it only adds the files that are missing, so it is safe to ' +
        're-run and is the repair step for a board written by an older version.',
    )
    .action(async function (this: Command) {
      await dispatch('init', this, [], this.opts(), cli)
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

  // `version` answers without a board, because it is about the command rather than a
  // project. The skill folder's door carries no version of its own and says so.
  program
    .command('version')
    .summary('print the installed version')
    .action(function () {
      if (!cli.version) {
        throw new BoardError(`\`${cli.program}\` has no version move — \`akb --version\` prints it.`, {
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
