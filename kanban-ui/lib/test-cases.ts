// The project's test cases (#1422): `docs/qa/<module>/<case>/case.md` and the evidence beside
// it, read straight off disk. Read-only, and kept free of the app's own imports so a plain
// `node --test` can load it.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
export const CASE_FILE = "case.md";

/** Drawn in place on the case page. The same set as asset-bytes.ts, which a plain
 *  `node --test` cannot import from here. */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

/** Opened in place on the case page, and served as plain text. */
export const TEXT_TYPES = new Set(["log", "txt", "out", "sh", "js", "mjs", "cjs", "ts", "py", "sql", "json", "yaml", "yml", "csv", "diff"]);

const TEXT_MAX = 256 * 1024;

export interface CaseSummary {
  /** `""` for a case in a project with no module folders. */
  module: string;
  slug: string;
  title: string;
  steps: number;
  shots: number;
  logs: number;
  notes: number;
  /** Epoch ms. */
  updated: number;
}

export interface CaseModule {
  name: string;
  cases: CaseSummary[];
}

export interface CaseList {
  /** No module folders: the cases sit straight under `docs/qa/`. */
  flat: boolean;
  modules: CaseModule[];
  total: number;
}

export type Evidence =
  | { kind: "image" }
  | { kind: "text"; text: string; lines: number }
  | { kind: "missing" };

export type SectionKind = "setup" | "steps" | "feedback" | "other";

export interface CaseSection {
  kind: SectionKind;
  /** The `##` line as written, kept for an `other` section. */
  heading: string;
  body: string;
}

/** One feedback note: the bold phrase it opens with, if any, the rest, and the note as written. */
export interface FeedbackNote {
  title: string | null;
  body: string;
  text: string;
}

/** The Feedback section read as notes, with whatever in it is not a list item kept apart. */
export interface FeedbackRows {
  lead: string;
  notes: FeedbackNote[];
}

export interface CaseFile extends CaseSummary {
  relPath: string;
  /** The Feedback section as notes, when the case has one. */
  feedback: FeedbackRows | null;
  /** What sits between the title and the first `##`. */
  intro: string;
  sections: CaseSection[];
  /** Every relative link target in the body that names an image or a text file. */
  evidence: Record<string, Evidence>;
}

const SEGMENT = /^(?!\.)[^/\\]+$/;
const KNOWN: Record<string, SectionKind> = { setup: "setup", steps: "steps", feedback: "feedback" };

const isDir = (p: string) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const isFile = (p: string) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};
const subdirs = (dir: string) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && SEGMENT.test(e.name))
    .map((e) => e.name)
    .sort();

/** `file` inside `root`, symlinks resolved. */
function inside(root: string, file: string): boolean {
  try {
    const realRoot = fs.realpathSync(root);
    const real = fs.realpathSync(file);
    return real.startsWith(realRoot + path.sep);
  } catch {
    return false;
  }
}

/** The text with fenced blocks blanked out, so nothing inside one is counted as a link. */
function withoutFences(text: string): string {
  let fence: string | null = null;
  return text
    .split("\n")
    .map((line) => {
      const m = /^\s*(`{3,}|~{3,})/.exec(line);
      if (fence) {
        if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length) fence = null;
        return "";
      }
      if (m) {
        fence = m[1]!;
        return "";
      }
      return line;
    })
    .join("\n");
}

/** The title and the `##` sections, split outside fenced blocks. */
export function splitCase(text: string): { title: string; intro: string; sections: CaseSection[] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const plain = withoutFences(lines.join("\n")).split("\n");
  let title = "";
  const intro: string[] = [];
  const sections: CaseSection[] = [];
  let open: { heading: string; lines: string[] } | null = null;
  const close = () => {
    if (!open) return;
    const name = open.heading.replace(/^##\s+/, "").trim();
    sections.push({ kind: KNOWN[name.toLowerCase()] ?? "other", heading: open.heading, body: open.lines.join("\n").trim() });
  };
  lines.forEach((line, i) => {
    const bare = plain[i]!;
    if (!title && !open && /^#\s+/.test(bare)) {
      title = bare.replace(/^#\s+/, "").trim();
      return;
    }
    if (/^##\s+/.test(bare)) {
      close();
      open = { heading: bare.trim(), lines: [] };
      return;
    }
    (open ? open.lines : intro).push(line);
  });
  close();
  return { title, intro: intro.join("\n").trim(), sections };
}

/** Top-level list items in a section — `- `/`* ` at the line's start. */
export function topItems(body: string, numbered = false): number {
  const re = numbered ? /^\d+[.)]\s/ : /^[-*+]\s/;
  return withoutFences(body).split("\n").filter((line) => re.test(line)).length;
}

/** Each top-level list item is a note; a note opening with `**phrase**` takes it as its title. */
export function feedbackRows(body: string): FeedbackRows {
  const lines = body.split("\n");
  const plain = withoutFences(body).split("\n");
  const lead: string[] = [];
  const items: string[][] = [];
  let item: string[] | null = null;
  lines.forEach((line, i) => {
    const bare = plain[i]!;
    const start = /^[-*+]\s+/.exec(bare);
    if (start) {
      item = [line.slice(start[0].length)];
      items.push(item);
    } else if (item && (/^\s/.test(line) || line === "" || bare === "" || item[item.length - 1] !== "")) {
      item.push(line.replace(/^ {1,4}/, ""));
    } else {
      item = null;
      lead.push(line);
    }
  });
  const notes = items.map((raw) => {
    const text = raw.join("\n").trim();
    const bold = /^\*\*(.+?)\*\*\s*[：:]?\s*/s.exec(text);
    return bold
      ? { title: bold[1]!.trim(), body: text.slice(bold[0].length).trim(), text }
      : { title: null, body: text, text };
  });
  return { lead: lead.join("\n").trim(), notes };
}

/** Kept under the inbox's own 120-character title cut, so the title written is this one. */
const ITEM_TITLE_MAX = 100;

/** The triage item one feedback note becomes (#1459): its bold opening or first line as the
 *  title, the note as written, and the case it came from. Both sending it and asking whether
 *  it was sent build it here, so the two always hash the same words. */
export function feedbackItem(file: CaseFile, index: number): { title: string; text: string } | null {
  const note = file.feedback?.notes[index];
  if (!note) return null;
  const first = (note.title ?? note.body.split("\n").find((line) => line.trim()) ?? "").replace(/^#+\s*/, "").trim();
  const title = first.length > ITEM_TITLE_MAX ? `${first.slice(0, ITEM_TITLE_MAX - 1).trimEnd()}…` : first;
  if (!title) return null;
  return { title, text: `${note.text}\n\nFrom test case "${file.title}" — ${file.relPath}` };
}

const extOf = (name: string) => name.split(/[?#]/)[0]!.split(".").pop()?.toLowerCase() ?? "";

/** Relative link targets: `[x](t)` and `![x](t)`, with whether each is an image link. */
function links(text: string): { target: string; image: boolean }[] {
  const out: { target: string; image: boolean }[] = [];
  for (const m of withoutFences(text).matchAll(/(!?)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    const target = m[2]!;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/") || target.startsWith("#")) continue;
    out.push({ target, image: m[1] === "!" });
  }
  return out;
}

function counts(text: string, sections: CaseSection[]) {
  const steps = sections.find((s) => s.kind === "steps");
  const feedback = sections.find((s) => s.kind === "feedback");
  const all = links(text);
  return {
    steps: steps ? topItems(steps.body, true) : 0,
    shots: all.filter((l) => l.image && IMAGE_TYPES[extOf(l.target)]).length,
    logs: new Set(all.filter((l) => extOf(l.target) === "log").map((l) => l.target)).size,
    notes: feedback ? topItems(feedback.body) : 0,
  };
}

/** Each case folder's last commit time, from one `git log` over the whole manual. */
function commitTimes(qaRoot: string): Map<string, number> {
  const times = new Map<string, number>();
  let out: string;
  try {
    out = execFileSync("git", ["log", "--format=>%ct", "--name-only", "--relative", "--", "."], {
      cwd: qaRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return times;
  }
  let at = 0;
  for (const line of out.split("\n")) {
    if (line.startsWith(">")) at = Number(line.slice(1)) * 1000;
    else if (line) {
      // Every folder above the file, so a case is dated by any file in it.
      for (let dir = path.posix.dirname(line); dir !== "."; dir = path.posix.dirname(dir)) {
        if (!times.has(dir)) times.set(dir, at);
      }
    }
  }
  return times;
}

function summary(qaRoot: string, module: string, slug: string, times: Map<string, number>): CaseSummary {
  const rel = module ? `${module}/${slug}` : slug;
  const file = path.join(qaRoot, rel, CASE_FILE);
  const text = fs.readFileSync(file, "utf8");
  const parts = splitCase(text);
  return {
    module,
    slug,
    title: parts.title || slug,
    ...counts(text, parts.sections),
    updated: times.get(rel) ?? fs.statSync(file).mtimeMs,
  };
}

const newestFirst = (a: CaseSummary, b: CaseSummary) => b.updated - a.updated || a.title.localeCompare(b.title);

/** Every case under `qaRoot`, grouped by module; `null` when there is none. Modules follow
 *  `order` (the board's module map), and folders it does not name come after. */
export function listCases(qaRoot: string, order: string[] = []): CaseList | null {
  if (!isDir(qaRoot)) return null;
  const times = commitTimes(qaRoot);
  const loose: CaseSummary[] = [];
  const modules: CaseModule[] = [];
  for (const dir of subdirs(qaRoot)) {
    if (isFile(path.join(qaRoot, dir, CASE_FILE))) {
      loose.push(summary(qaRoot, "", dir, times));
      continue;
    }
    const cases = subdirs(path.join(qaRoot, dir))
      .filter((slug) => isFile(path.join(qaRoot, dir, slug, CASE_FILE)))
      .map((slug) => summary(qaRoot, dir, slug, times));
    if (cases.length) modules.push({ name: dir, cases: cases.sort(newestFirst) });
  }
  if (!modules.length) {
    return loose.length ? { flat: true, modules: [{ name: "", cases: loose.sort(newestFirst) }], total: loose.length } : null;
  }
  const rank = (name: string) => {
    const i = order.indexOf(name);
    return i < 0 ? order.length : i;
  };
  modules.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  return { flat: false, modules, total: modules.reduce((n, m) => n + m.cases.length, 0) };
}

/** Whether there is any case at all — the rail's question, asked without reading one. */
export function hasCases(qaRoot: string): boolean {
  if (!isDir(qaRoot)) return false;
  return subdirs(qaRoot).some(
    (dir) =>
      isFile(path.join(qaRoot, dir, CASE_FILE)) ||
      subdirs(path.join(qaRoot, dir)).some((slug) => isFile(path.join(qaRoot, dir, slug, CASE_FILE))),
  );
}

/** A path under `qaRoot` named by address segments, or `null` when it climbs or hides. */
export function resolveIn(qaRoot: string, segments: string[]): string | null {
  if (!segments.length || !segments.every((s) => SEGMENT.test(s))) return null;
  const file = path.join(qaRoot, ...segments);
  return inside(qaRoot, file) ? file : null;
}

/** One case, by its address segments — `[module, case]`, or `[case]` with no modules. */
export function readCase(qaRoot: string, segments: string[]): CaseFile | null {
  const dir = resolveIn(qaRoot, segments);
  const file = dir && path.join(dir, CASE_FILE);
  if (!file || !isFile(file) || !inside(qaRoot, file)) return null;
  const moduleName = segments.length > 1 ? segments[0]! : "";
  const slug = segments[segments.length - 1]!;
  const text = fs.readFileSync(file, "utf8");
  const parts = splitCase(text);
  const evidence: Record<string, Evidence> = {};
  for (const { target } of links(text)) {
    const ext = extOf(target);
    if (!IMAGE_TYPES[ext] && !TEXT_TYPES.has(ext)) continue;
    let name: string;
    try {
      name = decodeURIComponent(target.split(/[?#]/)[0]!);
    } catch {
      name = target;
    }
    const at = path.join(dir, name);
    if (!inside(qaRoot, at) || !isFile(at)) evidence[target] = { kind: "missing" };
    else if (IMAGE_TYPES[ext]) evidence[target] = { kind: "image" };
    else {
      const raw = fs.readFileSync(at, "utf8");
      const body = raw.length > TEXT_MAX ? raw.slice(0, TEXT_MAX) : raw;
      const textOut = body.replace(/\n$/, "");
      evidence[target] = { kind: "text", text: textOut, lines: textOut.split("\n").length };
    }
  }
  return {
    module: moduleName,
    slug,
    title: parts.title || slug,
    ...counts(text, parts.sections),
    updated: commitTimes(qaRoot).get(segments.join("/")) ?? fs.statSync(file).mtimeMs,
    relPath: path.posix.join("docs/qa", ...segments, CASE_FILE),
    feedback: ((f) => (f ? feedbackRows(f.body) : null))(parts.sections.find((x) => x.kind === "feedback")),
    intro: parts.intro,
    sections: parts.sections,
    evidence,
  };
}

/** The bytes of one file in a case folder: an image, or text. */
export function serveCaseFile(qaRoot: string, segments: string[]): Response {
  const file = resolveIn(qaRoot, segments);
  const ext = extOf(segments[segments.length - 1] ?? "");
  const type = IMAGE_TYPES[ext] ?? (TEXT_TYPES.has(ext) ? "text/plain; charset=utf-8" : null);
  if (!file || !type || !isFile(file)) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(file)), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
