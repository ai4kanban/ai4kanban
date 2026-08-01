import fs from "node:fs";
import { createCodexStreamRenderer } from "./codex-stream";
import { uiConfigPath } from "./paths";
import { missingRequired, pickedProvider, providerSetting, shownForProvider } from "./providers";
import { readEnvFile } from "./secrets";
import { createStreamRenderer, type StreamRenderer } from "./stream";
import type {
  AgentAction,
  AgentInfo,
  Boldness,
  HarnessOption,
  HarnessSetting,
  Provider,
} from "./types";

// --- the harnesses ----------------------------------------------------------
// A harness is one way to run an agent, and everything that differs between two
// of them lives behind this interface: the command, the flags that make it
// stream, the env it needs, how its output is parsed, how a finished session is
// resumed, the settings it takes, and how it shows up in the Configuration
// dialog. Adding a harness is adding one object to HARNESSES — nothing outside
// this file learns its name.

export interface Harness extends HarnessOption {
  /** The flags to append to the configured argv. `argv` is what the user's
   *  command already carries, so a harness never overrides a flag the user set
   *  by hand. `sessionId` is the id the registry generated up front — a harness
   *  that can't pin an id ignores it. */
  extraArgs(argv: string[], sessionId: string): string[];
  /** True when this harness's CLI can pick an earlier conversation back up. The
   *  board offers a failed run's Resume button only then. */
  resumes: boolean;
  /** The flags that continue the conversation `resumeId` names, instead of
   *  starting a fresh one. Stands in for `extraArgs` on a resumed run — the two
   *  are never both appended, because pinning a new session id and resuming an
   *  old one are contradictory instructions. Only called when `resumes`. */
  resumeArgs(argv: string[], resumeId: string): string[];
  /** The settings this harness takes, in the order the dialog draws them (#93).
   *  This list is the whole of its configuration: the dialog draws it and
   *  nothing else, a run appends the ones that carry a flag, and the file keeps
   *  them beside `name` in the `harness` block. */
  settings: HarnessSetting[];
  /** Every variable that could send this connector to a provider the user
   *  didn't pick (#95). All of them are dropped from a run's environment, and
   *  then the picked provider sets the ones it needs — so what the dialog shows
   *  is where the run goes, and an export the user forgot about years ago can't
   *  say otherwise.
   *
   *  It covers providers the board doesn't offer yet, not only the ones on the
   *  list: a leftover Bedrock or Vertex switch would send a "Claude
   *  subscription" run somewhere else just as surely as a base URL would. The
   *  variables the connector's own provider settings name are dropped too,
   *  without being repeated here.
   *
   *  A connector that declares no provider list has nothing to drop for, so it
   *  leaves this out and its runs inherit the environment exactly as they do
   *  today. */
  providerEnv?: string[];
  /** The environment the child runs under, on top of the server's own. */
  env(): NodeJS.ProcessEnv;
  /** Parses this harness's stdout into readable log lines + a final message. */
  renderer(): StreamRenderer;
  /** True when this harness adopts the session id we generate before the run
   *  starts (Claude Code takes `--session-id`), so its own resume id IS ours and
   *  is known from the first moment. False when the harness mints its own id
   *  instead — then the id arrives mid-run, out of the output stream, and the
   *  renderer reports it (see StreamRenderer.resumeId). */
  adoptsSessionId: boolean;
  /** How a prompt calls the ai4kanban skill for this agent (#69). Every prompt
   *  the board sends opens with it, and so does the line the setup bar hands the
   *  user to paste. Claude Code triggers a skill from a slash name (`/kanban`);
   *  Codex reads a slash as plain chat text and triggers on a `$` name
   *  (`$kanban`) instead. The rest of every prompt is the same for both. */
  skillCall: string;
}

// `claude -p` in its default text mode prints nothing until the session ends, so
// a live tail would stay empty the whole time. Ask claude to stream NDJSON events
// instead (lib/stream.ts renders them into log lines). Every claude run wants
// these — a fresh one and a resumed one alike.
function claudeStreamArgs(argv: string[]): string[] {
  return argv.includes("--output-format") ? [] : ["--output-format", "stream-json", "--verbose"];
}

const CLAUDE_CODE: Harness = {
  name: "claude-code",
  label: "Claude Code",
  // What the agent is, not who pays for it — that is the provider pick now
  // (#95), and this line would be wrong under two of its three entries.
  blurb: "Anthropic's coding CLI",
  icon: "/agents/claude.svg",
  command: "claude -p",

  // Stream the events (see claudeStreamArgs), and pin the session id:
  // `--session-id <id>` makes Claude Code adopt the id we generated up front, so
  // the registry key IS Claude Code's own session id — the exact id a resume
  // hands back to the CLI.
  extraArgs(argv, sessionId) {
    const extra = claudeStreamArgs(argv);
    if (sessionId && !argv.includes("--session-id")) extra.push("--session-id", sessionId);
    return extra;
  },

  resumes: true,

  // `claude -p --resume <id> "<prompt>"` sends one more turn into an existing
  // conversation. No `--session-id` here — Claude Code refuses both at once, and
  // without `--fork-session` the resumed turn keeps running under the very id we
  // resumed, so the new run's resume id is that same id.
  resumeArgs(argv, resumeId) {
    const extra = claudeStreamArgs(argv);
    if (!argv.includes("--resume") && !argv.includes("-r")) extra.push("--resume", resumeId);
    return extra;
  },

  // What Claude Code takes: who pays for the run, where that run goes, a model
  // id, and how hard that model thinks. The provider comes first because it
  // decides the rest — which of the boxes below are drawn at all, and the whole
  // environment a run starts under.
  settings: [
    // Who pays for a run, and where it goes (#95). Three entries, because these
    // are the three ways a person reaches Claude Code today: the subscription
    // they already log into, Anthropic's own API, and any gateway that answers
    // in the Anthropic format. Bedrock, Vertex and Foundry are more entries on
    // this same list — add them when someone asks.
    //
    // "OpenAI" is deliberately not here. Claude Code speaks the Anthropic API
    // only; an OpenAI model reaches it through a gateway that answers in that
    // format, which IS the endpoint entry. A connector that speaks the OpenAI
    // format brings its own list (#69).
    {
      key: "provider",
      label: "Provider",
      kind: "provider",
      defaultProvider: "subscription",
      providers: [
        {
          id: "subscription",
          label: "Claude subscription",
          blurb: "Runs on the login your claude CLI already has. Nothing else to fill in.",
          needs: [],
        },
        {
          id: "anthropic-api",
          label: "Anthropic API",
          blurb: "Pay per token, with an Anthropic API key.",
          needs: ["apiKey"],
          // A board that saved a key before this list existed was running every
          // run on that key. It reads as this provider until the user picks
          // otherwise — defaulting it to the subscription would drop the key
          // from every run, which is the opposite of "change nothing, see no
          // change".
          preferWhenSet: ["apiKey"],
        },
        {
          id: "endpoint",
          label: "Anthropic-compatible endpoint",
          blurb:
            "A gateway that answers in the Anthropic format — OpenRouter, LiteLLM, a company proxy.",
          needs: ["baseUrl", "apiKey"],
          // The base URL is what makes this pick mean anything, so it is the one
          // box that has to be filled. The key isn't: a proxy on your own laptop
          // often takes none.
          requires: ["baseUrl"],
          // Which header a gateway reads is its own team's choice —
          // `Authorization: Bearer` for some, `x-api-key` for others — and the
          // board has no way to ask. The same key goes out under both variables,
          // so one box works whichever the gateway wants.
          alsoEnv: { apiKey: "ANTHROPIC_AUTH_TOKEN" },
        },
      ],
      help: "Who pays for a run and where it goes. The pick decides the whole environment a run starts under, so a base URL or a key left over in your shell can never move a run somewhere this doesn't say.",
    },
    // Where an endpoint run goes. Not a secret — a gateway address is not a
    // credential — so it saves beside the model in ui.config.json, and it
    // reaches the run as the variable Claude Code reads for it rather than as a
    // flag, because its CLI has no flag for it.
    {
      key: "baseUrl",
      label: "Endpoint base URL",
      kind: "text",
      env: "ANTHROPIC_BASE_URL",
      placeholder: "https://my-gateway.example.com",
      help: "The address the gateway answers on. It has to be filled in before the endpoint can be picked — without it the pick would mean nothing.",
    },
    // The key the picked provider uses (#94). It belongs to the box it is typed
    // in, not to whoever was picked at the time, so switching providers — or
    // agents — never asks for it again. Only a provider that needs it sees it:
    // the subscription never does, so the box isn't drawn there and the key
    // never reaches that run.
    {
      key: "apiKey",
      label: "API key",
      kind: "secret",
      env: "ANTHROPIC_API_KEY",
      placeholder: "sk-ant-…",
      help: "Your Anthropic key, or the one your gateway issued. It is saved to docs/kanban/.env, which the board keeps out of git, and it is never shown back. A gateway that takes no key needs nothing here.",
    },
    // The model is free text rather than a list — model ids change between agent
    // releases, and a stale list would block a model the agent already runs.
    // `--model` is the one flag its CLI takes for it; an override that already
    // names that flag wins, and the help line says so instead of letting a
    // filled-in box look broken.
    {
      key: "model",
      label: "Model",
      kind: "text",
      placeholder: "claude-opus-5",
      flags: ["--model"],
      help: "Leave it empty to run the agent's own default. The id isn't checked here — a wrong one fails the run, and the log says why.",
      overriddenHelp: `Not in effect: your ui.config.json's "harness.command" already names a model, and that wins.`,
    },
    // How hard the model thinks (#97). A list, not a box: unlike a model id,
    // the levels are the agent's own vocabulary — these five are exactly what
    // Claude Code's `--effort` takes — and they don't change between releases,
    // so a list can't go stale the way a list of model ids would. Another agent
    // names its own levels, or has none.
    //
    // The first choice is empty, which drops the key and lets the agent think
    // however it thinks by default. The board never invents a level, and never
    // judges one either: what a level means, and whether the picked model can do
    // it, is the agent's. A level Claude Code doesn't know makes it warn on
    // stderr and run at its own default — that warning lands in the session log,
    // where the user reads it, so nothing here has to second-guess the list.
    //
    // Only a hand-edited ui.config.json can get there: the dialog offers this
    // list and app/actions.ts refuses a value that isn't on it.
    {
      key: "reasoning",
      label: "Reasoning effort",
      kind: "select",
      choices: [
        { value: "", label: "Agent's default" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "xhigh", label: "Extra high (xhigh)" },
        { value: "max", label: "Max" },
      ],
      flags: ["--effort"],
      help: "How hard the model thinks on every run. Lower is quicker and cheaper, higher is slower and more careful. Leave it on the agent's default and nothing is passed.",
      overriddenHelp: `Not in effect: your ui.config.json's "harness.command" already names an effort level, and that wins.`,
    },
  ],

  // Everything that could send Claude Code somewhere the pick didn't ask for
  // (#95). Each of these is dropped from every run, and then the picked provider
  // sets what it needs — so a base URL exported months ago can't send a
  // "Claude subscription" run through a gateway while the dialog says otherwise.
  //
  // It goes past the three providers on the list to the ones the board doesn't
  // offer yet: a leftover Bedrock, Vertex or Foundry switch moves a run just as
  // surely as a base URL. What is NOT here is the cloud credentials themselves —
  // AWS_PROFILE, GOOGLE_APPLICATION_CREDENTIALS and the like. They move nothing
  // once the switch above them is gone, and the agent may well need them for the
  // work it is doing in the repo.
  providerEnv: [
    "ANTHROPIC_AUTH_TOKEN",
    // Custom headers can carry an authorization of their own, so they are a way
    // to move a run as much as a base URL is.
    "ANTHROPIC_CUSTOM_HEADERS",
    "CLAUDE_CODE_USE_BEDROCK",
    "ANTHROPIC_BEDROCK_BASE_URL",
    "CLAUDE_CODE_SKIP_BEDROCK_AUTH",
    "AWS_BEARER_TOKEN_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "ANTHROPIC_VERTEX_BASE_URL",
    "CLAUDE_CODE_SKIP_VERTEX_AUTH",
    "CLAUDE_CODE_USE_FOUNDRY",
    "ANTHROPIC_FOUNDRY_BASE_URL",
    "ANTHROPIC_FOUNDRY_API_KEY",
  ],

  // The one variable that makes a rate limit fail instead of wait.
  //
  // By default Claude Code retries a 429 (session/weekly limit, overload) with
  // exponential backoff — up to 10 attempts, each request allowed 10 minutes. In
  // a terminal that's right; here it's wrong. The dispatcher wakes every minute,
  // and a run that's rate-limited would sit holding the card lock for the better
  // part of an hour before it ever reported anything. `CLAUDE_CODE_MAX_RETRIES=0`
  // turns the first 429 into an immediate non-zero exit, so the board learns at
  // once and the card is free again.
  //
  // It is NOT a spend control. Whether hitting your plan's limit spills over into
  // paid extra usage is an account setting on claude.ai (the CLI has no flag for
  // it) — if that's on, turn it off there.
  env: () => ({ ...process.env, CLAUDE_CODE_MAX_RETRIES: "0" }),

  renderer: createStreamRenderer,

  // `--session-id` above makes Claude Code run under the id we generated, so our
  // registry key IS its resume id — no waiting for the stream to report one.
  adoptsSessionId: true,

  // Claude Code loads a skill from its slash name.
  skillCall: "/kanban",
};

// The two flags every `codex exec` run wants, added only when the user's own
// `harness.command` hasn't already named them.
//
// `--json` gives the JSONL event stream lib/codex-stream.ts renders — without it
// `codex exec` prints its final message and nothing else, so the live tail would
// stay empty for the whole run and no thread id would ever arrive.
//
// `--sandbox workspace-write` is needed because `codex exec` defaults to
// read-only and a board run writes files. It is also the whole of what a Codex
// run may do: inside the repo, no network, and it refuses to start outside a git
// repo. Someone who needs more widens it in `harness.command`. `--full-auto` is
// deprecated in current Codex (it warns and points here), so it is never used —
// but a command that names it, or the bypass flag, counts as a sandbox already
// chosen and nothing is added on top.
function codexExtraArgs(argv: string[]): string[] {
  const extra: string[] = [];
  if (!namesFlag(argv, ["--json", "--experimental-json"])) extra.push("--json");
  const sandboxFlags = [
    "--sandbox",
    "-s",
    "--full-auto",
    "--dangerously-bypass-approvals-and-sandbox",
  ];
  if (!namesFlag(argv, sandboxFlags)) extra.push("--sandbox", "workspace-write");
  return extra;
}

const CODEX: Harness = {
  name: "codex",
  label: "Codex",
  blurb: "ChatGPT subscription",
  icon: "/agents/codex.svg",
  command: "codex exec --json --sandbox workspace-write",

  // Nothing to pin: Codex mints its own thread id and takes none from us, so the
  // generated session id is ignored here and the id arrives on the run's first
  // event instead (see adoptsSessionId below).
  extraArgs(argv) {
    return codexExtraArgs(argv);
  },

  resumes: true,

  // `codex exec … resume <thread-id> "<prompt>"` sends one more turn into an
  // existing thread. `resume` is a SUBCOMMAND, not a flag: everything else has
  // to come before it and the prompt comes after, which is why a run's flags are
  // assembled command → settings → harness (see startRun).
  resumeArgs(argv, resumeId) {
    return [...codexExtraArgs(argv), "resume", resumeId];
  },

  // What Codex takes. A model, free text for the same reason Claude Code's is —
  // ids change between releases and a stale list would block one the agent
  // already runs — and one optional key. No reasoning level: that is #97's, and
  // Codex names its own levels.
  settings: [
    {
      key: "model",
      label: "Model",
      kind: "text",
      placeholder: "gpt-5.1-codex",
      flags: ["--model", "-m"],
      help: "Leave it empty to run the agent's own default. The id isn't checked here — a wrong one fails the run, and the log says why.",
      overriddenHelp: `Not in effect: your ui.config.json's "harness.command" already names a model, and that wins.`,
    },
    {
      key: "apiKey",
      label: "OpenAI API key",
      kind: "secret",
      env: "OPENAI_API_KEY",
      placeholder: "sk-…",
      help: "Optional. Leave it empty and runs use the login your `codex` CLI already has. Fill it in and every run uses this key instead. It is saved to docs/kanban/.env, which the board keeps out of git, and it is never shown back.",
    },
  ],

  // Nothing extra. Claude Code gets CLAUDE_CODE_MAX_RETRIES=0 so a rate limit
  // fails at once and frees the card; Codex has no equivalent switch, so a
  // rate-limited Codex run waits it out and holds the card while it does. Better
  // that than a made-up variable — the README says so plainly instead.
  env: () => ({ ...process.env }),

  renderer: createCodexStreamRenderer,

  // Codex names its own thread, so our session id is only ever the board's key
  // for the run. The real resume id lands on the first event and the registry
  // saves it there (catchResumeId).
  adoptsSessionId: false,

  // Codex ignores a slash name — it reads as plain chat text — and triggers a
  // skill from a `$` name. The install already writes the skill to
  // `.agents/skills/kanban/`, which is where Codex looks.
  skillCall: "$kanban",
};

/** Every harness the UI can run, in the order the dialog lists them. */
export const HARNESSES: Harness[] = [CLAUDE_CODE, CODEX];

/** What runs when the config names no harness, or names one we don't know. */
export const DEFAULT_HARNESS = CLAUDE_CODE;

// The `harness` block's own two keys. A setting saves beside them, so it can't
// be called either — `name` picks the agent and `command` overrides its command,
// and a setting by one of those names would fight with them.
const RESERVED_SETTING_KEYS = ["name", "command"];

// Checked here, once, when this module loads: the list is written in this file
// and compiled in, so a clash is a mistake in the entry above, and the person
// adding a harness is the only one who can ever see this. Better a loud failure
// the moment it's added than a setting that quietly overwrites the agent's name.
for (const harness of HARNESSES) {
  const seen = new Set<string>();
  const seenEnv = new Set<string>();
  for (const setting of harness.settings) {
    const { key } = setting;
    if (RESERVED_SETTING_KEYS.includes(key)) {
      throw new Error(`harness "${harness.name}": a setting can't be called "${key}" — that key is the harness block's own`);
    }
    if (seen.has(key)) throw new Error(`harness "${harness.name}": two settings share the key "${key}"`);
    seen.add(key);
    // A secret reaches the run as an environment variable and nothing else
    // (#94): it has to name the variable, that name has to be its own, and it
    // can carry no flag — a key on a command line is a key in every process
    // list on the machine.
    if (setting.kind !== "secret") continue;
    if (!setting.env) throw new Error(`harness "${harness.name}": the secret "${key}" names no environment variable`);
    if (setting.flags?.length) throw new Error(`harness "${harness.name}": the secret "${key}" can't take a flag — a secret reaches the run as ${setting.env}`);
    if (seenEnv.has(setting.env)) throw new Error(`harness "${harness.name}": two secrets share the variable "${setting.env}"`);
    seenEnv.add(setting.env);
  }
  // The provider list, checked the same way and for the same reason (#95). A
  // provider that needs a setting the harness never declared would draw an empty
  // box, and a default that names no provider would leave a run with no pick at
  // all — both are mistakes in the entry above, so they fail here rather than in
  // front of a user.
  const providers = harness.settings.filter((s) => s.kind === "provider");
  if (providers.length > 1) {
    throw new Error(`harness "${harness.name}": a connector declares one provider list, not ${providers.length}`);
  }
  const list = providers[0];
  if (!list) continue;
  if (!list.providers?.length) throw new Error(`harness "${harness.name}": the provider setting "${list.key}" offers no providers`);
  const ids = new Set<string>();
  for (const provider of list.providers) {
    if (ids.has(provider.id)) throw new Error(`harness "${harness.name}": two providers share the id "${provider.id}"`);
    ids.add(provider.id);
    for (const need of [...provider.needs, ...(provider.preferWhenSet ?? [])]) {
      if (!seen.has(need)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" needs a setting "${need}" it never declared`);
    }
    for (const required of provider.requires ?? []) {
      if (!provider.needs.includes(required)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" requires "${required}" without needing it`);
    }
    for (const key of Object.keys(provider.alsoEnv ?? {})) {
      if (!provider.needs.includes(key)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" gives "${key}" a second variable without needing it`);
    }
  }
  if (list.defaultProvider && !ids.has(list.defaultProvider)) {
    throw new Error(`harness "${harness.name}": the default provider "${list.defaultProvider}" isn't on the list`);
  }
}

function harnessByName(name: string | undefined): Harness | undefined {
  return HARNESSES.find((h) => h.name === name);
}

// --- the harness setting ----------------------------------------------------
// Reads the consumer repo's docs/kanban/ui.config.json:
//
//   "harness": { "name": "claude-code", "model": "claude-opus-5", "command": "claude -p" }
//
// `name` picks the harness and `command` is an optional override for a custom
// binary or extra flags, hand-edited in the file. Every other key in the block
// is one of the settings that harness declares — `model` is Claude Code's, and
// each agent brings its own list (#93). They all belong to the harness that is
// picked — a model id for one agent means nothing to another — so switching
// harness clears the block.
//
// A key no setting declares is left exactly where it is: this is the user's
// file, and nothing here rewrites a line they wrote.
//
// Config lives in the project (not next to the UI source) so it survives an npx
// run, where the package itself sits in the npm cache. The command is split into
// argv on spaces (no quoted args) and spawned WITHOUT a shell — the prompt and
// a setting's value are always separate argv entries, so they never need
// escaping and can't be shell-injected.

interface ResolvedHarness {
  harness: Harness;
  command: string;
  isDefault: boolean;
  /** What each declared setting is set to, keyed by its key. A setting the file
   *  doesn't carry is absent, meaning the harness's own default. A `secret` is
   *  never in here — its value lives in docs/kanban/.env and is never read
   *  back. */
  values: Record<string, string>;
  /** The keys of the secret settings whose variable docs/kanban/.env holds
   *  right now. Set or not set — the value itself never leaves this module. */
  secretsSet: string[];
  /** The keys whose flag the command override already names, so the override
   *  wins and the setting is never appended. Listed whether or not the setting
   *  has a value — the dialog says the field isn't in effect before the user
   *  types into it. */
  ignored: string[];
  /** The name the file asked for, when it isn't one of ours. */
  unknownName?: string;
  /** The file still holds the pre-#68 top-level `command` key. Nothing reads it. */
  staleCommand?: boolean;
}

/** True when this argv already names a flag — `--model id` or `--model=id`, in
 *  any of the names that harness answers to. Used for a setting's flags, and by
 *  a harness deciding whether its own flags are already there. */
function namesFlag(argv: string[], flags: string[]): boolean {
  return argv.some((tok) => flags.some((flag) => tok === flag || tok.startsWith(`${flag}=`)));
}

// Everything the provider pick needs to be read the same way twice: what counts
// as "filled in" for one setting. A key is filled when docs/kanban/.env holds
// its variable, anything else when ui.config.json holds a value — the dialog
// asks the same question of its own boxes (lib/providers.ts).
function isFilled(
  harness: Harness,
  values: Record<string, string>,
  secretsSet: string[],
): (key: string) => boolean {
  return (key) => {
    const setting = harness.settings.find((s) => s.key === key);
    return setting?.kind === "secret" ? secretsSet.includes(key) : Boolean(values[key]);
  };
}

/** The provider a run goes through right now, or nothing when this connector
 *  declares no provider list — then it has no providers and every setting it
 *  declares is in effect, exactly as before #95. */
function activeProviderOf({ harness, values, secretsSet }: ResolvedHarness): Provider | undefined {
  const setting = providerSetting(harness.settings);
  if (!setting) return undefined;
  return pickedProvider(setting, values[setting.key] ?? "", isFilled(harness, values, secretsSet));
}

function resolveHarness(): ResolvedHarness {
  let cfg: Record<string, unknown> = {};
  try {
    const file = uiConfigPath();
    if (fs.existsSync(file)) cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // an unreadable or malformed file runs the default, like a missing one
  }
  const staleCommand = typeof cfg.command === "string" && cfg.command.trim() ? true : undefined;
  const block = (cfg.harness ?? {}) as Record<string, unknown>;
  const asked = typeof block.name === "string" ? block.name.trim() : "";
  const override = typeof block.command === "string" ? block.command.trim() : "";
  const known = harnessByName(asked);
  const harness = known ?? DEFAULT_HARNESS;
  const command = known ? override || known.command : DEFAULT_HARNESS.command;
  const argv = command.split(/\s+/).filter(Boolean);
  const values: Record<string, string> = {};
  const ignored: string[] = [];
  const secretsSet: string[] = [];
  // Read once for the whole loop — a harness can declare several secrets, and
  // they all sit in the same file.
  const env = harness.settings.some((s) => s.kind === "secret") ? readEnvFile() : {};
  for (const setting of harness.settings) {
    // A key lives in docs/kanban/.env, never in this block. A hand-written one
    // here is ignored rather than used: the dialog would then show a key it
    // promised never to show, and the file it promised to keep it out of would
    // be the one holding it.
    if (setting.kind === "secret") {
      if (setting.env && env[setting.env]) secretsSet.push(setting.key);
      continue;
    }
    const raw = block[setting.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value) values[setting.key] = value;
    if (setting.flags?.length && namesFlag(argv, setting.flags)) ignored.push(setting.key);
  }
  // The provider is the one setting that always has a value (#95): a run always
  // goes through one, so a board that never picked reads as the default rather
  // than as nothing. It is settled after the loop because the default can depend
  // on the other settings — a board holding an Anthropic key reads as the
  // Anthropic API, so the key it already had goes on being used. A pick the file
  // names that this build doesn't ship reads as the default too, so the dialog
  // and the run never disagree about where a run is going.
  const list = providerSetting(harness.settings);
  if (list) {
    const picked = pickedProvider(list, values[list.key] ?? "", isFilled(harness, values, secretsSet));
    if (picked) values[list.key] = picked.id;
    else delete values[list.key];
  }
  return {
    harness,
    command,
    isDefault: !known,
    values,
    secretsSet,
    ignored,
    unknownName: known ? undefined : asked || undefined,
    staleCommand,
  };
}

/** The settings the configured harness declares — the only keys the dialog is
 *  allowed to save into the block. */
export function activeSettings(): HarnessSetting[] {
  return resolveHarness().harness.settings;
}

/** The keys of the configured harness's secret settings that docs/kanban/.env
 *  holds right now. Set or not set — never a key. */
export function activeSecrets(): string[] {
  return resolveHarness().secretsSet;
}

/** Why this setting can't be saved with this value, or null when it can (#95).
 *
 *  Two rules, and both are about the provider pick meaning what it says. A pick
 *  is refused while a box it must have is empty — an endpoint with no base URL
 *  is a pick that would send a run nowhere it named. And a box the picked
 *  provider must have can't be emptied out from under it, for the same reason
 *  from the other side.
 *
 *  A box a provider merely *needs* is never required: a key can be written into
 *  docs/kanban/.env by hand at any moment, so an empty one is not the board's to
 *  call missing — saying a provider has no key yet is #96's.
 *
 *  It lives here, not in the action, because it reads the same declared list the
 *  dialog draws from. The dialog checks it too, to keep the pick from being sent
 *  at all; this is what makes the file right whatever a client does. */
export function settingSaveError(key: string, value: string): string | null {
  const resolved = resolveHarness();
  const { harness, values, secretsSet } = resolved;
  const list = providerSetting(harness.settings);
  if (!list) return null;
  const filled = isFilled(harness, values, secretsSet);
  const label = (k: string) => harness.settings.find((s) => s.key === k)?.label ?? k;

  if (key === list.key) {
    const provider = list.providers?.find((p) => p.id === value);
    if (!provider) return `"${value}" isn't one of the ${list.label.toLowerCase()} choices`;
    const missing = missingRequired(provider, filled);
    if (missing.length) {
      const names = missing.map((k) => `"${label(k)}"`).join(" and ");
      return `${provider.label} needs ${names}. Fill it in and save it, then pick this provider.`;
    }
    return null;
  }

  if (value) return null;
  const picked = activeProviderOf(resolved);
  if (picked?.requires?.includes(key)) {
    return `${picked.label} needs "${label(key)}". Pick another provider first, or give this one a value.`;
  }
  return null;
}

// Each declared setting as this harness's own flag, in the order it declared
// them. The value is always its own argv entry, never joined into the command
// string, and nothing checks it: a bad one is the harness's to reject, and it
// says so in the session log. A setting the command override already names is
// skipped — one flag, one place it comes from — and so is one that reaches the
// run some other way than a flag.
function settingArgs(resolved: ResolvedHarness): string[] {
  const { harness, values, ignored } = resolved;
  const picked = activeProviderOf(resolved);
  return harness.settings.flatMap((setting) => {
    const value = values[setting.key];
    if (!value || !setting.flags?.length || ignored.includes(setting.key)) return [];
    // A setting the picked provider doesn't need isn't drawn in the dialog, so
    // it can't reach the run either — whichever way it would have got there
    // (#95). The pick decides the whole of what a run is given.
    if (!shownForProvider(harness.settings, setting.key, picked)) return [];
    return [setting.flags[0], value];
  });
}

// The environment one run gets, in three steps (#94, #95).
//
// 1. The harness's own environment — the server's, plus whatever that connector
//    always wants.
// 2. Every variable the provider pick owns is dropped. That is the whole point
//    of the pick: a base URL or a key someone exported in their shell months ago
//    can't quietly send a "Claude subscription" run through a gateway while the
//    dialog says otherwise. It covers providers the board doesn't offer yet too
//    (see Harness.providerEnv).
// 3. The picked provider sets what it needs, and nothing else: the settings it
//    names, each under the variable that setting declares — a key read from
//    docs/kanban/.env, everything else from ui.config.json — plus any fixed
//    variables of its own.
//
// A connector with no provider list skips 2 and 3 for the variables no provider
// owns, so its declared keys are set exactly as they were before the pick
// existed.
//
// The keys go in the environment and never in the command: argv is spawned as
// written and would put a key in every process list on the machine, and the
// session log is the agent's own output, which never sees this.
function runEnv(resolved: ResolvedHarness): NodeJS.ProcessEnv {
  const { harness, values } = resolved;
  const picked = activeProviderOf(resolved);
  const env: NodeJS.ProcessEnv = { ...harness.env() };
  for (const name of ownedVars(harness)) delete env[name];

  const file = readEnvFile();
  for (const setting of harness.settings) {
    if (!setting.env) continue;
    if (!shownForProvider(harness.settings, setting.key, picked)) continue;
    const value = setting.kind === "secret" ? file[setting.env] : values[setting.key];
    if (!value) continue;
    env[setting.env] = value;
    const alias = picked?.alsoEnv?.[setting.key];
    if (alias) env[alias] = value;
  }
  return { ...env, ...(picked?.env ?? {}) };
}

// Every variable the provider pick owns, and so every variable a run has dropped
// before the pick sets its own: the ones the connector lists by hand, plus the
// ones its provider-owned settings name. Deriving that second half means adding
// a provider setting can't leave a variable behind by mistake.
function ownedVars(harness: Harness): string[] {
  const names = new Set(harness.providerEnv ?? []);
  const list = providerSetting(harness.settings);
  if (!list) return [...names];
  for (const provider of list.providers ?? []) {
    for (const name of Object.values(provider.alsoEnv ?? {})) names.add(name);
    for (const name of Object.keys(provider.env ?? {})) names.add(name);
    for (const key of provider.needs) {
      const setting = harness.settings.find((s) => s.key === key);
      if (setting?.env) names.add(setting.env);
    }
  }
  return [...names];
}

// --- one read per run -------------------------------------------------------

/** Everything a single run takes from the harness setting. */
export interface ActiveHarness {
  /** The harness's name, stamped onto the session. */
  name: string;
  /** The full argv to spawn, in one fixed order: the configured command, then
   *  its settings' flags, then the harness's own. The registry appends the
   *  prompt as a final argv entry. The harness goes LAST because what it adds
   *  may be a subcommand rather than a flag — `codex exec … resume <id>` — and a
   *  subcommand takes everything after it as its own. */
  argv: string[];
  /** The environment the child runs under. */
  env: NodeJS.ProcessEnv;
  /** A fresh parser for this run's output stream. */
  renderer: StreamRenderer;
  /** The id this harness's CLI resumes by, when it's already known — the
   *  harness adopted the id we generated. Null when the harness mints its own
   *  mid-run; the renderer reports it once it appears. */
  resumeId: string | null;
}

// Read the harness setting ONCE and resolve it into everything the run needs.
// The command, the env, the output parser and the recorded name all come out of
// this single read, so a run can never be split across two harnesses — flipping
// the picker while an agent is working changes what the NEXT run spawns, never
// this one.
export function startRun(sessionId: string): ActiveHarness {
  const resolved = resolveHarness();
  const { harness, command } = resolved;
  const argv = command.split(/\s+/).filter(Boolean);
  return {
    name: harness.name,
    argv: [...argv, ...settingArgs(resolved), ...harness.extraArgs(argv, sessionId)],
    env: runEnv(resolved),
    renderer: harness.renderer(),
    resumeId: harness.adoptsSessionId ? sessionId : null,
  };
}

// Spawn one more turn into a conversation that already happened, instead of a
// fresh one: same command, same env, same parser — only the flags differ, and the
// prompt is RESUME_PROMPT rather than a card action's. Null when this can't be
// done: the harness doesn't resume at all, or the run being resumed belongs to
// another agent. That last rule is why the name is checked — resuming a Claude
// Code conversation with a different CLI would hand it an id that means nothing
// there, so the board offers no resume until that agent is the configured one
// again.
export function resumeRun(harnessName: string, resumeId: string): ActiveHarness | null {
  const resolved = resolveHarness();
  const { harness, command } = resolved;
  if (!harness.resumes || harness.name !== harnessName) return null;
  const argv = command.split(/\s+/).filter(Boolean);
  return {
    name: harness.name,
    argv: [...argv, ...settingArgs(resolved), ...harness.resumeArgs(argv, resumeId)],
    env: runEnv(resolved),
    renderer: harness.renderer(),
    // The resumed turn runs under the id it resumed, so this run can be resumed
    // again by the same id — a failure two turns deep is still recoverable.
    resumeId,
  };
}

/** The name of the harness a run that stopped short can be resumed under right
 *  now — the configured one, if it resumes at all. Read once per registry read; a
 *  session offers Resume only when it ran under this same name. */
export function resumableHarness(): string | null {
  const { harness } = resolveHarness();
  return harness.resumes ? harness.name : null;
}

/** True when this harness ran the session under the id we generated (Claude Code
 *  pins it with `--session-id`). Then the conversation's own id IS our registry
 *  key, so a run under it can always be resumed — nothing had to be reported
 *  mid-run and nothing had to be saved. Only a harness that mints its own id
 *  depends on a recorded one. Named by string because it's asked about a finished
 *  session, which remembers its harness by name. */
export function adoptsSessionId(harnessName: string): boolean {
  const harness = harnessByName(harnessName);
  return !!harness && harness.resumes && harness.adoptsSessionId;
}

// What a resumed run says. The conversation is already there — the card, the
// work done, the error it died on — so this is the "continue" you would type in
// the terminal, not the whole action prompt again.
export const RESUME_PROMPT = [
  `Continue. The previous run ended before it finished the task.`,
  `Pick up where you left off and carry it through.`,
  `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
].join(" ");

/** How a prompt calls the skill under the agent the board runs right now —
 *  `/kanban` for Claude Code, `$kanban` for Codex (#69). Every prompt below
 *  opens with it, and so does the setup line. */
function skillCall(): string {
  return resolveHarness().harness.skillCall;
}

// The one line the setup bar hands the user to paste into their coding harness
// when setup's next step needs the agent (#85). It lives here, beside the other
// harness prompts, because it says how the skill is invoked — and files under
// `skill/` never say that. The wording is one for every harness; only the way
// the skill is called follows the agent, the same as every prompt the board
// sends. The checklist names each step and who does it, never how to invoke
// anything.
//
// It is one line rather than one per step: setup picks up at the first unticked
// box, so the same paste restarts it wherever it stopped. The board never spawns
// this run itself — the user pastes it, and the bar moves when the box ticks.
// The install command ends on a line like this (cli/bin/ai4kanban.mjs), but it
// prints in a terminal that doesn't know which agent you run, so it says
// `/kanban` and stays as it is; the two are separate packages anyway.
export function setupInstruction(): string {
  return `${skillCall()}. Set up this board — follow docs/kanban/setup-checklist.md.`;
}

/** What the Configuration dialog shows and picks from. */
export function agentInfo(): AgentInfo {
  const { harness, command, isDefault, values, secretsSet, ignored, unknownName, staleCommand } =
    resolveHarness();
  return {
    name: harness.name,
    command,
    isDefault,
    values,
    // Which keys are set, and never a key. A saved one is never read back into
    // a browser tab: it buys nothing, and a user who forgot theirs makes a new
    // one.
    secretsSet,
    ignored,
    // Every harness's settings go down, not just the active one's: picking
    // another agent redraws the fields from its own list right away, with
    // nothing filled in, without waiting on the server.
    options: HARNESSES.map(({ name, label, blurb, icon, command, settings }) => ({
      name,
      label,
      blurb,
      icon,
      command,
      settings,
    })),
    unknownName,
    staleCommand,
  };
}

// --- prompts: one place that turns a card action into agent instructions ----
// Every prompt tells the agent to use this repo's ai4kanban skill.

export interface AgentRequest {
  action: AgentAction;
  id?: number;
  title?: string;
  notes?: string; // implement, edit, auto-refine, resolve, archive
  reason?: string; // reject
  description?: string; // create
  release?: string; // create: the version the new card(s) ship in (#104)
  module?: string; // propose: the focus module (a name from modules.md)
  boldness?: Boldness; // propose: how big a swing the 3 tasks take
  andImplement?: boolean; // resolve: keep going and implement once the questions settle
}

// What each boldness level tells a propose run. The rule lives in the skill
// ("Boldness" in `references/propose.md`); these lines name the level and gloss
// it in one clause, so the agent doesn't have to guess what the user meant by
// the word. `normal` is the skill's default size, so it adds nothing.
const BOLDNESS_LINE: Record<Boldness, string> = {
  safe: `Boldness: **safe** (see "Boldness" in references/propose.md) — small moves that polish or fill gaps in what already works.`,
  normal: "",
  bold: `Boldness: **bold** (see "Boldness" in references/propose.md) — each of the 3 is a big leap: a whole new capability for the module, usually broad enough to be a group task.`,
};

// A revision can leave the card rough — its status still short of "ready". This
// line, appended to every prompt that revises a card (edit, resolve, create),
// sends the same run into the auto-refine loop right then, so a touched card
// comes back ready instead of waiting for a separate Auto-refine click.
const AUTO_REFINE_AFTER = `Afterwards, if the card's status is not "ready", auto-refine it following \`references/auto-refine.md\`.`;

// Every action that revises a card revises the CARD — the note says what the
// text should say, not "go build it". Without this line an agent reads a note
// like "make it handle empty input" as the work itself and writes code. The
// escape hatch is the note: one that asks for the change to be made outright
// still gets it. Not on create/propose (they carry their own "create only"
// line) and not on a resolve that was clicked with "and implement".
const NO_IMPLEMENT = `(Unless the task note specifies, don't implement it.)`;

export function buildPrompt(req: AgentRequest): string {
  // How this agent calls the skill — the only part of a prompt that follows
  // the harness. Everything after it is the same for every agent.
  const kb = skillCall();
  const tag = req.id ? `#${req.id}` : "";
  const named = req.title ? `${tag} ("${req.title}")` : tag;
  switch (req.action) {
    case "implement":
      return [
        `${kb}. Implement task ${req.id} ${named}.`,
        req.notes ? `Extra notes: ${req.notes}` : "",
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(" ");
    case "reject":
      return [
        `${kb}. Reject task ${req.id} ${named}. Reason: ${req.reason || "(none given)"}.`,
        `Follow the skill's reject flow.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(" ");
    case "archive":
      return [
        `${kb}. Archive task ${req.id} ${named}.`,
        `Follow the skill's archive flow.`,
        req.notes ? `Extra notes: ${req.notes}` : "",
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(" ");
    case "edit":
      return [
        `${kb}. Revise task ${req.id} ${named}: "${req.notes || ""}" ${NO_IMPLEMENT}`,
        `You can create new subtasks if it's a group task and the intent is to do so.`,
        AUTO_REFINE_AFTER,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(" ");
    case "create":
      return [
        `${kb}. Add task(s) from this requirement: "${req.description || ""}".`,
        `Follow the skill's add-task flow. Create task only, don't implement it.`,
        // The board was showing one release when this was written, so the card
        // ships in it — otherwise it would land at `next`, off the screen of the
        // person who just wrote it.
        req.release ? `Put the new card(s) in the "${req.release}" release: \`--release ${req.release}\`.` : "",
        AUTO_REFINE_AFTER,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(" ");
    case "propose":
      return [
        `${kb}. Propose 3 new tasks following \`references/propose.md\`.`,
        req.module
          ? `Focus on the "${req.module}" module — read its memory set and propose all 3 tasks inside it.`
          : `Pick one focus module yourself (per references/propose.md) and propose all 3 tasks inside it.`,
        // How big a swing the 3 take. The levels are the skill's — see
        // "Boldness" in references/propose.md — so this only names the one the
        // user picked, with a one-clause gloss. `normal` is the skill's own
        // default, so it says nothing.
        BOLDNESS_LINE[req.boldness ?? "normal"],
        `Create the cards only, don't implement them.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(" ");
    case "auto-refine":
      return [
        `${kb}. Auto-refine task ${req.id} ${named} following \`references/auto-refine.md\`.`,
        `Don't ask me questions with human-in-the-loop — the \`[user]\` tag is how you defer to me.`,
        NO_IMPLEMENT,
      ]
        .filter(Boolean)
        .join(" ");
    case "resolve":
      return [
        `${kb}. Resolve the open questions on task ${req.id} ${named} following \`references/resolve.md\`.`,
        req.andImplement
          ? `Then, if resolving settles every question and nothing genuine is left for me to decide, go straight on to implementing the task — one continuous session. But if any real judgment call stays open, stop there and report it: don't implement on a guess.`
          : NO_IMPLEMENT,
        req.notes ? `Extra notes: ${req.notes}` : "",
        AUTO_REFINE_AFTER,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(" ");
  }
}

// The agent no longer runs here. `lib/registry.ts` owns spawning: it starts the
// child, records the session in a shared registry, returns at once, and the UI
// polls the registry for the outcome. See startSession() there.
