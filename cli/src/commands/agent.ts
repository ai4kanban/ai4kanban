// Which agent runs the board, and everything it is set to.
//
// A run never reads the terminal's environment for any of this — it reads these settings,
// so a run started in a shell with an old export in it goes exactly where the board says.
// The same commands change them, so nothing has to open a browser to pick an agent, and a
// front end can offer the agents and their settings without keeping a list of its own.

import { providerSetting } from '../lib/agent/providers'
import { activeSettings, agentInfo, settingSaveError } from '../lib/agent/resolve'
import { setHarness, setHarnessSetting, setSecret } from '../lib/agent/settings'
import { testConnection } from '../lib/agent/test'
import { HARNESSES } from '../lib/agent/harnesses'
import type { HarnessSetting } from '../lib/agent/types'
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
    case 'test':
      return await testAgent()
    default:
      die(`unknown agent command "${word}" — try \`akb agent\`, or one of use, set, list, test`, {
        kind: 'unknown-move',
        move: word,
      })
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

  // A list must be given one of its own choices; a box takes free text, because model ids
  // change between agent releases and the agent is the only validator worth having.
  if (setting.kind === 'select' && value && !setting.choices?.some((c) => c.value === value)) {
    const choices = setting.choices?.map((c) => c.value || '(empty)').join(', ')
    die(`"${value}" isn't one of the ${setting.label} choices: ${choices}`, { kind: 'bad-value' })
  }
  if (setting.kind === 'provider' && !value) {
    const list = providerSetting(activeSettings())
    die(`a run always goes through a provider, so this one can't be cleared. Pick one: ${
      list?.providers?.map((p) => p.id).join(', ') ?? ''
    }`, { kind: 'bad-value' })
  }
  // The provider pick, and the boxes it can't do without: a pick that names no provider we
  // ship, one whose base URL is still empty, and a base URL emptied while that pick is
  // live are all refused — so the file never says a run goes somewhere it can't go.
  const wrong = settingSaveError(key, value)
  if (wrong) die(wrong, { kind: 'bad-value' })

  const res = setHarnessSetting(key, value)
  if (!res.ok) die(res.error ?? 'the setting could not be saved', { kind: 'save-failed' })
  say(value ? `${setting.label} is now "${value}".` : `${setting.label} cleared — the agent's own default runs.`)
  return { setting: key, value }
}

// A test that passed is what settles setup's `agent` step — the same rule the local UI
// works by, so a board set up from a terminal finishes the same way as one set up from the
// window. Picking an agent is not enough on its own: everything after this step is a run,
// so a board that got past it without an agent that answers was never set up.
//
// Silent unless it actually ticked something: a board with no checklist, or one whose box
// is already ticked, has nothing to say.
function tickAgentStep(): { setupStep?: string } {
  const before = readSetupState()
  if (!before?.steps.some((s) => s.name === 'agent' && !s.done)) return {}
  const ticked = finishSetupStep('agent')
  if (!ticked.ok) return {}
  const after = readSetupState()
  say('')
  say(
    after
      ? `setup's \`agent\` step is done — ${after.done}/${after.total}.${after.next ? ` Next: \`${after.next.name}\`.` : ''}`
      : "setup's `agent` step is done — that was the last one.",
  )
  return { setupStep: 'agent' }
}

// One small chat through the setup as it stands, so a broken agent is found here rather
// than on the first card run that fails.
async function testAgent(): Promise<MoveResult> {
  const info = agentInfo()
  say(`testing ${info.command} …`)
  const res = await testConnection()
  if (res.ok) {
    say(`it answered in ${(res.ms / 1000).toFixed(1)}s. The board can run it.`)
    return { test: res, ...tickAgentStep() }
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
