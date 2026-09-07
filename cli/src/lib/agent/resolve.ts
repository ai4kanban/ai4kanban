// Turning the saved settings into one run.
//
// Everything a run takes from the board's settings is resolved here, in a single read:
// the command to spawn, the flags its settings add, the environment it starts under, the
// parser for its output, and the name recorded against it. One read means a run can never
// be split across two agents — switching the picker while an agent is working changes what
// the NEXT run spawns, never this one.

import fs from 'node:fs'

import { machineName } from '../machine/identity'
import { REPO_ROOT } from '../paths'
import { harnessGaps } from './capabilities'
import type { RunClient, StreamRenderer } from './wire'
import {
  HARNESSES,
  type Harness,
  DEFAULT_HARNESS,
  MODEL_KEY,
  RAW_ARGS_KEY,
  SKILL_SENTENCE,
  type ImageInput,
  harnessByName,
  namesFlag,
  uniqueIds,
} from './harnesses'
import { readStore } from './store'
import { FLOWS, flowPath } from './flows'
import { roleForFlow } from './roles'
import { binaryOnPath, commandBinary, pathLookup } from './installed'
import { languageNote } from './language'
import {
  missingRequired,
  pickedProvider,
  providerOwned,
  providerSetting,
  shownForProvider,
} from './providers'
import { specAgentNames } from '../spec-agent-names'
import { readEnvFile, safeConfig } from './settings'
import {
  GLOBAL_ID,
  harnessOfRuntime,
  pickRuntime,
  readAgentRuntime,
  readRuntimes,
  runtimeOfAgent,
  secretVar,
  type Runtime,
} from './runtimes'
import type {
  AgentInfo,
  ChatAgent,
  ChatRuntime,
  HarnessSetting,
  HarnessRun,
  Provider,
  RuntimeView,
} from './types'

interface ResolvedHarness {
  /** The runtime that answered — the whole of what this run runs as (#467). */
  runtime: Runtime
  harness: Harness
  command: string
  /** The runtime names a harness this build doesn't ship, so the default ran instead. */
  isDefault: boolean
  /** The agent this run belongs to — a role, or a specialist by name. Empty for a read that
   *  names none, which resolves **Global default**. */
  agent: string
  /** The runtime the agent's own pick named, when the board holds an id no row answers to —
   *  then **Global default** ran. */
  unknownAgentRuntime?: string
  /** What each declared setting is set to, keyed by its key. A setting the runtime doesn't
   *  carry is absent, meaning the harness's own default. A `secret` is never in here — its
   *  value lives in docs/kanban/.env and is never read back. */
  values: Record<string, string>
  /** The keys of the secret settings whose id-scoped variable docs/kanban/.env holds right
   *  now. Set or not set — the value itself never leaves this module. */
  secretsSet: string[]
  /** The keys whose flag the command override already names, so the override wins and the
   *  setting is never appended. */
  ignored: string[]
  /** The harness name the runtime asked for, when it isn't one of ours. */
  unknownName?: string
  /** The file still holds the pre-runtime top-level `command` key. Nothing reads it. */
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
 *  provider list — then it has no providers and every setting it declares is in effect.
 *
 *  Takes what it reads rather than a whole resolved harness, so the login probe can ask it
 *  about an agent that isn't the one running (agent/login.ts). */
export function activeProviderOf({
  harness,
  values,
  secretsSet,
}: {
  harness: Harness
  values: Record<string, string>
  secretsSet: string[]
}): Provider | undefined {
  const setting = providerSetting(harness.settings)
  if (!setting) return undefined
  return pickedProvider(setting, values[setting.key] ?? '', isFilled(harness, values, secretsSet))
}

/** The command one runtime runs: the hand-written `command` override in its settings, or the
 *  harness's own — with a bare binary nothing on the PATH answers swapped for the copy a
 *  desktop app shipped, when the harness says where that is.
 *
 *  The swap happens HERE rather than in the installed check because this one string is what
 *  every reader takes: the badge a pane draws, the line it shows under it, and the argv a run
 *  spawns. Teaching only the check would light the badge for a run that still dies on
 *  `spawn codex ENOENT`. */
export function commandOf(block: Record<string, string>, harness: Harness): string {
  return bundledBinary(block.command?.trim() || harness.command, harness)
}

// The command with its first word made absolute, or exactly what it was. Untouched when the
// harness names no bundled copy, when the command already says where its binary lives, or
// when the PATH answers the bare name — an install of the CLI proper always wins.
function bundledBinary(command: string, harness: Harness): string {
  if (!harness.bundled) return command
  const binary = commandBinary(command)
  if (!binary || binary.includes('/') || binary.includes('\\')) return command
  if (binaryOnPath(binary)) return command
  const found = harness.bundled().find((p) => p && !/\s/.test(p) && fs.existsSync(p))
  return found ? `${found}${command.slice(binary.length)}` : command
}

/** What one runtime is set to: each declared setting's value, which of its keys
 *  docs/kanban/.env holds right now, and which settings the command already names so the
 *  override wins. `argv` is that command, split.
 *
 *  Exported because a run is not the only reader: the login probe asks the same question of a
 *  runtime that isn't running (agent/login.ts), and two readers of one row have to read it the
 *  same way. */
export function readBlock(
  harness: Harness,
  block: Record<string, string>,
  argv: string[],
  /** Whose key lines to look for — a runtime's keys are named after its id (#467). */
  runtimeId: string,
): { values: Record<string, string>; secretsSet: string[]; ignored: string[] } {
  const values: Record<string, string> = {}
  const ignored: string[] = []
  const secretsSet: string[] = []
  // Read once for the whole loop — an agent can declare several secrets, and they all sit
  // in the same file.
  const env = harness.settings.some((s) => s.kind === 'secret') ? readEnvFile() : {}
  for (const setting of harness.settings) {
    // A key lives in docs/kanban/.env, never in this row. A hand-written one here is
    // ignored rather than used: the file we promised to keep it out of would be the one
    // holding it.
    if (setting.kind === 'secret') {
      if (setting.env && env[secretVar(setting.env, runtimeId)]) secretsSet.push(setting.key)
      continue
    }
    const value = block[setting.key]?.trim() ?? ''
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
  return { values, secretsSet, ignored }
}

/** What a run is asked for, before anything is read. */
export interface HarnessAsk {
  /** The agent doing the run (agent/runner.ts) — a role, or a specialist by name. Absent
   *  means **Global default**. */
  agent?: string
  /** The runtime a run already committed to — a resume continues the conversation the CLI that
   *  started it opened, a chat's own pick runs it, and a plan being reopened spawns exactly
   *  what it planned. A pin written before #467 names a harness, which resolves to the runtime
   *  that harness's block became. */
  pin?: string
  /** The harness a resume must spawn whatever the pin resolves to: an id means nothing to a
   *  CLI that never minted it. */
  harness?: string
}

function resolveHarness(ask: HarnessAsk = {}): ResolvedHarness {
  const cfg = safeConfig()
  const staleCommand = typeof cfg.command === 'string' && cfg.command.trim() ? true : undefined
  const agent = ask.agent ?? ''
  const list = readRuntimes(cfg)
  // Which runtime this agent runs, from the board and nowhere else: its own pick, or
  // **Global default** when it named none (agent/runtimes.ts).
  const picked = agent ? runtimeOfAgent(specAgentNames(agent), readAgentRuntime(cfg)) : undefined
  // `pin` wins over the board: a run already committed to a runtime spawns that runtime,
  // whatever the settings have been changed to since.
  const asked = ask.pin ?? picked
  const runtime = pickRuntime(list, asked, ask.harness)
  const unknownAgentRuntime =
    picked && !ask.pin && !list.some((r) => r.id === picked || r.harness === picked) ? picked : undefined
  const known = harnessByName(runtime.harness)
  const harness = known ?? DEFAULT_HARNESS
  // Everything this run is: one row, with nothing inherited from a per-harness block. A
  // harness name we don't ship runs the default, and then it is that harness's settings the
  // row is read against.
  const command = commandOf(runtime.settings, harness)
  const { values, secretsSet, ignored } = readBlock(
    harness,
    runtime.settings,
    command.split(/\s+/).filter(Boolean),
    runtime.id,
  )
  return {
    runtime,
    harness,
    command,
    isDefault: !known,
    agent,
    unknownAgentRuntime,
    values,
    secretsSet,
    ignored,
    unknownName: known ? undefined : runtime.harness || undefined,
    staleCommand,
  }
}

/** The line the board owes a run's log when the agent's own pick is not what it ran as. One
 *  case: the board names a runtime this board no longer has. Null otherwise, which is every
 *  ordinary run. */
export function harnessNote(resolved: {
  agent: string
  unknownAgentRuntime?: string
  runtime: Runtime
}): string | null {
  const { agent, unknownAgentRuntime, runtime } = resolved
  if (!unknownAgentRuntime) return null
  return `${agent} is set to run on the "${unknownAgentRuntime}" runtime, which this board no longer has — running ${runtime.name}.`
}

/** The settings the harness behind one runtime declares — the only keys that may be saved
 *  against it. With nothing named it is **Global default**'s. */
export function activeSettings(ask: HarnessAsk = {}): HarnessSetting[] {
  return resolveHarness(ask).harness.settings
}

/** What one agent runs here: the runtime, its harness and the settings that harness takes. */
export function agentHarness(agent?: string): {
  runtime: string
  name: string
  label: string
  settings: HarnessSetting[]
} {
  const { harness, runtime } = resolveHarness({ agent })
  return { runtime: runtime.id, name: harness.name, label: harness.label, settings: harness.settings }
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
export function settingSaveError(key: string, value: string, ask: HarnessAsk = {}): string | null {
  const resolved = resolveHarness(ask)
  const { harness, values, secretsSet } = resolved
  const list = providerSetting(harness.settings)
  if (!list) return null
  const filled = isFilled(harness, values, secretsSet)
  const label = (k: string) => harness.settings.find((s) => s.key === k)?.label ?? k

  if (key === list.key) {
    const provider = list.providers?.find((p) => p.id === value)
    if (!provider) return `"${value}" isn't one of the ${list.label.toLowerCase()} choices`
    const missing = missingHere(harness, provider, filled)
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
  // The pick's own arguments, for a connector that names its provider on the command line
  // rather than in the environment (Codex). They come first, so the settings that fill in
  // that provider's block follow the block itself.
  //
  // A `command` that names the provider setting's flag has picked by hand, and then nothing
  // the board's pick would have written reaches the command line — neither the pick's
  // arguments nor the settings that belong to it. The environment is untouched: a
  // hand-written provider is free to read the key the box already holds.
  const list = providerSetting(harness.settings)
  const byHand = !!list && ignored.includes(list.key)
  const providerArgs = byHand ? [] : (picked?.args ?? [])
  const flags = harness.settings.flatMap((setting) => {
    const value = values[setting.key]
    if (!value || !setting.flags?.length || ignored.includes(setting.key)) return []
    // The provider list is never a flag of its own. Its `flags` name the config key a
    // hand-written command would pick with, which is what `byHand` above is read from; what
    // the pick itself writes is that provider's `args`.
    if (setting.kind === 'provider') return []
    if (byHand && providerOwned(harness.settings, setting.key)) return []
    // A setting the picked provider doesn't need can't reach the run either — whichever
    // way it would have got there. The pick decides the whole of what a run is given.
    if (!shownForProvider(harness.settings, setting.key, picked)) return []
    // A setting the CLI has no flag of its own for rides on a generic config flag as one
    // `key=value` entry; everything else is the flag and then the value.
    const flag = setting.flags[0]!
    return setting.configFlag ? [setting.configFlag, `${flag}=${value}`] : [flag, value]
  })
  // The raw arguments go last of the settings' own, and so still BEFORE whatever the
  // harness adds: a connector whose own arguments open a subcommand (`codex exec … resume
  // <id>`) takes everything after that subcommand as the subcommand's.
  //
  // Split on spaces, the same way the command itself is, and nothing is checked: what this
  // is for is the flags the board has no words for, and only the CLI can judge one.
  return [...providerArgs, ...flags, ...(values[RAW_ARGS_KEY]?.split(/\s+/).filter(Boolean) ?? [])]
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
  const { harness, values, runtime } = resolved
  const picked = activeProviderOf(resolved)
  const env: NodeJS.ProcessEnv = { ...harness.env() }
  for (const name of ownedVars(harness)) delete env[name]

  const file = readEnvFile()
  for (const setting of harness.settings) {
    if (!setting.env) continue
    if (!shownForProvider(harness.settings, setting.key, picked)) continue
    // A key is this runtime's own line, named after its id — two runtimes on one harness sign
    // with two keys (#467).
    const value = setting.kind === 'secret' ? file[secretVar(setting.env, runtime.id)] : values[setting.key]
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
  /** The harness's name, stamped onto the run. */
  harness: string
  /** The runtime it was resolved from (#467) — what a resume pins, so picking a run up spawns
   *  the endpoint, key and model it went on. Absent on a plan written before runtimes. */
  runtime?: string
  /** The agent this run belongs to — a role, or a specialist by name (#443). Absent on a
   *  run that belongs to no agent, and on a plan written before agents picked a connector. */
  agent?: string
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
  /** Talks to this agent over its own pipes (agent/wire/). */
  client?: RunClient
  /** This agent's own housekeeping chatter on stderr, which the log leaves out
   *  (agent/harnesses/types.ts). Undefined for a harness that has none. */
  quietStderr?: (line: string) => boolean
  /** How this connector takes a picture on disk (#441) — a flag per file, or a path
   *  written into the words. Undefined for one that can't see images at all. */
  images?: ImageInput
}

/** Work out how to start a fresh run. `cwd` is the folder it works in — the project, or a
 *  delivery's own worktree (#303) — and `agent` is the one doing the run (agent/runner.ts),
 *  whose runtime it spawns on. `note` is the line the board owes the run's log when that
 *  runtime isn't what it ran as. */
export function planRun(
  sessionId: string,
  cwd = REPO_ROOT,
  agent?: string,
  /** The runtime this one spawn takes over the agent's — a conversation's own pick (#272).
   *  Empty for every ordinary run. */
  own: Omit<HarnessAsk, 'agent'> = {},
): RunPlan & { note: string | null } {
  const resolved = resolveHarness({ agent, ...own })
  const { harness, command, runtime } = resolved
  const argv = command.split(/\s+/).filter(Boolean)
  return {
    harness: harness.name,
    runtime: runtime.id,
    ...(agent ? { agent } : {}),
    argv: [...argv, ...settingArgs(resolved), ...harness.extraArgs(argv, sessionId, cwd)],
    resumeId: harness.adoptsSessionId ? sessionId : null,
    install: harness.install,
    cwd,
    note: harnessNote(resolved),
  }
}

/** Work out how to send one more turn into a conversation that already happened: same
 *  command, same env, same parser — only the flags differ, and the prompt is the "carry
 *  on" one rather than a card action's.
 *
 *  A resume spawns the HARNESS the run itself went on, whatever its runtime has been pointed
 *  at since: handing a Claude Code conversation's id to another CLI would mean nothing there.
 *  Inside that harness it resolves the runtime the run pinned, so the endpoint, the key and
 *  the model are the ones it went on. Null when that harness is one this build doesn't run,
 *  or can't resume. */
export function planResume(
  harnessName: string,
  resumeId: string,
  cwd = REPO_ROOT,
  agent?: string,
  /** The runtime the run pinned, or a conversation's own pick (#272). */
  own: Omit<HarnessAsk, 'agent' | 'harness'> = {},
): RunPlan | null {
  if (!harnessByName(harnessName)) return null
  const resolved = resolveHarness({ agent, ...own, harness: harnessName })
  const { harness, command, runtime } = resolved
  if (!harness.resumes) return null
  const argv = command.split(/\s+/).filter(Boolean)
  return {
    harness: harness.name,
    runtime: runtime.id,
    ...(agent ? { agent } : {}),
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
  const resolved = resolveHarness({ agent: plan.agent, pin: plan.runtime, harness: plan.harness })
  const { harness } = resolved
  return {
    ...plan,
    env: runEnv(resolved, plan.cwd ?? REPO_ROOT),
    // The folder and the binary: what a renderer needs to go looking for what the stream
    // left out (agent/harnesses/types.ts). argv's first word is the command's own binary,
    // the same one the spawn resolves and an ENOENT names.
    renderer: harness.renderer?.(plan.cwd ?? REPO_ROOT, plan.argv[0]),
    // The client is handed the settings that are actually in effect — the same ones that
    // would have reached the run as flags, minus whatever the picked provider doesn't
    // need — because for a connector that talks, a setting is something the conversation
    // opens with rather than something argv carries.
    client: harness.client?.(effectiveValues(resolved)),
    quietStderr: harness.quietStderr,
    images: harness.images,
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

/** True when a run that went on this connector can be picked up again — this build still
 *  ships it and its CLI resumes. It is the run's OWN connector that is asked about, never
 *  what its agent is set to now, so re-pointing an agent leaves finished runs resumable
 *  (#443). */
export function resumesUnder(harnessName: string | undefined): boolean {
  const harness = harnessByName(harnessName)
  return !!harness && harness.resumes
}

/** Whose settings a conversation and the setup line are read under (#443). A chat about a
 *  card is planning work, and so is setup, so both follow the planner — the one role every
 *  board has, on either solution. */
const PLANNER = 'planner'

/** Which harness this board's conversations are held with, and whether it can hold one.
 *  `pin` is the runtime the conversation picked for itself, with none the planner's.
 *
 *  A conversation is one message after another into the session the agent already opened,
 *  and that is exactly what `resumes` says a CLI can do — so chat leans on that one
 *  capability rather than on a second flag beside it, which would say the same thing until
 *  the day the two drifted apart. An agent that can't is turned away by this alone, and the
 *  refusal names the ones that can. */
export function chatAgent(pin?: string): ChatAgent {
  const { harness, runtime } = resolveHarness({ agent: PLANNER, pin })
  return {
    runtime: runtime.id,
    name: harness.name,
    label: harness.label,
    canChat: harness.resumes,
    able: HARNESSES.filter((h) => h.resumes).map((h) => h.label),
    // Declared by the connector rather than derived (#441): a CLI either takes a file on
    // disk or it doesn't, and no model this run happens to pick changes that.
    seesImages: harness.images !== undefined,
    imagesAble: HARNESSES.filter((h) => h.images).map((h) => h.label),
  }
}

/** Every runtime a conversation can be pointed at (#272, #467), in the board's own order.
 *  The offer comes from here rather than from a list in the UI: it is the same "can hold a
 *  conversation" a refusal already names, and the model on each row is that runtime's own,
 *  read exactly as Configuration reads it. */
export function chatRuntimes(): ChatRuntime[] {
  const onPath = pathLookup()
  return readRuntimes()
    .filter((runtime) => harnessOfRuntime(runtime).resumes)
    .map((runtime) => {
      const resolved = resolveHarness({ agent: PLANNER, pin: runtime.id })
      return {
        id: runtime.id,
        name: runtime.name,
        harness: resolved.harness.name,
        label: resolved.harness.label,
        icon: resolved.harness.icon,
        model: resolved.values[MODEL_KEY] ?? '',
        installed: onPath(resolved.command),
      }
    })
}

/** How the harness one conversation runs takes a picture on disk (#441) — `pin` is the runtime
 *  it picked for itself, with none the planner's, which is what a chat spawns. Undefined for
 *  one that can't see a picture at all, which is the answer a paste is turned away on. */
export function harnessImages(pin?: string): ImageInput | undefined {
  return resolveHarness({ agent: PLANNER, pin }).harness.images
}

/** The model one runtime runs — what a conversation on it says it is running. */
export function runtimeModel(pin?: string): string {
  return resolveHarness({ agent: PLANNER, pin }).values[MODEL_KEY] ?? ''
}

/** The name one runtime reads as, for saying what a conversation runs. A pin nothing answers
 *  to reads as **Global default**, which is what would actually run. */
export function runtimeName(pin?: string): string {
  return pickRuntime(readRuntimes(), pin).name
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

/** How a fresh prompt calls the skill under the connector one agent runs — `/kanban` for
 *  Claude Code, `$kanban` for Codex, or a sentence when the connector has no direct syntax.
 *  With no agent named it is the board's default connector. */
export function skillCall(agent?: string): string {
  return resolveHarness({ agent }).harness.skillCall
}

/** Invoke the skill with one user's words and no extra prompt. `pin` is the agent a
 *  conversation picked for itself (#272), whose own syntax the call then follows; with none
 *  it is the board's. */
export function skillPrompt(message: string, pin?: string): string {
  const call = resolveHarness({ agent: PLANNER, pin }).harness.skillCall
  return call === SKILL_SENTENCE ? `${call}: ${message}` : `${call} ${message}`
}

/** The one line the board hands the user to paste into their coding agent for the setup
 *  steps an agent does. It lives beside the other prompts because it says how the skill is
 *  invoked — and files under `skill/` never say that. The wording is one for every agent;
 *  only the way the skill is called follows the pick.
 *
 *  It is one line rather than one per step: setup picks up at the first unticked box, so
 *  the same paste restarts it wherever it stopped.
 *
 *  It carries the board's language itself (#337): a pasted line never goes through the ask,
 *  and setup is where a board's first cards and memory notes are written. */
export function setupInstruction(): string {
  return [`${skillCall(PLANNER)}. Set up this board — follow docs/kanban/setup-checklist.md.`, languageNote()]
    .filter(Boolean)
    .join(' ')
}

// ---- what the Model box offers ---------------------------------------------
//
// The board ships no list of models and never will: one written into this build would be
// wrong the day a provider releases something, and the box has always been free text for
// that reason. What it offers instead is read per machine — the list the agent's own CLI
// keeps (`models` on Harness), and the models this board has actually run.
//
// Neither decides anything. The box stays free text, nothing is checked against these, and
// an agent with nothing to read draws the box it always drew.

/** The models each agent on this board has run, newest first. The only source for a CLI
 *  that publishes no list of its own, and after one run it is the answer a user most often
 *  wants back. Every id here is one that agent really took. */
function modelsRun(): Map<string, string[]> {
  const ran = new Map<string, string[]>()
  const { runs } = readStore()
  for (let i = runs.length - 1; i >= 0; i--) {
    const run = runs[i]!
    if (!run.harness || !run.model) continue
    const seen = ran.get(run.harness) ?? []
    if (!seen.includes(run.model)) seen.push(run.model)
    ran.set(run.harness, seen)
  }
  return ran
}

function mergeModels(harness: Harness | undefined, ran: string[]): string[] {
  return uniqueIds([...(harness?.models?.() ?? []), ...ran])
}

/** A connector's settings with its Model box's list filled in. */
function withModels(harness: Harness, settings: HarnessSetting[], ran: string[]): HarnessSetting[] {
  const suggestions = mergeModels(harness, ran)
  if (!suggestions.length) return settings
  return settings.map((setting) => (setting.key === MODEL_KEY ? { ...setting, suggestions } : setting))
}

/** The board's runtimes, every harness they can name, and which agent runs each flow —
 *  everything a front end needs to draw Configuration without keeping a list of its own. */
export function agentInfo(): AgentInfo {
  // **Global default** — the first row, and what an agent naming no runtime runs.
  const { harness, command, isDefault, values, secretsSet, ignored, unknownName, staleCommand } =
    resolveHarness()
  // Which of the CLIs this machine could actually run, asked once for the whole list: one read
  // of the PATH, then every row answered out of it. It happens on every read of the setting
  // rather than once at startup, so a CLI installed while the board was open counts the next
  // time anything asks.
  const onPath = pathLookup()
  const ran = modelsRun()
  const harnessOf = harnessLookup()
  return {
    name: harness.name,
    command,
    isDefault,
    values,
    // Which keys are set, and never a key. A saved one is never handed back: it buys
    // nothing, and a user who forgot theirs makes a new one.
    secretsSet,
    ignored,
    // The list the Runtimes pane draws, in the board's own order with **Global default**
    // first. Each row is the whole truth about one run — its harness's settings, what this
    // row has them set to, which of its keys this computer holds, and whether the CLI it
    // names is here.
    runtimes: (() => {
      // Which rows the agents have named, counted once for the whole list — a delete says how
      // many agents fall back to **Global default**, and that answer is the board's picks and
      // nothing else.
      const named = Object.values(readAgentRuntime())
      return readRuntimes().map((runtime) => runtimeView(runtime, onPath, ran, named))
    })(),
    // Every harness's own settings go down with them, not just the running one's: switching a
    // row's harness draws its list right away, without asking again. The gaps go too
    // (`agent/capabilities.ts`), so a picker can say what a switch costs before it is made —
    // not all of these report a price, name their model or let go of a card when they are
    // rate-limited, and none of that shows up until a run.
    //
    // `command` stays the harness's own, never a row's override.
    options: HARNESSES.map((option) => {
      const { name, label, icon, command: cmd, settings, install } = option
      // …and what the first row on each harness is set to, for a screen that lists harnesses
      // rather than runtimes. A run never reads it: `runtimes` above is what one resolves from.
      const first = resolveHarness({ pin: name, harness: name })
      // The binary this card is answered on is the RESOLVED one, the same as every other
      // reader's: the connector grid is where "not installed" is drawn, and a CLI that ships
      // inside a desktop app would read as missing on the one screen that offers it.
      const spawns = bundledBinary(cmd, option)
      return {
        name,
        label,
        icon,
        command: cmd,
        settings: withModels(option, settings, ran.get(name) ?? []),
        binary: commandBinary(spawns),
        installed: onPath(spawns),
        install,
        gaps: harnessGaps(option),
        runs: first.command,
        values: first.values,
        secretsSet: first.secretsSet,
        ignored: first.ignored,
      }
    }),
    // The name a screen shows this computer by. The hostname alone — reading it mints no
    // identity (machine/identity.ts).
    machine: machineName(),
    // Which agent runs each flow, and what that agent runs here — worked out once so no
    // screen and no second command keeps a list that could say something else.
    flows: FLOWS.map((flow) => {
      const agent = roleForFlow(flow.command)?.name ?? ''
      return { command: flow.command, path: flowPath(flow), agent, harness: harnessOf(agent) }
    }),
    unknownName,
    staleCommand,
  }
}

// One row, as the pane draws it: what it is, what it runs, and what this computer can say
// about it. The values are read exactly the way a run reads them, so nothing on the row can
// disagree with what would spawn.
function runtimeView(
  runtime: Runtime,
  onPath: (command: string) => boolean,
  ran: Map<string, string[]>,
  named: string[],
): RuntimeView {
  const resolved = resolveHarness({ pin: runtime.id })
  const { harness, command, values, secretsSet, ignored } = resolved
  return {
    id: runtime.id,
    name: runtime.name,
    fixed: runtime.id === GLOBAL_ID,
    // What RUNS, never what the file asked for: a harness we don't ship runs the default, and
    // the settings, label and mark beside it are that default's. What was asked is
    // `unknownHarness`, which is the only place the unshipped name is said.
    harness: harness.name,
    label: harness.label,
    icon: harness.icon,
    unknownHarness: resolved.isDefault ? runtime.harness : undefined,
    agents: named.filter((pick) => pick === runtime.id).length,
    settings: withModels(harness, harness.settings, ran.get(harness.name) ?? []),
    values,
    secretsSet,
    ignored,
    model: values[MODEL_KEY] ?? '',
    command: harness.command,
    runs: command,
    binary: commandBinary(command),
    installed: onPath(command),
    install: harness.install,
    gaps: harnessGaps(harness),
  }
}

/** What one agent runs here, and whether that is its own pick or **Global default** (#467).
 *  The one answer the Agents pane and `akb agent` both draw. */
export function agentRun(agent: string, table = readAgentRuntime()): HarnessRun {
  const picked = runtimeOfAgent(specAgentNames(agent), table)
  const resolved = resolveHarness({ agent })
  return {
    runtime: resolved.runtime.id,
    runtimeName: resolved.runtime.name,
    harness: resolved.harness.name,
    own: !!picked,
    model: resolved.values[MODEL_KEY] ?? '',
    // Set only when the board names a runtime it no longer has: the fields around it are the
    // row that WOULD run, so a pane can say the saved pick stopped working without drawing
    // one runtime's values under another's name.
    ...(resolved.unknownAgentRuntime ? { unknownRuntime: resolved.unknownAgentRuntime } : {}),
  }
}

/** The runtimes this machine could run right now, in the board's own order — the CLI is on
 *  the PATH, and the provider that row resolves to wants nothing that is not filled in. A
 *  row still waiting on a key or a base URL is left off: trying it would ask for the very
 *  setting the try was meant to spare the user (#404).
 *
 *  Spawn-free and uncached, like `installed` — it reads the PATH and the saved settings and
 *  nothing else. Whether one of them ANSWERS is `testConnection`'s question, and this list is
 *  what the first run asks it of, one at a time. */
export function runnableAgents(): string[] {
  const onPath = pathLookup()
  return readRuntimes()
    .filter((runtime) => couldRun(resolveHarness({ pin: runtime.id }), onPath))
    .map((runtime) => runtime.id)
}

/** The same question asked of the HARNESSES, in the order they are declared — the CLI is on
 *  the PATH and the settings **Global default** would run it under want nothing unfilled.
 *
 *  What the guided first run walks (`AgentProbe`): it is choosing the harness **Global
 *  default** runs, and a board that has never been set up holds exactly one runtime, so the
 *  runtimes list has nothing there for it to try. */
export function runnableHarnesses(): string[] {
  const onPath = pathLookup()
  return HARNESSES.filter((harness) =>
    couldRun(resolveHarness({ pin: harness.name, harness: harness.name }), onPath),
  ).map((harness) => harness.name)
}

// Its CLI is here, and nothing its picked provider must have is still empty.
function couldRun(resolved: ResolvedHarness, onPath: (command: string) => boolean): boolean {
  const { harness, command, values, secretsSet } = resolved
  if (!onPath(command)) return false
  const filled = isFilled(harness, values, secretsSet)
  return missingHere(harness, activeProviderOf(resolved), filled).length === 0
}

/** What a runtime's picked provider is still missing. A key that picks a model is left out:
 *  a runtime is never called unreachable for a model nobody has typed yet — a missing model
 *  fails the run itself, and the log says so. */
export function missingHere(
  harness: Harness,
  provider: Provider | undefined,
  filled: (key: string) => boolean,
): string[] {
  return missingRequired(provider, filled).filter(
    (key) => !harness.settings.some((s) => s.key === key && s.agentOwned),
  )
}

/** What each agent runs here, read once per agent rather than once per flow — fourteen flows
 *  across three roles are three reads, not fourteen. */
function harnessLookup(): (agent: string) => string {
  const seen = new Map<string, string>()
  return (agent) => {
    const held = seen.get(agent)
    if (held !== undefined) return held
    const name = resolveHarness({ agent }).harness.name
    seen.set(agent, name)
    return name
  }
}
