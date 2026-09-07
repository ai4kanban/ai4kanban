import { join } from 'node:path'
import { createOpencodeStreamRenderer } from '../wire'
import { home, modelsIn, obj } from './models'
import { namesFlag, SKILL_SENTENCE, type Harness } from './types'

// The two flags every `opencode run` wants, added only when the user's own `command` hasn't
// already named them. `--format json` gives the JSONL stream opencode-stream.ts renders —
// without it OpenCode prints a transcript styled for a terminal, and no session id would
// ever arrive.
//
// `--dir <dir>` is the folder it works in, and OpenCode is the connector that made this
// necessary — see WORKING FOLDER in ./types. Not added under `--attach`: that points the run
// at a server somewhere else, where `--dir` means a path on THAT machine and a local one
// would be a folder it hasn't got.
//
// Nothing about permissions. Left alone OpenCode writes inside the repo and refuses to
// touch anything outside it, which is what a board run wants, so there is nothing here to
// widen or narrow. The flag that would is `--auto`, and it is deliberately not added: it
// auto-approves everything not explicitly denied, which is a wider run than a card asks
// for. Extra arguments reach it for anyone who wants it.
//
// Nothing about plugins either, and that one costs something. A plugin can hand the model a
// `task` tool that dispatches a subagent into the BACKGROUND, and `opencode run` ends with
// the main agent's turn — so that subagent's work is cut off (see wire/opencode-stream.ts,
// which says so in the log). `--pure` runs without plugins and makes subagents inline
// again; it is left to Extra arguments, because turning off the user's whole OpenCode setup
// is not the board's call to make for them.
function opencodeExtraArgs(argv: string[], cwd: string): string[] {
  const extra: string[] = []
  if (!namesFlag(argv, ['--format'])) extra.push('--format', 'json')
  if (cwd && !namesFlag(argv, ['--dir', '--attach'])) extra.push('--dir', cwd)
  return extra
}

export const OPENCODE: Harness = {
  name: 'opencode',
  label: 'OpenCode',
  icon: '/agents/opencode.svg',
  command: 'opencode run --format json',

  extraArgs(argv, _sessionId, cwd) {
    return opencodeExtraArgs(argv, cwd)
  },

  resumes: true,

  // `opencode run --session <id> "<prompt>"` sends one more turn into an existing session.
  // The folder goes on this one too: a session is stored under the folder it was opened in,
  // so a resume that names a different one finds nothing to carry on.
  resumeArgs(argv, resumeId, cwd) {
    return [...opencodeExtraArgs(argv, cwd), '--session', resumeId]
  },

  // What OpenCode takes. A model — `provider/model`, because OpenCode reaches every
  // provider and the name alone wouldn't say which — and the level the model thinks at.
  //
  // No key box. OpenCode talks to any provider and each has its own key, so one box would
  // be the wrong key for most people. Its runs use whatever `opencode auth login` saved.
  settings: [
    {
      key: 'model',
      agentOwned: true,
      label: 'Model',
      kind: 'text',
      placeholder: 'anthropic/claude-opus-5',
      // `models()` below fills the list under it; free text is what it stays.
      flags: ['--model', '-m'],
      help: "Written as provider/model. Empty runs the agent's default. A wrong id fails the run; the log says why.",
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model, and that wins.`,
    },
    // A box rather than a list, unlike Claude Code's. Its levels are Claude Code's own
    // vocabulary and can't go stale; these are the provider's, and they differ per
    // provider — so a list written here would be wrong for somebody's model the day it
    // shipped.
    {
      key: 'variant',
      agentOwned: true,
      label: 'Reasoning effort',
      kind: 'text',
      placeholder: 'high',
      flags: ['--variant'],
      help: 'Your provider\'s own level, e.g. minimal, high, max. Empty lets the model think however it thinks.',
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a variant, and that wins.`,
    },
  ],

  // OpenCode caches the whole models.dev catalogue — two hundred-odd providers, thousands of
  // models, nearly all of them unreachable from this machine. What is offered is cut down to
  // the providers `opencode auth login` has saved a login for, which is the same cut
  // OpenCode's own picker makes, and each id is qualified the way `--model` takes it.
  models() {
    const cache = process.env.XDG_CACHE_HOME || home('.cache')
    const data = process.env.XDG_DATA_HOME || home('.local', 'share')
    const mine = modelsIn(join(data, 'opencode', 'auth.json'), (auth) => Object.keys(obj(auth)))
    if (!mine.length) return []
    return modelsIn(
      join(cache, 'opencode', 'models.json'),
      (catalogue) =>
        mine.flatMap((provider) =>
          Object.keys(obj(obj(obj(catalogue)[provider]).models)).map((model) => `${provider}/${model}`),
        ),
      mine.join(' '),
    )
  },

  env: () => ({ ...process.env }),

  // Each step reports what it cost and what it spent; the model comes from the session
  // afterwards, because no event carries one (agent/wire/opencode-session.ts).
  //
  // A blank cost is a real answer, not a gap. OpenCode prices a step off the models.dev
  // catalogue, which rates a Coding Plan's models at zero — a plan is a quota rather than a
  // per-token bill. Every GLM model that IS billed per token is priced there already, under
  // the provider billing for it, so the board keeps no rates of its own for them.
  reports: ['cost', 'tokens', 'model'],

  // OpenCode retries a 429 itself — five times, backing off to about a minute in all — and
  // then ends the run non-zero. No flag or variable turns that off, so the card is held for
  // that minute the way Kimi's is, which is what `false` says here.
  stopsOnRateLimit: false,

  renderer: createOpencodeStreamRenderer,

  // OpenCode names its own session; the id rides on every event and the record saves it
  // from the first one. There is no pinning it up front the way Claude Code's
  // `--session-id` does: `--session` continues a session that already exists and answers an
  // id of our own with "Session not found".
  adoptsSessionId: false,

  // But the session is already on disk by then, so the recorded id is enough. Proved on
  // opencode 1.18.20 the way ./types asks: the first event of a run is `step_start`,
  // emitted at session open before the model has said anything, and killing the command
  // there still leaves a session a fresh `opencode run --session <id>` carries on. A run
  // that failed at its very first model call resumes the same way.
  savesSessionAtOpen: true,

  // `opencode run --file=<FILE>` attaches one file to the message, repeated per file. The
  // `=` is not a style choice: `--file` takes an ARRAY, and spelt as two tokens it would
  // swallow the prompt that follows it as a second file.
  images: { as: 'args', args: (file) => [`--file=${file}`] },

  // OpenCode has no slash or `$` skill syntax in a sent message — its slash menu is the
  // TUI's own, and `opencode run` takes a command as `--command` rather than off the front
  // of the prompt — so the prompt asks for the skill in a sentence. It scans
  // `.agents/skills/` and `.claude/skills/` at both the home and project tiers, which is
  // where an install already writes, so its model finds the board's rules by itself.
  skillCall: SKILL_SENTENCE,

  // `opencode auth list` ends on a count of what `opencode auth login` has saved — "0
  // credentials" or "2 credentials" — and exits 0 either way. The count is what is read: the
  // rest of the list is box-drawing and colour, and the provider names in it are the user's,
  // not something a reading could be written against.
  login: {
    args: ['auth', 'list'],
    ready: (out) => /\b[1-9]\d*\s+credentials?\b/.test(out),
    loggedOut: (out) => /\b0\s+credentials\b/.test(out),
    login: 'opencode auth login',
  },

  install: 'curl -fsSL https://opencode.ai/install | bash',
}
