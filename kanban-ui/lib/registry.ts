import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  type ActiveHarness,
  adoptsSessionId,
  type AgentRequest,
  RESUME_PROMPT,
  resumableHarness,
  resumeRun,
  startRun,
} from "./agent";
import { allCards, findCard } from "./board";
import { kanbanDir, repoRoot } from "./paths";
import type { StreamRenderer } from "./stream";
import type { AgentAction, CardStatus, SessionView } from "./types";

// The server-side session registry. One local UI server = one process, so this
// in-memory map is shared by every browser tab: a tab that refreshes, or a
// second tab, re-reads the same sessions. It gives the UI a single correct
// picture of what every agent is doing, holds the per-card and board-index
// locks, and survives a UI restart via a small gitignored file (each session's
// pid).
//
// Why globalThis: Next may evaluate this module more than once across its server
// bundles. Pinning the state to globalThis keeps it a true singleton so two
// bundles can't hold two registries (and two locks).

// create / propose / archive / reject all rewrite shared files through the skill
// script (next-id, the README index, metrics.csv). Run two at once and they
// corrupt each other even on different cards — so these serialize behind one
// lock. Propose allocates several ids in one run, so it belongs here too.
const INDEX_ACTIONS = new Set<AgentAction>(["create", "propose", "archive", "reject"]);

// Actions that may run only one at a time across the whole board. A create has
// no card yet, so the per-card lock can't catch a duplicate — and the registry
// is shared by every tab (one UI server = one process), so this refuses a second
// create instead of silently queuing it behind the index lock. Survives a UI
// restart too: an in-flight create is re-adopted as a running session before the
// guard checks. This is the "single global create" rule — no separate lock file
// needed, the registry (persisted to .sessions.json) is already the source of
// truth.
const SINGLETON_ACTIONS = new Set<AgentAction>(["create", "propose"]);

// Past-tense verb for the "already running" message, e.g. "#5 is already being
// implemented".
const VERB: Record<AgentAction, string> = {
  implement: "implemented",
  reject: "rejected",
  archive: "archived",
  edit: "edited",
  create: "created",
  propose: "proposed",
  "auto-refine": "auto-refined",
  resolve: "resolved",
};

// A session's action maps to the saved stage it puts the card in while it runs.
// Only implement sets a status — the rest (edit/auto-refine/resolve refine the
// card, create/archive/reject touch no resting card) leave the stage alone.
const SESSION_STATUS: Partial<Record<AgentAction, CardStatus>> = {
  implement: "implementing",
};

// The board script owns the `status` field, like every other frontmatter field,
// so the UI never hand-writes it — it shells out to `update <id> --status`. The
// script lives behind a symlink, so it needs `--preserve-symlinks-main` to
// resolve the repo root (same reason the agent prompts use it). Best-effort: if
// the card is gone (archived) or the script is missing, the write just no-ops.
function setCardStatus(cardId: number, status: CardStatus): void {
  const script = path.join(repoRoot(), ".claude", "skills", "kanban", "kanban.mjs");
  try {
    execFileSync(
      process.execPath,
      ["--preserve-symlinks-main", script, "update", String(cardId), "--status", status],
      { cwd: repoRoot(), stdio: "ignore" },
    );
  } catch {
    // card removed, or script not installed — leave the field as-is
  }
}

// When an implement session ends and its card still exists, restore the stage it
// had before — so a `ready` card is `ready` again, not knocked back to `todo`.
// Questions always win: if the session left the card with open questions, drop
// it to `todo` no matter the prior stage. If the session finished the task
// (archive/reject removed the card) this is a harmless no-op.
function clearSessionStatus(session: Session): void {
  if (session.cardId === null || !SESSION_STATUS[session.action]) return;
  const card = findCard(session.cardId);
  if (!card) return; // archived/rejected — nothing to restore
  const restore: CardStatus =
    card.questions.length > 0 ? "todo" : session.priorStatus ?? "todo";
  setCardStatus(session.cardId, restore);
}

const KEEP_LOGS = 30; // how many session logs to keep on disk
const KEEP_SESSIONS = 30; // how many finished sessions to keep in memory (and persisted)
const TAIL_MAX = 8000; // chars of output kept per session (in memory)
const TAIL_BYTES = 16 * 1024; // last few KB of the log read from disk for the UI

// A sentinel line written into the log just before the agent's final message, so
// a session re-adopted after a UI restart (whose parsed `result` didn't survive
// in memory) can still split the durable log back into events + final message —
// letting the UI fold the events away exactly as it does for an in-session run.
// The events are rendered tool/turn lines, so this bracketed token won't collide.
const RESULT_MARKER = "<<<kanban:result>>>";

// How long the session ran, written into the log the moment it ends (`<marker>
// 161234`, in ms). The registry normally answers this from `endedAt - startedAt`,
// but that pair lives in .sessions.json, which keeps only the newest sessions —
// the log file is the durable record, so the elapsed time is stamped there too
// and getSession() can recover it from a log whose registry entry is thinner than
// the file. Stripped back out before the log is shown, so it never reads as agent
// output.
const DURATION_MARKER = "<<<kanban:duration>>>";

// What the run cost, written into the log the same way and for the same reason
// (`<marker> 0.4231`, in US dollars). The registry answers this from the session
// record, but .sessions.json keeps only the newest sessions — so the number is
// stamped into the durable log too, and getSession() recovers it from there for a
// run whose registry entry is thinner than its file. Stripped back out before the
// log is shown.
const COST_MARKER = "<<<kanban:cost>>>";

// Which model did the work, stamped into the log the same way and for the same
// reason (`<marker> claude-opus-5`). The live record answers this while the run
// is going and for as long as .sessions.json keeps it, but that file holds only
// the newest runs — so the id goes into the durable log too and getSession()
// recovers it from there. Stripped back out before the log is shown.
const MODEL_MARKER = "<<<kanban:model>>>";

function durationLine(session: Session, endedAt: number): string {
  return `\n${DURATION_MARKER} ${Math.max(0, endedAt - session.startedAt)}\n`;
}

function costLine(costUsd: number): string {
  return `${COST_MARKER} ${costUsd}\n`;
}

function modelLine(model: string): string {
  return `${MODEL_MARKER} ${model}\n`;
}

// Same line, for the paths that don't own the log's write stream (a session
// reaped by pid poll after a UI restart). Best-effort: a missing log just means
// the duration rests in .sessions.json alone.
function stampDuration(session: Session, endedAt: number): void {
  try {
    fs.appendFileSync(session.logPath, durationLine(session, endedAt));
  } catch {
    // no log file (never spawned, or pruned) — nothing to stamp
  }
}

interface Session {
  // The session's unique id and the registry map key — ours, always. Generated
  // before the child spawns, so every session has one from its first instant,
  // whatever the harness does about ids of its own (see `resumeId`).
  sessionId: string;
  cardId: number | null;
  action: AgentAction;
  // `interrupted` is the fourth state, and it is not a finish: the run was cut
  // off (the UI died mid-run, the agent ended out of our sight) so we never saw
  // an exit code. It used to be folded into `done` with an outcomeUnknown flag,
  // which read as "finished" — a run that never got there. It now stands on its
  // own: shown as unfinished work, and resumable like a failure.
  //
  // `stopped` is the fifth (#49): the user ended this run from the UI. Not a
  // failure — nothing went wrong, someone decided it should stop — and not
  // something to resume either: a run you ended is over.
  status: "running" | "done" | "error" | "interrupted" | "stopped";
  startedAt: number;
  endedAt?: number;
  pid?: number;
  // The text the user typed for this session — a create's description, an
  // action's notes, or a reject's reason. The request object is gone once the
  // session starts, so we keep it here (and persist it) for the global sessions
  // panel to show (#21).
  input?: string;
  ok?: boolean;
  code?: number | null;
  error?: string;
  // What this run cost in US dollars, as its own output reported it at close. An
  // estimate the agent worked out from tokens at list prices — not a bill, and
  // this run's own number alone: nothing here ever adds two runs together. Unset
  // for a run that reported none (still live, cut off before it finished, an
  // agent command that says nothing about cost, or a run from before #90).
  costUsd?: number;
  // The model that did the work, as the run's own output named it — caught the
  // moment the agent says it (its opening banner), not read off the model
  // setting, which is empty for most people and belongs to today rather than to
  // this run. Unset until the agent names one, and for good on an agent whose
  // output never does or a run from before #98.
  model?: string;
  tail: string;
  // The agent's final message, parsed out of its event stream at close. The
  // tail holds only the intermediate events then — the UI leads with this and
  // folds the tail away. Unset for a custom (non-streaming) command or a session
  // re-adopted after a restart; the tail is all there is in those cases.
  result?: string;
  // The harness this session ran under, recorded when it starts. The resume
  // handoff is built from it, so a finished run keeps showing the command that
  // resumes IT — changing the setting later can't rewrite history.
  harness: string;
  // The session's SECOND id: the one that harness's own CLI resumes by. Set ONLY
  // when it isn't ours to know — the harness minted its own and reported it out
  // of its output as it ran (unset until then, and the UI offers no resume in the
  // meantime), or this run continues an earlier conversation and inherited that
  // one's id. A run started fresh under a harness that takes our id leaves this
  // empty: there `sessionId` IS the conversation, and resumeIdOf says so.
  // `sessionId` stays the key we track the run by in every case.
  resumeId?: string;
  logPath: string;
  // The session this one continued, when it was started by Resume — one more
  // turn of that conversation rather than a fresh run. Persisted, so the mark
  // survives a restart with the rest of the record. It names a session that is
  // deliberately GONE: resuming drops the record it took over from, so this is a
  // mark of where the run came from, not a pointer to something to look up. It is
  // also what tells resumeIdOf this run's conversation isn't ours to derive.
  resumedFrom?: string;
  // The card's saved stage the instant before this session overwrote it with
  // `implementing`. Restored when the session ends, so a session on a `ready`
  // card leaves it `ready` again instead of dropping it to `todo`. Only set for
  // implement sessions (the only ones that touch the stage). Persisted so a
  // session that ends after a UI restart still restores the right stage.
  priorStatus?: CardStatus;
  // Re-adopted from disk after a UI restart. We are no longer its parent, so we
  // detect its exit by polling the pid instead of a 'close' event.
  adopted?: boolean;
  // Stop has been asked for on this run (#49), so whichever path witnesses the
  // end — the child's own close event, the pid poll on an adopted run, or the
  // backstop timer — records it as `stopped` rather than a failure. In memory
  // only: it lives for the few seconds between the signal and the end, and a UI
  // that dies inside that window leaves a run nobody saw the end of, which is
  // what `interrupted` already means.
  stopping?: boolean;
}

interface RegistryState {
  sessions: Map<string, Session>;
  // A promise chain that serializes INDEX_ACTIONS: each waits for the prior to
  // release before it spawns, and releases when its child closes.
  indexTail: Promise<void>;
}

function sessionsDir(): string {
  return path.join(kanbanDir(), ".sessions");
}
function sessionsFile(): string {
  return path.join(kanbanDir(), ".sessions.json");
}

function state(): RegistryState {
  const g = globalThis as unknown as { __kanbanRegistry?: RegistryState };
  if (!g.__kanbanRegistry) {
    g.__kanbanRegistry = { sessions: new Map(), indexTail: Promise.resolve() };
    adoptFromDisk(g.__kanbanRegistry);
    reconcileStatuses(g.__kanbanRegistry);
  }
  return g.__kanbanRegistry;
}

// --- persistence: survive a UI restart --------------------------------------

// Signal 0 doesn't kill; it just asks "is this pid alive and can I signal it?".
// EPERM means alive but owned by someone else — still alive.
function pidAlive(pid?: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

// The finished sessions to persist so both a card's "show last session log"
// button (#14) and the global sessions panel (#21) survive a UI restart: the
// newest KEEP_SESSIONS finished sessions whose log file still exists (a pruned
// log would be a dead pointer). Unlike the old one-per-card slot, this keeps a
// card-less create too, so the panel's history list survives a restart in full.
function recentFinished(s: RegistryState): Session[] {
  return [...s.sessions.values()]
    .filter((r) => r.status !== "running" && fs.existsSync(r.logPath))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, KEEP_SESSIONS);
}

// Write the registry so a restart can find it again: the live sessions (pid +
// identity) that must be re-adopted, and the newest finished sessions so the
// card's "show last session log" button (#14) and the global sessions panel
// (#21) survive.
function persist(s: RegistryState): void {
  const live = [...s.sessions.values()]
    .filter((r) => r.status === "running" && r.pid)
    .map((r) => ({
      sessionId: r.sessionId,
      cardId: r.cardId,
      action: r.action,
      pid: r.pid,
      startedAt: r.startedAt,
      input: r.input,
      harness: r.harness,
      resumeId: r.resumeId,
      resumedFrom: r.resumedFrom,
      // Saved mid-run, like resumeId: a live run has already named its model, so
      // a restart that re-adopts it keeps showing which one.
      model: r.model,
      logPath: r.logPath,
      priorStatus: r.priorStatus,
    }));
  const finished = recentFinished(s).map((r) => ({
    sessionId: r.sessionId,
    cardId: r.cardId,
    action: r.action,
    status: r.status,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    input: r.input,
    harness: r.harness,
    resumeId: r.resumeId,
    resumedFrom: r.resumedFrom,
    ok: r.ok,
    code: r.code,
    error: r.error,
    costUsd: r.costUsd,
    model: r.model,
    logPath: r.logPath,
  }));
  try {
    fs.mkdirSync(kanbanDir(), { recursive: true });
    fs.writeFileSync(sessionsFile(), JSON.stringify({ live, finished }, null, 2));
  } catch {
    // best-effort: a failed write just means a restart forgets a session
  }
}

// On start-up, re-read the saved sessions. A live session whose pid is still
// alive → put it back so the card keeps its running badge and a second session
// can't start on it (a dead pid is dropped; task #13 resets that card's stale
// stage). Each saved finished session whose log file still exists → put it back
// so its "show last session log" button re-opens the file (task #14); a pruned
// log is skipped.
function adoptFromDisk(s: RegistryState): void {
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(sessionsFile(), "utf8"));
  } catch {
    return;
  }
  const live = (data as { live?: unknown[] })?.live;
  const finished = (data as { finished?: unknown[] })?.finished;

  for (const d of (Array.isArray(live) ? live : []) as Partial<Session>[]) {
    if (!d || typeof d.sessionId !== "string" || !pidAlive(d.pid)) continue;
    s.sessions.set(d.sessionId, {
      sessionId: d.sessionId,
      cardId: typeof d.cardId === "number" ? d.cardId : null,
      action: d.action as AgentAction,
      status: "running",
      startedAt: d.startedAt || Date.now(),
      pid: d.pid,
      input: typeof d.input === "string" ? d.input : undefined,
      harness: typeof d.harness === "string" ? d.harness : "",
      resumeId: typeof d.resumeId === "string" ? d.resumeId : undefined,
      resumedFrom: typeof d.resumedFrom === "string" ? d.resumedFrom : undefined,
      model: typeof d.model === "string" && d.model ? d.model : undefined,
      tail: "",
      logPath: d.logPath || path.join(sessionsDir(), `${d.sessionId}.log`),
      priorStatus: d.priorStatus,
      adopted: true,
    });
  }

  for (const d of (Array.isArray(finished) ? finished : []) as Partial<Session>[]) {
    if (!d || typeof d.sessionId !== "string" || s.sessions.has(d.sessionId)) continue;
    const logPath = typeof d.logPath === "string" ? d.logPath : "";
    if (!logPath || !fs.existsSync(logPath)) continue; // log pruned — drop the record
    s.sessions.set(d.sessionId, {
      sessionId: d.sessionId,
      cardId: typeof d.cardId === "number" ? d.cardId : null,
      action: d.action as AgentAction,
      // A saved terminal state comes back as itself; anything unrecognized reads
      // as `done`, the one state that claims nothing beyond "it ended".
      status:
        d.status === "error" || d.status === "interrupted" || d.status === "stopped"
          ? d.status
          : "done",
      startedAt: d.startedAt || Date.now(),
      endedAt: typeof d.endedAt === "number" ? d.endedAt : undefined,
      input: typeof d.input === "string" ? d.input : undefined,
      // A session saved before the harness was recorded carries no name, so it
      // gets no resume handoff — every harness resumes differently, and the one
      // thing worse than a missing button is a command for the wrong agent. Same
      // for a run whose harness never reported its own id before we lost sight
      // of it: no id, no handoff.
      harness: typeof d.harness === "string" ? d.harness : "",
      resumeId: typeof d.resumeId === "string" ? d.resumeId : undefined,
      resumedFrom: typeof d.resumedFrom === "string" ? d.resumedFrom : undefined,
      ok: typeof d.ok === "boolean" ? d.ok : undefined,
      code: d.code ?? null,
      error: typeof d.error === "string" ? d.error : undefined,
      // A run saved before #90, or one that never reported a cost, has no number
      // here — and shows none, rather than a zero it didn't earn.
      costUsd: typeof d.costUsd === "number" && d.costUsd > 0 ? d.costUsd : undefined,
      // Same for the model: a run saved before #98, or one whose agent never
      // named a model, shows none rather than today's setting.
      model: typeof d.model === "string" && d.model ? d.model : undefined,
      // No in-memory tail/result survives a restart — getSession() reads the log file.
      tail: "",
      logPath,
    });
  }

  persist(s); // rewrite without the dead ones
}

// On start-up, fix a stale stage: a card saved as `implementing` whose session
// no longer exists (the UI crashed mid-run) is reset to `todo`, so the field
// never gets stuck. Sessions still alive were re-adopted above, so they keep
// their stage. `ready` is a durable resting stage no session owns (refine sets
// it), so it's left alone. Best-effort — a board that can't be read just skips
// this.
function reconcileStatuses(s: RegistryState): void {
  let cards;
  try {
    cards = allCards();
  } catch {
    return;
  }
  for (const c of cards) {
    const sessionDriven = c.status === "implementing";
    if (sessionDriven && !liveSessionForCard(s, c.id)) {
      setCardStatus(c.id, "todo");
    }
  }
}

// Adopted sessions have no 'close' event, so reap them by polling the pid.
// Called on every read so the UI's poll drives the check — no background timer
// needed.
//
// A pid that vanished on us is an INTERRUPTED run, never a finished one. The UI
// server that spawned it died mid-run; whatever the agent did after that, nobody
// witnessed the end of it, so there is no exit code, no final message, and no
// reason to believe the work is complete. Calling that `done` told the user the
// card had been dealt with when the run had in fact been cut off — so it gets its
// own terminal state, which reads as unfinished and offers Resume.
function reapAdopted(s: RegistryState): void {
  let changed = false;
  for (const r of s.sessions.values()) {
    if (r.status === "running" && r.adopted && !pidAlive(r.pid)) {
      // Unless we are the reason it is gone: an adopted run has no close event,
      // so this poll is also how a Stop on one gets witnessed (#49).
      r.status = r.stopping ? "stopped" : "interrupted";
      r.code = null; // exit code is unknown across a restart
      // `ok` stays unset: we saw neither a pass nor a failure.
      // We only know it ended by the time we noticed, so this duration is an
      // upper bound — the UI marks it approximate.
      r.endedAt = Date.now();
      stampDuration(r, r.endedAt);
      clearSessionStatus(r);
      changed = true;
    }
  }
  if (changed) {
    persist(s);
    pruneMemory(s);
  }
}

// --- logs -------------------------------------------------------------------

// Read the tail of a session's log file — the durable source #14 shows. Bounded
// to the last few KB so a long session doesn't bloat the page; the full log
// stays in the file. Reading from the file (not the in-memory tail) is what
// makes a session re-adopted after a UI restart still show its output, and never
// grows unbounded.
function readLogTail(logPath: string, maxBytes = TAIL_BYTES): string | null {
  let fd: number | undefined;
  try {
    const size = fs.statSync(logPath).size;
    const start = Math.max(0, size - maxBytes);
    const len = size - start;
    if (len === 0) return "";
    fd = fs.openSync(logPath, "r");
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    let text = buf.toString("utf8");
    // We cut at a byte offset, so drop a partial first line if we didn't start
    // at the top — otherwise the view opens on half a line.
    if (start > 0) {
      const nl = text.indexOf("\n");
      if (nl >= 0) text = text.slice(nl + 1);
    }
    return text;
  } catch {
    return null; // no log file yet, or unreadable
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore
      }
    }
  }
}

// Split a log tail read from disk into intermediate events + the agent's final
// message, so a session re-adopted after a restart folds the events away the
// same as an in-session run. Returns just { tail } when there's no separable
// message (a live session, or a custom command with no recognizable structure).
function splitLogResult(
  logText: string,
): { tail: string; result?: string; durationMs?: number; costUsd?: number; model?: string } {
  // Pull the bookkeeping stamps out first: they're not agent output, so they must
  // not reach the view — and left in place they would land after the last tool
  // line and the legacy fallback below would read them as the final message.
  let durationMs: number | undefined;
  let costUsd: number | undefined;
  let model: string | undefined;
  const kept: string[] = [];
  for (const line of logText.split("\n")) {
    if (line.startsWith(DURATION_MARKER)) {
      const ms = Number(line.slice(DURATION_MARKER.length).trim());
      if (Number.isFinite(ms)) durationMs = ms;
      continue;
    }
    if (line.startsWith(COST_MARKER)) {
      const usd = Number(line.slice(COST_MARKER.length).trim());
      if (Number.isFinite(usd) && usd > 0) costUsd = usd;
      continue;
    }
    if (line.startsWith(MODEL_MARKER)) {
      model = line.slice(MODEL_MARKER.length).trim() || undefined;
      continue;
    }
    kept.push(line);
  }
  return { ...splitBody(kept.join("\n")), durationMs, costUsd, model };
}

function splitBody(logText: string): { tail: string; result?: string } {
  // Exact path — a log written after the marker landed: everything after the
  // marker is the final message, everything before it is the events. lastIndexOf
  // so a marker-like token in the events can't beat the real one appended last.
  const at = logText.lastIndexOf(RESULT_MARKER);
  if (at !== -1) {
    const tail = logText.slice(0, at).replace(/\n+$/, "");
    const result = logText.slice(at + RESULT_MARKER.length).replace(/^\n+/, "").replace(/\n+$/, "");
    return { tail, result: result || undefined };
  }
  // Fallback for pre-marker (legacy) logs. The renderer wrote every tool call as
  // a "⏺ …" line, so the closing prose after the LAST tool line is the final
  // message. The old write appended that message right after its identical
  // streamed copy, so collapse an exact "X … X" doubling back to a single X.
  const lines = logText.split("\n");
  let lastTool = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].startsWith("⏺ ")) lastTool = i;
  if (lastTool === -1) return { tail: logText }; // no tool calls — can't tell events from message
  const tail = lines.slice(0, lastTool + 1).join("\n").replace(/\n+$/, "");
  const closing = lines.slice(lastTool + 1).join("\n").trim();
  if (!closing) return { tail: logText.replace(/\n+$/, "") }; // ended on a tool call — no message to lead with
  const paras = closing.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const half = paras.length / 2;
  let doubled = Number.isInteger(half) && half > 0;
  for (let i = 0; i < half && doubled; i++) if (paras[i] !== paras[i + half]) doubled = false;
  const result = (doubled ? paras.slice(0, half) : paras).join("\n\n");
  return { tail, result: result || undefined };
}

// Keep only the last KEEP_LOGS session logs on disk; delete older ones.
function pruneLogs(): void {
  try {
    const files = fs
      .readdirSync(sessionsDir())
      .filter((f) => f.endsWith(".log"))
      .map((f) => ({ f, t: fs.statSync(path.join(sessionsDir(), f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of files.slice(KEEP_LOGS)) {
      try {
        fs.unlinkSync(path.join(sessionsDir(), f));
      } catch {
        // ignore
      }
    }
  } catch {
    // no dir yet, nothing to prune
  }
}

// Bound the in-memory map: drop the oldest finished sessions past KEEP_SESSIONS.
// Running sessions are always kept.
function pruneMemory(s: RegistryState): void {
  const finished = [...s.sessions.values()]
    .filter((r) => r.status !== "running")
    .sort((a, b) => (a.endedAt || 0) - (b.endedAt || 0));
  for (const r of finished.slice(0, Math.max(0, finished.length - KEEP_SESSIONS))) {
    s.sessions.delete(r.sessionId);
  }
}

// --- the board-index lock ---------------------------------------------------

// Acquire the index lock: resolves once every prior index action has released,
// and returns the release for this one. Non-index actions never call this.
function acquireIndexLock(s: RegistryState): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const prior = s.indexTail;
  s.indexTail = prior.then(() => held);
  return prior.then(() => release);
}

// --- starting a session -----------------------------------------------------

export interface StartResult {
  ok: boolean;
  sessionId?: string;
  error?: string;
}

// The text the user typed for a session, pulled from whichever request field
// carries it: create → description, reject → reason, everything else → notes.
// Trimmed; empty becomes undefined. Stored on the session so the sessions panel
// shows the input alongside the log (#21).
function sessionInput(req: AgentRequest): string | undefined {
  const text = req.description ?? req.reason ?? req.notes ?? "";
  return text.trim() || undefined;
}

// Start an agent and return at once — the request never awaits the child. The
// session is recorded as `running`; the UI polls listSessions() and sees it flip
// to done/error on close. Enforces the per-card lock here (synchronously) so a
// double-click or a second tab can't start two sessions on one card.
export function startSession(req: AgentRequest, prompt: string): StartResult {
  const s = state();
  reapAdopted(s);

  const cardId = Number.isInteger(req.id) ? (req.id as number) : null;
  const locked = lockedBy(s, req.action, cardId);
  if (locked) return { ok: false, error: locked };

  // Generate the id up front so it's the registry key AND (for a harness that
  // can pin one) the id we hand the CLI — one id, known before the child spawns.
  const sessionId = randomUUID();
  // The one read of the harness setting for this whole run. Everything the run
  // needs comes out of it here, at the start — not later, when the child finally
  // spawns (an index action waits on the lock first, and the user may well have
  // flipped the picker by then). A run therefore always uses one harness end to
  // end: its command, its env, its parser, and the name recorded against it.
  const run = startRun(sessionId);
  const session: Session = {
    sessionId,
    cardId,
    action: req.action,
    status: "running",
    startedAt: Date.now(),
    input: sessionInput(req),
    harness: run.name,
    // No `resumeId` here on purpose. A fresh run under a harness that takes our
    // id needs none — resumeIdOf derives it — and a harness that mints its own
    // has nothing to record yet: catchResumeId fills this in the moment its
    // output reports one.
    tail: "",
    logPath: path.join(sessionsDir(), `${sessionId}.log`),
  };
  s.sessions.set(sessionId, session);
  persist(s);

  void launch(s, session, run, prompt); // fire and forget
  return { ok: true, sessionId };
}

// The locks every new session passes, whether it's a fresh action or a resumed
// one: one live session per card, and one live create/propose across the whole
// board. Returns the message to refuse with, or undefined when the way is clear.
// Called synchronously at the start, so a double-click or a second tab can't slip
// two sessions past it.
function lockedBy(s: RegistryState, action: AgentAction, cardId: number | null): string | undefined {
  if (cardId !== null) {
    const live = liveSessionForCard(s, cardId);
    if (live) return `#${cardId} is already being ${VERB[live.action]}`;
  }
  // One-at-a-time actions (create): refuse a second while one is live, across all
  // tabs. The per-card lock above doesn't cover a create — it has no card id yet.
  if (SINGLETON_ACTIONS.has(action)) {
    for (const r of s.sessions.values()) {
      if (r.status === "running" && r.action === action) {
        return `a task is already being ${VERB[action]}`;
      }
    }
  }
  return undefined;
}

// Send one more turn into a run that failed: same agent, same conversation, and
// the prompt is just "continue" (see RESUME_PROMPT). It runs as a session of its
// own — its own id, its own log file, its own process — carrying the failed run's
// action and card, so the card lock, the `implementing` stage and the index lock
// all apply exactly as they did the first time.
//
// And it REPLACES the run it continues: once it has started, the old session is
// dropped from the registry and its log file deleted. The two are one piece of
// work — the same conversation, carried on — so the panel keeps one row for it,
// the one that is still going, rather than a chain of dead attempts behind it.
// The cost is that the earlier run's log goes with it: what the agent did before
// it stopped is no longer readable once you resume. `resumedFrom` survives as the
// mark that this run began as someone else's.
//
// Only a run that stopped short can be resumed — one that failed, or one that was
// interrupted (its pid vanished when the UI died, so it never reached an end).
// Both left work unfinished in the same conversation. A passing run has nothing
// to continue, and a running one is still going; both are refused here as well as
// hidden in the UI, since the button and the registry are polled a second and a
// half apart.
export function resumeSession(sessionId: string): StartResult {
  const s = state();
  reapAdopted(s);

  const prev = s.sessions.get(sessionId);
  if (!prev) return { ok: false, error: "that session is no longer in the registry" };
  if (prev.status === "running") return { ok: false, error: "that session is still running" };
  if (!canPickUp(prev)) {
    return { ok: false, error: "only a failed or interrupted session can be resumed" };
  }
  const resumeId = resumeIdOf(prev);
  if (!resumeId) return { ok: false, error: "that session never reported an id to resume by" };
  const run = resumeRun(prev.harness, resumeId);
  if (!run) return { ok: false, error: `the current agent can't resume that session` };

  const locked = lockedBy(s, prev.action, prev.cardId);
  if (locked) return { ok: false, error: locked };

  const newId = randomUUID();
  const session: Session = {
    sessionId: newId,
    cardId: prev.cardId,
    action: prev.action,
    status: "running",
    startedAt: Date.now(),
    // No `input`: the note the user typed is already in the conversation being
    // resumed — repeating it here would read as a second instruction they never
    // gave. `resumedFrom` is what this run has to say for itself.
    harness: run.name,
    resumeId: run.resumeId ?? undefined,
    resumedFrom: prev.sessionId,
    tail: "",
    logPath: path.join(sessionsDir(), `${newId}.log`),
  };
  s.sessions.set(newId, session);
  // The new run has the conversation now, so the old record is dropped here —
  // after every refusal above, never before one. A resume that couldn't start
  // leaves the run it would have continued exactly as it was, still offering its
  // button.
  forget(s, prev);
  persist(s);

  void launch(s, session, run, RESUME_PROMPT); // fire and forget, like startSession
  return { ok: true, sessionId: newId };
}

// --- stopping a run ---------------------------------------------------------

// How long a run gets to end on its own after Stop asks it to, before it is
// killed outright.
const STOP_GRACE_MS = 5_000;
// And how long after the kill we close the record ourselves. The child's own
// 'close' event normally does it, but that event waits on the output PIPE, not
// the process — a tool the agent left behind can hold the pipe open long after
// the agent itself is gone, which would leave the run reading "running" and its
// card locked. So the registry closes it out regardless (#49).
const STOP_CLOSE_MS = 2_000;

// Send a real signal to a run's process. Never throws: the process may exit
// between the check and the call, and losing that race is not an error — the run
// is over either way, which is what Stop wanted.
function signal(pid: number | undefined, sig: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(pid, sig);
  } catch {
    // already gone
  }
}

// End a run the user stopped from the UI (#49). Asks the agent to end (SIGTERM),
// kills it if it is still there after the grace, and closes the record out.
//
// The run then finishes the way every other run does — log closed, duration
// stamped, the card's stage restored and the card unlocked — but under its own
// outcome: `stopped` is neither a pass nor a failure, and it offers no Resume,
// since a run you ended has nothing left to continue.
//
// Stopping a run that has already ended does nothing and reports no error: the
// button is drawn from a poll that can be a second and a half old, so the run
// may well have finished between the draw and the click.
export function stopSession(sessionId: string): StartResult {
  const s = state();
  reapAdopted(s);

  const r = s.sessions.get(sessionId);
  if (!r) return { ok: false, error: "that session is no longer in the registry" };
  // Over already, or already asked to stop — nothing to do, and nothing wrong.
  if (r.status !== "running" || r.stopping) return { ok: true, sessionId };
  r.stopping = true;

  // No live process to signal: the run is queued behind the index lock and has
  // not spawned yet, or it died on its own a moment ago. Nothing will ever tell
  // us it ended, so close it out here. (A run stopped before it spawned never
  // does — launch() checks the record after the lock.)
  if (!r.pid || !pidAlive(r.pid)) {
    finishStopped(s, r);
    return { ok: true, sessionId };
  }

  signal(r.pid, "SIGTERM");
  after(STOP_GRACE_MS, () => {
    if (pidAlive(r.pid)) signal(r.pid, "SIGKILL");
  });
  after(STOP_GRACE_MS + STOP_CLOSE_MS, () => finishStopped(s, r));
  return { ok: true, sessionId };
}

// setTimeout that can't hold the server process open on its own — same reason
// the dispatcher unrefs its interval.
function after(ms: number, fn: () => void): void {
  const t = setTimeout(fn, ms);
  if (typeof t.unref === "function") t.unref();
}

// Close out a stopped run's record. Whichever path gets here first wins and the
// rest are no-ops (the status guard), because three of them can: the child's own
// close event, the pid poll on an adopted run, and the backstop timer above.
function finishStopped(s: RegistryState, session: Session): void {
  if (session.status !== "running") return;
  session.status = "stopped";
  session.code = null; // killed, so any exit code we might read says nothing
  // `ok` stays unset, as it does for an interrupted run: the run neither passed
  // nor failed, it was ended.
  session.endedAt = Date.now();
  stampDuration(session, session.endedAt);
  clearSessionStatus(session);
  pruneLogs();
  persist(s);
  pruneMemory(s);
}

// Drop a session from the registry and take its log with it. Only for a session
// something else has taken over (see resumeSession) — the record and the file are
// one thing, so leaving the log would strand a file nothing can open, and it would
// still count against the kept-30 window, aging out logs that ARE reachable.
function forget(s: RegistryState, r: Session): void {
  s.sessions.delete(r.sessionId);
  try {
    fs.unlinkSync(r.logPath);
  } catch {
    // already pruned, or never written — the record is gone either way
  }
}

// A run that stopped short of finishing, so there is something left to continue:
// it failed, or it was interrupted. The one test behind both the Resume button
// and the refusal above, so the UI and the server can't drift on what's offered.
function canPickUp(r: Session): boolean {
  return r.status === "error" || r.status === "interrupted";
}

// The id this run's conversation is resumed by — the HARNESS's id for it, which
// is a different thing from `sessionId`, our key for the run. They coincide in one
// case, and that case is the common one: a run we started fresh under a harness
// that takes the id we generate (Claude Code pins it with `--session-id`) IS its
// conversation, so the id needs no recording and a record that never stored one
// still resumes.
//
// The two cases where the id came from somewhere else, and only the field can
// answer:
//   • the harness minted its own mid-run and reported it (Codex's `thread_id`) —
//     until that arrives there is genuinely no id to continue by;
//   • THIS run is a later turn of an earlier conversation (started by Resume). It
//     carries that conversation's id, not our new key: `--resume <id>` continues
//     the old thread and takes no `--session-id` of its own, so deriving from
//     `sessionId` here would hand the CLI an id it has never seen.
function resumeIdOf(r: Session): string | undefined {
  if (adoptsSessionId(r.harness) && !r.resumedFrom) return r.sessionId;
  return r.resumeId;
}

function liveSessionForCard(s: RegistryState, cardId: number): Session | undefined {
  for (const r of s.sessions.values()) {
    if (r.status === "running" && r.cardId === cardId) return r;
  }
  return undefined;
}

async function launch(
  s: RegistryState,
  session: Session,
  run: ActiveHarness,
  prompt: string,
): Promise<void> {
  // Serialize the shared-file rewrites; other actions spawn straight away.
  const release = INDEX_ACTIONS.has(session.action)
    ? await acquireIndexLock(s)
    : () => {};

  // An index action can wait minutes on that lock, and Stop reaches a run that
  // never spawned: the record is already closed out, so don't start the agent
  // now (#49).
  if (session.status !== "running") {
    release();
    return;
  }

  try {
    fs.mkdirSync(sessionsDir(), { recursive: true });
  } catch {
    // the write stream will surface the real error if the dir is unusable
  }
  const log = fs.createWriteStream(session.logPath, { flags: "a" });

  // Save the stage before the agent touches the card, so a restart mid-run finds
  // the card already reading `implementing`. Sessions on a real card only.
  // Remember the stage it had first, so the end of the session can restore it (a
  // `ready` card stays `ready`) instead of always dropping to `todo`.
  const startStatus = session.cardId !== null ? SESSION_STATUS[session.action] : undefined;
  if (session.cardId !== null && startStatus) {
    // Read the stage first (persisted with the session below, once the pid is
    // set), then overwrite it for the duration of the session.
    session.priorStatus = findCard(session.cardId)?.status ?? "todo";
    setCardStatus(session.cardId, startStatus);
  }

  const [cmd, ...args] = run.argv;
  let child;
  try {
    child = spawn(cmd, [...args, prompt], {
      cwd: repoRoot(),
      env: run.env,
      shell: false,
      // `claude -p` waits ~3s on a piped stdin, then logs a "no stdin data"
      // warning into our log. Close stdin so the log is only agent output.
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    log.end();
    finish(s, session, { ok: false, code: null, error: String(e) });
    release();
    return;
  }

  session.pid = child.pid;
  persist(s);

  // stdout is the agent's event stream (see the harness's extraArgs) — render it
  // to readable lines as it arrives, with the parser its own harness brings.
  // stderr is plain text and passes through.
  const renderer = run.renderer;
  const append = (str: string) => {
    if (!str) return;
    log.write(str);
    session.tail = (session.tail + str).slice(-TAIL_MAX);
  };
  child.stdout.on("data", (d: Buffer) => {
    append(renderer.push(d.toString()));
    catchResumeId(s, session, renderer);
    catchModel(s, session, renderer);
  });
  child.stderr.on("data", (d: Buffer) => append(d.toString()));
  child.on("error", (err) => {
    session.error = String(err);
    log.write(`\n[error] ${String(err)}`);
  });
  child.on("close", (code) => {
    append(renderer.flush());
    catchResumeId(s, session, renderer); // the id may have been in the last partial line
    catchModel(s, session, renderer); // and so may the model, on a very short run
    // A stopped run whose pipe outlived it was already closed out by the backstop
    // (see finishStopped): the stamps are in the log and the record is final, so
    // all that's left here is to let go of the stream and the lock.
    if (session.status !== "running") {
      log.end();
      release();
      return;
    }
    // Stamp the elapsed time through the same stream (not an appendFileSync
    // after log.end(), which would race the stream's pending flush), and hand the
    // exact instant to finish() so the file and the registry agree.
    const endedAt = Date.now();
    log.write(durationLine(session, endedAt));
    // What the run cost, if its own output said. Stamped right after the duration
    // — the two are one line in the UI — and kept on the session so the number is
    // there without re-reading the file.
    const cost = renderer.costUsd?.();
    if (cost !== undefined) {
      session.costUsd = cost;
      log.write(costLine(cost));
    }
    // And which model did it. Already on the session (caught the moment the agent
    // named it) — this stamps it into the log so the file alone can still answer
    // once the record ages out of .sessions.json.
    if (session.model) log.write(modelLine(session.model));
    // The final message is kept off the tail (the UI shows it in its own
    // panel and folds the events away) but written to the log file — behind a
    // marker line — so the file alone is the complete, durable record and a
    // post-restart read can split events from message again (see getSession).
    const final = renderer.result();
    if (final) {
      session.result = final;
      log.write(`\n${RESULT_MARKER}\n${final}\n`);
    }
    log.end();
    finish(s, session, { ok: code === 0, code, endedAt });
    release();
  });
}

// A harness that mints its own session id reports it out of its output stream,
// so the id shows up partway through the run. Save it the moment it does — and
// persist at once, since a UI restart a second later would otherwise leave a
// finished run with no way to resume it. First one wins: an agent that names its
// id more than once is still one conversation. A harness that adopted our id has
// no `resumeId` on its renderer and never reaches past the first check.
function catchResumeId(s: RegistryState, session: Session, renderer: StreamRenderer): void {
  if (session.resumeId || !renderer.resumeId) return;
  const id = renderer.resumeId();
  if (!id) return;
  session.resumeId = id;
  persist(s);
}

// The model the agent named for this run, taken the instant its output says one
// — the opening banner, seconds in — so a live run can show what it is working
// with instead of waiting for the end. Persisted at once for the same reason the
// resume id is: a restart a moment later would otherwise leave the run with no
// model to show. First one wins, in the renderer; a harness whose output never
// names a model has no `model` on its renderer and stops at the first check.
function catchModel(s: RegistryState, session: Session, renderer: StreamRenderer): void {
  if (session.model || !renderer.model) return;
  const model = renderer.model();
  if (!model) return;
  session.model = model;
  persist(s);
}

function finish(
  s: RegistryState,
  session: Session,
  res: { ok: boolean; code: number | null; error?: string; endedAt?: number },
): void {
  // A run the user stopped exits non-zero (we killed it), but that is not a
  // failure — so the signal we sent, not the code it died with, names the
  // outcome. `ok` stays unset for it, as it does for an interrupted run.
  if (session.stopping) {
    session.status = "stopped";
  } else {
    session.status = res.ok ? "done" : "error";
    session.ok = res.ok;
  }
  session.code = res.code;
  if (res.error) session.error = res.error;
  // `endedAt` comes from the caller when it already stamped that instant into the
  // log, so the two records can't drift apart.
  session.endedAt = res.endedAt ?? Date.now();
  clearSessionStatus(session);
  // Prune old logs first, then persist — so the saved "last session log" records
  // only ever point at files that still exist (task #14).
  pruneLogs();
  persist(s);
  pruneMemory(s);
}

// --- reading the registry (for the UI poll) ---------------------------------

// `resumable` is the harness a failed run could be resumed under right now (see
// resumableHarness) — read once per registry read and passed in, not re-read for
// every session in the list.
function toView(r: Session, withTail: boolean, resumable: string | null): SessionView {
  return {
    sessionId: r.sessionId,
    cardId: r.cardId,
    action: r.action,
    status: r.status,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    // How long it took — the one number the UI shows next to "done". A running
    // session has no duration yet; its pulse dot carries it instead.
    durationMs: r.status !== "running" && r.endedAt ? r.endedAt - r.startedAt : undefined,
    // What the run cost, beside the duration. A live run has none yet — the
    // number arrives with the agent's closing event — and a run that never
    // reported one shows nothing at all.
    costUsd: r.status !== "running" ? r.costUsd : undefined,
    // Which model is doing the work. Unlike the duration and the cost, this one
    // shows on a LIVE run too: the agent names it in its first seconds, and
    // seeing what a run is using while it goes is the point.
    model: r.model,
    input: r.input,
    harness: r.harness,
    // The Resume offer, and everything it needs to be honest: the run stopped
    // short (failed or interrupted), we know the id to continue by, and the
    // agent that ran it is still the one the board runs — resuming a Claude Code
    // conversation under another agent would hand it an id that means nothing
    // there.
    canResume: canPickUp(r) && !!resumeIdOf(r) && !!resumable && r.harness === resumable,
    resumedFrom: r.resumedFrom,
    ok: r.ok,
    code: r.code,
    error: r.error,
    // The agent's final message — terminal sessions only; a live one has none yet.
    result: r.status !== "running" ? r.result : undefined,
    // Only terminal sessions carry their tail here (the result overlay reads it);
    // the live tail of a running agent is fetched per-session via getSession(),
    // which reads the log file, so the board-wide poll stays light.
    tail: withTail && r.status !== "running" ? r.tail : undefined,
  };
}

export function listSessions(): SessionView[] {
  const s = state();
  reapAdopted(s);
  const resumable = resumableHarness(); // one config read for the whole list
  return [...s.sessions.values()]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((r) => toView(r, true, resumable));
}

// One session's view with its log tail read from the file (task #14). Used to
// watch a live session and to re-open a finished one's log — the file outlives
// both the session and a UI restart. Returns null if the session isn't in the
// registry.
export function getSession(sessionId: string): SessionView | null {
  const s = state();
  reapAdopted(s);
  const r = s.sessions.get(sessionId);
  if (!r) return null;
  const view = toView(r, false, resumableHarness());
  // A finished session whose final message we still hold: the tail is the
  // in-memory event text (bounded), which the UI folds under the message —
  // the file would repeat the message at the end. Otherwise — a live session, or
  // one re-adopted after a restart — the file is the source: durable,
  // bounded, and possibly the only copy left.
  if (r.status !== "running" && r.result) {
    view.tail = r.tail;
  } else {
    const raw = readLogTail(r.logPath) ?? r.tail ?? "";
    // A re-adopted finished session lost its parsed `result` across the restart —
    // recover it from the marker in the log so the UI folds the events away, the
    // same as an in-session run. A live session has no marker yet, so this is a
    // no-op.
    const { tail, result, durationMs, costUsd, model } = splitLogResult(raw);
    view.tail = tail;
    if (result && r.status !== "running") view.result = result;
    // The registry's own timestamps win when it has them; the stamp in the log is
    // the fallback for a session whose endedAt didn't survive.
    if (view.durationMs === undefined && durationMs !== undefined && r.status !== "running") {
      view.durationMs = durationMs;
    }
    // Same for the cost: the record first, the log's stamp for a run re-read
    // after a restart.
    if (view.costUsd === undefined && costUsd !== undefined && r.status !== "running") {
      view.costUsd = costUsd;
    }
    // Same again for the model. No `running` guard here: the stamp is only ever
    // written at close, so a live run can't have one to recover.
    if (view.model === undefined && model !== undefined) view.model = model;
  }
  return view;
}
