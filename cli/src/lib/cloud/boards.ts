// Which boards Cloud is on for, held on this MACHINE (#319).
//
// `~/.ai4kanban/boards.json`, beside the sign-in and outside every repository. Two reasons
// it cannot live in `docs/kanban/`: the bell has to name a board the app does not have
// open, and nothing about Cloud is committed to a project's git history.
//
// A board's Cloud ID means nothing outside Cloud. The mapping from that ID to a local path
// exists here and nowhere else, so an event names a board without Cloud ever learning where
// the checkout is.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from '../machine/home'

/** Watch every card, whatever release it is promised to — the default a board starts on. Not
 *  a release name: `*` cannot be one, so it never collides with a board's own versions. */
export const ALL_RELEASES = '*'

/** One board Cloud is on for. */
export interface CloudBoard {
  /** The opaque id Cloud knows this board by. */
  id: string
  /** Where the board is on this machine. Never sent anywhere. */
  path: string
  /** What to call it in the bell — the project folder's own name. */
  name: string
  /** What this board raises events for: `ALL_RELEASES`, or one open release, where a task in
   *  any other release — or in none — raises nothing. Empty when a watched release closed and
   *  the user has not picked another: the filling stops and the rail asks. */
  release: string
  /** This machine's server row for this board, as Cloud minted it (#318). It is what an
   *  approval taken elsewhere is claimed under, and what names this board's private Realtime
   *  topic. Empty when this machine does not run this board's work — nothing is claimed then,
   *  and the board still publishes its events. */
  serverId?: string
  /** The user turned this machine's server off here, so nothing re-registers it on the next
   *  tick. Absent on a board that simply has not been registered yet — the two look the same
   *  from `serverId` alone, and only one of them is an answer the user gave. */
  serverOff?: boolean
}

interface Held {
  version: 1
  boards: CloudBoard[]
}

export const boardsFile = (): string => path.join(machineHome(), 'boards.json')

function held(): Held {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(boardsFile(), 'utf8'))
    const boards = (parsed as Held)?.boards
    if (!Array.isArray(boards)) return { version: 1, boards: [] }
    return {
      version: 1,
      boards: boards
        .filter((b) => b && typeof b.id === 'string' && typeof b.path === 'string')
        .map((b) => ({
          id: b.id,
          path: b.path,
          name: typeof b.name === 'string' && b.name ? b.name : path.basename(b.path),
          release: typeof b.release === 'string' ? b.release : '',
          serverId: typeof b.serverId === 'string' ? b.serverId : undefined,
          serverOff: b.serverOff === true ? true : undefined,
        })),
    }
  } catch {
    return { version: 1, boards: [] }
  }
}

function write(next: Held): void {
  fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
  const file = boardsFile()
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  fs.renameSync(tmp, file)
}

/**
 * One spelling of a folder, so two names for it are one board.
 *
 * `realpath` and not just `resolve`: the board points itself at the real path it found
 * (`setBoardRoot`), and on macOS `/tmp` is a symlink — a record written as `/tmp/x` would
 * never match the board running as `/private/tmp/x`, and that board would silently publish
 * nothing. A folder that has gone falls back to the resolved name: a board missing from the
 * machine keeps its record, because the checkout can come back.
 */
function canonical(root: string): string {
  try {
    return fs.realpathSync(root)
  } catch {
    return path.resolve(root)
  }
}

/** Every board Cloud is on for, in the order they were turned on. */
export function readCloudBoards(): CloudBoard[] {
  return held().boards
}

/** This board's record, or null when its notifications are off. */
export function cloudBoardFor(root: string): CloudBoard | null {
  const here = canonical(root)
  return held().boards.find((b) => canonical(b.path) === here) ?? null
}

/** The board a Cloud ID names, or null when it is no longer on this machine — which the
 *  bell says plainly rather than switching to it. */
export function cloudBoardById(id: string): CloudBoard | null {
  return held().boards.find((b) => b.id === id) ?? null
}

/** Turn notifications on for this board, watching one open release. Idempotent: a board
 *  already on keeps its Cloud ID, so turning it off and on again does not orphan its
 *  events. */
export function enableCloudBoard(root: string, release: string): CloudBoard {
  const resolved = canonical(root)
  const state = held()
  const existing = state.boards.find((b) => canonical(b.path) === resolved)
  if (existing) {
    existing.release = release
    existing.path = resolved
    write(state)
    return existing
  }
  const board: CloudBoard = {
    id: crypto.randomUUID(),
    path: resolved,
    name: path.basename(resolved),
    release,
  }
  state.boards.push(board)
  write(state)
  return board
}

/** Remember — or forget — the server row Cloud minted for this machine on this board (#318).
 *  Empty is Cloud saying this machine does not hold the board, which is a fact rather than a
 *  choice: `stopCloudBoardServer` below is the choice. */
export function setCloudBoardServer(root: string, serverId: string): CloudBoard | null {
  const resolved = canonical(root)
  const state = held()
  const board = state.boards.find((b) => canonical(b.path) === resolved)
  if (!board) return null
  if (serverId) {
    board.serverId = serverId
    delete board.serverOff
  } else {
    delete board.serverId
  }
  write(state)
  return board
}

/** The user turned this machine's server off for this board. Written down so nothing
 *  registers it again on the next tick — a board never registered and one deliberately
 *  turned off look the same from `serverId` alone, and only one of them is an answer. */
export function stopCloudBoardServer(root: string): CloudBoard | null {
  const resolved = canonical(root)
  const state = held()
  const board = state.boards.find((b) => canonical(b.path) === resolved)
  if (!board) return null
  delete board.serverId
  board.serverOff = true
  write(state)
  return board
}

/** Which release this board watches. Empty stops the filling and is what a closed release
 *  leaves behind. */
export function setCloudBoardRelease(root: string, release: string): CloudBoard | null {
  const resolved = canonical(root)
  const state = held()
  const board = state.boards.find((b) => canonical(b.path) === resolved)
  if (!board) return null
  board.release = release
  write(state)
  return board
}

/** Turn them off. The caller retires this board's live events first — the record is what
 *  says which they are. */
export function disableCloudBoard(root: string): CloudBoard | null {
  const resolved = canonical(root)
  const state = held()
  const at = state.boards.findIndex((b) => canonical(b.path) === resolved)
  if (at < 0) return null
  const [gone] = state.boards.splice(at, 1)
  write(state)
  return gone ?? null
}

/** Whether a row has to name its board. One board is the whole bell and naming it every row
 *  says nothing; a second makes the name the thing that tells two rows apart. */
export const namesBoards = (): boolean => held().boards.length > 1
