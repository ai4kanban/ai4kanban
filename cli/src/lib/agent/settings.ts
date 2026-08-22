// The board's agent settings, and the one place keys live.
//
// Two files, both beside the board:
//
//   docs/kanban/ui.config.json  which agent runs, and what each one is set to.
//   docs/kanban/.env            every key the board uses, and nowhere else — never in
//                               ui.config.json, never in a shell profile.
//
// The local UI has written both since they existed and the CLI writes the same two.
// Renaming either would break every board that has one, for nothing a user would notice.
//
// ui.config.json reads:
//
//   "harness": "claude-code",
//   "harnessSettings": {
//     "claude-code": { "model": "claude-opus-5", "command": "claude -p" },
//     "codex": { "model": "gpt-5.1-codex" }
//   },
//   "specAgents": {
//     "technology-selection": false,
//     "ui-design": { "enabled": false, "mockupStyle": "ascii" }
//   }
//
// `harness` is the name of the agent that runs, and nothing else. Every agent keeps its
// own settings in `harnessSettings`, under its own name, whether or not it is the one
// picked — so switching agents changes which block is read and throws nothing away. Inside
// a block, `command` is an optional override for a custom binary or extra flags,
// hand-edited in the file; every other key is one of the settings that agent declares.
//
// A key no setting declares is left exactly where it is: this is the user's file, and
// nothing here rewrites a line they wrote.

import fs from 'node:fs'
import path from 'node:path'

import { ENV_FILE, KANBAN_GITIGNORE, UI_CONFIG } from '../paths'
import { harnessByName, DEFAULT_HARNESS } from './harnesses'

// ---- ui.config.json --------------------------------------------------------

/** One block out of the config file — the `harnessSettings` map, or one agent's settings
 *  inside it. Anything that isn't a plain object reads as empty, so a hand-edit that put a
 *  string or a list where a block belongs is ignored rather than spread into a run. */
export function configBlock(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

/** Read and parse the whole config object. Throws on a malformed file so a writer never
 *  clobbers a user's settings; a missing file is an empty object. */
export function readConfigRaw(): Record<string, unknown> {
  if (!fs.existsSync(UI_CONFIG)) return {}
  return JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8'))
}

/** The name of the agent that runs for a config file's `harness` value: the one it names,
 *  when we ship it, and the default otherwise. Its block in `harnessSettings` is the
 *  picked agent's settings — so the writer and the reader always mean the same block. */
export function pickedHarnessName(configured: unknown): string {
  const asked = typeof configured === 'string' ? configured.trim() : ''
  return (harnessByName(asked) ?? DEFAULT_HARNESS).name
}

/** Save the agent that runs — one name, and nothing else moves. Every agent's settings
 *  already live under its own name, so switching writes no setting, reads none, and loses
 *  none: the agent you leave keeps its model, its endpoint and its `command` override
 *  exactly as they were, and picking it again brings them all back. */
export function setHarness(name: string): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    cfg.harness = name
  })
}

/** Save one of the settings the picked agent declares — Claude Code's `model` writes
 *  `harnessSettings.claude-code.model`. Writes that one key in that one agent's block and
 *  nothing else: a hand-edited `command`, that agent's other settings, every other agent's
 *  block and any key no setting declares all survive untouched.
 *
 *  An empty value means "use the agent's own default" — that drops the key rather than
 *  leaving an empty string behind, because a missing key and a blank one mean the same
 *  thing and only one of them reads as deliberate. A block with nothing left in it goes
 *  too, so clearing a setting doesn't leave an empty husk behind.
 *
 *  The value is never checked here. Model ids change faster than we ship, so the agent is
 *  the only validator: a bad one makes the run exit non-zero and the reason is in its log.
 *  That the key is one the picked agent declares IS checked, by the command above this. */
export function setHarnessSetting(key: string, value: string): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    const name = pickedHarnessName(cfg.harness)
    const blocks = { ...configBlock(cfg.harnessSettings) }
    const block = { ...configBlock(blocks[name]) }
    const next = value.trim()
    if (next) block[key] = next
    else delete block[key]
    if (Object.keys(block).length) blocks[name] = block
    else delete blocks[name]
    if (Object.keys(blocks).length) cfg.harnessSettings = blocks
    else delete cfg.harnessSettings
  })
}

// ---- the spec agents: the switch, and what each one is set to (#191, #255) --
//
// The same file also holds which spec agents may run, and what each one is set to:
//
//   "specAgents": {
//     "technology-selection": false,
//     "ui-design": { "enabled": false, "mockupStyle": "ascii" }
//   }
//
// An agent the file doesn't name is on, with every setting at its default. A plain boolean
// is the switch on its own — the shape written before settings existed, read the same way
// it always was. An entry that is neither reads as on with every default, because a
// hand-edit that put a string or a list here says nothing anyone can act on.
//
// Only what somebody changed is written down: switching an agent back on drops `enabled`
// rather than writing `true`, and a value put back to its default drops its key. The two
// are independent — flipping the switch leaves the picked values alone, and picking a value
// leaves the switch alone.

/** One spec agent's entry, read. */
export interface SpecAgentEntry {
  enabled: boolean
  /** The picked values, by setting key — only the ones the file carries. Filling the rest
   *  in from the agent's own defaults is `lib/spec-agents.ts`'s, which is the only side
   *  that knows what an agent offers. */
  values: Record<string, string>
}

// One entry as the file holds it. Null for a shape we can't read, which the callers take as
// "nothing saved for this agent".
function parseSpecEntry(value: unknown): SpecAgentEntry | null {
  if (typeof value === 'boolean') return { enabled: value, values: {} }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const values: Record<string, string> = {}
  for (const [key, v] of Object.entries(raw)) {
    if (key !== 'enabled' && typeof v === 'string') values[key] = v
  }
  return { enabled: raw.enabled !== false, values }
}

// One agent's entry under its current name or a name it used to have. The first name that
// carries a readable entry is the one that counts.
function entryOf(block: Record<string, unknown>, names: string[]): SpecAgentEntry | null {
  for (const name of names) {
    const entry = parseSpecEntry(block[name])
    if (entry) return entry
  }
  return null
}

/** Which spec agents the file says something about, and what it says. A malformed file
 *  reads as nothing saved at all: an agent nobody can decide about is an agent that runs. */
export function specAgentEntries(): Record<string, SpecAgentEntry> {
  let cfg: Record<string, unknown>
  try {
    cfg = readConfigRaw()
  } catch {
    return {}
  }
  const saved: Record<string, SpecAgentEntry> = {}
  for (const [name, value] of Object.entries(configBlock(cfg.specAgents))) {
    const entry = parseSpecEntry(value)
    if (entry) saved[name] = entry
  }
  return saved
}

/** Save one spec agent's switch, keeping whatever it is set to. Every other key in the file
 *  is left as it is — this is the same file the harness settings live in. */
export function setSpecAgentSwitch(
  name: string,
  on: boolean,
  legacyNames: string[] = [],
): { ok: boolean; error?: string } {
  return writeSpecAgentEntry(name, legacyNames, (entry) => ({ ...entry, enabled: on }))
}

/** Save one of the settings a spec agent declares, leaving its switch and its other values
 *  alone. An empty value drops the key, which is how a value goes back to its default: a
 *  missing key and one holding the default mean the same thing, and only one of them reads
 *  as deliberate.
 *
 *  That the key and the value are ones the agent offers is checked by the caller above this
 *  (`lib/spec-agents.ts`), which is the side that knows. */
export function setSpecAgentValue(
  name: string,
  key: string,
  value: string,
  legacyNames: string[] = [],
): { ok: boolean; error?: string } {
  return writeSpecAgentEntry(name, legacyNames, (entry) => {
    const values = { ...entry.values }
    const next = value.trim()
    if (next) values[key] = next
    else delete values[key]
    return { ...entry, values }
  })
}

// Read one agent's entry, change it, and write it back in the file's own shape: nothing at
// all when the agent is on with nothing picked, a plain boolean for a switch on its own,
// and the object only when there is something to keep. A name the agent used to have goes,
// so the entry is never split across two spellings.
function writeSpecAgentEntry(
  name: string,
  legacyNames: string[],
  change: (entry: SpecAgentEntry) => SpecAgentEntry,
): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    const block = { ...configBlock(cfg.specAgents) }
    const entry = change(entryOf(block, [name, ...legacyNames]) ?? { enabled: true, values: {} })
    for (const legacy of legacyNames) delete block[legacy]
    delete block[name]
    if (Object.keys(entry.values).length) {
      block[name] = entry.enabled ? { ...entry.values } : { enabled: false, ...entry.values }
    } else if (!entry.enabled) {
      block[name] = false
    }
    if (Object.keys(block).length) cfg.specAgents = block
    else delete cfg.specAgents
  })
}

// Read the config, apply one change, write it back — the shared body of every setter. A
// file that won't parse fails the save instead of overwriting it: losing the user's
// settings is worse than a failed save.
function writeConfig(change: (cfg: Record<string, unknown>) => void): { ok: boolean; error?: string } {
  let cfg: Record<string, unknown>
  try {
    cfg = readConfigRaw()
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `couldn't save: ${UI_CONFIG} won't parse (${why}). Fix the file, then try again.` }
  }
  change(cfg)
  try {
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.writeFileSync(UI_CONFIG, JSON.stringify(cfg, null, 2) + '\n')
    return { ok: true }
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `couldn't write ${UI_CONFIG}: ${why}` }
  }
}

// ---- docs/kanban/.env: the board's one place for keys -----------------------
//
// Plain `NAME=value` lines, one per line, because it is hand-edited as often as it is
// written: you type a key into a dialog and it lands here, or you write the line yourself,
// and both read back the same.
//
// The board reads this file for WHICH keys it holds, never for what to show. A saved key
// is never read back — set or not set — so a hand-written key reads as set and works in
// the next run, with no restart and no second place to keep it in step.
//
// Which variable a key reaches a run under is the setting's business: a secret setting
// names its variable, and a run gets that one set from this file. A variable this file
// doesn't name is left exactly as the run's parent had it.

// A line that sets a variable, or null for a blank line, a comment, or anything that isn't
// `NAME=value`. A value wrapped in quotes is read without them — the file is hand-edited,
// so it reads the way people write one. Anything else is kept verbatim, spaces and all: a
// key can hold characters we have no business guessing at.
function parseLine(line: string): { name: string; value: string } | null {
  const text = line.trim()
  if (!text || text.startsWith('#')) return null
  const eq = text.indexOf('=')
  if (eq <= 0) return null
  const name = text.slice(0, eq).trim()
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null
  return { name, value: unquote(text.slice(eq + 1).trim()) }
}

function unquote(value: string): string {
  const quote = value[0]
  if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
    return value.slice(1, -1)
  }
  return value
}

/** Every variable the file sets, by name. A missing or unreadable file holds nothing — a
 *  board with no keys is the normal case, not a failure. A line with an empty value is
 *  left out: an empty key and a missing one mean the same thing. */
export function readEnvFile(): Record<string, string> {
  let text: string
  try {
    text = fs.readFileSync(ENV_FILE, 'utf8')
  } catch {
    return {}
  }
  const values: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const pair = parseLine(line)
    if (pair && pair.value) values[pair.name] = pair.value
  }
  return values
}

// What the board writes into docs/kanban/.gitignore, so a fresh board is safe without the
// user editing anything. It goes in the board's OWN ignore file, never the repo's root
// one: that file is the user's, and a board that edits it is a board that surprises them.
const IGNORE_BLOCK = "# The board's API keys — never commit them.\n.env\n"

// Make sure `.env` can't be committed, and say so if it can't be arranged. A file already
// there gets the line added, not replaced — comments, order and every other rule in it are
// the user's.
//
// This runs BEFORE a key is written, and a failure refuses the save: writing a key we
// can't keep out of git is worse than not saving it.
function ensureIgnored(): { ok: boolean; error?: string } {
  try {
    if (!fs.existsSync(KANBAN_GITIGNORE)) {
      fs.mkdirSync(path.dirname(KANBAN_GITIGNORE), { recursive: true })
      fs.writeFileSync(KANBAN_GITIGNORE, IGNORE_BLOCK)
      return { ok: true }
    }
    const text = fs.readFileSync(KANBAN_GITIGNORE, 'utf8')
    if (text.split('\n').some((line) => line.trim() === '.env')) return { ok: true }
    const separator = !text || text.endsWith('\n') ? '' : '\n'
    fs.writeFileSync(KANBAN_GITIGNORE, `${text}${separator}${IGNORE_BLOCK}`)
    return { ok: true }
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `couldn't write ${KANBAN_GITIGNORE} to keep the key out of git: ${why}` }
  }
}

/** Save one key, or clear it when the value is empty. Rewrites that one line and leaves
 *  every other line alone — a key the board doesn't know, a comment, the order they sit
 *  in. The file is the user's as much as ours.
 *
 *  It is created 0600 (owner only): it holds keys, and on a shared machine the default
 *  would let anyone else on it read them. */
export function setSecret(name: string, value: string): { ok: boolean; error?: string } {
  const ignored = ensureIgnored()
  if (!ignored.ok) return ignored

  let lines: string[]
  try {
    lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8').split('\n') : []
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `couldn't read ${ENV_FILE}: ${why}` }
  }

  const next = value.trim()
  const kept: string[] = []
  let written = false
  for (const line of lines) {
    const pair = parseLine(line)
    if (!pair || pair.name !== name) {
      kept.push(line)
      continue
    }
    if (!next || written) continue // cleared, or a duplicate of the line we just rewrote
    kept.push(`${name}=${next}`)
    written = true
  }
  let text = kept.join('\n')
  if (text && !text.endsWith('\n')) text += '\n'
  if (next && !written) text += `${name}=${next}\n`

  try {
    fs.writeFileSync(ENV_FILE, text, { mode: 0o600 })
    return { ok: true }
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `couldn't write ${ENV_FILE}: ${why}` }
  }
}
