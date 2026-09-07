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
  /** The PROJECT this board belongs to, on this machine. Never sent anywhere. What the app
   *  opens when a row names a board it is not showing. */
  path: string
  /** The board FOLDER itself, which is what a record is looked up by (#407). A project can
   *  hold more than one board — `docs/kanban` and `marketing/kanban` — and they are two
   *  boards with two event streams, not one board read two ways. Records written before this
   *  say nothing, and are read as the project's default board. */
  boardDir: string
  /** What to call it in the bell — the project folder's own name, and where in it a second
   *  board sits (`boardName`). */
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
          // A record written before boards were told apart by folder is the project's own
          // board, which is where every one of them was.
          boardDir: typeof b.boardDir === 'string' && b.boardDir ? b.boardDir : defaultBoardDir(b.path),
          name:
            typeof b.name === 'string' && b.name
              ? b.name
              : boardName(b.path, b.boardDir || defaultBoardDir(b.path)),
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

/** The board a project holds unless it is told about another. */
export const defaultBoardDir = (project: string): string => path.join(project, 'docs', 'kanban')

/** Whether this is the board its project holds — the ordinary case, and the one where
 *  nothing the project keeps for a board has to say which board it is for. */
export const isProjectBoard = (project: string, boardDir: string): boolean =>
  path.resolve(boardDir) === path.resolve(defaultBoardDir(project))

/**
 * What to call a board in the bell: the project's own name, and — for a SECOND board in that
 * project — where in it that board sits.
 *
 * `marketing/kanban` is called `ai4kanban/marketing` rather than `kanban`, which is what
 * every board folder is called and so names nothing.
 */
export function boardName(project: string, boardDir: string): string {
  const here = path.basename(project)
  if (isProjectBoard(project, boardDir)) return here
  const inside = path.relative(project, boardDir)
  if (!inside || inside.startsWith('..')) return path.basename(boardDir) || here
  const folder = path.basename(inside) === 'kanban' ? path.dirname(inside) : inside
  return folder === '.' ? here : `${here}/${folder}`
}

/** Every board Cloud is on for, in the order they were turned on. */
export function readCloudBoards(): CloudBoard[] {
  return held().boards
}

/**
 * This board's record, or null when its notifications are off.
 *
 * Looked up by the board FOLDER, never by its project: two boards in one project are two
 * boards, and matching on the project would hand one of them the other's record — its Cloud
 * id, its events, and the record of what it published (#407).
 */
export function cloudBoardFor(boardDir: string): CloudBoard | null {
  const here = canonical(boardDir)
  return held().boards.find((b) => canonical(b.boardDir) === here) ?? null
}

/** The board a Cloud ID names, or null when it is no longer on this machine — which the
 *  bell says plainly rather than switching to it. */
export function cloudBoardById(id: string): CloudBoard | null {
  return held().boards.find((b) => b.id === id) ?? null
}

/** Turn notifications on for this board, watching one open release. Idempotent: a board
 *  already on keeps its Cloud ID, so turning it off and on again does not orphan its
 *  events. */
export function enableCloudBoard(boardDir: string, project: string, release: string): CloudBoard {
  const folder = canonical(boardDir)
  const root = canonical(project)
  const state = held()
  const existing = state.boards.find((b) => canonical(b.boardDir) === folder)
  if (existing) {
    existing.release = release
    existing.path = root
    existing.boardDir = folder
    write(state)
    return existing
  }
  const board: CloudBoard = {
    id: crypto.randomUUID(),
    path: root,
    boardDir: folder,
    name: boardName(root, folder),
    release,
  }
  state.boards.push(board)
  write(state)
  return board
}

/** Remember — or forget — the server row Cloud minted for this machine on this board (#318).
 *  Empty is Cloud saying this machine does not hold the board, which is a fact rather than a
 *  choice: `stopCloudBoardServer` below is the choice. */
export function setCloudBoardServer(boardDir: string, serverId: string): CloudBoard | null {
  const folder = canonical(boardDir)
  const state = held()
  const board = state.boards.find((b) => canonical(b.boardDir) === folder)
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
export function stopCloudBoardServer(boardDir: string): CloudBoard | null {
  const folder = canonical(boardDir)
  const state = held()
  const board = state.boards.find((b) => canonical(b.boardDir) === folder)
  if (!board) return null
  delete board.serverId
  board.serverOff = true
  write(state)
  return board
}

/** Which release this board watches. Empty stops the filling and is what a closed release
 *  leaves behind. */
export function setCloudBoardRelease(boardDir: string, release: string): CloudBoard | null {
  const folder = canonical(boardDir)
  const state = held()
  const board = state.boards.find((b) => canonical(b.boardDir) === folder)
  if (!board) return null
  board.release = release
  write(state)
  return board
}

/** Turn them off. The caller retires this board's live events first — the record is what
 *  says which they are. */
export function disableCloudBoard(boardDir: string): CloudBoard | null {
  const folder = canonical(boardDir)
  const state = held()
  const at = state.boards.findIndex((b) => canonical(b.boardDir) === folder)
  if (at < 0) return null
  const [gone] = state.boards.splice(at, 1)
  write(state)
  return gone ?? null
}
