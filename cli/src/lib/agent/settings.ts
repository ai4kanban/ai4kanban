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
//   "runtimes": [
//     { "id": "global", "name": "Global default", "harness": "claude-code",
//       "settings": { "baseUrl": "https://…", "model": "claude-opus-5" } }
//   ],
//   "agentRuntime": { "builder": "cheap" },
//   "specAgents": {
//     "tech-stack-advisor": false,
//     "ui-designer": { "enabled": false, "mockupStyle": "ascii" }
//   }
//
// What a run runs as is one runtime, and all of it — harness, provider, endpoint, key, model
// id, reasoning, extra arguments — is that one row (./runtimes.ts). This file owns the reading
// and writing of `ui.config.json` itself, the spec agents' entries, and `docs/kanban/.env`.
//
// A key no setting declares is left exactly where it is: this is the user's file, and
// nothing here rewrites a line they wrote.

import fs from 'node:fs'
import path from 'node:path'

import { CADENCE_FORMS, formatStamp, parseCadence } from '../cadence'
import { ENV_FILE, KANBAN_GITIGNORE, UI_CONFIG } from '../paths'
import type { MemoryPruneSchedule } from './types'

// ---- ui.config.json --------------------------------------------------------

/** One block out of the config file — a runtime's settings, or one spec agent's entry.
 *  Anything that isn't a plain object reads as empty, so a hand-edit that put a string or a
 *  list where a block belongs is ignored rather than spread into a run. */
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

/** The config as a reader takes it: an unreadable or malformed file holds nothing, so a
 *  hand-edit that broke the JSON runs the defaults rather than stopping the board. Writers
 *  use `readConfigRaw` instead — a save that overwrote a file it couldn't read would lose
 *  the user's settings. */
export function safeConfig(): Record<string, unknown> {
  try {
    return readConfigRaw()
  } catch {
    return {}
  }
}

// ---- auto-delivery: may the board commit? (#303) ---------------------------
//
//   "autoCommit": false
//
// On by default, and only written down when somebody turned it off — a missing key and a
// `true` mean the same thing, and only one of them reads as deliberate.
//
// With it ON a delivery builds on its own branch in its own worktree, so several can run at
// once and what review passed is exactly what lands. With it OFF a delivery works in the
// user's own checkout, one at a time, and they commit after review.

/** True unless somebody switched automatic commits off. A file that won't parse reads as
 *  on: a setting nobody can read is not a reason to change how every delivery works. */
export function autoCommitAllowed(): boolean {
  try {
    return readConfigRaw().autoCommit !== false
  } catch {
    return true
  }
}

/** Save it. Turning it back on drops the key rather than writing `true`. */
export function setAutoCommit(on: boolean): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    if (on) delete cfg.autoCommit
    else cfg.autoCommit = false
  })
}

// ---- auto-delivery: must the tree be approved before it lands? (#308) ------
//
//   "requireDiffApproval": true
//
// OFF by default, and only written down when somebody turned it on — requiring it on every
// card puts the user back in the loop for every change, which is what auto-delivery exists
// to remove.
//
// With it ON every delivery waits, after review has passed it, until the user approves the
// exact tree it would land. It has nothing to hold in manual commit mode: the board never
// commits there, so the user's own commit IS the approval.

/** True only when somebody switched diff approval on. A file that won't parse reads as
 *  off: the stricter policy is the deliberate one, and a setting nobody can read is not a
 *  reason to start holding every delivery. */
export function diffApprovalRequired(): boolean {
  try {
    return readConfigRaw().requireDiffApproval === true
  } catch {
    return false
  }
}

/** Save it. Turning it back off drops the key rather than writing `false`. */
export function setDiffApproval(on: boolean): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    if (on) cfg.requireDiffApproval = true
    else delete cfg.requireDiffApproval
  })
}

// ---- auto-delivery: does a build get an AI review? (#416) ------------------
//
//   "aiReview": false
//
// On by default, and only written down when somebody turned it off — the same call
// `autoCommit` made, and for the same reason.
//
// With it ON every delivery gets a fresh review run after its implementation. With it OFF
// the implementation is the last agent to read the code: the repository's required checks
// still run, and the open-question hold and diff approval still gate landing.
//
// It is the reviewer's switch (#509), flipped on the reviewer's tile in Configuration →
// Agents. The key is the one it was always written under, so a board that turned review off
// keeps its answer.

/** True unless somebody switched AI review off. */
export const aiReviewEnabled = (): boolean => switchedOn('aiReview')

/** Save it. Turning it back on drops the key rather than writing `true`. */
export const setAiReview = (on: boolean): { ok: boolean; error?: string } => setSwitch('aiReview', on)

// ---- auto-delivery: does a ready card start its own build? (#440) ----------
//
//   "readyGate": true
//
// OFF by default, and only written down when somebody turned it on — the same call
// `requireDiffApproval` made, and for the same reason: switching it on is the deliberate
// act, and a board that says nothing behaves exactly as it always did.
//
// With it ON every card that reaches `ready` is judged by one `gate` run first. A card it
// passes goes straight into a delivery, on this board's saved delivery settings; a card it
// fails gets one `[user]` question, which takes it back to `todo` for the user to answer.
//
// It is the gater's switch (#493), turned on in Configuration → Agents. The key is the one
// it was written under, so a board that turned the gate on before the split keeps it.

/** True only when somebody switched the ready gate on. A file that won't parse reads as
 *  off: a setting nobody can read is not a reason to start spending runs and building
 *  cards by itself. */
export const readyGateOn = (): boolean => switchedOn('readyGate')

/** Save it. Turning it back off drops the key rather than writing `false`. */
export const setReadyGate = (on: boolean): { ok: boolean; error?: string } => setSwitch('readyGate', on)

// ---- the decider: does the board answer your questions for you? (#447) ------
//
//   "decider": true
//
// OFF by default, and only written down when somebody turned it on — the same call the
// ready gate made, and for a stronger version of the same reason: this is the most expensive
// switch on the board.
//
// With it ON, a card left with nothing but `[user]` questions is answered by one `decide`
// run instead of waiting for the user — after QA converges, and after a review sends a
// delivery back. Nothing stops for the user any more: a wrong direction is built and landed
// just the same, and what it chose is read afterwards on the card.

/** True only when somebody switched the decider on. A file that won't parse reads as off: a
 *  setting nobody can read is not a reason to start answering for the user. */
export const deciderOn = (): boolean => switchedOn('decider')

/** Save it. Turning it back off drops the key rather than writing `false`. */
export const setDecider = (on: boolean): { ok: boolean; error?: string } => setSwitch('decider', on)

// ---- the proposer: does a finished card propose what comes next? (#534) -----
//
//   "proposer": true
//
// OFF by default, and only written down when somebody turned it on — the same call the
// ready gate and the decider made. With it ON, every card that reaches the archive starts
// one `reflect` run over that card alone, which is a paid run per completion.
//
// What it writes lands in `docs/kanban/triage/`, never on the board: a proposal is
// triaged like anything else that arrives there, so a weak one costs a dismissal. Turning
// it off again leaves nothing behind — there is no state but this key.

/** True only when somebody switched the proposer on. A file that won't parse reads as off:
 *  a setting nobody can read is not a reason to start spending a run per completion. */
export const proposerOn = (): boolean => switchedOn('proposer')

/** Save it. Turning it back off drops the key rather than writing `false`. */
export const setProposer = (on: boolean): { ok: boolean; error?: string } => setSwitch('proposer', on)

// ---- a switchable role's own key (#493, #509, #534) ------------------------
//
// Four of the switches above are roles that can be switched off: the gater runs the ready
// gate, the decider answers for the user, the reviewer judges what was built, the proposer
// reflects on what was finished. The three that predate the split keep the key they have
// always had, so a board that already answered any of them keeps its answer, and the roster
// reads a role through its own key rather than asking one role's question of them all.
//
// They do not all ship the same way round. The three that spend a run the user never asked
// for are off until asked for; the reviewer ships on. Either way the file records only what
// somebody changed.

/** The keys a switchable role is saved under (./roles.ts). */
export type RoleSwitch = 'readyGate' | 'decider' | 'aiReview' | 'proposer'

/** The keys whose role ships ON, so only switching it OFF is written down. */
const ON_BY_DEFAULT = new Set<RoleSwitch>(['aiReview'])

/** Whether the role behind this key is on. A file that won't parse reads as the default: a
 *  setting nobody can read is not a reason to change what the board does. */
export function switchedOn(key: RoleSwitch): boolean {
  const shipsOn = ON_BY_DEFAULT.has(key)
  try {
    return shipsOn ? readConfigRaw()[key] !== false : readConfigRaw()[key] === true
  } catch {
    return shipsOn
  }
}

/** Save it. Back at the default drops the key rather than writing it down. */
export function setSwitch(key: RoleSwitch, on: boolean): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    if (on === ON_BY_DEFAULT.has(key)) delete cfg[key]
    else cfg[key] = on
  })
}

// ---- how long a run may say nothing (#394) ---------------------------------
//
//   "silenceMinutes": 20
//
// 10 by default, and only written down when somebody changed it. `0` switches the watchdog
// off entirely, which is what rules from before this setting did.
//
// The dialog writes whole minutes. A hand-edited fraction is honoured exactly as written —
// nothing needs rounding here, and a value under a minute is how the limit is checked in a
// second rather than in ten.

/** The limit a board that hasn't said otherwise runs on, in minutes. */
export const SILENCE_MINUTES = 10

/** How long a run may produce nothing before the board ends it, in minutes. `0` never ends
 *  one. A missing, negative or unreadable value is the default: a file nobody can parse is
 *  not a reason to leave hung runs holding their cards forever. */
export function silenceMinutes(): number {
  try {
    const raw = readConfigRaw().silenceMinutes
    return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : SILENCE_MINUTES
  } catch {
    return SILENCE_MINUTES
  }
}

/** Save it, in whole minutes. Back at the default drops the key rather than writing 10. */
export function setSilenceMinutes(minutes: number): { ok: boolean; error?: string } {
  if (!Number.isInteger(minutes) || minutes < 0) {
    return { ok: false, error: 'that setting is a whole number of minutes, or 0 to switch it off' }
  }
  return writeConfig((cfg) => {
    if (minutes === SILENCE_MINUTES) delete cfg.silenceMinutes
    else cfg.silenceMinutes = minutes
  })
}

// ---- the spec agents: the switch, and what each one is set to (#191, #255) --
//
// The same file also holds which spec agents may run, and what each one is set to:
//
//   "specAgents": {
//     "tech-stack-advisor": false,
//     "ui-designer": { "enabled": false, "output": "agent", "mockupStyle": "ascii" }
//   }
//
// `enabled` and `output` are the entry's own keys — the board's two answers about an
// agent — and every other key is one of the settings that agent declares.
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
   *  in from the agent's own defaults is `lib/agents/`'s, which is the only side
   *  that knows what an agent offers. */
  values: Record<string, string>
  /** Who this agent's output is for (#445), when somebody has said. A reserved key in the
   *  entry, never one of the values above — an agent that declared an `output` setting
   *  would otherwise fight it. */
  output?: string
}

// One entry as the file holds it. Null for a shape we can't read, which the callers take as
// "nothing saved for this agent". `runtime` is read and dropped: a board written before #443
// has one, and the agent it pointed at runs the board's harness now.
const RESERVED_SPEC_KEYS = ['enabled', 'runtime', 'output']

function parseSpecEntry(value: unknown): SpecAgentEntry | null {
  if (typeof value === 'boolean') return { enabled: value, values: {} }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const values: Record<string, string> = {}
  for (const [key, v] of Object.entries(raw)) {
    if (!RESERVED_SPEC_KEYS.includes(key) && typeof v === 'string') values[key] = v
  }
  const output = typeof raw.output === 'string' ? raw.output.trim() : ''
  return { enabled: raw.enabled !== false, values, ...(output ? { output } : {}) }
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
 *  (`lib/agents/`), which is the side that knows. */
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

/** Save who one spec agent's output is for (#445), leaving its switch and its own values
 *  alone. An empty value drops the key, which is how it goes back to the default its
 *  `AGENT.md` starts it at.
 *
 *  That the word is one the board offers is checked by the caller above this
 *  (`lib/agents/`), the way an agent's own settings are. */
export function setSpecAgentOutput(
  name: string,
  output: string,
  legacyNames: string[] = [],
): { ok: boolean; error?: string } {
  const next = output.trim()
  return writeSpecAgentEntry(name, legacyNames, ({ output: _was, ...entry }) =>
    next ? { ...entry, output: next } : entry,
  )
}

/** Drop one spec agent's entry entirely — its switch, who its output is for and every value
 *  it had picked. Called when the agent itself is deleted: a settings block for an agent
 *  nobody has is a line the user can neither read nor reach. */
export function forgetSpecAgent(name: string, legacyNames: string[] = []): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    const block = { ...configBlock(cfg.specAgents) }
    for (const key of [name, ...legacyNames]) delete block[key]
    if (Object.keys(block).length) cfg.specAgents = block
    else delete cfg.specAgents
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
    const body = {
      ...(entry.enabled ? {} : { enabled: false }),
      ...(entry.output ? { output: entry.output } : {}),
      ...entry.values,
    }
    if (Object.keys(body).length > (entry.enabled ? 0 : 1)) block[name] = body
    else if (!entry.enabled) block[name] = false
    if (Object.keys(block).length) cfg.specAgents = block
    else delete cfg.specAgents
  })
}

/** Read the config, apply one change, write it back — the shared body of every setter,
 *  here and in ./runtimes.ts. A file that won't parse fails the save instead of overwriting
 *  it: losing the user's settings is worse than a failed save. */
export function writeConfig(change: (cfg: Record<string, unknown>) => void): { ok: boolean; error?: string } {
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

// ---- the memory pruner's schedule (#514) ------------------------------------
//
//   "memoryPrune": { "enabled": true, "cadence": "1d at 09:30", "lastRun": "2026-09-08 09:30" }
//
// Pruning used to be a recurring card. It is an agent now (`agent/roles.ts`), so what a card
// carried in its frontmatter — the cadence, the last pass — is kept here instead, in the
// board's own settings file rather than a state file of its own.
//
// Recurrence is OFF until somebody asks for it, migration included: a pass rewrites every
// memory file, and a job that started itself the day a board upgraded is not one anybody
// chose. A cadence with `enabled` false is a preference the board holds and never acts on.
//
// `lastRun` moves only on a pass that PASSED, which is what stops a failing prune from
// firing again every tick.

const NO_PRUNE: MemoryPruneSchedule = { enabled: false, cadence: '', lastRun: '' }

/** What the file says about the pruner. A file that won't parse, or a block written by
 *  hand into some other shape, reads as nothing scheduled: a setting nobody can read is
 *  not a reason to start rewriting the memory. */
export function memoryPrune(): MemoryPruneSchedule {
  let cfg: Record<string, unknown>
  try {
    cfg = readConfigRaw()
  } catch {
    return NO_PRUNE
  }
  const block = configBlock(cfg.memoryPrune)
  const cadence = typeof block.cadence === 'string' ? block.cadence.trim() : ''
  const lastRun = typeof block.lastRun === 'string' ? block.lastRun.trim() : ''
  // A schedule can only be on with a cadence the board can act on, whatever the file says:
  // `enabled: true` beside a cadence nothing parses would be a switch that starts nothing.
  return { enabled: block.enabled === true && parseCadence(cadence) !== null, cadence, lastRun }
}

/** Save the opt-in and the cadence, keeping the last run. Switching it on needs a cadence
 *  the board can read — an invalid one can never activate a schedule. */
export function setMemoryPrune(next: { enabled: boolean; cadence: string }): { ok: boolean; error?: string } {
  const cadence = next.cadence.trim()
  if ((next.enabled || cadence) && parseCadence(cadence) === null) {
    return { ok: false, error: `"${cadence}" isn't a cadence — use ${CADENCE_FORMS}` }
  }
  return writeConfig((cfg) => {
    const block = configBlock(cfg.memoryPrune)
    const lastRun = typeof block.lastRun === 'string' ? block.lastRun.trim() : ''
    const body = {
      ...(next.enabled ? { enabled: true } : {}),
      ...(cadence ? { cadence } : {}),
      ...(lastRun ? { lastRun } : {}),
    }
    if (Object.keys(body).length) cfg.memoryPrune = body
    else delete cfg.memoryPrune
  })
}

/** Record a prune that passed. The switch and the cadence are left exactly as they are —
 *  this is the stamp the cadence counts from, not an answer about whether to run. */
export function stampMemoryPrune(when: Date = new Date()): void {
  writeConfig((cfg) => {
    cfg.memoryPrune = { ...configBlock(cfg.memoryPrune), lastRun: formatStamp(when) }
  })
}

/** Carry an old prune card's cadence over as a preference, once (#514). It never switches
 *  recurrence on, and it never overwrites a cadence somebody has already saved here. */
export function adoptMemoryPruneCadence(cadence: string): void {
  const next = cadence.trim()
  if (!next || parseCadence(next) === null) return
  if (memoryPrune().cadence) return
  writeConfig((cfg) => {
    cfg.memoryPrune = { ...configBlock(cfg.memoryPrune), cadence: next }
  })
}
