// Turning the saved settings into one run.
//
// Everything a run takes from the board's settings is resolved here, in a single read:
// the command to spawn, the flags its settings add, the environment it starts under, the
// parser for its output, and the name recorded against it. One read means a run can never
// be split across two agents — switching the picker while an agent is working changes what
// the NEXT run spawns, never this one.

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
import { commandBinary, pathLookup } from './installed'
import { languageNote } from './language'
import {
  missingRequired,
  pickedProvider,
  providerOwned,
  providerSetting,
  shownForProvider,
} from './providers'
import { localAgentValues } from './local'
import { specAgentNames } from '../spec-agent-names'
import { configBlock, harnessOfAgent, readAgentHarness, readEnvFile, safeConfig } from './settings'
import type { AgentInfo, ChatAgent, ChatPickAgent, HarnessSetting, HarnessRun, Provider } from './types'

interface ResolvedHarness {
  harness: Harness
  command: string
  isDefault: boolean
  /** The agent this run belongs to — a role, or a specialist by name (#443). Empty for a
   *  read that names none, which resolves the board's default connector. */
  agent: string
  /** The connector the agent's own pick named, when it isn't the one that ran: the board
   *  holds a name this build doesn't ship, so the run fell back. */
  unknownAgentHarness?: string
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

/** The command one harness runs for a block of its settings: the hand-written `command`
 *  override in that block, or the harness's own. */
export function commandOf(block: Record<string, unknown>, harness: Harness): string {
  const override = typeof block.command === 'string' ? block.command.trim() : ''
  return override || harness.command
}

/** What one agent's saved block is set to: each declared setting's value, which of its keys
 *  docs/kanban/.env holds right now, and which settings the command already names so the
 *  override wins. `argv` is that command, split.
 *
 *  Exported because a run is not the only reader: the login probe asks the same question of
 *  an agent that isn't running (agent/login.ts), and two readers of one block have to read
 *  it the same way. */
export function readBlock(
  harness: Harness,
  block: Record<string, unknown>,
  argv: string[],
): { values: Record<string, string>; secretsSet: string[]; ignored: string[] } {
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
  return { values, secretsSet, ignored }
}

/** What a run is asked for, before anything is read. */
export interface HarnessAsk {
  /** The agent doing the run (agent/runner.ts) — a role, or a specialist by name. Absent
   *  means the board's default connector, with no agent's own model under it. */
  agent?: string
  /** The connector a run already committed to — a resume continues the conversation the agent
   *  that started it opened, and a plan being reopened spawns exactly what it planned. */
  pin?: string
  /** Settings that win over the saved ones for this one spawn — a conversation's own model
   *  (#272). Saved nowhere: the board's settings and this machine's are untouched. */
  settings?: Record<string, string>
}

function resolveHarness(ask: HarnessAsk = {}): ResolvedHarness {
  const cfg = safeConfig()
  const staleCommand = typeof cfg.command === 'string' && cfg.command.trim() ? true : undefined
  const agent = ask.agent ?? ''
  // Which connector this agent runs, from the board and nowhere else: its own pick, or the
  // board's default when it made none (agent/settings.ts).
  const picked = agent ? harnessOfAgent(specAgentNames(agent), readAgentHarness(cfg)) : undefined
  // `pin` wins over the board: a run already committed to a connector spawns that connector,
  // whatever the settings have been changed to since.
  const asked = ask.pin ?? picked ?? (typeof cfg.harness === 'string' ? cfg.harness.trim() : '')
  const known = harnessByName(asked)
  const harness = known ?? DEFAULT_HARNESS
  const unknownAgentHarness = picked && !ask.pin && !harnessByName(picked) ? picked : undefined
  // What the connector that RAN is set to, out of two files: how to reach it is the board's,
  // in its own block under `harnessSettings`; which model to run is this agent's, on this
  // computer (agent/local.ts). A connector name we don't ship runs the default, and then it
  // is the default's own settings that are read.
  const block: Record<string, unknown> = {
    ...configBlock(configBlock(cfg.harnessSettings)[harness.name]),
    ...localAgentValues(agent, harness.name),
    // Last, so one conversation's own model wins over both (#272).
    ...(ask.settings ?? {}),
  }
  const command = commandOf(block, harness)
  const { values, secretsSet, ignored } = readBlock(harness, block, command.split(/\s+/).filter(Boolean))
  return {
    harness,
    command,
    isDefault: !known,
    agent,
    unknownAgentHarness,
    values,
    secretsSet,
    ignored,
    unknownName: known ? undefined : asked || undefined,
    staleCommand,
  }
}

/** The line the board owes a run's log when the agent's own pick is not what it ran as. One
 *  case: the board names a connector this version doesn't ship. Null otherwise, which is
 *  every ordinary run. */
export function harnessNote(resolved: {
  agent: string
  unknownAgentHarness?: string
  harness: Harness
}): string | null {
  const { agent, unknownAgentHarness, harness } = resolved
  if (!unknownAgentHarness) return null
  return `${agent} is set to run on "${unknownAgentHarness}", which this version doesn't run — running ${harness.label}.`
}

/** The settings the connector behind one agent declares — the only keys that may be saved
 *  against it. With no agent named it is the board's default connector. */
export function activeSettings(ask: HarnessAsk = {}): HarnessSetting[] {
  return resolveHarness(ask).harness.settings
}

/** What one agent runs here: the connector's name and label, and the settings it takes. */
export function agentHarness(agent?: string): { name: string; label: string; settings: HarnessSetting[] } {
  const { harness } = resolveHarness({ agent })
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
  /** Settings this spawn takes over the board's — a conversation's own model (#272).
   *  Carried on the plan so reopening it resolves the same values a connector that takes
   *  its model in the conversation needs, not only the flags argv already holds. */
  settings?: Record<string, string>
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
 *  delivery's own worktree (#303) — and `agent` is the one doing the run
 *  (agent/runner.ts), whose connector and model it spawns on. `note` is the line the board
 *  owes the run's log when that connector isn't what it ran as. */
export function planRun(
  sessionId: string,
  cwd = REPO_ROOT,
  agent?: string,
  /** The connector and the settings this one spawn takes over the saved ones — a
   *  conversation's own pick (#272). Empty for every ordinary run. */
  own: Omit<HarnessAsk, 'agent'> = {},
): RunPlan & { note: string | null } {
  const resolved = resolveHarness({ agent, ...own })
  const { harness, command } = resolved
  const argv = command.split(/\s+/).filter(Boolean)
  return {
    harness: harness.name,
    ...(agent ? { agent } : {}),
    argv: [...argv, ...settingArgs(resolved), ...harness.extraArgs(argv, sessionId, cwd)],
    resumeId: harness.adoptsSessionId ? sessionId : null,
    install: harness.install,
    cwd,
    ...(own.settings ? { settings: own.settings } : {}),
    note: harnessNote(resolved),
  }
}

/** Work out how to send one more turn into a conversation that already happened: same
 *  command, same env, same parser — only the flags differ, and the prompt is the "carry
 *  on" one rather than a card action's.
 *
 *  A resume spawns the connector the run itself went on, whatever that agent has been
 *  pointed at since (#443): handing a Claude Code conversation's id to another CLI would mean
 *  nothing there. Null when that connector is one this build doesn't run, or can't resume. */
export function planResume(
  harnessName: string,
  resumeId: string,
  cwd = REPO_ROOT,
  agent?: string,
  /** As `planRun`: what this one spawn takes over the saved settings (#272). */
  own: Omit<HarnessAsk, 'agent'> = {},
): RunPlan | null {
  if (!harnessByName(harnessName)) return null
  // `pin` LAST, over `own`'s: a conversation that picked a connector for itself (#272) still
  // has to be picked up by the one that opened this session, and only its settings carry.
  const resolved = resolveHarness({ agent, ...own, pin: harnessName })
  const { harness, command } = resolved
  if (!harness.resumes) return null
  const argv = command.split(/\s+/).filter(Boolean)
  return {
    harness: harness.name,
    ...(agent ? { agent } : {}),
    argv: [...argv, ...settingArgs(resolved), ...harness.resumeArgs(argv, resumeId, cwd)],
    // The resumed turn runs under the id it resumed, so this run can be resumed again by
    // the same id — a failure two turns deep is still recoverable.
    resumeId,
    install: harness.install,
    cwd,
    ...(own.settings ? { settings: own.settings } : {}),
  }
}

/** The environment and the parser for a plan, at the moment it spawns. Split from the plan
 *  because a plan is written to the board and an API key is not: the keys are read out of
 *  docs/kanban/.env here, into the child's environment and nowhere else. */
export function openPlan(plan: RunPlan): ActiveRun {
  const resolved = resolveHarness({ agent: plan.agent, pin: plan.harness, settings: plan.settings })
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

/** Which agent this board's conversations are held with, and whether it can hold one.
 *
 *  A conversation is one message after another into the session the agent already opened,
 *  and that is exactly what `resumes` says a CLI can do — so chat leans on that one
 *  capability rather than on a second flag beside it, which would say the same thing until
 *  the day the two drifted apart. An agent that can't is turned away by this alone, and the
 *  refusal names the ones that can. */
export function chatAgent(pin?: string): ChatAgent {
  const { harness } = resolveHarness({ agent: PLANNER, pin })
  return {
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

/** Every agent a conversation can be pointed at (#272), and what the board already has
 *  each one set to. The offer comes from here rather than from a list in the UI: it is the
 *  same "can hold a conversation" a refusal already names, and the model each one starts
 *  from is that agent's own setting read exactly as Configuration reads it. */
export function chatPickAgents(): ChatPickAgent[] {
  const onPath = pathLookup()
  return HARNESSES.filter((h) => h.resumes).map((option) => {
    const resolved = resolveHarness({ agent: PLANNER, pin: option.name })
    return {
      name: option.name,
      label: option.label,
      icon: option.icon,
      // No box where there is nothing for it to set: an agent that declares no model, and
      // one whose own `command` already names the flag, both ignore what is typed.
      takesModel:
        option.settings.some((s) => s.key === 'model') && !resolved.ignored.includes('model'),
      model: resolved.values.model ?? '',
      installed: onPath(resolved.command),
    }
  })
}

/** How the connector one conversation runs takes a picture on disk (#441) — `pin` is the one
 *  it picked for itself, with none the planner's, which is what a chat spawns (#443).
 *  Undefined for one that can't see a picture at all, which is the answer a paste is turned
 *  away on. */
export function harnessImages(pin?: string): ImageInput | undefined {
  return resolveHarness({ agent: PLANNER, pin }).harness.images
}

/** The model a conversation on one connector starts from — the planner's own, since a chat
 *  about a card is planning work — and what one click puts it back to. */
export function harnessModel(name?: string): string {
  return resolveHarness({ agent: PLANNER, pin: name }).values.model ?? ''
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

/** Every model id worth offering for an agent: what its CLI knows here, in that CLI's own
 *  order, then anything this board has run that the list left out.
 *
 *  One list, wherever a model is picked — the settings pane and a chat's own row both draw
 *  this. Two shortcuts disagreeing about what this machine can run is worse than either of
 *  them being short. */
export function modelsKnown(harness: string): string[] {
  return mergeModels(harnessByName(harness), modelsRun().get(harness) ?? [])
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

/** Which connector runs the board by default, what each one is set to, and which agent runs
 *  each flow — everything a front end needs to draw Configuration without keeping a list of
 *  its own. */
export function agentInfo(): AgentInfo {
  // The board's DEFAULT connector — the `harness` and `harnessSettings` `akb agent use` and
  // `akb agent set` write, and what an agent that picked none runs.
  const { harness, command, isDefault, values, secretsSet, ignored, unknownName, staleCommand } =
    resolveHarness()
  // Which of the connectors this machine could actually run, asked once for the whole list:
  // one read of the PATH, then every connector answered out of it. It happens on every read of
  // the setting rather than once at startup, so a CLI installed while the board was open counts
  // the next time anything asks.
  const cfg = safeConfig()
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
    // Every connector's settings go down, not just the running one's: picking another draws
    // its own list right away, without asking again. So does what it is already set to,
    // whether this machine can run it, and the command that installs it if it can't — a
    // picker offering a connector that isn't here sends the user to a run that dies on the
    // spawn.
    //
    // `command` stays the connector's own, never the override: it is what a front end
    // compares against to notice there IS an override. What the override changes is which
    // binary gets looked up, and that is `binary`.
    //
    // The gaps go down with them (`agent/capabilities.ts`) so a picker can say what a switch
    // costs before it is made — not all of these connectors report a price, name their model
    // or let go of a card when they are rate-limited, and none of that shows up until a run.
    options: HARNESSES.map((option) => {
      const { name, label, icon, command: cmd, settings, install } = option
      const block = configBlock(configBlock(cfg.harnessSettings)[option.name])
      const runs = commandOf(block, option)
      const read = readBlock(option, block, runs.split(/\s+/).filter(Boolean))
      return {
        name,
        label,
        icon,
        command: cmd,
        settings: withModels(option, settings, ran.get(name) ?? []),
        binary: commandBinary(runs),
        installed: onPath(runs),
        install,
        gaps: harnessGaps(option),
        runs,
        values: read.values,
        secretsSet: read.secretsSet,
        ignored: read.ignored,
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

/** What one agent runs here, and whether that is its own pick or the board's default (#443).
 *  The one answer the Agents pane and `akb agent` both draw. */
export function agentRun(agent: string, table = readAgentHarness()): HarnessRun {
  const picked = harnessOfAgent(specAgentNames(agent), table)
  const resolved = resolveHarness({ agent })
  return {
    harness: resolved.harness.name,
    own: !!picked,
    // Set only when the board names a connector this build can't run: the fields around it
    // are the connector that WOULD run, so a pane can say the saved name stopped working
    // without drawing one connector's values under another's labels.
    ...(resolved.unknownAgentHarness ? { unknownHarness: resolved.unknownAgentHarness } : {}),
    settings: withModels(
      resolved.harness,
      resolved.harness.settings.filter((setting) => setting.agentOwned),
      modelsRun().get(resolved.harness.name) ?? [],
    ),
    values: Object.fromEntries(
      resolved.harness.settings
        .filter((setting) => setting.agentOwned && resolved.values[setting.key])
        .map((setting) => [setting.key, resolved.values[setting.key]!]),
    ),
  }
}

/** The agents this machine could run right now, in the order they are declared — the CLI is
 *  on the PATH, and the provider the saved settings resolve to wants nothing that is not
 *  filled in. An agent still waiting on a key or a base URL is left off: trying it would ask
 *  for the very setting the try was meant to spare the user (#404).
 *
 *  Spawn-free and uncached, like `installed` — it reads the PATH and the saved settings and
 *  nothing else. Whether one of them ANSWERS is `testConnection`'s question, and this list is
 *  what the first run asks it of, one at a time. */
export function runnableAgents(): string[] {
  const cfg = safeConfig()
  const blocks = configBlock(cfg.harnessSettings)
  const onPath = pathLookup()
  const names: string[] = []
  for (const harness of HARNESSES) {
    const block = configBlock(blocks[harness.name])
    const command = commandOf(block, harness)
    if (!onPath(command)) continue
    const { values, secretsSet } = readBlock(harness, block, command.split(/\s+/).filter(Boolean))
    const filled = isFilled(harness, values, secretsSet)
    if (missingHere(harness, activeProviderOf({ harness, values, secretsSet }), filled).length) continue
    names.push(harness.name)
  }
  return names
}

/** What a connector's picked provider is still missing, asked of the CONNECTOR's own
 *  settings. A key that picks a model is left out: those belong to the agent and are set per
 *  machine (#443), so a connector is never called unreachable for one nobody has typed yet —
 *  a missing model fails the run itself, and the log says so. */
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
