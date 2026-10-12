// A contract, cut into what the review page acts on — and written back once confirmed.
//
//   # Title, summary, an optional mermaid diagram
//   ## One section per key part: a line on what is decided, then one draft, or one per ###
//   <!-- agent -->
//   ## Decided by the agent: one note-able line per list item
//
// Every piece keeps its line range, so a confirm rewrites only what the user changed.

const AGENT = /^<!--\s*agent\s*-->\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;
const NOTE = /^\s*> Note:/;

/** Which lines sit inside a fenced code block, fences included. */
function fenced(lines) {
  const inside = new Array(lines.length).fill(false);
  let open = null;
  lines.forEach((line, i) => {
    const m = FENCE.exec(line);
    if (open) {
      inside[i] = true;
      if (m && m[1][0] === open[0] && m[1].length >= open.length && !line.trim().slice(m[1].length).trim()) open = null;
    } else if (m) {
      inside[i] = true;
      open = m[1];
    }
  });
  return inside;
}

const blank = (s) => !s.trim();

/** The range without its blank lines at either end. */
function trim(lines, start, end) {
  while (start < end && blank(lines[start])) start++;
  while (end > start && blank(lines[end - 1])) end--;
  return { start, end };
}

export function parseContract(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const inside = fenced(lines);
  let body = 0;
  let status = "draft";
  if (lines[0] === "---") {
    const close = lines.indexOf("---", 1);
    if (close > 0) {
      body = close + 1;
      for (const l of lines.slice(1, close)) {
        const m = /^status:\s*(\S+)/.exec(l);
        if (m) status = m[1].replace(/^["']|["']$/g, "");
      }
    }
  }
  const at = (re, from, to) => {
    for (let i = from; i < to; i++) if (!inside[i] && re.test(lines[i])) return i;
    return -1;
  };

  const marker = at(AGENT, body, lines.length);
  const topEnd = marker < 0 ? lines.length : marker;

  const h1 = at(/^# /, body, topEnd);
  const title = h1 < 0 ? "" : lines[h1].slice(2).trim();
  const heads = [];
  for (let i = body; i < topEnd; i++) if (!inside[i] && /^## /.test(lines[i])) heads.push(i);
  const intro = trim(lines, h1 < 0 ? body : h1 + 1, heads[0] ?? topEnd);

  const sections = heads.map((head, n) => {
    const end = heads[n + 1] ?? topEnd;
    const subs = [];
    for (let i = head + 1; i < end; i++) if (!inside[i] && /^### /.test(lines[i])) subs.push(i);
    const id = `s${n}`;
    let lead;
    let drafts;
    if (subs.length) {
      lead = trim(lines, head + 1, subs[0]);
      drafts = subs.map((s, k) => ({
        id: `${id}d${k}`,
        heading: lines[s].slice(4).trim(),
        ...trim(lines, s, subs[k + 1] ?? end),
      }));
    } else {
      const all = trim(lines, head + 1, end);
      // The first paragraph is the line on what is decided, when it is plain prose.
      let cut = all.start;
      while (cut < all.end && !blank(lines[cut])) cut++;
      const first = lines[all.start] ?? "";
      const prose = cut < all.end && !/^\s*(<|`|~|\||-|\*|>|\d+\.|!\[)/.test(first);
      lead = prose ? { start: all.start, end: cut } : { start: all.start, end: all.start };
      const rest = trim(lines, lead.end, all.end);
      drafts = rest.end > rest.start ? [{ id: `${id}d0`, heading: null, ...rest }] : [];
    }
    return { id, title: lines[head].slice(3).trim(), start: head, end, lead, drafts };
  });

  let agent = null;
  if (marker >= 0) {
    const items = [];
    let open = null;
    for (let i = marker + 1; i < lines.length; i++) {
      if (!inside[i] && /^[-*] /.test(lines[i])) {
        open = { id: `a${items.length}`, start: i, end: i + 1 };
        items.push(open);
      } else if (open && !blank(lines[i]) && (/^\s/.test(lines[i]) || inside[i])) {
        open.end = i + 1;
      } else if (!blank(lines[i])) {
        open = null;
      }
    }
    agent = { start: marker, end: lines.length, items };
  }

  return { lines, status, title, intro, sections, agent };
}

export function slice(c, range) {
  return c.lines.slice(range.start, range.end).join("\n");
}

export function countNotes(text) {
  return text.split("\n").filter((l) => NOTE.test(l)).length;
}

function noteLines(note, indent) {
  return note
    .trim()
    .split(/\r?\n/)
    .map((l, i) => `${indent}> ${i ? "" : "Note: "}${l}`.trimEnd());
}

/** The contract as confirmed: deleted drafts gone, a section left with none gone with them,
 *  each note a `> Note:` line under what it annotates, and `status: confirmed`. */
export function confirmContract(text, { deleted = [], notes = {} } = {}) {
  const c = parseContract(text);
  const gone = new Set(deleted);
  const skip = new Set();
  const after = new Map();
  const add = (line, extra) => after.set(line, [...(after.get(line) ?? []), ...extra]);

  for (const s of c.sections) {
    const kept = s.drafts.filter((d) => !gone.has(d.id));
    if (s.drafts.length && !kept.length) {
      for (let i = s.start; i < s.end; i++) skip.add(i);
      continue;
    }
    for (const d of s.drafts) {
      if (gone.has(d.id)) for (let i = d.start; i < d.end; i++) skip.add(i);
      else if (notes[d.id]?.trim()) add(d.end - 1, ["", ...noteLines(notes[d.id], "")]);
    }
  }
  for (const item of c.agent?.items ?? []) {
    if (notes[item.id]?.trim()) add(item.end - 1, noteLines(notes[item.id], "  "));
  }

  const out = [];
  c.lines.forEach((line, i) => {
    if (skip.has(i)) return;
    out.push(line);
    if (after.has(i)) out.push(...after.get(i));
  });

  const joined = out.join("\n").replace(/\n{3,}/g, "\n\n");
  const front = /^---\n([\s\S]*?)\n---(?=\n|$)/.exec(joined);
  if (!front) return `---\nstatus: confirmed\n---\n\n${joined}`;
  const fields = /^status:.*$/m.test(front[1])
    ? front[1].replace(/^status:.*$/m, "status: confirmed")
    : `status: confirmed\n${front[1]}`;
  return `---\n${fields}\n---${joined.slice(front[0].length)}`;
}
