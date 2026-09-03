// Running a command in a test, the way a terminal runs it.
//
// The command line is real: it goes through the same trees that declare the commands and
// write the help (src/lib/cli/), so a test covers what a person would actually type — the
// options, their readers, and the refusals — and not only the function underneath.

import assert from 'node:assert/strict'

import { runAgent } from '../../src/lib/agent-cli.ts'
import { runBoard } from '../../src/lib/board-cli.ts'

// A refusal goes to stderr as one line. Holding it aside is what lets a test assert on the
// words rather than on an exit code, and lets a refusal read as a rejected promise.
async function refusalOf(argv: string[], work: () => Promise<number>): Promise<void> {
  let said: string | null = null
  const wasError = console.error
  console.error = (line: unknown) => {
    said ??= String(line)
  }
  let code: number
  try {
    code = await work()
  } finally {
    console.error = wasError
  }
  if (code !== 0) throw new Error(said ?? `\`${argv.join(' ')}\` refused`)
}

/** Run one board move against `root` and hand back its own fields. */
export async function move(root: string, argv: string[]): Promise<Record<string, unknown>> {
  let answered: Record<string, unknown> = {}
  await refusalOf(argv, () =>
    runBoard(argv, {
      program: 'kanban',
      cwd: root,
      version: null,
      onAnswer: (data) => {
        answered = data
      },
    }),
  )
  return answered
}

/** The same for `akb` itself — a run, a chat, `agent`, `cloud`, a guide. These print rather
 *  than return a value, so there is nothing to hand back. */
export async function run(root: string, argv: string[]): Promise<void> {
  await refusalOf(argv, () => runAgent(argv, { program: 'akb', cwd: root }))
}

/** A command line that is meant to refuse, checked against the words it refuses with. */
export async function refuses(root: string, argv: string[], pattern: RegExp): Promise<void> {
  await assert.rejects(() => move(root, argv), pattern)
}
