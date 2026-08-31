// What a runtime RUNS as on this computer (#343).
//
// `~/.ai4kanban/runtimes.json`, beside the sign-in and the settings:
//
//   {
//     "default": { "harness": "claude-code", "settings": { "model": "claude-opus-5" } },
//     "cheap":   { "harness": "codex", "settings": { "model": "gpt-5.1-codex" } }
//   }
//
// The board names the runtimes and says which one each flow runs on; this file says which
// coding tool each of those names is, here. So a team shares the names and nobody shares the
// tools — one member runs `cheap` on Codex and another on a local model, and neither writes
// that into the repository.
//
// Keyed by runtime name and not by board, so two checkouts of one board share a binding. The
// cost is that two different boards have to agree on runtime names to share a machine.
//
// API keys are never in here. They stay in `docs/kanban/.env`, read under the variable name
// each harness declares (agent/settings.ts).
//
// Nothing here fails: a missing file, an unreadable one, or an entry naming a harness this
// build does not ship all read as no binding, and the run falls back (agent/resolve.ts).

import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from './home'

/** What one runtime runs as here: a harness, and that harness's own settings. */
export interface RuntimeBinding {
  harness: string
  /** Keyed by the setting's key, the same keys `harnessSettings` uses in the board's file —
   *  plus `command`, the hand-written override for a custom binary. */
  settings: Record<string, string>
}

export const runtimesFile = (): string => path.join(machineHome(), 'runtimes.json')

// The file as it stands. Anything that is not an object — absent, half-written, an array —
// is no bindings at all.
function held(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(runtimesFile(), 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// One entry, read. Null for a shape nothing can be made of, which reads as no binding.
function parse(value: unknown): RuntimeBinding | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const harness = typeof raw.harness === 'string' ? raw.harness.trim() : ''
  if (!harness) return null
  const settings: Record<string, string> = {}
  for (const [key, v] of Object.entries(raw.settings && typeof raw.settings === 'object' ? raw.settings : {})) {
    if (typeof v === 'string' && v.trim()) settings[key] = v.trim()
  }
  return { harness, settings }
}

/** Every runtime this computer has bound, by name. */
export function readBindings(): Record<string, RuntimeBinding> {
  const out: Record<string, RuntimeBinding> = {}
  for (const [name, value] of Object.entries(held())) {
    const binding = parse(value)
    if (binding) out[name] = binding
  }
  return out
}

/** What one runtime is bound to here, or nothing when this computer has never said. */
export function readBinding(runtime: string): RuntimeBinding | null {
  return parse(held()[runtime])
}

/** Bind a runtime to a harness here, dropping whatever the old harness was set to — a
 *  Claude Code model id means nothing to Codex. Binding it to the harness it already has
 *  keeps the settings, so re-running the command is not a way to lose them. */
export function bindRuntime(runtime: string, harness: string): { ok: boolean; error?: string } {
  const current = readBinding(runtime)
  return save(runtime, {
    harness,
    settings: current?.harness === harness ? current.settings : {},
  })
}

/** Save one of the bound harness's settings here. An empty value drops the key, which is
 *  how a setting goes back to the harness's own default. */
export function setBindingSetting(runtime: string, key: string, value: string): { ok: boolean; error?: string } {
  const current = readBinding(runtime)
  if (!current) {
    return { ok: false, error: `"${runtime}" is not bound on this computer. Bind it first: \`akb agent bind ${runtime} <harness>\`.` }
  }
  const settings = { ...current.settings }
  const next = value.trim()
  if (next) settings[key] = next
  else delete settings[key]
  return save(runtime, { ...current, settings })
}

/** Give `to` a copy of what `from` runs as here — what a rename leaves behind (#344).
 *
 *  A copy and not a move: this file is keyed by runtime name alone, so every board on this
 *  machine shares an entry, and a rename on one board must not unbind a name another still
 *  uses. Nothing bound for `from` is nothing to copy, not a failure. */
export function copyBinding(from: string, to: string): { ok: boolean; error?: string } {
  const binding = readBinding(from)
  if (!binding || from === to) return { ok: true }
  return save(to, binding)
}

function save(runtime: string, binding: RuntimeBinding): { ok: boolean; error?: string } {
  return write((all) => {
    all[runtime] = binding
  })
}

// Read, change, write back — through a temporary file, so a reader never sees half of one,
// and keeping every entry this build did not touch.
function write(change: (all: Record<string, unknown>) => void): { ok: boolean; error?: string } {
  const all = held()
  change(all)
  try {
    fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
    const file = runtimesFile()
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(all, null, 2)}\n`)
    fs.renameSync(tmp, file)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: `couldn't write ${runtimesFile()}: ${err instanceof Error ? err.message : String(err)}` }
  }
}
