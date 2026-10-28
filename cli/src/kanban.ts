// The board's bookkeeping, as the one file every copy of it ships as.
//
// The rules live in this package's `src/`, in TypeScript, and are built into a single
// dependency-free file — `cli/dist/kanban.mjs` — by `scripts/build.mjs`. That one built
// file is what the npm package and the Runner carry. Edit the sources here; never the
// built file, which is not even in git.
//
// It is both a program and a module, because the same rules are reached two ways:
//   - run it (`node kanban.mjs <command>`) — the door `akb install` and the desktop app
//     open, with the same commands, words and exit codes it has always had,
//   - import it (`akb raw <move>`) — the CLI's door, which asks for the compact help
//     and puts the command's own name in front of a refusal.
//
// What the moves are, and what each one does, is `node kanban.mjs help`.
//
//   init | setup-done | setup-status                   the board itself
//   create | update | update-questions | tag | list    a card's fields
//   schedule                                           what a blocked card runs when freed
//   archive | reject | run | migrate                   taking a card off, and the rest
//
// It is the ONLY sanctioned writer of a card's frontmatter. Write/Edit are for a card's body.

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { runAgent } from './lib/agent-cli'
import { rawArgv, runBoard } from './lib/board-cli'
import { SKILL_VERSION } from './version'

// What `bin/ai4kanban.mjs` loads.
export { rawArgv, runAgent, runBoard }

const SELF = fileURLToPath(import.meta.url)

// True when this file IS the program, rather than something another program imported.
// Both sides are resolved through their real path first: this repo installs its own skill
// as a symlink, and the two spellings of the same file must still count as one.
function invokedDirectly(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return fs.realpathSync(entry) === fs.realpathSync(SELF)
  } catch {
    return false
  }
}

if (invokedDirectly()) {
  const argv = process.argv.slice(2)
  const raw = rawArgv(argv)
  // The one word this door answers that the board's moves don't: the process that watches
  // a run, spawned by whichever command started it. Spelled so it can never collide with a
  // move.
  if (argv[0] === '__watch') {
    void runAgent(argv, { program: 'akb' }).then((code) => {
      process.exitCode = code
    })
  } else if (raw || argv[0] === 'guide') {
    // The two doors every flow names by hand — `akb raw <move>` and `akb guide <topic>` —
    // answered here under the same spellings (#173). This file is the copy of the rules the
    // board is actually running, and a setup run is told to call it: without these, an
    // agent on a machine with no `akb` on its PATH would have to translate every line of
    // every flow into the legacy door below, or fetch a different version off npm.
    //
    // Neither word collides: there is no `raw` move and no `guide` move. The rest of the
    // run commands are deliberately left out — they DO collide (`create`, `archive`,
    // `reject` are board moves here), and a run never starts another run anyway.
    if (argv[0] === 'guide') {
      void runAgent(argv, { program: `node ${SELF}` }).then((code) => {
        process.exitCode = code
      })
    } else {
      void runBoard(raw ?? [], {
        program: `node ${SELF} raw`,
        version: `wildcrane ${SKILL_VERSION}`,
      }).then((code) => {
        process.exitCode = code
      })
    }
  } else {
    // Absolute, like the two doors above: what this prints is for a person to paste, and a
    // path relative to a working directory that may be anywhere runs from that one folder
    // and nowhere else.
    void runBoard(argv, {
      program: `node ${SELF}`,
      version: `wildcrane ${SKILL_VERSION}`,
    }).then((code) => {
      process.exitCode = code
    })
  }
}
