// Where the Runner keeps its files: the sign-in, this computer's id, the versions the
// launcher downloaded, the allowed project folders and the Runner's own working folder.

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** `WILDCRANE_HOME` moves it, which is what a test uses. */
export function runnerHome(): string {
  return process.env.WILDCRANE_HOME || path.join(os.homedir(), '.wildcrane')
}

/** The CLI's session code reads its folder from `AI4KANBAN_HOME`; point it here. */
export function useRunnerHome(): void {
  process.env.AI4KANBAN_HOME = runnerHome()
}

/** This computer's id, minted once. Opaque to Cloud: only equality is read. */
export function machineId(): string {
  const file = path.join(runnerHome(), 'machine.json')
  try {
    const held = JSON.parse(fs.readFileSync(file, 'utf8')) as { id?: string }
    if (held.id && /^[0-9a-f-]{36}$/i.test(held.id)) return held.id
  } catch {
    // Not minted yet.
  }
  const id = crypto.randomUUID()
  fs.mkdirSync(runnerHome(), { recursive: true, mode: 0o700 })
  fs.writeFileSync(file, `${JSON.stringify({ id })}\n`)
  return id
}

export const machineName = (): string => os.hostname().replace(/\.local$/, '')
