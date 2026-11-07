import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { CommitHookResult } from './types'

const MARKER_LINE = /^# ai4kanban commit guard\b/m
const read = (file: string): string | null => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

function hooksDir(root: string): string | null {
  const out = spawnSync('git', ['rev-parse', '--git-path', 'hooks'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  })
  if (out.error || out.status !== 0 || !out.stdout.trim()) return null
  return path.resolve(root, out.stdout.trim())
}


export function installCommitHook(root: string, _board?: string): CommitHookResult {
  const dir = hooksDir(root)
  if (!dir) return {}
  const file = path.join(dir, 'pre-commit')
  if (fs.lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) return {}
  const source = read(file)
  if (source && MARKER_LINE.test(source)) fs.unlinkSync(file)
  return {}
}
