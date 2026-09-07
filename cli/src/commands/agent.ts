// The board's runtimes, which one each agent runs, and everything they are set to.
//
// A run never reads the terminal's environment for any of this — it reads these settings, so a
// run started in a shell with an old export in it goes exactly where the board says. The same
// commands change them, so nothing has to open a browser to set a runtime up, and a front end
// can offer the runtimes and their settings without keeping a list of its own.
//
// Two files, and the split is the whole idea (#467):
//
//   docs/kanban/ui.config.json  the board's — every runtime's shape, and which one each agent
//                               runs. It travels with the repository, so a fresh clone runs
//                               every agent on the same thing.
//   docs/kanban/.env            this computer's — one key line per runtime, named after that
//                               runtime's id. git never carries it.
//
// `akb agent runtime` adds, renames and deletes rows; `akb agent set` writes one row's
// settings and its key; `akb agent bind` points an agent at a row; `akb agent use` moves
// **Global default** to another harness.

import { providerSetting } from '../lib/agent/providers'
import {
  activeSettings,
  agentHarness,
  agentInfo,
  agentRun,
  settingSaveError,
  type HarnessAsk,
} from '../lib/agent/resolve'
import { agentNames, agentRoster } from '../lib/agent/roles'
import {
  addRuntime,
  deleteRuntime,
  GLOBAL_ID,
  readRuntimes,
  renameRuntime,
  setAgentRuntime,
  setHarness,
  setRuntimeSecret,
  setRuntimeSetting,
} from '../lib/agent/runtimes'
import { testConnection } from '../lib/agent/test'
import { HARNESSES, RAW_ARGS_KEY } from '../lib/agent/harnesses'
import type { HarnessSetting } from '../lib/agent/types'
import { specAgentNames } from '../lib/agents'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import { finishSetupStep } from '../lib/view/api'
import { readSetupState } from '../lib/view/read'
import type { MoveResult } from '../lib/types'

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
    case 'bind':
      return bindAgent(rest)
    case 'runtime':
      return runtimeMove(rest)
    case 'test':
      return await testAgent(rest)
    default:
      die(`unknown agent command "${word}" — try \`akb agent\`, or one of use, set, list, bind, runtime, test`, {
        kind: 'unknown-move',
        move: word,
      })
  }
}

// What runs, and how it is set up — the whole of the answer in one screen: every runtime the
// board holds, then every agent and the row it runs.
function showAgent(): MoveResult {
  const info = agentInfo()
  say('Runtimes')
  for (const row of info.runtimes) {
    const gone = row.unknownHarness ? `   (${row.unknownHarness} — this version doesn't run it)` : ''
    say(`  ${row.name.padEnd(20)} ${row.label}${row.model ? ` · ${row.model}` : ''}${gone}`)
    say(`    id ${row.id}${row.runs === row.command ? '' : `   command ${row.runs}`}`)
    for (const setting of row.settings) {
      const value = valueOf(setting, row.values, row.secretsSet)
      if (value === UNSET) continue
      say(`    ${setting.key.padEnd(10)} ${value}${
        row.ignored.includes(setting.key) ? '   (not in effect — the command already names it)' : ''
      }`)
    }
  }
  say('')
  say(`The first row is ${'Global default'} — what an agent naming no runtime runs, and the one row`)
  say('that can be neither renamed nor deleted. `akb agent runtime add <name> <harness>` adds one.')
  say(`\`${RAW_ARGS_KEY}\` goes after the settings' flags and before the CLI's own, and a "command"`)
  say('override never turns it off.')
  const agents = sayAgents()
  if (info.staleCommand) {
    say('')
    say(`Your ui.config.json still holds a top-level "command". Nothing reads it — each runtime`)
    say(`carries its own command now.`)
  }
  return { agent: info, agents }
}

// Every agent on this board and the runtime it runs. A row in brackets is **Global default**
// rather than that agent's own pick.
function sayAgents(): { name: string; runtime: string; own: boolean; harness: string; model: string }[] {
  const rows = agentRoster().map((entry) => {
    const runs = agentRun(entry.name)
    return {
      name: entry.name,
      runtime: runs.runtimeName,
      own: runs.own,
      harness: runs.harness,
      model: runs.model,
    }
  })
  say('')
  say('Agents')
  for (const row of rows) {
    const what = row.own ? row.runtime : `(${row.runtime})`
    say(`  ${row.name.padEnd(22)} ${what.padEnd(20)} ${row.harness}${row.model ? ` · ${row.model}` : ''}`)
  }
  say('')
  say("A runtime in brackets is Global default — that agent picked none.")
  say('`akb agent bind <agent> <runtime>` gives one a row of its own.')
  return rows
}

// What a screen says about a setting nobody has touched — left off a runtime's own lines, so
// a row reads as what it is rather than as a list of blanks.
const UNSET = "(the CLI's own default)"

// How one setting reads on the screen. A key is never read back — set or not set is the
// whole of what is said about one.
function valueOf(
  setting: HarnessSetting,
  values: Record<string, string>,
  secretsSet: string[],
): string {
  if (setting.kind === 'secret') return secretsSet.includes(setting.key) ? 'set' : 'not set'
  const value = values[setting.key]
  if (!value) return UNSET
  if (setting.kind !== 'provider') return value
  const provider = setting.providers?.find((p) => p.id === value)
  return provider ? `${provider.id} — ${provider.label}` : value
}

// Every harness a runtime can name, and the settings each one takes. Written for a front end
// reading `--json`: it is what lets one offer the harnesses and their fields without ever
// learning a harness's name.
function listAgents(): MoveResult {
  const info = agentInfo()
  for (const option of info.options) {
    say(`${option.name === info.name ? '*' : ' '} ${option.name.padEnd(12)} ${option.label}`)
    say(`    ${option.command}`)
    const names = option.settings.map((s) => (s.kind === 'secret' ? `${s.key} (key)` : s.key))
    if (names.length) say(`    takes: ${names.join(', ')}`)
    // What this one can't do that another on the list can. Named rather than explained —
    // `web/content/docs/connectors.mdx` is where each is spelled out, and the board app shows the
    // full line beside the picker.
    if (option.gaps.length) say(`    lacks: ${option.gaps.map((g) => g.label.toLowerCase()).join('; ')}`)
  }
  say('')
  say('The one marked * is what Global default runs. Move it with `akb agent use <name>`.')
  return { agents: info.options, picked: info.name }
}

// The harness **Global default** runs. Every other runtime is untouched — this is the one row
// it moves, and a setting the new harness doesn't declare goes with the old one.
function useAgent(args: string[]): MoveResult {
  const name = args[0]?.trim()
  if (!name) die('name a harness: akb agent use claude-code', { kind: 'needs-input' })
  const harness = knownHarness(name)
  const res = setHarness(harness.name)
  if (!res.ok) die(res.error ?? 'the setting could not be saved', { kind: 'save-failed' })
  say(`Global default runs ${harness.label} — every agent that named no runtime runs it.`)
  return showAgent()
}

// ---- the list itself (#467) -------------------------------------------------

/** `akb agent runtime add|rename|delete` — the whole of what a person does to the list.
 *  There is no "make default": the default is the first row. */
function runtimeMove(args: string[]): MoveResult {
  const [word, ...rest] = args
  switch (word) {
    case 'add': {
      const name = rest[0]?.trim() ?? ''
      const harness = rest[1]?.trim() ?? ''
      if (!name || !harness) {
        die('name it and say what it runs: akb agent runtime add "My gateway" claude-code', { kind: 'needs-input' })
      }
      const res = addRuntime(name, harness)
      if (!res.ok || !res.id) die(res.error ?? 'the runtime could not be saved', { kind: 'save-failed' })
      say(`"${name}" runs ${knownHarness(harness).label}. Its id is \`${res.id}\`, which its key line is named after.`)
      say(`Set it up: \`akb agent set --runtime ${res.id} <key> <value>\`.`)
      return { runtime: res.id, name, harness }
    }
    case 'rename': {
      const id = rest[0]?.trim() ?? ''
      const name = rest.slice(1).join(' ').trim()
      if (!id || !name) die('akb agent runtime rename <id> <new name>', { kind: 'needs-input' })
      const res = renameRuntime(id, name)
      if (!res.ok) die(res.error ?? 'the runtime could not be renamed', { kind: 'save-failed' })
      say(`\`${id}\` is called "${name}" now. Nothing else moved — its key, its settings and every agent on it are keyed by the id.`)
      return { runtime: id, name }
    }
    case 'delete': {
      const id = rest[0]?.trim() ?? ''
      if (!id) die('akb agent runtime delete <id>', { kind: 'needs-input' })
      const named = agentRoster().filter((entry) => agentRun(entry.name).runtime === id).map((e) => e.name)
      const res = deleteRuntime(id)
      if (!res.ok) die(res.error ?? 'the runtime could not be deleted', { kind: 'save-failed' })
      say(`\`${id}\` is gone.`)
      if (named.length) say(`${named.join(', ')} ran it, and run Global default now.`)
      return { runtime: id, deleted: true, cleared: named }
    }
    default:
      die(`unknown runtime command "${word ?? ''}" — try add, rename or delete`, {
        kind: 'unknown-move',
        move: word ?? '',
      })
  }
}

// The runtime a `--runtime <id>` flag names, checked against this board's list. With none it is
// the one the named agent runs, and with neither it is **Global default**.
function namedRuntime(args: string[]): { runtime?: string; rest: string[] } {
  const at = args.indexOf('--runtime')
  if (at < 0) return { rest: args }
  const id = args[at + 1]?.trim() ?? ''
  const known = readRuntimes()
  if (!id) die(`name a runtime: ${known.map((r) => r.id).join(', ')}`, { kind: 'needs-input' })
  if (!known.some((r) => r.id === id)) {
    die(`"${id}" is not a runtime on this board. It has: ${known.map((r) => r.id).join(', ')}.`, {
      kind: 'unknown-runtime',
      runtime: id,
    })
  }
  return { runtime: id, rest: [...args.slice(0, at), ...args.slice(at + 2)] }
}

function knownHarness(name: string) {
  const harness = HARNESSES.find((h) => h.name === name)
  if (!harness) {
    die(`no agent called "${name}". \`akb agent list\` says what this version runs.`, {
      kind: 'unknown-agent',
      agent: name,
    })
  }
  return harness
}

// The agent a `--agent <name>` flag names, checked against this board's roster.
function namedAgent(args: string[]): { agent?: string; rest: string[] } {
  const at = args.indexOf('--agent')
  if (at < 0) return { rest: args }
  const name = args[at + 1]?.trim() ?? ''
  if (!name) die(`name an agent: ${agentNames().join(', ')}`, { kind: 'needs-input' })
  if (!agentNames().includes(name)) {
    die(`"${name}" is not an agent on this board. It has: ${agentNames().join(', ')}.`, {
      kind: 'unknown-agent',
      agent: name,
    })
  }
  return { agent: name, rest: [...args.slice(0, at), ...args.slice(at + 2)] }
}

// One of a runtime's settings, or its key. Which of the two it is comes from the harness's own
// declaration: a key goes to docs/kanban/.env under that runtime's own line and is never echoed
// back, and everything else lands on the row in ui.config.json.
//
// Which row is written: `--runtime <id>`, or the row `--agent <name>` runs, or **Global
// default**. With no value the setting is cleared and the CLI's own default runs. Reading a key
// back is never offered: a user who forgot theirs makes a new one.
function setSetting(args: string[]): MoveResult {
  const { runtime: named, rest: left } = namedRuntime(args)
  const { agent, rest } = namedAgent(left)
  const ask = named ? { pin: named } : agent ? { agent } : undefined
  const runtime = named ?? agentHarness(agent).runtime
  const settings = activeSettings(ask)
  const key = rest[0]?.trim() ?? ''
  const setting = settings.find((s) => s.key === key)
  if (!setting) {
    const keys = settings.map((s) => s.key)
    die(`that runtime's harness has no "${key}" setting. It takes: ${keys.join(', ') || '(none)'}`, {
      kind: 'unknown-setting',
      setting: key,
    })
  }
  const value = rest.slice(1).join(' ').trim()

  if (setting.kind === 'secret') {
    // One key line per runtime, named after its id — two rows on one harness sign with two
    // keys, and a rename moves neither.
    const res = setRuntimeSecret(runtime, key, value)
    if (!res.ok) die(res.error ?? 'the key could not be saved', { kind: 'save-failed' })
    say(value ? `${setting.label} saved to docs/kanban/.env, for \`${runtime}\`.` : `${setting.label} cleared for \`${runtime}\`.`)
    return { runtime, setting: key, set: Boolean(value) }
  }

  const wrong = checkSetting(setting, value, ask)
  if (wrong) die(wrong, { kind: 'bad-value' })

  const res = setRuntimeSetting(runtime, key, value)
  if (!res.ok) die(res.error ?? 'the setting could not be saved', { kind: 'save-failed' })
  say(
    value
      ? `\`${runtime}\` runs with ${setting.label} "${value}".`
      : `${setting.label} cleared on \`${runtime}\` — the CLI's own default runs.`,
  )
  return { runtime, setting: key, value }
}

// Why this value can't be saved for this setting, or null when it can. `ask` names whose
// runtime the rules are read against: **Global default** with none.
function checkSetting(setting: HarnessSetting, value: string, ask?: HarnessAsk): string | null {
  // A list must be given one of its own choices; a box takes free text, because model ids
  // change between agent releases and the agent is the only validator worth having.
  if (setting.kind === 'select' && value && !setting.choices?.some((c) => c.value === value)) {
    const choices = setting.choices?.map((c) => c.value || '(empty)').join(', ')
    return `"${value}" isn't one of the ${setting.label} choices: ${choices}`
  }
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

// ---- what one agent runs (#467) --------------------------------------------

/** Point one agent at a runtime of its own, or back at **Global default** with "-". The pick is
 *  the board's, so every checkout runs that agent as the same thing. */
function bindAgent(args: string[]): MoveResult {
  const agent = args[0]?.trim() ?? ''
  if (!agent) die(`name an agent: akb agent bind <agent> <runtime>. This board has: ${agentNames().join(', ')}.`, { kind: 'needs-input' })
  if (!agentNames().includes(agent)) {
    die(`"${agent}" is not an agent on this board. It has: ${agentNames().join(', ')}.`, {
      kind: 'unknown-agent',
      agent,
    })
  }
  const asked = args[1]?.trim() ?? ''
  const known = readRuntimes()
  if (!asked) {
    die(`name a runtime: akb agent bind ${agent} ${known[1]?.id ?? GLOBAL_ID}, or "-" for Global default. This board has: ${known.map((r) => r.id).join(', ')}.`, { kind: 'needs-input' })
  }
  const legacy = specAgentNames(agent).slice(1)
  const res = setAgentRuntime(agent, asked === '-' ? '' : asked, legacy)
  if (!res.ok) die(res.error ?? 'the runtime could not be saved', { kind: 'save-failed' })
  const runs = agentRun(agent)
  say(
    asked === '-'
      ? `\`${agent}\` runs Global default — ${runs.harness}${runs.model ? ` · ${runs.model}` : ''} here.`
      : `\`${agent}\` runs "${runs.runtimeName}" — ${runs.harness}${runs.model ? ` · ${runs.model}` : ''} — on this board and every checkout of it.`,
  )
  return { agent, runtime: runs.runtime }
}

// ---- the test --------------------------------------------------------------

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

// One small chat through the setup as it stands, so a broken runtime is found here rather than
// on the first card run that fails. Named a runtime, it spawns that row; named none, **Global
// default** — which is the one setup's own step is about, so only that form ticks the box.
async function testAgent(args: string[]): Promise<MoveResult> {
  const asked = args[0]?.trim() ?? ''
  const known = readRuntimes()
  if (asked && !known.some((r) => r.id === asked)) {
    die(`"${asked}" is not a runtime on this board. It has: ${known.map((r) => r.id).join(', ')}.`, {
      kind: 'unknown-runtime',
      runtime: asked,
    })
  }
  const row = known.find((r) => r.id === (asked || GLOBAL_ID))
  say(`testing ${row?.name ?? asked} …`)
  const res = await testConnection(asked || undefined)
  if (res.ok) {
    say(`it answered in ${(res.ms / 1000).toFixed(1)}s. The board can run it.`)
    return { test: res, harness: res.harness, ...(asked ? {} : await tickAgentStep()) }
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
