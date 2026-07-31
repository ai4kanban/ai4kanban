import fs from "node:fs";
import { uiConfigPath } from "./paths";
import { createStreamRenderer, type StreamRenderer } from "./stream";
import type { AgentAction, AgentInfo, Boldness, HarnessOption } from "./types";

// --- the harnesses ----------------------------------------------------------
// A harness is one way to run an agent, and everything that differs between two
// of them lives behind this interface: the command, the flags that make it
// stream, the env it needs, how its output is parsed, how a finished session is
// resumed, and how it shows up in the Configuration dialog. Adding a harness is
// adding one object to HARNESSES — nothing outside this file learns its name.

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
  /** Every flag name this harness's CLI takes for a model id, the one we append
   *  first. Each agent names its own — Claude Code `--model`, Codex `--model`
   *  and `-m` — so one shared rule would miss a flag. The whole list is what a
   *  command override is scanned for: an override that already names a model
   *  wins, and the model setting is not appended. */
  modelFlags: string[];
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
  blurb: "Subscription plan",
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

  modelFlags: ["--model"],

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
};

/** Every harness the UI can run, in the order the dialog lists them. */
export const HARNESSES: Harness[] = [CLAUDE_CODE];

/** What runs when the config names no harness, or names one we don't know. */
export const DEFAULT_HARNESS = CLAUDE_CODE;

function harnessByName(name: string | undefined): Harness | undefined {
  return HARNESSES.find((h) => h.name === name);
}

// --- the harness setting ----------------------------------------------------
// Reads the consumer repo's docs/kanban/ui.config.json:
//
//   "harness": { "name": "claude-code", "model": "claude-opus-5", "command": "claude -p" }
//
// `name` picks the harness; `model` is the model id it runs with, empty or
// missing meaning the harness's own default (#71); `command` is an optional
// override for a custom binary or extra flags, hand-edited in the file (the
// dialog writes the name and the model, never the command). All three belong to
// the harness that is picked — a model id for one agent means nothing to
// another — so switching harness drops the model and the command with it.
// Config lives in the project (not next to the UI source) so it survives an npx
// run, where the package itself sits in the npm cache. The command is split into
// argv on spaces (no quoted args) and spawned WITHOUT a shell — the prompt and
// the model id are always separate argv entries, so they never need escaping and
// can't be shell-injected.

interface ResolvedHarness {
  harness: Harness;
  command: string;
  isDefault: boolean;
  /** The model id to run with, or "" for the harness's own default. */
  model: string;
  /** The command override already names a model flag, so it wins and the model
   *  setting is never appended. True whether or not a model is set — the dialog
   *  says the field isn't in effect before the user types into it. */
  modelIgnored: boolean;
  /** The name the file asked for, when it isn't one of ours. */
  unknownName?: string;
  /** The file still holds the pre-#68 top-level `command` key. Nothing reads it. */
  staleCommand?: boolean;
}

/** True when this argv already names a model for this harness — `--model id` or
 *  `--model=id`, in any of the flag names that harness answers to. */
function namesModel(argv: string[], flags: string[]): boolean {
  return argv.some((tok) => flags.some((flag) => tok === flag || tok.startsWith(`${flag}=`)));
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
  const setting = (cfg.harness ?? {}) as { name?: unknown; command?: unknown; model?: unknown };
  const asked = typeof setting.name === "string" ? setting.name.trim() : "";
  const override = typeof setting.command === "string" ? setting.command.trim() : "";
  const model = typeof setting.model === "string" ? setting.model.trim() : "";
  const known = harnessByName(asked);
  const harness = known ?? DEFAULT_HARNESS;
  const command = known ? override || known.command : DEFAULT_HARNESS.command;
  return {
    harness,
    command,
    isDefault: !known,
    model,
    modelIgnored: namesModel(command.split(/\s+/).filter(Boolean), harness.modelFlags),
    unknownName: known ? undefined : asked || undefined,
    staleCommand,
  };
}

// --- one read per run -------------------------------------------------------

/** Everything a single run takes from the harness setting. */
export interface ActiveHarness {
  /** The harness's name, stamped onto the session. */
  name: string;
  /** The full argv to spawn: the configured command, then the harness's own
   *  flags. The registry appends the prompt as a final argv entry. */
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
  const { harness, command, model, modelIgnored } = resolveHarness();
  const argv = command.split(/\s+/).filter(Boolean);
  // The model setting, as this harness's own flag — its id always a separate
  // argv entry, never joined into the command string. Nothing checks the id: a
  // bad one is the harness's to reject, and it says so in the session log.
  // A command override that already names a model wins, and we append nothing.
  const modelArgs = model && !modelIgnored ? [harness.modelFlags[0], model] : [];
  return {
    name: harness.name,
    argv: [...argv, ...harness.extraArgs(argv, sessionId), ...modelArgs],
    env: harness.env(),
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
  const { harness, command, model, modelIgnored } = resolveHarness();
  if (!harness.resumes || harness.name !== harnessName) return null;
  const argv = command.split(/\s+/).filter(Boolean);
  const modelArgs = model && !modelIgnored ? [harness.modelFlags[0], model] : [];
  return {
    name: harness.name,
    argv: [...argv, ...harness.resumeArgs(argv, resumeId), ...modelArgs],
    env: harness.env(),
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

/** What the Configuration dialog shows and picks from. */
export function agentInfo(): AgentInfo {
  const { harness, command, isDefault, model, modelIgnored, unknownName, staleCommand } = resolveHarness();
  return {
    name: harness.name,
    command,
    isDefault,
    model,
    modelIgnored,
    options: HARNESSES.map(({ name, label, blurb, icon, command }) => ({ name, label, blurb, icon, command })),
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

export function buildPrompt(req: AgentRequest): string {
  const tag = req.id ? `#${req.id}` : "";
  const named = req.title ? `${tag} ("${req.title}")` : tag;
  switch (req.action) {
    case "implement":
      return [
        `/kanban. Implement task ${req.id} ${named}.`,
        req.notes ? `Extra notes: ${req.notes}` : "",
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(" ");
    case "reject":
      return [
        `/kanban. Reject task ${req.id} ${named}. Reason: ${req.reason || "(none given)"}.`,
        `Follow the skill's reject flow.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(" ");
    case "archive":
      return [
        `/kanban. Archive task ${req.id} ${named}.`,
        `Follow the skill's archive flow.`,
        req.notes ? `Extra notes: ${req.notes}` : "",
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(" ");
    case "edit":
      return [
        `/kanban. Revise task ${req.id} ${named}: "${req.notes || ""}".`,
        `Only revise the card — don't implement it, and don't archive, or reject it.`,
        `You can create new subtasks if it's a group task and the intent is to do so.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(" ");
    case "create":
      return [
        `/kanban. Add task(s) from this requirement: "${req.description || ""}".`,
        `Follow the skill's add-task flow. Create task only, don't implement it.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(" ");
    case "propose":
      return [
        `/kanban. Propose 3 new tasks following \`references/propose.md\`.`,
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
        `/kanban. Auto-refine task ${req.id} ${named} following \`references/auto-refine.md\`.`,
        `Don't ask me questions with human-in-the-loop — the \`[user]\` tag is how you defer to me.`,
      ]
        .filter(Boolean)
        .join(" ");
    case "resolve":
      return [
        `/kanban. Resolve the open questions on task ${req.id} ${named} following \`references/resolve.md\`.`,
        req.andImplement
          ? `Then, if resolving settles every question and nothing genuine is left for me to decide, go straight on to implementing the task — one continuous session. But if any real judgment call stays open, stop there and report it: don't implement on a guess.`
          : "",
        req.notes ? `Extra notes: ${req.notes}` : "",
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(" ");
  }
}

// The agent no longer runs here. `lib/registry.ts` owns spawning: it starts the
// child, records the session in a shared registry, returns at once, and the UI
// polls the registry for the outcome. See startSession() there.
