// A runtime — the whole answer to what a run runs as (#467).
//
// Harness, provider, endpoint, key, model id, reasoning and extra arguments are one row on
// one list, and nothing inherits from anything: reading a runtime tells the whole truth
// about a run. "Harness" goes back to meaning the CLI itself.
//
//   docs/kanban/ui.config.json      the board's, and it travels in git
//   "runtimes": [
//     { "id": "global", "name": "Global default", "harness": "claude-code",
//       "settings": { "provider": "subscription", "model": "claude-opus-5" } },
//     { "id": "my_gateway", "name": "My gateway", "harness": "claude-code",
//       "settings": { "provider": "endpoint", "baseUrl": "https://…", "model": "glm-4.6" } }
//   ],
//   "agentRuntime": { "builder": "my_gateway" }
//
//   docs/kanban/.env                this computer's, and git never carries it
//   ANTHROPIC_API_KEY__MY_GATEWAY=sk-…
//
// The first row is **Global default**: every board has it, no board can delete or rename it,
// and every agent naming no runtime runs it. The default is a POSITION on the list, never a
// badge that moves.
//
// The shape is the board's and the key is one computer's, so the id — never the name — keys
// everything: the agents' picks, a chat's pin, a run's record and the key's own line in
// `.env`. A name is free text and a rename moves nothing.

import fs from 'node:fs'
import path from 'node:path'

import { DEFAULT_HARNESS, HARNESSES, harnessByName } from './harnesses'
import { configBlock, readEnvFile, safeConfig, setSecret, writeConfig } from './settings'
import type { Harness } from './harnesses'

/** One runtime, as the board holds it. */
export interface Runtime {
  /** Stable, and safe to write into `docs/kanban/.env`'s variable names. Never changes. */
  id: string
  /** The user's own words. Unique on the board, never empty, and nothing is keyed by it. */
  name: string
  /** The CLI it runs — a name out of `HARNESSES`, or one this build doesn't ship. */
  harness: string
  /** That harness's own declared settings, plus the optional `command` override. A `secret`
   *  is never here: its value lives in `docs/kanban/.env` under `secretVar`'s name. */
  settings: Record<string, string>
}

/** The id of the first row, which every board has. */
export const GLOBAL_ID = 'global'

/** What it is called, everywhere. */
export const GLOBAL_NAME = 'Global default'

// ---- reading ----------------------------------------------------------------

/** Every runtime the board holds, **Global default** first.
 *
 *  A board written before this carries `harness` and `harnessSettings` instead, and reads as
 *  the list the migration would write from them — so upgrading the command runs what the
 *  board already ran, before `akb update` gets to persist it. */
export function readRuntimes(cfg: Record<string, unknown> = safeConfig()): Runtime[] {
  const saved = Array.isArray(cfg.runtimes) ? cfg.runtimes.map(parseRuntime).filter(isRuntime) : null
  const list = saved?.length ? dedupe(saved) : fromHarnessBlocks(cfg)
  const global = list.find((r) => r.id === GLOBAL_ID)
  const rest = list.filter((r) => r.id !== GLOBAL_ID)
  return [global ?? { id: GLOBAL_ID, name: GLOBAL_NAME, harness: DEFAULT_HARNESS.name, settings: {} }, ...rest]
}

// One entry as the file holds it, or null for a shape we can't read — a hand-edit that put a
// string where a row belongs is dropped rather than run as a row with no harness.
function parseRuntime(value: unknown): Runtime | null {
  const raw = configBlock(value)
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  const harness = typeof raw.harness === 'string' ? raw.harness.trim() : ''
  if (!id || !harness) return null
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id
  const settings: Record<string, string> = {}
  for (const [key, v] of Object.entries(configBlock(raw.settings))) {
    if (typeof v === 'string' && v.trim()) settings[key] = v.trim()
  }
  return { id, name: id === GLOBAL_ID ? GLOBAL_NAME : name, harness, settings }
}

const isRuntime = (r: Runtime | null): r is Runtime => r !== null

// Two rows on one id would make the id mean two things — the first wins, the rest go.
function dedupe(list: Runtime[]): Runtime[] {
  const seen = new Set<string>()
  return list.filter((r) => !seen.has(r.id) && seen.add(r.id))
}

// The list a board written before runtimes reads as: every `harnessSettings` block becomes a
// runtime, and the one `harness` names becomes **Global default**. No block is dropped, so a
// hand-edited `command` on a tool nobody runs survives the upgrade.
function fromHarnessBlocks(cfg: Record<string, unknown>): Runtime[] {
  const asked = typeof cfg.harness === 'string' ? cfg.harness.trim() : ''
  const fallback = (harnessByName(asked) ?? DEFAULT_HARNESS).name
  const blocks = configBlock(cfg.harnessSettings)
  const list: Runtime[] = [
    { id: GLOBAL_ID, name: GLOBAL_NAME, harness: asked || fallback, settings: valuesOf(blocks[asked || fallback]) },
  ]
  const taken = new Set([GLOBAL_ID])
  for (const [harness, block] of Object.entries(blocks)) {
    if (harness === (asked || fallback)) continue
    const id = freeId(harness, taken)
    taken.add(id)
    list.push({ id, name: harnessByName(harness)?.label ?? harness, harness, settings: valuesOf(block) })
  }
  return list
}

function valuesOf(block: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(configBlock(block))) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

/** The runtime one pin names, out of a list.
 *
 *  A pin is an id. A pin written before the upgrade names a HARNESS instead, so it resolves to
 *  the runtime that harness's block became rather than reading as a row that has gone; only a
 *  pin matching neither falls back to **Global default**.
 *
 *  `harness` narrows the list to one CLI, for a resume: the conversation belongs to the command
 *  that opened it, whatever its runtime has been pointed at since. */
export function pickRuntime(list: Runtime[], pin?: string, harness?: string): Runtime {
  const rows = harness ? list.filter((r) => r.harness === harness) : list
  const want = pin?.trim()
  const found = want && (rows.find((r) => r.id === want) ?? rows.find((r) => r.harness === want))
  if (found) return found
  return rows[0] ?? { id: '', name: harness ?? '', harness: harness ?? DEFAULT_HARNESS.name, settings: {} }
}

/** One runtime by id, or nothing. */
export function runtimeById(id: string, list: Runtime[] = readRuntimes()): Runtime | undefined {
  return list.find((r) => r.id === id)
}

// ---- the keys ---------------------------------------------------------------

/** The line one runtime's key keeps in `docs/kanban/.env`: the variable the setting declares,
 *  then the runtime's own id. **Global default** is named the same way as every other row —
 *  one scheme everywhere, and a rename that costs nothing on any computer.
 *
 *  `__` separates them, and a generated id never holds one, so the two halves always read
 *  apart. A hand-written id is squared off the same way `freeId` writes one, so the line the
 *  key is saved under is always a line that file parses. */
export function secretVar(env: string, runtimeId: string): string {
  return `${env}__${runtimeId.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`
}

/** Save one runtime's key, or clear it with an empty value. The value is never read back. */
export function setRuntimeSecret(id: string, settingKey: string, value: string): { ok: boolean; error?: string } {
  const runtime = runtimeById(id)
  if (!runtime) return { ok: false, error: `no runtime called "${id}" on this board.` }
  const setting = harnessByName(runtime.harness)?.settings.find((s) => s.key === settingKey)
  if (!setting?.env || setting.kind !== 'secret') {
    return { ok: false, error: `"${settingKey}" is not a key ${runtime.name} takes.` }
  }
  return setSecret(secretVar(setting.env, runtime.id), value)
}

// ---- which runtime each agent runs -------------------------------------------

/** Which runtime each agent names, by agent name — only the agents the file names. An agent
 *  that names none runs **Global default**.
 *
 *  A board written before this names a HARNESS under `agentHarness`, which `pickRuntime` reads
 *  as the runtime that harness's block became. */
export function readAgentRuntime(cfg: Record<string, unknown> = safeConfig()): Record<string, string> {
  const block = configBlock(cfg.runtimes === undefined && cfg.agentRuntime === undefined ? cfg.agentHarness : cfg.agentRuntime)
  const out: Record<string, string> = {}
  for (const [agent, value] of Object.entries(block)) {
    const name = typeof value === 'string' ? value.trim() : ''
    if (name) out[agent] = name
  }
  return out
}

/** The runtime one agent names, under its current name or one it used to have. */
export function runtimeOfAgent(
  names: string[],
  table: Record<string, string> = readAgentRuntime(),
): string | undefined {
  for (const name of names) {
    if (table[name]) return table[name]
  }
  return undefined
}

/** Point one agent at a runtime, or back at **Global default** with an empty id. */
export function setAgentRuntime(
  agent: string,
  runtime: string,
  legacyNames: string[] = [],
): { ok: boolean; error?: string } {
  if (runtime && !runtimeById(runtime)) return { ok: false, error: `no runtime called "${runtime}" on this board.` }
  return writeConfig((cfg) => {
    const block = { ...readAgentRuntime(cfg) }
    for (const legacy of legacyNames) delete block[legacy]
    if (runtime && runtime !== GLOBAL_ID) block[agent] = runtime
    else delete block[agent]
    writePicks(cfg, block)
  })
}

/** Drop one agent's pick. Called when the agent itself is deleted. */
export function forgetAgentRuntime(agent: string, legacyNames: string[] = []): { ok: boolean; error?: string } {
  return setAgentRuntime(agent, '', legacyNames)
}

// ---- writing the list --------------------------------------------------------

/** Add a runtime, on the harness named. Its id is generated from the name to what
 *  `docs/kanban/.env` parses, and it is what everything keys by from here on. */
export function addRuntime(name: string, harness: string): { ok: boolean; id?: string; error?: string } {
  const wanted = name.trim()
  const bad = nameError(wanted)
  if (bad) return { ok: false, error: bad }
  if (!harnessByName(harness)) return { ok: false, error: `no harness called "${harness}" — \`akb agent list\` says what this version runs.` }
  const list = readRuntimes()
  const id = freeId(wanted, new Set(list.map((r) => r.id)))
  const res = save([...list, { id, name: wanted, harness, settings: {} }])
  return res.ok ? { ok: true, id } : res
}

/** Rename one runtime. Nothing moves: the id keys the key line, the agents' picks and every
 *  run already recorded, so a rename is lossless on every computer. */
export function renameRuntime(id: string, name: string): { ok: boolean; error?: string } {
  if (id === GLOBAL_ID) return { ok: false, error: `${GLOBAL_NAME} keeps its name — it is the row every agent falls back to.` }
  const wanted = name.trim()
  const bad = nameError(wanted, id)
  if (bad) return { ok: false, error: bad }
  return change(id, (runtime) => ({ ...runtime, name: wanted }))
}

/** Drop one runtime, and put the agents that named it back on **Global default** — the delete
 *  is never refused for being in use. Its key goes with it: every `docs/kanban/.env` line named
 *  after this id is cleared, so the key is off this computer whether the delete was typed here
 *  or in a pane. */
export function deleteRuntime(id: string): { ok: boolean; error?: string } {
  if (id === GLOBAL_ID) return { ok: false, error: `${GLOBAL_NAME} can't be deleted — it is what an agent naming no runtime runs.` }
  const list = readRuntimes()
  if (!list.some((r) => r.id === id)) return { ok: false, error: `no runtime called "${id}" on this board.` }
  // The agents that named it fall back with the write: `save` resolves every pick against the
  // list it is writing, and a pick nothing answers to is **Global default**.
  const res = save(list.filter((r) => r.id !== id))
  if (!res.ok) return res
  return clearKeysOf(id)
}

// Every key line this row owns, gone. Asked of every harness we ship rather than of the one the
// row ran: an id never moves, so a harness the row used to be on can have left a line behind,
// and a line nobody would ever see again is a key still sitting on the disk. A variable this
// file doesn't hold is skipped, so the delete never rewrites `.env` for nothing.
function clearKeysOf(id: string): { ok: boolean; error?: string } {
  const env = readEnvFile()
  for (const harness of HARNESSES) {
    for (const setting of harness.settings) {
      if (setting.kind !== 'secret' || !setting.env) continue
      const line = secretVar(setting.env, id)
      if (!env[line]) continue
      const res = setSecret(line, '')
      if (!res.ok) return res
    }
  }
  return { ok: true }
}

/** Move one runtime to another harness. Its settings go with it: a key the new harness doesn't
 *  declare is dropped, because a value under a setting nothing reads is a value nobody can see
 *  or clear. */
export function setRuntimeHarness(id: string, harness: string): { ok: boolean; error?: string } {
  const known = harnessByName(harness)
  if (!known) return { ok: false, error: `no harness called "${harness}" — \`akb agent list\` says what this version runs.` }
  return change(id, (runtime) => {
    if (runtime.harness === harness) return runtime
    const keep = new Set([...known.settings.map((s) => s.key), 'command'])
    const settings = Object.fromEntries(Object.entries(runtime.settings).filter(([key]) => keep.has(key)))
    return { ...runtime, harness, settings }
  })
}

/** Save one of the settings a runtime's harness declares. An empty value drops the key, which
 *  is how a setting goes back to the harness's own default.
 *
 *  The value is never checked here. Model ids change faster than we ship, so the CLI is the
 *  only validator: a bad one makes the run exit non-zero and the reason is in its log. */
export function setRuntimeSetting(id: string, key: string, value: string): { ok: boolean; error?: string } {
  return change(id, (runtime) => {
    const settings = { ...runtime.settings }
    const next = value.trim()
    if (next) settings[key] = next
    else delete settings[key]
    return { ...runtime, settings }
  })
}

/** Save the harness **Global default** runs — `akb agent use`, and the board's own answer to
 *  "what does a run spawn". Every other runtime is untouched. */
export function setHarness(name: string): { ok: boolean; error?: string } {
  return setRuntimeHarness(GLOBAL_ID, name)
}

/** The runtime a harness NAME points at, for the panes that still draw one row per harness:
 *  the first row on that harness, and **Global default** when no harness is named. Null when
 *  no row runs that harness — it has no settings of its own to write, and another row's under
 *  its name would be a silent wrong answer. */
function runtimeOnHarness(harness?: string): Runtime | null {
  const list = readRuntimes()
  if (!harness) return list[0] ?? null
  return list.find((r) => r.harness === harness) ?? null
}

const noRow = (harness?: string): { ok: false; error: string } => ({
  ok: false,
  error: `no runtime on this board runs "${harness}" — add one with \`akb agent runtime add\`, or move Global default onto it.`,
})

/** Save one setting on the runtime a harness name points at. */
export function setHarnessSetting(key: string, value: string, harness?: string): { ok: boolean; error?: string } {
  const row = runtimeOnHarness(harness)
  return row ? setRuntimeSetting(row.id, key, value) : noRow(harness)
}

/** Save the key on the runtime a harness name points at, under that row's own id-scoped line
 *  — the same line a run reads. What a pane drawing one row per harness writes. */
export function setHarnessSecret(key: string, value: string, harness?: string): { ok: boolean; error?: string } {
  const row = runtimeOnHarness(harness)
  return row ? setRuntimeSecret(row.id, key, value) : noRow(harness)
}

// Read the list, change one row, write it back. The pre-runtimes keys go with the first write:
// the list is the whole truth now, and leaving them behind would leave two answers on disk.
function change(id: string, edit: (runtime: Runtime) => Runtime): { ok: boolean; error?: string } {
  const list = readRuntimes()
  if (!list.some((r) => r.id === id)) return { ok: false, error: `no runtime called "${id}" on this board.` }
  return save(list.map((r) => (r.id === id ? edit(r) : r)))
}

// Write the list, and settle the agents' picks against it in the same write. The pre-runtime
// keys go with it: the list is the whole truth now, and leaving `harness`, `harnessSettings` or
// `agentHarness` behind would leave a second answer on disk for the next reader to find.
function save(list: Runtime[]): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    const picks = readAgentRuntime(cfg)
    cfg.runtimes = list
    delete cfg.harnessSettings
    delete cfg.harness
    writePicks(cfg, picks, list)
  })
}

// Each agent's pick as an id on the list being written — an `agentHarness` name resolves to the
// row that harness's block became, and a pick nothing answers to falls back to **Global
// default**, which is written down as no pick at all.
function writePicks(cfg: Record<string, unknown>, picks: Record<string, string>, list = readRuntimes(cfg)): void {
  const block: Record<string, string> = {}
  for (const [agent, pin] of Object.entries(picks)) {
    const row = pickRuntime(list, pin)
    if (row.id && row.id !== GLOBAL_ID) block[agent] = row.id
  }
  delete cfg.agentHarness
  if (Object.keys(block).length) cfg.agentRuntime = block
  else delete cfg.agentRuntime
}

/** Why this name can't be used, or null when it can. A name is the user's own words and holds
 *  anything — it is unique on the board and not empty, and that is the whole of the rule. */
function nameError(name: string, self?: string): string | null {
  if (!name) return 'a runtime needs a name.'
  const clash = readRuntimes().find((r) => r.id !== self && r.name.toLowerCase() === name.toLowerCase())
  return clash ? `this board already has a runtime called "${clash.name}".` : null
}

// An id nothing else on the board has, generated from the name to what `docs/kanban/.env`
// parses: lowercase letters, digits and single underscores, never starting with a digit.
function freeId(name: string, taken: Set<string>): string {
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!base || /^[0-9]/.test(base)) base = `rt_${base}`.replace(/_+$/, '')
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const next = `${base}_${n}`
    if (!taken.has(next)) return next
  }
}

// ---- the one-time upgrade of a board written the old way ---------------------
//
// Before this, how to reach a CLI was one block per harness in `ui.config.json` and the model
// under it was this computer's, in `.local.json`. `akb update` turns both into runtimes, once:
// every block becomes a row, the one `harness` named becomes **Global default**, and each
// agent whose model differed gets a row of its own. A board then runs exactly what it ran.
//
// It works on an explicit board folder because `akb update` repairs the board it was pointed
// at rather than the one this process resolved (commands/install.ts).

/** Write the runtimes a pre-#467 board reads as, and clear what they replace. Returns the line
 *  an update reports, or null when the board is already on runtimes. */
export function migrateRuntimes(
  board: string,
  agents: string[],
  /** Each agent's model settings on this computer, by agent and then by harness — what
   *  `.local.json` held (agent/local.ts). */
  localModels: Record<string, Record<string, Record<string, string>>>,
): string | null {
  const file = path.join(board, 'ui.config.json')
  let cfg: Record<string, unknown>
  try {
    cfg = configBlock(JSON.parse(fs.readFileSync(file, 'utf8')) as unknown)
  } catch {
    return null // no config, or one nothing can read — an update never rewrites either
  }
  if (Array.isArray(cfg.runtimes) && cfg.runtimes.length) return null

  const list = fromHarnessBlocks(cfg)
  const taken = new Set(list.map((r) => r.id))
  const picks: Record<string, string> = {}
  // Each agent's own connector, as `agentHarness` named it, then the model this computer had
  // under it. An agent whose model differs from the runtime it would otherwise run gets a row
  // of its own — one per agent that differed, and no more.
  const bound = configBlock(cfg.agentHarness)
  for (const agent of agents) {
    const named = typeof bound[agent] === 'string' ? (bound[agent] as string).trim() : ''
    const base = pickRuntime(list, named || undefined)
    const model = localModels[agent]?.[base.harness] ?? {}
    if (!Object.keys(model).length || sameValues(base.settings, model)) {
      if (named && base.id !== GLOBAL_ID) picks[agent] = base.id
      continue
    }
    const id = freeId(agent, taken)
    taken.add(id)
    list.push({ id, name: agent, harness: base.harness, settings: { ...base.settings, ...model } })
    picks[agent] = id
  }

  cfg.runtimes = list
  if (Object.keys(picks).length) cfg.agentRuntime = picks
  delete cfg.harness
  delete cfg.harnessSettings
  delete cfg.agentHarness
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n')
  const minted = list.length - 1
  return `turned this board's connector settings into ${list.length} runtime${list.length === 1 ? '' : 's'}${
    minted ? ` — ${GLOBAL_NAME} and ${minted} more` : ''
  }, and pointed each agent at one`
}

const sameValues = (block: Record<string, string>, model: Record<string, string>): boolean =>
  Object.entries(model).every(([key, value]) => block[key] === value)

// ---- this computer's key file, brought to the id-scoped names ----------------

/** Move every key line still under a harness's own declared variable onto the id-scoped line
 *  of each runtime on that harness that has none yet, carrying the same value. A variable no
 *  runtime claims is left exactly where it is: this is the user's file.
 *
 *  It runs off the runtimes LIST rather than off the migration, so a checkout pulled to a
 *  second computer — where `ui.config.json` was converted elsewhere and only the key file is
 *  still old — is repaired there too.
 *
 *  Values are read to be copied and are surfaced nowhere: the board goes on showing a key as
 *  set or not set. */
export function repairEnvFile(): string | null {
  const env = readEnvFile()
  const claimed = new Set<string>()
  const moved: string[] = []
  for (const runtime of readRuntimes()) {
    for (const setting of harnessByName(runtime.harness)?.settings ?? []) {
      if (setting.kind !== 'secret' || !setting.env) continue
      const value = env[setting.env]
      if (!value) continue
      claimed.add(setting.env)
      const line = secretVar(setting.env, runtime.id)
      if (env[line]) continue
      const res = setSecret(line, value)
      if (!res.ok) return null
      moved.push(line)
    }
  }
  for (const name of claimed) setSecret(name, '')
  if (!moved.length) return null
  return `renamed this computer's key lines in docs/kanban/.env after the runtimes that use them: ${moved.join(', ')}`
}

// ---- what a screen draws -----------------------------------------------------

/** The harness one runtime runs, or the default when it names one this build doesn't ship —
 *  the same fallback a run makes, so a screen and a spawn never disagree. */
export function harnessOfRuntime(runtime: Runtime): Harness {
  return harnessByName(runtime.harness) ?? DEFAULT_HARNESS
}
