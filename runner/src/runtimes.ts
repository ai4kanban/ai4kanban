// The runtimes a job can name, run through the CLI's own harness entries so a flag or a
// stream format the CLI learns reaches the Runner on its next build. The ones that talk
// (OpenCode, Cursor, DSH, ZCode, Grok Build) are driven by the harness's own client. A job's
// settings become arguments and environment by the board's own rules (agent/run-settings.ts).

import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { splitCommand } from '../../cli/src/lib/agent/argv'
import { HARNESSES as ALL } from '../../cli/src/lib/agent/harnesses'
import { MODEL_KEY, type Harness } from '../../cli/src/lib/agent/harnesses/types'
import { binaryOnPath } from '../../cli/src/lib/agent/installed'
import { effectiveValues, providerFor, settingArgs, settingEnv, type SettingValues } from '../../cli/src/lib/agent/run-settings'
import type { HarnessSetting } from '../../cli/src/lib/agent/types'
import type { RunEvent, StreamRenderer, TurnEnd } from '../../cli/src/lib/agent/wire'
import { obj, str } from '../../cli/src/lib/agent/wire/json'
import { connect } from '../../cli/src/lib/agent/wire/rpc'
import { RUNTIMES, type Job, type RuntimeReport, type SettingDecl } from './api'

const HARNESSES = Object.fromEntries(RUNTIMES.map((name) => [name, ALL.find((h) => h.name === name)!])) as Record<Job['runtime'], Harness>

const LOGIN_PROBE_MS = 5_000
const MODELS_MS = 30_000

/** What one job spawns. */
export interface Plan {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
  /** Written to stdin when the runtime reads its prompt there. */
  stdin?: string
  /** Reads a runtime that prints; `converse` drives one that answers back. */
  renderer?: StreamRenderer
  /** The one turn, held over the child's pipes. The turn's end is the job's: the child is a
   *  server and is ended after it. */
  converse?: (child: ChildProcess, event: (e: RunEvent) => void) => Promise<TurnEnd>
  /** True for stderr lines the runtime prints on every run and that say nothing. */
  quiet(line: string): boolean
  /** The id a later job resumes this session by, once known. */
  session(): string | undefined
}

export const LABELS = Object.fromEntries(RUNTIMES.map((name) => [name, HARNESSES[name].label])) as Record<Job['runtime'], string>

/** The settings a runtime takes, and the ones of them that are keys. */
export const settingKeys = (runtime: Job['runtime']) => HARNESSES[runtime].settings.map((s) => s.key)
export const secretKeys = (runtime: Job['runtime']) => HARNESSES[runtime].settings.filter((s) => s.kind === 'secret').map((s) => s.key)

/** The key of the runtime's provider list, and the provider its settings pick. */
export const providerKey = (runtime: Job['runtime']) => HARNESSES[runtime].settings.find((s) => s.kind === 'provider')?.key
export const providerOf = (runtime: Job['runtime'], model?: string | null, given: Settings = {}) =>
  providerFor(HARNESSES[runtime], held(runtime, model, given))?.id

/** True for a runtime driven over ACP, which takes no arguments after its subcommand. */
export const talks = (runtime: Job['runtime']) => !!HARNESSES[runtime].client

/** A runtime's settings beside its model, and the keys this computer holds for it (#2135). */
export interface Settings {
  settings?: Record<string, string> | null
  secrets?: Record<string, string>
}

function held(runtime: Job['runtime'], model: string | null | undefined, given: Settings): SettingValues {
  const keys = new Set(HARNESSES[runtime].settings.map((s) => s.key))
  const values = Object.fromEntries(Object.entries(given.settings ?? {}).filter(([k, v]) => keys.has(k) && k !== MODEL_KEY && typeof v === 'string' && v))
  if (model) values[MODEL_KEY] = model
  return { values, secretsSet: Object.keys(given.secrets ?? {}).filter((k) => given.secrets![k]) }
}

/** The arguments a runtime's model and settings add, the way the board's own run writes them. */
export const settingsArgs = (runtime: Job['runtime'], model?: string | null, given: Settings = {}): string[] =>
  settingArgs(HARNESSES[runtime], held(runtime, model, given))

/** What a person runs to install the runtime's CLI, and to sign it in. */
export const hints = (runtime: Job['runtime']) => ({ install: HARNESSES[runtime].install, login: HARNESSES[runtime].login?.login })

/** True when the runtime can open a copy of an earlier session (#2146). */
export const forks = (runtime: Job['runtime']) => !!HARNESSES[runtime].forkArgs

/** `resume` continues that session instead of opening a new one; with `fork`, a copy of it. */
export function plan(runtime: Job['runtime'], prompt: string, cwd: string, resume?: string | null, model?: string | null, given: Settings = {}, fork = false): Plan {
  const harness = HARNESSES[runtime]
  const values = held(runtime, model, given)
  const argv = [...splitCommand(harness.command), ...settingArgs(harness, values)]
  const id = randomUUID()
  const copied = fork && resume && harness.forkArgs ? harness.forkArgs(argv, resume, id, cwd) : null
  if (fork) resume = null
  const extra = copied ?? (resume ? harness.resumeArgs(argv, resume, cwd) : harness.extraArgs(argv, id, cwd))
  const quiet = (line: string) => harness.quietStderr?.(line) ?? false
  // WILDCRANE_JOB keeps the Claude Code plugin a job's own session loads from serving it (#2161).
  const env = { ...process.env, ...settingEnv(harness, values, given.secrets ?? {}, cwd), WILDCRANE_JOB: '1' }
  if (harness.client) {
    const client = harness.client(effectiveValues(harness, values))
    let session: string | undefined
    return {
      command: argv[0]!,
      args: [...argv.slice(1), ...extra],
      env,
      converse: (child, event) =>
        client.turn({
          stdout: child.stdout!,
          stdin: child.stdin!,
          prompt,
          cwd,
          resumeId: resume ?? undefined,
          log: () => {},
          gotResumeId: (got, restarted) => {
            if (restarted || !session) session = got
          },
          gotModel: () => {},
          event,
        }),
      quiet,
      session: () => session ?? resume ?? undefined,
    }
  }
  const renderer = harness.renderer!(cwd, argv[0], [...argv, ...extra])
  const toStdin = harness.stdinPrompt?.([...argv, ...extra])
  return {
    command: argv[0]!,
    args: [...argv.slice(1), ...extra, ...(toStdin ? [] : [prompt])],
    env,
    stdin: toStdin?.(prompt),
    renderer,
    quiet,
    session: () => renderer.resumeId?.() ?? resume ?? (harness.adoptsSessionId ? id : undefined),
  }
}

/** What a form needs of one setting: never how it reaches a run. */
export function declOf(setting: HarnessSetting): SettingDecl {
  return {
    key: setting.key,
    label: setting.label,
    kind: setting.kind,
    ...(setting.help ? { help: setting.help } : {}),
    ...(setting.placeholder ? { placeholder: setting.placeholder } : {}),
    ...(setting.choices ? { choices: setting.choices.map(({ value, label }) => ({ value, label })) } : {}),
    ...(setting.providers ? { providers: setting.providers.map(({ id, label, blurb, needs }) => ({ id, label, blurb, needs })) } : {}),
    ...(setting.defaultProvider ? { defaultProvider: setting.defaultProvider } : {}),
  }
}

/** Whether each runtime is installed here and, where its CLI says, logged in. `quick` leaves out
 *  the model lists that take a CLI's own start-up to read (OpenCode, Cursor). */
export async function detectRuntimes(quick = false): Promise<RuntimeReport[]> {
  return Promise.all(
    (Object.keys(HARNESSES) as Job['runtime'][]).map(async (name) => {
      const harness = HARNESSES[name]
      const binary = splitCommand(harness.command)[0]!
      const settings = harness.settings.map(declOf)
      if (!binaryOnPath(binary)) return { name, installed: false, settings }
      const loggedIn = harness.login ? await probeLogin(binary, harness) : undefined
      const models = loggedIn === false || (quick && SLOW.has(name)) ? [] : await (MODELS[name] ?? listed(harness))().catch(() => [])
      return { name, installed: true, ...(loggedIn === undefined ? {} : { loggedIn }), ...(models.length ? { models } : {}), settings }
    }),
  )
}

type Model = { id: string; name: string }

const SLOW = new Set<Job['runtime']>(['opencode', 'cursor'])

/** The ids a CLI caches for its own picker (harness `models()`), for the ones read no other way. */
const listed = (harness: Harness) => async (): Promise<Model[]> => (harness.models?.() ?? []).map((id) => ({ id, name: id }))

const MODELS: Partial<Record<Job['runtime'], () => Promise<Model[]>>> = {
  'claude-code': async () => [
    { id: 'opus', name: 'Opus' },
    { id: 'sonnet', name: 'Sonnet' },
    { id: 'haiku', name: 'Haiku' },
  ],
  codex: async () => codexModels(path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'models_cache.json')),
  opencode: async () => opencodeModels(await output('opencode', ['models'])),
  cursor: () => cursorModels(),
}

/** `opencode models`: one `provider/model` id a line, the same ids its ACP session takes. */
export function opencodeModels(out: string): Model[] {
  return out.split('\n').map((l) => l.trim()).filter((l) => /^\S+\/\S+$/.test(l)).map((id) => ({ id, name: id }))
}

/** Cursor's ACP ids carry their parameters and are not the ones `cursor-agent models` prints, so
 *  they are read off a session opened for the purpose and closed without a prompt. Auto is the
 *  menu's own default and is left out. */
function cursorModels(): Promise<Model[]> {
  const argv = splitCommand(HARNESSES.cursor.command)
  return new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawn(argv[0]!, argv.slice(1), { cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, ...HARNESSES.cursor.env() } })
    } catch {
      return resolve([])
    }
    const done = (models: Model[]) => {
      clearTimeout(timer)
      child.kill()
      resolve(models)
    }
    const timer = setTimeout(() => done([]), MODELS_MS)
    child.on('error', () => done([]))
    const rpc = connect(child.stdout!, child.stdin!, (msg) => msg.id !== undefined && rpc.refuse(msg.id, 'no'), { jsonrpc: true })
    rpc
      .call('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } })
      .then(() => rpc.call('session/new', { cwd: os.tmpdir(), mcpServers: [] }))
      .then((opened) => done(acpModels(opened)))
      .catch(() => done([]))
  })
}

/** A session's `availableModels`, less the Auto entry. */
export function acpModels(opened: Record<string, unknown>): Model[] {
  const list = obj(opened.models).availableModels
  return (Array.isArray(list) ? list : []).map(obj).flatMap((m) => {
    const id = str(m.modelId)
    return id && id !== 'default[]' ? [{ id, name: str(m.name) || id }] : []
  })
}

/** What a command prints, or nothing when it fails or takes too long. */
function output(command: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    let out = ''
    let child: ChildProcess
    try {
      child = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'], shell: process.platform === 'win32' })
    } catch {
      return resolve('')
    }
    const timer = setTimeout(() => child.kill(), MODELS_MS)
    child.stdout?.on('data', (d) => (out += d))
    child.on('error', () => resolve(''))
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code === 0 ? out : '')
    })
  })
}

/** The models Codex lists in its own picker, from the catalogue it caches. */
export function codexModels(file: string): Model[] {
  try {
    const cache = JSON.parse(fs.readFileSync(file, 'utf8')) as { models?: unknown }
    if (!Array.isArray(cache.models)) return []
    return cache.models.flatMap((m: { slug?: unknown; display_name?: unknown; visibility?: unknown }) =>
      m.visibility === 'list' && typeof m.slug === 'string' && m.slug
        ? [{ id: m.slug, name: typeof m.display_name === 'string' && m.display_name ? m.display_name : m.slug }]
        : [],
    )
  } catch {
    return []
  }
}

function probeLogin(binary: string, harness: Harness): Promise<boolean | undefined> {
  const probe = harness.login!
  return new Promise((resolve) => {
    let output = ''
    let child
    try {
      child = spawn(binary, probe.args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
    } catch {
      return resolve(undefined)
    }
    const timer = setTimeout(() => child.kill(), LOGIN_PROBE_MS)
    child.stdout?.on('data', (d) => (output += d))
    child.stderr?.on('data', (d) => (output += d))
    child.on('error', () => resolve(undefined))
    child.on('close', () => {
      clearTimeout(timer)
      resolve(probe.ready(output) ? true : probe.loggedOut(output) ? false : undefined)
    })
  })
}
