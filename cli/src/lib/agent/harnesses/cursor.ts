import { createCursorStreamRenderer } from '../cursor-stream'
import { namesFlag, SKILL_SENTENCE, type Harness } from './types'

// What every `cursor-agent` run wants, added only when the user's own `command` hasn't
// already named it.
//
// `-p` is what makes it headless at all: without it the CLI opens its interactive chat and
// a board run would sit there forever.
//
// `--output-format stream-json` gives the NDJSON cursor-stream.ts renders. In its default
// text mode `cursor-agent -p` prints one blob when the run ends, so the live tail would
// stay empty the whole time and no session id would ever arrive.
//
// `--force` lets it run its tools without stopping to ask. A headless run has nobody to
// answer the question, and Cursor's own answer to an unanswered prompt is to refuse — so
// without this a board run would end having changed nothing. Its own docs name this flag
// for exactly this case. A command that names `--yolo` (the same thing) or
// `--auto-review` has chosen its own answer and nothing is added on top.
//
// Nothing about the working folder: Cursor honours the cwd it is spawned with (probed the
// way WORKING FOLDER in ./types describes), so its `--workspace` would only repeat it.
function cursorExtraArgs(argv: string[]): string[] {
  const extra: string[] = []
  if (!namesFlag(argv, ['-p', '--print'])) extra.push('-p')
  if (!namesFlag(argv, ['--output-format'])) extra.push('--output-format', 'stream-json')
  if (!namesFlag(argv, ['-f', '--force', '--yolo', '--auto-review'])) extra.push('--force')
  return extra
}

export const CURSOR: Harness = {
  name: 'cursor',
  label: 'Cursor',
  icon: '/agents/cursor.svg',
  command: 'cursor-agent -p --output-format stream-json --force',

  // Nothing to pin: Cursor mints its own session id and takes none from us, so the
  // generated session id is ignored here and the id arrives on the run's first event.
  extraArgs(argv) {
    return cursorExtraArgs(argv)
  },

  resumes: true,

  // `cursor-agent --resume <id> "<prompt>"` sends one more turn into an existing chat.
  // `--resume` is a flag whose value is optional — left bare it would open a picker — so
  // the id is always passed with it.
  resumeArgs(argv, resumeId) {
    return [...cursorExtraArgs(argv), '--resume', resumeId]
  },

  // What Cursor takes: a model, free text for the same reason the others' are, and one
  // optional key. Cursor carries its reasoning level inside the model id rather than in a
  // flag of its own (`claude-opus-4-8[effort=high]`), so there is no separate box for it.
  settings: [
    {
      key: 'model',
      label: 'Model',
      kind: 'text',
      placeholder: 'sonnet-4-thinking',
      flags: ['--model'],
      help: "Empty runs the agent's default. A wrong id fails the run; the log says why.",
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model, and that wins.`,
    },
    {
      key: 'apiKey',
      label: 'Cursor API key',
      kind: 'secret',
      env: 'CURSOR_API_KEY',
      placeholder: 'key_…',
      help: "Optional — empty uses your cursor-agent CLI's own login. Saved to docs/kanban/.env, never shown back.",
    },
  ],

  env: () => ({ ...process.env }),

  // Its events name the model and count nothing — no price, no tokens.
  reports: ['model'],

  stopsOnRateLimit: false,

  renderer: createCursorStreamRenderer,

  // Cursor names its own session, so our session id is only ever the board's key for the
  // run. The real resume id rides on every event and the record saves it from the first.
  adoptsSessionId: false,

  // Cursor's short skill names are documented for its chat box, not for a headless run, so
  // the prompt asks for the skill in a sentence.
  skillCall: SKILL_SENTENCE,

  // The one agent that doesn't come from npm.
  install: 'curl https://cursor.com/install -fsS | bash',
}
