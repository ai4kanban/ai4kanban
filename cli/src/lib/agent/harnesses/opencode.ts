import { join } from 'node:path'
import { createAcpClient } from '../wire'
import { home, modelsIn, obj } from './models'
import { MCP_CONFIG, SKILL_SENTENCE, type Harness } from './types'

// OpenCode, reached through ACP: `opencode acp` holds the conversation over stdin and stdout,
// driven by the same wire/acp.ts client dsh and grok run on. The session is opened with the
// project as its `cwd`, which is where OpenCode works and where it stores the session.
//
// Nothing about permissions: OpenCode writes inside the project and runs its commands without
// asking, and refuses what lies outside it.
//
// Proved by hand against opencode 1.18.30 on 2026-10-26: `session/load` reopens a session by
// id, plans arrive as `todowrite` tool calls, and `usage_update` carries the context window and
// the session's price.
export const OPENCODE: Harness = {
  name: 'opencode',
  label: 'OpenCode',
  icon: '/agents/opencode.svg',
  command: 'opencode acp',
  formerCommands: ['opencode run --format json'],

  // Nothing, ever: what a harness returns here is appended after `acp`, which rejects it.
  extraArgs() {
    return []
  },

  resumes: true,

  // Which conversation to carry on is said inside it, as `session/load`.
  resumeArgs() {
    return []
  },

  // No key box: OpenCode talks to any provider and each has its own key, so one box would be
  // the wrong key for most people. Its runs use whatever `opencode auth login` saved.
  settings: [
    {
      key: 'model',
      agentOwned: true,
      label: 'Model',
      kind: 'text',
      placeholder: 'anthropic/claude-opus-5',
      help: "Written as provider/model, and chosen as the run's session opens. Empty runs the agent's default. A wrong id fails the run; the log says why.",
    },
    MCP_CONFIG,
  ],

  // OpenCode caches the whole models.dev catalogue — two hundred-odd providers, thousands of
  // models, nearly all of them unreachable from this machine. What is offered is cut down to
  // the providers `opencode auth login` has saved a login for, which is the same cut
  // OpenCode's own picker makes, and each id is qualified the way the session takes it.
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

  // All four come out of the conversation (agent/wire/acp.ts). A blank cost is a real answer:
  // OpenCode prices off the models.dev catalogue, which rates free and plan models at zero.
  reports: ['cost', 'tokens', 'model', 'context'],

  // OpenCode retries a 429 itself and no switch turns that off, so the card is held meanwhile.
  stopsOnRateLimit: false,

  client: (values) => createAcpClient({ model: values.model, mcpConfig: values.mcpConfig }),

  adoptsSessionId: false,

  // Killed right after `session/new`, a fresh `opencode acp` reopens the id.
  savesSessionAtOpen: true,

  // Its own file reading opens a picture from a path written into the words.
  images: { as: 'message' },

  // No slash or `$` skill syntax in a sent message, so the prompt asks for the skill in a
  // sentence. It scans `.agents/skills/` and `.claude/skills/`, where an install writes.
  skillCall: SKILL_SENTENCE,

  // No login probe: OpenCode's free models need no sign-in, so a machine with no saved
  // credential is not logged out.

  install: 'curl -fsSL https://opencode.ai/install | bash',
}
