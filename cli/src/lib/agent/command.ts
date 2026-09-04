// How this machine spells the board's own command.
//
// Everything written for an agent — the note in a skill folder, every flow, every prompt —
// spells it `akb`, because that is what a global install puts on the PATH. Plenty of
// machines have no such install: the desktop app carries its own copy, `npx` fetches one,
// and a source checkout builds one. On those, an agent told to type `akb` gets
// `command not found` and stops, which is not a state the board can leave it in.
//
// So there is one answer, asked for here: what to type instead. It is never `npx
// ai4kanban@latest` — what npm hands back is a different copy from the one running this
// board, and a board driven by two versions of its own rules is worse than one that is
// merely behind. The copy below is always here, always the version that started the run,
// and needs no network.

import fs from 'node:fs'
import path from 'node:path'

import { pathLookup } from './installed'
import { SELF } from './launch'
import { BOARD_FLAG, REPO_ROOT, rel } from '../paths'

/** This copy of the command, called by its path: the package's `bin/` script when it is
 *  beside the built rules — it answers every command a flow can name — and the built rules
 *  themselves otherwise, which answer `board` and `guide` (see `kanban.ts`).
 *
 *  Spelled relative to the project when it is a short hop inside it, the way every other
 *  path the board prints is: a source checkout says `node cli/bin/ai4kanban.mjs`, which is
 *  short enough to read in a line of prose and runs from where a board command is run
 *  anyway. Absolute otherwise — the board root is the working directory when no `--dir`
 *  named one and no board was found, and relative to `/` is the whole path with its leading
 *  slash gone, which is a line nobody can paste. */
function selfCommand(): string {
  const bin = path.resolve(path.dirname(SELF), '..', 'bin', 'ai4kanban.mjs')
  const file = fs.existsSync(bin) ? bin : SELF
  const inside = rel(file)
  const shortHop =
    !inside.startsWith('..') && !path.isAbsolute(inside) && inside.split(/[\\/]/).length <= 3
  return `node ${shortHop ? inside : file}`
}

/** The board's command as a run would find it — `akb` when it is on the PATH a run is
 *  spawned on, and this very copy when it isn't. */
export function boardCommand(): string {
  return pathLookup()('akb') ? 'akb' : selfCommand()
}

/** The board's command as a run working OUTSIDE the project folder has to type it: the
 *  command itself, and the flag naming the board it means (#303) — `--dir <project>` for the
 *  project's own `docs/kanban`, `--board <dir>` for a board anywhere else (#407).
 *
 *  A delivery with a worktree of its own works in `.akb/worktrees/…`, where a relative
 *  `node cli/bin/…` would run that worktree's copy of the command — a copy the delivery may
 *  be halfway through rewriting — and where a board command with no flag is one folder
 *  layout away from finding no board at all. Both are settled by saying which board, once,
 *  in the words the run is given.
 *
 *  `cardId` only names what the flow is about; the answer is the same for every card. */
export function boardCommandFor(_cardId?: number): string {
  const command = pathLookup()('akb') ? 'akb' : `node ${absoluteSelf()}`
  return `${command}${BOARD_FLAG || ` --dir ${REPO_ROOT}`}`
}

// This copy of the command by its full path, whatever folder anything runs in.
function absoluteSelf(): string {
  const bin = path.resolve(path.dirname(SELF), '..', 'bin', 'ai4kanban.mjs')
  return fs.existsSync(bin) ? bin : SELF
}

/** How the note written into `root` should spell the command, worked out once at install
 *  time so the agent that reads it has nothing to look for.
 *
 *  `invoked` is how the CLI was actually typed, when the caller knows — and `npx` is the one
 *  form this can't work out for itself, because it puts an `akb` on the PATH of that process
 *  and nowhere else. A path is spelled relative to the project when it sits inside it: the
 *  note is committed, and `node cli/bin/ai4kanban.mjs` travels where an absolute path
 *  doesn't. */
export function noteCommand(root: string, invoked?: string): string {
  const command = invoked || boardCommand()
  if (!command.startsWith('node ')) return command
  const file = path.resolve(command.slice('node '.length))
  const near = path.relative(root, file)
  return `node ${near && !near.startsWith('..') ? near : file}`
}

/** The one sentence that tells an agent the flows' `akb` is spelled differently here, or
 *  nothing at all when it isn't. Said wherever words go out to an agent, so no run ever
 *  learns it by having a command fail.
 *
 *  Three things can make it differ, and the sentence says whichever ones apply: there is no
 *  `akb` on this machine; inside a delivery the working folder is its own worktree rather
 *  than the project, so the board is named with `--dir` (#303); and this board was named
 *  rather than found, so every command has to name it again with `--board` (#407). */
export function commandNote(command: string): string {
  if (command === 'akb') return ''
  const why = [
    command.startsWith('akb') ? '' : `there is no \`akb\` on this machine's PATH`,
    command.includes(' --dir ') ? `the working folder here is not the project` : '',
    // Spelled without the board's own path: this sentence is one of the few the board writes
    // that must NOT be rewritten for the board it is about (`boardText`).
    command.includes(' --board ') ? `this board is named rather than found` : '',
  ].filter(Boolean)
  return (
    `${why.length ? `Because ${why.join(', and ')}, ` : ''}\`${command}\` is the board's command here — ` +
    `the flows all spell it \`akb\`, and \`${command}\` is what to run wherever one does. ` +
    `Don't install anything and don't fetch it from npm.`
  )
}
