import { createStreamRenderer } from '../stream'
import type { Harness } from './types'

// `claude -p` in its default text mode prints nothing until the session ends, so a live
// tail would stay empty the whole time. Ask claude to stream NDJSON events instead
// (stream.ts renders them into log lines). Every claude run wants these — a fresh one and
// a resumed one alike.
function claudeStreamArgs(argv: string[]): string[] {
  return argv.includes('--output-format') ? [] : ['--output-format', 'stream-json', '--verbose']
}

export const CLAUDE_CODE: Harness = {
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
