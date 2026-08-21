// Turning the saved settings into one run.
//
// Everything a run takes from the board's settings is resolved here, in a single read:
// the command to spawn, the flags its settings add, the environment it starts under, the
// parser for its output, and the name recorded against it. One read means a run can never
// be split across two agents — switching the picker while an agent is working changes what
// the NEXT run spawns, never this one.

import { harnessGaps } from './capabilities'
import type { RunClient } from './client'
import { HARNESSES, type Harness, DEFAULT_HARNESS, harnessByName, namesFlag } from './harnesses'
import { commandBinary, pathLookup } from './installed'
import { missingRequired, pickedProvider, providerSetting, shownForProvider } from './providers'
import { configBlock, readConfigRaw, readEnvFile } from './settings'
import type { StreamRenderer } from './stream'
import type { AgentInfo, ChatAgent, HarnessSetting, Provider } from './types'

interface ResolvedHarness {
  harness: Harness
  command: string
  isDefault: boolean
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

// The settings file, or nothing: an unreadable or malformed one runs the defaults, like a
// missing one.
function readConfigSafely(): Record<string, unknown> {
  try {
    return readConfigRaw()
  } catch {
    return {}
  }
}

/** The command one harness runs: the hand-written `command` override in its own block, or
 *  the harness's own. Every harness has a block of its own, so this is asked per harness —
 *  the picker looks up all of them, not only the one that is running. */
function commandOf(cfg: Record<string, unknown>, harness: Harness): string {
  const block = configBlock(configBlock(cfg.harnessSettings)[harness.name])
  const override = typeof block.command === 'string' ? block.command.trim() : ''
  return override || harness.command
}

function resolveHarness(pin?: string): ResolvedHarness {
  const cfg = readConfigSafely()
  const staleCommand = typeof cfg.command === 'string' && cfg.command.trim() ? true : undefined
  // `pin` is the agent a run already committed to — a resumed run continues the
  // conversation of the agent that started it, and a queued run keeps the one it was
  // started under. With nothing pinned it is whatever the file says.
  const asked = pin ?? (typeof cfg.harness === 'string' ? cfg.harness.trim() : '')
  const known = harnessByName(asked)
  const harness = known ?? DEFAULT_HARNESS
  // Always the running agent's own block, never the one the file asked for: a name we
  // don't ship runs the default, and the default's settings are the default's.
  const block = configBlock(configBlock(cfg.harnessSettings)[harness.name])
  const command = commandOf(cfg, harness)
  const argv = command.split(/\s+/).filter(Boolean)
  const values: Record<string, string> = {}
  const ignored: string[] = []
  const secretsSet: string[] = []
  // Read once for the whole loop — an agent can declare several secrets, and they all sit
  // in the same file.
  const env = harness.settings.some((s) => s.kind === 'secret') ? readEnvFile() : {}
  for (const setting of harness.settings) {
    // A key lives in docs/kanban/.env, never in this block. A hand-written one here is
    // ignored rather than used: the file we promised to keep it out of would be the one
    // holding it.
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
    values,
    secretsSet,
    ignored,
    unknownName: known ? undefined : asked || undefined,
    staleCommand,
  }
}

/** The settings the configured agent declares — the only keys that may be saved into its
 *  block. */
export function activeSettings(): HarnessSetting[] {
  return resolveHarness().harness.settings
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
export function settingSaveError(key: string, value: string): string | null {
  const resolved = resolveHarness()
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
  return harness.settings.flatMap((setting) => {
    const value = values[setting.key]
    if (!value || !setting.flags?.length || ignored.includes(setting.key)) return []
    // A setting the picked provider doesn't need can't reach the run either — whichever
    // way it would have got there. The pick decides the whole of what a run is given.
    if (!shownForProvider(harness.settings, setting.key, picked)) return []
    return [setting.flags[0]!, value]
  })
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
function runEnv(resolved: ResolvedHarness): NodeJS.ProcessEnv {
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
    // The picked provider can send this setting out under a different variable than the
    // setting's own — the same key is ANTHROPIC_API_KEY on Anthropic's API and
    // ANTHROPIC_AUTH_TOKEN on a gateway. Instead of, never as well as: both at once is two
    // auth sources, and the agent picks one of them.
    env[picked?.envAs?.[setting.key] ?? setting.env] = value
  }
  return { ...env, ...(picked?.env ?? {}) }
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
      if (setting?.env) names.add(setting.env)
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
   *  (agent/harnesses.ts). Undefined for a harness that has none. */
  quietStderr?: (line: string) => boolean
}

/** Work out how to start a fresh run under the agent the board is set to. */
export function planRun(sessionId: string): RunPlan {
  const resolved = resolveHarness()
  const { harness, command } = resolved
  const argv = command.split(/\s+/).filter(Boolean)
  return {
    harness: harness.name,
    argv: [...argv, ...settingArgs(resolved), ...harness.extraArgs(argv, sessionId)],
    resumeId: harness.adoptsSessionId ? sessionId : null,
    install: harness.install,
  }
}

/** Work out how to send one more turn into a conversation that already happened: same
 *  command, same env, same parser — only the flags differ, and the prompt is the "carry
 *  on" one rather than a card action's.
 *
 *  Null when this can't be done: the agent doesn't resume at all, or the run being resumed
 *  belongs to another agent. That last rule is why the name is checked — resuming a Claude
 *  Code conversation with a different CLI would hand it an id that means nothing there. */
export function planResume(harnessName: string, resumeId: string): RunPlan | null {
  const resolved = resolveHarness()
  const { harness, command } = resolved
  if (!harness.resumes || harness.name !== harnessName) return null
  const argv = command.split(/\s+/).filter(Boolean)
  return {
    harness: harness.name,
    argv: [...argv, ...settingArgs(resolved), ...harness.resumeArgs(argv, resumeId)],
    // The resumed turn runs under the id it resumed, so this run can be resumed again by
    // the same id — a failure two turns deep is still recoverable.
    resumeId,
    install: harness.install,
  }
}

/** The environment and the parser for a plan, at the moment it spawns. Split from the plan
 *  because a plan is written to the board and an API key is not: the keys are read out of
 *  docs/kanban/.env here, into the child's environment and nowhere else. */
export function openPlan(plan: RunPlan): ActiveRun {
  const resolved = resolveHarness(plan.harness)
  const { harness } = resolved
  return {
    ...plan,
    env: runEnv(resolved),
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

/** The name of the agent a run that stopped short can be resumed under right now — the
 *  configured one, if it resumes at all. A run offers Resume only when it ran under this
 *  same name. */
export function resumableHarness(): string | null {
  const { harness } = resolveHarness()
  return harness.resumes ? harness.name : null
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

/** How a prompt calls the skill under the agent the board runs right now — `/kanban` for
 *  Claude Code, `$kanban` for Codex. Every prompt opens with it. */
export function skillCall(): string {
  return resolveHarness().harness.skillCall
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
  const { harness, command, isDefault, values, secretsSet, ignored, unknownName, staleCommand } =
    resolveHarness()
  // Which of the agents this machine could actually run, asked once for the whole list: one
  // read of the PATH, then every agent answered out of it. It happens on every read of the
  // setting rather than once at startup, so a CLI installed while the board was open counts
  // the next time anything asks.
  const cfg = readConfigSafely()
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
      const runs = commandOf(cfg, option)
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
    unknownName,
    staleCommand,
  }
}
