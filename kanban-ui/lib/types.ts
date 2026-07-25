// Shapes shared between the board reader (server) and the UI (client).

export type Level = "high" | "med" | "low";

/** The stage a card rests in, saved on the card so it survives a UI restart.
 *  In order: `todo` (raw), `ready` (plan concrete, no open questions, someone
 *  could start now), `implementing`. `reject`/`archive` remove the card, so they
 *  are not statuses — a live session's action is tracked in the session
 *  registry, not here. */
export type CardStatus = "todo" | "ready" | "implementing";

export interface CardMeta {
  title: string;
  track: string;
  priority: string;
  roi: string;
  status: CardStatus;
  blocked_by: number[];
  related: number[];
  questions: string[];
  /** The parts of the product this card touches (module names from
   *  docs/kanban/modules.md). A card with no field, or an empty list, touches
   *  none. Read-only in the UI — the CLI writes it. */
  modules: string[];
}

/** A pointer to another card — just enough to show a link. */
export interface CardRef {
  id: number;
  title: string;
}

/** A group root's subtask, as shown on the root's page. Light meta only —
 *  clicking through opens the subtask's own `/[id]` page for the full card. */
export interface Subtask {
  id: number;
  title: string;
  track: string;
  todos: { total: number; done: number };
}

export interface Card extends CardMeta {
  id: number;
  /** Path relative to docs/kanban/todo/, e.g. "ui/07-local-kanban-ui.md". */
  relPath: string;
  /** The card body below the frontmatter (markdown). */
  body: string;
  todos: { total: number; done: number };
  /** For a group root (`<id>-<slug>/root.md`): its subtasks, in id order.
   *  Absent on a plain card. */
  subtasks?: Subtask[];
  /** For a subtask nested in a group folder: a link back up to the group root.
   *  Absent on a standalone card or a root. */
  parent?: CardRef;
}

export interface Column {
  /** Track folder name, or "blockers". */
  track: string;
  /** Heading to show above the column ("Blockers", or the track name). */
  title: string;
  cards: Card[];
}

export interface ArchiveGroup {
  /** The topic heading from archive.md (e.g. "Skill", "Board format"). */
  category: string;
  /** Raw markdown of the entries under that heading. */
  markdown: string;
}

export interface Board {
  columns: Column[];
  archive: ArchiveGroup[];
  /** Ids of every open card — used to linkify only #<id>s that still exist. */
  openIds: number[];
}

export type AgentAction =
  | "implement"
  | "reject"
  | "archive"
  | "edit"
  | "create"
  | "propose"
  | "auto-refine"
  | "resolve";

/** A running or finished agent session, as the UI sees it when it polls the
 *  server-side registry. One shared picture across every tab. */
export interface SessionView {
  /** This session's unique id. For a Claude Code agent it IS Claude Code's own
   *  session id — pinned up front via `claude --session-id` — so the "resume in
   *  claude code" handoff copies it straight (`claude --resume <id>`). For a
   *  custom agent it's a generated id: still unique, just not resumable (see
   *  `resumable`). */
  sessionId: string;
  /** The card this session touches, or null for `create` (no card yet). */
  cardId: number | null;
  action: AgentAction;
  status: "running" | "done" | "error";
  startedAt: number;
  endedAt?: number;
  /** The text the user typed for this session — a create's description, an
   *  action's notes, or a reject's reason. Shown in the global sessions panel
   *  (#21); absent when the session carried no note. */
  input?: string;
  /** Exit was clean. Set once the session reaches a terminal state. */
  ok?: boolean;
  code?: number | null;
  /** Spawn/child error message, if any. */
  error?: string;
  /** Terminal session whose exit code we never learned — it was still running
   *  when the UI restarted and finished out of our sight. Shown as finished with
   *  no pass/fail mark: don't guess an outcome we never saw. */
  outcomeUnknown?: boolean;
  /** The agent's final message, parsed from its event stream. Terminal sessions
   *  only. When present the UI leads with it and folds the event tail away;
   *  absent (custom agent command, or a session re-adopted after a UI restart)
   *  the tail is all there is. */
  result?: string;
  /** True when this session runs the Claude Code CLI, so its `sessionId` is a
   *  real Claude Code session the UI can offer to resume. False for a custom
   *  (non-claude) command — the id is unique but there's nothing to resume. */
  resumable?: boolean;
  /** Tail of the session's output (last few KB). The board-wide poll attaches it
   *  only to terminal sessions; getSession() attaches it for any session — live
   *  or done — by reading the log file, so the UI can tail a running agent. */
  tail?: string;
}

/** Which agent runs the card actions. Shown read-only in the UI — the only
 *  supported agent today is Claude Code, so there is nothing to configure yet. */
export interface AgentInfo {
  /** Friendly name for the header badge, e.g. "Claude Code". */
  name: string;
  /** The resolved command every action runs, e.g. "claude -p". */
  command: string;
  /** True when using the built-in default (no docs/kanban/ui.config.json override). */
  isDefault: boolean;
}
