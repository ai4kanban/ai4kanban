// Which agent runs the board, and everything it is set to.
//
// A run never reads the terminal's environment for any of this — it reads these settings,
// so a run started in a shell with an old export in it goes exactly where the board says.
// The same commands change them, so nothing has to open a browser to pick an agent, and a
// front end can offer the agents and their settings without keeping a list of its own.
//
// Two layers (#343). The BOARD names the runtimes and says which one each flow and spec
// agent runs on — that travels with the repository. THIS COMPUTER says what each runtime
// runs as, in `~/.ai4kanban/runtimes.json`, and never writes that into the board. A
// computer that has bound nothing runs `harness` and `harnessSettings`, which is what
// `akb agent use` and `akb agent set` write, so a fresh clone runs with no local setup.

import { bindRuntime, readBindings, setBindingSetting, unbindRuntime } from '../lib/machine/runtimes'
import { FLOWS } from '../lib/agent/flows'
import { providerSetting } from '../lib/agent/providers'
import { activeSettings, agentInfo, runtimeHarness, settingSaveError } from '../lib/agent/resolve'
import {
  addRuntime,
  readRuntimes,
  removeRuntime,
  renameRuntime,
  setFlowRuntime,
  setGlobalRuntime,
  setHarness,
  setHarnessSetting,
  setSecret,
  setSpecAgentRuntime,
  unknownRuntime,
} from '../lib/agent/settings'
import { testConnection } from '../lib/agent/test'
import { HARNESSES, RAW_ARGS_KEY } from '../lib/agent/harnesses'
import type { HarnessSetting } from '../lib/agent/types'
import { findSpecAgent, readSpecAgents, specAgentNames, SPEC_AGENT_NAMES } from '../lib/spec-agents'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import { finishSetupStep } from '../lib/view/api'
import { readSetupState } from '../lib/view/read'
import type { MoveResult } from '../lib/types'
import { parseFlags } from '../lib/validate'

/** `akb agent` and its words. Split here rather than in the dispatcher so the whole of the
 *  agent setting is one file. */
export async function cmdAgent(args: string[]): Promise<MoveResult> {
  const [word, ...rest] = args
  switch (word) {
    case undefined:
    case 'show':
      return showAgent()
    case 'list':
      return listAgents()
    case 'use':
      return useAgent(rest)
    case 'set':
      return setSetting(rest)
    case 'runtimes':
      return showRuntimes()
    case 'runtime':
      return runtimeCommand(rest)
    case 'bind':
      return bindCommand(rest)
    case 'unbind':
      return unbindCommand(rest)
    case 'test':
      return await testAgent(rest)
    default:
      die(
        `unknown agent command "${word}" — try \`akb agent\`, or one of use, set, list, runtimes, runtime, bind, unbind, test`,
        { kind: 'unknown-move', move: word },
      )
  }
}

// What runs, and how it is set up — the whole of the answer in one screen.
function showAgent(): MoveResult {
  const info = agentInfo()
  const harness = HARNESSES.find((h) => h.name === info.name)
  say(`${harness?.label ?? info.name}${info.isDefault ? ' (the default — nothing is picked)' : ''}`)
  say(`  command  ${info.command}`)
  for (const setting of harness?.settings ?? []) {
    say(`  ${setting.key.padEnd(8)} ${valueOf(setting, info.values, info.secretsSet)}${
      info.ignored.includes(setting.key) ? '   (not in effect — the command already names it)' : ''
    }`)
  }
  // Where the raw arguments sit against a `command` override, which is the one thing about
  // them that isn't obvious: every other setting stands down when the override names its
  // flag, and this one never does.
  say(`  \`${RAW_ARGS_KEY}\` goes after the settings' flags and before the agent's own, and a`)
  say(`  "command" override never turns it off.`)
  sayRuntimes(info)
  if (info.unknownName) {
    say('')
    say(`Your ui.config.json asks for "${info.unknownName}", which this version doesn't run.`)
    say(`The default runs instead. \`akb agent list\` says what it can run.`)
  }
  if (info.staleCommand) {
    say('')
    say(`Your ui.config.json still holds a top-level "command". Nothing reads it — each`)
    say(`agent's own block carries its command now.`)
  }
  return { agent: info }
}

// The runtime layer, under the agent above — and only when the board names more than one.
// With one runtime everything is on it, and a column repeating the same word for every flow
// says nothing the line above it didn't.
function sayRuntimes(info: ReturnType<typeof agentInfo>): void {
  if (info.runtimes.length < 2) return
  say('')
  say(`The agent above is what a runtime nobody bound on this computer runs as.`)
  say(`Global runtime: ${info.globalRuntime}`)
  const off = info.flows.filter((f) => f.runtime !== info.globalRuntime)
  for (const flow of off) say(`  ${flow.command.padEnd(20)} ${flow.runtime} — ${flow.harness} here`)
  for (const agent of readSpecAgents().filter((a) => a.runtime !== info.globalRuntime)) {
    say(`  ${agent.name.padEnd(20)} ${agent.runtime} — ${agent.harness} here`)
  }
  say(`\`akb agent runtimes\` is the whole of it.`)
}

// How one setting reads on the screen. A key is never read back — set or not set is the
// whole of what is said about one.
function valueOf(
  setting: HarnessSetting,
  values: Record<string, string>,
  secretsSet: string[],
): string {
  if (setting.kind === 'secret') return secretsSet.includes(setting.key) ? 'set' : 'not set'
  const value = values[setting.key]
  if (!value) return `(the agent's own default)`
  if (setting.kind !== 'provider') return value
  const provider = setting.providers?.find((p) => p.id === value)
  return provider ? `${provider.id} — ${provider.label}` : value
}

// Every agent this build can run, and the settings each one takes. Written for a front end
// reading `--json`: it is what lets one offer the agents and their fields without ever
// learning an agent's name.
function listAgents(): MoveResult {
  const info = agentInfo()
  for (const option of info.options) {
    say(`${option.name === info.name ? '*' : ' '} ${option.name.padEnd(12)} ${option.label}`)
    say(`    ${option.command}`)
    const names = option.settings.map((s) => (s.kind === 'secret' ? `${s.key} (key)` : s.key))
    if (names.length) say(`    takes: ${names.join(', ')}`)
    // What this one can't do that another on the list can. Named rather than explained —
    // `docs/guides/connectors.md` is where each is spelled out, and the board app shows the
    // full line beside the picker.
    if (option.gaps.length) say(`    lacks: ${option.gaps.map((g) => g.label.toLowerCase()).join('; ')}`)
  }
  say('')
  say('The one marked * is what runs. Switch with `akb agent use <name>`.')
  return { agents: info.options, picked: info.name }
}

function useAgent(args: string[]): MoveResult {
  const name = args[0]?.trim()
  if (!name) die('name an agent: akb agent use claude-code', { kind: 'needs-input' })
  const harness = HARNESSES.find((h) => h.name === name)
  if (!harness) {
    die(`no agent called "${name}". \`akb agent list\` says what this version runs.`, {
      kind: 'unknown-agent',
      agent: name,
    })
  }
  const res = setHarness(harness.name)
  if (!res.ok) die(res.error ?? 'the setting could not be saved', { kind: 'save-failed' })
  say(`${harness.label} now runs the board.`)
  // Switching never throws a setting away: every agent's settings live under its own name,
  // so what this one was last set to comes back with it.
  return showAgent()
}

// One setting, or one key. Which of the two it is comes from the agent's own declaration —
// a key goes to docs/kanban/.env and nowhere else, and is never echoed back.
//
// With no value the setting is cleared and the agent runs its own default. Reading a key
// back is never offered: a user who forgot theirs makes a new one.
function setSetting(args: string[]): MoveResult {
  const { flags, positional } = parseFlags(args, ['dir', 'json', 'value'])
  const key = positional[0]?.trim()
  if (!key) {
    const keys = activeSettings().map((s) => s.key)
    die(`name a setting: akb agent set <${keys.join('|') || 'setting'}> <value>`, { kind: 'needs-input' })
  }
  const setting = activeSettings().find((s) => s.key === key)
  if (!setting) {
    const keys = activeSettings().map((s) => s.key)
    die(`the agent you run has no "${key}" setting. It takes: ${keys.join(', ') || '(none)'}`, {
      kind: 'unknown-setting',
      setting: key,
    })
  }
  const raw = positional.slice(1).join(' ')
  const value = (typeof flags.value === 'string' ? flags.value : raw).trim()

  if (setting.kind === 'secret') {
    const res = setSecret(setting.env!, value)
    if (!res.ok) die(res.error ?? 'the key could not be saved', { kind: 'save-failed' })
    say(value ? `${setting.label} saved to docs/kanban/.env.` : `${setting.label} cleared.`)
    return { setting: key, set: Boolean(value) }
  }

  const wrong = checkSetting(setting, value)
  if (wrong) die(wrong, { kind: 'bad-value' })

  const res = setHarnessSetting(key, value)
  if (!res.ok) die(res.error ?? 'the setting could not be saved', { kind: 'save-failed' })
  say(value ? `${setting.label} is now "${value}".` : `${setting.label} cleared — the agent's own default runs.`)
  return { setting: key, value }
}

// Why this value can't be saved for this setting, or null when it can. `ask` names the
// harness the rules are read against: the board's own for `akb agent set`, and the one a
// runtime is bound to for `akb agent bind … set` — a value Codex refuses must not be saved
// against Claude Code's rules (#343).
function checkSetting(setting: HarnessSetting, value: string, runtime?: string): string | null {
  // A list must be given one of its own choices; a box takes free text, because model ids
  // change between agent releases and the agent is the only validator worth having.
  if (setting.kind === 'select' && value && !setting.choices?.some((c) => c.value === value)) {
    const choices = setting.choices?.map((c) => c.value || '(empty)').join(', ')
    return `"${value}" isn't one of the ${setting.label} choices: ${choices}`
  }
  const ask = runtime ? { runtime } : undefined
  if (setting.kind === 'provider' && !value) {
    const list = providerSetting(activeSettings(ask))
    return `a run always goes through a provider, so this one can't be cleared. Pick one: ${
      list?.providers?.map((p) => p.id).join(', ') ?? ''
    }`
  }
  // The provider pick, and the boxes it can't do without: a pick that names no provider we
  // ship, one whose base URL is still empty, and a base URL emptied while that pick is
  // live are all refused — so the file never says a run goes somewhere it can't go.
  return settingSaveError(setting.key, value, ask)
}

// ---- the runtimes (#343) ---------------------------------------------------

/** Every runtime, what it runs as here, and what each flow and spec agent is on. */
function showRuntimes(): MoveResult {
  const info = agentInfo()
  const bound = readBindings()
  for (const runtime of info.runtimes) {
    const binding = bound[runtime.name]
    const how = binding
      ? runtime.fallback
        ? `bound to "${binding.harness}", which this version doesn't run`
        : 'bound here'
      : 'not bound here'
    say(`${runtime.global ? '*' : ' '} ${runtime.name.padEnd(12)} ${runtime.harness}   (${how})`)
    const settings = Object.entries(binding?.harness === runtime.harness ? binding.settings : {})
    for (const [key, value] of settings) say(`    ${key}: ${value}`)
  }
  say('')
  say('Runs on')
  for (const flow of info.flows) say(`  ${flow.command.padEnd(20)} ${flow.runtime} — ${flow.harness} here`)
  for (const agent of readSpecAgents()) {
    say(`  ${agent.name.padEnd(20)} ${agent.runtime} — ${agent.harness} here`)
  }
  say('')
  say('The one marked * is the board\'s global runtime — what a flow that names none runs on.')
  say('The names travel with the repository; what each one runs as is this computer\'s alone.')
  return { runtimes: info.runtimes, globalRuntime: info.globalRuntime, flows: info.flows }
}

function runtimeCommand(args: string[]): MoveResult {
  const [word, ...rest] = args
  switch (word) {
    case undefined:
      return showRuntimes()
    case 'add':
      return addOne(rest[0]?.trim() ?? '')
    case 'remove':
      return removeOne(rest[0]?.trim() ?? '')
    case 'rename':
      return renameOne(rest[0]?.trim() ?? '', rest[1]?.trim() ?? '')
    case 'global':
      return globalOne(rest[0]?.trim() ?? '')
    case 'for':
      return runtimeFor(rest)
    default:
      die(`unknown runtime command "${word}" — try one of add, remove, rename, global, for`, {
        kind: 'unknown-move',
        move: word,
      })
  }
}

function addOne(name: string): MoveResult {
  if (!name) die('name a runtime: akb agent runtime add cheap', { kind: 'needs-input' })
  const res = addRuntime(name)
  if (!res.ok) die(res.error ?? 'the runtime could not be saved', { kind: 'save-failed' })
  say(`"${name}" is a runtime on this board. It runs this computer's global binding until you`)
  say(`bind it: \`akb agent bind ${name} <agent>\`.`)
  return { runtime: name }
}

function removeOne(name: string): MoveResult {
  if (!name) die('name a runtime: akb agent runtime remove cheap', { kind: 'needs-input' })
  const res = removeRuntime(name)
  if (!res.ok) die(res.error ?? 'the runtime could not be removed', { kind: 'bad-value' })
  say(`"${name}" is gone. Whatever named it runs the global runtime now.`)
  return { runtime: name, removed: true }
}

// Rename a runtime. The board's half moves whole — the flows, the spec agents and the
// global pointer — while this computer's binding is COPIED to the new name, so the old name
// stays bound for whatever else on this machine names it.
function renameOne(from: string, to: string): MoveResult {
  if (!from || !to) die('name a runtime and its new name: akb agent runtime rename cheap plan', { kind: 'needs-input' })
  const res = renameRuntime(from, to)
  if (!res.ok) die(res.error ?? 'the runtime could not be renamed', { kind: 'bad-value' })
  say(`"${from}" is now "${to}". Whatever named it on this board came with it.`)
  say(`On this computer "${to}" runs ${runtimeHarness(to).label}; "${from}" keeps its own binding, and`)
  say(`every other computer reads "${to}" as unbound until someone binds it there.`)
  return { runtime: to, renamedFrom: from }
}

function globalOne(name: string): MoveResult {
  if (!name) die('name a runtime: akb agent runtime global default', { kind: 'needs-input' })
  const res = setGlobalRuntime(name)
  if (!res.ok) die(res.error ?? 'the runtime could not be saved', { kind: 'bad-value' })
  say(`"${name}" is the board's global runtime — every flow that names none runs on it.`)
  return { globalRuntime: name }
}

// Point one flow or one spec agent at a runtime. "-" puts it back on the global one.
function runtimeFor(args: string[]): MoveResult {
  const what = args[0]?.trim() ?? ''
  const asked = args[1]?.trim() ?? ''
  if (!what || !asked) {
    die('name a flow or spec agent and a runtime: akb agent runtime for implement cheap', {
      kind: 'needs-input',
    })
  }
  const runtime = asked === '-' ? '' : asked
  const runtimes = readRuntimes()
  if (runtime && !runtimes.names.includes(runtime)) die(unknownRuntime(runtime, runtimes), { kind: 'bad-value' })

  const flow = FLOWS.find((f) => f.command === what)
  const agent = flow ? null : findSpecAgent(what)
  if (!flow && !agent) {
    die(
      `"${what}" is neither a flow nor a spec agent. Flows: ${FLOWS.map((f) => f.command).join(', ')}. ` +
        `Spec agents: ${SPEC_AGENT_NAMES.join(', ')}.`,
      { kind: 'bad-value' },
    )
  }
  // `setup` is the one flow a runtime can't move: it is the run that has to work on a board
  // nobody has configured yet. Refused rather than written down and ignored — a file saying
  // something no run reads is worse than a no.
  if (flow?.command === 'setup' && runtime) {
    die('`setup` always runs the global runtime — it is the run that has to work on a board nobody has configured yet.', {
      kind: 'bad-value',
    })
  }
  const res = flow
    ? setFlowRuntime(flow.command, runtime)
    : setSpecAgentRuntime(agent!.name, runtime, specAgentNames(agent!.name).slice(1))
  if (!res.ok) die(res.error ?? 'the runtime could not be saved', { kind: 'save-failed' })

  const name = flow?.command ?? agent!.name
  const on = runtime || readRuntimes().global
  say(`\`${name}\` runs on "${on}"${runtime ? '' : ' — the global runtime'}, which is ${runtimeHarness(on).label} here.`)
  return { flow: flow?.command, specAgent: agent?.name, runtime: on }
}

// ---- what a runtime runs as on THIS computer -------------------------------

function bindCommand(args: string[]): MoveResult {
  const runtime = args[0]?.trim() ?? ''
  if (!runtime) {
    die('name a runtime: akb agent bind <runtime> <agent>, or akb agent bind <runtime> set <key> <value>', {
      kind: 'needs-input',
    })
  }
  const runtimes = readRuntimes()
  if (!runtimes.names.includes(runtime)) die(unknownRuntime(runtime, runtimes), { kind: 'bad-value' })
  if (args[1] === 'set') return bindSetting(runtime, args.slice(2))

  const name = args[1]?.trim() ?? ''
  if (!name) die(`name an agent: akb agent bind ${runtime} claude-code`, { kind: 'needs-input' })
  const harness = HARNESSES.find((h) => h.name === name)
  if (!harness) {
    die(`no agent called "${name}". \`akb agent list\` says what this version runs.`, {
      kind: 'unknown-agent',
      agent: name,
    })
  }
  const res = bindRuntime(runtime, harness.name)
  if (!res.ok) die(res.error ?? 'the binding could not be saved', { kind: 'save-failed' })
  say(`On this computer, "${runtime}" runs ${harness.label}. It is not written into the board.`)
  return { runtime, harness: harness.name }
}

// One of the bound agent's settings, on this computer. Checked against THAT agent, never
// the board's — a value Codex refuses would otherwise be saved against Claude Code's rules.
function bindSetting(runtime: string, args: string[]): MoveResult {
  const bound = readBindings()[runtime]
  if (!bound) {
    die(`"${runtime}" is not bound on this computer. Bind it first: \`akb agent bind ${runtime} <agent>\`.`, {
      kind: 'bad-value',
    })
  }
  const settings = activeSettings({ runtime })
  const key = args[0]?.trim() ?? ''
  if (!key) {
    die(`name a setting: akb agent bind ${runtime} set <${settings.map((s) => s.key).join('|')}> <value>`, {
      kind: 'needs-input',
    })
  }
  const setting = settings.find((s) => s.key === key)
  if (!setting) {
    die(`${runtimeHarness(runtime).label} has no "${key}" setting. It takes: ${settings.map((s) => s.key).join(', ') || '(none)'}`, {
      kind: 'unknown-setting',
      setting: key,
    })
  }
  // A key is never part of a binding: it stays in docs/kanban/.env, under the variable name
  // that setting declares, and a binding that held one would put it in a file nothing keeps
  // out of git.
  if (setting.kind === 'secret') {
    die(`${setting.label} is a key — it lives in docs/kanban/.env, never in a binding. Save it with \`akb agent set ${key} <value>\`.`, {
      kind: 'bad-value',
    })
  }
  const value = args.slice(1).join(' ').trim()
  const wrong = checkSetting(setting, value, runtime)
  if (wrong) die(wrong, { kind: 'bad-value' })

  const res = setBindingSetting(runtime, key, value)
  if (!res.ok) die(res.error ?? 'the setting could not be saved', { kind: 'save-failed' })
  const label = runtimeHarness(runtime).label
  say(
    value
      ? `On this computer, "${runtime}" runs ${label} with ${setting.label} "${value}".`
      : `${setting.label} cleared for "${runtime}" — ${label}'s own default runs.`,
  )
  return { runtime, setting: key, value }
}

function unbindCommand(args: string[]): MoveResult {
  const runtime = args[0]?.trim() ?? ''
  if (!runtime) die('name a runtime: akb agent unbind cheap', { kind: 'needs-input' })
  const res = unbindRuntime(runtime)
  if (!res.ok) die(res.error ?? 'the binding could not be removed', { kind: 'save-failed' })
  say(`"${runtime}" runs this computer's global binding again — ${runtimeHarness(runtime).label}.`)
  return { runtime, unbound: true }
}

// A test that passed is what settles setup's `agent` step — the same rule the local UI
// works by, so a board set up from a terminal finishes the same way as one set up from the
// window. Picking an agent is not enough on its own: everything after this step is a run,
// so a board that got past it without an agent that answers was never set up.
//
// Silent unless it actually ticked something: a board with no checklist, or one whose box
// is already ticked, has nothing to say.
async function tickAgentStep(): Promise<{ setupStep?: string }> {
  const before = await readSetupState()
  if (!before?.steps.some((s) => s.name === 'agent' && !s.done)) return {}
  const ticked = await finishSetupStep('agent')
  if (!ticked.ok) return {}
  const after = await readSetupState()
  say('')
  say(
    after
      ? `setup's \`agent\` step is done — ${after.done}/${after.total}.${after.next ? ` Next: \`${after.next.name}\`.` : ''}`
      : "setup's `agent` step is done — that was the last one.",
  )
  return { setupStep: 'agent' }
}

// One small chat through the setup as it stands, so a broken agent is found here rather
// than on the first card run that fails. Named a runtime, it spawns what THAT runtime
// resolves to here; named none, the board's global one — which is the one setup's own step
// is about, so only that form ticks the box.
async function testAgent(args: string[]): Promise<MoveResult> {
  const runtime = args[0]?.trim() ?? ''
  const runtimes = readRuntimes()
  if (runtime && !runtimes.names.includes(runtime)) die(unknownRuntime(runtime, runtimes), { kind: 'bad-value' })
  const on = runtime || runtimes.global
  const harness = runtimeHarness(on)
  say(`testing "${on}" — ${harness.label} …`)
  const res = await testConnection(runtime || undefined)
  if (res.ok) {
    say(`it answered in ${(res.ms / 1000).toFixed(1)}s. The board can run it.`)
    return { test: res, runtime: on, harness: harness.name, ...(runtime ? {} : await tickAgentStep()) }
  }
  if (res.missing) {
    say(`${res.missing} isn't installed, or isn't on this terminal's PATH.`)
    say(`Install it with: ${res.install}`)
  } else if (res.timedOut) {
    say(`no answer in ${Math.round(res.ms / 1000)}s — it gave up.`)
  } else {
    say(`it failed.`)
  }
  if (res.output) {
    say('')
    say(res.output)
  }
  die('the agent did not answer', { kind: 'test-failed', test: res as unknown as Record<string, unknown> })
}
