// Remember a read of board files until one of them changes on disk. The board UI is one
// long-lived process that asks the same questions many times a page; a command asks once.

import fs from 'node:fs'
import path from 'node:path'

// Each file's size and nanosecond mtime, folders walked whole. A missing path is part of the
// answer too: creating it changes the stamp.
function stamp(paths: string[]): string {
  const parts: string[] = []
  const visit = (p: string): void => {
    let st: fs.BigIntStats
    try {
      st = fs.statSync(p, { bigint: true })
    } catch {
      parts.push(`${p}:-`)
      return
    }
    if (!st.isDirectory()) {
      parts.push(`${p}:${st.mtimeNs}:${st.size}`)
      return
    }
    parts.push(`${p}/`)
    let names: string[]
    try {
      names = fs.readdirSync(p).sort()
    } catch {
      return
    }
    for (const name of names) if (name !== 'node_modules' && name !== '.git') visit(path.join(p, name))
  }
  for (const p of paths) visit(p)
  return parts.join('\n')
}

// A deep copy that keeps functions as they are (a parsed agent carries its file reader).
function copy<T>(v: T): T {
  if (Array.isArray(v)) return v.map(copy) as T
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, copy(x)])) as T
  if (v instanceof Set) return new Set([...v].map(copy)) as T
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)])) as T
  }
  return v
}

// The board UI asks the same question dozens of times while drawing one page, so it may
// check the disk once per synchronous stretch instead of on every read. A command never does:
// it writes and reads back in the same stretch.
let perTurn = false
let turn = 0
let turnEnding = false
function currentTurn(): number {
  if (!perTurn) return ++turn
  if (!turnEnding) {
    turnEnding = true
    setImmediate(() => {
      turn++
      turnEnding = false
    }).unref()
  }
  return turn
}

/** Check the disk again on the next read — after this process wrote a file a memo reads. */
export function forgetFileMemos(): void {
  turn++
}

/** `read`, re-run only when a file under `paths` changed. Each call hands back its own copy,
 *  so a caller that edits the answer does not edit the next caller's. */
export function memoByFiles<T>(paths: () => string[], read: () => T): () => T {
  let last: { stamp: string; turn: number; value: T } | null = null
  return () => {
    const now = currentTurn()
    if (last?.turn !== now) {
      const seen = stamp(paths())
      if (last?.stamp === seen) last.turn = now
      else last = { stamp: seen, turn: now, value: read() }
    }
    return copy(last.value)
  }
}
