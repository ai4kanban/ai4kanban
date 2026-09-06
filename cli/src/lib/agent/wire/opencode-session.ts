// The model OpenCode's own event stream leaves out.
//
// `opencode run --format json` names no model on any event it prints — see the note at the
// top of opencode-stream.ts. `opencode export <session>` does: it prints the whole session
// as JSON on stdout, and its `info.model` is `{providerID, id}`, which is the same
// `provider/model` the Model box and `--model` are written in.
//
// The command is asked rather than the storage read. OpenCode keeps its sessions in a
// SQLite database of its own now — a schema it publishes nothing about, behind a driver the
// CLI's Node floor doesn't carry — and `export` is the published way in.
//
// Asked ONCE, after the stream has ended, and never while it runs: this spawns a second
// OpenCode, and the session names no model until the first model call has been made.
//
// Every failure here is silent and means "not known" — an OpenCode that dropped the
// command, a session living on the server `--attach` pointed at, a command line whose first
// word is not an opencode to ask. All of them already have an answer: the panel shows a
// blank.

import { spawnSync } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import { obj, str } from './json'

// Long enough for a cold start of a large binary, short enough that a wedged one doesn't
// hold up the end of a run.
const TIMEOUT_MS = 15_000

// True for a command line whose first word is an opencode to ask. A `command` override that
// starts with something else is left alone: `npx export <id>` is not this question, and
// would go looking for a package by that name.
function isOpencode(binary: string): boolean {
  return /^opencode(\.\w+)?$/i.test(basename(binary))
}

// The export goes to a FILE and never down a pipe. `opencode export` writes the whole
// document in one go and exits without waiting for it to drain, so a pipe hands back only
// what its buffer held — 64 KiB, and a session longer than that arrives cut mid-word. A
// file gets all of it. (`opencode run` is unaffected: the board reads that stream as the
// events arrive, so its pipe is never the thing holding the bytes.)
function exportedSession(binary: string, sessionId: string, cwd?: string): string | undefined {
  const dir = mkdtempSync(join(tmpdir(), 'akb-opencode-'))
  const file = join(dir, 'session.json')
  try {
    const fd = openSync(file, 'w')
    try {
      const out = spawnSync(binary, ['export', sessionId], {
        cwd,
        stdio: ['ignore', fd, 'ignore'],
        timeout: TIMEOUT_MS,
        windowsHide: true,
      })
      if (out.status !== 0) return undefined
    } finally {
      closeSync(fd)
    }
    return readFileSync(file, 'utf8')
  } catch {
    return undefined
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The `provider/model` an OpenCode session ran on, or nothing at all. */
export function opencodeSessionModel(
  binary: string | undefined,
  sessionId: string,
  cwd?: string,
): string | undefined {
  if (!binary || !isOpencode(binary)) return undefined
  const raw = exportedSession(binary, sessionId, cwd)
  if (!raw) return undefined
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return undefined
  }
  const model = obj(obj(obj(data).info).model)
  const id = str(model.id).trim()
  const provider = str(model.providerID).trim()
  if (!id) return undefined
  return provider ? `${provider}/${id}` : id
}
