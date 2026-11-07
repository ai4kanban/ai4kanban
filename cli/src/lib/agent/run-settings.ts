// A runtime's settings as one run's arguments and environment — plain functions over what was
// read, so a board run (agent/resolve.ts) and a Runner job (runner/src/runtimes.ts) turn the
// same settings into the same command.

import path from 'node:path'
import { machineHome } from '../machine/home'
import type { Language } from '../machine/types'
import { splitCommand } from './argv'
import { SESSION_VARS } from './env'
import { isSystemLanguage, systemLanguage } from './language'
import type { Harness } from './harnesses/types'
import { RAW_ARGS_KEY } from './harnesses/types'
import { withSystemProxy } from './proxy'
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
  const env: NodeJS.ProcessEnv = withSystemProxy(harness.env())
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

/** 清除父运行注入的规则，保留用户的其他系统提示词。 */
function languageEnv(given: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...given }
  if (env.DSH_SYSTEM_PROMPT) {
    const parts = env.DSH_SYSTEM_PROMPT.split('\n\n')
    while (isSystemLanguage(parts.at(-1) ?? '')) parts.pop()
    env.DSH_SYSTEM_PROMPT = parts.join('\n\n')
  }
  try {
    const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT ?? '{}')
    if (Array.isArray(config.instructions)) {
      config.instructions = config.instructions.filter((file: unknown) => typeof file !== 'string'
        || path.dirname(file) !== path.join(machineHome(), 'prompts')
        || !/^opencode-language(?:-[a-f0-9]{16})?\.md$/.test(path.basename(file)))
      env.OPENCODE_CONFIG_CONTENT = JSON.stringify(config)
    }
  } catch {
    // 无效配置交给连接器处理。
  }
  return env
}

/** 语言要求只进入连接器的系统提示词；无法注入时返回可见提示。 */
export function withSystemLanguage(
  harness: Harness,
  argv: string[],
  env: NodeJS.ProcessEnv,
  language: Language | null,
): { argv: string[]; env: NodeJS.ProcessEnv; note?: string } {
  env = languageEnv(env)
  const text = systemLanguage(language)
  if (!text) return { argv, env }
  const added = argv.length ? harness.systemPrompt?.(text, argv, env) : undefined
  if (!added?.args?.length && !Object.keys(added?.env ?? {}).length) {
    const note = language === 'zh'
      ? '语言规则未能更新：连接器、已有会话或自设系统提示词不支持注入。请自行另开支持的会话以采用新规则。'
      : 'Language rules could not be updated: the connector, existing session, or custom system prompt prevents injection. Open a supported new session to apply them.'
    return { argv, env, note }
  }
  // Node 包装脚本的连接器参数必须放在脚本之后。
  const at = /^node(?:\.exe)?$/.test(path.basename(argv[0]!)) && argv[1] && !argv[1].startsWith('-') ? 2 : 1
  return { argv: [...argv.slice(0, at), ...(added?.args ?? []), ...argv.slice(at)], env: { ...env, ...added?.env } }
}
