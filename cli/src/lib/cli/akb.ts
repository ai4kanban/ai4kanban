// `akb` — the whole command, in one tree.
//
// Setting a project up and starting runs on it used to be two dispatchers, because they
// lived in two files that could not see each other: `bin/ai4kanban.mjs` had no way to reach
// the built rules' own parsing, so it kept a second one. They are one program now, so
// `akb help` is every word the command answers to rather than half of them.
//
// It is declared in three files, one per family, and each of them only says what its own
// commands take:
//
//   ./setup.ts  install | skill | update  — the project
//   ./agent.ts  the flows, the runs in flight, the agent, Cloud, the guides
//   ./board.ts  the board's own bookkeeping, which is a tree of its own (see below)
//
// `akb board <move>` stays separate on purpose. Its moves take options that collide with
// these — `create`, `archive` and `reject` are words on both sides — so the loader hands
// that whole command line to the board's tree and this one never sees it.

import { declareRuns } from './agent'
import { declareSetup } from './setup'
import { BoardError } from '../io'
import { newCommand, withShared, type Command } from './shared'

export interface AkbCliOptions {
  /** How this command was reached, spelled so what it prints can be pasted straight back. */
  program: string
  cwd: string
  installHint: string
}

export function buildAkbProgram(cli: AkbCliOptions): Command {
  const program = withShared(newCommand(cli.program))
  program
    .description('set up a board, and put an agent to work on it.')
    .helpCommand('help [command]', 'this list, or one command in full')

  declareSetup(program, cli)
  declareRuns(program, cli)

  // Named so it is in the list and `akb help board` says what it is. The loader routes the
  // word to the board's own tree before this one is asked, so the action is only ever
  // reached when that routing has gone wrong.
  program
    .command('board')
    .argument('[move...]')
    .summary("the board's bookkeeping: ids, a card's fields, releases, the index")
    .description(
      `Every move: \`${cli.program} board help\`. Those are the agent's commands between runs — a person ` +
        'never has to type one. They own docs/kanban/next-id, a card’s frontmatter and metrics.csv.',
    )
    .action(function () {
      throw new BoardError(`\`${cli.program} board\` is a tree of its own — this command line never reached it.`, {
        kind: 'unreachable',
      })
    })

  return program
}
