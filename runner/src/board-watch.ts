// Every board this Runner keeps for Cloud goes back as it changes (#59), so the web shows what a
// command did at once, in a job or not. Changes close together go as one write; a folder's
// writes take turns with its jobs' reads and writes. What could not go, at start or offline,
// goes again at the next look.

import fs from 'node:fs'
import path from 'node:path'

import { isBoardPath } from '../../cloud/src/board-files.ts'
import { cacheRoot, unsent } from './cache'
import { allowedProjects } from './folders'
import { keptBoard, pushBoard, type TaskFolder } from './task-folder'

/** How often new folders, and writes that failed, are looked at again. */
const LOOK_MS = 60_000

export interface BoardWatch {
  /** Look for folders read since, and send what failed. */
  look(): void
  close(): void
}

/** The project folders here with a board read from Cloud. */
function keptFolders(): TaskFolder[] {
  let cached: string[] = []
  try {
    cached = fs.readdirSync(cacheRoot()).map((name) => path.join(cacheRoot(), name))
  } catch {
    // No cache yet.
  }
  return [...new Set([...allowedProjects(), ...cached])].flatMap((dir) => [keptBoard(dir)].filter((ws): ws is TaskFolder => !!ws))
}

export function watchBoards(machineId: string, ms: number, lookMs = LOOK_MS): BoardWatch {
  const watched = new Map<string, { watcher: fs.FSWatcher; timer?: ReturnType<typeof setTimeout> }>()
  let closed = false

  const send = async (ws: TaskFolder) => {
    const sent = await pushBoard(ws, machineId)
    if (!sent.ok && !sent.offline) console.error(`runner: the board in ${ws.cwd} was not sent: ${sent.error}`)
  }

  const watch = (ws: TaskFolder) => {
    let watcher: fs.FSWatcher
    try {
      watcher = fs.watch(ws.board, { recursive: true }, (_event, name) => {
        const p = name && String(name).split(path.sep).join('/')
        const held = watched.get(ws.cwd)
        if (closed || !p || !isBoardPath(p) || !held) return
        clearTimeout(held.timer)
        held.timer = setTimeout(() => void send(ws), ms)
      })
    } catch {
      return false
    }
    watcher.on('error', () => {
      clearTimeout(watched.get(ws.cwd)?.timer)
      watcher.close()
      watched.delete(ws.cwd)
    })
    watched.set(ws.cwd, { watcher })
    return true
  }

  const look = () => {
    if (closed) return
    for (const ws of keptFolders()) {
      const fresh = !watched.has(ws.cwd) && watch(ws)
      if (fresh || unsent(ws.cwd)) void send(ws)
    }
  }
  look()
  const timer = setInterval(look, lookMs)
  timer.unref?.()

  return {
    look,
    close: () => {
      closed = true
      clearInterval(timer)
      for (const held of watched.values()) {
        clearTimeout(held.timer)
        held.watcher.close()
      }
      watched.clear()
    },
  }
}
