import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { runnerHome } from './home'

const file = () => path.join(runnerHome(), 'preferences.json')
function read(): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(file(), 'utf8'))
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  } catch { return {} }
}
export const acceptAlphaUpdates = () => read().acceptAlphaUpdates === true

export function saveAlphaUpdates(value: boolean): void {
  const target = file(), temporary = `${target}.${crypto.randomUUID()}.tmp`
  fs.mkdirSync(runnerHome(), { recursive: true, mode: 0o700 })
  try {
    fs.writeFileSync(temporary, JSON.stringify({ ...read(), acceptAlphaUpdates: value }) + '\n', { mode: 0o600 })
    fs.renameSync(temporary, target)
  } finally { fs.rmSync(temporary, { force: true }) }
}
