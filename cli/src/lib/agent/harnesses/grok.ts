import { createAcpClient } from '../wire'
import { SKILL_SENTENCE, type Harness } from './types'

// The fence a Grok run works behind, and the only place it can be said.
//
// `--sandbox <PROFILE>` is a top-level `grok` option that `grok agent` rejects, so the
// board sets its environment twin instead. `workspace` is Grok's own profile for everyday
// work — reads anywhere, writes in the working folder, `~/.grok/` and temp — against a
// default of `off`, which is no sandbox at all. It is the same fence Codex's
// `workspace-write` draws.
//
// An export the user made themselves is left alone: that is someone choosing another
// profile deliberately, and it is the only way to choose one, since the flag cannot be
// spelled on this command line.
function grokEnv(): NodeJS.ProcessEnv {
  return { ...process.env, GROK_SANDBOX: process.env.GROK_SANDBOX || 'workspace' }
}

// Grok Build, xAI's coding agent, reached through ACP (#378).
//
// Its headless mode spells the prompt `-p, --single <PROMPT>` — the value has to sit next
// to the flag, and a spawned run appends the prompt as the LAST argv entry
// (agent/watch.ts), which cannot produce that. So the board takes the other way in that
// xAI documents: `grok agent stdio`, Grok as an ACP agent over JSON-RPC on stdin and
// stdout, driven by the same wire/acp.ts client dsh runs on. The stream and the session id
// both come out of the conversation, so no renderer is written for this one.
//
// `--always-approve` is what makes a card finish unattended. Grok's permission mode
// defaults to asking, which on ACP means a `session/request_permission` per tool call — and
// the board's client answers no to every one of those (`decide` in agent/wire/acp.ts),
// because a run has nobody at the keyboard. Without it a Grok run gets refused its own
// edits and finishes nothing. It is an option of `grok agent` and has to sit BEFORE the
// subcommand: `grok agent stdio` itself takes only `--debug`, `--debug-file` and
// `--leader-socket`, and dies on anything else with `unexpected argument`.
//
// Proved by hand against grok 1.0.13 on 2026-09-03: the session streams `session/update`
// as it works, `session/load` reopens one by id with its history, and a session opened
// with a `cwd` works in that folder rather than the caller's — so no `--cwd` is added.
// stderr stayed silent throughout, so there is no `quietStderr` either.
export const GROK: Harness = {
  name: 'grok',
  label: 'Grok Build',
  icon: '/agents/grok.svg',
  command: 'grok agent --always-approve stdio',

  // Nothing, ever. Every flag this command takes belongs before `stdio`, and what a
  // harness returns here is APPENDED (agent/resolve.ts) — after the subcommand, where
  // `grok agent stdio` rejects it and the run never starts. A user who needs another flag
  // writes the whole command in `command`.
  extraArgs() {
    return []
  },

  resumes: true,

  // Nothing changes on the command line for a resumed run either: which conversation to
  // carry on is said inside it, as `session/load` (agent/wire/acp.ts). Grok's headless
  // `--resume` and `--continue` are that mode's own flags and mean nothing here.
  resumeArgs() {
    return []
  },

  // What Grok takes: a model, and the xAI key. Both boxes can stay empty — someone already
  // set up with grok has a login in `~/.grok` and a default model in its own
  // `~/.grok/config.toml`, and a board run uses exactly what `grok` would.
  settings: [
    // Free text, for the same reason the others' are: model ids change between releases and
    // a stale list would block one the agent already runs. It carries no flag — grok's own
    // `-m` sits BEFORE the subcommand and `extraArgs` is appended after it — so this reaches
    // the run inside the conversation instead, as ACP's `session/set_model` on the session it
    // just opened (agent/wire/acp.ts).
    {
      key: 'model',
      label: 'Model',
      kind: 'text',
      placeholder: 'grok-4.6',
      help: "Chosen as the run's session opens. Empty runs the model Grok is set to. A wrong id fails the run; the log says why.",
    },
    // Grok's own order, not the board's: a session token from `grok login` outranks this
    // key, so on a machine that has logged in the box changes nothing until that login is
    // dropped. It is the way in for a machine with no browser.
    {
      key: 'apiKey',
      label: 'xAI API key',
      kind: 'secret',
      env: 'XAI_API_KEY',
      placeholder: 'xai-…',
      help: 'Used when `grok login` has not been run — a saved login outranks it. Saved to docs/kanban/.env (kept out of git), never shown back.',
    },
  ],

  // Everything that could send a Grok run to a provider the user didn't pick: where the
  // requests go, the second name the key answers to, and the three that decide who issues
  // the session token a request is signed with.
  //
  // A `~/.grok/auth.json` written by `grok login` is not reachable from here — it is a
  // file, not a variable — so an empty key box runs on that login by design.
  providerEnv: [
    'GROK_CLI_CHAT_PROXY_BASE_URL',
    'GROK_CODE_XAI_API_KEY',
    'GROK_AUTH_PROVIDER_COMMAND',
    'GROK_OIDC_ISSUER',
    'GROK_OIDC_CLIENT_ID',
  ],

  env: grokEnv,

  // All three come out of the conversation (agent/wire/acp.ts): the model off the session
  // Grok opens, and the tokens and the price off `_meta.usage` on the reply to the prompt —
  // `costUsdTicks`, xAI's exact integer dollars. The price is absent rather than zero when
  // the server's own cost was partial, so a run can show tokens and no money.
  reports: ['cost', 'tokens', 'model'],

  // No documented switch that turns off retrying a 429, so a rate-limited run waits it out
  // and holds its card while it does — the same as Codex and ZCode. Better that than a
  // made-up variable.
  stopsOnRateLimit: false,

  client: (values) => createAcpClient({ model: values.model }),

  // The conversation names its own session, in the answer to the first thing we ask, and
  // the record saves the id there — so a run that dies a minute later can still be picked
  // up.
  adoptsSessionId: false,

  // Grok lists its skills as slash names, but a slash typed into an ACP `session/prompt` is
  // not the same thing as one typed into its TUI, and the sentence is proved: asked this
  // way, grok found `.agents/skills/kanban/SKILL.md` in the project and read it.
  skillCall: SKILL_SENTENCE,

  install: 'curl -fsSL https://x.ai/cli/install.sh | bash',
}
