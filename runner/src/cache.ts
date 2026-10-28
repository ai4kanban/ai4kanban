// What the Runner keeps of a project here is a cache, rebuilt from Cloud by the next job (#2147):
// a project with no folder here lives in `cache/<project>/`, a linked folder keeps it in `.akb/`.
// A project unused for 7 days, or no longer the account's, goes — the whole cache folder, or a
// linked folder's `.akb/` alone — unless a job runs there, a delivery is paused there (#2128), or
// its last write to Cloud failed.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { readSession } from '../../cli/src/lib/cloud/session'
import { SESSIONS_FILE, projectStateDir } from '../../cli/src/lib/machine/project'
import * as api from './api'
import { allowedProjects } from './folders'
import { runnerHome } from './home'

export const IDLE_MS = 7 * 24 * 60 * 60_000
export const SWEEP_MS = 24 * 60 * 60_000

const PROJECT_ID = /^[\w-]{1,100}$/

export const cacheRoot = () => path.join(runnerHome(), 'cache')

export function cacheDir(project: string): string {
  if (!PROJECT_ID.test(project)) throw new Error('This job names no project.')
  return path.join(cacheRoot(), project)
}

const akbDir = (dir: string) => path.join(dir, '.akb')
const usedFile = (dir: string) => path.join(akbDir(dir), 'used.json')
const unsentFile = (dir: string) => path.join(akbDir(dir), 'unsent')

export function markUsed(dir: string, at = Date.now()): void {
  fs.mkdirSync(akbDir(dir), { recursive: true })
  fs.writeFileSync(usedFile(dir), `${JSON.stringify({ at })}\n`)
}

function usedAt(dir: string): number | null {
  try {
    const at = (JSON.parse(fs.readFileSync(usedFile(dir), 'utf8')) as { at?: unknown }).at
    return typeof at === 'number' ? at : null
  } catch {
    return null
  }
}

/** Whether the folder's last write to Cloud failed. */
export function markUnsent(dir: string, unsent: boolean): void {
  if (!unsent) return void fs.rmSync(unsentFile(dir), { force: true })
  fs.mkdirSync(akbDir(dir), { recursive: true })
  fs.writeFileSync(unsentFile(dir), '')
}

const busy = new Map<string, number>()

/** Keep `dir` while a job works there; the answer lets it go. */
export function hold(dir: string): () => void {
  busy.set(dir, (busy.get(dir) ?? 0) + 1)
  let held = true
  return () => {
    if (!held) return
    held = false
    const left = busy.get(dir)! - 1
    if (left) busy.set(dir, left)
    else busy.delete(dir)
  }
}

/** A delivery akb still holds open on the folder's board: one stopped by the user, kept for a resume. */
function paused(dir: string): boolean {
  try {
    const file = path.join(projectStateDir(path.join(akbDir(dir), 'kanban')), SESSIONS_FILE)
    const held = JSON.parse(fs.readFileSync(file, 'utf8')) as { deliveries?: { status?: string }[] }
    return (held.deliveries ?? []).some((d) => d.status === 'active')
  } catch {
    return false
  }
}

/** A job, unsent work or a paused delivery still holds the folder. */
export const kept = (dir: string) => busy.has(dir) || fs.existsSync(unsentFile(dir)) || paused(dir)

/** Empty a linked folder's `.akb/`, its own files untouched; false when it is kept. */
export function clearAkb(dir: string): boolean {
  dir = realpath(dir)
  if (kept(dir)) return false
  let entries: string[]
  try {
    entries = fs.readdirSync(akbDir(dir))
  } catch {
    return true
  }
  for (const name of entries) fs.rmSync(path.join(akbDir(dir), name), { recursive: true, force: true })
  spawnSync('git', ['-C', dir, 'worktree', 'prune'], { stdio: 'ignore' })
  return true
}

interface Access {
  projects: Set<string>
  folders: Set<string>
}

/** The account's projects and this computer's folders; null when Cloud cannot say. */
async function readAccess(machineId: string): Promise<Access | null> {
  if (!readSession()) return null
  const [folders, elsewhere] = await Promise.all([api.listFolders(machineId), api.listElsewhere(machineId)])
  if (!folders.ok || !elsewhere.ok) return null
  return {
    projects: new Set([...folders.value.folders.map((f) => f.project), ...elsewhere.value.projects.map((p) => p.project)]),
    folders: new Set(folders.value.folders.map((f) => realpath(f.path))),
  }
}

function realpath(p: string): string {
  try {
    return fs.realpathSync(p)
  } catch {
    return p
  }
}

/** Unused for longer than `IDLE_MS`. A folder with no record starts counting now. */
function idle(dir: string, now: number): boolean {
  const at = usedAt(dir)
  if (at === null) markUsed(dir, now)
  return at !== null && now - at > IDLE_MS
}

/** Clean the cache; answers the folders it cleaned. */
export async function sweepCache(machineId: string, now = Date.now()): Promise<string[]> {
  const access = await readAccess(machineId)
  const swept: string[] = []
  let cached: fs.Dirent[] = []
  try {
    cached = fs.readdirSync(cacheRoot(), { withFileTypes: true })
  } catch {
    // Nothing cached yet.
  }
  for (const e of cached) {
    const dir = path.join(cacheRoot(), e.name)
    if (!e.isDirectory() || kept(dir)) continue
    const gone = access && !access.projects.has(e.name)
    if (idle(dir, now) || gone) {
      fs.rmSync(dir, { recursive: true, force: true })
      swept.push(dir)
    }
  }
  for (const dir of allowedProjects()) {
    let held: string[] = []
    try {
      held = fs.readdirSync(akbDir(dir))
    } catch {
      // Never worked in.
    }
    if (!held.length) continue
    const gone = access && !access.folders.has(dir)
    if ((idle(dir, now) || gone) && clearAkb(dir)) swept.push(dir)
  }
  return swept
}

/** The folders before #2147, not moved: their projects are rebuilt from Cloud. */
export function removeLegacy(): void {
  const home = runnerHome()
  for (const name of ['boards', 'akb-bin']) fs.rmSync(path.join(home, name), { recursive: true, force: true })
  let entries: fs.Dirent[] = []
  try {
    entries = fs.readdirSync(home, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const account = path.join(home, e.name)
    if (!e.isDirectory() || !fs.existsSync(path.join(account, 'unfiled'))) continue
    fs.rmSync(path.join(account, 'unfiled'), { recursive: true, force: true })
    if (!fs.readdirSync(account).length) fs.rmdirSync(account)
  }
}
