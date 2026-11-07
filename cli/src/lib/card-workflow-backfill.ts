// Every open card written before #494 names no workflow and ran on Coding. Write that down
// once, so no workflow has to be a default.

import fs from 'node:fs'
import path from 'node:path'

import { walkMd } from './cards'
import { BOARD_STATE, TODO } from './paths'

const MARK = 'card-workflows-backfilled'

/** Give each open card with no `workflow:` the `coding` one, once per board. Never throws. */
export function backfillCardWorkflows(): void {
  if (!TODO || !BOARD_STATE) return
  const mark = path.join(BOARD_STATE, MARK)
  try {
    if (fs.existsSync(mark) || !fs.existsSync(TODO)) return
    for (const file of walkMd(TODO)) {
      const text = fs.readFileSync(file, 'utf8')
      if (!text.startsWith('---\n')) continue
      const end = text.indexOf('\n---', 3)
      if (end < 0) continue
      const head = text.slice(0, end)
      if (!/\ntitle:/.test(head) || /\nworkflow:/.test(head)) continue
      const modules = /\nmodules:[^\n]*/.exec(head)
      const at = modules ? modules.index + modules[0].length : end
      fs.writeFileSync(file, `${text.slice(0, at)}\nworkflow: coding${text.slice(at)}`)
    }
    fs.mkdirSync(BOARD_STATE, { recursive: true })
    fs.writeFileSync(mark, '')
  } catch {
    // Tried again on the next command.
  }
}
