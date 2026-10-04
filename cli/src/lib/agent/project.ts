// `memory/project.md` is rewritten only when it has no body yet or a card was finished since
// the last pass (#1268), so a quiet day starts no agent.

import fs from 'node:fs'

import { PROJECT_MD } from '../paths'

/** Whether `project.md` holds a description — any `## ` section beyond the starter header. */
export function projectDescribed(): boolean {
  try {
    return /^## /m.test(fs.readFileSync(PROJECT_MD, 'utf8'))
  } catch {
    return false
  }
}
