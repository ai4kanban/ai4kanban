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
// `akb raw <move>` stays separate on purpose. Its moves take options that collide with
// these — `create`, `archive` and `reject` are words on both sides — so the loader hands
// that whole command line to the board's tree and this one never sees it.
//
// It is spelled `raw` because that is what it is: the file written, with no agent between
// you and it. Everything else here asks an agent to do the work and write the file itself.

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

  // Named so it is in the list and `akb help raw` says what it is. The loader routes the
  // word to the board's own tree before this one is asked, so the action is only ever
  // reached when that routing has gone wrong.
  program
    .command('raw')
    .argument('[move...]')
    .summary("write the board's files directly, with no agent: ids, a card's fields, the index")
    .description(
      `Every move: \`${cli.program} raw help\`. These are the agent's commands between runs — a person ` +
        'never has to type one. They own docs/kanban/next-id, a card’s frontmatter and metrics.csv, and ' +
        `they only write what they are told: \`${cli.program} raw archive 12\` files the card, where ` +
        `\`${cli.program} card archive 12\` puts an agent on it first.`,
    )
    .action(function () {
      throw new BoardError(`\`${cli.program} raw\` is a tree of its own — this command line never reached it.`, {
        kind: 'unreachable',
      })
    })

  return program
}
