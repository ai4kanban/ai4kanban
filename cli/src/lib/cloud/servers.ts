// Which machine runs a board's work (#318).
//
// A board attaches exactly ONE server, and a server is a machine rather than a process: the
// desktop app and a terminal `akb` act as the same one, so a board with no window open still
// runs its work as soon as any command is run there.
//
// A second machine claiming a board is refused and told which machine holds it, rather than
// routed between: a board's work runs in one repository, and handing it to another machine
// would rerun a build on a checkout the first one may already have written to. The move is
// the user's, on purpose — a refusal on its own is a trap, because the case that reaches it
// is a home directory restored onto a new machine, where the machine holding the board is
// exactly the one that has gone.
//
// The registration used to carry what this computer ran the board's named runtimes as
// (#345). Runtimes are back (#467), but what a MACHINE runs one as is #371's question, so
// nothing is reported here and no machine card shows a line about one. The field stays on
// the wire because the Cloud service still holds it.

import { thisMachine } from '../machine/identity'
import { KANBAN } from '../paths'
import type { WriteResult } from '../view/types'
import { cloudBoardFor, setCloudBoardServer, stopCloudBoardServer, type CloudBoard } from './boards'
import { attachServer, detachServer, listServers } from './client'
import { eventHome, workspaceNodeFor } from './home'
import { readSession } from './session'

/** A machine registered against one board, as Cloud holds it. */
export interface CloudServer {
  id: string
  boardId: string
  machineId: string
  machineName: string
  enabled: boolean
}

/** What a screen and `akb cloud` say about one board's server. */
export interface BoardServer {
  /** A machine runs this board's work. */
  attached: boolean
  /** It is this one. */
  here: boolean
  /** The machine that holds it, for a board held elsewhere. Empty when nobody holds it. */
  machineName: string
  /** This machine's own name, for the sentence that offers to move the board here. */
  thisMachine: string
}

/**
 * The machine row this checkout claims its work under, when that machine is this one.
 *
 * Two kinds of row, one shape. A Local board attaches exactly ONE server, and the row is the
 * one this machine holds for it. A Cloud checkout has no board server at all: it claims under
 * its NODE in the workspace (#364), which every one of the workspace's machines has one of —
 * so a decision taken in a browser is picked up by whichever of them is running.
 *
 * Null whenever nothing here may claim: notifications off, signed out, no node registered
 * yet, or this machine is not the board's server.
 */
export function serverForBoard(boardDir = KANBAN): { board: CloudBoard; serverId: string } | null {
  const board = cloudBoardFor(boardDir)
  if (!board) return null
  if (!readSession()) return null
  const home = eventHome(board)
  if (home.workspaceId) {
    const node = workspaceNodeFor()
    return node ? { board, serverId: node } : null
  }
  return board.serverId ? { board, serverId: board.serverId } : null
}

/**
 * Register this machine as this board's server.
 *
 * `takeOver` is the user saying the machine in front of them runs the board now: the old
 * server is disabled, and a request it left interrupted can then only be cancelled.
 */
export async function attachBoardServer(takeOver = false, boardDir = KANBAN): Promise<WriteResult> {
  const board = cloudBoardFor(boardDir)
  if (!board) return { ok: false, error: 'Notifications are off for this board.' }
  if (!readSession()) return { ok: false, error: 'Sign in to Cloud first.' }
  const machine = thisMachine()
  if (!machine) return { ok: false, error: 'This machine has nowhere to keep its identity, so it cannot run a board’s work.' }

  const answer = await attachServer(board.id, machine.id, machine.name, takeOver)
  if (!answer.ok) return { ok: false, error: answer.error }
  setCloudBoardServer(boardDir, answer.value.server.id)
  return { ok: true }
}

/** Stop this machine running this board's work. The local board is untouched: a delivery
 *  already going finishes here while its request reads interrupted. */
export async function detachBoardServer(boardDir = KANBAN): Promise<WriteResult> {
  const board = cloudBoardFor(boardDir)
  if (!board) return { ok: true }
  const machine = thisMachine()
  // The local record goes first: whatever Cloud answers, this machine must stop claiming.
  stopCloudBoardServer(boardDir)
  if (!machine || !readSession()) return { ok: true }
  const answer = await detachServer(board.id, machine.id)
  return answer.ok ? { ok: true } : { ok: false, error: answer.error }
}

/** Which machine runs this board's work, as the Cloud section and `akb cloud` say it. */
export async function readBoardServer(boardDir = KANBAN): Promise<BoardServer> {
  const machine = thisMachine()
  const blank: BoardServer = {
    attached: false,
    here: false,
    machineName: '',
    thisMachine: machine?.name ?? '',
  }
  const board = cloudBoardFor(boardDir)
  if (!board || !readSession()) return blank
  const answer = await listServers()
  if (!answer.ok) {
    // Unreachable. What this machine last knew is that it holds the board, or does not.
    const mine = !!board.serverId
    return { ...blank, attached: mine, here: mine, machineName: mine ? (machine?.name ?? '') : '' }
  }
  const held = answer.value.servers.find((s) => s.boardId === board.id)
  if (!held) {
    // Cloud says nobody holds it, so neither does this machine's record.
    if (board.serverId) setCloudBoardServer(boardDir, '')
    return blank
  }
  const here = !!machine && held.machineId === machine.id
  // Cloud is the authority on whose board this is: a machine whose row was disabled from
  // somewhere else stops claiming as soon as it next looks.
  if (here && board.serverId !== held.id) setCloudBoardServer(boardDir, held.id)
  if (!here && board.serverId) setCloudBoardServer(boardDir, '')
  return { attached: true, here, machineName: held.machineName, thisMachine: machine?.name ?? '' }
}

/** Whether this machine should register itself as this board's server without being asked —
 *  a board whose notifications are on, that has no server row here, and whose server the user
 *  has not turned off.
 *
 *  Never on a Cloud checkout: it attaches no board server at all, because its decisions belong
 *  to the workspace and every one of the workspace's machines may claim them (#364). */
export function wantsServerHere(boardDir = KANBAN): boolean {
  const board = cloudBoardFor(boardDir)
  if (!board || eventHome(board).workspaceId) return false
  return !board.serverId && !board.serverOff && !!readSession()
}
