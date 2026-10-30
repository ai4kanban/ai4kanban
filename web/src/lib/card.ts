// Reads an akb card file as `GET /v1/tasks/{id}/card` returns it: the frontmatter carries the
// modules, priority, questions, source, blockers and related cards; the `## Todo` list the
// progress. After legacy lib/stale.ts, pick-order and questions.ts.

import { parse } from "yaml";
import type { Card, Task } from "../api";

export type Level = "high" | "med" | "low";

export interface Question {
  text: string;
  user: boolean;
  mode: "single" | "multi" | null;
  options: string[];
  recommend: number[];
}

export interface CardInfo {
  body: string;
  modules: string[];
  priority: Level | null;
  todos: { done: number; total: number } | null;
  questions: Question[];
  source: string[];
  blockedBy: string[];
  related: string[];
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]).map((x) => String(x));
const level = (v: unknown): Level | null => (v === "high" || v === "med" || v === "low" ? v : null);

/** A card names other tasks by their number in the project (`3`); shown as keys (`WC-3`). */
const keysOf = (refs: string[], key: string) => {
  const prefix = key.replace(/-\d+$/, "");
  return refs.map((x) => (/^#?\d+$/.test(x) ? `${prefix}-${x.replace(/^#/, "")}` : x));
};

export function readCard(card: Card, key: string): CardInfo {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(card.body);
  let fm: Record<string, unknown> = {};
  try {
    fm = m ? ((parse(m[1]!) as Record<string, unknown>) ?? {}) : {};
  } catch {
    fm = {};
  }
  const body = m ? card.body.slice(m[0].length) : card.body;
  const meta = card.metadata ?? {};
  const todo = /^## Todo\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(body)?.[1] ?? "";
  const ticks = [...todo.matchAll(/^\s*[-*]\s+\[([ xX])\]/gm)];
  const questions = (Array.isArray(fm.questions) ? fm.questions : [])
    .map((q): Question | null => {
      const raw = typeof q === "string" ? { question: q } : (q as Record<string, unknown>);
      if (!raw || raw.skipped) return null;
      const text = String(raw.question ?? raw.text ?? "");
      const tag = /^\[(user)\]\s+([\s\S]*)$/.exec(text);
      const options = list(raw.options);
      return {
        text: tag ? tag[2]! : text,
        user: !!tag,
        mode: options.length ? (raw.mode === "multi" ? "multi" : "single") : null,
        options,
        recommend: list(raw.recommend).map(Number).filter((n) => n > 0),
      };
    })
    .filter((q): q is Question => !!q && !!q.text);
  return {
    body: body.replace(/^\s*# [^\n]*\n+/, ""),
    modules: list(fm.modules ?? meta.modules),
    priority: level(fm.priority ?? meta.priority),
    todos: ticks.length ? { done: ticks.filter((t) => t[1] !== " ").length, total: ticks.length } : null,
    questions,
    source: list(fm.source ?? meta.source),
    blockedBy: keysOf(list(fm.blocked_by ?? meta.blocked_by), key),
    related: keysOf(list(fm.related ?? meta.related), key),
  };
}

/** `WC-12` as the board writes it: `#12`. */
export const numberOf = (key: string) => `#${key.replace(/^.*-/, "")}`;
const seqOf = (key: string) => Number(key.replace(/^.*-/, "")) || 0;

const STALE_AFTER_DAYS = 5;
const DAY_MS = 86_400_000;

/** Whole days untouched, or 0: a running task never is (legacy lib/stale.ts). */
export function staleDays(task: Task, now: number): number {
  if (task.status === "running" || task.run?.state === "running") return 0;
  const idle = now - Date.parse(task.updated_at);
  return idle > STALE_AFTER_DAYS * DAY_MS ? Math.floor(idle / DAY_MS) : 0;
}

export type Status = "review" | "running" | "queued" | "failed" | "stopped";

export const statusOf = (t: Task): Status | null =>
  t.status === "waiting_review" ? "review" : t.status === "running" ? "running" : t.status === "queued" ? "queued" : t.status === "failed" ? "failed" : t.status === "stopped" ? "stopped" : null;

export const isOpen = (t: Task) => statusOf(t) !== null;

/** Its card is being written right now (#98): shown on the board, never opened. A create that ended
 *  unwritten opens for its reason, with no card. */
export const creating = (t: Task) => t.run?.step === "create";

/** Where opening a task goes: its page, or its board while it is creating. */
export const openHref = (t: Task, query = "") =>
  creating(t) ? `/projects/${encodeURIComponent(t.project)}` : `/tasks/${encodeURIComponent(t.key)}${query}`;

const RANK: Record<Status, number> = { review: 0, running: 1, queued: 2, stopped: 3, failed: 4 };
const LV: Record<Level, number> = { high: 0, med: 1, low: 2 };

/** legacy byQueueOrder: status, the blocked sink, priority, then number. */
export const byQueueOrder =
  (info: (t: Task) => CardInfo | undefined) =>
  (a: Task, b: Task): number => {
    const ia = info(a);
    const ib = info(b);
    return (
      RANK[statusOf(a) ?? "failed"] - RANK[statusOf(b) ?? "failed"] ||
      Number(!!ia?.blockedBy.length) - Number(!!ib?.blockedBy.length) ||
      (ia?.priority ? LV[ia.priority] : 3) - (ib?.priority ? LV[ib.priority] : 3) ||
      seqOf(a.key) - seqOf(b.key)
    );
  };
