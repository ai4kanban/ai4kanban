// The board's bookkeeping, as the one file every copy of it ships as.
//
// The rules live in this package's `src/`, in TypeScript, and are built into a single
// dependency-free file — `cli/dist/kanban.mjs` — by `scripts/build.mjs`. That one built
// file is what the npm package carries, what the desktop app copies in, and what a board
// UI loads. Edit the sources here; never the built file, which is not even in git.
//
// It is both a program and a module, because the same rules are reached two ways:
//   - run it (`node kanban.mjs <command>`) — the door `akb install` and the desktop app
//     open, with the same commands, words and exit codes it has always had,
//   - import it (`akb board <move>`) — the CLI's door, which asks for the compact help
//     and puts the command's own name in front of a refusal.
//
// What the moves are, and what each one does, is `node kanban.mjs help`.
//
//   init | memory-init | setup-done | setup-status     the board itself
//   create | update | update-questions | tag | list    a card's fields
//   schedule                                           what a blocked card runs when freed
//   release new | goal | list | close | drop           the versions being planned
//   archive | reject | run | migrate | peek | metrics  taking a card off, and the rest
//
// It is the ONLY sanctioned writer of docs/kanban/next-id, of a card's frontmatter, and of
// docs/kanban/metrics.csv. Write/Edit are for a card's body.

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { rel } from './lib/paths'
import { runAgent } from './lib/agent-cli'
import { runBoard } from './lib/board-cli'
import { SKILL_VERSION } from './version'

export { runBoard } from './lib/board-cli'
export type { RunBoardOptions } from './lib/board-cli'
export { runAgent } from './lib/agent-cli'
export type { RunAgentOptions } from './lib/agent-cli'
export { SKILL_VERSION } from './version'

// The blank `docs/kanban/config.md`, and which of its settings a board's own config has
// never heard of. `init` seeds the file; `akb update` reads the second one to name a
// setting this release added. Exported because the config template stopped being a file
// in the installed folder — the command carries it now (lib/config-template.ts).
export { CONFIG_TEMPLATE, missingConfigKeys } from './lib/config-template'

// The coding agent skill: whether this project has one, and the move that adds it. Not
// part of installing a board (#174) — `akb install` scaffolds the board and stops there,
// and this is what the UI's button and `akb skill install` both call.
export { installSkill, readCommandState, readSkillState, rulesPath, NEWER_COMMAND_LINE } from './lib/skill/install'
export type * from './lib/skill/types'

// What a board UI reaches for: the same run engine `akb` drives, so a run started from a
// button and one started in a terminal are one thing — one record, one set of rules, one
// copy of the words each run sends the agent. Nothing here is a second implementation of
// anything the commands do.
export {
  getRun,
  listRuns,
  markSpawned,
  openResume,
  openRun,
  stopRun,
  titleOf,
} from './lib/agent/sessions'
export { spawnWatcher } from './lib/agent/launch'
export { buildPrompt } from './lib/agent/prompts'
export { agentInfo, activeSettings, setupInstruction, settingSaveError } from './lib/agent/resolve'
export { setHarness, setHarnessSetting, setSecret } from './lib/agent/settings'
export { testConnection } from './lib/agent/test'
export { setBoardRoot } from './lib/paths'
export type * from './lib/agent/types'

// …and the board itself: the columns, one card in full, the releases, the metrics, the
// setup checklist, the goal, the project's memory — plus every write a screen makes and the
// question the board's background timer asks each tick. One door (lib/view/api.ts), the same rules the commands
// run, so a button and a command can never disagree about what a card says.
export {
  allCards,
  clearSchedule,
  closePlan,
  closeRelease,
  dropPlan,
  dropRelease,
  fillPlan,
  findCard,
  finishSetupStep,
  newRelease,
  nextWork,
  patchCard,
  readBoard,
  readGoalText,
  readMemoryFile,
  readMetricsView,
  readModules,
  readReleases,
  readSetupDraft,
  readSetupState,
  saveGoal,
  saveProject,
  setCardsRelease,
  setReleaseGoal,
  setSchedule,
} from './lib/view/api'
export type { ReleaseFill } from './lib/view/api'
export type * from './lib/view/types'

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
  // The one word this door answers that the board's moves don't: the process that watches
  // a run, spawned by whichever command started it. Spelled so it can never collide with a
  // move — `run` has meant "record one pass of a recurring card" here since it existed.
  if (argv[0] === '__watch') {
    void runAgent(argv, { program: 'akb' }).then((code) => {
      process.exitCode = code
    })
  } else if (argv[0] === 'board' || argv[0] === 'guide') {
    // The two doors every flow names by hand — `akb board <move>` and `akb guide <topic>` —
    // answered here under the same spellings (#173). This file is the copy of the rules the
    // board is actually running, and a setup run is told to call it: without these, an
    // agent on a machine with no `akb` on its PATH would have to translate every line of
    // every flow into the legacy door below, or fetch a different version off npm.
    //
    // Neither word collides: there is no `board` move and no `guide` move. The rest of the
    // run commands are deliberately left out — they DO collide (`create`, `archive`,
    // `reject` are board moves here), and a run never starts another run anyway.
    if (argv[0] === 'guide') {
      void runAgent(argv, { program: `node ${SELF}` }).then((code) => {
        process.exitCode = code
      })
    } else {
      process.exitCode = runBoard(argv.slice(1), {
        program: `node ${SELF} board`,
        style: 'board',
        version: `ai4kanban ${SKILL_VERSION}`,
        usage: `node ${SELF} board <move> [args]`,
      })
    }
  } else {
    process.exitCode = runBoard(argv, {
      program: 'kanban',
      style: 'legacy',
      version: `ai4kanban ${SKILL_VERSION}`,
      usage: `node ${rel(SELF)} <command> [args]`,
    })
  }
}
