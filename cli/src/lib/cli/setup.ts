import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cmdUpdate } from '../../commands/update'
import { BoardError, say } from '../io'
import { SKILL_VERSION } from '../../version'
import { ctxOf, runAction, type Command } from './shared'
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

  dirOption(program.command('update'))
    .summary('修复已有看板并检查 CLI 新版本')
    .description('修复已有看板并提示 CLI 升级命令。没有看板时，请通过插件连接云端项目。')
    .action(async function (this: Command) {
      const dir = where(this)
      const named = (this.optsWithGlobals() as { board?: string }).board ?? process.env.AI4KANBAN_BOARD?.trim()
      const board = named ? path.resolve(cli.cwd, named) : null
      await runAction(ctxOf(this, cli.program), {}, () => cmdUpdate({ dir, program: cli.program, board }))
    })

  // 返回当前规则模块的位置。
  program.command('__rules', { hidden: true }).action(function () {
    say(fileURLToPath(import.meta.url))
  })
}
