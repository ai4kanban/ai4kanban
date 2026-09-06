// Which connector runs the board, which one each agent runs, and everything they are set to.
//
// A run never reads the terminal's environment for any of this — it reads these settings, so
// a run started in a shell with an old export in it goes exactly where the board says. The
// same commands change them, so nothing has to open a browser to pick a connector, and a
// front end can offer the connectors and their settings without keeping a list of its own.
//
// Two files, and the split is the whole idea (#443):
//
//   docs/kanban/ui.config.json  the board's — which connector each agent runs, and how to
//                               reach each connector. It travels with the repository, so a
//                               fresh clone runs every agent on the same tool.
//   docs/kanban/.local.json     this computer's — the model each agent runs. A model id is
//                               worth nothing on a machine whose CLI never logged into that
//                               provider, so it is picked once per machine.
//
// `akb agent use` and `akb agent set` write the board's default connector; `akb agent bind`
// gives one agent a connector of its own, and `akb agent set --agent` its own model.

import { providerSetting } from '../lib/agent/providers'
import { activeSettings, agentHarness, agentInfo, agentRun, settingSaveError } from '../lib/agent/resolve'
import { agentNames, agentRoster } from '../lib/agent/roles'
import { setLocalAgentValue } from '../lib/agent/local'
import { setAgentHarness, setHarness, setHarnessSetting, setSecret } from '../lib/agent/settings'
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
    case 'test':
      return await testAgent(rest)
    default:
      die(`unknown agent command "${word}" — try \`akb agent\`, or one of use, set, list, bind, test`, {
        kind: 'unknown-move',
        move: word,
      })
  }
}

// What runs, and how it is set up — the whole of the answer in one screen: the board's
// default connector and its settings, then every agent and what it runs.
function showAgent(): MoveResult {
  const info = agentInfo()
  const harness = HARNESSES.find((h) => h.name === info.name)
  say(`${harness?.label ?? info.name}${info.isDefault ? ' (the default — nothing is picked)' : ''}`)
  say(`  command  ${info.command}`)
  for (const setting of harness?.settings.filter((s) => !s.agentOwned) ?? []) {
    say(`  ${setting.key.padEnd(8)} ${valueOf(setting, info.values, info.secretsSet)}${
      info.ignored.includes(setting.key) ? '   (not in effect — the command already names it)' : ''
    }`)
  }
  // Where the raw arguments sit against a `command` override, which is the one thing about
  // them that isn't obvious: every other setting stands down when the override names its
  // flag, and this one never does.
  say(`  \`${RAW_ARGS_KEY}\` goes after the settings' flags and before the agent's own, and a`)
  say(`  "command" override never turns it off.`)
  const agents = sayAgents()
  if (info.unknownName) {
    say('')
    say(`Your ui.config.json asks for "${info.unknownName}", which this version doesn't run.`)
    say(`The default runs instead. \`akb agent list\` says what it can run.`)
  }
  if (info.staleCommand) {
    say('')
    say(`Your ui.config.json still holds a top-level "command". Nothing reads it — each`)
    say(`connector's own block carries its command now.`)
  }
  return { agent: info, agents }
}

// Every agent on this board and what it runs: the connector, then the model under it. A
// connector shown in brackets is the board's default rather than that agent's own pick.
function sayAgents(): { name: string; harness: string; own: boolean; model: string }[] {
  const rows = agentRoster().map((entry) => {
    const runs = agentRun(entry.name)
    return { name: entry.name, harness: runs.harness, own: runs.own, model: runs.values.model ?? '' }
  })
  say('')
  say('Agents')
  for (const row of rows) {
    const what = row.own ? row.harness : `(${row.harness})`
    say(`  ${row.name.padEnd(22)} ${what.padEnd(16)} ${row.model || "the connector's own model"}`)
  }
  say('')
  say('A connector in brackets is the board\'s default — that agent picked none.')
  say('`akb agent bind <agent> <connector>` gives one its own; `akb agent set --agent <agent> model <id>`')
  say('sets the model it runs here, on this computer only.')
  return rows
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

// Every connector this build can run, and the settings each one takes. Written for a front
// end reading `--json`: it is what lets one offer the connectors and their fields without
// ever learning a connector's name.
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
  say("The one marked * is the board's default. Switch with `akb agent use <name>`.")
  return { agents: info.options, picked: info.name }
}

function useAgent(args: string[]): MoveResult {
  const name = args[0]?.trim()
  if (!name) die('name an agent: akb agent use claude-code', { kind: 'needs-input' })
  const harness = knownHarness(name)
  const res = setHarness(harness.name)
  if (!res.ok) die(res.error ?? 'the setting could not be saved', { kind: 'save-failed' })
  say(`${harness.label} is the board's default — every agent that picked none runs it.`)
  // Switching never throws a setting away: every connector's settings live under its own
  // name, so what this one was last set to comes back with it.
  return showAgent()
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

// One setting, one model, or one key. Which of the three it is comes from the connector's own
// declaration: a key goes to docs/kanban/.env and nowhere else and is never echoed back, a
// setting that picks a model belongs to one agent and lands in docs/kanban/.local.json, and
// everything else is how to reach the connector and lands in ui.config.json.
//
// With no value the setting is cleared and the connector runs its own default. Reading a key
// back is never offered: a user who forgot theirs makes a new one.
function setSetting(args: string[]): MoveResult {
  const { agent, rest } = namedAgent(args)
  const settings = activeSettings(agent ? { agent } : undefined)
  const key = rest[0]?.trim() ?? ''
  const setting = settings.find((s) => s.key === key)
  if (!setting) {
    const keys = settings.map((s) => s.key)
    const whose = agent ? `\`${agent}\` runs a connector with` : 'the connector you run has'
    die(`${whose} no "${key}" setting. It takes: ${keys.join(', ') || '(none)'}`, {
      kind: 'unknown-setting',
      setting: key,
    })
  }
  const value = rest.slice(1).join(' ').trim()

  if (setting.kind === 'secret') {
    // A key is the board's one place, whichever agent asked: docs/kanban/.env is per machine
    // already, and two agents on one connector share the login it holds.
    const res = setSecret(setting.env!, value)
    if (!res.ok) die(res.error ?? 'the key could not be saved', { kind: 'save-failed' })
    say(value ? `${setting.label} saved to docs/kanban/.env.` : `${setting.label} cleared.`)
    return { setting: key, set: Boolean(value) }
  }

  const wrong = checkSetting(setting, value, agent)
  if (wrong) die(wrong, { kind: 'bad-value' })

  // A model belongs to the agent running it, so it needs one named — and it is saved against
  // the connector that agent runs, so switching tools and back finds it again.
  if (setting.agentOwned) {
    if (!agent) {
      die(`"${key}" is the model one agent runs, so name it: \`akb agent set --agent <agent> ${key} <value>\`. This board has: ${agentNames().join(', ')}.`, {
        kind: 'needs-input',
      })
    }
    const harness = agentHarness(agent)
    const res = setLocalAgentValue(agent, harness.name, key, value)
    if (!res.ok) die(res.error ?? 'the setting could not be saved', { kind: 'save-failed' })
    say(
      value
        ? `\`${agent}\` runs ${harness.label} with ${setting.label} "${value}", on this computer.`
        : `${setting.label} cleared for \`${agent}\` — ${harness.label} runs its own default.`,
    )
    return { agent, setting: key, value }
  }

  // Everything else is how to reach the connector, and is the board's. Named an agent, it is
  // that agent's connector whose block is written — never the board's default, or a value
  // Codex refuses would be saved against Claude Code's.
  const res = setHarnessSetting(key, value, agent ? agentHarness(agent).name : undefined)
  if (!res.ok) die(res.error ?? 'the setting could not be saved', { kind: 'save-failed' })
  say(value ? `${setting.label} is now "${value}".` : `${setting.label} cleared — the agent's own default runs.`)
  return { setting: key, value }
}

// Why this value can't be saved for this setting, or null when it can. `agent` names whose
// connector the rules are read against: the board's default with none.
function checkSetting(setting: HarnessSetting, value: string, agent?: string): string | null {
  // A list must be given one of its own choices; a box takes free text, because model ids
  // change between agent releases and the agent is the only validator worth having.
  if (setting.kind === 'select' && value && !setting.choices?.some((c) => c.value === value)) {
    const choices = setting.choices?.map((c) => c.value || '(empty)').join(', ')
    return `"${value}" isn't one of the ${setting.label} choices: ${choices}`
  }
  const ask = agent ? { agent } : undefined
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

// ---- what one agent runs (#443) --------------------------------------------

/** Give one agent a connector of its own, or put it back on the board's default with "-".
 *  What it picked for each connector is kept under that connector's name, so switching and
 *  switching back never loses a model. */
function bindAgent(args: string[]): MoveResult {
  const agent = args[0]?.trim() ?? ''
  if (!agent) die(`name an agent: akb agent bind <agent> <connector>. This board has: ${agentNames().join(', ')}.`, { kind: 'needs-input' })
  if (!agentNames().includes(agent)) {
    die(`"${agent}" is not an agent on this board. It has: ${agentNames().join(', ')}.`, {
      kind: 'unknown-agent',
      agent,
    })
  }
  const asked = args[1]?.trim() ?? ''
  if (!asked) die(`name a connector: akb agent bind ${agent} claude-code, or "-" for the board's default`, { kind: 'needs-input' })
  const legacy = specAgentNames(agent).slice(1)
  if (asked === '-') {
    const res = setAgentHarness(agent, '', legacy)
    if (!res.ok) die(res.error ?? 'the connector could not be saved', { kind: 'save-failed' })
    say(`\`${agent}\` runs the board's default connector — ${agentHarness(agent).label} here.`)
    return { agent, harness: '' }
  }
  const harness = knownHarness(asked)
  const res = setAgentHarness(agent, harness.name, legacy)
  if (!res.ok) die(res.error ?? 'the connector could not be saved', { kind: 'save-failed' })
  say(`\`${agent}\` runs ${harness.label}, on this board and every checkout of it.`)
  const model = agentRun(agent).values.model ?? ''
  say(model ? `Its model here is "${model}".` : `Give it a model: \`akb agent set --agent ${agent} model <id>\`.`)
  return { agent, harness: harness.name }
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

// One small chat through the setup as it stands, so a broken connector is found here rather
// than on the first card run that fails. Named a connector, it spawns that one; named none,
// the board's default — which is the one setup's own step is about, so only that form ticks
// the box.
async function testAgent(args: string[]): Promise<MoveResult> {
  const asked = args[0]?.trim() ?? ''
  const harness = asked ? knownHarness(asked) : undefined
  const label = harness?.label ?? agentInfo().name
  say(`testing ${label} …`)
  const res = await testConnection(harness?.name)
  if (res.ok) {
    say(`it answered in ${(res.ms / 1000).toFixed(1)}s. The board can run it.`)
    return { test: res, harness: res.harness, ...(harness ? {} : await tickAgentStep()) }
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
