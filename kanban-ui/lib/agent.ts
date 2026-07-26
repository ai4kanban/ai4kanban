import fs from "node:fs";
import { uiConfigPath } from "./paths";
import type { AgentAction, AgentInfo } from "./types";

// --- the one place the agent command is configured --------------------------
// Reads the consumer repo's docs/kanban/ui.config.json ({"command": "claude -p"});
// falls back to a plain `claude -p`. Config lives in the project (not next to the
// UI source) so it survives an npx run, where the package itself sits in the npm
// cache. The command is split into argv on spaces (the default has no quoted
// args) and spawned WITHOUT a shell — the prompt is always a separate argv entry,
// so it never needs escaping and can't be shell-injected.
function resolveCommand(): { command: string; isDefault: boolean } {
  const configFile = uiConfigPath();
  try {
    if (fs.existsSync(configFile)) {
      const cfg = JSON.parse(fs.readFileSync(configFile, "utf8"));
      if (typeof cfg.command === "string" && cfg.command.trim()) {
        return { command: cfg.command.trim(), isDefault: false };
      }
    }
  } catch {
    // keep the default on any parse error
  }
  return { command: "claude -p", isDefault: true };
}

// The command split into argv (binary + fixed args), ready for spawn. The
// registry appends the prompt as a final argv entry. Exported so the registry
// (which owns the running of agents now) shares this one resolution.
//
// `claude -p` in its default text mode prints nothing until the session ends, so
// a live tail would stay empty the whole time. Ask claude to stream NDJSON
// events instead (lib/stream.ts renders them into log lines). We also pin the
// session id: `--session-id <id>` makes Claude Code adopt the id we generated up
// front, so the registry key IS Claude Code's own session id — the exact id the
// "resume in claude code" handoff copies (`claude --resume <id>`). Both only for
// a claude binary, and never overriding flags the user configured.
export function agentArgv(sessionId?: string): string[] {
  const argv = resolveCommand().command.split(/\s+/).filter(Boolean);
  if (/(^|\/)claude$/.test(argv[0] ?? "")) {
    if (!argv.includes("--output-format")) argv.push("--output-format", "stream-json", "--verbose");
    if (sessionId && !argv.includes("--session-id")) argv.push("--session-id", sessionId);
  }
  return argv;
}

// True when the configured agent is the Claude Code CLI — the only agent whose
// session is resumable (`claude --resume <id>`), so the only one the UI offers a
// handoff for. A custom command still gets a unique session id (the registry
// key), it just can't be resumed.
export function isClaudeAgent(): boolean {
  const bin = resolveCommand().command.split(/\s+/)[0] ?? "";
  return /(^|\/)claude$/.test(bin);
}

// What the UI shows for "which agent runs the work". We only support a Claude
// Code subscription today, so the name is friendly when the command is `claude`
// and otherwise just echoes the configured binary.
export function agentInfo(): AgentInfo {
  const { command, isDefault } = resolveCommand();
  const bin = command.split(/\s+/)[0] || "claude";
  const name = /(^|\/)claude$/.test(bin) ? "Claude Code" : bin;
  return { name, command, isDefault };
}

// --- prompts: one place that turns a card action into agent instructions ----
// Every prompt tells the agent to use this repo's ai4kanban skill. The skill's
// script lives behind a symlink, so id-touching moves (create/archive/reject)
// must run it with `node --preserve-symlinks-main .claude/skills/kanban/kanban.mjs`.
const SCRIPT = "node --preserve-symlinks-main .claude/skills/kanban/kanban.mjs";

export interface AgentRequest {
  action: AgentAction;
  id?: number;
  title?: string;
  notes?: string; // implement, edit, auto-refine, resolve, archive
  reason?: string; // reject
  description?: string; // create
  module?: string; // propose: the focus module (a name from modules.md)
  andImplement?: boolean; // resolve: keep going and implement once the questions settle
}

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
        `Create the cards only, don't implement them.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(" ");
    case "auto-refine":
      return [
        `/kanban. Auto-refine task ${req.id} ${named} following \`references/auto-refine.md\`: triage and answer its open questions, then move the plan one step forward.`,
        `For each untagged question, spawn a fresh subagent to answer it objectively; tag the ones only I can decide \`[user]\` (\`kanban tag ${req.id} <n> user\`) and leave them for me.`,
        req.notes ? `Extra notes: ${req.notes}` : "",
        `Don't ask me questions with human-in-the-loop — the \`[user]\` tag is how you defer to me.`,
      ]
        .filter(Boolean)
        .join(" ");
    case "resolve":
      return [
        `/kanban. Resolve the open questions on task ${req.id} ${named} following \`references/resolve.md\`.`,
        req.andImplement
          ? `Then, if resolving settles every question and nothing genuine is left for me to decide, go straight on to implement the task following the skill's implement flow — one continuous session. But if any real judgment call stays open, stop there and report it: don't implement on a guess.`
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
