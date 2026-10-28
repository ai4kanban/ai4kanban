import { createAcpClient } from '../wire'
import { MCP_CONFIG, SKILL_SENTENCE, type Harness } from './types'

// Cursor, reached through ACP: `cursor-agent acp` holds the conversation over stdin and stdout,
// driven by the same wire/acp.ts client dsh and grok run on.
//
// `--force` lets it run its tools without asking. Without it every command outside Cursor's
// allowlist raises a permission request, the board's client answers no, and the run finishes
// nothing. It has to sit BEFORE `acp`, which takes no options of its own.
//
// Proved by hand against cursor-agent 2026.10.01 on 2026-10-26: `session/load` reopens a session
// by id, plans arrive as `cursor/update_todos` requests, and a turn reports no usage.
export const CURSOR: Harness = {
  name: 'cursor',
  label: 'Cursor',
  icon: '/agents/cursor.svg',
  command: 'cursor-agent --force acp',
  formerCommands: ['cursor-agent -p --output-format stream-json --force'],

  // Nothing, ever: what a harness returns here is appended after `acp`, which rejects it.
  extraArgs() {
    return []
  },

  resumes: true,

  // Which conversation to carry on is said inside it, as `session/load`.
  resumeArgs() {
    return []
  },

  settings: [
    {
      // No `models()`: cursor-agent keeps no list of its models on disk, and its `models`
      // command's ids are not the ones ACP takes.
      key: 'model',
      agentOwned: true,
      label: 'Model',
      kind: 'text',
      placeholder: 'gpt-5.5',
      help: "Chosen as the run's session opens, and saved as cursor-agent's own default. Empty runs Auto. A wrong id fails the run; the log says why.",
    },
    {
      key: 'apiKey',
      label: 'Cursor API key',
      kind: 'secret',
      env: 'CURSOR_API_KEY',
      placeholder: 'key_…',
      help: "Optional — empty uses your cursor-agent CLI's own login. Stored on this computer, never shown back.",
    },
    MCP_CONFIG,
  ],

  env: () => ({ ...process.env }),

  // The session names its model; a turn counts nothing — no price, no tokens.
  reports: ['model'],

  stopsOnRateLimit: false,

  client: (values) => createAcpClient({ model: values.model, mcpConfig: values.mcpConfig }),

  adoptsSessionId: false,

  // Not before the first prompt: killed right after `session/new`, a fresh `cursor-agent acp`
  // answers `session/load` with "Session not found".
  savesSessionAtOpen: false,

  // Its own file reading opens a picture from a path written into the words.
  images: { as: 'message' },

  skillCall: SKILL_SENTENCE,

  // `cursor-agent status` exits 0 whether or not anybody is signed in, so its output is the
  // whole of the answer.
  login: {
    args: ['status', '--format', 'json'],
    ready: (out) => /"isAuthenticated"\s*:\s*true/.test(out),
    loggedOut: (out) => /"isAuthenticated"\s*:\s*false/.test(out),
    login: 'cursor-agent login',
  },

  install: 'curl https://cursor.com/install -fsS | bash',
}
