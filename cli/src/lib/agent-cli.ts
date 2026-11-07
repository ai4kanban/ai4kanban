// The door onto `akb` — everything but the board's own bookkeeping.
//
// The tree, the options and the help live in lib/cli/. What is here is the door: hand the
// command line to that tree, and hand back an exit code rather than ending the process —
// the caller may be the CLI, a board UI, or a test.
//
import { buildAkbProgram } from './cli/akb'
import { runProgram } from './cli/shared'
import { reportAppOpen } from './machine/usage'

/** The watcher's own door — spawned by whichever command started a run, never typed. */
const WATCH = '__watch'

export interface RunAgentOptions {
  program?: string
  cwd?: string
  installHint?: string
}

export async function runAgent(argv: string[], options: RunAgentOptions = {}): Promise<number> {
  const { program = 'akb', cwd = process.cwd(), installHint = '通过插件连接云端项目' } = options
  // The command started (#295) — the terminal's half of "how many people use this". Once a
  // day, never from an `akb` an agent typed inside a run, and never at all from a machine
  // that turned reporting off. It touches no board and blocks nothing.
  //
  // Except the watcher, which comes through this same door and is nobody opening anything:
  // the board spawns one per run on the environment that started it, so under the app —
  // where an open is counted on every launch rather than once a day — one run would be one
  // more person having opened it.
  const triggerQuery = argv.includes('previews') && argv.includes('--triggers')
  if (argv[0] !== WATCH && !triggerQuery) reportAppOpen()
  return runProgram(buildAkbProgram({ program, cwd, installHint }), argv, program)
}
