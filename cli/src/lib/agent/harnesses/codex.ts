import { createCodexStreamRenderer } from '../wire'
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

export const CODEX: Harness = {
  name: 'codex',
  label: 'Codex',
  icon: '/agents/codex.svg',
  command: 'codex exec --json --sandbox workspace-write -c sandbox_workspace_write.network_access=true',

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
      label: 'Model',
      kind: 'text',
      placeholder: 'gpt-5.1-codex',
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
      label: 'Reasoning effort',
      kind: 'select',
      choices: [
        { value: '', label: "Agent's default" },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'xhigh', label: 'Extra high (xhigh)' },
        { value: 'max', label: 'Max' },
      ],
      flags: ['model_reasoning_effort'],
      configFlag: '-c',
      help: 'Lower is quicker and cheaper, higher is slower and more careful.',
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names an effort level, and that wins.`,
    },
  ],

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
