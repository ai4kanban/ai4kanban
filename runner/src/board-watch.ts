// Every board this Runner keeps for Cloud goes back as it changes (#59), so the web shows what a
// command did at once, in a job or not. Changes close together go as one write; a folder's
// writes take turns with its jobs' reads and writes. What could not go, at start or offline,
// goes again at the next look. What Cloud changed comes down as it is hinted (#103): hints close
// together read once, and a folder a job holds reads after the job.

import fs from 'node:fs'
import path from 'node:path'

import { isBoardPath } from '../../cloud/src/board-files.ts'
import { busy, cacheRoot, unsent } from './cache'
import { allowedProjects } from './folders'
import { keptBoard, pullChanges, pushBoard, readHead, type TaskFolder } from './task-folder'

/** How often new folders, and writes that failed, are looked at again. */
const LOOK_MS = 60_000
/** Hints this close together read once. */
const PULL_MS = 2_000

export interface BoardWatch {
  /** Look for folders read since, send what failed, and read what waited on a job. */
  look(): void
  /** Cloud's board for `project` is at `head` now, pushed by `machine` when a computer did. */
  hint(project: string, head: number, machine?: string): void
  /** Read what changed on every board kept here: when no hint can arrive. */
  pullAll(): void
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

export function watchBoards(machineId: string, ms: number, lookMs = LOOK_MS, pullMs = PULL_MS): BoardWatch {
  const watched = new Map<string, { watcher: fs.FSWatcher; timer?: ReturnType<typeof setTimeout> }>()
  const due = new Map<string, ReturnType<typeof setTimeout>>()
  const afterJob = new Set<string>()
  let closed = false

  const pull = async (ws: TaskFolder) => {
    if (closed) return
    if (busy(ws.cwd)) return void afterJob.add(ws.cwd)
    afterJob.delete(ws.cwd)
    const read = await pullChanges(ws)
    if (!read.ok && read.code) console.error(`runner: the board in ${ws.cwd} was not read: ${read.error}`)
  }

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
      if (afterJob.has(ws.cwd) && !busy(ws.cwd)) void pull(ws)
    }
  }
  look()
  const timer = setInterval(look, lookMs)
  timer.unref?.()

  return {
    look,
    hint: (project, head, machine) => {
      if (closed || machine === machineId) return
      for (const ws of keptFolders()) {
        if (ws.project !== project || due.has(ws.cwd) || (readHead(ws) ?? Infinity) >= head) continue
        due.set(ws.cwd, setTimeout(() => {
          due.delete(ws.cwd)
          void pull(ws)
        }, pullMs))
      }
    },
    pullAll: () => {
      for (const ws of keptFolders()) if (!due.has(ws.cwd)) void pull(ws)
    },
    close: () => {
      closed = true
      clearInterval(timer)
      for (const t of due.values()) clearTimeout(t)
      due.clear()
      for (const held of watched.values()) {
        clearTimeout(held.timer)
        held.watcher.close()
      }
      watched.clear()
    },
  }
}
