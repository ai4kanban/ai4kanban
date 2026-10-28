// A group root's subtasks, read off its project's board files as legacy cli/src/lib/view/read.ts
// read a group folder: the root is `todo/<id>-<slug>/root.md`, its subtasks every other card in
// that folder, plus the archived ones its `## Todo` lines still name by `#<id>`.

import { parse } from "yaml";
import * as api from "../api";

export interface Subtask {
  id: number;
  title: string;
  blocked_by: number[];
  todos: { done: number; total: number };
}

type Board = { head: number | null; files: Map<string, string>; reading: Promise<Map<string, string>> | null };
const boards = new Map<string, Board>();

/** The project's board files by their path under it, read on from where the last read stopped. */
export function boardFiles(project: string): Promise<Map<string, string>> {
  let b = boards.get(project);
  if (!b) boards.set(project, (b = { head: null, files: new Map(), reading: null }));
  const board = b;
  if (board.reading) return board.reading;
  const root = `projects/${project}/`;
  board.reading = api
    .readBoard(project, board.head)
    .then((r) => {
      for (const f of r.files) {
        if (!f.path.startsWith(root)) continue;
        const path = f.path.slice(root.length);
        if (f.content == null) board.files.delete(path);
        else board.files.set(path, f.content);
      }
      board.head = r.head_seq;
      return board.files;
    })
    .finally(() => (board.reading = null));
  return board.reading;
}

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function front(content: string): Record<string, unknown> {
  try {
    const m = FRONT.exec(content);
    return m ? ((parse(m[1]!) as Record<string, unknown>) ?? {}) : {};
  } catch {
    return {};
  }
}

const todoOf = (content: string) => /^## Todo\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(content.replace(FRONT, ""))?.[1] ?? "";

function subtaskOf(id: number, content: string): Subtask {
  const fm = front(content);
  const ticks = [...todoOf(content).matchAll(/^\s*[-*]\s+\[([ xX])\]/gm)];
  const by = (Array.isArray(fm.blocked_by) ? fm.blocked_by : fm.blocked_by == null ? [] : [fm.blocked_by])
    .map((x) => Number(/(\d+)$/.exec(String(x))?.[1]))
    .filter((n) => Number.isInteger(n));
  return {
    id,
    title: typeof fm.title === "string" ? fm.title : (/^# (.+)$/m.exec(content)?.[1] ?? `#${id}`),
    blocked_by: by,
    todos: { done: ticks.filter((t) => t[1] !== " ").length, total: ticks.length },
  };
}

/** Card `id`'s subtasks by id, or null when it is no group's root. */
export function subtasksOf(files: Map<string, string>, id: number): Subtask[] | null {
  let folder: string | undefined;
  for (const p of files.keys()) {
    const m = /^todo\/([^/]+)\/root\.md$/.exec(p);
    if (m && m[1]!.startsWith(`${id}-`)) folder = m[1];
  }
  if (!folder) return null;
  const out = new Map<number, Subtask>();
  for (const [p, content] of files) {
    if (!p.startsWith(`todo/${folder}/`) || !p.endsWith(".md")) continue;
    const m = /(?:^|\/)(\d+)-[^/]*\.md$/.exec(p);
    if (m) out.set(Number(m[1]), subtaskOf(Number(m[1]), content));
  }
  const listed = [...todoOf(files.get(`todo/${folder}/root.md`)!).matchAll(/^\s*[-*]\s+\[[ xX]\].*#(\d+)\s*$/gm)].map((m) => Number(m[1]));
  for (const n of listed) {
    if (out.has(n) || n === id) continue;
    for (const [p, content] of files) {
      if (new RegExp(`^\\.archive/(?:[^/]+/)*${n}-[^/]*\\.md$`).test(p)) {
        out.set(n, subtaskOf(n, content));
        break;
      }
    }
  }
  return [...out.values()].sort((a, b) => a.id - b.id);
}
