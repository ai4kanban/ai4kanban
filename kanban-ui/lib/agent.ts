import { boardRules, type AgentRequest, type CommandRequest } from "./cli";
import type { AgentInfo, HarnessSetting, LoggedOutAgent, RunPick } from "./types";

// --- which agent runs, and the words it is sent (#168) -----------------------
// All of it lives in the CLI now — the connectors, what each one takes, how the settings
// resolve into a command and an environment, and every prompt the board sends. This is the
// board's door onto that one copy, so the dialog and a terminal can never disagree about
// which agent runs or what a run says.
//
// Everything here is async because the rules are loaded from the built file the project
// has (lib/cli.ts). Nothing else about them changed.

export type { AgentRequest, CommandRequest } from "./cli";

/** Turn a public command into the one agent session it starts now. */
export async function prepareAgentRequest(req: CommandRequest): Promise<AgentRequest> {
  if (req.action !== "refine") return req as AgentRequest;
  const prepare = (await boardRules()).refinementRequest;
  // An older installed command still knows refine as one session.
  if (!prepare) return req as unknown as AgentRequest;
  const result = prepare(req);
  if ("error" in result) throw new Error(result.error);
  return result;
}

/** Which agent runs the board, what it is set to, and what it could be switched to —
 *  including the settings each of those agents takes, so the dialog draws them without
 *  keeping a list of its own. */
export async function agentInfo(): Promise<AgentInfo> {
  const rules = await boardRules();
  return rules.agentInfo() as unknown as AgentInfo;
}

/** Which installed agents their own CLI says nobody is logged into, each with the command
 *  that logs them back in (#392). A second look, taken apart from `agentInfo` because it
 *  spawns those CLIs: it is never on a page load, and it gates nothing.
 *
 *  Empty on rules from before it existed, and empty whenever nothing could be read — the
 *  wrong way to fail here is warning about an agent that works. */
export async function loggedOutAgents(): Promise<LoggedOutAgent[]> {
  const rules = await boardRules();
  return (await rules.loggedOutAgents?.()) ?? [];
}

/** The agents this machine could run right now (#404), in declared order — installed, and
 *  needing no setting that isn't filled in. The first run tries them one at a time instead of
 *  opening on a form. It spawns nothing: it is the PATH read `agentInfo` already makes.
 *
 *  Empty on rules from before it existed, which is a first run that opens on the picker the
 *  way it always did. */
export async function runnableAgents(): Promise<string[]> {
  const rules = await boardRules();
  // The connectors, not the runtimes: the probe picks the harness Global default runs, and a
  // board that has never been set up holds one runtime, so its own list has nothing to walk
  // (#467). Rules from before runtimes answer connector names out of `runnableAgents`.
  return (rules.runnableHarnesses ?? rules.runnableAgents)?.() ?? [];
}

/** What the board shows when there is no copy of the rules to load: no agent, and nothing
 *  to switch to. The board still reads and edits cards — only the runs are out of reach,
 *  and the refusal a run comes back with is what says so, in words that name the fix. */
export const NO_AGENT: AgentInfo = {
  name: "",
  command: "",
  isDefault: true,
  values: {},
  secretsSet: [],
  ignored: [],
  runtimes: [],
  options: [],
  machine: "",
  flows: [],
};

/** Whose settings a save is judged against. `runtime` is one row of the board's list (#468);
 *  `harness` is one connector, narrowed to its own rows the way `agentInfo().options` reads
 *  them, so a harness no runtime is on declares its settings and holds no values. Neither is
 *  Global default. */
export type SettingsAsk = { runtime?: string; harness?: string };

/** The settings behind one row or one connector — the only keys a save is allowed to write,
 *  so Codex's settings are judged by Codex's rules whichever runtime runs it. */
export async function activeSettings(on: SettingsAsk = {}): Promise<HarnessSetting[]> {
  const rules = await boardRules();
  return rules.activeSettings(ask(on)) as unknown as HarnessSetting[];
}

/** Why this setting can't be saved with this value, or null when it can. Judged against the
 *  same row `activeSettings` reads. */
export async function settingSaveError(
  key: string,
  value: string,
  on: SettingsAsk = {},
): Promise<string | null> {
  const rules = await boardRules();
  return rules.settingSaveError(key, value, ask(on));
}

// A runtime is named by its id alone — narrowing to a harness would send the read to that
// harness's FIRST row, which on a list where two rows share one CLI is another row entirely.
const ask = ({ runtime, harness }: SettingsAsk) =>
  runtime ? { pin: runtime } : harness ? { pin: harness, harness } : {};

/** What one flow would run on, and what it could be started on instead (#518): the runtime
 *  its own agent is set to, and every runtime the board holds. Null on rules from before it,
 *  where a run has no runtime to be pointed at and the sheet draws no picker. */
export async function runRuntimePick(flow: string): Promise<RunPick | null> {
  const rules = await boardRules();
  return rules.runRuntimePick?.(flow) ?? null;
}

/** What one board action says to the agent. */
export async function buildPrompt(req: AgentRequest): Promise<string> {
  const rules = await boardRules();
  return rules.buildPrompt(req);
}

/** The one line the board hands the user to paste into their coding agent for the setup
 *  steps an agent does. It follows the picked agent, since only the way the skill is
 *  called differs between them. */
export async function setupInstruction(): Promise<string> {
  const rules = await boardRules();
  return rules.setupInstruction();
}
