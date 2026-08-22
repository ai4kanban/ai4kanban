import { boardRules, type AgentRequest, type RunView } from "./cli";
import type { SessionView } from "./types";

// --- the runs, through the CLI (#168) ----------------------------------------
// The board no longer runs agents itself. Starting one, watching it, listing them,
// stopping one and continuing one all go through the CLI, and so does the record they live
// in — docs/kanban/.sessions.json, which every process reads and writes.
//
// That is what makes a card being implemented from a terminal show as busy here, and a run
// started here stoppable from a terminal. It is also why the board's rules hold across the
// two: one run per card, one create at a time, and the runs that rewrite shared board files
// waiting for each other. None of those are enforced here any more — they are enforced in
// the one place that sees every run.
//
// What is left in this file is the shape the browser reads. A run's record and the view the
// UI has always had are nearly the same object; the few differences are below.

export interface StartResult {
  ok: boolean;
  sessionId?: string;
  error?: string;
}

// One run as the browser reads it. The record carries a couple of fields the UI has no use
// for (where the log file is, which agent the run was pinned to internally), and the UI
// wants the log under the name it has always used.
function toView(run: RunView): SessionView {
  return {
    sessionId: run.sessionId,
    cardId: run.cardId,
    action: run.action as SessionView["action"],
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    durationMs: run.durationMs,
    costUsd: run.status !== "running" ? run.costUsd : undefined,
    usage: run.status !== "running" ? run.usage : undefined,
    model: run.model,
    input: run.input,
    harness: run.harness,
    canResume: run.canResume,
    resumedFrom: run.resumedFrom,
    ok: run.ok,
    code: run.code,
    error: run.error,
    result: run.status !== "running" ? run.result : undefined,
    note: run.status !== "running" ? run.note : undefined,
    tail: run.tail,
  };
}

// Write the run down, then hand it to a process of its own. The two steps are the CLI's,
// and they are the same two `akb implement 12` takes — which is the point: a run started
// from a button and one started in a terminal are the same run, watched the same way, and
// both outlive whatever asked for them.
async function launch(open: (rules: Awaited<ReturnType<typeof boardRules>>) => { run: { sessionId: string } } | { error: string }): Promise<StartResult> {
  let rules;
  try {
    rules = await boardRules();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const opened = open(rules);
  if ("error" in opened) return { ok: false, error: opened.error };
  const { sessionId } = opened.run;
  const pid = rules.spawnWatcher(sessionId);
  rules.markSpawned(sessionId, pid);
  if (!pid) return { ok: false, error: "couldn't start a process for that run" };
  return { ok: true, sessionId };
}

/** Start an agent and return at once with a run id (or a refusal). Nothing waits for the
 *  child — the UI polls listSessions() to see how it goes. */
export async function startSession(req: AgentRequest, prompt: string): Promise<StartResult> {
  return launch((rules) => rules.openRun(req, prompt));
}

/** Continue a run that stopped short: a new run on the same card and the same action,
 *  spawned with the agent's resume flags and a "carry on" prompt. It replaces the run it
 *  continues, so the panel keeps one row for the work rather than a chain of dead
 *  attempts. */
export async function resumeSession(sessionId: string): Promise<StartResult> {
  return launch((rules) => rules.openResume(sessionId));
}

/** End a running agent: ask its process to stop, kill it if it doesn't, and close the run
 *  out as `stopped`. Reports ok for a run that already ended, since the button is drawn
 *  from a poll that can be a second and a half stale. */
export async function stopSession(sessionId: string): Promise<StartResult> {
  try {
    return (await boardRules()).stopRun(sessionId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Every run the board knows about. One picture, shared by every tab and every terminal. */
export async function listSessions(): Promise<SessionView[]> {
  try {
    return (await boardRules()).listRuns().map(toView);
  } catch {
    // No rules to load: the board has no runs to show and says why elsewhere, rather than
    // failing the poll that draws the whole page.
    return [];
  }
}

/** One run with its log, read from the file — so this works on a run this process never
 *  started, and on one that outlived the process that did. */
export async function getSession(sessionId: string): Promise<SessionView | null> {
  try {
    const run = (await boardRules()).getRun(sessionId);
    return run ? toView(run) : null;
  } catch {
    return null;
  }
}
