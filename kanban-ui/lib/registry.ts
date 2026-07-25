import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { agentArgv, type AgentRequest, isClaudeAgent } from "./agent";
import { allCards, findCard } from "./board";
import { kanbanDir, repoRoot } from "./paths";
import { createStreamRenderer } from "./stream";
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

function durationLine(session: Session, endedAt: number): string {
  return `\n${DURATION_MARKER} ${Math.max(0, endedAt - session.startedAt)}\n`;
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
  // The session's unique id and the registry map key. For a claude agent it's
  // also Claude Code's own session id — we generate it and pass it through as
  // `--session-id`, so the id the UI hands off is the id claude runs under.
  sessionId: string;
  cardId: number | null;
  action: AgentAction;
  status: "running" | "done" | "error";
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
  tail: string;
  // The agent's final message, parsed out of its event stream at close. The
  // tail holds only the intermediate events then — the UI leads with this and
  // folds the tail away. Unset for a custom (non-streaming) command or a session
  // re-adopted after a restart; the tail is all there is in those cases.
  result?: string;
  // True when the agent is the Claude Code CLI, so `sessionId` is a real Claude
  // Code session the UI can offer to resume (`claude --resume <id>`). False for
  // a custom command — the id is unique but there's nothing to resume.
  resumable?: boolean;
  logPath: string;
  // The card's saved stage the instant before this session overwrote it with
  // `implementing`. Restored when the session ends, so a session on a `ready`
  // card leaves it `ready` again instead of dropping it to `todo`. Only set for
  // implement sessions (the only ones that touch the stage). Persisted so a
  // session that ends after a UI restart still restores the right stage.
  priorStatus?: CardStatus;
  // Re-adopted from disk after a UI restart. We are no longer its parent, so we
  // detect its exit by polling the pid instead of a 'close' event.
  adopted?: boolean;
  // The session was still going when the UI restarted, then ended out of our
  // sight — we polled its pid, so we never learned the exit code. Shown as
  // finished with no pass/fail mark (task #14): don't guess an outcome we never
  // saw.
  outcomeUnknown?: boolean;
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
      resumable: r.resumable,
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
    resumable: r.resumable,
    ok: r.ok,
    code: r.code,
    error: r.error,
    logPath: r.logPath,
    outcomeUnknown: r.outcomeUnknown,
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

  for (const d of (Array.isArray(live) ? live : []) as any[]) {
    if (!d || typeof d.sessionId !== "string" || !pidAlive(d.pid)) continue;
    s.sessions.set(d.sessionId, {
      sessionId: d.sessionId,
      cardId: typeof d.cardId === "number" ? d.cardId : null,
      action: d.action,
      status: "running",
      startedAt: d.startedAt || Date.now(),
      pid: d.pid,
      input: typeof d.input === "string" ? d.input : undefined,
      resumable: d.resumable === true,
      tail: "",
      logPath: d.logPath || path.join(sessionsDir(), `${d.sessionId}.log`),
      priorStatus: d.priorStatus,
      adopted: true,
    });
  }

  for (const d of (Array.isArray(finished) ? finished : []) as any[]) {
    if (!d || typeof d.sessionId !== "string" || s.sessions.has(d.sessionId)) continue;
    const logPath = typeof d.logPath === "string" ? d.logPath : "";
    if (!logPath || !fs.existsSync(logPath)) continue; // log pruned — drop the record
    s.sessions.set(d.sessionId, {
      sessionId: d.sessionId,
      cardId: typeof d.cardId === "number" ? d.cardId : null,
      action: d.action,
      status: d.status === "error" ? "error" : "done",
      startedAt: d.startedAt || Date.now(),
      endedAt: typeof d.endedAt === "number" ? d.endedAt : undefined,
      input: typeof d.input === "string" ? d.input : undefined,
      resumable: d.resumable === true,
      ok: typeof d.ok === "boolean" ? d.ok : undefined,
      code: d.code ?? null,
      error: typeof d.error === "string" ? d.error : undefined,
      // No in-memory tail/result survives a restart — getSession() reads the log file.
      tail: "",
      logPath,
      outcomeUnknown: d.outcomeUnknown === true,
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
function reapAdopted(s: RegistryState): void {
  let changed = false;
  for (const r of s.sessions.values()) {
    if (r.status === "running" && r.adopted && !pidAlive(r.pid)) {
      r.status = "done";
      r.code = null; // exit code is unknown across a restart
      r.outcomeUnknown = true; // finished out of our sight — no pass/fail to show
      // We only know it ended by the time we noticed, so this duration is an
      // upper bound — the UI marks it approximate (see outcomeUnknown).
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
function splitLogResult(logText: string): { tail: string; result?: string; durationMs?: number } {
  // Pull the duration stamp out first: it's bookkeeping, not agent output, so it
  // must not reach the view — and left in place it would land after the last tool
  // line and the legacy fallback below would read it as the final message.
  let durationMs: number | undefined;
  const kept: string[] = [];
  for (const line of logText.split("\n")) {
    if (line.startsWith(DURATION_MARKER)) {
      const ms = Number(line.slice(DURATION_MARKER.length).trim());
      if (Number.isFinite(ms)) durationMs = ms;
      continue;
    }
    kept.push(line);
  }
  const split = splitBody(kept.join("\n"));
  return durationMs === undefined ? split : { ...split, durationMs };
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
  if (cardId !== null) {
    const live = liveSessionForCard(s, cardId);
    if (live) {
      return { ok: false, error: `#${cardId} is already being ${VERB[live.action]}` };
    }
  }

  // One-at-a-time actions (create): refuse a second while one is live, across all
  // tabs. The per-card lock above doesn't cover a create — it has no card id yet.
  if (SINGLETON_ACTIONS.has(req.action)) {
    for (const r of s.sessions.values()) {
      if (r.status === "running" && r.action === req.action) {
        return { ok: false, error: `a task is already being ${VERB[req.action]}` };
      }
    }
  }

  // Generate the id up front so it's the registry key AND (for a claude agent)
  // the id we pass to `--session-id` — one id, known before the child spawns.
  const sessionId = randomUUID();
  const session: Session = {
    sessionId,
    cardId,
    action: req.action,
    status: "running",
    startedAt: Date.now(),
    input: sessionInput(req),
    resumable: isClaudeAgent(),
    tail: "",
    logPath: path.join(sessionsDir(), `${sessionId}.log`),
  };
  s.sessions.set(sessionId, session);
  persist(s);

  void launch(s, session, prompt); // fire and forget
  return { ok: true, sessionId };
}

function liveSessionForCard(s: RegistryState, cardId: number): Session | undefined {
  for (const r of s.sessions.values()) {
    if (r.status === "running" && r.cardId === cardId) return r;
  }
  return undefined;
}

async function launch(s: RegistryState, session: Session, prompt: string): Promise<void> {
  // Serialize the shared-file rewrites; other actions spawn straight away.
  const release = INDEX_ACTIONS.has(session.action)
    ? await acquireIndexLock(s)
    : () => {};

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

  const [cmd, ...args] = agentArgv(session.sessionId);
  let child;
  try {
    child = spawn(cmd, [...args, prompt], {
      cwd: repoRoot(),
      env: process.env,
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

  // stdout is the agent's NDJSON event stream (see agentArgv) — render it to
  // readable lines as it arrives. stderr is plain text and passes through.
  const renderer = createStreamRenderer();
  const append = (str: string) => {
    if (!str) return;
    log.write(str);
    session.tail = (session.tail + str).slice(-TAIL_MAX);
  };
  child.stdout.on("data", (d: Buffer) => append(renderer.push(d.toString())));
  child.stderr.on("data", (d: Buffer) => append(d.toString()));
  child.on("error", (err) => {
    session.error = String(err);
    log.write(`\n[error] ${String(err)}`);
  });
  child.on("close", (code) => {
    append(renderer.flush());
    // Stamp the elapsed time through the same stream (not an appendFileSync
    // after log.end(), which would race the stream's pending flush), and hand the
    // exact instant to finish() so the file and the registry agree.
    const endedAt = Date.now();
    log.write(durationLine(session, endedAt));
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

function finish(
  s: RegistryState,
  session: Session,
  res: { ok: boolean; code: number | null; error?: string; endedAt?: number },
): void {
  session.status = res.ok ? "done" : "error";
  session.ok = res.ok;
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

function toView(r: Session, withTail: boolean): SessionView {
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
    input: r.input,
    resumable: r.resumable,
    ok: r.ok,
    code: r.code,
    error: r.error,
    // Terminal session whose exit we never saw (it outlived a UI restart) — the
    // UI shows it as finished with no pass/fail mark.
    outcomeUnknown: r.status !== "running" ? r.outcomeUnknown : undefined,
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
  return [...s.sessions.values()]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((r) => toView(r, true));
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
  const view = toView(r, false);
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
    const { tail, result, durationMs } = splitLogResult(raw);
    view.tail = tail;
    if (result && r.status !== "running") view.result = result;
    // The registry's own timestamps win when it has them; the stamp in the log is
    // the fallback for a session whose endedAt didn't survive.
    if (view.durationMs === undefined && durationMs !== undefined && r.status !== "running") {
      view.durationMs = durationMs;
    }
  }
  return view;
}
