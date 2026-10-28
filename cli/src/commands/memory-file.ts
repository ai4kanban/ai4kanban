// ---- memory-file -----------------------------------------------------------
//
// Print one global memory's `MEMORY.md` (#1575). A built-in one's ships inside the command,
// with no path to open — this is the door onto it.

import { globalMemories } from '../lib/memories'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'

export function cmdMemoryFile(askedName: string): MoveResult {
  const name = askedName.trim()
  const all = globalMemories()
  const memory = all.find((m) => m.name === name)
  if (!memory) {
    const has = all.length ? `It has: ${all.map((m) => m.name).join(', ')}.` : 'It has none.'
    die(`"${name}" is not a global memory on this board. ${has}`, { kind: 'no-such-memory', memory: name })
  }
  say(memory.text)
  return { memory: memory.name, text: memory.text }
}
