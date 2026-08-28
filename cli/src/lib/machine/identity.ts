// Who this MACHINE is (#318).
//
// `~/.ai4kanban/machine.json`, beside the sign-in and the settings. A board attaches exactly
// one server, and a server is a machine — so the identity has to survive a restart, and it
// has to be the same one the desktop app and a terminal `akb` reach. That is why it is a
// file of its own rather than a key in `settings.json`: settings are preferences, and every
// reader there falls back silently on a file it cannot read. An identity that quietly
// regenerated would detach the board's server every time the file was damaged.

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { machineHome } from './home'

export interface Machine {
  /** Minted here, once. Opaque to Cloud, which only ever compares it. */
  id: string
  /** What a person recognises this machine by — its hostname. Never an address. */
  name: string
}

const machineFile = (): string => path.join(machineHome(), 'machine.json')

/** The name to show. `os.hostname()` on its own carries the mDNS suffix on macOS, which is
 *  noise in a sentence naming the machine that holds a board.
 *
 *  Exported because a screen naming this computer — Configuration → Runtimes (#344) — wants
 *  the name and nothing else. Reading it mints no identity: a pane that drew one would
 *  write a file into `~/.ai4kanban` for a board that never signed in to Cloud. */
export function machineName(): string {
  const raw = os.hostname().trim()
  return raw.replace(/\.local$/i, '') || 'this machine'
}

/**
 * This machine's identity, minted on the first call and kept after it.
 *
 * Null when it cannot be written: a machine with no home directory to write to cannot be a
 * board's server, and every caller here treats that as "this board runs nothing" rather than
 * as a failure worth a screen.
 */
export function thisMachine(): Machine | null {
  try {
    const held = JSON.parse(fs.readFileSync(machineFile(), 'utf8')) as Partial<Machine>
    if (typeof held.id === 'string' && held.id) {
      const name = machineName()
      // The hostname a laptop is renamed to is the name the board should show. Rewritten
      // here rather than left to go stale, and never the id.
      if (held.name !== name) write({ id: held.id, name })
      return { id: held.id, name }
    }
  } catch {
    // Never written, or damaged. Either way the next line writes one.
  }
  const fresh: Machine = { id: crypto.randomUUID(), name: machineName() }
  return write(fresh) ? fresh : null
}

function write(machine: Machine): boolean {
  try {
    fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
    const file = machineFile()
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(machine, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(tmp, file)
    return true
  } catch {
    return false
  }
}
