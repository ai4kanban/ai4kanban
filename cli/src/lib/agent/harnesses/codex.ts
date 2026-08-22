import { createCodexStreamRenderer } from '../codex-stream'
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
// board run writes files. It is also the whole of what a Codex run may do: inside the
// repo, no network, and it refuses to start outside a git repo. Someone who needs more
// widens it in that agent's `command`. `--full-auto` is deprecated in current Codex (it
// warns and points here), so it is never used — but a command that names it, or the bypass
// flag, counts as a sandbox already chosen and nothing is added on top.
function codexExtraArgs(argv: string[]): string[] {
  const extra: string[] = []
  if (!namesFlag(argv, ['--json', '--experimental-json'])) extra.push('--json')
  const sandboxFlags = ['--sandbox', '-s', '--full-auto', '--dangerously-bypass-approvals-and-sandbox']
  if (!namesFlag(argv, sandboxFlags)) extra.push('--sandbox', 'workspace-write')
  return extra
}

export const CODEX: Harness = {
  name: 'codex',
  label: 'Codex',
  icon: '/agents/codex.svg',
  command: 'codex exec --json --sandbox workspace-write',

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

  // What Codex takes. A model, free text for the same reason Claude Code's is — ids change
  // between releases and a stale list would block one the agent already runs — and one
  // optional key. No reasoning level: Codex names its own.
  settings: [
    {
      key: 'model',
      label: 'Model',
      kind: 'text',
      placeholder: 'gpt-5.1-codex',
      flags: ['--model', '-m'],
      help: "Empty runs the agent's default. A wrong id fails the run; the log says why.",
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model, and that wins.`,
    },
    {
      key: 'apiKey',
      label: 'OpenAI API key',
      kind: 'secret',
      env: 'OPENAI_API_KEY',
      placeholder: 'sk-…',
      help: 'Optional — empty uses your codex CLI\'s own login. Saved to docs/kanban/.env, never shown back.',
    },
  ],

  // Nothing extra. Claude Code gets CLAUDE_CODE_MAX_RETRIES=0 so a rate limit fails at
  // once and frees the card; Codex has no equivalent switch, so a rate-limited Codex run
  // waits it out and holds the card while it does. Better that than a made-up variable.
  env: () => ({ ...process.env }),

  // A completed turn carries its token counts and nothing else: Codex prices nothing, and
  // its event stream never names the model.
  reports: ['tokens'],

  stopsOnRateLimit: false,

  renderer: createCodexStreamRenderer,

  // Codex re-reads its model list on a timer and traces the attempt to stderr every time,
  // whether it worked or not. On a codex whose cached list is a version out of date that is
  // a line per turn, all of it identical, none of it about the run — a 2-minute run's log
  // came back more housekeeping than work. The list it failed to refresh is not one the
  // board uses: a run's model comes from the settings or the CLI's own default.
  //
  // Only this one module is dropped. Codex's network, sandbox and MCP failures all trace
  // the same way and all stay — a websocket that keeps resetting is the answer to why a run
  // died, and it reads as noise right up until it is the only thing that matters.
  quietStderr: (line) => line.includes('codex_models_manager::'),

  // Codex names its own thread, so our session id is only ever the board's key for the
  // run. The real resume id lands on the first event and the record saves it there.
  adoptsSessionId: false,

  // Codex ignores a slash name — it reads as plain chat text — and triggers a skill from a
  // `$` name. The install already writes the skill to `.agents/skills/kanban/`, which is
  // where Codex looks.
  skillCall: '$kanban',

  install: 'npm install -g @openai/codex',
}
