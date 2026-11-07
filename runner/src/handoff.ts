import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Job } from './api'
import { allowedProjects } from './folders'

const gitRead = (cwd: string, args: string[]): string | null => {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 15_000,
      maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { return null }
}

const digest = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex')

export function authorizedFolder(folder: string | null): string | null {
  if (!folder) return null
  try {
    const real = fs.realpathSync(folder)
    return allowedProjects().some((root) => real === root || real.startsWith(root + path.sep)) ? real : null
  } catch { return null }
}

export function progressFolder(job: Job, folder: string): string | null {
  const token = job.handoff?.progressIsolation
  if (!token) return folder
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(token)) return null
  try {
    const dir = fs.realpathSync(path.join(folder, '.akb', 'handoffs', token))
    if (!dir.startsWith(fs.realpathSync(folder) + path.sep)) return null
    const marker = JSON.parse(fs.readFileSync(path.join(dir, '.akb', 'handoff.json'), 'utf8'))
    return marker.task === job.task && marker.isolation === token ? dir : null
  } catch { return null }
}

/** 只上传任务、交付和本地成果的摘要，兼容旧 Git 交付。 */
export function progressEvidence(job: Pick<Job, 'task' | 'number' | 'flow'>, folder: string): string | null {
  try {
    const board = path.join(folder, '.akb', 'kanban')
    const deliveries = path.join(board, 'deliveries')
    const rows = fs.readdirSync(deliveries).filter((name) => name.endsWith('.json')).map((name) =>
      JSON.parse(fs.readFileSync(path.join(deliveries, name), 'utf8')))
      .filter((row) => row.cardId === job.number).sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
    const row = rows[0]
    if (!row?.deliveryId) return null
    const tree = fs.realpathSync(path.resolve(folder, row.worktree ?? '.'))
    if (tree !== fs.realpathSync(folder) && !tree.startsWith(fs.realpathSync(folder) + path.sep)) return null
    const inventory = gitRead(tree, ['worktree', 'list', '--porcelain'])
    const related = (inventory ?? '').split('\n\n').flatMap((entry) => {
      const branch = /^branch refs\/heads\/(.+)$/m.exec(entry)?.[1]
      const dir = /^worktree (.+)$/m.exec(entry)?.[1]
      return branch?.startsWith(`card/${job.number}/`) && dir && dir !== tree &&
        dir.startsWith(fs.realpathSync(folder) + path.sep) ? [dir] : []
    })
    const filesIn = (tree: string) => {
      const changed: string[] = []
      const walk = (dir: string, prefix = '') => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (['.git', '.akb', 'node_modules', '.claude', '.agents'].includes(entry.name)) continue
          const name = prefix + entry.name
          if (entry.isDirectory()) walk(path.join(dir, entry.name), name + '/')
          else changed.push(name)
        }
      }
      walk(tree)
      changed.sort()
      return changed.map((name) => {
        const file = path.join(tree, name)
        try {
          const stat = fs.lstatSync(file)
          if (stat.isSymbolicLink()) return [name, 'link', digest(fs.readlinkSync(file))]
          if (!stat.isFile()) throw new Error('无法验证文件类型')
          return [name, stat.mode & 0o777, digest(fs.readFileSync(file))]
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [name, 'deleted']
          throw e
        }
      })
    }
    const files = filesIn(tree)
    return digest(JSON.stringify({ task: job.task, number: job.number, verb: job.flow?.verb, delivery: row.deliveryId,
      record: digest(JSON.stringify(row)), base: row.base, branch: row.branch, files,
      git: inventory === null ? null : {
        head: gitRead(tree, ['rev-parse', 'HEAD']),
        status: gitRead(tree, ['status', '--porcelain']),
        staged: gitRead(tree, ['diff', '--cached', '--binary']),
        related: related.map((dir) => ({ dir, files: filesIn(dir), head: gitRead(dir, ['rev-parse', 'HEAD']),
          diff: gitRead(dir, ['diff', 'HEAD', '--binary']), status: gitRead(dir, ['status', '--porcelain']) })),
      } }))
  } catch { return null }
}

/** 在普通隔离目录重启，保留已有文件及旧工作树。 */
export function restartFolder(job: Job, folder: string): string {
  const token = job.handoff?.isolation ?? job.id
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(token)) throw new Error('隔离目录编号无效。')
  const dir = path.join(folder, '.akb', 'handoffs', token)
  const marker = path.join(dir, '.akb', 'handoff.json')
  for (const parent of [path.join(folder, '.akb'), path.dirname(dir), dir]) {
    if (fs.lstatSync(parent, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('隔离目录不能通过符号链接创建。')
  }
  if (fs.existsSync(dir)) {
    if (job.handoff?.recovering) {
      try {
        const saved = JSON.parse(fs.readFileSync(marker, 'utf8'))
        if (saved.task === job.task && saved.isolation === token) return dir
      } catch {}
    }
    throw new Error('重启目录已存在，请重新检查。')
  }
  fs.mkdirSync(path.dirname(dir), { recursive: true })
  fs.mkdirSync(dir)
  for (const entry of fs.readdirSync(folder)) {
    if (['.akb', '.git', 'node_modules', '.claude', '.agents'].includes(entry)) continue
    fs.cpSync(path.join(folder, entry), path.join(dir, entry), { recursive: true, verbatimSymlinks: true })
  }
  if (fs.lstatSync(path.dirname(marker), { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('隔离标记目录无效。')
  fs.mkdirSync(path.dirname(marker), { recursive: true })
  fs.writeFileSync(marker, JSON.stringify({ task: job.task, isolation: token }), { flag: 'wx' })
  return dir
}
