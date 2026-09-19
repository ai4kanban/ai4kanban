import path from 'node:path'
import { withLock } from '../lock'
import { SESSIONS_DIR } from '../paths'

let depth = 0
export function withCreationLock<T>(fn: () => T): T {
  if (depth) return fn()
  return withLock(path.join(SESSIONS_DIR, 'creation.lock'), 'changing card creation', () => {
    depth++
    try { return fn() } finally { depth-- }
  })
}
