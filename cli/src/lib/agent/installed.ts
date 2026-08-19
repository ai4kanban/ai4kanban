// Which agents this machine can actually run.
//
// A picker that offers five agents to someone who has one installed sends them to a run
// that dies on `spawn cursor-agent ENOENT`. So each agent's command is looked up on the
// same PATH a run would be spawned on, before the agent is offered.
//
// Nothing is started. This reads the folders the PATH names and nothing else — no `which`,
// no `--version`, no spawn of any kind. Whether the CLI then works (a login, a key, a
// model it will answer for) is what `akb agent test` is for; this answers the one question
// a spawn asks first: is the binary there.
//
// It has to be cheap, because it runs on every page load and every time the picker opens:
// the PATH is read ONCE and every agent is answered out of that one read, so forty agents
// cost what four cost.
//
// And it is never cached. A CLI installed a minute ago has to count on the next look — a
// stale "not installed" is worse than the millisecond this costs.

import fs from 'node:fs'
import path from 'node:path'

const WINDOWS = process.platform === 'win32'

/** The extensions that make a bare name runnable on Windows, where `claude` on the PATH is
 *  really `claude.cmd`. PATHEXT is the machine's own list; the fallback is the one every
 *  Windows ships with. */
function windowsExtensions(): string[] {
  const raw = process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD'
  return raw
    .split(';')
    .map((ext) => ext.trim().toLowerCase())
    .filter(Boolean)
}

/** The binary a command line spawns — its first word, which is all that has to exist for
 *  the spawn to get off the ground. */
export function commandBinary(command: string): string {
  return command.split(/\s+/).filter(Boolean)[0] ?? ''
}

/** One read of the PATH, and a question that can be asked of it as many times as you like:
 *  would this command line find something to run?
 *
 *  Fresh on every call — the read is the point, and the answer it gives is only true of the
 *  moment it was taken. */
export function pathLookup(): (command: string) => boolean {
  const names = new Set<string>()
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue
    let entries: string[]
    try {
      entries = fs.readdirSync(dir)
    } catch {
      // A PATH entry that isn't there, or that we can't read, holds nothing for us.
      continue
    }
    // Windows matches a name whatever its case, so both sides of the comparison are lowered
    // there and neither is anywhere else.
    for (const entry of entries) names.add(WINDOWS ? entry.toLowerCase() : entry)
  }
  const extensions = WINDOWS ? windowsExtensions() : []

  return (command) => {
    const binary = commandBinary(command)
    if (!binary) return false
    // A command written as a path says where it lives, and the PATH has nothing to do with
    // it — so it is looked for exactly where it points, from the same directory a run is
    // spawned in.
    if (binary.includes('/') || binary.includes('\\')) return fs.existsSync(binary)
    if (!WINDOWS) return names.has(binary)
    const lower = binary.toLowerCase()
    return names.has(lower) || extensions.some((ext) => names.has(`${lower}${ext}`))
  }
}
