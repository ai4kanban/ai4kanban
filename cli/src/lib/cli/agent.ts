// The commands a person actually types — the runs, and everything you do to one.
//
// `akb board <move>` is the board's own bookkeeping (./board.ts). These are the other half:
// starting a run, steering it, talking to the agent, and setting up what the runs run on.
//
// The flow commands are not written out here. They come from the board's own list of flows
// (../agent/flows.ts), which the dispatcher and the Rules pane read too, so a flow shipped
// later is a command, a help entry and a rule at once.

import { Option } from 'commander'

import { openBoard } from '../board'
import { BoardError } from '../io'
import { KANBAN, setBoardRoot } from '../paths'
import { resolveBoard, sayIfOffline } from '../board-cli'
import { FLOWS, type Flow, type FlowOption } from '../agent/flows'
import { HELP_AFTER } from '../agent/manual'
import { cmdAgent } from '../../commands/agent'
import { cmdChat } from '../../commands/chat'
import { cmdCloud } from '../../commands/cloud'
import { cmdGuide } from '../../commands/guide'
import {
  cmdApprove,
  cmdCancel,
  cmdDiscard,
  cmdLog,
  cmdResume,
  cmdRuns,
  cmdStartRun,
  cmdStop,
  cmdWatch,
} from '../../commands/run'
import { cmdSpec } from '../../commands/spec'
import { cardId, ctxOf, intInRange, oneOf, runAction, withShared, type Command } from './shared'
import type { AkbCliOptions } from './akb'

/** What the door hands in — see `runAgent`. */
export type AgentCliOptions = AkbCliOptions

// Every command here works on one board, so finding it is done once rather than in each.
// `guide` and the account half of `cloud` are the exceptions: a guide is the same text
// wherever it is read, and the Cloud sign-in belongs to the machine rather than to any one
// project (#326).
async function onBoard(
  cmd: Command,
  cli: AgentCliOptions,
  work: (program: string) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void,
): Promise<void> {
  const ctx = ctxOf(cmd, cli.program)
  await runAction(ctx, { board: KANBAN }, async () => {
    const root = resolveBoard('runs', { dir: ctx.dir, cwd: cli.cwd, installHint: cli.installHint })
    setBoardRoot(root, ctx.dir !== null)
    // …and which board that checkout opens: the folder, or the workspace its committed
    // pointer names (#316). A refusal here is the whole answer — a run against a board that
    // could not be opened would be a run against no board at all.
    const opened = await openBoard(root)
    if (!opened.ok) throw new BoardError(opened.error, { kind: `cloud-${opened.reason}`, dir: root })
    sayIfOffline()
    return (await work(cli.program)) ?? {}
  })
}

async function boardless(
  cmd: Command,
  cli: AgentCliOptions,
  work: (program: string) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void,
): Promise<void> {
  const ctx = ctxOf(cmd, cli.program)
  await runAction(ctx, {}, async () => (await work(cli.program)) ?? {})
}

// What Commander hands an action handler: the declared arguments, then the options, then
// the command. The two on the end are read off `this`, so only the arguments are wanted.
const positional = (vals: unknown[]): unknown[] => vals.slice(0, -2)

/** Declare the runs, and everything you do to one, on `akb` (./akb.ts). */
export function declareRuns(program: Command, cli: AgentCliOptions): void {
  // ---- the flows -----------------------------------------------------------

  for (const flow of FLOWS) declareFlow(program, flow, cli)

  // ---- a named skill that fills one part of a card's spec --------------------

  withShared(program.command('spec'))
    .argument('[skill]', 'which spec skill; left off, the skills this board has are listed')
    .argument('[id]', 'the card to put it on', cardId)
    .argument('[note...]', 'what the flow wants looked at')
    .summary("a named skill that fills one part of a card's spec")
    .description(
      'It is a run of its own: it starts clean, with the card and your note and nothing else, and it ' +
        'writes one section of that card — `## By `<skill>` skill` — and changes nothing more. A project ' +
        'adds its own under docs/kanban/skills/<name>/SKILL.md; the built-in ones ship with this command. ' +
        'Asked for from inside a run, it is written down rather than started, and the board starts it the ' +
        'moment that run ends.',
    )
    .option('-f, --follow', 'watch its log instead of returning')
    .option('--notes <text>', 'what the flow wants looked at, for a caller building a command')
    // Declared so the refusal can say WHY there is none, rather than "unknown option".
    .addOption(new Option('--print', 'refused — see below').hideHelp())
    .addHelpText(
      'after',
      '\nThere is no --print: doing a spec skill in the conversation that asked for it is the one thing it\n' +
        'exists not to be.\n',
    )
    .action(async function (this: Command, ...vals: unknown[]) {
      const [skill, id, note] = positional(vals) as [string | undefined, number | undefined, string[]]
      await onBoard(this, cli, (p) => cmdSpec({ skill, id, note, ...this.opts() }, p))
    })

  // ---- talking to the agent -------------------------------------------------

  withShared(program.command('chat'))
    .argument('[id]', 'the card the conversation is about; left off, it is the board’s', cardId)
    .argument('[message...]', 'what to say; left off, the conversation so far is printed')
    .summary('a conversation that also does the board work')
    .description(
      'The reply arrives as it is written, and the next message lands in the same session — the agent ' +
        "still has everything said before. The board's conversation and each card's are separate, and " +
        'both live on this machine until they are cleared. A chat is still not a run: it never shows in ' +
        '`runs`, never holds a card, and never keeps a run off the card it is about.',
    )
    .option('--clear', 'forget that conversation and start fresh')
    .option('--model <id>', 'run this one conversation on that model ("" for the board’s)')
    .option('--agent <name>', 'run it on that agent — starts the conversation over')
    .addHelpText('after', HELP_AFTER.chat)
    .action(async function (this: Command, ...vals: unknown[]) {
      const [id, message] = positional(vals) as [number | undefined, string[]]
      await onBoard(this, cli, (p) => cmdChat({ id, message, ...this.opts() }, p))
    })

  // ---- runs in flight -------------------------------------------------------

  withShared(program.command('runs'))
    .summary('what is running, and what ran lately')
    .option('-c, --card <id>', 'only the runs on that card', cardId)
    .option('-a, --all', 'every run this board has kept, not just the last ten')
    .action(async function (this: Command) {
      await onBoard(this, cli, (p) => cmdRuns(this.opts(), p))
    })

  withShared(program.command('log'))
    .argument('[id]', RUN_ID, String)
    .summary("one run's log")
    .option('-f, --follow', 'keep printing it until the run ends')
    .option('--full', 'all of it, rather than the tail')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [id] = positional(vals) as [string | undefined]
      await onBoard(this, cli, (p) => cmdLog(id, this.opts(), p))
    })

  withShared(program.command('stop'))
    .argument('[id]', RUN_ID, String)
    .summary('end a run')
    .description('Its half-finished edits are left in the working tree — the board never undoes work.')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [id] = positional(vals) as [string | undefined]
      await onBoard(this, cli, () => cmdStop(id))
    })

  withShared(program.command('resume'))
    .argument('[id]', RUN_ID, String)
    .summary('continue a run that failed, was cut off or was stopped')
    .description(
      "The one command that reaches past the board: it picks the coding agent's own session back up — " +
        'the conversation it was having, with everything it had already read — while the board counts the ' +
        'work as a fresh run.',
    )
    .option('-f, --follow', 'watch its log instead of returning')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [id] = positional(vals) as [string | undefined]
      await onBoard(this, cli, () => cmdResume(id, this.opts()))
    })

  withShared(program.command('cancel'))
    .argument('<delivery>', DELIVERY)
    .summary('end the delivery in flight on a card and hand it back')
    .description('Its worktree and branch are left on disk. `discard` is what throws those away.')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [named] = positional(vals) as [string]
      await onBoard(this, cli, () => cmdCancel(named))
    })

  withShared(program.command('discard'))
    .argument('<delivery>', DELIVERY)
    .summary('end a delivery AND throw its worktree and branch away')
    .description("What the card page's Discard does. This is the one command here that loses work.")
    .option('-y, --yes', 'go ahead; without it, it only says what would be lost')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [named] = positional(vals) as [string]
      await onBoard(this, cli, () => cmdDiscard(named, this.opts()))
    })

  withShared(program.command('approve'))
    .argument('<delivery>', DELIVERY)
    .summary('sign off the tree a delivery would land, on a board that requires it')
    .description(
      'The approval covers the delivery’s base commit and the tree built on it as they stand right now, ' +
        'so read the diff first — `akb log` and the card page’s Diff tab both show it. Either one moving ' +
        'afterwards cancels the approval by itself.',
    )
    .action(async function (this: Command, ...vals: unknown[]) {
      const [named] = positional(vals) as [string]
      await onBoard(this, cli, () => cmdApprove(named))
    })

  program.addHelpText('after', HELP_AFTER.deliveries(cli.program))

  // ---- the agent that runs them ---------------------------------------------

  declareAgent(program, cli)

  // ---- Cloud ----------------------------------------------------------------

  const cloud = withShared(program.command('cloud'))
    .summary('the account this MACHINE acts as')
    .description(
      'A sign-in is started in the AI4Kanban app, under Configuration → Notifications, and nowhere else: ' +
        'the consent screen opens in your own browser and comes back to the app. Once per machine — every ' +
        `\`${cli.program}\` on it then acts as that account, because they read the one session the app ` +
        'wrote, outside every repository. Cloud is an invite-only preview.',
    )
    .action(async function (this: Command) {
      await boardless(this, cli, (p) => cmdCloud([], p))
    })

  withShared(cloud.command('sign-out'))
    .summary('forget it: this machine stops reaching Cloud, and nothing on any board changes')
    .action(async function (this: Command) {
      await boardless(this, cli, (p) => cmdCloud(['sign-out'], p))
    })

  withShared(cloud.command('import'))
    .argument('<workspace>', 'the Cloud workspace to carry this board into')
    .summary('carry this board into a Cloud workspace')
    .description(
      'Reads the board and changes nothing in it; run it again to carry on after an interruption. The ' +
        'one `cloud` word that needs a board, because it reads one.',
    )
    .action(async function (this: Command, ...vals: unknown[]) {
      const [workspace] = positional(vals) as [string]
      await onBoard(this, cli, (p) => cmdCloud(['import', workspace], p))
    })

  withShared(cloud.command('export'))
    .argument('<workspace>', 'the Cloud workspace to write out')
    .summary('write a workspace back out as a markdown board')
    .description(
      'It needs no board of its own, so it restores onto a machine that has none; ' +
        `\`${cli.program} --dir <folder>\` then opens it as a Local one. Refused for a folder that ` +
        'already holds a board, because an export is a restore and a restore over a live board cannot be ' +
        'undone.',
    )
    .requiredOption('--to <folder>', 'the empty folder to write the board into')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [workspace] = positional(vals) as [string]
      await boardless(this, cli, (p) => cmdCloud(['export', workspace, '--to', String(this.opts().to)], p))
    })

  // ---- the flows, as text ---------------------------------------------------

  withShared(program.command('guide'))
    .argument('[topic]', 'one flow in full; left off, every flow is listed one line each')
    .summary('the flows the board works by, shipped with this command')
    .description(
      'A printed flow already carries the flows its action is done by, so this is for the rest: how the ' +
        'board works at all, the module map, setup, updating, the local UI. `guide board` is the card ' +
        'format, the layout and the memory set.',
    )
    .action(async function (this: Command, ...vals: unknown[]) {
      const [topic] = positional(vals) as [string | undefined]
      await boardless(this, cli, (p) => cmdGuide(topic, p))
    })

  // The watcher's own door. Not a command anyone types — `akb implement 12` spawns it — and
  // spelled so it can never be mistaken for one.
  program
    .command('__watch', { hidden: true })
    .argument('<sessionId>')
    .action(async function (this: Command, sessionId: string) {
      const ctx = ctxOf(this, cli.program)
      const root = resolveBoard('runs', { dir: ctx.dir, cwd: cli.cwd, installHint: cli.installHint })
      setBoardRoot(root, ctx.dir !== null)
      const opened = await openBoard(root)
      if (!opened.ok) throw new BoardError(opened.error, { kind: `cloud-${opened.reason}`, dir: root })
      // The watcher runs for as long as the agent does, writes its own log, and says nothing
      // to anyone. It never collects prose and never answers in JSON.
      const code = await cmdWatch(sessionId)
      if (code !== 0) throw new BoardError(`the watcher for ${sessionId} ended with ${code}`, { kind: 'watch-failed' })
    })
}

const RUN_ID = "a run's id, any prefix of one that names only one run, or `last`. Left out, it means the newest run"
const DELIVERY = 'the delivery, or the card it is on'

// ---- one flow -----------------------------------------------------------------------

// Every flow is the same command with a different name: what it takes comes off the flow's
// own entry, and `--print` and `--follow` are added to all of them.
function declareFlow(program: Command, flow: Flow, cli: AgentCliOptions): void {
  const cmd = withShared(program.command(flow.command))
  for (const arg of splitArgs(flow.argument)) {
    cmd.argument(arg, argNote(arg, flow), arg.startsWith('<id') ? cardId : undefined)
  }
  cmd.summary(flow.gloss)
  if (flow.more?.length) cmd.description(`${sentence(flow.gloss)} ${flow.more.join(' ')}`)
  for (const option of flow.options ?? []) addFlowOption(cmd, option)
  cmd
    .addOption(new Option('-p, --print', 'say what to do and start nothing').conflicts('follow'))
    .option('-f, --follow', 'watch the log instead of returning')
    .addHelpText('after', HELP_AFTER.flow)
    .action(async function (this: Command, ...vals: unknown[]) {
      const args = positional(vals)
      await onBoard(this, cli, (p) => cmdStartRun(flow.action, args, this.opts(), p))
    })
}

function addFlowOption(cmd: Command, option: FlowOption): void {
  const declared = new Option(option.flags, option.description)
  if (option.choices) declared.argParser(oneOf(option.choices))
  if (option.range) declared.argParser(intInRange(option.range[0], option.range[1]))
  cmd.addOption(declared)
}

// `<id> [note...]` → `['<id>', '[note...]']`. A flow's argument line is written in
// Commander's own notation, so this only has to split it.
const splitArgs = (argument: string): string[] => (argument ? argument.split(/\s+/) : [])

function argNote(arg: string, flow: Flow): string {
  if (arg.startsWith('<id')) return "the card's id"
  return flow.argumentNote ?? ''
}

const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`)

// ---- the agent, and the runtimes it runs on -------------------------------------------

function declareAgent(program: Command, cli: AgentCliOptions): void {
  const agent = withShared(program.command('agent'))
    .summary('what runs the board, and how it is set up')
    .description(
      "All of it is the BOARD's, in docs/kanban/ui.config.json, so it travels with the repository and a " +
        'fresh clone runs what everyone else runs with nothing to set up per machine. A run never reads ' +
        "the terminal's environment for any of this.",
    )
    .action(async function (this: Command) {
      await onBoard(this, cli, () => cmdAgent(['show']))
    })

  const word = (name: string) => withShared(agent.command(name))

  word('list')
    .summary('the agents it can run, and what each one takes')
    .action(async function (this: Command) {
      await onBoard(this, cli, () => cmdAgent(['list']))
    })

  word('use')
    .argument('<name>', 'an agent from `agent list`')
    .summary('pick one')
    .description('Switching never throws a setting away: every agent’s settings live under its own name.')
    .action(async function (this: Command, name: string) {
      await onBoard(this, cli, () => cmdAgent(['use', name]))
    })

  word('set')
    .argument('<key>', 'a setting the picked agent takes — `agent` lists them')
    .argument('[value...]', 'the value; left off, the setting is cleared and the agent’s own default runs')
    .summary('one of the picked agent’s settings, or its key')
    .description(
      'A key goes to docs/kanban/.env and nowhere else, and is never echoed back. Give the user the line ' +
        'and let them type it: a key an agent types lands in its transcript and in the shell history.',
    )
    .action(async function (this: Command, key: string, value: string[]) {
      await onBoard(this, cli, () => cmdAgent(['set', key, ...value]))
    })

  word('test')
    .argument('[runtime]', 'which runtime to test; left off, the board’s global one')
    .summary('one small chat, to see the setup works')
    .action(async function (this: Command, runtime: string | undefined) {
      await onBoard(this, cli, () => cmdAgent(['test', ...(runtime ? [runtime] : [])]))
    })

  word('runtimes')
    .summary('the runtimes, and what each flow and spec skill is on')
    .action(async function (this: Command) {
      await onBoard(this, cli, () => cmdAgent(['runtimes']))
    })

  const runtime = withShared(agent.command('runtime'))
    .summary('a runtime, so different flows run different tools')
    .description(
      "All of it is the board's, in docs/kanban/ui.config.json. The global runtime runs `agent use`'s " +
        'pick; a runtime with nothing of its own runs it too.',
    )
    .action(async function (this: Command) {
      await onBoard(this, cli, () => cmdAgent(['runtimes']))
    })

  const verb = (name: string) => withShared(runtime.command(name))

  verb('add')
    .argument('<name>')
    .summary('name one')
    .action(async function (this: Command, name: string) {
      await onBoard(this, cli, () => cmdAgent(['runtime', 'add', name]))
    })

  verb('remove')
    .argument('<name>')
    .summary('drop it; whatever named it runs the global one')
    .action(async function (this: Command, name: string) {
      await onBoard(this, cli, () => cmdAgent(['runtime', 'remove', name]))
    })

  verb('rename')
    .argument('<old>')
    .argument('<new>')
    .summary('rename it, carrying everything that named it and what it runs as')
    .action(async function (this: Command, from: string, to: string) {
      await onBoard(this, cli, () => cmdAgent(['runtime', 'rename', from, to]))
    })

  verb('global')
    .argument('<name>')
    .summary('the one a flow that names none runs on')
    .action(async function (this: Command, name: string) {
      await onBoard(this, cli, () => cmdAgent(['runtime', 'global', name]))
    })

  verb('for')
    .argument('<what>', 'a flow or a spec skill')
    .argument('<runtime>', 'the runtime to put it on; "-" puts it back on the global one')
    .summary('point one flow or spec skill at a runtime')
    .action(async function (this: Command, what: string, name: string) {
      await onBoard(this, cli, () => cmdAgent(['runtime', 'for', what, name]))
    })

  verb('set')
    .argument('<runtime>')
    .argument('<key>', 'a setting the agent THAT RUNTIME runs takes')
    .argument('[value...]', 'the value; left off, it runs what that agent is set to on this board')
    .summary('one of that runtime’s own settings')
    .description(
      'Checked against the agent that runtime runs, never the board’s — a value Codex refuses must not ' +
        'be saved against Claude Code’s rules. A key is never one of these: it lives in ' +
        'docs/kanban/.env, so `agent set` is where it goes.',
    )
    .action(async function (this: Command, name: string, key: string, value: string[]) {
      await onBoard(this, cli, () => cmdAgent(['bind', name, 'set', key, ...value]))
    })

  withShared(agent.command('bind'))
    .argument('<runtime>')
    .argument('<agent>', 'an agent from `agent list`')
    .summary('what that runtime runs as')
    .action(async function (this: Command, name: string, harness: string) {
      await onBoard(this, cli, () => cmdAgent(['bind', name, harness]))
    })
}
