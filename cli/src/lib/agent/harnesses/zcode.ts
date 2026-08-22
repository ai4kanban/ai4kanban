import { createZcodeClient } from '../zcode'
import { SKILL_SENTENCE, type Harness } from './types'

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
export const ZCODE: Harness = {
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
