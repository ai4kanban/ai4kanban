// ---- closing a group root with its last subtask (#299) ----------------------
//
// A group is over the moment its pieces are, so nothing about the root's archive is a
// judgment call — `groupCloseOf` is the arithmetic that says so. It only decides; the archive
// itself is `cmdRemove`'s, so the root leaves the board by exactly the path a hand-pressed
// Archive takes.

import fs from 'node:fs'

import { groupCloseOf, type GroupCloseCall } from './leaving'

export type { GroupCloseCall }

export function groupCloseCall(rootFile: string): GroupCloseCall {
  let text: string
  try {
    text = fs.readFileSync(rootFile, 'utf8')
  } catch {
    return { close: false, held: null }
  }
  return groupCloseOf(text)
}
