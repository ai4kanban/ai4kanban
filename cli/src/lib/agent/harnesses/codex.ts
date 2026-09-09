import fs from 'node:fs'
import path from 'node:path'

import { createCodexStreamRenderer } from '../wire'
import { arr, home, modelsIn, num, obj, str } from './models'
import { providerBlip } from './transient'
import { namesFlag, type Harness } from './types'

// The two flags every `codex exec` run wants, added only when the user's own `command`
// hasn't already named them.
//
// Nothing about the working folder: Codex honours the cwd it is spawned with (probed the
// way WORKING FOLDER in ./types describes), so its `--cd` would only repeat it.
//
// `--json` gives the JSONL event stream codex-stream.ts renders — without it `codex exec`
// prints its final message and nothing else, so the live tail would stay empty for the
// whole run and no thread id would ever arrive.
//
// `--sandbox workspace-write` is needed because `codex exec` defaults to read-only and a
// board run writes files. It is also the whole of what a Codex run may do: inside the repo,
// and it refuses to start outside a git repo. Someone who needs more widens it in that
// agent's `command`. `--full-auto` is deprecated in current Codex (it warns and points
// here), so it is never used — but a command that names it, or the bypass flag, counts as a
// sandbox already chosen and nothing is added on top.
//
// The network goes with it, and only with it. `workspace-write` blocks outbound network by
// default, and Codex is the only one of the six that fences it: Claude Code, Cursor and
// ZCode have no fence at all, and OpenCode's and dsh's are about writes rather than
// sockets. Left off, the same card passes on five agents and fails on this one the moment
// it needs an `npm install`, a `pip install` or a `git fetch` — a difference nobody could
// explain from the board. It rides on the sandbox WE chose, so a hand-written sandbox keeps
// choosing for itself, network included.
function codexExtraArgs(argv: string[]): string[] {
  const extra: string[] = []
  if (!namesFlag(argv, ['--json', '--experimental-json'])) extra.push('--json')
  const sandboxFlags = ['--sandbox', '-s', '--full-auto', '--dangerously-bypass-approvals-and-sandbox']
  if (!namesFlag(argv, sandboxFlags)) {
    extra.push('--sandbox', 'workspace-write', '-c', 'sandbox_workspace_write.network_access=true')
  }
  return extra
}

// The block a provider pick that isn't the subscription runs through, written on the
// command line as Codex's own `-c key=value` overrides.
//
// It has to be a provider of the board's own making. Codex reserves the built-in ids and
// refuses a config that redefines `openai`, and the built-in one would not use the key
// anyway: with a `codex login` in place it signs every request with that login and ignores
// OPENAI_API_KEY entirely, so a pick that said "OpenAI API" would quietly spend the
// subscription. A provider declared here has no login of its own and reads the key from
// `env_key`, which is the only way a key reaches a Codex run at all.
//
// `name` is required and must not be empty. `wire_api` is left alone: Codex speaks
// OpenAI's Responses API and, since it dropped `wire_api = "chat"`, nothing else.
function codexProvider(id: string, name: string, baseUrl?: string): string[] {
  return [
    '-c',
    `model_providers.${id}.name=${name}`,
    ...(baseUrl ? ['-c', `model_providers.${id}.base_url=${baseUrl}`] : []),
    '-c',
    `model_providers.${id}.env_key=OPENAI_API_KEY`,
    '-c',
    `model_provider=${id}`,
  ]
}

// Where the `codex` binary is when nothing put it on the PATH.
//
// Codex is the one CLI here that ships INSIDE a desktop app: the standalone Codex app was
// folded into the ChatGPT desktop app, which carries a full `codex` in its own resources and
// installs no shim. So a user who has Codex — and runs it every day in that app — reads as
// "not installed" on a board that only looks at the PATH.
//
// `CODEX_CLI_PATH` comes first and is OpenAI's own variable for this: the app reads it to
// find the binary it failed to locate, so anyone with an unusual install has already set it
// and we inherit the answer instead of asking for it again.
//
// After it, only paths that were READ OFF a real install, and only this platform's. The Linux
// .deb/.rpm bundles `resources/bin/codex` under a prefix OpenAI doesn't document, so that one
// is still left to `CODEX_CLI_PATH`: a wrong path that never matches is dead code that reads
// like coverage.

/** An environment root as this machine sets it, or nothing. A root that isn't set holds
 *  nothing to look in and is not a failed lookup. */
function envRoot(name: string): string {
  return process.env[name]?.trim() ?? ''
}

/** The immediate subfolder NAMES of one folder — the single variable level each Windows
 *  layout below has, and the whole of what is enumerated. Empty when the folder isn't there
 *  or can't be read, so a missing root, a locked one, or one that disappears mid-scan costs
 *  the lookup nothing. */
function folders(parent: string): string[] {
  if (!parent) return []
  try {
    return fs
      .readdirSync(parent, { withFileTypes: true })
      .filter((one) => one.isDirectory())
      .map((one) => one.name)
  } catch {
    return []
  }
}

/** A file's modification time, or 0 for one that isn't there. */
function modified(file: string): number {
  try {
    return fs.statSync(file).mtimeMs
  } catch {
    return 0
  }
}

/** Comparing two paths, so every ordering below ends in something that reads the same way
 *  twice on the same disk. */
function byPath(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Newest first: the Desktop cache names its folders by build hash, which says nothing about
 *  version, so the executable's own modification time is the only ordering there is. It
 *  prefers a recently written file — not a proven latest CLI — and ties break on the path. */
function byNewest(files: string[]): string[] {
  return files
    .map((file) => ({ file, at: modified(file) }))
    .sort((a, b) => b.at - a.at || byPath(a.file, b.file))
    .map((one) => one.file)
}

/** The version a folder name carries, as numbers: `OpenAI.Codex_1.2.3_x64__abc` reads as
 *  [1,2,3], and so does `1.2.3-x86_64-pc-windows-msvc`. A name carrying none sorts last. */
function versionOf(name: string): number[] {
  const found = /(\d+(?:\.\d+)+)/.exec(name)
  return found ? found[1]!.split('.').map(Number) : []
}

/** Highest version first, ties on the name. Never a spawn and never a string compare of the
 *  whole name: `0.9.0` has to beat `0.10.0` on the numbers, not on the alphabet. */
function byVersion(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const [x, y] = [versionOf(a), versionOf(b)]
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const step = (y[i] ?? -1) - (x[i] ?? -1)
      if (step) return step
    }
    return byPath(a, b)
  })
}

/** Every architecture these folder names are known to be spelt with — Windows' own package
 *  word and the Rust target the standalone release is built for. */
const ARCHES = ['x86_64', 'aarch64', 'i686', 'x64', 'arm64', 'x86']

/** How THIS machine's architecture is spelt in them. */
function ourArches(): string[] {
  if (process.arch === 'arm64') return ['arm64', 'aarch64']
  if (process.arch === 'ia32') return ['x86', 'i686']
  return ['x64', 'x86_64']
}

/** Whether a folder name is one this machine could run. The LONGEST architecture word in the
 *  name is the one it was built for — `x86_64` holds `x86` and is not it. A name that spells
 *  out an architecture we are not is dropped; one that names none is kept, because an
 *  unfamiliar spelling is a reason to try the file, not to throw it away. */
function ourArch(name: string): boolean {
  const lower = name.toLowerCase()
  const named = ARCHES.filter((arch) => lower.includes(arch)).sort((a, b) => b.length - a.length)[0]
  return !named || ourArches().includes(named)
}

// Every place a Windows machine has been seen to keep a `codex.exe` that nothing put on the
// PATH, in the order they are tried. `%ProgramFiles%\WindowsApps` is last because running a
// packaged app's file directly is often refused by its ACL — worth trying only once nothing
// else answered.
//
// Read off firsthand reports rather than an OpenAI guarantee (openai/codex#29365, #43162,
// #27230). A file being here proves it is on disk and nothing more: whether it starts is the
// login probe's answer (agent/login.ts), and a cache Desktop left behind stays discoverable
// after Desktop itself is uninstalled.
export function codexOnWindows(): string[] {
  const local = envRoot('LOCALAPPDATA')
  const profile = envRoot('USERPROFILE')
  const programs = envRoot('ProgramFiles')
  const cache = local ? path.join(local, 'OpenAI', 'Codex', 'bin') : ''
  const releases = profile ? path.join(profile, '.codex', 'packages', 'standalone', 'releases') : ''
  const packages = programs ? path.join(programs, 'WindowsApps') : ''
  return [
    // Desktop's relocated CLI cache: a folder per build hash, newest file first.
    ...byNewest(folders(cache).map((name) => path.join(cache, name, 'codex.exe'))),
    // The separate standalone launcher, at a path with nothing variable in it.
    ...(local ? [path.join(local, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe')] : []),
    // That launcher's release payload: a folder per version and target.
    ...byVersion(folders(releases).filter(ourArch)).map((name) =>
      path.join(releases, name, 'bin', 'codex.exe'),
    ),
    // Desktop's own MSIX package.
    ...byVersion(folders(packages).filter((name) => name.startsWith('OpenAI.Codex_')).filter(ourArch)).map(
      (name) => path.join(packages, name, 'app', 'resources', 'codex.exe'),
    ),
  ]
}

function codexBundled(): string[] {
  const override = process.env.CODEX_CLI_PATH?.trim()
  return [
    ...(override ? [override] : []),
    ...(process.platform === 'win32'
      ? codexOnWindows()
      : [
          // macOS, where Codex now lives in the merged app…
          '/Applications/ChatGPT.app/Contents/Resources/codex',
          home('Applications/ChatGPT.app/Contents/Resources/codex'),
          // …and where it lived before the merge, for an install that hasn't moved yet.
          '/Applications/Codex.app/Contents/Resources/codex',
          home('Applications/Codex.app/Contents/Resources/codex'),
        ]),
  ]
}

export const CODEX: Harness = {
  name: 'codex',
  label: 'Codex',
  icon: '/agents/codex.svg',
  command: 'codex exec --json --sandbox workspace-write -c sandbox_workspace_write.network_access=true',

  bundled: codexBundled,

  // Nothing to pin: Codex mints its own thread id and takes none from us, so the generated
  // session id is ignored here and the id arrives on the run's first event instead.
  extraArgs(argv) {
    return codexExtraArgs(argv)
  },

  resumes: true,

  // `codex exec … resume <thread-id> "<prompt>"` sends one more turn into an existing
  // thread. `resume` is a SUBCOMMAND, not a flag: everything else has to come before it
  // and the prompt comes after, which is why a run's flags are assembled command →
  // settings → harness (see startRun).
  resumeArgs(argv, resumeId) {
    return [...codexExtraArgs(argv), 'resume', resumeId]
  },

  // What Codex takes, in the order Claude Code's dialog draws the same four: who pays for
  // the run and where it goes, that endpoint's address, the key, a model, and how hard that
  // model thinks. Everything but the key reaches Codex through its own `-c key=value`
  // override rather than a flag of its own, which is the only way its CLI takes any of it.
  settings: [
    // Who pays for a run, and where it goes. The same three ways in that Claude Code has,
    // in Codex's own words: the ChatGPT login the CLI already holds, OpenAI's API, and any
    // gateway that answers OpenAI's Responses API.
    {
      key: 'provider',
      label: 'Provider',
      kind: 'provider',
      defaultProvider: 'subscription',
      // Codex picks its provider on the command line, so a hand-written `command` that
      // names that key is a pick of its own and wins — the whole block below is dropped.
      flags: ['model_provider'],
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model provider, and that wins.`,
      providers: [
        {
          id: 'subscription',
          label: 'ChatGPT subscription',
          blurb: 'Runs on the login your codex CLI already has. Nothing else to fill in.',
          needs: [],
        },
        {
          id: 'openai-api',
          label: 'OpenAI API',
          blurb: 'Pay per token, with an OpenAI API key.',
          needs: ['apiKey'],
          // A board that pasted a key before this list existed pasted it to run on it. It
          // reads as this provider until the user picks otherwise — and on a machine with
          // no `codex login` it is the only pick whose runs start at all.
          preferWhenSet: ['apiKey'],
          args: codexProvider('openai-api', 'OpenAI', 'https://api.openai.com/v1'),
        },
        {
          id: 'endpoint',
          label: 'OpenAI-compatible endpoint',
          blurb:
            "A gateway that answers OpenAI's Responses API — OpenRouter, LiteLLM, a company proxy.",
          needs: ['baseUrl', 'apiKey'],
          // The base URL is what makes this pick mean anything, so it is the one box that
          // has to be filled. The key isn't: a proxy on your own laptop often takes none.
          requires: ['baseUrl'],
          args: codexProvider('endpoint', 'Endpoint'),
        },
      ],
    },
    // Where an endpoint run goes. Not a secret — a gateway address is not a credential — so
    // it saves beside the model in ui.config.json, and it fills in the one field the pick
    // above leaves open in that provider's block.
    {
      key: 'baseUrl',
      label: 'Endpoint base URL',
      kind: 'text',
      flags: ['model_providers.endpoint.base_url'],
      configFlag: '-c',
      placeholder: 'https://my-gateway.example.com/v1',
      help: 'The address the gateway answers on.',
    },
    // The key the picked provider uses, read from the environment by the provider block
    // above. Only a provider that needs it sees it: the subscription never does, so the key
    // never reaches that run and can't quietly move it onto paid usage.
    {
      key: 'apiKey',
      label: 'OpenAI API key',
      kind: 'secret',
      env: 'OPENAI_API_KEY',
      placeholder: 'sk-…',
      help: 'Saved to docs/kanban/.env (kept out of git), never shown back.',
    },
    {
      key: 'model',
      agentOwned: true,
      label: 'Model',
      kind: 'text',
      placeholder: 'gpt-5.1-codex',
      // `models()` below fills the list under it; free text is what it stays.
      flags: ['--model', '-m'],
      help: "Empty runs the agent's default. A wrong id fails the run; the log says why.",
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model, and that wins.`,
    },
    // How hard the model thinks. Codex takes no flag for it and passes whatever it is
    // given straight through to the API, so a level the picked model doesn't offer fails
    // there rather than here and the run's log carries the reason. The board never invents
    // a level and never judges one: these are the ones Codex's own model list names today.
    {
      key: 'reasoning',
      agentOwned: true,
      label: 'Reasoning effort',
      kind: 'select',
      choices: [
        { value: '', label: "Agent's default" },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'xhigh', label: 'Extra high (xhigh)' },
        { value: 'max', label: 'Max' },
        { value: 'ultra', label: 'Ultra' },
      ],
      flags: ['model_reasoning_effort'],
      configFlag: '-c',
      help: 'Lower is quicker and cheaper, higher is slower and more careful.',
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names an effort level, and that wins.`,
    },
  ],

  // Codex's own model list, which it fetches from its server and caches — the refresh whose
  // stderr chatter `quietStderr` below drops. So the board reads the file instead of keeping
  // a list of its own, and a model OpenAI shipped this morning is offered this morning.
  //
  // `visibility` is Codex's word for a model it does not put on its own picker (a reserve
  // capacity slug, the model its automatic reviews run on). Those are hidden here too —
  // still typeable, like anything else. `priority` is the order Codex itself lists them in.
  models() {
    return modelsIn(home('.codex', 'models_cache.json'), (data) =>
      arr(obj(data).models)
        .map(obj)
        .filter((model) => str(model.visibility) !== 'hide')
        .sort((a, b) => num(a.priority) - num(b.priority))
        .map((model) => str(model.slug)),
    )
  },

  // Nothing extra. Claude Code gets CLAUDE_CODE_MAX_RETRIES=0 so a rate limit fails at
  // once and frees the card; Codex has no equivalent switch, so a rate-limited Codex run
  // waits it out and holds the card while it does. Better that than a made-up variable.
  //
  // No `providerEnv` either: the pick already drops and sets OPENAI_API_KEY, and there is
  // no second variable to drop. Codex reads no base URL from the environment — an exported
  // OPENAI_BASE_URL moves nothing — and where a run goes is settled on its command line.
  env: () => ({ ...process.env }),

  // A completed turn carries its token counts and nothing else. The model comes from the
  // session's rollout on disk instead, and the price is worked out from the two
  // (agent/wire/codex-stream.ts). A model whose rates the board doesn't know shows no price.
  reports: ['tokens', 'model', 'cost'],

  stopsOnRateLimit: false,

  // A provider that stumbled, in the one place `codex exec --json` reports why a run
  // failed: its `turn.failed` and `error` events, which the renderer keeps as this run's
  // failure (#525). Its final message is not read the way Claude Code's is — Codex puts the
  // reason on the stream, so a message that merely mentions one is the agent's prose.
  transient: ({ failure }) => providerBlip(failure),

  renderer: createCodexStreamRenderer,

  // Codex re-reads its model list on a timer and traces the attempt to stderr every time,
  // whether it worked or not. On a codex whose cached list is a version out of date that is
  // a line per turn, all of it identical, none of it about the run — a 2-minute run's log
  // came back more housekeeping than work. The list it failed to refresh is not one the
  // board uses: a run's model comes from the settings or the CLI's own default.
  //
  // The other line is Codex noticing that its stdin isn't a terminal and reading it out —
  // which is us: a printing connector is spawned with no stdin at all. It says nothing
  // about the run, and it is the FIRST thing a chat reply would otherwise open with.
  //
  // Only these two are dropped. Codex's network, sandbox and MCP failures all trace the
  // same way and all stay — a websocket that keeps resetting is the answer to why a run
  // died, and it reads as noise right up until it is the only thing that matters.
  quietStderr: (line) =>
    line.includes('codex_models_manager::') || line.trim() === 'Reading additional input from stdin...',

  // Codex names its own thread, so our session id is only ever the board's key for the
  // run. The real resume id lands on the first event and the record saves it there.
  adoptsSessionId: false,

  savesSessionAtOpen: false,

  // `codex exec [resume] --image=<FILE>` attaches one picture, repeated per file. The `=` is
  // not a style choice: on `codex exec` the flag is `--image <FILE>...`, and spelt as two
  // tokens it would swallow the prompt that follows it as a second file — Codex would then
  // read the prompt from a stdin the board never opens and send an empty turn.
  images: { as: 'args', args: (file) => [`--image=${file}`] },

  // Codex ignores a slash name — it reads as plain chat text — and triggers a skill from a
  // `$` name. The install already writes the skill to `.agents/skills/kanban/`, which is
  // where Codex looks.
  skillCall: '$kanban',

  // `codex login status` prints one line and nothing else: "Logged in using ChatGPT" —
  // or an API key, which is why the reading stops at the first two words — and "Not logged
  // in".
  login: {
    args: ['login', 'status'],
    ready: (out) => /^\s*Logged in\b/m.test(out),
    loggedOut: (out) => /^\s*Not logged in\b/m.test(out),
    login: 'codex login',
  },

  install: 'npm install -g @openai/codex',
}
