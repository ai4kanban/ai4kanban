// 本机 projects.json 保存允许运行的项目目录；插件管理列表，Cloud 只能移除目录。

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { readSession } from '../../cli/src/lib/cloud/session'
import { runnerHome } from './home'

const projectsFile = () => path.join(runnerHome(), 'projects.json')

function realpath(p: string): string | null {
  try {
    return fs.realpathSync(p)
  } catch {
    return null
  }
}

interface Grants { projects: string[]; accounts?: Record<string, string[]>; legacyOwner?: string }

function readGrants(): Grants {
  try {
    const held = JSON.parse(fs.readFileSync(projectsFile(), 'utf8')) as Grants
    if (!Array.isArray(held.projects)) throw new Error('invalid_projects')
    return held
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { projects: [] }
    throw error
  }
}

function listOf(held: Grants): string[] {
  const subject = readSession()?.subject
  if (!held.accounts) return held.projects
  return subject ? held.accounts[subject] ?? [] : []
}

/** 锁内合并、原子替换，防止两个插件丢失对方的目录更新。 */
function update(change: (list: string[]) => string[]): string[] {
  fs.mkdirSync(runnerHome(), { recursive: true, mode: 0o700 })
  const lock = `${projectsFile()}.lock`
  let fd: number
  const until = Date.now() + 2000
  for (;;) {
    try { fd = fs.openSync(lock, 'wx', 0o600); fs.writeFileSync(fd, String(process.pid)); break }
    catch {
      try {
        const pid = Number(fs.readFileSync(lock, 'utf8'))
        if (pid > 0) { try { process.kill(pid, 0) } catch { fs.rmSync(lock, { force: true }) } }
      } catch {}
      if (Date.now() > until) throw new Error('authorization_busy')
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
    }
  }
  try {
    const held = readGrants()
    const subject = readSession()?.subject
    const before = listOf(held)
    const after = [...new Set(change(before))]
    if (subject) {
      if (!held.accounts) {
        held.accounts = { [subject]: held.projects }
        held.legacyOwner = subject
      }
      held.accounts[subject] = after
      held.projects = after
    } else held.projects = after
    const tmp = `${projectsFile()}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(held, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(tmp, projectsFile())
    return before.filter((p) => !after.includes(p))
  } finally { fs.closeSync(fd); fs.rmSync(lock, { force: true }) }
}

export function adoptLegacy(): void {
  if (readSession() && !readGrants().accounts) update((list) => list)
}

export function allowedProjects(): string[] {
  return listOf(readGrants()).flatMap((p) => {
    const real = realpath(p)
    return real && fs.statSync(real).isDirectory() ? [real] : []
  })
}

export const allow = (dir: string) => { update((list) => [...list, dir]) }
export const disallow = (dir: string) => update((list) => list.filter((p) => p !== dir))
export const keepOnly = (dirs: string[]) => update((list) => list.filter((p) => dirs.includes(p)))

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
  if (!real || !p.isAbsolute(real) || (where.resolve === realpath && !fs.statSync(real).isDirectory())) return 'missing'
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
