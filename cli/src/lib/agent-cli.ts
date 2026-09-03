// The door onto `akb` — everything but the board's own bookkeeping.
//
// The tree, the options and the help live in lib/cli/. What is here is the door: hand the
// command line to that tree, and hand back an exit code rather than ending the process —
// the caller may be the CLI, a board UI, or a test.
//
// `runAgent` and `runSetup` are the same door under two names. They were two dispatchers
// before the commands became one tree, and both are exported so a build of the UI or the
// desktop app that predates the merge still works.

import { buildAkbProgram } from './cli/akb'
import { runProgram } from './cli/shared'

export interface RunAgentOptions {
  program?: string
  cwd?: string
  installHint?: string
}

export async function runAgent(argv: string[], options: RunAgentOptions = {}): Promise<number> {
  const { program = 'akb', cwd = process.cwd(), installHint = '`akb install`' } = options
  return runProgram(buildAkbProgram({ program, cwd, installHint }), argv, program)
}
