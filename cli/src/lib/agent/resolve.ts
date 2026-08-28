// Turning the saved settings into one run.
//
// Everything a run takes from the board's settings is resolved here, in a single read:
// the command to spawn, the flags its settings add, the environment it starts under, the
// parser for its output, and the name recorded against it. One read means a run can never
// be split across two agents — switching the picker while an agent is working changes what
// the NEXT run spawns, never this one.

import { readBindings, type RuntimeBinding } from '../machine/runtimes'
import { REPO_ROOT } from '../paths'
import { harnessGaps } from './capabilities'
import type { RunClient } from './client'
import {
  HARNESSES,
  type Harness,
  DEFAULT_HARNESS,
  RAW_ARGS_KEY,
  SKILL_SENTENCE,
  harnessByName,
  namesFlag,
} from './harnesses'
import { FLOWS } from './flows'
import { commandBinary, pathLookup } from './installed'
import { missingRequired, pickedProvider, providerSetting, shownForProvider } from './providers'
import { runtimeOfFlow } from './runtime'
import { configBlock, readEnvFile, readRuntimes, safeConfig, type BoardRuntimes } from './settings'
import type { StreamRenderer } from './stream'
import type {
  AgentInfo,
  ChatAgent,
  HarnessSetting,
  Provider,
  RuntimeFallback,
  RuntimeView,
} from './types'

interface ResolvedHarness {
  harness: Harness
  command: string
  isDefault: boolean
  /** The runtime this run was asked for — the board's global one when nothing named
   *  another (#343). */
  runtime: string
  /** The harness this computer's binding for that runtime named, when it isn't the one that
   *  ran: nothing was bound, or what was bound this build doesn't ship. */
  fallback?: RuntimeFallback
  /** What each declared setting is set to, keyed by its key. A setting the file doesn't
   *  carry is absent, meaning the agent's own default. A `secret` is never in here — its
   *  value lives in docs/kanban/.env and is never read back. */
  values: Record<string, string>
  /** The keys of the secret settings whose variable docs/kanban/.env holds right now. Set
   *  or not set — the value itself never leaves this module. */
  secretsSet: string[]
  /** The keys whose flag the command override already names, so the override wins and the
   *  setting is never appended. */
  ignored: string[]
  /** The name the file asked for, when it isn't one of ours. */
  unknownName?: string
  /** The file still holds the pre-agent-block top-level `command` key. Nothing reads it. */
  staleCommand?: boolean
}

// Everything the provider pick needs to be read the same way twice: what counts as "filled
// in" for one setting. A key is filled when docs/kanban/.env holds its variable, anything
// else when ui.config.json holds a value.
function isFilled(
  harness: Harness,
  values: Record<string, string>,
  secretsSet: string[],
): (key: string) => boolean {
  return (key) => {
    const setting = harness.settings.find((s) => s.key === key)
    return setting?.kind === 'secret' ? secretsSet.includes(key) : Boolean(values[key])
  }
}

/** The provider a run goes through right now, or nothing when this connector declares no
 *  provider list — then it has no providers and every setting it declares is in effect. */
function activeProviderOf({ harness, values, secretsSet }: ResolvedHarness): Provider | undefined {
  const setting = providerSetting(harness.settings)
  if (!setting) return undefined
  return pickedProvider(setting, values[setting.key] ?? '', isFilled(harness, values, secretsSet))
}

/** The command one harness runs for a block of its settings: the hand-written `command`
 *  override in that block, or the harness's own. */
function commandOf(block: Record<string, unknown>, harness: Harness): string {
  const override = typeof block.command === 'string' ? block.command.trim() : ''
  return override || harness.command
}

/** What a run is asked for, before anything is read. */
export interface HarnessAsk {
  /** The runtime it goes on (agent/runtime.ts). Absent means the board's global one. */
  runtime?: string
  /** The harness a run already committed to — a resume continues the conversation the agent
   *  that started it opened, and a plan being reopened spawns exactly what it planned. */
  pin?: string
  /** Read the BOARD's own answer and skip this computer's bindings: `harness` and
   *  `harnessSettings`, which are the binding a computer that has bound nothing falls back
   *  to. This is what `akb agent use` and `akb agent set` read and write, so a dialog never
   *  shows one agent's values while saving into another's block. */
  board?: boolean
}

// What a runtime runs as here, in the order the answers are tried:
//
//   1. this computer's binding for that runtime;
//   2. this computer's binding for the GLOBAL runtime, which is what a runtime nobody bound
//      here falls back to;
//   3. nothing — and then the board's own `harness` and `harnessSettings` are this
//      computer's global binding, so a fresh clone runs with no local setup at all.
//
// A binding naming a harness this build doesn't ship is passed over exactly like a binding
// that isn't there. Either way the run's log says which runtime was asked for and what it
// ran as (`runtimeNote`).
function resolveBinding(
  runtime: string,
  global: string,
  bindings: Record<string, RuntimeBinding>,
): { binding?: RuntimeBinding; fallback?: RuntimeFallback } {
  const own = bindings[runtime]
  if (own && harnessByName(own.harness)) return { binding: own }
  const fallback: RuntimeFallback = own ? { was: 'unknown-harness', bound: own.harness } : { was: 'unbound' }
  const shared = runtime === global ? undefined : bindings[global]
  if (shared && harnessByName(shared.harness)) return { binding: shared, fallback }
  return { fallback }
}

function resolveHarness(ask: HarnessAsk = {}): ResolvedHarness {
  const cfg = safeConfig()
  const staleCommand = typeof cfg.command === 'string' && cfg.command.trim() ? true : undefined
  const runtimes = readRuntimes(cfg)
  const runtime = ask.runtime && runtimes.names.includes(ask.runtime) ? ask.runtime : runtimes.global
  const { binding, fallback } = ask.board
    ? { binding: undefined, fallback: undefined }
    : resolveBinding(runtime, runtimes.global, readBindings())
  // `pin` wins over every binding: a run already committed to an agent spawns that agent,
  // whatever the settings have been changed to since.
  const asked = ask.pin ?? binding?.harness ?? (typeof cfg.harness === 'string' ? cfg.harness.trim() : '')
  const known = harnessByName(asked)
  const harness = known ?? DEFAULT_HARNESS
  // The settings the harness that RAN is set to. A binding carries its own; without one —
  // and for a pin the binding doesn't name — they are the board's, under that harness's own
  // name, because a name we don't ship runs the default and the default's settings are the
  // default's.
  const block: Record<string, unknown> =
    binding && binding.harness === harness.name
      ? binding.settings
      : configBlock(configBlock(cfg.harnessSettings)[harness.name])
  const command = commandOf(block, harness)
  const argv = command.split(/\s+/).filter(Boolean)
  const values: Record<string, string> = {}
  const ignored: string[] = []
  const secretsSet: string[] = []
  // Read once for the whole loop — an agent can declare several secrets, and they all sit
  // in the same file.
  const env = harness.settings.some((s) => s.kind === 'secret') ? readEnvFile() : {}
  for (const setting of harness.settings) {
    // A key lives in docs/kanban/.env, never in this block — and never in a computer's
    // binding either. A hand-written one here is ignored rather than used: the file we
    // promised to keep it out of would be the one holding it.
    if (setting.kind === 'secret') {
      if (setting.env && env[setting.env]) secretsSet.push(setting.key)
      continue
    }
    const raw = block[setting.key]
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (value) values[setting.key] = value
    if (setting.flags?.length && namesFlag(argv, setting.flags)) ignored.push(setting.key)
  }
  // The provider is the one setting that always has a value: a run always goes through
  // one, so a board that never picked reads as the default rather than as nothing. It is
  // settled after the loop because the default can depend on the other settings — a board
  // holding an Anthropic key reads as the Anthropic API, so the key it already had goes on
  // being used.
  const list = providerSetting(harness.settings)
  if (list) {
    const picked = pickedProvider(list, values[list.key] ?? '', isFilled(harness, values, secretsSet))
    if (picked) values[list.key] = picked.id
    else delete values[list.key]
  }
  return {
    harness,
    command,
    isDefault: !known,
    runtime,
    // Nothing to say on a board that names no runtimes: there is one, everything is on it,
    // and it is bound to what the board already held.
    fallback: runtimes.named ? fallback : undefined,
    values,
    secretsSet,
    ignored,
    unknownName: known ? undefined : asked || undefined,
    staleCommand,
  }
}

/** The line the board owes a run's log when the runtime it was asked for is not what it
 *  ran as — which runtime, what was bound, and what actually spawned. Null when the run got
 *  the runtime's own binding, which is the ordinary case and says nothing worth a line. */
export function runtimeNote(resolved: {
  runtime: string
  fallback?: RuntimeFallback
  harness: Harness
}): string | null {
  const { runtime, fallback, harness } = resolved
  if (!fallback) return null
  const why =
    fallback.was === 'unbound'
      ? `is not bound on this computer`
      : `is bound to "${fallback.bound}", which this version doesn't run`
  return `runtime "${runtime}" ${why} — running ${harness.label}.`
}

/** The settings the agent behind one runtime declares — the only keys that may be saved
 *  against it. With no runtime named it is the board's global one, which is the agent
 *  `akb agent set` writes for. */
export function activeSettings(ask: HarnessAsk = { board: true }): HarnessSetting[] {
  return resolveHarness(ask).harness.settings
}

/** The agent one runtime resolves to here — its name, and the settings it takes. */
export function runtimeHarness(runtime?: string): { name: string; label: string; settings: HarnessSetting[] } {
  const { harness } = resolveHarness({ runtime })
  return { name: harness.name, label: harness.label, settings: harness.settings }
}

/** Why this setting can't be saved with this value, or null when it can.
 *
 *  Two rules, and both are about the provider pick meaning what it says. A pick is refused
 *  while a box it must have is empty — an endpoint with no base URL is a pick that would
 *  send a run nowhere it named. And a box the picked provider must have can't be emptied
 *  out from under it, for the same reason from the other side.
 *
 *  A box a provider merely *needs* is never required: a key can be written into
 *  docs/kanban/.env by hand at any moment, so an empty one is not the board's to call
 *  missing. */
export function settingSaveError(key: string, value: string, ask: HarnessAsk = { board: true }): string | null {
  const resolved = resolveHarness(ask)
  const { harness, values, secretsSet } = resolved
  const list = providerSetting(harness.settings)
  if (!list) return null
  const filled = isFilled(harness, values, secretsSet)
  const label = (k: string) => harness.settings.find((s) => s.key === k)?.label ?? k

  if (key === list.key) {
    const provider = list.providers?.find((p) => p.id === value)
    if (!provider) return `"${value}" isn't one of the ${list.label.toLowerCase()} choices`
    const missing = missingRequired(provider, filled)
    if (missing.length) {
      const names = missing.map((k) => `"${label(k)}"`).join(' and ')
      return `${provider.label} needs ${names}. Fill it in and save it, then pick this provider.`
    }
    return null
  }

  if (value) return null
  const picked = activeProviderOf(resolved)
  if (picked?.requires?.includes(key)) {
    return `${picked.label} needs "${label(key)}". Pick another provider first, or give this one a value.`
  }
  return null
}

// Each declared setting as this agent's own flag, in the order it declared them. The value
// is always its own argv entry, never joined into the command string, and nothing checks
// it: a bad one is the agent's to reject, and it says so in the run's log. A setting the
// command override already names is skipped — one flag, one place it comes from — and so
// is one that reaches the run some other way than a flag.
function settingArgs(resolved: ResolvedHarness): string[] {
  const { harness, values, ignored } = resolved
  const picked = activeProviderOf(resolved)
  const flags = harness.settings.flatMap((setting) => {
    const value = values[setting.key]
    if (!value || !setting.flags?.length || ignored.includes(setting.key)) return []
    // A setting the picked provider doesn't need can't reach the run either — whichever
    // way it would have got there. The pick decides the whole of what a run is given.
    if (!shownForProvider(harness.settings, setting.key, picked)) return []
    return [setting.flags[0]!, value]
  })
  // The raw arguments go last of the settings' own, and so still BEFORE whatever the
  // harness adds: a connector whose own arguments open a subcommand (`codex exec … resume
  // <id>`) takes everything after that subcommand as the subcommand's.
  //
  // Split on spaces, the same way the command itself is, and nothing is checked: what this
  // is for is the flags the board has no words for, and only the CLI can judge one.
  return [...flags, ...(values[RAW_ARGS_KEY]?.split(/\s+/).filter(Boolean) ?? [])]
}

// The environment one run gets, in three steps.
//
// 1. The agent's own environment — this process's, plus whatever that connector always
//    wants.
// 2. Every variable the provider pick owns is dropped. That is the whole point of the
//    pick: a base URL or a key someone exported in their shell months ago can't quietly
//    send a "Claude subscription" run through a gateway while the settings say otherwise.
// 3. The picked provider sets what it needs, and nothing else: the settings it names, each
//    under the variable that setting declares — a key read from docs/kanban/.env,
//    everything else from ui.config.json — plus any fixed variables of its own.
//
// A connector with no provider list skips 2 and 3 for the variables no provider owns, so
// its declared keys are set exactly as they were before the pick existed.
//
// The keys go in the environment and never in the command: argv is spawned as written and
// would put a key in every process list on the machine.
function runEnv(resolved: ResolvedHarness, cwd = REPO_ROOT): NodeJS.ProcessEnv {
  const { harness, values } = resolved
  const picked = activeProviderOf(resolved)
  const env: NodeJS.ProcessEnv = { ...harness.env() }
  for (const name of ownedVars(harness)) delete env[name]

  const file = readEnvFile()
  for (const setting of harness.settings) {
    if (!setting.env) continue
    if (!shownForProvider(harness.settings, setting.key, picked)) continue
    const value = setting.kind === 'secret' ? file[setting.env] : values[setting.key]
    if (!value) continue
    // A setting can go out under a different variable than the one its own line keeps: the
    // picked provider renames it — the same key is ANTHROPIC_API_KEY on Anthropic's API and
    // ANTHROPIC_AUTH_TOKEN on a gateway — or the setting says so itself, for a connector
    // with no pick to make. Instead of, never as well as: both at once is two auth sources,
    // and the agent picks one of them.
    env[picked?.envAs?.[setting.key] ?? setting.envAs ?? setting.env] = value
  }
  // The project, said a second way. Every spawn sets `cwd` to it already; this is the
  // variable a shell would have set alongside, and some CLIs read that instead of asking
  // the OS — an agent inheriting the caller's PWD reports the caller's folder even though
  // its own cwd is the project (agent/harnesses/types.ts, WORKING FOLDER).
  return { ...env, PWD: cwd, ...(picked?.env ?? {}) }
}

// Every variable the provider pick owns, and so every variable a run has dropped before
// the pick sets its own: the ones the connector lists by hand, plus the ones its
// provider-owned settings name. Deriving that second half means adding a provider setting
// can't leave a variable behind by mistake.
function ownedVars(harness: Harness): string[] {
  const names = new Set(harness.providerEnv ?? [])
  const list = providerSetting(harness.settings)
  if (!list) return [...names]
  for (const provider of list.providers ?? []) {
    for (const name of Object.values(provider.envAs ?? {})) names.add(name)
    for (const name of Object.keys(provider.env ?? {})) names.add(name)
    for (const key of provider.needs) {
      const setting = harness.settings.find((s) => s.key === key)
      for (const name of [setting?.env, setting?.envAs]) if (name) names.add(name)
    }
  }
  return [...names]
}

// ---- one read per run ------------------------------------------------------

/** What a run is spawned from, worked out once when it is started and written down with
 *  it. Everything but the keys: the environment is rebuilt at the moment of the spawn
 *  (`runEnvironment`), because a run's plan is saved to a file and a key never is. */
export interface RunPlan {
  /** The agent's name, stamped onto the run. */
  harness: string
  /** The runtime it was resolved through, stamped onto the run beside the agent (#343).
   *  Absent on a plan written before runtimes existed. */
  runtime?: string
  /** The full argv to spawn, in one fixed order: the configured command, then its
   *  settings' flags, then the agent's own. The prompt is appended as a final argv entry
   *  when the run spawns. The agent goes LAST because what it adds may be a subcommand
   *  rather than a flag — `codex exec … resume <id>` — and a subcommand takes everything
   *  after it as its own. */
  argv: string[]
  /** The id this agent's CLI resumes by, when it's already known — the agent adopted the
   *  id we generated. Null when it mints its own mid-run; the renderer reports it. */
  resumeId: string | null
  /** The command that installs this agent's CLI — what to say when the spawn fails
   *  because the binary isn't there. */
  install: string
  /** The folder this run works in. The project itself for everything but a delivery with
   *  a worktree of its own (#303), which works in that worktree. Written down with the
   *  plan so the spawn, the connector's own folder flag and `PWD` are one answer. */
  cwd?: string
}

/** Everything one run needs at the moment it spawns. Exactly one of `renderer` and
 *  `client` is here, because a command either prints its work or holds a conversation
 *  about it — the harness says which, and the runner branches on it. */
export interface ActiveRun extends RunPlan {
  env: NodeJS.ProcessEnv
  /** Reads this agent's stdout into log lines. */
  renderer?: StreamRenderer
  /** Talks to this agent over its own pipes (agent/client.ts). */
  client?: RunClient
  /** This agent's own housekeeping chatter on stderr, which the log leaves out
   *  (agent/harnesses/types.ts). Undefined for a harness that has none. */
  quietStderr?: (line: string) => boolean
}

/** Work out how to start a fresh run on one runtime. `cwd` is the folder it works in —
 *  the project, or a delivery's own worktree (#303) — and `runtime` is the one this run's
 *  flow goes on (agent/runtime.ts), the board's global one when nothing names another.
 *  `note` is the line the board owes the run's log when the runtime isn't what it ran as. */
export function planRun(sessionId: string, cwd = REPO_ROOT, runtime?: string): RunPlan & { note: string | null } {
  const resolved = resolveHarness({ runtime })
  const { harness, command } = resolved
  const argv = command.split(/\s+/).filter(Boolean)
  return {
    harness: harness.name,
    runtime: resolved.runtime,
    argv: [...argv, ...settingArgs(resolved), ...harness.extraArgs(argv, sessionId, cwd)],
    resumeId: harness.adoptsSessionId ? sessionId : null,
    install: harness.install,
    cwd,
    note: runtimeNote(resolved),
  }
}

/** Work out how to send one more turn into a conversation that already happened: same
 *  command, same env, same parser — only the flags differ, and the prompt is the "carry
 *  on" one rather than a card action's.
 *
 *  Null when this can't be done: the agent doesn't resume at all, or the run being resumed
 *  belongs to another agent. That last rule is why the name is checked — resuming a Claude
 *  Code conversation with a different CLI would hand it an id that means nothing there. */
export function planResume(
  harnessName: string,
  resumeId: string,
  cwd = REPO_ROOT,
  runtime?: string,
): RunPlan | null {
  const resolved = resolveHarness({ runtime })
  const { harness, command } = resolved
  // A resume stays on the agent it started on, so it is offered only while that is still
  // what its runtime resolves to here: handing a Claude Code conversation's id to another
  // CLI would mean nothing there.
  if (!harness.resumes || harness.name !== harnessName) return null
  const argv = command.split(/\s+/).filter(Boolean)
  return {
    harness: harness.name,
    runtime: resolved.runtime,
    argv: [...argv, ...settingArgs(resolved), ...harness.resumeArgs(argv, resumeId, cwd)],
    // The resumed turn runs under the id it resumed, so this run can be resumed again by
    // the same id — a failure two turns deep is still recoverable.
    resumeId,
    install: harness.install,
    cwd,
  }
}

/** The environment and the parser for a plan, at the moment it spawns. Split from the plan
 *  because a plan is written to the board and an API key is not: the keys are read out of
 *  docs/kanban/.env here, into the child's environment and nowhere else. */
export function openPlan(plan: RunPlan): ActiveRun {
  const resolved = resolveHarness({ runtime: plan.runtime, pin: plan.harness })
  const { harness } = resolved
  return {
    ...plan,
    env: runEnv(resolved, plan.cwd ?? REPO_ROOT),
    renderer: harness.renderer?.(),
    // The client is handed the settings that are actually in effect — the same ones that
    // would have reached the run as flags, minus whatever the picked provider doesn't
    // need — because for a connector that talks, a setting is something the conversation
    // opens with rather than something argv carries.
    client: harness.client?.(effectiveValues(resolved)),
    quietStderr: harness.quietStderr,
  }
}

// What this harness's settings are set to, as a run would use them: the provider's own
// picks only, and never a secret (a key reaches a run in its environment, and nowhere a
// client could hand it on).
function effectiveValues(resolved: ResolvedHarness): Record<string, string> {
  const picked = activeProviderOf(resolved)
  const out: Record<string, string> = {}
  for (const setting of resolved.harness.settings) {
    const value = resolved.values[setting.key]
    if (!value || setting.kind === 'secret') continue
    if (!shownForProvider(resolved.harness.settings, setting.key, picked)) continue
    out[setting.key] = value
  }
  return out
}

/** The name of the agent a run on this runtime can be resumed under right now — what that
 *  runtime resolves to here, if it resumes at all. A run offers Resume only when it ran
 *  under this same name, so a runtime rebound to another tool stops offering it. */
export function resumableHarness(runtime?: string): string | null {
  const { harness } = resolveHarness({ runtime })
  return harness.resumes ? harness.name : null
}

/** The same answer for a whole list of runs, reading the settings once per runtime rather
 *  than once per run. */
export function resumableLookup(): (runtime?: string) => string | null {
  const seen = new Map<string, string | null>()
  return (runtime) => {
    const key = runtime ?? ''
    if (!seen.has(key)) seen.set(key, resumableHarness(runtime))
    return seen.get(key) ?? null
  }
}

/** Which agent this board's conversations are held with, and whether it can hold one.
 *
 *  A conversation is one message after another into the session the agent already opened,
 *  and that is exactly what `resumes` says a CLI can do — so chat leans on that one
 *  capability rather than on a second flag beside it, which would say the same thing until
 *  the day the two drifted apart. An agent that can't is turned away by this alone, and the
 *  refusal names the ones that can. */
export function chatAgent(): ChatAgent {
  const { harness } = resolveHarness()
  return {
    name: harness.name,
    label: harness.label,
    canChat: harness.resumes,
    able: HARNESSES.filter((h) => h.resumes).map((h) => h.label),
  }
}

/** The label an agent name reads as, for saying which agent a conversation belongs to. */
export function harnessLabel(name: string): string {
  return harnessByName(name)?.label ?? name
}

/** True when this agent ran the session under the id we generated (Claude Code pins it
 *  with `--session-id`). Then the conversation's own id IS our key, so a run under it can
 *  always be resumed — nothing had to be reported mid-run and nothing had to be saved. */
export function adoptsSessionId(harnessName: string): boolean {
  const harness = harnessByName(harnessName)
  return !!harness && harness.resumes && harness.adoptsSessionId
}

/** How a fresh prompt calls the skill under the agent one runtime resolves to — `/kanban`
 *  for Claude Code, `$kanban` for Codex, or a sentence when the harness has no direct
 *  syntax. With no runtime named it is the board's global one. */
export function skillCall(runtime?: string): string {
  return resolveHarness({ runtime }).harness.skillCall
}

/** Invoke the skill with one user's words and no extra prompt. A chat's own turns stay on
 *  the global runtime until a conversation gets a pick of its own (#272). */
export function skillPrompt(message: string): string {
  const call = skillCall()
  return call === SKILL_SENTENCE ? `${call}: ${message}` : `${call} ${message}`
}

/** The one line the board hands the user to paste into their coding agent for the setup
 *  steps an agent does. It lives beside the other prompts because it says how the skill is
 *  invoked — and files under `skill/` never say that. The wording is one for every agent;
 *  only the way the skill is called follows the pick.
 *
 *  It is one line rather than one per step: setup picks up at the first unticked box, so
 *  the same paste restarts it wherever it stopped. */
export function setupInstruction(): string {
  return `${skillCall()}. Set up this board — follow docs/kanban/setup-checklist.md.`
}

/** Which agent runs the board, what it is set to, and everything a front end needs to
 *  offer the rest — including the settings each agent it could switch to takes, so nothing
 *  outside this package keeps its own list. */
export function agentInfo(): AgentInfo {
  // The BOARD's own answer, not this computer's: these fields are what `akb agent use` and
  // `akb agent set` read and write, and they write `harness` and `harnessSettings`. What a
  // runtime runs as here is `runtimes` below.
  const { harness, command, isDefault, values, secretsSet, ignored, unknownName, staleCommand } =
    resolveHarness({ board: true })
  // Which of the agents this machine could actually run, asked once for the whole list: one
  // read of the PATH, then every agent answered out of it. It happens on every read of the
  // setting rather than once at startup, so a CLI installed while the board was open counts
  // the next time anything asks.
  const cfg = safeConfig()
  const runtimes = readRuntimes(cfg)
  const harnessOf = harnessLookup()
  const onPath = pathLookup()
  return {
    name: harness.name,
    command,
    isDefault,
    values,
    // Which keys are set, and never a key. A saved one is never handed back: it buys
    // nothing, and a user who forgot theirs makes a new one.
    secretsSet,
    ignored,
    // Every agent's settings go down, not just the active one's: picking another draws its
    // own list right away, with nothing filled in, without asking again. So does whether
    // this machine can run it, and the command that installs it if it can't — a picker
    // offering an agent that isn't here sends the user to a run that dies on the spawn.
    //
    // `command` stays the harness's own, never the override: it is what a front end
    // compares against to notice there IS an override. What the override changes is which
    // binary gets looked up, and that is `binary`.
    //
    // The gaps go down with them (`agent/capabilities.ts`) so a picker can say what a switch
    // costs before it is made — not all of these agents report a price, name their model or
    // let go of a card when they are rate-limited, and none of that shows up until a run.
    options: HARNESSES.map((option) => {
      const { name, label, icon, command: cmd, settings, install } = option
      const runs = commandOf(configBlock(configBlock(cfg.harnessSettings)[option.name]), option)
      return {
        name,
        label,
        icon,
        command: cmd,
        settings,
        binary: commandBinary(runs),
        installed: onPath(runs),
        install,
        gaps: harnessGaps(option),
      }
    }),
    // The runtimes and what runs on which, worked out here so no screen and no second
    // command keeps a list that could say something else. The spec agents' own runtimes ride
    // on the spec agent list instead (`readSpecAgents`), which is the list they are drawn
    // from.
    runtimes: runtimeViews(runtimes),
    globalRuntime: runtimes.global,
    flows: FLOWS.map((flow) => {
      // `setup` always runs the global one: it is the run that has to work on a board
      // nobody has configured yet.
      const on = flow.command === 'setup' ? runtimes.global : runtimeOfFlow(flow.command, runtimes)
      return { command: flow.command, runtime: on, harness: harnessOf(on) }
    }),
    unknownName,
    staleCommand,
  }
}

/** What each runtime resolves to here, read once per runtime rather than once per flow —
 *  fourteen flows on two runtimes are two reads, not fourteen. */
function harnessLookup(): (runtime: string) => string {
  const seen = new Map<string, string>()
  return (runtime) => {
    const held = seen.get(runtime)
    if (held !== undefined) return held
    const name = resolveHarness({ runtime }).harness.name
    seen.set(runtime, name)
    return name
  }
}

/** Every runtime the board names, and what each one resolves to on this computer. */
export function runtimeViews(runtimes: BoardRuntimes = readRuntimes()): RuntimeView[] {
  return runtimes.names.map((name) => {
    const resolved = resolveHarness({ runtime: name })
    const model = resolved.values.model ?? ''
    return {
      name,
      global: name === runtimes.global,
      harness: resolved.harness.name,
      ...(model ? { model } : {}),
      ...(resolved.fallback ? { fallback: resolved.fallback } : {}),
    }
  })
}
