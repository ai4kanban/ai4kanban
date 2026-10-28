// The folders this Runner may work in: `projects.json`, written only on this computer. The
// desktop app adds a folder the user picked and removes one they took off; Cloud only ever
// takes one away (`keepOnly`), never adds one.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { runnerHome } from './home'

const projectsFile = () => path.join(runnerHome(), 'projects.json')

function realpath(p: string): string | null {
  try {
    return fs.realpathSync(p)
  } catch {
    return null
  }
}

function readList(): string[] {
  try {
    const held = JSON.parse(fs.readFileSync(projectsFile(), 'utf8')) as { projects?: unknown }
    return Array.isArray(held.projects) ? held.projects.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

function writeList(list: string[]): void {
  fs.mkdirSync(runnerHome(), { recursive: true, mode: 0o700 })
  fs.writeFileSync(projectsFile(), `${JSON.stringify({ projects: [...new Set(list)] }, null, 2)}\n`)
}

/** The project folders the user allowed, resolved. */
export function allowedProjects(): string[] {
  return readList().flatMap((p) => [realpath(p)].filter((r): r is string => !!r))
}

export const allow = (dir: string) => writeList([...readList(), dir])

/** Drop a folder; answers the folders dropped. */
export function disallow(dir: string): string[] {
  const list = readList()
  if (!list.includes(dir)) return []
  writeList(list.filter((p) => p !== dir))
  return [dir]
}

/** Drop every folder Cloud no longer places on this computer; answers the folders dropped. */
export function keepOnly(dirs: string[]): string[] {
  const list = readList()
  const kept = list.filter((p) => dirs.includes(p))
  if (kept.length !== list.length) writeList(kept)
  return list.filter((p) => !dirs.includes(p))
}

export type Refusal = 'home' | 'disk' | 'system' | 'missing'

const SYSTEM_MAC = ['/System', '/Library', '/Applications', '/usr', '/bin', '/sbin', '/etc', '/var', '/private', '/opt', '/cores', '/dev']
const SYSTEM_WIN = ['Windows', 'Program Files', 'Program Files (x86)', 'ProgramData']

export interface Where {
  platform: NodeJS.Platform
  home: string
  /** Resolves links; null when the folder is not there. */
  resolve: (p: string) => string | null
}

const here = (): Where => ({ platform: process.platform, home: os.homedir(), resolve: realpath })

/** Why a picked folder cannot be a project, or null when it can. A project is one folder of
 *  the user's: not the home folder or one holding it, not a disk, not the system's or ours. */
export function refusal(picked: string, where: Where = here()): Refusal | null {
  const win = where.platform === 'win32'
  const p = win ? path.win32 : path.posix
  const real = where.resolve(picked)
  if (!real || !p.isAbsolute(real)) return 'missing'
  const norm = (d: string) => {
    const n = p.normalize(d).replace(/[\\/]+$/, '') || p.sep
    return win ? n.toLowerCase() : n
  }
  const within = (dir: string, root: string) => {
    const [d, r] = [norm(dir), norm(root)]
    return d === r || d.startsWith(r.endsWith(p.sep) ? r : r + p.sep)
  }
  const forms = [picked, real]
  if (forms.some((f) => norm(f) === norm(where.home))) return 'home'
  if (forms.some((f) => norm(f) === norm(p.parse(f).root)) || (!win && forms.some((f) => /^\/Volumes(\/[^/]+)?\/?$/.test(f)))) {
    return 'disk'
  }
  if (forms.some((f) => within(where.home, f))) return 'home'
  if (forms.some((f) => within(f, runnerHome()))) return 'system'
  const system = win ? SYSTEM_WIN.map((s) => p.join(p.parse(real).root, s)) : SYSTEM_MAC
  return forms.some((f) => system.some((s) => within(f, s))) ? 'system' : null
}
