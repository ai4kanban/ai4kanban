"use server";

// Server Actions — this is a local server, so the client calls these directly
// instead of going through HTTP API routes. Reads the board, fires an agent, and
// applies direct edits, all against the markdown files in docs/kanban/.

import {
  activeSecrets,
  activeSettings,
  type AgentRequest,
  buildPrompt,
  HARNESSES,
  settingSaveError,
} from "@/lib/agent";
import { readBoard } from "@/lib/board";
import { setAutoRefine, setAutoRefineParallelism, setHarness, setHarnessSetting } from "@/lib/config";
import { ensureDispatcher } from "@/lib/dispatcher";
import { dropPlan, type DropPlan, dropRelease } from "@/lib/drop";
import { patchCard, type CardPatch } from "@/lib/edit";
import { fillPlan, type FillPlan, fillRelease } from "@/lib/fill";
import { readGoalText, writeGoalText } from "@/lib/goal";
import { tickSetupStep } from "@/lib/setup";
import { type MetricsResult, readMetrics } from "@/lib/metrics";
import { readModules } from "@/lib/modules";
import { addRelease } from "@/lib/releases";
import { setSecret } from "@/lib/secrets";
import { testConnection } from "@/lib/test-connection";
import {
  getSession,
  listSessions,
  resumeSession,
  startSession,
  type StartResult,
  stopSession,
} from "@/lib/registry";
import type { Board, ConnectionTest, SessionView } from "@/lib/types";

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
// several), so they carry no `id` — every other action needs one.
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

// Start a release from the header's New release entry (#115) — one line appended
// to docs/kanban/releases.md, the same line `release new` writes.
//
// No agent run: a release is a name and its place in the order, so there is
// nothing for an agent to decide, and a run answers minutes later in a log —
// which cannot refuse a bad name in the dialog the user is still typing in. The
// UI already writes a card's release and the goal file the same direct way.
//
// A name that can't be a release comes back as { ok:false, error } rather than
// throwing, so the dialog shows why and stays open on what was typed.
//
// `fill` is the dialog's toggle (#106): the high-priority cards with no release go in
// as the release is made — the same move `release new <id> --fill` makes. It
// runs only after the release is really on the list, so a refused name moves
// nothing.
export async function createReleaseAction(id: string, fill = false): Promise<{ ok: boolean; error?: string }> {
  if (typeof id !== "string") return { ok: false, error: "a version id is text" };
  const res = addRelease(id);
  if (res.ok && fill === true) fillRelease(id.trim());
  return res;
}

// What the fill would do right now — the New release dialog reads this as it
// opens, so the toggle carries the number of cards before the release is made.
export async function fillPlanAction(): Promise<FillPlan> {
  return fillPlan();
}

// Which open cards a drop would strip of their release — the confirm dialog reads
// this as it opens (#131), so the user sees the move before anything is written.
export async function dropPlanAction(id: string): Promise<DropPlan> {
  if (typeof id !== "string" || !id) return { left: [] };
  return dropPlan(id);
}

// Give up on a release from the header's picker (#131) — the same move `release
// drop` makes: one dated `## Dropped` section in the summary file, the open
// cards' release cleared, the line off the list. Direct, like starting a release:
// there is nothing for an agent to decide, and a stale board — the release
// already gone — comes back as { ok:false, error } for the dialog to show.
export async function dropReleaseAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof id !== "string" || !id.trim()) return { ok: false, error: "no release named" };
  return dropRelease(id.trim());
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

// Which of the picked agent's keys docs/kanban/.env holds (#94) — the setting
// keys, never a key itself. The dialog asks after switching agents, because the
// agent it just switched to declares its own keys and the file is the only
// thing that knows which of them are set.
export async function getHarnessSecretsAction(): Promise<string[]> {
  return activeSecrets();
}

// Save one of the settings the picked agent declares (#93), persisted to the
// same file. The key is checked against that agent's own list, so nothing can
// write a key it never declared — including a field the user left focused while
// switching agents, whose late save belongs to an agent that is no longer
// picked.
//
// The value is checked only as far as the setting's shape allows: a list must be
// given one of its own choices, a box takes free text. Model ids change between
// agent releases, so a text setting is never validated here — the agent is the
// only validator, and a bad id shows up as a failed run with the reason in its
// log. Empty clears the setting, and the agent runs its own default.
export async function setHarnessSettingAction(
  key: string,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a setting is saved as text" };
  }
  const setting = activeSettings().find((s) => s.key === key);
  if (!setting) return { ok: false, error: `the agent you picked has no "${key}" setting` };
  // A key never goes near ui.config.json — it has its own action and its own
  // file (#94). Refused here rather than quietly rerouted: a client sending a
  // key down this path has a bug, and the file it would land in is committed.
  if (setting.kind === "secret") {
    return { ok: false, error: `"${setting.label}" is a key — it saves to docs/kanban/.env` };
  }
  const next = value.trim();
  if (setting.kind === "select" && next && !setting.choices?.some((c) => c.value === next)) {
    return { ok: false, error: `"${next}" isn't one of the ${setting.label} choices` };
  }
  // The provider pick, and the boxes it can't do without (#95). A pick that
  // names no provider we ship, one whose base URL is still empty, and a base URL
  // emptied while that pick is live are all refused here — so whatever a client
  // does, the file never says a run goes somewhere it can't go.
  const wrong = settingSaveError(key, next);
  if (wrong) return { ok: false, error: wrong };
  return setHarnessSetting(key, next);
}

// Save one of the picked agent's keys (#94) to docs/kanban/.env — the board's
// one place for them. An empty value clears it, and the agent goes back to
// whatever login its CLI has of its own.
//
// The key is written to that file and nowhere else: not ui.config.json, not the
// registry, not a run's log. Nothing comes back but ok — the value is never
// returned, echoed, or read back into the browser. The setting has to be one
// the picked agent declares as a secret, so a field left focused while
// switching agents can't write a key the new agent never asked for.
export async function setHarnessSecretAction(
  key: string,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a key is saved as text" };
  }
  const setting = activeSettings().find((s) => s.key === key);
  if (!setting || setting.kind !== "secret" || !setting.env) {
    return { ok: false, error: `the agent you picked has no "${key}" key` };
  }
  return setSecret(setting.env, value);
}

// Send one small chat through the setup that is saved right now and say whether
// it worked (#96) — the Test button in the Configuration dialog.
//
// It takes no arguments on purpose: there is nothing for the client to say. The
// setup being tested is the one in the files, which is the one the next card run
// will use, so a client can neither test something else nor test something that
// isn't saved.
//
// It touches no card, holds no lock and starts no session — see
// lib/test-connection.ts. It never throws either: every way it can go wrong is a
// result the panel shows.
export async function testConnectionAction(): Promise<ConnectionTest> {
  return testConnection();
}
