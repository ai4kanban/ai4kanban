// The agents the board can run, and everything that differs between two of them.
//
// A harness is one way to run an agent, and all of it lives behind this interface: the
// command, the flags that make it stream, the env it needs, how its output is parsed, how
// a finished session is resumed, the settings it takes, and how it is offered to a front
// end. Adding an agent is adding one object to HARNESSES — nothing outside this file
// learns its name.

import fs from 'node:fs'
import path from 'node:path'

import { createAcpClient } from './acp'
import type { RunClient } from './client'
import { createCodexStreamRenderer } from './codex-stream'
import { createCursorStreamRenderer } from './cursor-stream'
import { createOpencodeStreamRenderer } from './opencode-stream'
import { createStreamRenderer, type StreamRenderer } from './stream'
import type { HarnessOption, HarnessSetting } from './types'
import { createZcodeClient } from './zcode'

// A harness declares everything about itself but the three things it is never asked
// directly. Two only this machine can answer — whether its CLI is here, and which binary
// was looked for — and are worked out per read, against the PATH and the user's own
// `command` override (agent/installed.ts). The third is `gaps`, which is a reading of the
// fields below rather than a claim of its own (agent/capabilities.ts): a connector says what
// it does, and what it lacks follows. All three are joined on in `agentInfo`.
export interface Harness extends Omit<HarnessOption, 'binary' | 'installed' | 'gaps'> {
  /** The flags to append to the configured argv. `argv` is what the user's command
   *  already carries, so a harness never overrides a flag the user set by hand.
   *  `sessionId` is the id we generated up front — a harness that can't pin an id
   *  ignores it. */
  extraArgs(argv: string[], sessionId: string): string[]
  /** True when this harness's CLI can pick an earlier conversation back up. A failed
   *  run offers Resume only then, and it is also the whole of what a chat needs: a
   *  conversation is a second message into the session the agent already opened, so an
   *  agent that can't do this is the one a chat turns away (agent/chat.ts). */
  resumes: boolean
  /** The flags that continue the conversation `resumeId` names, instead of starting a
   *  fresh one. Stands in for `extraArgs` on a resumed run — the two are never both
   *  appended, because pinning a new session id and resuming an old one are
   *  contradictory instructions. Only called when `resumes`. */
  resumeArgs(argv: string[], resumeId: string): string[]
  /** The settings this harness takes, in the order a dialog draws them. This list is the
   *  whole of its configuration: a run appends the ones that carry a flag, and the file
   *  keeps them in this harness's own block under `harnessSettings`. */
  settings: HarnessSetting[]
  /** Every variable that could send this connector to a provider the user didn't pick.
   *  All of them are dropped from a run's environment, and then the picked provider sets
   *  the ones it needs — so what the settings say is where the run goes, and an export
   *  the user forgot about years ago can't say otherwise.
   *
   *  It covers providers the board doesn't offer yet, not only the ones on the list: a
   *  leftover Bedrock or Vertex switch would send a "Claude subscription" run somewhere
   *  else just as surely as a base URL would. The variables the connector's own provider
   *  settings name are dropped too, without being repeated here.
   *
   *  A connector that declares no provider list has nothing to drop for, so it leaves
   *  this out and its runs inherit the environment as they find it. */
  providerEnv?: string[]
  /** The environment the child runs under, on top of the one this process has. */
  env(): NodeJS.ProcessEnv
  /** Parses this harness's stdout into readable log lines + a final message. Left out by
   *  a harness that declares a `client` instead: then stdout is a protocol, not a log. */
  renderer?(): StreamRenderer
  /** True for a stderr line that is this CLI's own housekeeping — chatter about its caches
   *  and background refreshes, printed on nearly every turn, that says nothing about the
   *  work and nothing a user could act on.
   *
   *  Kept deliberately narrow. A run's log is the only account of what happened, so the
   *  rule is: drop a line only when knowing it would change nothing. Anything about the
   *  model, the network, the sandbox or a tool the agent couldn't reach stays, however
   *  often it repeats — a log that hides the one line explaining a failure is worse than
   *  a noisy one. */
  quietStderr?(line: string): boolean
  /** The client that holds the conversation, for a command that answers back rather than
   *  printing a report and exiting (agent/client.ts). A harness declares this OR a
   *  `renderer`, never both — a command either talks or it prints.
   *
   *  It is handed the settings this harness is set to, because what a conversation opens
   *  with is part of the conversation: an ACP agent picks its model on the session it just
   *  opened, not from a flag on the command line. */
  client?(values: Record<string, string>): RunClient
  /** True when this harness adopts the session id we generate before the run starts
   *  (Claude Code takes `--session-id`), so its own resume id IS ours and is known from
   *  the first moment. False when the harness mints its own id instead — then the id
   *  arrives mid-run, out of the output stream, and the renderer reports it. */
  adoptsSessionId: boolean
  /** What this connector's own output tells the board about a finished run, beyond the work
   *  itself. Every CLI reports something different and none of it can be inferred, so it is
   *  declared: what isn't here is a number the runs panel shows nothing for, rather than one
   *  the board made up. Checked against the renderer when this module loads.
   *
   *  `cost` an estimated price, `tokens` the four token counts, `model` the id of the model
   *  that did the work. */
  reports: ('cost' | 'tokens' | 'model')[]
  /** True when a rate limit ends the run instead of waiting it out. A CLI that retries a 429
   *  by default holds its card for as long as it retries, which on a weekly limit is most of
   *  an hour — so a connector with a switch for it turns retries off in `env()` and says so
   *  here. False is not a fault: most of these CLIs have no such switch. */
  stopsOnRateLimit: boolean
  /** How a fresh prompt calls the ai4kanban skill for this agent. Claude Code triggers a
   *  skill from a slash name (`/kanban`); Codex reads a slash as plain chat text and
   *  triggers on a `$` name instead. */
  skillCall: string
}

// How a prompt asks for the skill on an agent with no direct skill syntax. A fresh chat
// ensures the skill is installed before using this sentence.
export const SKILL_SENTENCE = 'Use the kanban skill'

/** True when this argv already names a flag — `--model id` or `--model=id`, in any of the
 *  names that harness answers to. Used for a setting's flags, and by a harness deciding
 *  whether its own flags are already there. */
export function namesFlag(argv: string[], flags: string[]): boolean {
  return argv.some((tok) => flags.some((flag) => tok === flag || tok.startsWith(`${flag}=`)))
}

// `claude -p` in its default text mode prints nothing until the session ends, so a live
// tail would stay empty the whole time. Ask claude to stream NDJSON events instead
// (stream.ts renders them into log lines). Every claude run wants these — a fresh one and
// a resumed one alike.
function claudeStreamArgs(argv: string[]): string[] {
  return argv.includes('--output-format') ? [] : ['--output-format', 'stream-json', '--verbose']
}

const CLAUDE_CODE: Harness = {
  name: 'claude-code',
  label: 'Claude Code',
  icon: '/agents/claude.svg',
  command: 'claude -p',

  // Stream the events (see claudeStreamArgs), and pin the session id: `--session-id <id>`
  // makes Claude Code adopt the id we generated up front, so the record's key IS Claude
  // Code's own session id — the exact id a resume hands back to the CLI.
  extraArgs(argv, sessionId) {
    const extra = claudeStreamArgs(argv)
    if (sessionId && !argv.includes('--session-id')) extra.push('--session-id', sessionId)
    return extra
  },

  resumes: true,

  // `claude -p --resume <id> "<prompt>"` sends one more turn into an existing
  // conversation. No `--session-id` here — Claude Code refuses both at once, and without
  // `--fork-session` the resumed turn keeps running under the very id we resumed, so the
  // new run's resume id is that same id.
  resumeArgs(argv, resumeId) {
    const extra = claudeStreamArgs(argv)
    if (!argv.includes('--resume') && !argv.includes('-r')) extra.push('--resume', resumeId)
    return extra
  },

  // What Claude Code takes: who pays for the run, where that run goes, a model id, and how
  // hard that model thinks. The provider comes first because it decides the rest — which
  // of the boxes below apply at all, and the whole environment a run starts under.
  settings: [
    // Who pays for a run, and where it goes. Three entries, because these are the three
    // ways a person reaches Claude Code today: the subscription they already log into,
    // Anthropic's own API, and any gateway that answers in the Anthropic format. Bedrock,
    // Vertex and Foundry are more entries on this same list — add them when someone asks.
    //
    // "OpenAI" is deliberately not here. Claude Code speaks the Anthropic API only; an
    // OpenAI model reaches it through a gateway that answers in that format, which IS the
    // endpoint entry. A connector that speaks the OpenAI format brings its own list.
    {
      key: 'provider',
      label: 'Provider',
      kind: 'provider',
      defaultProvider: 'subscription',
      providers: [
        {
          id: 'subscription',
          label: 'Claude subscription',
          blurb: 'Runs on the login your claude CLI already has. Nothing else to fill in.',
          needs: [],
        },
        {
          id: 'anthropic-api',
          label: 'Anthropic API',
          blurb: 'Pay per token, with an Anthropic API key.',
          needs: ['apiKey'],
          // A board that saved a key before this list existed was running every run on
          // that key. It reads as this provider until the user picks otherwise —
          // defaulting it to the subscription would drop the key from every run, which is
          // the opposite of "change nothing, see no change".
          preferWhenSet: ['apiKey'],
        },
        {
          id: 'endpoint',
          label: 'Anthropic-compatible endpoint',
          blurb:
            'A gateway that answers in the Anthropic format — OpenRouter, LiteLLM, a company proxy.',
          needs: ['baseUrl', 'apiKey'],
          // The base URL is what makes this pick mean anything, so it is the one box that
          // has to be filled. The key isn't: a proxy on your own laptop often takes none.
          requires: ['baseUrl'],
          // A gateway key goes out as ANTHROPIC_AUTH_TOKEN, never as ANTHROPIC_API_KEY.
          // Claude Code treats a set ANTHROPIC_API_KEY as its own auth source and turns
          // the user's claude.ai connectors off when it sees one — so sending the key both
          // ways to suit whichever header a gateway prefers costs the user their
          // connectors on every run. This is the variable OpenRouter, LiteLLM and the rest
          // document, and the gateway reads it as `Authorization: Bearer`.
          envAs: { apiKey: 'ANTHROPIC_AUTH_TOKEN' },
          // And the other one has to be there and EMPTY, not merely unset. That is what
          // Claude Code's own gateway instructions say, and an empty value says "this run
          // has no API key of its own" in a way a missing variable doesn't.
          env: { ANTHROPIC_API_KEY: '' },
        },
      ],
    },
    // Where an endpoint run goes. Not a secret — a gateway address is not a credential —
    // so it saves beside the model in ui.config.json, and it reaches the run as the
    // variable Claude Code reads for it rather than as a flag, because its CLI has none.
    {
      key: 'baseUrl',
      label: 'Endpoint base URL',
      kind: 'text',
      env: 'ANTHROPIC_BASE_URL',
      placeholder: 'https://my-gateway.example.com',
      help: 'The address the gateway answers on.',
    },
    // The key the picked provider uses. It belongs to the box it is typed in, not to
    // whoever was picked at the time, so switching providers — or agents — never asks for
    // it again. Only a provider that needs it sees it: the subscription never does, so the
    // key never reaches that run. The variable it goes out under follows the pick.
    {
      key: 'apiKey',
      label: 'API key',
      kind: 'secret',
      env: 'ANTHROPIC_API_KEY',
      placeholder: 'sk-ant-…',
      help: 'Saved to docs/kanban/.env (kept out of git), never shown back.',
    },
    // The model is free text rather than a list — model ids change between agent releases,
    // and a stale list would block a model the agent already runs. `--model` is the one
    // flag its CLI takes for it; an override that already names that flag wins.
    {
      key: 'model',
      label: 'Model',
      kind: 'text',
      placeholder: 'claude-opus-5',
      flags: ['--model'],
      help: "Empty runs the agent's default. A wrong id fails the run; the log says why.",
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model, and that wins.`,
    },
    // How hard the model thinks. A list, not a box: unlike a model id, the levels are the
    // agent's own vocabulary — these five are exactly what Claude Code's `--effort` takes
    // — and they don't change between releases, so a list can't go stale the way a list of
    // model ids would. Another agent names its own levels, or has none.
    //
    // The first choice is empty, which drops the flag and lets the agent think however it
    // thinks by default. The board never invents a level, and never judges one either:
    // what a level means, and whether the picked model can do it, is the agent's. A level
    // Claude Code doesn't know makes it warn on stderr and run at its own default — that
    // warning lands in the run's log, where the user reads it.
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
      flags: ['--effort'],
      help: 'Lower is quicker and cheaper, higher is slower and more careful.',
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names an effort level, and that wins.`,
    },
  ],

  // Everything that could send Claude Code somewhere the pick didn't ask for. Each of
  // these is dropped from every run, and then the picked provider sets what it needs — so
  // a base URL exported months ago can't send a "Claude subscription" run through a
  // gateway while the settings say otherwise.
  //
  // It goes past the three providers on the list to the ones the board doesn't offer yet:
  // a leftover Bedrock, Vertex or Foundry switch moves a run just as surely as a base URL.
  // What is NOT here is the cloud credentials themselves — AWS_PROFILE,
  // GOOGLE_APPLICATION_CREDENTIALS and the like. They move nothing once the switch above
  // them is gone, and the agent may well need them for the work it is doing in the repo.
  providerEnv: [
    'ANTHROPIC_AUTH_TOKEN',
    // Custom headers can carry an authorization of their own, so they are a way to move a
    // run as much as a base URL is.
    'ANTHROPIC_CUSTOM_HEADERS',
    'CLAUDE_CODE_USE_BEDROCK',
    'ANTHROPIC_BEDROCK_BASE_URL',
    'CLAUDE_CODE_SKIP_BEDROCK_AUTH',
    'AWS_BEARER_TOKEN_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'ANTHROPIC_VERTEX_BASE_URL',
    'CLAUDE_CODE_SKIP_VERTEX_AUTH',
    'CLAUDE_CODE_USE_FOUNDRY',
    'ANTHROPIC_FOUNDRY_BASE_URL',
    'ANTHROPIC_FOUNDRY_API_KEY',
  ],

  // The one variable that makes a rate limit fail instead of wait.
  //
  // By default Claude Code retries a 429 (session/weekly limit, overload) with exponential
  // backoff — up to 10 attempts, each request allowed 10 minutes. In a terminal that's
  // right; here it's wrong. A rate-limited run would sit holding the card for the better
  // part of an hour before it ever reported anything. `CLAUDE_CODE_MAX_RETRIES=0` turns
  // the first 429 into an immediate non-zero exit, so the board learns at once and the
  // card is free again.
  //
  // It is NOT a spend control. Whether hitting your plan's limit spills over into paid
  // extra usage is an account setting on claude.ai (the CLI has no flag for it).
  env: () => ({ ...process.env, CLAUDE_CODE_MAX_RETRIES: '0' }),

  // Its closing event carries all three, so a run under it shows a price, its tokens and
  // the model that did the work.
  reports: ['cost', 'tokens', 'model'],

  // The variable above is the switch: the first 429 exits non-zero and the card is free.
  stopsOnRateLimit: true,

  renderer: createStreamRenderer,

  // `--session-id` above makes Claude Code run under the id we generated, so our key IS
  // its resume id — no waiting for the stream to report one.
  adoptsSessionId: true,

  // Claude Code loads a skill from its slash name.
  skillCall: '/kanban',

  install: 'npm install -g @anthropic-ai/claude-code',
}

// The two flags every `codex exec` run wants, added only when the user's own `command`
// hasn't already named them.
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

const CODEX: Harness = {
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
function cursorExtraArgs(argv: string[]): string[] {
  const extra: string[] = []
  if (!namesFlag(argv, ['-p', '--print'])) extra.push('-p')
  if (!namesFlag(argv, ['--output-format'])) extra.push('--output-format', 'stream-json')
  if (!namesFlag(argv, ['-f', '--force', '--yolo', '--auto-review'])) extra.push('--force')
  return extra
}

const CURSOR: Harness = {
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

// The one flag every `opencode run` wants, added only when the user's own `command` hasn't
// already named it. `--format json` gives the JSONL stream opencode-stream.ts renders —
// without it OpenCode prints a transcript styled for a terminal, and no session id would
// ever arrive.
//
// Nothing about permissions. Left alone OpenCode writes inside the repo and refuses to
// touch anything outside it, which is what a board run wants, so there is nothing here to
// widen or narrow. The flag that would (`--auto`) isn't in the version people install
// today: passing it makes the CLI print its usage and exit without running anything.
function opencodeExtraArgs(argv: string[]): string[] {
  return namesFlag(argv, ['--format']) ? [] : ['--format', 'json']
}

const OPENCODE: Harness = {
  name: 'opencode',
  label: 'OpenCode',
  icon: '/agents/opencode.svg',
  command: 'opencode run --format json',

  extraArgs(argv) {
    return opencodeExtraArgs(argv)
  },

  resumes: true,

  // `opencode run --session <id> "<prompt>"` sends one more turn into an existing session.
  resumeArgs(argv, resumeId) {
    return [...opencodeExtraArgs(argv), '--session', resumeId]
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

  install: 'curl -fsSL https://opencode.ai/install | bash',
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
const DSH: Harness = {
  name: 'dsh',
  label: 'DeepSeek Harness',
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

// The environment every ZCode run starts under.
//
// Two things happen here, and the first one matters more than it looks.
//
// ZCode's own Z.AI provider is an Anthropic-format one, and the key it reads for it is
// ANTHROPIC_API_KEY — the same variable Claude Code's runs use. Left alone, a ZCode run on
// a board with a Claude Code key would send that key to `api.z.ai`. So the variable is
// dropped from every ZCode run (`providerEnv`), and the Coding Plan pick below puts the
// board's own Z.ai key back under that name and nothing else does. Someone already signed
// in to ZCode keeps working: their login is in ZCode's own credential store, not here.
//
// The second is quieter: `zcode` checks npm for a newer version and prints a notice about
// it. On `app-server` that notice would land in the middle of a protocol stream.
function zcodeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ZCODE_DISABLE_UPDATE_CHECK: '1',
    NO_UPDATE_NOTIFIER: '1',
  }
}

// ZCode, Z.ai's coding agent for its own GLM models (#258).
//
// Z.ai ships no command you can run in a terminal — the agent lives inside ZCode Desktop —
// so the command the board starts is `zcode`, from the community package `zcode-app-cli`,
// which pulls that runtime out of the app and publishes it. Its `--prompt` mode prints for
// a person to read and never says which session it ran under, so the board drives
// `zcode app-server` instead: ZCode's own protocol over stdin and stdout, where the log
// arrives as it is written and a session can be picked back up (agent/zcode.ts).
const ZCODE: Harness = {
  name: 'zcode',
  label: 'ZCode',
  icon: '/agents/zcode.svg',
  command: 'zcode app-server',

  // Nothing to add and nothing to pin: `app-server` takes no flags that matter to a run.
  // The session is opened inside the conversation, and so is the model.
  extraArgs() {
    return []
  },

  resumes: true,

  // Nothing changes on the command line for a resumed run either: which conversation to
  // carry on is said inside it, as `session/resume` (agent/zcode.ts).
  resumeArgs() {
    return []
  },

  // What ZCode takes: how the run signs in, a model, and the key. Both boxes can stay
  // empty — someone already set up with ZCode has a login in its own credential store and
  // a model in its own settings, and a board run then uses exactly what `zcode` would.
  settings: [
    {
      key: 'provider',
      label: 'Sign-in',
      kind: 'provider',
      defaultProvider: 'zcode-login',
      providers: [
        {
          id: 'zcode-login',
          label: 'The login ZCode has',
          blurb: 'Runs on whatever `zcode login` or `/login` already signed you in as.',
          needs: [],
        },
        {
          id: 'coding-plan',
          label: 'Z.AI Coding Plan key',
          blurb: 'A Coding Plan key from Z.ai, or the same plan bought through BigModel.',
          needs: ['apiKey'],
          requires: ['apiKey'],
          // ZCode reads its Z.AI provider's key from ANTHROPIC_API_KEY, because that
          // provider speaks the Anthropic format. The board keeps the key under a name of
          // its own in docs/kanban/.env — sharing Claude Code's line would mean one key
          // box overwriting the other — and sends it out under the name ZCode reads.
          envAs: { apiKey: 'ANTHROPIC_API_KEY' },
          preferWhenSet: ['apiKey'],
        },
      ],
    },
    // Free text, for the same reason the others' are: model ids change between releases
    // and a stale list would block one the agent already runs. It carries no flag — ZCode
    // has none — so this reaches the run inside the conversation instead, on the session
    // it just opened (agent/zcode.ts). `zai/glm-5.3` names a provider too; a bare id uses
    // the one the session opened on.
    {
      key: 'model',
      label: 'Model',
      kind: 'text',
      placeholder: 'glm-5.3',
      help: "Chosen as the run's session opens. Empty runs the model ZCode is set to. A wrong id fails the run; the log says why.",
    },
    {
      key: 'apiKey',
      label: 'Z.AI Coding Plan key',
      kind: 'secret',
      env: 'ZAI_API_KEY',
      placeholder: 'sk-…',
      help: 'Saved to docs/kanban/.env (kept out of git), never shown back.',
    },
  ],

  // Everything that could send ZCode somewhere the sign-in pick didn't ask for. The
  // Anthropic pair is the one that matters: ZCode's Z.AI provider reads both, so a key or
  // a base URL exported for Claude Code would otherwise ride along on every ZCode run.
  providerEnv: ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ZCODE_MODEL', 'ZCODE_BASE_URL'],

  env: zcodeEnv,

  // Tokens and the model, and no price: a Coding Plan is a quota rather than a per-token
  // bill, and nothing in ZCode's protocol carries a cost. A blank is the honest answer.
  reports: ['tokens', 'model'],

  // ZCode retries a rate-limited request itself and has no setting that stops it, so a
  // limited run waits it out and holds its card while it does — the same as Codex. Better
  // that than a made-up variable.
  stopsOnRateLimit: false,

  client: (values) => createZcodeClient({ model: values.model }),

  // The conversation names its own session, in the answer to the very first thing we ask,
  // and the record saves the id there — so a run that dies a minute later can still be
  // picked up.
  adoptsSessionId: false,

  // ZCode's slash and `$` names are its terminal UI's, not something a sent prompt
  // triggers, so the prompt asks for the skill in a sentence. It reads `.agents/skills/`,
  // the folder an install already writes, and finds the board's rules there by itself.
  skillCall: SKILL_SENTENCE,

  // Not Z.ai's own package: `zcode-app-cli` is a community build that extracts the runtime
  // from ZCode Desktop, and its own README says its right to republish that runtime is
  // unconfirmed. It is the only way to a `zcode` you can run in a terminal, so it is what
  // the install line says — and the connectors guide names both that and the desktop app
  // for anyone who would rather point the command at their own copy.
  install: 'npm install -g zcode-app-cli',
}

/** Every agent the board can run, in the order they are listed. */
export const HARNESSES: Harness[] = [CLAUDE_CODE, CODEX, CURSOR, OPENCODE, DSH, ZCODE]

/** What runs when the config names no agent, or names one we don't know. */
export const DEFAULT_HARNESS = CLAUDE_CODE

export function harnessByName(name: string | undefined): Harness | undefined {
  return HARNESSES.find((h) => h.name === name)
}

// The one key a harness's own block already uses: `command`, the hand-written override for
// its binary and flags. A setting saves beside it, so a setting by that name would fight
// with it.
const RESERVED_SETTING_KEYS = ['command']

// Checked here, once, when this module loads: the list is written in this file and built
// in, so a clash is a mistake in the entry above, and the person adding a harness is the
// only one who can ever see this. Better a loud failure the moment it's added than a
// setting that quietly overwrites the override.
for (const harness of HARNESSES) {
  // A command either prints or it talks, and the runner asks this file which. Both would
  // be two readers on one stdout; neither would be a run nobody can read.
  if (!harness.renderer === !harness.client) {
    throw new Error(`harness "${harness.name}": declare a renderer for a command that prints, or a client for one that answers back — not both, and not neither`)
  }
  // `reports` is what the picker promises about this connector, and the renderer is what
  // actually delivers it. A renderer that stops reporting a cost while the list still claims
  // one would leave the picker saying nothing is missing while the runs panel shows a blank,
  // so the two are compared here rather than left to drift. Only a renderer can be checked:
  // a client reports from inside a live conversation and has nothing to ask until one is
  // open (agent/acp.ts).
  const renderer = harness.renderer?.()
  if (renderer) {
    const implemented: Record<Harness['reports'][number], boolean> = {
      cost: Boolean(renderer.costUsd),
      tokens: Boolean(renderer.usage),
      model: Boolean(renderer.model),
    }
    for (const [what, has] of Object.entries(implemented)) {
      const claimed = harness.reports.includes(what as Harness['reports'][number])
      if (claimed !== has) {
        throw new Error(`harness "${harness.name}": its "reports" ${claimed ? 'claims' : 'omits'} ${what}, but its renderer ${has ? 'does' : "doesn't"} report one`)
      }
    }
  }
  const seen = new Set<string>()
  const seenEnv = new Set<string>()
  for (const setting of harness.settings) {
    const { key } = setting
    if (RESERVED_SETTING_KEYS.includes(key)) {
      throw new Error(`harness "${harness.name}": a setting can't be called "${key}" — that key is the harness block's own`)
    }
    if (seen.has(key)) throw new Error(`harness "${harness.name}": two settings share the key "${key}"`)
    seen.add(key)
    // A secret reaches the run as an environment variable and nothing else: it has to name
    // the variable, that name has to be its own, and it can carry no flag — a key on a
    // command line is a key in every process list on the machine.
    if (setting.kind !== 'secret') continue
    if (!setting.env) throw new Error(`harness "${harness.name}": the secret "${key}" names no environment variable`)
    if (setting.flags?.length) throw new Error(`harness "${harness.name}": the secret "${key}" can't take a flag — a secret reaches the run as ${setting.env}`)
    if (seenEnv.has(setting.env)) throw new Error(`harness "${harness.name}": two secrets share the variable "${setting.env}"`)
    seenEnv.add(setting.env)
  }
  // The provider list, checked the same way and for the same reason. A provider that needs
  // a setting the harness never declared would draw an empty box, and a default that names
  // no provider would leave a run with no pick at all — both are mistakes in the entry
  // above, so they fail here rather than in front of a user.
  const providers = harness.settings.filter((s) => s.kind === 'provider')
  if (providers.length > 1) {
    throw new Error(`harness "${harness.name}": a connector declares one provider list, not ${providers.length}`)
  }
  const list = providers[0]
  if (!list) continue
  if (!list.providers?.length) throw new Error(`harness "${harness.name}": the provider setting "${list.key}" offers no providers`)
  const ids = new Set<string>()
  for (const provider of list.providers) {
    if (ids.has(provider.id)) throw new Error(`harness "${harness.name}": two providers share the id "${provider.id}"`)
    ids.add(provider.id)
    for (const need of [...provider.needs, ...(provider.preferWhenSet ?? [])]) {
      if (!seen.has(need)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" needs a setting "${need}" it never declared`)
    }
    for (const required of provider.requires ?? []) {
      if (!provider.needs.includes(required)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" requires "${required}" without needing it`)
    }
    for (const key of Object.keys(provider.envAs ?? {})) {
      if (!provider.needs.includes(key)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" renames the variable of "${key}" without needing it`)
    }
  }
  if (list.defaultProvider && !ids.has(list.defaultProvider)) {
    throw new Error(`harness "${harness.name}": the default provider "${list.defaultProvider}" isn't on the list`)
  }
}
