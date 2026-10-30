// A runtime's settings as one run's arguments and environment — plain functions over what was
// read, so a board run (agent/resolve.ts) and a Runner job (runner/src/runtimes.ts) turn the
// same settings into the same command.

import { splitCommand } from './argv'
import { SESSION_VARS } from './env'
import { systemLanguage } from './language'
import type { Harness } from './harnesses/types'
import { RAW_ARGS_KEY } from './harnesses/types'
import { pickedProvider, providerOwned, providerSetting, shownForProvider } from './providers'
import type { Provider } from './types'

/** What a runtime is set to: every non-secret value, the keys of the secrets it holds, and the
 *  keys whose flag a hand-written `command` already names. */
export interface SettingValues {
  values: Record<string, string>
  secretsSet: string[]
  ignored?: string[]
}

/** What counts as filled in for one setting: a secret this runtime holds, or any other value. */
export function isFilled(harness: Harness, { values, secretsSet }: SettingValues): (key: string) => boolean {
  return (key) => {
    const setting = harness.settings.find((s) => s.key === key)
    return setting?.kind === 'secret' ? secretsSet.includes(key) : Boolean(values[key])
  }
}

/** The provider a run goes through, or nothing when this connector declares no provider list. */
export function providerFor(harness: Harness, held: SettingValues): Provider | undefined {
  const setting = providerSetting(harness.settings)
  if (!setting) return undefined
  return pickedProvider(setting, held.values[setting.key] ?? '', isFilled(harness, held))
}

// Each declared setting as this agent's own flag, in the order it declared them. The value is
// always its own argv entry and nothing checks it: a bad one is the agent's to reject. A
// setting the command override already names is skipped, and so is one the picked provider
// doesn't use.
export function settingArgs(harness: Harness, held: SettingValues): string[] {
  const { values } = held
  const ignored = held.ignored ?? []
  const picked = providerFor(harness, held)
  // A `command` that names the provider setting's flag has picked by hand: nothing the board's
  // pick would write reaches the command line.
  const list = providerSetting(harness.settings)
  const byHand = !!list && ignored.includes(list.key)
  const providerArgs = byHand ? [] : (picked?.args ?? [])
  const flags = harness.settings.flatMap((setting) => {
    const value = values[setting.key]
    if (!value || !setting.flags?.length || ignored.includes(setting.key)) return []
    if (setting.kind === 'provider') return []
    if (byHand && providerOwned(harness.settings, setting.key)) return []
    if (!shownForProvider(harness.settings, setting.key, picked)) return []
    // A setting the CLI has no flag of its own for rides on a generic config flag as one entry.
    const flag = setting.flags[0]!
    return setting.configFlag ? [setting.configFlag, `${flag}=${value}`] : [flag, value]
  })
  // The raw arguments go last of the settings' own, still before whatever the harness adds:
  // a connector whose own arguments open a subcommand takes everything after it as its own.
  return [...providerArgs, ...flags, ...splitCommand(values[RAW_ARGS_KEY] ?? '')]
}

// The environment one run gets: the connector's own, less every variable the provider pick
// owns, plus what the picked provider needs — each setting under the variable it declares, a
// key from `secrets`. Keys go in the environment and never in argv.
export function settingEnv(
  harness: Harness,
  held: SettingValues,
  secrets: Record<string, string>,
  cwd: string,
): NodeJS.ProcessEnv {
  const { values } = held
  const picked = providerFor(harness, held)
  const env: NodeJS.ProcessEnv = { ...harness.env() }
  for (const name of ownedVars(harness)) delete env[name]
  for (const name of Object.values(SESSION_VARS)) delete env[name]
  for (const setting of harness.settings) {
    if (!setting.env) continue
    if (!shownForProvider(harness.settings, setting.key, picked)) continue
    const value = setting.kind === 'secret' ? secrets[setting.key] : values[setting.key]
    if (!value) continue
    // The picked provider can rename a setting's variable, or the setting says so itself —
    // instead of, never as well as.
    env[picked?.envAs?.[setting.key] ?? setting.envAs ?? setting.env] = value
  }
  // Some CLIs read PWD instead of asking the OS (harnesses/types.ts, WORKING FOLDER).
  return { ...env, PWD: cwd, ...(picked?.env ?? {}) }
}

/** Every variable the provider pick owns: the connector's own list plus the ones its
 *  provider-owned settings name. */
export function ownedVars(harness: Harness): string[] {
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

/** What a run's settings are, as a client is handed them: the provider's own picks only, and
 *  never a secret. */
export function effectiveValues(harness: Harness, held: SettingValues): Record<string, string> {
  const picked = providerFor(harness, held)
  const out: Record<string, string> = {}
  for (const setting of harness.settings) {
    const value = held.values[setting.key]
    if (!value || setting.kind === 'secret') continue
    if (!shownForProvider(harness.settings, setting.key, picked)) continue
    out[setting.key] = value
  }
  return out
}

/** The command line and environment with `line`'s language ask in the connector's own system
 *  prompt (#104). Unchanged for English, and for a connector with no way in. */
export function withSystemLanguage(
  harness: Harness,
  argv: string[],
  env: NodeJS.ProcessEnv,
  line: string,
): { argv: string[]; env: NodeJS.ProcessEnv } {
  const text = systemLanguage(line)
  const added = text && argv.length ? harness.systemPrompt?.(text, argv) : undefined
  if (!added) return { argv, env }
  return { argv: [argv[0]!, ...(added.args ?? []), ...argv.slice(1)], env: { ...env, ...added.env } }
}
