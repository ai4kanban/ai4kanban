// The runs, and everything you do to one — declared onto `akb` (./akb.ts).
//
// `akb raw <move>` is the board's own bookkeeping (./board.ts). This is the other half:
// starting a run, steering it, talking to the agent, and setting up what the runs run on.
//
// Grouped by the thing each command acts on, because the words alone were ambiguous: `run`
// meant several things at once — a move on a card, the list of runs, and the agent
// process. So each noun holds its own verbs:
//
//   card <verb> <id>    the card on the board
//   delivery <verb>     the build in flight on one
//   run <verb>          the agent processes
//   triage <verb>       what is waiting to be sorted
//
// A command that acts on nothing yet is typed bare — `create`, `setup`.
//
// The flow commands are not written out here. They come from the board's own list of flows
// (../agent/flows.ts), which the dispatcher reads too — so a flow shipped later is a command
// and a help entry at once, with nothing to remember to add.

import { Option } from 'commander'

import { BoardError } from '../io'
import { KANBAN } from '../paths'
import { resolveBoard, sayIfRetiredPointer, useBoard } from '../board-cli'
import { FLOWS, flowVerb, type Flow, type FlowGroup, type FlowOption } from '../agent/flows'
import { namedDelivery } from '../agent/deliveries'
import type { DeliveryRecord } from '../agent/types'
import { HELP_AFTER } from '../agent/manual'
import { cmdAgent } from '../../commands/agent'
import { cloudImage, cloudMusic, cloudTts, cmdCloud } from '../../commands/cloud'
import { cloudImport } from '../../commands/cloud-import'
import {
  templateDelete,
  templateGet,
  templatePreview,
  templatePublish,
  templateShowcase,
  templateSearch,
  templateSource,
  templateTags,
} from '../../commands/cloud-template'
import { cmdGuide } from '../../commands/guide'
import {
  cmdWorkflowDelete,
  cmdWorkflowDuplicate,
  cmdWorkflowList,
  cmdWorkflowNew,
  cmdWorkflowRename,
  cmdWorkflowSchedule,
  cmdWorkflowAgent,
  cmdWorkflowWorktree,
  type WorkflowOptions,
} from '../../commands/workflow'
import {
  cmdAnswered,
  cmdBlocked,
  cmdCancel,
  cmdDiscard,
  cmdResumeDelivery,
  cmdLog,
  cmdResume,
  cmdRuns,
  cmdReject,
  cmdRunScheduled,
  cmdStartRun,
  cmdStop,
  cmdSubStart,
  cmdSubWait,
  cmdWatch,
} from '../../commands/run'
import {
  cmdTriageAdd,
  cmdTriageArchive,
  cmdTriageCheck,
  cmdTriageDismiss,
  cmdTriageFetch,
  cmdTriageRestore,
} from '../../commands/triage'
import { cmdIdeaWorkflows, ideasFile } from '../../commands/idea'
import { cmdSpec } from '../../commands/spec'
import { cmdTelemetry } from '../../commands/telemetry'
import { cardId, ctxOf, intInRange, oneOf, runAction, withShared, type Command } from './shared'
import type { AkbCliOptions } from './akb'

/** What the door hands in — see `runAgent`. */
export type AgentCliOptions = AkbCliOptions

// Every command here works on one board, so finding it is done once rather than in each.
// The account half of `cloud` is the exception: the Cloud sign-in belongs to the machine
// rather than to any one project (#326).
//
// `guide` is a half-exception (#407). Its text is the board's — the solution picks which
// words, and the board's own path is written into them — so it opens one when there is one,
// and answers from the shipped text when there isn't. A flow has to be readable in a folder
// that holds no board at all: that is how someone reads one before installing anything.
async function onBoard(
  cmd: Command,
  cli: AgentCliOptions,
  work: (program: string) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void,
): Promise<void> {
  const ctx = ctxOf(cmd, cli.program)
  // `board:` is read INSIDE the work: which board this is is only settled by `useBoard`
  // below, and a field read beside `runAction` names whichever board came before (#407).
  await runAction(ctx, {}, async () => {
    const found = resolveBoard('runs', { board: ctx.board, dir: ctx.dir, cwd: cli.cwd, installHint: cli.installHint })
    useBoard(found, ctx.dir !== null)
    sayIfRetiredPointer(found.root)
    return { board: KANBAN, ...((await work(cli.program)) ?? {}) }
  })
}

// Inside an idea conversation (#2073) the workflows are the workspace's, and there is no board.
const workflowList = (cmd: Command, cli: AgentCliOptions) =>
  ideasFile() ? boardless(cmd, cli, () => cmdIdeaWorkflows()) : onBoard(cmd, cli, () => cmdWorkflowList())

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
  // ---- the nouns, and the flows under them ----------------------------------
  //
  // Declared before the flows so the nouns head the help in this order, and so a flow only
  // has to say which noun it belongs to.

  const noun = (name: string, summary: string, description?: string): Command => {
    const cmd = withShared(program.command(name)).summary(summary)
    if (description) cmd.description(description)
    // A noun on its own is a question, not a command: answer it with its own verbs rather
    // than with "missing subcommand".
    return cmd.action(function (this: Command) {
      this.help()
    })
  }

  const groups: Record<FlowGroup | 'run', Command> = {
    card: noun(
      'card',
      'one card: build it, sharpen it, change it, finish it',
      'Every verb here takes the card’s id. A card with a delivery in flight refuses all of them but ' +
        `\`implement\` — \`${cli.program} delivery cancel\` is what hands it back.`,
    ),
    delivery: noun(
      'delivery',
      'the build in flight on a card',
      'Each verb takes the delivery, or the card it is on. The board runs `conflict` itself; the ' +
        'rest are yours.',
    ),
    run: noun(
      'run',
      'the agent processes — what is going, and what went',
      'A run is one agent working once. A delivery is made of several, so ending a run leaves the ' +
        `delivery in flight — \`${cli.program} delivery cancel\` is what ends that.`,
    ),
    // What is waiting to be sorted (#453, #499).
    triage: noun(
      'triage',
      'what is waiting to be sorted',
      'What is in triage is not a task: it never enters the card list, is never scheduled, ' +
        'and counts towards nothing. Triage is `docs/kanban/triage/`, one file each, with ' +
        '`archived/` for what became a card and `dismissed/` for what was ignored — what holds ' +
        'a later pull off. The board UI is where items are read, made into cards, ignored and ' +
        'restored.',
    ),
  }

  for (const flow of FLOWS) declareFlow(flow.group ? groups[flow.group] : program, flow, cli)

  // Rejecting starts no run (#1497): the card is filed on the spot.
  withShared(groups.card.command('reject'))
    .argument('<id>', "the card's id", cardId)
    .argument('[why...]', 'why the card is being dropped — required unless --discard')
    .summary('drop the card')
    .option('--discard', 'just drop it: the why may be left off, and nothing learns from it')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [id, why] = positional(vals) as [number, string[]]
      await onBoard(this, cli, () => cmdReject(id, why.join(' '), this.opts()))
    })

  declareRunning(groups.run, cli)
  declareDelivery(groups.delivery, cli)

  // What a delivery is belongs under the noun it is about, not on the root list.
  groups.delivery.addHelpText('after', HELP_AFTER.deliveries(cli.program))

  // ---- a named agent that fills one part of a card's spec --------------------

  withShared(program.command('spec'))
    .argument('[agent]', 'which spec agent; left off, the agents this board has are listed')
    .argument('[id]', 'the card to put it on', cardId)
    .argument('[note...]', 'what the flow wants looked at')
    .summary("a named agent that fills one part of a card's spec")
    .description(
      'Fill one part of a card spec. Use --print to follow the specialist instructions in the current ' +
        'session. Without --print, start a separate run; inside a board run, queue it until that run ends.',
    )
    .option('-f, --follow', 'watch its log instead of returning')
    .option('--notes <text>', 'what the flow wants looked at, for a caller building a command')
    .option('--print', 'print specialist instructions and work in this session')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [agent, id, note] = positional(vals) as [string | undefined, number | undefined, string[]]
      await onBoard(this, cli, (p) => cmdSpec({ agent, id, note, ...this.opts() }, p))
    })

  // ---- the agent that runs them ---------------------------------------------

  declareAgent(program, cli)

  // ---- what is waiting to be sorted (#453, #499) ----------------------------
  //

  const triage = groups.triage

  withShared(triage.command('fetch'))
    .summary('pull what the board is pointed at into triage')
    .description(
      'Reads the endpoint from `- **Triage endpoint** — <url>` in the board’s `config.md` and its ' +
        'token from `TRIAGE_ENDPOINT_TOKEN` in `docs/kanban/.env`, and takes everything that comes ' +
        'back. Only `title` and `summary` are required. Something already waiting, already made into ' +
        'a card, or already ignored is skipped; one with no words in it is counted and explained. ' +
        'A request that fails ' +
        'writes nothing at all.',
    )
    .action(async function (this: Command) {
      await onBoard(this, cli, () => cmdTriageFetch())
    })

  withShared(triage.command('add'))
    .summary('write one item into triage')
    .description(
      'One item, from words you already have — no endpoint, and nothing is pulled. The body is ' +
        '`--text` for a line or two, `--file <path>` when it is longer. `--source` says where it came ' +
        'from, and a reflection puts the card that prompted it there. It is not a task: it waits in ' +
        'triage until somebody sorts it. One already waiting, or already made into a card, is refused ' +
        'and told where it is; one only ignored is taken, and its `dismissed/` record is left alone.',
    )
    .requiredOption('--title <text>', 'what it is, in one line')
    .option('--text <text>', 'its own words')
    .option('--file <path>', 'its own words, written to a file first')
    .option('--source <text>', 'where it came from')
    .requiredOption('--workflow <id>', 'the workflow that does it (`akb workflow list`); the card made of it runs on it')
    .option('--slug <slug>', 'a short English name for its file, and for the card it becomes (default: from the title)')
    .action(async function (this: Command) {
      await onBoard(this, cli, () => cmdTriageAdd(this.opts()))
    })

  withShared(triage.command('check'))
    .summary('where triage already holds one source id')
    .description(
      'Scans triage, `archived/` and `dismissed/` for the id and answers `pending`, `archived`, ' +
        '`dismissed` or `unseen`, with the file that says so. Hit in more than one place, the first ' +
        'of those wins. This is the rule the pull and both ways of adding read — a pull is held off ' +
        'by all three, an add by everything but a dismissal.',
    )
    .argument('<source-id>', 'the id to look for')
    .action(async function (this: Command, sourceId: string) {
      await onBoard(this, cli, () => cmdTriageCheck(sourceId))
    })

  withShared(triage.command('archive'))
    .summary('record that a card was made of one item')
    .description(
      'The second half of one judgement: write the card first, then name it here. The item moves to ' +
        '`archived/` carrying `card_id` and `archived_at`. One already ignored keeps its `dismissed/` ' +
        'record and takes the card id onto it — the card exists either way. One that has left the list ' +
        'some other way is refused: somebody else judged it first.',
    )
    .argument('<source-id>', 'the item the card was made of')
    .requiredOption('--card <id>', 'the card it became', cardId)
    .action(async function (this: Command, sourceId: string) {
      await onBoard(this, cli, () => cmdTriageArchive(sourceId, Number(this.opts().card)))
    })

  withShared(triage.command('dismiss'))
    .summary('ignore one item, with the reason')
    .description(
      "The agent's own Ignore — the record carries `dismissed_by: agent` and the reason. The file " +
        'moves to `dismissed/`, so no later pull brings it back; `restore` puts it back in the list.',
    )
    .argument('<source-id>', 'the item to ignore')
    .requiredOption('--reason <why>', 'why it is not worth a card')
    .action(async function (this: Command, sourceId: string) {
      await onBoard(this, cli, () => cmdTriageDismiss(sourceId, String(this.opts().reason)))
    })

  withShared(triage.command('restore'))
    .summary('put one ignored item back in the list')
    .description(
      'Moves the item from `dismissed/` back to `triage/` and clears its dismissal. Refused when a card ' +
        'was already made of it, or the same id is already waiting. Starts no sort.',
    )
    .argument('<source-id>', 'the ignored item')
    .action(async function (this: Command, sourceId: string) {
      await onBoard(this, cli, () => cmdTriageRestore(sourceId))
    })

  // ---- Cloud ----------------------------------------------------------------

  const cloud = withShared(program.command('cloud'))
    .summary('the account this MACHINE acts as')
    .description(
      'A sign-in is started in the WildCrane app, under Configuration → Cloud, and nowhere else: ' +
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
    .summary('import this board into an empty Cloud project')
    .description(
      'Imports the open cards, memory, rules and own workflows of this board into an empty Cloud project, ' +
        'numbered from 1 in the order of their ids. Checks everything first and writes nothing on a problem; ' +
        'changes nothing on this computer. Run again to finish an import that stopped.',
    )
    .option('--project <id-or-prefix>', 'the Cloud project, by id or by its prefix')
    .option('--dry-run', 'only check, and list what would be imported and what stays here')
    .action(async function (this: Command) {
      const o = this.opts() as { project?: string; dryRun?: boolean }
      await onBoard(this, cli, (p) => cloudImport({ project: o.project, dryRun: o.dryRun }, p))
    })

  // Options are read in the handler, not required by Commander, so a missing one exits 2.
  withShared(cloud.command('image'))
    .argument('[prompt...]', 'what to draw')
    .summary('generate an image through Cloud, spending Pro credits')
    .option('--aspect <ratio>', 'the aspect ratio, e.g. 16:9')
    .option('--tier <tier>', 'economy, standard (default) or premium; a higher tier costs more credits')
    .option('--ref <file>', 'a PNG, JPEG or WebP to draw from; repeat for more', (v: string, all: string[]) => [...all, v], [])
    .option('--out <file>', 'where to write the image')
    .action(async function (this: Command, prompt: string[]) {
      const o = this.opts() as { aspect?: string; tier?: string; ref: string[]; out?: string }
      await boardless(this, cli, (p) =>
        cloudImage({ aspect: o.aspect, tier: o.tier, refs: o.ref, out: o.out, prompt: prompt.join(' ') }, p),
      )
    })

  withShared(cloud.command('tts'))
    .argument('[text...]', 'what to say')
    .summary('generate narration in a hosted voice, spending Pro credits')
    .option('--voice <name>', 'a hosted voice')
    .option('--tier <tier>', 'standard (default) for drafts and samples, premium for the final video')
    .option('--out <file>', 'where to write the audio; a Chinese voice writes .mp3')
    .action(async function (this: Command, text: string[]) {
      const o = this.opts() as { voice?: string; tier?: string; out?: string }
      await boardless(this, cli, (p) => cloudTts({ voice: o.voice, tier: o.tier, out: o.out, text: text.join(' ') }, p))
    })

  withShared(cloud.command('music'))
    .argument('[prompt...]', 'the music to make')
    .summary('generate an instrumental track through Cloud, spending Pro credits')
    .option('--seconds <n>', 'how long the track runs')
    .option('--out <file>', 'where to write the audio')
    .action(async function (this: Command, prompt: string[]) {
      const o = this.opts() as { seconds?: string; out?: string }
      await boardless(this, cli, (p) =>
        cloudMusic({ seconds: o.seconds, out: o.out, prompt: prompt.join(' ') }, p),
      )
    })

  // The shared template catalog (#1708). Options are read in the handlers, so a missing one exits 2.
  const template = withShared(cloud.command('template'))
    .summary('the shared UI and video template catalog')
    .action(function (this: Command) {
      this.help()
    })

  withShared(template.command('list-tags'))
    .summary("a category's tags, with how many templates carry each")
    .option('--category <category>', 'ui, video, …')
    .action(async function (this: Command) {
      await boardless(this, cli, (p) => templateTags(this.opts() as { category?: string }, p))
    })

  withShared(template.command('search'))
    .argument('[words...]', 'topic words that rank the matches')
    .summary('templates carrying a tag: metadata only, 5 by default, at most 10')
    .option('--category <category>', 'ui, video, …')
    .option('--tags <tags>', 'comma-separated tags')
    .option('--limit <n>', 'how many, at most 10')
    .action(async function (this: Command, words: string[]) {
      const o = this.opts() as { category?: string; tags?: string; limit?: string }
      await boardless(this, cli, (p) => templateSearch({ ...o, words }, p))
    })

  withShared(template.command('preview'))
    .argument('<name>', 'the template')
    .summary("download a template's catalog previews, as <name>-<file> unless already so named")
    .option('--to <dir>', 'the folder to write them into')
    .action(async function (this: Command, name: string) {
      await boardless(this, cli, (p) => templatePreview(name, this.opts() as { to?: string }, p))
    })

  withShared(template.command('get'))
    .argument('<name>', 'the template')
    .summary('download every file of a template, checked against the catalog')
    .option('--to <dir>', 'the folder to write it into; existing files are never overwritten')
    .action(async function (this: Command, name: string) {
      await boardless(this, cli, (p) => templateGet(name, this.opts() as { to?: string }, p))
    })

  withShared(template.command('source'))
    .argument('<name>', 'the template')
    .summary("where a template came from, and the evidence captured at the time")
    .option('--to <dir>', 'download the evidence into this folder')
    .action(async function (this: Command, name: string) {
      await boardless(this, cli, () => templateSource(name, this.opts() as { to?: string }))
    })

  withShared(template.command('publish'))
    .argument('<dir>', "the template's folder, holding template.md")
    .summary('publish a template (maintainers only)')
    .option('--preview <file>', 'a catalog preview image, kept outside the folder; repeat for more', (v: string, all: string[]) => [...all, v], [])
    .option('--evidence <file>', "a capture of the reference, kept outside the folder; repeat for more", (v: string, all: string[]) => [...all, v], [])
    .option('--replace', 'replace the template already published under this name')
    .action(async function (this: Command, dir: string) {
      const o = this.opts() as { preview: string[]; evidence: string[]; replace?: boolean }
      await boardless(this, cli, () => templatePublish(dir, o))
    })

  withShared(template.command('showcase'))
    .argument('<name>', 'the published template')
    .argument('<dir>', 'a folder holding showcase.json and the files it names')
    .summary("set what wildcrane.ai/templates shows for a template (maintainers only)")
    .action(async function (this: Command, name: string, dir: string) {
      await boardless(this, cli, () => templateShowcase(name, dir))
    })

  withShared(template.command('delete'))
    .argument('<name>', 'the template')
    .summary('take a template out of the catalog (maintainers only)')
    .action(async function (this: Command, name: string) {
      await boardless(this, cli, () => templateDelete(name))
    })

  // ---- optional usage reporting ---------------------------------------------

  const telemetry = withShared(program.command('telemetry'))
    .summary('whether this MACHINE reports anonymous usage')
    .description(
      'On unless it is turned off, for the app and for every `akb` on this machine — one answer, held ' +
        'outside every repository like the Cloud sign-in. The app asks once in an onboarding step; this ' +
        'never prompts, so a terminal-only user turns it off here. What is sent, and how to have it ' +
        'deleted: https://wildcrane.ai/privacy',
    )
    .action(async function (this: Command) {
      await boardless(this, cli, (p) => cmdTelemetry([], p))
    })

  for (const move of ['status', 'on', 'off'] as const) {
    withShared(telemetry.command(move))
      .summary(
        move === 'status'
          ? 'what this machine reports, and the install id its reports carry'
          : `turn reporting ${move}`,
      )
      .action(async function (this: Command) {
        await boardless(this, cli, (p) => cmdTelemetry([move], p))
      })
  }

  // ---- the workflows a card runs through (#715) -----------------------------

  const workflow = withShared(program.command('workflow'))
    .summary('the workflows this board runs, and the agents each one lists')
    .description(
      'Every card runs through one workflow: previews approved by you, each waiting on the approvals its ' +
        '`after` names, then the agents that land the work, after which the card is archived; with none, the ' +
        'last approval archives it. A card chooses its previews when first planned. The built-ins can have their agents ' +
        'switched, and can be copied but not renamed or deleted. A card names its workflow in its own frontmatter ' +
        '(`akb raw create --workflow`), and a delivery freezes the one it started with.',
    )
    .action(async function (this: Command) {
      await workflowList(this, cli)
    })

  const flowWord = (name: string) => withShared(workflow.command(name))

  flowWord('list')
    .summary('every workflow on this board, with its previews and what each waits on, land and scheduled agents')
    .action(async function (this: Command) {
      await workflowList(this, cli)
    })

  flowWord('new')
    .argument('<name...>', 'what to call it, in your own words')
    .summary('add a workflow of this board\'s own, with no agents')
    .action(async function (this: Command, name: string[]) {
      await onBoard(this, cli, () => cmdWorkflowNew(name.join(' ')))
    })

  flowWord('duplicate')
    .argument('<id>', 'the workflow to copy, from `workflow list`')
    .summary('copy one, with a copy of each of its agents')
    .description(
      'The copy is this board\'s own whatever it was copied from, so it can be renamed and deleted. Every agent ' +
        'in it but a built-in role is copied under a new name — instructions, rule, memory and settings — and ' +
        'keeps whether it is on, so the two workflows never share one.',
    )
    .action(async function (this: Command, id: string) {
      await onBoard(this, cli, () => cmdWorkflowDuplicate(id))
    })

  flowWord('rename')
    .argument('<id>', 'the workflow to rename, from `workflow list`')
    .argument('<name...>', 'what to call it now')
    .summary('rename one this board added')
    .description('Its id does not move, so every card and every finished delivery on it is unmoved too.')
    .action(async function (this: Command, id: string, name: string[]) {
      await onBoard(this, cli, () => cmdWorkflowRename(id, name.join(' ')))
    })

  flowWord('worktree')
    .argument('<id>', 'the workflow, from `workflow list`')
    .argument('<state>', 'on | off')
    .summary('whether one this board added builds in a Git worktree')
    .description(
      'On: each delivery builds on a branch of its own and lands it — for code. Off, the default for a new ' +
        'workflow: it works in the project, commits nothing, and ends on the files its card records. Only ' +
        'deliveries started afterwards follow it.',
    )
    .action(async function (this: Command, id: string, state: string) {
      await onBoard(this, cli, () => cmdWorkflowWorktree(id, state))
    })

  flowWord('delete')
    .argument('<id>', 'the workflow to delete, from `workflow list`')
    .summary('drop one this board added')
    .description('Refused while an open card still runs on it — move those cards first.')
    .action(async function (this: Command, id: string) {
      await onBoard(this, cli, () => cmdWorkflowDelete(id))
    })

  flowWord('agent')
    .argument('<id>', 'the workflow, from `workflow list`')
    .option('--on <agent>', 'switch one of its previews or land agents on; an agent no workflow lists joins the end of its previews')
    .option('--off <agent>', 'switch one off; it stays in the workflow')
    .option('--extra <text>', 'what the --on or --off agent is asked for here, on top of its own instructions')
    .summary('switch one of its previews or land agents on or off')
    .description(
      'An agent belongs to the workflow it was created in and is never shared; an off agent never runs. ' +
        'Rounds and land are written in the workflow\'s own WORKFLOW.md.',
    )
    .action(async function (this: Command, id: string) {
      const flags = this.opts() as WorkflowOptions
      await onBoard(this, cli, () => cmdWorkflowAgent(id, flags))
    })

  flowWord('schedule')
    .argument('<id>', 'the workflow, from `workflow list`')
    .option('--on <agent>', "switch one of this workflow's scheduled agents on")
    .option('--off <agent>', 'switch one off; it stays in the workflow')
    .option('--cadence <cadence>', 'how often the --on agent runs, e.g. 6h, 1d, 1d at 09:30, or auto (the default)')
    .option('--extra <text>', 'what the --on or --off agent is asked for here, on top of its own instructions')
    .option('--run <agent>', 'start one run of it now, due or not')
    .summary("switch a workflow's scheduled agents, set how often each runs, or run one now")
    .description(
      'With no change asked for, it lists them with their cadence and last run. A scheduled agent is listed ' +
        'under its workflow\'s `scheduled` and runs by itself on no card — in `auto`, when what its `akb.reads` names has ' +
        'something new; what it changes is committed and landed like a build.',
    )
    .action(async function (this: Command, id: string) {
      const flags = this.opts() as WorkflowOptions
      await onBoard(this, cli, () => cmdWorkflowSchedule(id, flags))
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
      const ctx = ctxOf(this, cli.program)
      try {
        useBoard(resolveBoard('guide', { board: ctx.board, dir: ctx.dir, cwd: cli.cwd, installHint: cli.installHint }), ctx.dir !== null)
      } catch {
        // No board here, or a half-made one. The shipped text still reads.
      }
      await boardless(this, cli, (p) => cmdGuide(topic, p))
    })

  // The watcher's own door. Not a command anyone types — `akb card implement 12` spawns it — and
  // spelled so it can never be mistaken for one.
  program
    .command('__watch', { hidden: true })
    .argument('<sessionId>')
    .action(async function (this: Command, sessionId: string) {
      const ctx = ctxOf(this, cli.program)
      const found = resolveBoard('runs', { board: ctx.board, dir: ctx.dir, cwd: cli.cwd, installHint: cli.installHint })
      useBoard(found, ctx.dir !== null)
      // The watcher runs for as long as the agent does, writes its own log, and says nothing
      // to anyone. It never collects prose and never answers in JSON.
      const code = await cmdWatch(sessionId)
      if (code !== 0) throw new BoardError(`the watcher for ${sessionId} ended with ${code}`, { kind: 'watch-failed' })
    })
}

const RUN_ID = "a run's id, any prefix of one that names only one run, or `last`. Left out, it means the newest run"
const DELIVERY = 'the delivery, or the card it is on'

// ---- akb card run <verb> -------------------------------------------------------------------

/** The agent processes: what is going, what went, and steering one. */
function declareRunning(run: Command, cli: AgentCliOptions): void {
  const verb = (name: string) => withShared(run.command(name))

  verb('list')
    .summary('what is running, and what ran lately')
    .option('-c, --card <id>', 'only the runs on that card', cardId)
    .option('-a, --all', 'every run this board has kept, not just the last ten')
    .action(async function (this: Command) {
      await onBoard(this, cli, (p) => cmdRuns(this.opts(), p))
    })

  verb('start')
    .argument('[prompt...]', 'what the sub-run should do')
    .summary('start a sub-run of the run you are inside, and return its id')
    .description(
      'Only an agent inside a run can, and a sub-run cannot start its own. It works in the same folder as the ' +
        'same agent, has its own log and cost, and is stopped when its parent ends.',
    )
    .option('--runtime <id>', "the runtime it runs on (default: the parent's)")
    .option('--file <path>', 'read the prompt from this file')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [words] = positional(vals) as [string[]]
      await onBoard(this, cli, () => cmdSubStart(words ?? [], this.opts()))
    })

  verb('wait')
    .argument('[id...]', "sub-runs of the run you are inside; left out, all of them")
    .summary("wait up to 90 seconds for this run's sub-runs to end")
    .description('Each one that ended is given with its status and last message; the ones still running are listed. Call it again until none are.')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [ids] = positional(vals) as [string[]]
      await onBoard(this, cli, () => cmdSubWait(ids ?? []))
    })

  verb('log')
    .argument('[id]', RUN_ID, String)
    .summary("one run's log")
    .option('-f, --follow', 'keep printing it until the run ends')
    .option('--events', 'with --follow: print its structured events, one JSON object per line')
    .option('--full', 'all of it, rather than the tail')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [id] = positional(vals) as [string | undefined]
      await onBoard(this, cli, (p) => cmdLog(id, this.opts(), p))
    })

  verb('stop')
    .argument('[id]', RUN_ID, String)
    .summary('end a run')
    .description('Its half-finished edits are left in the working tree — the board never undoes work.')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [id] = positional(vals) as [string | undefined]
      await onBoard(this, cli, () => cmdStop(id))
    })

  verb('resume')
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
}

// ---- akb delivery <verb> --------------------------------------------------------------

/** What you do to a build in flight, or to one that stopped. `conflict` is a flow and is
 *  declared with the rest of them; these start nothing. */
function declareDelivery(delivery: Command, cli: AgentCliOptions): void {
  const verb = (name: string) => withShared(delivery.command(name))

  verb('answered')
    .argument('<delivery>', DELIVERY)
    .summary('say what a round of applied answers did to its requirements')
    .description(
      'Written by the run that put the answers on the card, before it drops the questions — it read both the ' +
        'question and what it wrote, so it is the one thing that can tell a confirmation from a change. The ' +
        'landing queue reads this and never the card’s text. Exactly one of ' +
        'the two flags, each with its own one-line reason.',
    )
    .addOption(
      new Option('--unchanged <why>', 'nothing it was approved to build moved — the delivery carries on').conflicts(
        'changed',
      ),
    )
    .option('--changed <why>', 'a requirement was added, dropped or changed — the board reopens it on the new card')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [named] = positional(vals) as [string]
      await onBoard(this, cli, () => cmdAnswered(named, this.opts()))
    })

  verb('blocked')
    .argument('<delivery>', DELIVERY)
    .argument('<why...>', 'what is in the way, in one sentence')
    .summary('stop its landing: the moved target branch and it cannot be made to work together')
    .description(
      'Written by the run fitting the delivery onto the moved target branch, when it cannot compose both ' +
        'sides confidently or the checks still fail. The delivery waits on you with the reason, and nothing retries it.',
    )
    .action(async function (this: Command, ...vals: unknown[]) {
      const [named, why] = positional(vals) as [string, string[]]
      await onBoard(this, cli, () => cmdBlocked(named, why))
    })

  verb('cancel')
    .argument('<delivery>', DELIVERY)
    .summary('end it and hand the card back')
    .description(
      'Cancelling gives the delivery up, so its worktree and branch go with it. To pause instead, stop its ' +
        'run — the delivery stays, and `resume` carries it on.',
    )
    .action(async function (this: Command, ...vals: unknown[]) {
      const [named] = positional(vals) as [string]
      await onBoard(this, cli, () => cmdCancel(named))
    })

  verb('resume')
    .argument('<delivery>', DELIVERY)
    .summary('carry one on that stopped short, from where it stopped')
    .description(
      'Its worktree, branch and approved requirements all stay as they are — finished steps are ' +
        'never redone. Work that has already reached the target branch under another commit ends the ' +
        'delivery on that commit instead of landing it twice.',
    )
    .action(async function (this: Command, ...vals: unknown[]) {
      const [named] = positional(vals) as [string]
      await onBoard(this, cli, () => cmdResumeDelivery(named))
    })

  verb('discard')
    .argument('<delivery>', DELIVERY)
    .summary('end it AND throw its worktree and branch away')
    .description("What the card page's Discard does. This is the one command here that loses work.")
    .option('-y, --yes', 'go ahead; without it, it only says what would be lost')
    .action(async function (this: Command, ...vals: unknown[]) {
      const [named] = positional(vals) as [string]
      await onBoard(this, cli, () => cmdDiscard(named, this.opts()))
    })
}

// ---- one flow -----------------------------------------------------------------------

// Every flow is the same command with a different name: what it takes comes off the flow's
// own entry, and `--print` and `--follow` are added to all of them. It is declared onto the
// noun it acts on (`parent`), or onto `akb` itself when it acts on nothing yet.
function declareFlow(parent: Command, flow: Flow, cli: AgentCliOptions): void {
  // A `delivery` verb answers to the delivery as well as to the card it is on, so the id is
  // taken as written and read once the board is open — before that there is no record to
  // look a delivery up in. What it is read INTO is the delivery itself (#428): a build with
  // no card has no id to be resolved to, and a carded one is found by its delivery just the
  // same.
  const byDelivery = flow.group === 'delivery'
  const cmd = withShared(parent.command(flowVerb(flow)))
  for (const arg of splitArgs(flow.argument)) {
    cmd.argument(arg, argNote(arg, flow), arg.startsWith('<id') ? (byDelivery ? String : cardId) : undefined)
  }
  cmd.summary(flow.gloss)
  if (flow.more?.length) cmd.description(`${sentence(flow.gloss)} ${flow.more.join(' ')}`)
  for (const option of flow.options ?? []) addFlowOption(cmd, option)
  cmd
    .addOption(new Option('-p, --print', 'say what to do and start nothing').conflicts('follow'))
    .option('-f, --follow', 'watch the log instead of returning')
    .option('--events', 'with --follow: print its structured events, one JSON object per line')
    .addHelpText('after', HELP_AFTER.flow)
    .action(async function (this: Command, ...vals: unknown[]) {
      const args = positional(vals)
      await onBoard(this, cli, (p) =>
        cmdStartRun(flow.action, byDelivery ? [deliveryOf(args[0] as string), ...args.slice(1)] : args, this.opts(), p),
      )
    })
}

/** The delivery a `delivery` verb was aimed at — named by its own id, by a prefix of one, or
 *  by the card it is on. The run carries the delivery from here, so a build with no card
 *  (#428) reaches its conflict run exactly as a carded one does. */
function deliveryOf(named: string): DeliveryRecord {
  const delivery = namedDelivery(named)
  if (!delivery) throw new BoardError(`no delivery here answers to "${named}"`, { kind: 'unknown-delivery' })
  return delivery
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
  if (arg.startsWith('<id')) return flow.group === 'delivery' ? DELIVERY : "the card's id"
  return flow.argumentNote ?? ''
}

const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`)

// ---- the connectors, and which one each agent runs -------------------------------------

function declareAgent(program: Command, cli: AgentCliOptions): void {
  const agent = withShared(program.command('agent'))
    .summary('what runs the board, and how it is set up')
    .description(
      'A RUNTIME is the whole answer to what a run runs as — harness, provider, endpoint, key, model id, ' +
        "reasoning and extra arguments. Every runtime's shape is YOURS, in the board's ui.config.json under " +
        ".akb/boards/; its key is one line per runtime in docs/kanban/.env. git carries neither. A run never " +
        "reads the terminal's environment for any of it.",
    )
    .action(async function (this: Command) {
      await onBoard(this, cli, () => cmdAgent(['show']))
    })

  const word = (name: string) => withShared(agent.command(name))

  word('list')
    .summary('the connectors it can run, and what each one takes')
    .action(async function (this: Command) {
      await onBoard(this, cli, () => cmdAgent(['list']))
    })

  word('use')
    .argument('<name>', 'a harness from `agent list`')
    .summary('the harness Global default runs')
    .description(
      'Global default is the first runtime, and what an agent naming none runs. Every other runtime is ' +
        'untouched.',
    )
    .action(async function (this: Command, name: string) {
      await onBoard(this, cli, () => cmdAgent(['use', name]))
    })

  const runtime = word('runtime')
    .summary('add, rename or delete a runtime')
    .description(
      'There is no "make default": the default is the FIRST row, Global default, which no board can ' +
        'rename or delete. A runtime’s id is generated from its name, keys its API key line in ' +
        'docs/kanban/.env, and never changes — so a rename costs nothing on any computer.',
    )
    .action(async function (this: Command) {
      await onBoard(this, cli, () => cmdAgent(['show']))
    })

  withShared(runtime.command('add'))
    .argument('<name>', 'what to call it — free text, unique on the board')
    .argument('<harness>', 'a harness from `agent list`')
    .summary('add one runtime')
    .action(async function (this: Command, name: string, harness: string) {
      await onBoard(this, cli, () => cmdAgent(['runtime', 'add', name, harness]))
    })

  withShared(runtime.command('rename'))
    .argument('<id>', 'the runtime’s id — `agent` lists them')
    .argument('<name...>', 'what to call it instead')
    .summary('rename one runtime, losing nothing')
    .action(async function (this: Command, id: string, name: string[]) {
      await onBoard(this, cli, () => cmdAgent(['runtime', 'rename', id, ...name]))
    })

  withShared(runtime.command('delete'))
    .argument('<id>', 'the runtime’s id — `agent` lists them')
    .summary('drop one runtime; the agents on it fall back to Global default')
    .action(async function (this: Command, id: string) {
      await onBoard(this, cli, () => cmdAgent(['runtime', 'delete', id]))
    })

  word('bind')
    .argument('<agent>', 'one of this board’s agents — `agent` lists them')
    .argument('<runtime>', 'a runtime id from `agent`; "-" puts it back on Global default')
    .summary('give one agent a runtime of its own')
    .description('The pick is yours, saved with your other board settings.')
    .action(async function (this: Command, name: string, id: string) {
      await onBoard(this, cli, () => cmdAgent(['bind', name, id]))
    })

  word('set')
    .argument('<key>', 'a setting the runtime’s harness takes — `agent` lists them')
    .argument('[value...]', 'the value; left off, the setting is cleared and the CLI’s own default runs')
    .option('--runtime <id>', 'which runtime to write; left off, Global default')
    .option('--agent <name>', 'the runtime that agent runs, instead of naming an id')
    .summary('one runtime setting, or its key')
    .description(
      'A key goes to docs/kanban/.env under that runtime’s own line, and is never echoed back: give the ' +
        'user the line and let them type it — a key an agent types lands in its transcript and in the ' +
        'shell history. Everything else is the board’s, on the row.',
    )
    .action(async function (this: Command, key: string, value: string[]) {
      const { agent: named, runtime: id } = this.opts<{ agent?: string; runtime?: string }>()
      await onBoard(this, cli, () =>
        cmdAgent([
          'set',
          ...(id ? ['--runtime', id] : []),
          ...(named ? ['--agent', named] : []),
          key,
          ...value,
        ]),
      )
    })

  // What a Runner starts once the agent is due by its own clock (#2068).
  word('run')
    .argument('<workflow>', 'a workflow id, e.g. coding')
    .argument('<agent>', 'one of the agents it schedules')
    .summary("run a workflow's scheduled agent once, now")
    .addOption(new Option('-p, --print', 'say what to do and start nothing').conflicts('follow'))
    .option('-f, --follow', 'watch the log instead of returning')
    .option('--events', 'with --follow: print its structured events, one JSON object per line')
    .action(async function (this: Command, workflow: string, name: string) {
      await onBoard(this, cli, (p) => cmdRunScheduled(workflow, name, this.opts(), p))
    })

  word('test')
    .argument('[runtime]', 'which runtime to test; left off, Global default')
    .summary('one small chat, to see the setup works')
    .action(async function (this: Command, id: string | undefined) {
      await onBoard(this, cli, () => cmdAgent(['test', ...(id ? [id] : [])]))
    })
}
