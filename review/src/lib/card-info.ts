// The meta strip's fields from an akb card as the cloud keeps it: the frontmatter the board
// writes (top-level scalars and lists, flow or block) and the `## Todo` ticks.

export type CardMeta = {
  modules: string[];
  priority: string | null;
  todos: { done: number; total: number } | null;
  source: string[];
  blockedBy: string[];
  related: string[];
};

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const unquote = (s: string) => s.trim().replace(/^(["'])([\s\S]*)\1$/, "$2");

/** `key: value`, `key: [a, b]` and `key:` over `  - a` lines; nested maps are skipped. */
function frontOf(body: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  let list: string[] | null = null;
  for (const line of FRONT.exec(body)?.[1]?.split(/\r?\n/) ?? []) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item) {
      list?.push(unquote(item[1]!));
      continue;
    }
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    list = null;
    const [, key, raw] = kv as unknown as [string, string, string];
    if (raw === "") out[key] = list = [];
    else if (/^\[.*\]$/.test(raw)) out[key] = raw.slice(1, -1).split(",").map(unquote).filter(Boolean);
    else out[key] = unquote(raw);
  }
  return out;
}

const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null || v === "" ? [] : [String(v)]);

/** A card names another by its board number; drawn as `#12`. */
const refsOf = (v: unknown) => listOf(v).map((x) => (/^\d+$/.test(x) ? `#${x}` : x));

export function cardMeta(body: string, metadata: Record<string, unknown> = {}): CardMeta {
  const fm = frontOf(body);
  const pick = (key: string) => fm[key] ?? metadata[key];
  const todo = /^## Todo\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(body.replace(FRONT, ""))?.[1] ?? "";
  const ticks = [...todo.matchAll(/^\s*[-*]\s+\[([ xX])\]/gm)];
  const priority = pick("priority");
  return {
    modules: listOf(pick("modules")),
    priority: typeof priority === "string" && priority ? priority : null,
    todos: ticks.length ? { done: ticks.filter((t) => t[1] !== " ").length, total: ticks.length } : null,
    source: listOf(pick("source")),
    blockedBy: refsOf(pick("blocked_by")),
    related: refsOf(pick("related")),
  };
}

/** The body under the frontmatter and its `# title`, which the page draws itself. */
export const withoutTitle = (body: string) => body.replace(FRONT, "").replace(/^\s*# [^\n]*\n+/, "");

/** An open question as the chat's panel asks it; `recommend` holds 0-based option indexes. */
export type CardQuestion = { text: string; options: string[]; recommend: number[]; multi: boolean };

const scalar = (s: string) => {
  const t = s.trim();
  if (t.startsWith('"')) {
    try {
      return JSON.parse(t) as string;
    } catch {
      /* fall through */
    }
  }
  return unquote(t);
};

/** The card's open `[user]` questions with choices, in order — the ones its review asks. */
export function openQuestions(body: string): CardQuestion[] {
  const lines = FRONT.exec(body)?.[1]?.split(/\r?\n/) ?? [];
  const start = lines.findIndex((l) => /^questions:\s*$/.test(l));
  if (start < 0) return [];
  const all: (CardQuestion & { skipped: boolean })[] = [];
  let indent = -1;
  for (const line of lines.slice(start + 1)) {
    if (!/^\s/.test(line)) break;
    const q = all[all.length - 1];
    const item = /^(\s*)-\s+(.*)$/.exec(line);
    const field = /^\s+([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (item && (indent < 0 || item[1]!.length <= indent)) {
      indent = item[1]!.length;
      const head = /^question:\s*(.*)$/.exec(item[2]!);
      all.push({ text: scalar(head ? head[1]! : item[2]!), options: [], recommend: [], multi: false, skipped: false });
    } else if (item && q) q.options.push(scalar(item[2]!));
    else if (field && q) {
      const [, key, value] = field as unknown as [string, string, string];
      if (key === "mode") q.multi = scalar(value) === "multi";
      else if (key === "skipped") q.skipped = scalar(value) === "true";
      else if (key === "recommend") q.recommend = value.replace(/^\[|\]$/g, "").split(",").map((n) => Number(n.trim()) - 1);
    }
  }
  return all
    .filter((q) => /^\[user\]\s/.test(q.text) && !q.skipped && q.options.length)
    .map(({ text, options, recommend, multi }) => ({
      text: text.replace(/^\[user\]\s+/, ""),
      options,
      multi,
      recommend: recommend.filter((n) => Number.isInteger(n) && n >= 0 && n < options.length).slice(0, multi ? undefined : 1),
    }));
}
