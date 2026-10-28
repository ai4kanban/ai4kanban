// A landed commit's diff (#2109), read in the project's folder when a page asks for it and sent
// straight back to Cloud, which keeps none of it.

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import * as api from './api'
import type { DiffAnswer, DiffFile } from './api'
import { allowedProjects } from './folders'
import { cacheDir } from './cache'

/** Past either, only the file list and its line counts go. */
export const FILE_BYTES = 256 * 1024
export const TOTAL_BYTES = 1024 * 1024
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
/** The board and the worktrees are never part of the change. */
const PATHS = ['--', '.', ':(exclude).akb']
const STATUS: Record<string, DiffFile['status']> = { A: 'added', D: 'deleted' }

type Git = { ok: true; out: string } | { ok: false }

const git = (dir: string, args: string[], maxBuffer = 4 * TOTAL_BYTES) =>
  new Promise<Git>((resolve) =>
    execFile('git', ['-C', dir, '-c', 'core.quotePath=false', ...args], { encoding: 'utf8', maxBuffer }, (error, out) =>
      resolve(error ? { ok: false } : { ok: true, out }),
    ),
  )

/** The project's folder on this computer: the one the user placed it in, else its cached one. */
export function projectDir(placed: string | null, project: string): string | null {
  if (placed) {
    const real = realpath(placed)
    return real && allowedProjects().some((root) => real === root || real.startsWith(root + path.sep)) ? real : null
  }
  let cached: string
  try {
    cached = cacheDir(project)
  } catch {
    return null
  }
  return fs.existsSync(path.join(cached, '.git')) ? cached : null
}

function realpath(p: string): string | null {
  try {
    return fs.realpathSync(p)
  } catch {
    return null
  }
}

/** `commit`'s changes against its first parent, in `dir`; gone when the commit is not there. */
export async function diffOf(dir: string | null, commit: string): Promise<DiffAnswer> {
  if (!dir || !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(commit)) return { gone: true }
  if (!(await git(dir, ['cat-file', '-e', `${commit}^{commit}`])).ok) return { gone: true }
  const parent = await git(dir, ['rev-parse', '--verify', '-q', `${commit}^`])
  const range = ['diff', '--no-renames', '--no-color', '--no-ext-diff', parent.ok ? parent.out.trim() : EMPTY_TREE, commit]
  const [numstat, names] = await Promise.all([git(dir, [...range, '--numstat', '-z', ...PATHS]), git(dir, [...range, '--name-status', '-z', ...PATHS])])
  if (!numstat.ok || !names.ok) return { gone: true }

  const status = new Map<string, DiffFile['status']>()
  const named = names.out.split('\0')
  for (let i = 0; i + 1 < named.length; i += 2) status.set(named[i + 1]!, STATUS[named[i]!] ?? 'modified')
  const files: DiffFile[] = numstat.out
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const [added = '', removed = '', ...rest] = entry.split('\t')
      const file = rest.join('\t')
      const binary = added === '-'
      return { path: file, status: status.get(file) ?? 'modified', added: binary ? 0 : Number(added), removed: binary ? 0 : Number(removed), ...(binary ? { binary } : {}) }
    })

  // A patch past the buffer is past the limit too.
  const patch = await git(dir, [...range, ...PATHS], TOTAL_BYTES + FILE_BYTES)
  if (!patch.ok) return { files, truncated: true }
  const hunks = patch.out
    .split(/^diff --git /m)
    .slice(1)
    .map((chunk) => {
      const at = chunk.search(/^@@ /m)
      return at < 0 ? '' : chunk.slice(at)
    })
  const sizes = hunks.map((h) => Buffer.byteLength(h))
  if (hunks.length !== files.length || sizes.some((n) => n > FILE_BYTES) || sizes.reduce((a, b) => a + b, 0) > TOTAL_BYTES) {
    return { files, truncated: true }
  }
  return { files: files.map((f, i) => (hunks[i] ? { ...f, patch: hunks[i] } : f)), truncated: false }
}

/** A `diff` hint, answered: the project's folder found, the commit's diff read and sent back. */
export async function answerHint(machineId: string, hint: Record<string, unknown>): Promise<void> {
  const { diff, project, commit } = hint
  if (typeof diff !== 'string' || typeof project !== 'string' || typeof commit !== 'string') return
  const folders = await api.listFolders(machineId)
  if (!folders.ok) return
  const placed = folders.value.folders.find((f) => f.project === project)?.path ?? null
  const answer = await diffOf(projectDir(placed, project), commit)
  const sent = await api.answerDiff(machineId, diff, answer)
  if (!sent.ok) console.error(`runner: the diff of ${commit.slice(0, 7)} was not sent: ${sent.error}`)
}
