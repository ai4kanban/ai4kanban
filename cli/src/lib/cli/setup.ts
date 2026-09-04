// `akb` itself: the command that sets a project up and moves it to a newer release, and the
// door onto the two trees under it.
//
// This is the tree `bin/ai4kanban.mjs` runs. The bin is a loader — it works out how the
// command was typed and where it is, then hands the whole command line here — so the
// declarations, the options and the help are written in one place with the rest.

import fs from 'node:fs'
import path from 'node:path'

import { cmdInstall, cmdSkill, cmdUpdate } from '../../commands/install'
import { BoardError, say } from '../io'
import { rulesPath } from '../skill/install'
import { SKILL_VERSION } from '../../version'
import { SOLUTIONS, type Solution } from '../solution'
import { ctxOf, oneOf, runAction, type Command } from './shared'
import type { AkbCliOptions } from './akb'


/** What the loader hands in. */
export type SetupCliOptions = AkbCliOptions

// One line, when this copy isn't `akb`, for the text that spells it `akb` throughout — the
// help, and the flows a `--print` hands over. Cheaper than rewriting either, and it holds for
// the lines inside them that this command never wrote.
const spelled = (program: string): string =>
  program === 'akb' ? '' : `\nThis copy isn't on your PATH as \`akb\` — every \`akb\` below is \`${program}\` here.\n`

/** Declare setting a project up, and moving it to a newer release, on `akb` (./akb.ts). */
export function declareSetup(program: Command, cli: SetupCliOptions): void {
  program.version(SKILL_VERSION, '-v, --version', 'print this version').addHelpText('beforeAll', spelled(cli.program))

  const dirOption = (cmd: Command) =>
    cmd
      .option('--dir <path>', 'the project to work on (default: the current folder)')
      .option('--json', 'answer as one JSON object instead of prose')

  const where = (cmd: Command): string => {
    const dir = path.resolve(String((cmd.optsWithGlobals() as { dir?: string }).dir ?? cli.cwd))
    if (!fs.existsSync(dir)) throw new BoardError(`no such folder: ${dir}`, { kind: 'no-such-folder', dir })
    return dir
  }

  // Where an install puts the board: `--board <dir>` against the working directory, or the
  // project's own `docs/kanban` (#407). Unlike every other command this one may name a
  // folder that isn't there yet — making it is the whole job.
  const boardOf = (cmd: Command): string | null => {
    const named = (cmd.optsWithGlobals() as { board?: string }).board
    return named ? path.resolve(cli.cwd, named) : null
  }

  dirOption(program.command('install'))
    .option('--board <dir>', 'put the board here instead of docs/kanban/ (relative to this folder)')
    .option('--solution <name>', `what this board's work is: ${SOLUTIONS.join(' | ')}`, oneOf(SOLUTIONS))
    .summary('scaffold docs/kanban/ — the board, and nothing else')
    .description(
      'Installing writes the board and nothing outside docs/kanban/. Driving that board from a coding ' +
        'agent is a later extra — `akb skill install`, or the button in the board UI under ' +
        'Configuration → Agent setup. Safe to run twice.',
    )
    .action(async function (this: Command) {
      const dir = where(this)
      const solution = (this.optsWithGlobals() as { solution?: string }).solution as Solution | undefined
      await runAction(ctxOf(this, cli.program), {}, () =>
        cmdInstall({ dir, program: cli.program, board: boardOf(this), solution }),
      )
    })

  const skill = dirOption(program.command('skill'))
    .summary('whether a coding agent can drive this board')
    .description('Bare, it says where the skill stands. The word that writes something is asked for by name.')
    .action(async function (this: Command) {
      const dir = where(this)
      await runAction(ctxOf(this, cli.program), {}, () => cmdSkill({ dir, program: cli.program }, null))
    })

  dirOption(skill.command('install'))
    .summary('add the skill, plus the commit guard')
    .description(
      'Writes SKILL.md into .claude/skills/kanban/ and .agents/skills/kanban/, plus the commit guard in ' +
        '.git/hooks/pre-commit. Safe to run twice.',
    )
    .action(async function (this: Command) {
      const dir = where(this)
      await runAction(ctxOf(this, cli.program), {}, () => cmdSkill({ dir, program: cli.program }, 'install'))
    })

  dirOption(skill.command('refresh'))
    .summary('rewrite a skill that is already here, and write none that is not')
    .description('How the note learns a new spelling of the command without a project gaining a skill it never asked for.')
    .action(async function (this: Command) {
      const dir = where(this)
      await runAction(ctxOf(this, cli.program), {}, () => cmdSkill({ dir, program: cli.program }, 'refresh'))
    })

  dirOption(program.command('update'))
    .summary('refresh an installed skill, repair an older board, and say if a newer command is out')
    .description(
      'Two things and nothing else: a newer command, and a board repaired to what this version expects. ' +
        'It cannot replace itself while it runs, so it names the line that does. Your cards, config and ' +
        'memory are left alone.',
    )
    .action(async function (this: Command) {
      const dir = where(this)
      await runAction(ctxOf(this, cli.program), {}, () => cmdUpdate({ dir, program: cli.program }))
    })

  // Where this command's copy of the board's rules is on disk, and nothing else on stdout.
  // The local UI asks for it once and imports what it names: a project carries no copy of the
  // rules any more (#213), so the installed command is what knows where they are. Never typed
  // by a person — hence the name.
  program.command('__rules', { hidden: true }).action(function () {
    say(rulesPath())
  })
}

