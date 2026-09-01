import { createOpencodeStreamRenderer } from '../wire'
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
      label: 'Model',
      kind: 'text',
      placeholder: 'anthropic/claude-opus-5',
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
      label: 'Reasoning effort',
      kind: 'text',
      placeholder: 'high',
      flags: ['--variant'],
      help: 'Your provider\'s own level, e.g. minimal, high, max. Empty lets the model think however it thinks.',
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a variant, and that wins.`,
    },
  ],

  env: () => ({ ...process.env }),

  // Each step reports what it cost and what it spent. The model is named only in the
  // formatted output the board doesn't read, so a run under it names none.
  reports: ['cost', 'tokens'],

  stopsOnRateLimit: false,

  renderer: createOpencodeStreamRenderer,

  // OpenCode names its own session; the id rides on every event and the record saves it
  // from the first one.
  adoptsSessionId: false,

  // OpenCode has no slash or `$` skill syntax at all — its model picks a skill itself — so
  // the prompt asks for the skill in a sentence.
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
