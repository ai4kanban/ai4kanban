// The board's agent settings, and the one place keys live.
//
// Two files, both kept out of git:
//
//   <board-state>/ui.config.json  which agent runs, and what each one is set to — each
//                                 person's own (#1271).
//   docs/kanban/.env              every key the board uses, and nowhere else — never in
//                                 ui.config.json, never in a shell profile.
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
//     "ui-designer": { "enabled": false, "output": "agent" }
//   }
//
// What a run runs as is one runtime, and all of it — harness, provider, endpoint, key, model
// id, reasoning, extra arguments — is that one row (./runtimes.ts). This file owns the reading
// and writing of `ui.config.json` itself, the spec agents' entries, and `docs/kanban/.env`.
// A board that still has the committed `docs/kanban/ui.config.json` is moved on first read.
//
// A key no setting declares is left exactly where it is: this is the user's file, and
// nothing here rewrites a line they wrote.

import fs from 'node:fs'
import path from 'node:path'

import { CADENCE_FORMS, formatStamp, parseCadence } from '../cadence'
import { ENV_FILE, KANBAN_GITIGNORE, LEGACY_UI_CONFIG, UI_CONFIG } from '../paths'
import { refusal, type CadenceSchedule, type MemoryReviewState, type Saved } from './types'

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
  adoptLegacyConfig()
  if (!fs.existsSync(UI_CONFIG)) return {}
  return adoptProjectNames(JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')))
}

// `product-writer` became `project-writer` (#1391): its cadence and its runtime pick read
// under the new names, and the next save writes them there. Never over one already saved.
function adoptProjectNames(cfg: Record<string, unknown>): Record<string, unknown> {
  if (!cfg || typeof cfg !== 'object') return cfg
  if (cfg.productDescription !== undefined) {
    cfg.projectDescription ??= cfg.productDescription
    delete cfg.productDescription
  }
  for (const key of ['agentRuntime', 'agentHarness']) {
    const { 'product-writer': was, ...rest } = configBlock(cfg[key])
    if (was !== undefined) cfg[key] = { 'project-writer': was, ...rest }
  }
  return cfg
}

/** Move the committed `docs/kanban/ui.config.json` into this person's state. Its content is
 *  taken only when there is no file of their own yet — a pulled copy never overwrites their
 *  settings — and it is deleted either way. */
export function adoptLegacyConfig(): void {
  if (!LEGACY_UI_CONFIG || !fs.existsSync(LEGACY_UI_CONFIG)) return
  if (!fs.existsSync(UI_CONFIG)) {
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.copyFileSync(LEGACY_UI_CONFIG, UI_CONFIG)
  }
  fs.rmSync(LEGACY_UI_CONFIG, { force: true })
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
// once and what was built is exactly what lands. With it OFF a delivery works in the
// user's own checkout, one at a time, and they commit after the build.

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
export function setAutoCommit(on: boolean): Saved {
  return writeConfig((cfg) => {
    if (on) delete cfg.autoCommit
    else cfg.autoCommit = false
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

const badCadence = (cadence: string) =>
  refusal('cadence', `"${cadence}" isn't a cadence — use ${CADENCE_FORMS}`, { cadence, formats: CADENCE_FORMS })

/** Save it, in whole minutes. Back at the default drops the key rather than writing 10. */
export function setSilenceMinutes(minutes: number): Saved {
  if (!Number.isInteger(minutes) || minutes < 0) {
    return { ok: false, ...refusal('minutes', 'that setting is a whole number of minutes, or 0 to switch it off') }
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
//     "ui-designer": { "enabled": false, "output": "agent" }
//   }
//
// `enabled` and `output` are the board's two answers about an agent, and they are the whole
// of what an entry means (#1003). A key beside them is one a release used to read — it is
// carried through a write untouched and acted on by nothing.
//
// An agent the file doesn't name is on, at its default. A plain boolean is the switch on its
// own — the shape written before the entry had a second key, read the same way it always
// was. An entry that is neither reads as on at every default, because a hand-edit that put a
// string or a list here says nothing anyone can act on.
//
// Only what somebody changed is written down: switching an agent back on drops `enabled`
// rather than writing `true`, and an output put back to its default drops its key. The two
// are independent — flipping the switch leaves the output alone, and setting the output
// leaves the switch alone.

/** One spec agent's entry, read. */
export interface SpecAgentEntry {
  enabled: boolean
  /** Who this agent's output is for (#445), when somebody has said. */
  output?: string
  /** Every other key the file carries for this agent, exactly as it holds them — kept only
   *  so a write puts them back. Nothing reads one: a setting an agent declared for itself is
   *  gone (#1003), and this is the user's file. */
  extra: Record<string, unknown>
}

// One entry as the file holds it. Null for a shape we can't read, which the callers take as
// "nothing saved for this agent". `runtime` is read and dropped: a board written before #443
// has one, and the agent it pointed at runs the board's harness now.
const BOARD_SPEC_KEYS = ['enabled', 'runtime', 'output']

function parseSpecEntry(value: unknown): SpecAgentEntry | null {
  if (typeof value === 'boolean') return { enabled: value, extra: {} }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const extra: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(raw)) {
    if (!BOARD_SPEC_KEYS.includes(key)) extra[key] = v
  }
  const output = typeof raw.output === 'string' ? raw.output.trim() : ''
  return { enabled: raw.enabled !== false, ...(output ? { output } : {}), extra }
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
): Saved {
  return writeSpecAgentEntry(name, legacyNames, (entry) => ({ ...entry, enabled: on }))
}

/** Save who one spec agent's output is for (#445), leaving its switch alone. An empty value
 *  drops the key, which is how it goes back to the default its `AGENT.md` starts it at.
 *
 *  That the word is one the board offers is checked by the caller above this
 *  (`lib/agents/`). */
export function setSpecAgentOutput(
  name: string,
  output: string,
  legacyNames: string[] = [],
): Saved {
  const next = output.trim()
  return writeSpecAgentEntry(name, legacyNames, ({ output: _was, ...entry }) =>
    next ? { ...entry, output: next } : entry,
  )
}

/** Drop one spec agent's entry entirely — its switch, who its output is for, and whatever
 *  else it carried. Called when the agent itself is deleted: a settings block for an agent
 *  nobody has is a line the user can neither read nor reach. */
export function forgetSpecAgent(name: string, legacyNames: string[] = []): Saved {
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
): Saved {
  return writeConfig((cfg) => {
    const block = { ...configBlock(cfg.specAgents) }
    const entry = change(entryOf(block, [name, ...legacyNames]) ?? { enabled: true, extra: {} })
    for (const legacy of legacyNames) delete block[legacy]
    delete block[name]
    const body = {
      ...(entry.enabled ? {} : { enabled: false }),
      ...(entry.output ? { output: entry.output } : {}),
      ...entry.extra,
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
export function writeConfig(change: (cfg: Record<string, unknown>) => void): Saved {
  let cfg: Record<string, unknown>
  try {
    cfg = readConfigRaw()
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      ...refusal('fileParse', `couldn't save: ${UI_CONFIG} won't parse (${why}). Fix the file, then try again.`, {
        path: UI_CONFIG,
        details: why,
      }),
    }
  }
  change(cfg)
  try {
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.writeFileSync(UI_CONFIG, JSON.stringify(cfg, null, 2) + '\n')
    return { ok: true }
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, ...refusal('fileWrite', `couldn't write ${UI_CONFIG}: ${why}`, { path: UI_CONFIG, details: why }) }
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
function ensureIgnored(): Saved {
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
    return {
      ok: false,
      ...refusal('gitignoreWrite', `couldn't write ${KANBAN_GITIGNORE} to keep the key out of git: ${why}`, {
        path: KANBAN_GITIGNORE,
        details: why,
      }),
    }
  }
}

/** Save one key, or clear it when the value is empty. Rewrites that one line and leaves
 *  every other line alone — a key the board doesn't know, a comment, the order they sit
 *  in. The file is the user's as much as ours.
 *
 *  It is created 0600 (owner only): it holds keys, and on a shared machine the default
 *  would let anyone else on it read them. */
export function setSecret(name: string, value: string): Saved {
  const ignored = ensureIgnored()
  if (!ignored.ok) return ignored

  let lines: string[]
  try {
    lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8').split('\n') : []
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, ...refusal('fileRead', `couldn't read ${ENV_FILE}: ${why}`, { path: ENV_FILE, details: why }) }
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
    return { ok: false, ...refusal('fileWrite', `couldn't write ${ENV_FILE}: ${why}`, { path: ENV_FILE, details: why }) }
  }
}

// ---- the scheduled agents' cadences (#514, #929, #1208, #1268, #1464) --------
//
//   "memoryPrune":        { "cadence": "1d at 09:30", "lastRun": "2026-09-08 09:30" }
//   "dismissalReview":    { "lastRun": "2026-09-19 08:00", "off": true }
//   "projectDescription": { "lastRun": "2026-09-30 08:00" }
//
// Only what differs from the default is written down: a cadence other than the default, and
// `off` once somebody disabled it (#1464). Off is its own key: the `enabled: false` releases
// before #1208 wrote stays ignored, so upgrading never switches a schedule off nobody touched.
//
// `lastRun` moves only on a pass that PASSED, which is what stops a failing one firing again
// every tick. `since` is where a cadence that never ran counts from: the scheduler writes it
// on its first look, so a board's first prune lands a whole cadence after upgrade
// rather than the minute it does.

export type ScheduleKey = 'memoryPrune' | 'dismissalReview' | 'projectDescription'

/** The cadence a board that never set one runs each on. */
export const DEFAULT_CADENCE: Record<ScheduleKey, string> = {
  memoryPrune: '7d',
  dismissalReview: '1d',
  projectDescription: '1d',
}

const stringIn = (block: Record<string, unknown>, key: string): string =>
  typeof block[key] === 'string' ? (block[key] as string).trim() : ''

/** What the file says about one schedule. A cadence nothing parses, or a file that won't,
 *  reads as the default. */
function readSchedule(key: ScheduleKey): CadenceSchedule {
  const block = configBlock(safeConfig()[key])
  const saved = stringIn(block, 'cadence')
  return {
    enabled: block.off !== true,
    cadence: saved && parseCadence(saved) ? saved : DEFAULT_CADENCE[key],
    lastRun: stringIn(block, 'lastRun'),
    ...(stringIn(block, 'since') ? { since: stringIn(block, 'since') } : {}),
  }
}

/** Save the cadence and whether it is off, keeping `lastRun` and `since`. A caller that says
 *  nothing about `enabled` leaves it as it is. */
function saveSchedule(key: ScheduleKey, next: { enabled?: boolean; cadence: string }): Saved {
  const cadence = next.cadence.trim() || DEFAULT_CADENCE[key]
  if (parseCadence(cadence) === null) return { ok: false, ...badCadence(cadence) }
  return writeConfig((cfg) => {
    const block = configBlock(cfg[key])
    const body = {
      ...(cadence !== DEFAULT_CADENCE[key] ? { cadence } : {}),
      ...(stringIn(block, 'lastRun') ? { lastRun: stringIn(block, 'lastRun') } : {}),
      ...(stringIn(block, 'since') ? { since: stringIn(block, 'since') } : {}),
      ...((next.enabled ?? block.off !== true) ? {} : { off: true }),
    }
    if (Object.keys(body).length) cfg[key] = body
    else delete cfg[key]
  })
}

function stampSchedule(key: ScheduleKey, when: Date): boolean {
  return writeConfig((cfg) => {
    cfg[key] = { ...configBlock(cfg[key]), lastRun: formatStamp(when) }
  }).ok
}

/** The stamp a schedule's cadence counts from: its last pass, or the moment the scheduler
 *  first looked at it. The first look writes `since` — empty when that write failed, so the
 *  caller waits rather than running at once. */
export function scheduleClock(key: ScheduleKey, now: Date = new Date()): string {
  const schedule = readSchedule(key)
  if (schedule.lastRun || schedule.since) return schedule.lastRun || schedule.since!
  const since = formatStamp(now)
  const saved = writeConfig((cfg) => {
    cfg[key] = { ...configBlock(cfg[key]), since }
  })
  return saved.ok ? since : ''
}

export const memoryPrune = (): CadenceSchedule => readSchedule('memoryPrune')
export const setMemoryPrune = (next: { enabled?: boolean; cadence: string }): Saved => saveSchedule('memoryPrune', next)
export const stampMemoryPrune = (when: Date = new Date()): void => void stampSchedule('memoryPrune', when)

/** Carry an old prune card's cadence over, once (#514), never over one already saved. */
export function adoptMemoryPruneCadence(cadence: string): void {
  const next = cadence.trim()
  if (!next || parseCadence(next) === null) return
  if (stringIn(configBlock(safeConfig().memoryPrune), 'cadence')) return
  writeConfig((cfg) => {
    cfg.memoryPrune = { ...configBlock(cfg.memoryPrune), cadence: next }
  })
}

// ---- the memory reviewer's record (#748, #1322, #1464) ----------------------
//
//   "memoryReview": { "lastRun": "2026-09-13 08:00", "reviewedBefore": "2026-09-12 08:00", "remainingAt": 0 }
//
// `cadence` and `off` are the user's, written like the schedules above: only when they
// differ from every day and on.
//
// `lastRun` is when the last review that PASSED began. Whether one is DUE is answered off
// the run record as well (`../view/dispatch.ts`), which is what holds a failed one off.
//
// A conversation is reviewed once and carries its own mark, so `lastRun` is no window.
// `reviewedBefore` is the one that is: what was said before reviews became once-only was
// read by the daily pass, so it counts as reviewed. It is pinned to the `lastRun` standing
// at the first write after the upgrade, and never moves again.

/** How often the memory review runs on a board that never set it. */
export const MEMORY_REVIEW_CADENCE = '1d'

const NEVER_REVIEWED: MemoryReviewState = {
  enabled: true,
  cadence: MEMORY_REVIEW_CADENCE,
  lastRun: '',
  reviewedBefore: '',
  remainingAt: 0,
}

/** What the file says about the memory review. A file that won't parse reads as never
 *  reviewed, which re-reads rather than skips. */
export function memoryReview(): MemoryReviewState {
  let cfg: Record<string, unknown>
  try {
    cfg = readConfigRaw()
  } catch {
    return NEVER_REVIEWED
  }
  const block = pinned(configBlock(cfg.memoryReview))
  const cadence = stringIn(block, 'cadence')
  return {
    enabled: block.off !== true,
    cadence: cadence && parseCadence(cadence) ? cadence : MEMORY_REVIEW_CADENCE,
    lastRun: stringIn(block, 'lastRun'),
    reviewedBefore: stringIn(block, 'reviewedBefore'),
    remainingAt: typeof block.remainingAt === 'number' ? block.remainingAt : 0,
  }
}

// The block with `reviewedBefore` pinned: until something writes it, it is `lastRun`.
function pinned(block: Record<string, unknown>): Record<string, unknown> {
  return typeof block.reviewedBefore === 'string' ? block : { ...block, reviewedBefore: stringIn(block, 'lastRun') }
}

/** Save how often the review runs and whether it is off, keeping its record. */
export function setMemoryReview(next: { enabled?: boolean; cadence: string }): Saved {
  const cadence = next.cadence.trim() || MEMORY_REVIEW_CADENCE
  if (parseCadence(cadence) === null) return { ok: false, ...badCadence(cadence) }
  return writeConfig((cfg) => {
    const block = { ...pinned(configBlock(cfg.memoryReview)) }
    const off = !(next.enabled ?? block.off !== true)
    delete block.cadence
    delete block.off
    cfg.memoryReview = {
      ...block,
      ...(cadence !== MEMORY_REVIEW_CADENCE ? { cadence } : {}),
      ...(off ? { off: true } : {}),
    }
  })
}

/** Record a review that passed, stamped with when that review STARTED. */
export function stampMemoryReview(when: Date): void {
  writeConfig((cfg) => {
    cfg.memoryReview = { ...pinned(configBlock(cfg.memoryReview)), lastRun: formatStamp(when) }
  })
}

/** Record whether conversations were still waiting when a batch was marked reviewed. */
export function noteMemoryReviewRemaining(remaining: boolean, at: number = Date.now()): void {
  writeConfig((cfg) => {
    cfg.memoryReview = { ...pinned(configBlock(cfg.memoryReview)), remainingAt: remaining ? at : 0 }
  })
}

// ---- the leftover prune's last pass (#1177) ---------------------------------
//
//   "leftoverPrune": { "lastRun": "2026-09-28 09:00" }

/** When the leftovers of cards off the board were last pruned, or empty for never. */
export function leftoverPrune(): string {
  const block = configBlock(safeConfig().leftoverPrune)
  return typeof block.lastRun === 'string' ? block.lastRun.trim() : ''
}

/** False when the stamp could not be saved — the prune then waits rather than repeating. */
export function stampLeftoverPrune(when: Date): boolean {
  return writeConfig((cfg) => {
    cfg.leftoverPrune = { ...configBlock(cfg.leftoverPrune), lastRun: formatStamp(when) }
  }).ok
}

// `dismissalReview`'s `lastRun` is also its window: when the last review that PASSED began, so
// a reason written while it was reading is still new to the next one.
export const dismissalReview = (): CadenceSchedule => readSchedule('dismissalReview')
export const setDismissalReview = (next: { enabled?: boolean; cadence: string }): Saved =>
  saveSchedule('dismissalReview', next)
/** Move the window to a review that passed, stamped with when that review STARTED. */
export const stampDismissalReview = (when: Date): void => void stampSchedule('dismissalReview', when)

// `projectDescription`'s `lastRun` is its window too: commits since the last pass began are
// what makes the next one due (#1268).
export const projectDescription = (): CadenceSchedule => readSchedule('projectDescription')
export const setProjectDescription = (next: { enabled?: boolean; cadence: string }): Saved =>
  saveSchedule('projectDescription', next)
export const stampProjectDescription = (when: Date): void => void stampSchedule('projectDescription', when)
