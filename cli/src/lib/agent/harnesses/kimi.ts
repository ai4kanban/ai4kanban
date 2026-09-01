import { createKimiStreamRenderer } from '../wire'
import { namesFlag, SKILL_SENTENCE, type Harness } from './types'

// Kimi Code CLI, Moonshot's coding agent (#377). The binary is `kimi`, and what this
// targets is what `curl -LsSf https://code.kimi.com/install.sh | bash` installs — not the
// older `kimi-cli`, which has no headless mode.
//
// NOT PROVED ON A MACHINE. Every line here is read off Kimi Code's own documentation and
// source — `kimi` was not installed and no Moonshot login was available when this was
// written (2026-09-01). What a probe still has to settle is marked PROBE below.
//
// The flags every `kimi -p` run wants, added only when the user's own `command` hasn't
// already named them:
//
// `--output-format stream-json` gives the JSONL rows kimi-stream.ts renders. Without it
// `kimi -p` prints a transcript styled for a terminal, and the session id never arrives.
//
// `-p` goes LAST, always, and it is why this connector builds its flags the way it does.
// Kimi's `-p, --prompt <prompt>` takes the prompt as its VALUE, and the CLI rejects a bare
// trailing word with `unknown command` — while a spawned run appends the prompt as the last
// argv entry (agent/watch.ts). Putting `-p` at the end is what makes those two the same
// thing. So `--session` and everything else has to come before it.
//
// Nothing about approvals. `--yolo` and `--auto` are both REJECTED alongside `--prompt`
// ("Cannot combine --prompt with --yolo"), because print mode already runs under Kimi's
// `auto` permission policy: nothing stops to ask, which is what a board run needs since it
// has nobody at the keyboard. Kimi's own dangerous-command guard still refuses `rm -rf`,
// `shutdown` and `reboot` there, and that is not something to switch off for a card.
//
// Nothing about the working folder either: `kimi -p` takes its work directory from
// `process.cwd()`, so its `--add-dir` would only repeat the cwd every run is spawned with.
//
// PROBE: WORKING FOLDER in ./types is the one claim it says to prove before trusting a new
// connector — spawn it from folder A with `cwd` set to B and ask it for `pwd`. An answer of A
// means the folder has to be passed outright, the way OpenCode's `--dir` does.
//
// Nothing about skills: Kimi reads the project's `.agents/skills/` by itself, which is one
// of the two folders an install writes (lib/skill/install.ts). `--skills-dir` is
// deliberately not added — it REPLACES the directories Kimi discovers rather than adding to
// them, so pointing it at the board's folder would turn off the user's own skills.
function kimiExtraArgs(argv: string[], before: string[] = []): string[] {
  const extra: string[] = []
  if (!namesFlag(argv, ['--output-format'])) extra.push('--output-format', 'stream-json')
  extra.push(...before)
  if (!namesFlag(argv, ['-p', '--prompt'])) extra.push('-p')
  return extra
}

export const KIMI: Harness = {
  name: 'kimi',
  label: 'Kimi Code',
  icon: '/agents/kimi.svg',
  // No `-p` here on purpose: it has to be the last flag on the line, and this is only the
  // start of one. `kimiExtraArgs` adds it after everything else.
  command: 'kimi --output-format stream-json',

  // Nothing to pin: Kimi mints its own session id and takes none from us. The id arrives on
  // the run's closing row, and the renderer reports it.
  extraArgs(argv) {
    return kimiExtraArgs(argv)
  },

  resumes: true,

  // `kimi --session <id> … -p "<prompt>"` sends one more turn into an existing session.
  // Before `-p`, never after — see the note above.
  resumeArgs(argv, resumeId) {
    return kimiExtraArgs(argv, namesFlag(argv, ['--session', '-S', '--resume', '-r']) ? [] : ['--session', resumeId])
  },

  // What Kimi takes: who pays for the run and where it goes, then the model. The provider
  // comes first because it decides the rest.
  settings: [
    {
      key: 'provider',
      label: 'Provider',
      kind: 'provider',
      defaultProvider: 'signin',
      providers: [
        {
          id: 'signin',
          label: 'Kimi sign-in',
          blurb: 'Runs on the login your kimi CLI already has. Nothing else to fill in.',
          // The Model box belongs to this pick alone. Under it a model is an ALIAS out of
          // Kimi's own config.toml, which `-m` selects; the other pick names a model id and
          // an endpoint to send it to instead, so one box each rather than two on screen.
          needs: ['model'],
        },
        {
          id: 'endpoint',
          label: 'Custom model endpoint',
          blurb: 'Any Kimi-, Anthropic- or OpenAI-shaped endpoint, with its own key.',
          needs: ['modelName', 'protocol', 'baseUrl', 'apiKey'],
          // Three of the four have to be filled: KIMI_MODEL_NAME is the switch that turns
          // this channel on and Kimi fails immediately when a required variable beside it is
          // missing. The base URL is what makes the pick mean anything — left empty Kimi
          // falls back to that format's own default address, which for the default format is
          // where the sign-in pick already goes. The format itself is optional: empty is
          // Kimi's own, which is what the box's first choice says.
          requires: ['modelName', 'baseUrl', 'apiKey'],
          // A board that pasted an endpoint key before this list existed pasted it to run
          // on it, so it reads as this provider until the user picks otherwise.
          preferWhenSet: ['apiKey'],
        },
      ],
    },
    // Free text rather than a list, for the same reason every other connector's is: model
    // ids and aliases change between releases, and a stale list would block one the agent
    // already runs.
    {
      key: 'model',
      label: 'Model',
      kind: 'text',
      placeholder: 'kimi-for-coding',
      flags: ['-m', '--model'],
      help: "An alias from your kimi config. Empty runs the agent's default. A wrong one fails the run; the log says why.",
      overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model, and that wins.`,
    },
    // The endpoint pick's own boxes. Each reaches the run as the variable Kimi reads for it
    // rather than as a flag, because its CLI takes none of them on the command line.
    {
      key: 'modelName',
      label: 'Model id',
      kind: 'text',
      env: 'KIMI_MODEL_NAME',
      placeholder: 'kimi-k2-thinking',
      help: 'The id sent to the endpoint, as that endpoint spells it.',
    },
    // Which shape the endpoint answers in. A list, not a box: these three are Kimi's own
    // vocabulary and can't go stale. Without it the pick reaches Kimi-shaped endpoints only,
    // which is not what most gateways are.
    {
      key: 'protocol',
      label: 'Endpoint format',
      kind: 'select',
      env: 'KIMI_MODEL_PROVIDER_TYPE',
      choices: [
        { value: '', label: 'Kimi (default)' },
        { value: 'anthropic', label: 'Anthropic' },
        { value: 'openai', label: 'OpenAI' },
      ],
      help: 'The API your gateway answers in — OpenRouter and LiteLLM speak OpenAI.',
    },
    {
      key: 'baseUrl',
      label: 'Endpoint base URL',
      kind: 'text',
      env: 'KIMI_MODEL_BASE_URL',
      placeholder: 'https://api.moonshot.ai/v1',
      help: 'The address the endpoint answers on.',
    },
    {
      key: 'apiKey',
      label: 'Endpoint key',
      kind: 'secret',
      env: 'KIMI_MODEL_API_KEY',
      placeholder: 'sk-…',
      help: 'Saved to docs/kanban/.env (kept out of git), never shown back.',
    },
  ],

  // Everything that could send a Kimi run somewhere the pick didn't ask for.
  //
  // The rest of the `KIMI_MODEL_*` family goes because the family is one channel: setting
  // KIMI_MODEL_NAME makes Kimi build a provider out of ALL of them, so an exported one of
  // these would reshape the endpoint this board's own boxes describe. The four the settings
  // name are dropped already, by being that provider's `needs` — which is why the endpoint's
  // format is a box rather than a name on this list: the variable behind it moves a run
  // either way, and a pick is better than a leftover.
  //
  // KIMI_CODE_CUSTOM_HEADERS is here for the same reason Claude Code drops
  // ANTHROPIC_CUSTOM_HEADERS: an exact `Authorization` entry in it replaces the token Kimi
  // would have signed with, so it moves a run as surely as a base URL would. The last three
  // move where a signed-in run goes — the managed API it talks to and the host it logged in
  // against.
  //
  // What is NOT here is Kimi's OAuth credentials. They live in a file under
  // `~/.kimi-code/credentials/`, not in a variable, so an empty key box runs on that login
  // by design.
  providerEnv: [
    'KIMI_MODEL_MAX_CONTEXT_SIZE',
    'KIMI_MODEL_CAPABILITIES',
    'KIMI_MODEL_DISPLAY_NAME',
    'KIMI_MODEL_MAX_OUTPUT_SIZE',
    'KIMI_MODEL_REASONING_KEY',
    'KIMI_MODEL_THINKING_EFFORT',
    'KIMI_MODEL_ADAPTIVE_THINKING',
    'KIMI_CODE_CUSTOM_HEADERS',
    'KIMI_CODE_BASE_URL',
    'KIMI_CODE_OAUTH_HOST',
    'KIMI_OAUTH_HOST',
  ],

  env: () => ({ ...process.env }),

  // Neither is on the stream — Kimi's JSON rows are the conversation and nothing else — so
  // both are read out of the session it writes to disk (agent/wire/kimi-session.ts). A
  // session that can't be read shows a blank for both, which is what a board with a
  // KIMI_CODE_HOME the run didn't use will see. No cost: nothing prices a Kimi run.
  //
  // PROBE: this is a promise the runs panel is held to. It says a `usage.record` line lands
  // in `<session>/agents/*/wire.jsonl` carrying `model` and a four-part `usage`. Drop
  // whichever one a real run doesn't write — a blank is fine, a number the board invented
  // is not.
  reports: ['tokens', 'model'],

  // Kimi retries a 429 up to `max_attempts_per_step` times — 10 by default, with backoff
  // capped at 32 seconds, so a rate-limited run holds its card for minutes rather than the
  // hour Claude Code's switch exists to avoid. `KIMI_LOOP_MAX_ATTEMPTS_PER_STEP=1` would
  // turn it into an immediate failure, and is deliberately not set: it would also end a run
  // on the first connection blip. A 429 from an exhausted quota is not retried at all —
  // Kimi fails that one at once, because it cannot succeed until the account is topped up.
  stopsOnRateLimit: false,

  renderer: createKimiStreamRenderer,

  // Kimi names its own session, and prints the id as its closing row.
  adoptsSessionId: false,

  // Kimi does have a slash name for a skill — `/skill:kanban` — but whether one typed into
  // a `-p` prompt is read as a command or as plain chat text is unprobed. The sentence
  // works either way, because Kimi's model picks a skill from its description on its own.
  //
  // PROBE: if `/skill:kanban` triggers the skill from a `-p` prompt, this becomes that and
  // the connector stops showing a "Direct skill call" gap.
  skillCall: SKILL_SENTENCE,

  install: 'curl -LsSf https://code.kimi.com/install.sh | bash',
}
