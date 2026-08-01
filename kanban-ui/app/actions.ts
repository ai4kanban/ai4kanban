"use server";

// Server Actions — this is a local server, so the client calls these directly
// instead of going through HTTP API routes. Reads the board, fires an agent, and
// applies direct edits, all against the markdown files in docs/kanban/.

import { type AgentRequest, buildPrompt, HARNESSES } from "@/lib/agent";
import { readBoard } from "@/lib/board";
import { setAutoRefine, setAutoRefineParallelism, setHarness, setHarnessModel } from "@/lib/config";
import { ensureDispatcher } from "@/lib/dispatcher";
import { patchCard, type CardPatch } from "@/lib/edit";
import { readGoalText, writeGoalText } from "@/lib/goal";
import { tickSetupStep } from "@/lib/setup";
import { type MetricsResult, readMetrics } from "@/lib/metrics";
import { readModules } from "@/lib/modules";
import {
  getSession,
  listSessions,
  resumeSession,
  startSession,
  type StartResult,
  stopSession,
} from "@/lib/registry";
import type { Board, SessionView } from "@/lib/types";

export async function getBoard(): Promise<Board> {
  return readBoard();
}

// The module names from docs/kanban/modules.md, for the create dialog's picker
// (#38). Same shape as getBoard: a server action the client calls directly.
export async function getModules(): Promise<string[]> {
  return readModules();
}

// The actions a client button can start. `auto-refine` is one of them (#99): the
// card page's Refine button starts the very run the background dispatcher
// (lib/dispatcher.ts) starts on its own — same action, same prompt — so a user
// can refine the card in front of them instead of waiting for its turn. It never
// waits for a free slot from the "cards at once" setting either; that setting is
// the dispatcher's own budget, and this run isn't the dispatcher's.
const ACTIONS = new Set([
  "implement",
  "reject",
  "archive",
  "edit",
  "create",
  "resolve",
  "propose",
  "auto-refine",
]);

// create and propose touch no existing card (create makes one, propose makes
// three), so they carry no `id` — every other action needs one.
const CARDLESS = new Set(["create", "propose"]);

// Start an agent and return immediately with a sessionId (or a lock message). The
// request never waits for the child — the client polls listSessionsAction() to
// see the session's progress and outcome.
export async function startAgentAction(req: AgentRequest): Promise<StartResult> {
  if (!req || !ACTIONS.has(req.action)) throw new Error("unknown action");
  if (!CARDLESS.has(req.action) && !Number.isInteger(req.id)) {
    throw new Error("action needs a card id");
  }
  const prompt = buildPrompt(req);
  return startSession(req, prompt);
}

// Continue a failed run's conversation: a new session on the same card and the
// same action, spawned with the agent's resume flags and a "continue" prompt.
// Returns the NEW session's id (or a refusal message) exactly like starting one,
// so the panel can select it and watch it the same way. The registry re-checks
// that the run really did fail and really can be resumed — the button is drawn
// from a poll that's up to a second and a half stale.
export async function resumeSessionAction(sessionId: string): Promise<StartResult> {
  if (typeof sessionId !== "string" || !sessionId) return { ok: false, error: "no session given" };
  return resumeSession(sessionId);
}

// End a running agent (#49): ask its process to stop, kill it if it doesn't, and
// close the run out as `stopped`. The run's half-finished edits are left in the
// working tree — the board never undoes work. Reports ok for a run that already
// ended, since the button is drawn from a poll that can be a second and a half
// stale.
export async function stopSessionAction(sessionId: string): Promise<StartResult> {
  if (typeof sessionId !== "string" || !sessionId) return { ok: false, error: "no session given" };
  return stopSession(sessionId);
}

// The shared session registry, for the UI's poll. Every tab reads the same picture.
// The UI polls this continuously, so it's also where we make sure the background
// auto-refine dispatcher (#43) is running — idempotent, so a poll from any tab
// keeps it alive for the life of the UI server.
export async function listSessionsAction(): Promise<SessionView[]> {
  ensureDispatcher();
  return listSessions();
}

// One session with its log tail, read from the log file. The UI polls this while
// a session is live to tail its output, and calls it once to open a finished
// session's log.
export async function getSessionAction(sessionId: string): Promise<SessionView | null> {
  if (typeof sessionId !== "string" || !sessionId) return null;
  return getSession(sessionId);
}

// The goal editor behind the setup bar (#53, #85). Reading returns the user's
// words (template body when goal.md doesn't exist yet); saving writes them back
// with the frontmatter — the agent's `reviewed:` field — untouched.
export async function getGoalAction(): Promise<string> {
  return readGoalText();
}

// Writing the goal IS setup's goal step, so a save ticks that box — the one box
// the board finishes itself. On a board with no checklist the tick is a no-op,
// which is the whole of the "a goal judged weak long after setup" case.
export async function saveGoalAction(text: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, error: "the goal must not be empty" };
  }
  const res = writeGoalText(text);
  if (res.ok) tickSetupStep("goal");
  return res;
}

// The daily progress view (#65) — the last 30 days of docs/kanban/metrics.csv.
// Read once each time the view opens; the file changes a few times a day at
// most, so there's nothing to poll. A file that can't be read comes back as
// { ok:false, error }, the way the other actions report failures, so the
// message survives to the client instead of becoming a server-render error.
export async function getMetricsAction(): Promise<MetricsResult> {
  return readMetrics();
}

export async function patchCardAction(
  id: number,
  patch: CardPatch,
): Promise<{ ok: boolean; error?: string }> {
  return patchCard(id, patch);
}

// Flip the global auto-refine switch (#41), persisted to docs/kanban/ui.config.json.
// Returns { ok:false, error } on a parse/write failure so the toggle can revert
// and surface the message; keeps the `harness` setting untouched.
export async function setAutoRefineAction(on: boolean): Promise<{ ok: boolean; error?: string }> {
  return setAutoRefine(Boolean(on));
}

// Save how many cards auto-refine works on at once (#88), persisted to the same
// file. The number is clamped into the allowed range rather than refused, so a
// stale client can't write a setting the dispatcher would have to second-guess;
// anything that isn't a number is refused outright.
export async function setAutoRefineParallelismAction(
  n: number,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return { ok: false, error: "how many refine at once must be a number" };
  }
  return setAutoRefineParallelism(n);
}

// Save the agent the user picked in the Configuration dialog (#68), persisted to
// the same file. The name is checked against the harnesses this build ships, so
// a stale client can't write a setting nothing can run. Running sessions are
// untouched — each read the setting when it started.
export async function setHarnessAction(name: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof name !== "string" || !HARNESSES.some((h) => h.name === name)) {
    return { ok: false, error: `unknown agent "${name}"` };
  }
  return setHarness(name);
}

// Save the model id typed in the Configuration dialog (#71), persisted to the
// same file. Free text: model ids change between agent releases, so the board
// checks nothing beyond it being a string — the agent is the only validator, and
// a bad id shows up as a failed run with the reason in its log. Empty clears the
// setting, and the agent runs its own default.
export async function setHarnessModelAction(model: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof model !== "string") return { ok: false, error: "the model must be text" };
  return setHarnessModel(model);
}
