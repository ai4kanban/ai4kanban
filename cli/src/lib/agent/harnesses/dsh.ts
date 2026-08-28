import fs from 'node:fs'
import path from 'node:path'

import { createAcpClient } from '../acp'
import { namesFlag, SKILL_SENTENCE, type Harness } from './types'

// The folder `dsh-acp` was installed into, so the dsh it boots is the one sitting beside
// it.
//
// `dsh-acp` finds a dsh to run in this order: `--dsh-path`, the directory the run starts
// in, then a `dsh` on the PATH. On a machine that has dsh installed as well — which is
// most machines that want this agent — the PATH wins, and dsh then loads from a different
// folder than the bridge's own code does. Two copies of the same plugin system are live at
// once, they don't recognise each other's sessions, and every run dies as it opens with
// `agent-presets: refusing to compose an unscoped context`. Naming the bridge's own folder
// pins both halves to one copy: the dsh its install already put beside it, which is the
// version it was built against.
//
// Undefined when the binary isn't where the PATH says — the flag is then left off and
// dsh-acp looks for a dsh exactly as it did before.
function dshHome(argv: string[]): string | undefined {
  const binary = argv[0]
  if (!binary) return undefined
  const candidates = binary.includes('/') || binary.includes('\\')
    ? [binary]
    : (process.env.PATH ?? '')
        .split(path.delimiter)
        .filter(Boolean)
        .map((dir) => path.join(dir, binary))
  let dir: string
  try {
    const found = candidates.find((candidate) => fs.existsSync(candidate))
    if (!found) return undefined
    dir = path.dirname(fs.realpathSync(found))
  } catch {
    return undefined
  }
  // Up from wherever the entry file sits to the package root — the folder holding the
  // `node_modules` the bridge's own dsh was installed into.
  for (let up = path.dirname(dir); dir !== up; up = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir
    dir = up
  }
  return undefined
}

// What every `dsh-acp` run wants, added only when the user's own `command` hasn't already
// named it.
//
// `--permission-mode workspace-write` is the whole of what a dsh run may do, and it is
// what the command starts at anyway — named here so a `settings.yaml` on this machine
// can't quietly widen a board run. Under it the agent writes inside the project without
// stopping to ask, and anything further raises a question the board answers with no (see
// `decide` in agent/acp.ts). `--permission-mode danger-full-access` in a hand-written
// command is someone choosing otherwise, and nothing is added on top.
//
// Nothing about streaming or about a session id: an ACP command streams by nature, and its
// session is opened in the conversation rather than on the command line.
function dshExtraArgs(argv: string[]): string[] {
  const args = namesFlag(argv, ['--permission-mode'])
    ? []
    : ['--permission-mode', 'workspace-write']
  if (!namesFlag(argv, ['--dsh-path'])) {
    const home = dshHome(argv)
    if (home) args.push('--dsh-path', home)
  }
  return args
}

// DeepSeek Harness, reached through ACP (#225).
//
// dsh's own headless command says nothing until it is finished and can't carry on an
// earlier run, so the board doesn't use it. It speaks ACP instead, and `dsh-acp` — the
// community bridge — is the command that answers: it streams the agent's text, thinking
// and tool calls as they are written, and reopens an earlier session with its history. It
// reads and writes dsh's own `$DSH_HOME`, so the key and the sessions are the ones dsh
// already has.
export const DSH: Harness = {
  name: 'dsh',
  // What the command is called. The full name wrapped to two lines in the harness
  // grid, making one card taller than the five beside it.
  label: 'DSH',
  icon: '/agents/dsh.svg',
  command: 'dsh-acp --permission-mode workspace-write',

  extraArgs(argv) {
    return dshExtraArgs(argv)
  },

  resumes: true,

  // Nothing changes on the command line for a resumed run: which conversation to carry on
  // is said inside it, as `session/load` (agent/acp.ts).
  resumeArgs(argv) {
    return dshExtraArgs(argv)
  },

  // What dsh takes: a model, and the DeepSeek key. Both boxes can stay empty — someone
  // already set up with dsh has a key in `$DSH_HOME` and a model in their own settings,
  // and a board run uses exactly what `dsh web` would.
  settings: [
    // Free text, for the same reason the others' are: model ids change between releases
    // and a stale list would block one the agent already runs. It carries no flag — an
    // ACP session picks its model once it is open, so this reaches the run inside the
    // conversation instead (agent/acp.ts).
    {
      key: 'model',
      label: 'Model',
      kind: 'text',
      placeholder: 'deepseek-v4-flash',
      help: "Chosen as the run's session opens. Empty runs the agent's default. A wrong id fails the run; the log says why.",
    },
    {
      key: 'apiKey',
      label: 'DeepSeek API key',
      kind: 'secret',
      env: 'DEEPSEEK_API_KEY',
      placeholder: 'sk-…',
      help: 'Optional — empty uses the key dsh itself saved. Saved to docs/kanban/.env, never shown back.',
    },
  ],

  env: () => ({ ...process.env }),

  // ACP carries all three in the conversation itself (agent/acp.ts), so a dsh run shows a
  // price, its tokens and the model the session opened on.
  reports: ['cost', 'tokens', 'model'],

  stopsOnRateLimit: false,

  client: (values) => createAcpClient({ model: values.model }),

  // The conversation names its own session, on the first thing it answers, and the record
  // saves the id there — so a run that dies a minute later can still be picked up.
  adoptsSessionId: false,

  // dsh has no slash or `$` skill syntax a headless run can use, so the prompt asks for the
  // skill in a sentence. It reads `.agents/skills/`, the folder an install already writes.
  skillCall: SKILL_SENTENCE,

  // Two packages: the agent, and the bridge that makes it answer. They are asked for one
  // at a time on purpose — npm hands everything named in one command its own folder, and
  // the bridge would come out with no dsh underneath it at all, dying on its first import.
  // Installed in turn, the bridge brings the dsh it was built against along with it.
  install:
    'npm install -g @deepseek-ai/dsh && npm install -g @openma/deepseek-harness-acp',
}
