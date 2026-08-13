// Starting the process that watches a run, and letting go of it.
//
// The watcher is spawned detached, with nothing attached to this terminal: close the
// window and the agent keeps working. That is the whole reason a run has a process of its
// own rather than living inside the command that asked for it.
//
// What it spawns is THIS file — the one built file the board's rules ship as, whichever
// copy of it is running: the one in the npm package, the one in an installed skill folder,
// or the one inside the desktop app. So a run started by any of them is watched by the
// same code, and nothing has to be told where the command lives.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { REPO_ROOT, SESSIONS_DIR } from '../paths'

/** The built file this code is running as. */
export const SELF = fileURLToPath(import.meta.url)

/** Spawn the watcher for a run that has already been written down, and return its pid.
 *  Undefined when the spawn itself failed — then nothing is watching, and the run is
 *  closed out by whoever asked for it. */
export function spawnWatcher(sessionId: string): number | undefined {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  // Anything the watcher says for itself — a crash before it can write a log — goes here
  // rather than to a terminal that may already be gone.
  const out = fs.openSync(path.join(SESSIONS_DIR, `${sessionId}.watch.log`), 'a')
  try {
    const child = spawn(process.execPath, [SELF, '__watch', sessionId, '--dir', REPO_ROOT], {
      cwd: REPO_ROOT,
      env: process.env,
      // Its own process group, so a Ctrl-C in the terminal that started the run doesn't
      // reach the agent — and so a stop can signal this run and nothing else.
      detached: true,
      stdio: ['ignore', out, out],
    })
    // Let go: this command exits when it is done, however long the run takes.
    child.unref()
    return child.pid
  } catch {
    return undefined
  } finally {
    try {
      fs.closeSync(out)
    } catch {
      // ignore
    }
  }
}
