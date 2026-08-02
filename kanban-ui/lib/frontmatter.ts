// Frontmatter read/write, ported verbatim from skill/kanban.mjs so the UI's
// direct edits (title, priority, roi, body) serialize byte-for-byte the same way
// the script does. The script stays the ONLY writer for id-touching moves; the UI
// only rewrites these validated fields, and only for cards that already exist.

import { hasOptions, type CardQuestion, type QuestionMode } from "./questions";
import { NO_RELEASE, type CardMeta, type CardStatus } from "./types";

const STATUSES: CardStatus[] = ["todo", "ready", "implementing"];

const MODES: QuestionMode[] = ["single", "multi"];

// A version id is free text (`v1`, `0.5.0`, `august`) kept exactly as typed minus the
// spaces at each end, its case untouched. Missing, empty or damaged reads as no release,
// so a card written before this field still opens. Ported from normalizeRelease in
// skill/lib/validate.mjs.
export function normalizeRelease(raw: unknown): string {
  if (raw === undefined || raw === null || typeof raw === "object") return NO_RELEASE;
  if (typeof raw === "boolean") return NO_RELEASE;
  return String(raw).trim();
}

// Read any accepted form — a plain string, or the mapping parseQuestionsBlock
// builds — as one question. An empty options list reads as a plain question, so
// a half-written card still opens.
function normalizeQuestion(raw: unknown): CardQuestion {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    const text = String(r.question ?? r.text ?? "");
    const options = (Array.isArray(r.options) ? r.options : [])
      .map((o) => String(o).trim())
      .filter(Boolean);
    if (options.length === 0) return { text };
    const asked = String(r.mode) as QuestionMode;
    const mode: QuestionMode = MODES.includes(asked) ? asked : "single";
    const recommend = (Array.isArray(r.recommend) ? r.recommend : [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= options.length);
    return { text, mode, options, recommend: mode === "single" ? recommend.slice(0, 1) : recommend };
  }
  return { text: String(raw) };
}

// Read the indented block under `questions:`. An item is either `- <text>`
// (plain) or `- question: <text>` followed by its `mode:`, `options:` and
// `recommend:` lines. Ported from parseQuestionsBlock in skill/kanban.mjs.
function parseQuestionsBlock(lines: string[]): CardQuestion[] {
  const out: CardQuestion[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*-\s+([\s\S]*)$/);
    if (!m) continue;
    const head = m[1];
    const opened = head.match(/^question:\s*(.*)$/);
    if (!opened) {
      out.push({ text: unquote(head) });
      continue;
    }
    const q: Record<string, unknown> = {
      question: unquote(opened[1]),
      options: [] as string[],
      recommend: [] as number[],
    };
    // Keep reading this question's fields until the next `- ` item. The option
    // lines are `- ` items themselves, so they're consumed as they're found.
    while (i + 1 < lines.length && !/^\s*-\s/.test(lines[i + 1])) {
      const field = lines[i + 1].match(/^\s*([A-Za-z_]+):\s*(.*)$/);
      i++;
      if (!field) continue;
      const [, key, val] = field;
      if (key === "options") {
        while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
          (q.options as string[]).push(unquote(lines[i + 1].replace(/^\s*-\s+/, "")));
          i++;
        }
      } else if (key === "recommend") {
        q.recommend = val
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n));
      } else if (key === "mode") {
        q.mode = unquote(val);
      }
    }
    out.push(normalizeQuestion(q));
  }
  return out;
}

export function yamlScalar(input: unknown): string {
  const s = String(input);
  if (s === "") return '""';
  if (
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(s) ||
    /:\s/.test(s) ||
    /[\n"]/.test(s) ||
    /^\s|\s$/.test(s)
  ) {
    return JSON.stringify(s);
  }
  return s;
}

export function serializeFrontmatter(m: CardMeta): string {
  const out = ["---"];
  out.push(`title: ${yamlScalar(m.title)}`);
  out.push(`track: ${yamlScalar(m.track)}`);
  out.push(`priority: ${m.priority}`);
  out.push(`roi: ${m.roi}`);
  out.push(`status: ${STATUSES.includes(m.status) ? m.status : "todo"}`);
  // Normalized on the way out as well as in, so an edit that never touches the field can't
  // drop a release someone picked in the terminal, and a hand-written one is tidied to the
  // form the script writes.
  out.push(`release: ${yamlScalar(normalizeRelease(m.release))}`);
  out.push(`blocked_by: [${(m.blocked_by || []).join(", ")}]`);
  out.push(`related: [${(m.related || []).join(", ")}]`);
  out.push(`modules: [${(m.modules || []).join(", ")}]`);
  if (!m.questions || m.questions.length === 0) out.push("questions: []");
  else {
    out.push("questions:");
    for (const raw of m.questions) {
      const q = normalizeQuestion(raw);
      if (!hasOptions(q)) {
        out.push(`  - ${yamlScalar(q.text)}`);
        continue;
      }
      out.push(`  - question: ${yamlScalar(q.text)}`);
      out.push(`    mode: ${q.mode}`);
      out.push("    options:");
      for (const o of q.options ?? []) out.push(`      - ${yamlScalar(o)}`);
      out.push(`    recommend: [${(q.recommend ?? []).join(", ")}]`);
    }
  }
  out.push("---");
  return out.join("\n");
}

function unquote(v: string): string {
  v = String(v).trim();
  if (v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

export interface ParsedCard {
  meta: CardMeta | null;
  body: string;
}

// Parse the leading `--- ... ---` block into a meta object; return the rest as body.
export function parseFrontmatter(text: string): ParsedCard {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return { meta: null, body: text };
  let i = 1;
  const fm: string[] = [];
  while (i < lines.length && lines[i].trim() !== "---") {
    fm.push(lines[i]);
    i++;
  }
  if (i >= lines.length) return { meta: null, body: text };

  const meta: Record<string, unknown> = {};
  for (let j = 0; j < fm.length; j++) {
    const m = fm[j].match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    // `questions:` holds two shapes at once — a plain line and an options block —
    // so it gets its own reader instead of the generic list branch below.
    if (key === "questions") {
      if (val === "") {
        const block: string[] = [];
        while (j + 1 < fm.length && /^\s/.test(fm[j + 1]) && fm[j + 1].trim() !== "") {
          block.push(fm[j + 1]);
          j++;
        }
        meta.questions = parseQuestionsBlock(block);
      } else {
        meta.questions = val.trim() === "[]" ? [] : [normalizeQuestion(unquote(val))];
      }
      continue;
    }
    if (val === "") {
      const items: string[] = [];
      while (j + 1 < fm.length && /^\s*-\s+/.test(fm[j + 1])) {
        items.push(unquote(fm[j + 1].replace(/^\s*-\s+/, "")));
        j++;
      }
      meta[key] = items;
    } else if (val.startsWith("[")) {
      const inner = val.slice(1, val.lastIndexOf("]"));
      meta[key] = inner
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(unquote);
    } else {
      meta[key] = unquote(val);
    }
  }
  for (const k of ["blocked_by", "related"]) {
    const arr = meta[k];
    if (Array.isArray(arr)) {
      meta[k] = arr
        .map((x) => Number(String(x).replace(/^#/, "")))
        .filter((n) => Number.isInteger(n));
    } else {
      meta[k] = [];
    }
  }
  if (!Array.isArray(meta.questions)) {
    meta.questions = meta.questions ? [normalizeQuestion(meta.questions)] : [];
  }
  // A missing field, or a value that isn't a list, reads as no modules — the
  // same as a card that touches none. Names are kept as-is (never numeric).
  if (Array.isArray(meta.modules)) {
    meta.modules = meta.modules.map((x) => String(x)).filter(Boolean);
  } else {
    meta.modules = [];
  }

  const rawStatus = String(meta.status ?? "todo") as CardStatus;
  const normalized: CardMeta = {
    title: String(meta.title ?? ""),
    track: String(meta.track ?? ""),
    priority: String(meta.priority ?? "med"),
    roi: String(meta.roi ?? "med"),
    // A missing or unknown status reads as `todo`, so cards written before this
    // field still parse.
    status: STATUSES.includes(rawStatus) ? rawStatus : "todo",
    release: normalizeRelease(meta.release),
    blocked_by: (meta.blocked_by as number[]) ?? [],
    related: (meta.related as number[]) ?? [],
    questions: (meta.questions as CardQuestion[]) ?? [],
    modules: (meta.modules as string[]) ?? [],
  };
  return { meta: normalized, body: lines.slice(i + 1).join("\n") };
}
