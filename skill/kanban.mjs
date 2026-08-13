#!/usr/bin/env node
// ai4kanban 0.5.1 — built from the CLI's TypeScript sources by cli/scripts/build.mjs.
// Do not edit: every change belongs in cli/src/, and a build overwrites this file.
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/io.ts
function startCollecting() {
  sink = { out: [], warnings: [] };
  return sink;
}
function stopCollecting() {
  sink = null;
}
function quietly(fn) {
  const before = sink;
  sink = { out: [], warnings: [] };
  try {
    return fn();
  } finally {
    sink = before;
  }
}
function say(line2 = "") {
  const text4 = String(line2);
  if (sink) sink.out.push(...text4.split("\n"));
  else console.log(text4);
}
function warn(message) {
  if (sink) sink.warnings.push(String(message));
  else console.error(`kanban: warning \u2014 ${message}`);
}
var BoardError, sink;
var init_io = __esm({
  "src/lib/io.ts"() {
    "use strict";
    BoardError = class extends Error {
      // `kind` is the machine-readable name of the refusal (card-not-found, no-board,
      // unknown-track, …). It is what a caller reads; the exit code stays 1 for every
      // refusal, so nobody has to keep a table of numbers.
      kind;
      // `bare` says the message is already the whole thing a person should see — a usage
      // block, say — so the dispatcher prints it without putting the command in front of it.
      bare;
      details;
      constructor(message, { kind = "refused", bare = false, ...details } = {}) {
        super(message);
        this.name = "BoardError";
        this.kind = kind;
        this.bare = bare;
        this.details = details;
      }
    };
    sink = null;
  }
});

// src/lib/paths.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
function setBoardRoot(root) {
  REPO_ROOT = path.resolve(root);
  KANBAN = path.join(REPO_ROOT, "docs", "kanban");
  TODO = path.join(KANBAN, "todo");
  ARCHIVE = path.join(KANBAN, ".archive");
  ARCHIVE_MD = path.join(KANBAN, "archive.md");
  NEXT_ID = path.join(KANBAN, "next-id");
  README = path.join(TODO, "README.md");
  METRICS = path.join(KANBAN, "metrics.csv");
  MODULES_MD = path.join(KANBAN, "modules.md");
  CONFIG = path.join(KANBAN, "config.md");
  KANBAN_GITIGNORE = path.join(KANBAN, ".gitignore");
  RELEASES = path.join(KANBAN, "releases.md");
  RELEASE_SUMMARIES = path.join(KANBAN, ".release-summaries");
  SETUP_CHECKLIST = path.join(KANBAN, "setup-checklist.md");
  MEMORY = path.join(KANBAN, "memory");
  GOAL = path.join(MEMORY, "goal.md");
  LOCK = path.join(KANBAN, ".lock");
  UI_CONFIG = path.join(KANBAN, "ui.config.json");
  ENV_FILE = path.join(KANBAN, ".env");
  SESSIONS = path.join(KANBAN, ".sessions.json");
  SESSIONS_DIR = path.join(KANBAN, ".sessions");
  SESSIONS_LOCK = path.join(KANBAN, ".sessions.lock");
  INDEX_LOCK = path.join(KANBAN, ".index.lock");
  return REPO_ROOT;
}
function die(msg, kind) {
  throw new BoardError(msg, typeof kind === "string" ? { kind } : kind);
}
function warn2(msg) {
  warn(msg);
}
function readNextId() {
  if (!fs.existsSync(NEXT_ID)) die(`missing ${rel(NEXT_ID)}`, "no-next-id");
  const value = fs.readFileSync(NEXT_ID, "utf8").trim();
  if (!/^\d+$/.test(value)) die(`${rel(NEXT_ID)} is not a plain number: "${value}"`);
  return Number(value);
}
function writeNextId(value) {
  fs.writeFileSync(NEXT_ID, `${value}
`);
}
var SKILL_DIR, REPO_ROOT, KANBAN, TODO, ARCHIVE, ARCHIVE_MD, NEXT_ID, README, METRICS, MODULES_MD, CONFIG, KANBAN_GITIGNORE, RELEASES, RELEASE_SUMMARIES, SETUP_CHECKLIST, MEMORY, GOAL, LOCK, UI_CONFIG, ENV_FILE, SESSIONS, SESSIONS_DIR, SESSIONS_LOCK, INDEX_LOCK, rel;
var init_paths = __esm({
  "src/lib/paths.ts"() {
    "use strict";
    init_io();
    SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
    REPO_ROOT = "";
    KANBAN = "";
    TODO = "";
    ARCHIVE = "";
    ARCHIVE_MD = "";
    NEXT_ID = "";
    README = "";
    METRICS = "";
    MODULES_MD = "";
    CONFIG = "";
    KANBAN_GITIGNORE = "";
    RELEASES = "";
    RELEASE_SUMMARIES = "";
    SETUP_CHECKLIST = "";
    MEMORY = "";
    GOAL = "";
    LOCK = "";
    UI_CONFIG = "";
    ENV_FILE = "";
    SESSIONS = "";
    SESSIONS_DIR = "";
    SESSIONS_LOCK = "";
    INDEX_LOCK = "";
    setBoardRoot(process.cwd());
    rel = (p) => path.relative(REPO_ROOT, p) || p;
  }
});

// src/lib/lock.ts
import fs2 from "node:fs";
import path2 from "node:path";
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function ageOf(dir) {
  try {
    return Date.now() - fs2.statSync(dir).mtimeMs;
  } catch {
    return 0;
  }
}
function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}
function ownerOf(dir) {
  try {
    const pid = Number(fs2.readFileSync(path2.join(dir, OWNER), "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : void 0;
  } catch {
    return void 0;
  }
}
function claimBreak(dir) {
  try {
    fs2.mkdirSync(path2.join(dir, BREAKING));
    return true;
  } catch {
    return false;
  }
}
function withLock(dir, what, fn) {
  const until = Date.now() + WAIT_MS;
  let held;
  for (; ; ) {
    try {
      fs2.mkdirSync(dir, { recursive: false });
      try {
        fs2.writeFileSync(path2.join(dir, OWNER), `${process.pid}
`);
      } catch {
      }
      break;
    } catch (err) {
      const code = err.code;
      if (code === "ENOENT") {
        fs2.mkdirSync(path2.dirname(dir), { recursive: true });
        continue;
      }
      if (code !== "EEXIST") throw err;
      if (ageOf(dir) > STALE_MS) {
        fs2.rmSync(dir, { recursive: true, force: true });
        continue;
      }
      held = ownerOf(dir);
      if (held !== void 0 && !pidAlive(held) && claimBreak(dir)) {
        fs2.rmSync(dir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > until) {
        die(
          `another command is ${what}${held ? ` (process ${held})` : ""} and did not finish in ${WAIT_MS / 1e3}s. If nothing else is running, remove ${rel(dir)}/ and try again.`,
          "board-busy"
        );
      }
      sleep(RETRY_MS);
    }
  }
  try {
    return fn();
  } finally {
    const owner = ownerOf(dir);
    if (owner === void 0 || owner === process.pid) fs2.rmSync(dir, { recursive: true, force: true });
  }
}
function withBoardLock(fn) {
  if (!fs2.existsSync(KANBAN)) return fn();
  return withLock(LOCK, "writing this board", fn);
}
var WAIT_MS, STALE_MS, RETRY_MS, OWNER, BREAKING, LOCK_IGNORE_LINE;
var init_lock = __esm({
  "src/lib/lock.ts"() {
    "use strict";
    init_paths();
    WAIT_MS = 1e4;
    STALE_MS = 6e4;
    RETRY_MS = 25;
    OWNER = "owner";
    BREAKING = "breaking";
    LOCK_IGNORE_LINE = ".lock/";
  }
});

// src/lib/metrics.ts
import fs3 from "node:fs";
function today() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function bumpMetric(kind, amount = 1) {
  const day = today();
  let rows = [];
  if (fs3.existsSync(METRICS)) {
    rows = fs3.readFileSync(METRICS, "utf8").trim().split("\n").slice(1).filter(Boolean).map((line2) => {
      const [date, ...counts] = line2.split(",");
      const row2 = { date: date ?? "" };
      COLUMNS.forEach((c, i) => row2[c] = Number(counts[i] || 0));
      return row2;
    });
  }
  let row = rows.find((r) => r.date === day);
  if (!row) {
    row = { date: day, completed: 0, created: 0, rejected: 0 };
    rows.push(row);
  }
  row[kind] += amount;
  const out = ["date," + COLUMNS.join(",")];
  for (const r of rows) out.push([r.date, ...COLUMNS.map((c) => r[c])].join(","));
  fs3.writeFileSync(METRICS, out.join("\n") + "\n");
}
var COLUMNS;
var init_metrics = __esm({
  "src/lib/metrics.ts"() {
    "use strict";
    init_paths();
    COLUMNS = ["completed", "created", "rejected"];
  }
});

// src/lib/view/types.ts
var NO_RELEASE, METRICS_WINDOW_DAYS;
var init_types = __esm({
  "src/lib/view/types.ts"() {
    "use strict";
    NO_RELEASE = "";
    METRICS_WINDOW_DAYS = 30;
  }
});

// src/lib/validate.ts
import fs4 from "node:fs";
import path3 from "node:path";
function parseFlags(args, allowed) {
  const flags = {};
  const positional = [];
  const order = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (allowed && !allowed.includes(key)) {
        die(`unknown option "--${key}". allowed: ${allowed.map((f) => "--" + f).join(", ")}`);
      }
      const next = args[i + 1];
      if (next === void 0 || next.startsWith("--")) {
        flags[key] = true;
        order.push([key, true]);
      } else {
        const current = flags[key];
        if (current === void 0) flags[key] = next;
        else if (Array.isArray(current)) current.push(next);
        else flags[key] = [current, next];
        order.push([key, next]);
        i++;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional, order };
}
function slugify(s) {
  const out = String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return out || "task";
}
function validLevel(v, name) {
  if (!LEVELS.includes(String(v))) die(`--${name} must be one of ${LEVELS.join(" | ")} (got "${v}")`);
}
function validStatus(v) {
  if (!STATUSES.includes(String(v))) die(`--status must be one of ${STATUSES.join(" | ")} (got "${v}")`);
}
function normalizeRelease(raw) {
  if (raw === void 0 || raw === null || typeof raw === "object") return NO_RELEASE;
  if (typeof raw === "boolean") return NO_RELEASE;
  return String(raw).trim();
}
function trackNames() {
  return fs4.readdirSync(TODO, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}
function validTrack(track) {
  const dir = path3.join(TODO, track);
  if (!fs4.existsSync(dir) || !fs4.statSync(dir).isDirectory()) {
    die(
      `unknown track "${track}". existing tracks: ${trackNames().join(", ") || "(none)"}. make the folder first or pick one of these \u2014 don't invent a track.`,
      { kind: "unknown-track", track, known: trackNames() }
    );
  }
}
function moduleNames() {
  if (!fs4.existsSync(MODULES_MD)) return null;
  const names2 = [];
  for (const line2 of fs4.readFileSync(MODULES_MD, "utf8").split("\n")) {
    const m = line2.match(/^\s*[-*]\s+\*\*([^*]+)\*\*/);
    if (m) names2.push(m[1].trim());
  }
  return names2;
}
function parseModuleList(raw) {
  return (Array.isArray(raw) ? raw : [raw]).flatMap((s) => String(s).split(",")).map((s) => s.trim()).filter(Boolean);
}
function validModules(mods) {
  const known = moduleNames();
  if (known === null) {
    if (mods.length) warn2(`no ${rel(MODULES_MD)} yet \u2014 skipping --modules ${mods.join(", ")}.`);
    return [];
  }
  const unknown = mods.filter((mod) => !known.includes(mod));
  if (unknown.length) {
    die(
      `unknown module(s): ${unknown.join(", ")}. known modules: ${known.join(", ") || "(none)"}. if this really is a new part of the project, add a line to ${rel(MODULES_MD)} first (\`- **<name>** \u2014 <what it is>.\`), then tag the card \u2014 that line is how the map grows.`,
      { kind: "unknown-module", modules: unknown, known }
    );
  }
  return mods;
}
function parseIdList(raw, name, ceiling) {
  const parts = (Array.isArray(raw) ? raw : [raw]).flatMap((s) => String(s).split(",")).map((s) => s.trim().replace(/^#/, "")).filter(Boolean);
  return parts.map((p) => {
    if (!/^\d+$/.test(p)) die(`--${name} takes task ids (numbers), got "${p}"`);
    const n = Number(p);
    if (n < 1 || n >= ceiling) {
      die(`--${name} points at #${n}, not a real task id (ids so far go up to ${ceiling - 1}). don't invent ids.`);
    }
    return n;
  });
}
var LEVELS, STATUSES, MODULE_NAME_RE;
var init_validate = __esm({
  "src/lib/validate.ts"() {
    "use strict";
    init_paths();
    init_types();
    init_types();
    LEVELS = ["high", "med", "low"];
    STATUSES = ["todo", "ready", "implementing"];
    MODULE_NAME_RE = /^[a-z0-9][a-z0-9-]*$/i;
  }
});

// src/lib/yaml.ts
function yamlScalar(s) {
  const text4 = String(s);
  if (text4 === "") return '""';
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(text4) || /:\s/.test(text4) || /[\n"]/.test(text4) || /^\s|\s$/.test(text4)) {
    return JSON.stringify(text4);
  }
  return text4;
}
function unquote(v) {
  const text4 = String(v).trim();
  if (text4.startsWith('"') && text4.endsWith('"')) {
    try {
      return JSON.parse(text4);
    } catch {
      return text4.slice(1, -1);
    }
  }
  if (text4.startsWith("'") && text4.endsWith("'")) return text4.slice(1, -1);
  return text4;
}
var init_yaml = __esm({
  "src/lib/yaml.ts"() {
    "use strict";
  }
});

// src/lib/view/rules.ts
function hasOptions(q) {
  return Array.isArray(q.options) && q.options.length > 0;
}
function parseQuestion(raw) {
  const m = String(raw).match(/^\[(user)\]\s+([\s\S]*)$/);
  return m ? { tag: m[1], text: m[2] } : { tag: null, text: String(raw) };
}
function formatQuestion(tag, text4) {
  return tag ? `[${tag}] ${text4}` : text4;
}
function byPickOrder(a, b) {
  return rank(STATUS_RANK, a.status) - rank(STATUS_RANK, b.status) || rank(LEVEL_RANK, a.priority) - rank(LEVEL_RANK, b.priority) || rank(LEVEL_RANK, a.roi) - rank(LEVEL_RANK, b.roi) || a.id - b.id;
}
function byDispatchOrder(a, b) {
  return rank(LEVEL_RANK, a.priority) - rank(LEVEL_RANK, b.priority) || rank(LEVEL_RANK, a.roi) - rank(LEVEL_RANK, b.roi) || a.id - b.id;
}
function canRefine(card) {
  if (card.recurring) return false;
  if (card.status !== "todo") return false;
  const { total, done } = card.todos;
  if (total > 0 && done === total) return false;
  if (card.questions.length > 0 && card.questions.every((q) => parseQuestion(q.text).tag === "user")) {
    return false;
  }
  return true;
}
var QUESTION_TAGS, STATUS_RANK, LEVEL_RANK, rank;
var init_rules = __esm({
  "src/lib/view/rules.ts"() {
    "use strict";
    QUESTION_TAGS = ["user"];
    STATUS_RANK = { ready: 0, implementing: 1, todo: 2 };
    LEVEL_RANK = { high: 0, med: 1, low: 2 };
    rank = (table, value) => table[value] ?? Object.keys(table).length;
  }
});

// src/lib/questions.ts
function normalizeQuestion(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const source = raw;
    const text4 = String(source.question ?? source.text ?? "");
    const options = (Array.isArray(source.options) ? source.options : []).map((o) => String(o).trim()).filter(Boolean);
    if (options.length === 0) return { text: text4 };
    const mode = MODES.includes(String(source.mode)) ? String(source.mode) : "single";
    const recommend = (Array.isArray(source.recommend) ? source.recommend : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= options.length);
    return { text: text4, mode, options, recommend: mode === "single" ? recommend.slice(0, 1) : recommend };
  }
  return { text: String(raw) };
}
function parseQuestionsBlock(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*-\s+([\s\S]*)$/);
    if (!m) continue;
    const head = m[1];
    const opened = head.match(/^question:\s*(.*)$/);
    if (!opened) {
      out.push({ text: unquote(head) });
      continue;
    }
    const q = {
      question: unquote(opened[1]),
      options: [],
      recommend: []
    };
    while (i + 1 < lines.length && !/^\s*-\s/.test(lines[i + 1])) {
      const field = lines[i + 1].match(/^\s*([A-Za-z_]+):\s*(.*)$/);
      i++;
      if (!field) continue;
      const [, key, val] = field;
      if (key === "options") {
        while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
          q.options.push(unquote(lines[i + 1].replace(/^\s*-\s+/, "")));
          i++;
        }
      } else if (key === "recommend") {
        q.recommend = val.replace(/^\[|\]$/g, "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n));
      } else if (key === "mode") {
        q.mode = unquote(val);
      }
    }
    out.push(normalizeQuestion(q));
  }
  return out;
}
function warnBadQuestionTags(questions) {
  for (const q of questions) {
    const m = String(q.text).match(/^\[([^\]]+)\]\s/);
    if (m && !QUESTION_TAGS.includes(m[1].toLowerCase())) {
      warn2(`question tag "[${m[1]}]" isn't recognised \u2014 use [user] (or no tag). Stored as literal text.`);
    }
  }
}
function newDraft(flag, value) {
  const text4 = value === true ? "" : String(value).trim();
  if (!text4) die(`--${flag} must not be empty`);
  return { question: text4, options: [], recommended: [] };
}
function addToDraft(q, key, value) {
  if (key === "mode") {
    const m = String(value).toLowerCase();
    if (!MODES.includes(m)) die(`--mode must be single | multi (got "${value}")`);
    q.mode = m;
    return;
  }
  const text4 = value === true ? "" : String(value).trim();
  if (!text4) die(`--${key} must not be empty`);
  if (q.options.includes(text4)) die(`"${text4}" is listed twice as an option of "${q.question}"`);
  q.options.push(text4);
  if (key === "recommended-option") q.recommended.push(text4);
}
function finalizeDraft(q) {
  if (q.options.length === 0) {
    if (q.mode !== void 0) die(`--mode only applies to a question with options ("${q.question}")`);
    return normalizeQuestion(q);
  }
  if (q.options.length < 2) {
    die(`a question with options needs at least 2 \u2014 add another --option ("${q.question}")`);
  }
  q.mode = q.mode || "single";
  if (q.mode === "single" && q.recommended.length > 1) {
    die(`--mode single takes at most one --recommended-option ("${q.question}")`);
  }
  q.recommend = q.recommended.map((text4) => q.options.indexOf(text4) + 1).sort((a, b) => a - b);
  return normalizeQuestion(q);
}
function collectQuestions(order) {
  const out = [];
  for (const [key, value] of order) {
    if (key === "question") {
      out.push(newDraft("question", value));
    } else if (key === "option" || key === "mode" || key === "recommended-option") {
      const q = out[out.length - 1];
      if (!q) die(`--${key} must come after the --question it belongs to`);
      addToDraft(q, key, value);
    }
  }
  return out.map(finalizeDraft);
}
function parseQuestionOps(args) {
  const OPS = ["append", "update", "drop", "clear", "option", "mode", "recommended-option"];
  const ops = [];
  const take = (flag, v) => {
    if (v === void 0 || v.startsWith("--")) die(`--${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) die(`update-questions takes ops, not positional args (got "${a}")`);
    const key = a.slice(2);
    if (!OPS.includes(key)) die(`unknown option "--${key}". allowed: ${OPS.map((f) => "--" + f).join(", ")}`);
    if (key === "clear") {
      ops.push({ kind: "clear" });
    } else if (key === "drop") {
      ops.push({ kind: "drop", ns: take("drop", args[++i]) });
    } else if (key === "append") {
      ops.push({ kind: "append", draft: newDraft("append", take("append", args[++i])) });
    } else if (key === "update") {
      const n = Number(take("update", args[++i]));
      if (!Number.isInteger(n) || n < 1) die('--update takes a 1-based question number, then the new text: --update <n> ".."');
      ops.push({ kind: "update", n, draft: newDraft("update", take("update", args[++i])) });
    } else {
      const last = ops[ops.length - 1];
      if (!last || !last.draft) die(`--${key} must come after the --append or --update it belongs to`);
      addToDraft(last.draft, key, take(key, args[++i]));
    }
  }
  if (!ops.length) die('update-questions needs at least one op: --append ".." | --update <n> ".." | --drop n[,n...] | --clear');
  for (const op of ops) {
    if (op.draft) {
      op.question = finalizeDraft(op.draft);
      delete op.draft;
    }
  }
  return ops;
}
function parseQuestionPositions(raw, count2, flagName) {
  const ns = String(raw).split(",").map((s) => s.trim()).filter((s) => s.length > 0).map(Number);
  if (ns.length === 0 || ns.some((n) => !Number.isInteger(n) || n < 1)) {
    die(`--${flagName} needs one or more 1-based question numbers (e.g. 1 or 1,3)`);
  }
  const over = ns.find((n) => n > count2);
  if (over !== void 0) die(`the card has ${count2} open question(s) \u2014 there's no question ${over}`);
  return ns;
}
var MODES;
var init_questions = __esm({
  "src/lib/questions.ts"() {
    "use strict";
    init_paths();
    init_yaml();
    init_rules();
    init_rules();
    MODES = ["single", "multi"];
  }
});

// src/lib/frontmatter.ts
function serializeFrontmatter(m) {
  const out = ["---"];
  out.push(`title: ${yamlScalar(m.title)}`);
  out.push(`track: ${yamlScalar(m.track)}`);
  out.push(`priority: ${m.priority}`);
  out.push(`roi: ${m.roi}`);
  out.push(`status: ${STATUSES.includes(String(m.status)) ? m.status : "todo"}`);
  out.push(`release: ${yamlScalar(normalizeRelease(m.release))}`);
  out.push(`blocked_by: [${(m.blocked_by || []).join(", ")}]`);
  out.push(`related: [${(m.related || []).join(", ")}]`);
  out.push(`modules: [${(m.modules || []).join(", ")}]`);
  if (m.cadence) out.push(`cadence: ${yamlScalar(m.cadence)}`);
  if (m.last_run) out.push(`last_run: ${yamlScalar(m.last_run)}`);
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
      for (const o of q.options) out.push(`      - ${yamlScalar(o)}`);
      out.push(`    recommend: [${q.recommend.join(", ")}]`);
    }
  }
  out.push("---");
  return out.join("\n");
}
function parseFrontmatter(text4) {
  const lines = text4.split("\n");
  if (lines[0].trim() !== "---") return { meta: null, body: text4 };
  let i = 1;
  const fm = [];
  while (i < lines.length && lines[i].trim() !== "---") {
    fm.push(lines[i]);
    i++;
  }
  if (i >= lines.length) return { meta: null, body: text4 };
  const meta = {};
  for (let j = 0; j < fm.length; j++) {
    const m = fm[j].match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    if (key === "questions") {
      if (val === "") {
        const block2 = [];
        while (j + 1 < fm.length && /^\s/.test(fm[j + 1]) && fm[j + 1].trim() !== "") {
          block2.push(fm[j + 1]);
          j++;
        }
        meta.questions = parseQuestionsBlock(block2);
      } else {
        meta.questions = val.trim() === "[]" ? [] : [normalizeQuestion(unquote(val))];
      }
      continue;
    }
    if (val === "") {
      const items = [];
      while (j + 1 < fm.length && /^\s*-\s+/.test(fm[j + 1])) {
        items.push(unquote(fm[j + 1].replace(/^\s*-\s+/, "")));
        j++;
      }
      meta[key] = items;
    } else if (val.startsWith("[")) {
      const inner = val.slice(1, val.lastIndexOf("]"));
      meta[key] = inner.split(",").map((s) => s.trim()).filter(Boolean).map(unquote);
    } else {
      meta[key] = unquote(val);
    }
  }
  for (const k of ["blocked_by", "related"]) {
    const value = meta[k];
    if (Array.isArray(value)) {
      meta[k] = value.map((x) => Number(String(x).replace(/^#/, ""))).filter((n) => Number.isInteger(n));
    } else {
      meta[k] = [];
    }
  }
  if (!Array.isArray(meta.questions)) {
    meta.questions = meta.questions ? [normalizeQuestion(meta.questions)] : [];
  }
  meta.release = normalizeRelease(meta.release);
  if (!Array.isArray(meta.modules)) meta.modules = [];
  meta.last_run = typeof meta.last_run === "string" && meta.last_run.trim() ? meta.last_run.trim() : "";
  meta.cadence = typeof meta.cadence === "string" && meta.cadence.trim() ? meta.cadence.trim() : "";
  return { meta, body: lines.slice(i + 1).join("\n") };
}
function frontmatterEnd(lines) {
  if (lines[0]?.trim() !== "---") return 0;
  let i = 1;
  while (i < lines.length && lines[i].trim() !== "---") i++;
  return i >= lines.length ? 0 : i;
}
function frontmatterField(lines, i) {
  for (let j = i; j > 0; j--) {
    const m = lines[j].match(/^([A-Za-z_]+):/);
    if (m) return m[1];
  }
  return "frontmatter";
}
var init_frontmatter = __esm({
  "src/lib/frontmatter.ts"() {
    "use strict";
    init_validate();
    init_yaml();
    init_questions();
  }
});

// src/lib/cadence.ts
function parseCadence(raw) {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(CADENCE_RE);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1) return null;
  const unit = m[2].toLowerCase();
  if (m[3] === void 0) return { n, unit, at: "" };
  if (unit !== "d") return null;
  const hour = Number(m[3]);
  const minute = Number(m[4]);
  if (hour > 23 || minute > 59) return null;
  return { n, unit, at: `${pad(hour)}:${pad(minute)}` };
}
function formatCadence(c) {
  return c.at ? `${c.n}${c.unit} at ${c.at}` : `${c.n}${c.unit}`;
}
function formatStamp(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function parseStamp(raw) {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}
function nextDue(lastRun, cadence) {
  const c = typeof cadence === "string" ? parseCadence(cadence) : cadence;
  if (!c) return null;
  const last = parseStamp(lastRun);
  if (!last) return /* @__PURE__ */ new Date(0);
  if (c.unit === "m") return new Date(last.getTime() + c.n * 6e4);
  if (c.unit === "h") return new Date(last.getTime() + c.n * 36e5);
  const [hour, minute] = c.at ? c.at.split(":").map(Number) : [last.getHours(), last.getMinutes()];
  return new Date(last.getFullYear(), last.getMonth(), last.getDate() + c.n, hour, minute, 0, 0);
}
var CADENCE_FORMS, CADENCE_RE, pad;
var init_cadence = __esm({
  "src/lib/cadence.ts"() {
    "use strict";
    CADENCE_FORMS = "<N>m (minutes), <N>h (hours), <N>d (days), or <N>d at HH:MM (whole days, at that time of day) \u2014 e.g. 30m, 6h, 1d at 09:30";
    CADENCE_RE = /^(\d+)\s*([mhd])(?:\s+at\s+(\d{1,2}):(\d{2}))?$/i;
    pad = (n) => String(n).padStart(2, "0");
  }
});

// src/lib/cards.ts
import fs5 from "node:fs";
import path4 from "node:path";
function walkMd(dir, acc = []) {
  for (const entry of fs5.readdirSync(dir, { withFileTypes: true })) {
    const full = path4.join(dir, entry.name);
    if (entry.isDirectory()) walkMd(full, acc);
    else if (entry.name.endsWith(".md")) acc.push(full);
  }
  return acc;
}
function walkDirs(dir, acc = []) {
  for (const entry of fs5.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path4.join(dir, entry.name);
    acc.push(full);
    walkDirs(full, acc);
  }
  return acc;
}
function locate(id) {
  const groupDir = walkDirs(TODO).find(
    (d) => idPrefix(path4.basename(d)) === id && fs5.existsSync(path4.join(d, "root.md"))
  );
  if (groupDir) {
    return { kind: "group", target: groupDir, rel: path4.relative(TODO, groupDir) };
  }
  const hit = walkMd(TODO).find((f) => idPrefix(path4.basename(f)) === id);
  if (hit) return { kind: "file", target: hit, rel: path4.relative(TODO, hit) };
  return null;
}
function enclosingGroupRoot(file) {
  let dir = path4.dirname(file);
  while (dir.startsWith(TODO) && dir !== TODO) {
    const root = path4.join(dir, "root.md");
    if (fs5.existsSync(root) && root !== file) return root;
    dir = path4.dirname(dir);
  }
  return null;
}
function markSubtask(rootFile, id, action) {
  const lines = fs5.readFileSync(rootFile, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line2 = lines[i];
    if (action === "tick") {
      const re = new RegExp(`^(\\s*[-*]\\s*\\[) \\](.*#${id}\\b)`);
      if (re.test(line2)) {
        lines[i] = line2.replace(re, "$1x]$2");
        fs5.writeFileSync(rootFile, lines.join("\n"));
        return true;
      }
    } else {
      const re = new RegExp(`^(\\s*[-*]\\s+(?:\\[[ xX]\\]\\s+)?)(.*#${id}\\b.*)$`);
      const m = line2.match(re);
      if (m && !m[2].includes("~~")) {
        lines[i] = `${m[1]}~~${m[2]}~~`;
        fs5.writeFileSync(rootFile, lines.join("\n"));
        return true;
      }
    }
  }
  return false;
}
function archiveDest(found) {
  const dest = path4.join(ARCHIVE, path4.basename(found.target));
  if (fs5.existsSync(dest)) die(`${rel(dest)} already exists \u2014 move it aside first, then archive again`);
  return dest;
}
function isRecurringCard(found) {
  return found.rel.split(path4.sep)[0] === "recurring";
}
var idPrefix;
var init_cards = __esm({
  "src/lib/cards.ts"() {
    "use strict";
    init_paths();
    idPrefix = (name) => {
      const m = name.match(/^(\d+)-/);
      return m ? Number(m[1]) : null;
    };
  }
});

// src/lib/recurring.ts
import fs6 from "node:fs";
import path5 from "node:path";
function pruneBody() {
  return `Squeeze the memory files back down to what helps plan the next task. Delete this
card if you don't want the job \u2014 nothing puts it back.

## Process
1. Prune the project-wide memory at \`docs/kanban/memory/\` and each module's at
   \`docs/kanban/memory/<module>/\`, following the skill's \`references/prune-memory.md\`.
`;
}
function writePruneMemoryCard() {
  const dir = path5.join(TODO, RECURRING);
  fs6.mkdirSync(dir, { recursive: true });
  const id = readNextId();
  const file = path5.join(dir, `${id}-${PRUNE_SLUG}.md`);
  if (fs6.existsSync(file)) return null;
  writeNextId(id + 1);
  const meta = {
    title: PRUNE_TITLE,
    track: RECURRING,
    priority: "med",
    roi: "med",
    status: "todo",
    release: "",
    blocked_by: [],
    related: [],
    modules: [],
    questions: []
  };
  fs6.writeFileSync(file, serializeFrontmatter(meta) + "\n\n" + pruneBody());
  return { id, file };
}
var RECURRING, PRUNE_SLUG, PRUNE_TITLE;
var init_recurring = __esm({
  "src/lib/recurring.ts"() {
    "use strict";
    init_paths();
    init_frontmatter();
    RECURRING = "recurring";
    PRUNE_SLUG = "prune-the-memory";
    PRUNE_TITLE = "Prune the memory";
  }
});

// src/lib/releases.ts
import fs7 from "node:fs";
import path6 from "node:path";
function validNewId(raw) {
  const id = String(raw === true ? "" : raw ?? "").trim();
  if (!id) die("a release needs a version id, like v1 or 0.5.0");
  if (id === "." || id === "..") die(`"${id}" names a folder, not a version \u2014 pick a version id, like v1.`);
  if (!ID_RE.test(id)) {
    die(
      `a version id can only hold letters, numbers, dot, dash and underscore (you typed "${id}") \u2014 closing a release writes a file named after it.`
    );
  }
  return id;
}
function lineEntry(line2) {
  const m = line2.match(/^\s*[-*]\s+(.*)$/);
  if (!m) return null;
  const cut = m[1].indexOf("\u2014");
  const head = (cut === -1 ? m[1] : m[1].slice(0, cut)).trim();
  const goal = cut === -1 ? "" : m[1].slice(cut + 1).trim();
  const bold = head.match(/^\*\*(.+?)\*\*$/);
  const id = (bold ? bold[1] : head).trim();
  return id ? { id, goal } : null;
}
function foldGoal(raw) {
  return String(raw === true ? "" : raw ?? "").replace(/\s+/g, " ").trim();
}
function readReleaseEntries() {
  if (!fs7.existsSync(RELEASES)) return [];
  const out = [];
  for (const line2 of fs7.readFileSync(RELEASES, "utf8").split("\n")) {
    const entry = lineEntry(line2);
    if (entry && !out.some((e) => e.id === entry.id)) out.push(entry);
  }
  return out;
}
function releaseGoal(id) {
  const entry = readReleaseEntries().find((e) => e.id === id);
  return entry ? entry.goal : "";
}
function hasReleaseList() {
  return fs7.existsSync(RELEASES);
}
function writeReleasesIfMissing() {
  if (fs7.existsSync(RELEASES)) return false;
  fs7.mkdirSync(KANBAN, { recursive: true });
  fs7.writeFileSync(RELEASES, TEMPLATE);
  return true;
}
function addRelease(raw, rawGoal) {
  const id = validNewId(raw);
  const goal = foldGoal(rawGoal);
  writeReleasesIfMissing();
  const known = readReleases();
  if (known.includes(id)) die(`"${id}" is already on the list in ${rel(RELEASES)} \u2014 releases are ${known.join(", ")}`);
  const lines = fs7.readFileSync(RELEASES, "utf8").split("\n").filter((line2) => line2.trim() !== EMPTY_MARK);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!/^\s*[-*]\s+/.test(lines[lines.length - 1] || "")) lines.push("");
  lines.push(releaseLine(id, goal));
  fs7.writeFileSync(RELEASES, lines.join("\n") + "\n");
  return id;
}
function setReleaseGoal(id, rawGoal) {
  const goal = foldGoal(rawGoal);
  const known = readReleases();
  if (!known.includes(id)) {
    die(
      `unknown release "${id}". releases on the list: ${known.join(", ") || "(none)"}. Add it with \`release new ${quoteId(id)}\`.`,
      { kind: "unknown-release", release: id, known }
    );
  }
  const lines = fs7.readFileSync(RELEASES, "utf8").split("\n");
  let done = false;
  const kept = lines.map((line2) => {
    if (done || lineId(line2) !== id) return line2;
    done = true;
    return releaseLine(id, goal);
  });
  fs7.writeFileSync(RELEASES, kept.join("\n"));
  return { id, goal };
}
function validRelease(id) {
  if (id === NO_RELEASE) return id;
  if (!hasReleaseList()) {
    die(`--release ${id}: this board has no releases yet. Make one first: \`release new ${quoteId(id)}\`.`);
  }
  const known = readReleases();
  if (!known.includes(id)) {
    die(
      `unknown release "${id}". releases on the list: ${known.join(", ") || "(none)"}. Add it with \`release new ${quoteId(id)}\`, or leave the card in no release (--release "").`,
      { kind: "unknown-release", release: id, known }
    );
  }
  return id;
}
function allTicked(body) {
  let total = 0;
  let ticked = 0;
  for (const line2 of body.split("\n")) {
    const m = line2.match(TODO_LINE);
    if (!m) continue;
    total++;
    if (m[1] !== " " && m[1] !== "") ticked++;
  }
  return total > 0 && ticked === total;
}
function cardRows(dir) {
  if (!fs7.existsSync(dir)) return [];
  const rows = [];
  for (const file of walkMd(dir)) {
    const base = path6.basename(file);
    if (base === "README.md") continue;
    const id = base === "root.md" ? idPrefix(path6.basename(path6.dirname(file))) : idPrefix(base);
    if (id == null) continue;
    const { meta, body } = parseFrontmatter(fs7.readFileSync(file, "utf8"));
    rows.push({
      id,
      file,
      // A card the script never wrote may have no title — its filename says enough.
      title: meta && meta.title || base.replace(/^\d+-/, "").replace(/\.md$/, ""),
      track: meta && meta.track || "",
      priority: meta && meta.priority || "",
      release: normalizeRelease(meta && meta.release),
      ready: Boolean(meta) && meta.status === "ready",
      done: allTicked(body),
      blockedBy: meta && meta.blocked_by || [],
      root: base === "root.md",
      recurring: path6.relative(dir, file).split(path6.sep)[0] === "recurring"
    });
  }
  return rows.sort((a, b) => a.id - b.id);
}
function countByRelease() {
  const counts = /* @__PURE__ */ new Map();
  for (const card of openCards()) {
    const c = counts.get(card.release) || { cards: 0, ready: 0 };
    c.cards++;
    if (card.ready) c.ready++;
    counts.set(card.release, c);
  }
  return counts;
}
function fillCandidates() {
  const cards = openCards();
  const byId = new Map(cards.map((c) => [c.id, c]));
  const fill = [];
  const skipped = [];
  for (const card of cards) {
    if (card.release !== NO_RELEASE || card.priority !== "high") continue;
    if (card.root) {
      skipped.push({ ...card, reason: "a group root \u2014 each subtask goes in on its own" });
      continue;
    }
    const blockers = card.blockedBy.filter((n) => n !== card.id).map((n) => byId.get(n)).filter((b) => Boolean(b) && !b.recurring);
    if (blockers.length) {
      skipped.push({ ...card, reason: `blocked by ${blockers.map((b) => `#${b.id}`).join(", ")}, still open` });
      continue;
    }
    fill.push(card);
  }
  return { fill, skipped };
}
function fillRelease(id) {
  const { fill, skipped } = fillCandidates();
  for (const card of fill) setCardRelease(card.file, id);
  return { fill, skipped };
}
function setCardRelease(file, release) {
  const { meta, body } = parseFrontmatter(fs7.readFileSync(file, "utf8"));
  if (!meta) return false;
  meta.release = release;
  fs7.writeFileSync(file, serializeFrontmatter(meta) + "\n" + body);
  return true;
}
function setSubtreeRelease(dir, release) {
  const root = path6.join(dir, "root.md");
  const changed = [];
  for (const file of walkMd(dir)) {
    const base = path6.basename(file);
    if (base === "README.md" || file === root) continue;
    const id = base === "root.md" ? idPrefix(path6.basename(path6.dirname(file))) : idPrefix(base);
    if (id == null) continue;
    if (setCardRelease(file, release)) changed.push(id);
  }
  return changed.sort((a, b) => a - b);
}
function writeSummary(id, shipped, left, goal) {
  fs7.mkdirSync(RELEASE_SUMMARIES, { recursive: true });
  const file = summaryPath(id);
  const out = [];
  out.push(`## Closed ${today2()}`);
  out.push("");
  if (goal) {
    out.push(`What it was for \u2014 ${goal}`);
    out.push("");
  }
  out.push(
    shipped.length ? `Shipped \u2014 ${plural(shipped.length, "card")}, archived while naming \`${id}\`:` : "Shipped \u2014 nothing was archived under this release."
  );
  if (shipped.length) {
    out.push("");
    for (const card of shipped) out.push(cardLine(card));
  }
  out.push("");
  out.push(
    left.length ? `Sent back with no release \u2014 ${plural(left.length, "card")} still open when it closed:` : "Sent back with no release \u2014 nothing was still open."
  );
  if (left.length) {
    out.push("");
    for (const card of left) out.push(openCardLine(card));
  }
  if (left.some((c) => c.done)) {
    out.push("");
    out.push(
      "A card marked *every todo ticked, never archived* may really have shipped. Archive it, then move its line up by hand \u2014 closing again cannot fix it."
    );
  }
  out.push("");
  const section = out.join("\n");
  if (fs7.existsSync(file)) fs7.appendFileSync(file, `
${section}`);
  else fs7.writeFileSync(file, `${HEADING(id)}
${section}`);
  return file;
}
function alreadyCounted(file) {
  if (!fs7.existsSync(file)) return /* @__PURE__ */ new Set();
  const ids = /* @__PURE__ */ new Set();
  let counting = false;
  for (const line2 of fs7.readFileSync(file, "utf8").split("\n")) {
    if (line2.startsWith("Shipped \u2014") || line2.startsWith("Archived under")) counting = true;
    else if (line2.startsWith("Sent back") || line2.startsWith("## ")) counting = false;
    const m = counting && line2.match(/^-\s+#(\d+)\b/);
    if (m) ids.add(Number(m[1]));
  }
  return ids;
}
function endingCards(id) {
  const counted = alreadyCounted(summaryPath(id));
  return {
    archived: archivedCards().filter((c) => c.release === id && !counted.has(c.id)),
    left: openCards().filter((c) => c.release === id)
  };
}
function removeReleaseLine(id) {
  const kept = [];
  let dropped = false;
  for (const line2 of fs7.readFileSync(RELEASES, "utf8").split("\n")) {
    if (!dropped && lineId(line2) === id) {
      dropped = true;
      continue;
    }
    kept.push(line2);
  }
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
  if (!kept.some((line2) => lineId(line2))) kept.push("", EMPTY_MARK);
  fs7.writeFileSync(RELEASES, kept.join("\n") + "\n");
}
function closeRelease(raw) {
  const id = String(raw === true ? "" : raw ?? "").trim();
  if (!id) die("release close needs a version id, e.g. `release close v1`");
  const known = readReleases();
  if (!known.includes(id)) {
    die(
      `unknown release "${id}". releases on the list: ${known.join(", ") || "(none)"}. A closed release is off the list for good \u2014 plan the next version with \`release new <id>\`.`,
      { kind: "unknown-release", release: id, known }
    );
  }
  const { archived: shipped, left } = endingCards(id);
  const goal = releaseGoal(id);
  const summary = writeSummary(id, shipped, left, goal);
  for (const card of left) setCardRelease(card.file, NO_RELEASE);
  removeReleaseLine(id);
  return { id, shipped, left, summary, remaining: readReleases() };
}
function dropRelease(raw) {
  const id = String(raw === true ? "" : raw ?? "").trim();
  if (!id) die("release drop needs a version id, e.g. `release drop v1`");
  const known = readReleases();
  if (!known.includes(id)) {
    die(
      `unknown release "${id}". releases on the list: ${known.join(", ") || "(none)"}. A dropped release is off the list for good \u2014 only a release on the list can be dropped.`,
      { kind: "unknown-release", release: id, known }
    );
  }
  const { archived, left } = endingCards(id);
  for (const card of left) setCardRelease(card.file, NO_RELEASE);
  removeReleaseLine(id);
  return { id, archived, left, remaining: readReleases() };
}
var EMPTY_MARK, TEMPLATE, quoteId, ID_RE, lineId, releaseLine, readReleases, TODO_LINE, openCards, archivedCards, summaryPath, today2, plural, cardLine, openCardLine, HEADING;
var init_releases = __esm({
  "src/lib/releases.ts"() {
    "use strict";
    init_paths();
    init_cards();
    init_frontmatter();
    init_validate();
    EMPTY_MARK = "_(no releases yet \u2014 `release new v1` makes the first one.)_";
    TEMPLATE = `# Releases

The versions this board is planning, in the order they ship \u2014 one line per release.
\`release new <id>\` adds one to the end. Closing a release takes its line away, so this
file only ever shows what is still ahead.

A card says which release it ships in. A card that says nothing is in no release \u2014
wanted, but not promised to a version.

The order is whatever the lines say, so a hand edit is how you reorder. What comes after
the em dash is the release's goal \u2014 what this version is for, in your own words.

${EMPTY_MARK}
`;
    quoteId = (id) => /\s/.test(id) ? `"${id}"` : id;
    ID_RE = /^[A-Za-z0-9._-]+$/;
    lineId = (line2) => lineEntry(line2)?.id || null;
    releaseLine = (id, goal) => `- **${id}**${goal ? ` \u2014 ${goal}` : ""}`;
    readReleases = () => readReleaseEntries().map((e) => e.id);
    TODO_LINE = /^[ \t]*[-*+][ \t]*\[([ xX]?)\]/;
    openCards = () => cardRows(TODO);
    archivedCards = () => cardRows(ARCHIVE);
    summaryPath = (id) => path6.join(RELEASE_SUMMARIES, `${id}.md`);
    today2 = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    cardLine = (card) => `- #${card.id} ${card.title}${card.track ? ` (${card.track})` : ""}`;
    openCardLine = (card) => cardLine(card) + (card.done ? " \u2014 every todo ticked, never archived" : "");
    HEADING = (id) => `# ${id}

What each close or drop of this release left behind. This is a list of cards, not a
changelog \u2014 not every change goes through the board, so only a person can say what the
version changed.
`;
  }
});

// src/lib/readme.ts
import fs8 from "node:fs";
import path7 from "node:path";
function stripReadmeRefs(target) {
  if (!fs8.existsSync(README)) return [];
  const needle = target.kind === "group" ? `](${target.rel}/` : `](${target.rel})`;
  const lines = fs8.readFileSync(README, "utf8").split("\n");
  const out = [];
  const removed = [];
  let i = 0;
  while (i < lines.length) {
    const line2 = lines[i];
    if (line2.includes(needle) && (isTableRow(line2) || isBulletStart(line2))) {
      removed.push(line2.trim());
      if (isBulletStart(line2)) {
        const indent = bulletIndent(line2);
        i++;
        while (i < lines.length && lines[i].trim() !== "" && !isBulletStart(lines[i]) && !/^\s*#/.test(lines[i]) && !isTableRow(lines[i]) && bulletIndent(lines[i]) > indent) {
          i++;
        }
      } else {
        i++;
      }
      continue;
    }
    out.push(line2);
    i++;
  }
  if (removed.length) fs8.writeFileSync(README, out.join("\n"));
  return removed;
}
function addReadmeRef(track, id, title, relPath) {
  if (!fs8.existsSync(README)) return false;
  const link = relPath.split(path7.sep).join("/");
  const bullet = `- [#${id} ${title}](${link})`;
  const heading = `## ${readmeHeadingFor(track)}`;
  let lines = fs8.readFileSync(README, "utf8").split("\n");
  const hi = lines.findIndex((l) => l.trim().toLowerCase() === heading.toLowerCase());
  if (hi === -1) {
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    lines.push("", heading, "", bullet);
    fs8.writeFileSync(README, lines.join("\n") + "\n");
    return true;
  }
  let end = hi + 1;
  while (end < lines.length && !/^##\s/.test(lines[end])) end++;
  const noneRel = lines.slice(hi + 1, end).findIndex((l) => l.trim() === "_(none)_");
  if (noneRel !== -1) {
    lines[hi + 1 + noneRel] = bullet;
  } else {
    let lastBullet = -1;
    for (let k = hi + 1; k < end; k++) if (/^\s*-\s/.test(lines[k])) lastBullet = k;
    const at = lastBullet !== -1 ? lastBullet + 1 : lines[hi + 1] === "" ? hi + 2 : hi + 1;
    lines.splice(at, 0, bullet);
  }
  fs8.writeFileSync(README, lines.join("\n"));
  return true;
}
function repointReadmeLink(id, oldRel, newRel, title) {
  if (!fs8.existsSync(README)) return false;
  const oldLink = oldRel.split(path7.sep).join("/");
  const newLink = newRel.split(path7.sep).join("/");
  const linkRe = new RegExp(`\\[#${id}\\b[^\\]]*\\]\\(${escapeRegex(oldLink)}\\)`);
  const lines = fs8.readFileSync(README, "utf8").split("\n");
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(`](${oldLink})`)) continue;
    const next = linkRe.test(lines[i]) ? lines[i].replace(linkRe, () => `[#${id} ${title}](${newLink})`) : lines[i].split(`](${oldLink})`).join(`](${newLink})`);
    if (next !== lines[i]) {
      lines[i] = next;
      changed = true;
    }
  }
  if (changed) fs8.writeFileSync(README, lines.join("\n"));
  return changed;
}
var isTableRow, isBulletStart, bulletIndent, readmeHeadingFor, escapeRegex;
var init_readme = __esm({
  "src/lib/readme.ts"() {
    "use strict";
    init_paths();
    isTableRow = (line2) => /^\s*\|/.test(line2);
    isBulletStart = (line2) => /^\s*[-*] /.test(line2);
    bulletIndent = (line2) => line2.match(/^(\s*)/)[1].length;
    readmeHeadingFor = (track) => track === "blockers" ? "Blockers" : track;
    escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
});

// src/lib/reconcile.ts
import fs9 from "node:fs";
import path8 from "node:path";
function liveIds() {
  const ids = /* @__PURE__ */ new Set();
  for (const file of walkMd(TODO)) {
    const base = path8.basename(file);
    if (base === "README.md") continue;
    const id = base === "root.md" ? idPrefix(path8.basename(path8.dirname(file))) : idPrefix(base);
    if (id != null) ids.add(id);
  }
  return ids;
}
function indexableCards() {
  const out = [];
  for (const dir of walkDirs(TODO)) {
    const id = idPrefix(path8.basename(dir));
    if (id != null && fs9.existsSync(path8.join(dir, "root.md"))) {
      out.push({ id, rel: path8.join(path8.relative(TODO, dir), "root.md").split(path8.sep).join("/") });
    }
  }
  for (const file of walkMd(TODO)) {
    const base = path8.basename(file);
    if (base === "README.md" || base === "root.md") continue;
    const relTODO = path8.relative(TODO, file);
    const segs = relTODO.split(path8.sep);
    if (segs.length !== 2) continue;
    if (segs[0] === "recurring") continue;
    const id = idPrefix(base);
    if (id != null) out.push({ id, rel: segs.join("/") });
  }
  return out;
}
function reconcileReadmeLinks() {
  const lines = fs9.readFileSync(README, "utf8").split("\n");
  const indexed = /* @__PURE__ */ new Set();
  let fixed = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(README_LINK);
    if (!m) continue;
    const id = Number(m[1]);
    const linkPath = m[2];
    indexed.add(id);
    if (fs9.existsSync(path8.join(TODO, linkPath))) continue;
    const found = locate(id);
    if (!found) {
      warn2(`README links #${id} \u2192 ${linkPath}, but no card with that id exists (removed by hand?). Drop the entry or restore the file.`);
      continue;
    }
    const want = (found.kind === "group" ? path8.join(found.rel, "root.md") : found.rel).split(path8.sep).join("/");
    if (want === linkPath) continue;
    lines[i] = lines[i].replace(`(${linkPath})`, `(${want})`);
    warn2(`README link #${id} pointed at missing ${linkPath} \u2192 repointed to ${want}.`);
    fixed++;
  }
  if (fixed) fs9.writeFileSync(README, lines.join("\n"));
  for (const c of indexableCards()) {
    if (!indexed.has(c.id)) {
      warn2(`card ${c.rel} (#${c.id}) is not in the README index. Add it under its track heading.`);
    }
  }
}
function reconcileCrossRefs() {
  const live = liveIds();
  for (const file of walkMd(TODO)) {
    const base = path8.basename(file);
    if (base === "README.md") continue;
    const ownerId = base === "root.md" ? idPrefix(path8.basename(path8.dirname(file))) : idPrefix(base);
    if (ownerId == null) continue;
    const { meta } = parseFrontmatter(fs9.readFileSync(file, "utf8"));
    if (!meta) continue;
    for (const field of ["blocked_by", "related"]) {
      for (const ref of meta[field] || []) {
        if (!live.has(ref)) {
          warn2(`#${ownerId} ${field} #${ref}, which is no longer on the board (archived/rejected?). Fix it with \`update ${ownerId}\`.`);
        }
      }
    }
  }
}
function reconcileBoard() {
  if (!fs9.existsSync(README)) return;
  reconcileReadmeLinks();
  reconcileCrossRefs();
}
var README_LINK;
var init_reconcile = __esm({
  "src/lib/reconcile.ts"() {
    "use strict";
    init_paths();
    init_cards();
    init_frontmatter();
    README_LINK = /\[#(\d+)\b[^\]]*\]\(([^)]+)\)/;
  }
});

// src/commands/card.ts
import fs10 from "node:fs";
import path9 from "node:path";
function defaultBody() {
  return [
    "<one short line: what to do and why it matters.>",
    "",
    "## Scope",
    "- <the concrete steps>",
    "",
    "## Todo",
    "- [ ] every task must have todos \u2014 replace this line with the real steps.",
    ""
  ].join("\n");
}
function cadenceFlag(raw) {
  if (raw === true) die(`--cadence needs a value: ${CADENCE_FORMS}. Use --cadence "" to clear it.`);
  const text4 = String(raw).trim();
  if (!text4) return "";
  const parsed = parseCadence(text4);
  if (!parsed) die(`--cadence "${text4}" isn't a cadence. Accepted: ${CADENCE_FORMS}`);
  return formatCadence(parsed);
}
function cmdCreate(args) {
  const { flags, positional, order } = parseFlags(args, CREATE_FLAGS);
  if (positional.length) die(`create takes options, not positional args (got "${positional.join(" ")}")`);
  if (flags.title === void 0) {
    for (const bad of ["track", "priority", "roi", "release", "blocked-by", "related", "modules", "question", "option", "mode", "recommended-option", "slug", "no-body", "cadence"]) {
      if (flags[bad] !== void 0) die(`--${bad} needs --title (that's card mode). Without --title, create only allocates ids.`);
    }
    const count2 = flags.count !== void 0 ? Number(flags.count) : 1;
    if (!Number.isInteger(count2) || count2 < 1) die("--count must be a positive integer");
    const start2 = readNextId();
    const ids = Array.from({ length: count2 }, (_, k) => start2 + k);
    writeNextId(start2 + count2);
    bumpMetric("created", count2);
    say(ids.join("\n"));
    reconcileBoard();
    return { ids };
  }
  if (flags.count !== void 0) die("--count can't be combined with --title (card mode makes exactly one card)");
  const title = String(flags.title).trim();
  if (!title) die("--title must not be empty");
  if (flags.track === void 0) die("--track is required in card mode (e.g. --track feature)");
  const track = String(flags.track).trim();
  validTrack(track);
  const priority = flags.priority !== void 0 ? String(flags.priority) : "med";
  validLevel(priority, "priority");
  const roi = flags.roi !== void 0 ? String(flags.roi) : "med";
  validLevel(roi, "roi");
  const release = validRelease(normalizeRelease(flags.release));
  const start = readNextId();
  const blocked_by = flags["blocked-by"] !== void 0 ? parseIdList(flags["blocked-by"], "blocked-by", start) : [];
  const related = flags.related !== void 0 ? parseIdList(flags.related, "related", start) : [];
  const modules = flags.modules !== void 0 ? validModules(parseModuleList(flags.modules)) : [];
  let cadence = "";
  if (flags.cadence !== void 0) {
    if (track !== RECURRING) die(`--cadence is for recurring cards only (--track ${RECURRING}); a one-shot task is built once, not repeated.`);
    cadence = cadenceFlag(flags.cadence);
  }
  const questions = collectQuestions(order);
  warnBadQuestionTags(questions);
  const slug = slugify(flags.slug !== void 0 ? flags.slug : title);
  const fileRel = path9.join(track, `${start}-${slug}.md`);
  const file = path9.join(TODO, fileRel);
  if (fs10.existsSync(file)) die(`${rel(file)} already exists \u2014 pick a different --slug`);
  writeNextId(start + 1);
  bumpMetric("created");
  const meta = { title, track, priority, roi, status: "todo", release, blocked_by, related, modules, cadence, questions };
  const body = flags["no-body"] ? "" : defaultBody();
  fs10.writeFileSync(file, serializeFrontmatter(meta) + "\n\n" + body);
  const indexed = addReadmeRef(track, start, title, fileRel);
  say(start);
  say(`  wrote ${rel(file)} \u2014 frontmatter is set; fill the body with your editor, leave the frontmatter to the script`);
  if (!TODO_ITEM.test(body)) warn2(`#${start} has no todos \u2014 every task needs a \`- [ ]\` list under ## Todo`);
  if (indexed) say(`  indexed under "## ${readmeHeadingFor(track)}"`);
  reconcileBoard();
  return { id: start, ids: [start], title, track, file: rel(file), indexed };
}
function cmdUpdate(args) {
  const { flags, positional } = parseFlags(args, UPDATE_FLAGS);
  const id = Number(positional[0]);
  if (!Number.isInteger(id)) die("need a numeric task id: update <id> [--field value ...]");
  const found = locate(id);
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: "card-not-found", id });
  const file = found.kind === "group" ? path9.join(found.target, "root.md") : found.target;
  const { meta, body } = parseFrontmatter(fs10.readFileSync(file, "utf8"));
  if (!meta) die(`${rel(file)} has no frontmatter \u2014 run \`migrate\` first`);
  const changes = [];
  if (flags.title !== void 0) {
    const t = String(flags.title).trim();
    if (!t) die("--title must not be empty");
    meta.title = t;
    changes.push("title");
  }
  if (flags.priority !== void 0) {
    validLevel(String(flags.priority), "priority");
    meta.priority = String(flags.priority);
    changes.push("priority");
  }
  if (flags.roi !== void 0) {
    validLevel(String(flags.roi), "roi");
    meta.roi = String(flags.roi);
    changes.push("roi");
  }
  if (flags.status !== void 0) {
    validStatus(String(flags.status));
    meta.status = String(flags.status);
    changes.push("status");
  }
  if (flags.release !== void 0) {
    meta.release = validRelease(normalizeRelease(flags.release));
    changes.push(`release\u2192${meta.release || "(none)"}`);
  }
  const ceiling = readNextId();
  if (flags["blocked-by"] !== void 0) {
    meta.blocked_by = parseIdList(flags["blocked-by"], "blocked-by", ceiling);
    changes.push("blocked_by");
  }
  if (flags.related !== void 0) {
    meta.related = parseIdList(flags.related, "related", ceiling);
    changes.push("related");
  }
  if (flags.modules !== void 0) {
    meta.modules = validModules(parseModuleList(flags.modules));
    changes.push("modules");
  }
  if (flags.cadence !== void 0) {
    if (!isRecurringCard(found)) die(`#${id} is not recurring (${found.rel} is not under ${RECURRING}/) \u2014 only a card that repeats can have a cadence.`);
    meta.cadence = cadenceFlag(flags.cadence);
    changes.push(`cadence\u2192${meta.cadence || "(none)"}`);
  }
  if (meta.questions.length > 0 && meta.status === "ready") {
    meta.status = "todo";
    changes.push("status\u2192todo (open questions)");
  }
  const curRel = path9.relative(TODO, file);
  const curTrack = found.kind === "group" ? meta.track : path9.basename(path9.dirname(file));
  const isSubtask = found.kind === "file" && enclosingGroupRoot(file) !== null;
  let newTrack = curTrack;
  if (flags.track !== void 0) {
    if (found.kind === "group") die("moving a group task between tracks by script is not supported \u2014 move the folder by hand");
    if (isSubtask) die("moving a group subtask between tracks by script is not supported \u2014 move the file by hand");
    newTrack = String(flags.track).trim();
    validTrack(newTrack);
  }
  let base = path9.basename(file);
  if (flags.slug !== void 0) {
    if (found.kind === "group") die("renaming a group root by script is not supported");
    base = `${id}-${slugify(flags.slug)}.md`;
  }
  meta.track = newTrack;
  if (flags.track !== void 0 && newTrack !== RECURRING && meta.cadence) {
    meta.cadence = "";
    changes.push("cadence cleared (no longer recurring)");
  }
  const standalone = found.kind === "file" && !isSubtask;
  const destRel = standalone ? path9.join(newTrack, base) : path9.join(path9.dirname(curRel), base);
  const dest = path9.join(TODO, destRel);
  const moving = dest !== file;
  if (moving && fs10.existsSync(dest)) die(`${rel(dest)} already exists`);
  fs10.writeFileSync(file, serializeFrontmatter(meta) + "\n" + body);
  if (flags.release !== void 0 && found.kind === "group") {
    const ids = setSubtreeRelease(found.target, meta.release);
    if (ids.length) changes.push(`release on ${ids.length} subtask${ids.length === 1 ? "" : "s"} (${ids.map((n) => `#${n}`).join(", ")})`);
  }
  if (moving) fs10.renameSync(file, dest);
  if (isSubtask) {
    if (moving || changes.includes("title")) repointReadmeLink(id, curRel, destRel, meta.title);
    if (moving) changes.push(`renamed \u2192 ${destRel.split(path9.sep).join("/")}`);
  } else if (moving) {
    stripReadmeRefs({ kind: "file", rel: curRel });
    addReadmeRef(newTrack, id, meta.title, destRel);
    changes.push(`moved \u2192 ${destRel.split(path9.sep).join("/")}`);
  } else if (changes.includes("title")) {
    stripReadmeRefs({ kind: "file", rel: curRel });
    addReadmeRef(curTrack, id, meta.title, curRel);
  }
  say(`updated #${id}: ${changes.join(", ") || "(nothing changed)"}`);
  return { id, changes, file: rel(dest) };
}
function cmdUpdateQuestions(args) {
  const [idRaw, ...rest] = args;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) die("need a numeric task id: update-questions <id> [ops]");
  const ops = parseQuestionOps(rest);
  const found = locate(id);
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: "card-not-found", id });
  const file = found.kind === "group" ? path9.join(found.target, "root.md") : found.target;
  const { meta, body } = parseFrontmatter(fs10.readFileSync(file, "utf8"));
  if (!meta) die(`${rel(file)} has no frontmatter \u2014 run \`migrate\` first`);
  const changes = [];
  for (const op of ops) {
    if (op.kind === "clear") {
      meta.questions = [];
      changes.push("cleared");
    } else if (op.kind === "drop") {
      const ns = parseQuestionPositions(op.ns, meta.questions.length, "drop");
      meta.questions = meta.questions.filter((_, i) => !ns.includes(i + 1));
      changes.push(`dropped ${ns.join(",")}`);
    } else if (op.kind === "append") {
      meta.questions.push(op.question);
      changes.push("appended");
    } else {
      const [n] = parseQuestionPositions(String(op.n), meta.questions.length, "update");
      meta.questions[n - 1] = op.question;
      changes.push(`rewrote ${n}`);
    }
  }
  warnBadQuestionTags(meta.questions);
  if (meta.questions.length > 0 && meta.status === "ready") {
    meta.status = "todo";
    changes.push("status\u2192todo (open questions)");
  }
  fs10.writeFileSync(file, serializeFrontmatter(meta) + "\n" + body);
  say(`updated #${id} questions: ${changes.join(", ")} (${meta.questions.length} open)`);
  return { id, changes, open: meta.questions.length, file: rel(file) };
}
function cmdTag(args) {
  const [idRaw, nRaw, tagRaw] = args;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) die("need a numeric task id: tag <id> <n[,n...]> <user|none>");
  const ns = String(nRaw || "").split(",").map((s) => s.trim()).filter((s) => s.length > 0).map(Number);
  if (ns.length === 0 || ns.some((n) => !Number.isInteger(n) || n < 1)) {
    die("need one or more 1-based question numbers: tag <id> <n[,n...]> <user|none>");
  }
  const tag = String(tagRaw || "").toLowerCase();
  if (tag !== "none" && !QUESTION_TAGS.includes(tag)) {
    die(`tag must be one of ${QUESTION_TAGS.join(" | ")} | none (got "${tagRaw}")`);
  }
  const found = locate(id);
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: "card-not-found", id });
  const file = found.kind === "group" ? path9.join(found.target, "root.md") : found.target;
  const { meta, body } = parseFrontmatter(fs10.readFileSync(file, "utf8"));
  if (!meta) die(`${rel(file)} has no frontmatter \u2014 run \`migrate\` first`);
  const over = ns.find((n) => n > meta.questions.length);
  if (over !== void 0) {
    die(`#${id} has ${meta.questions.length} open question(s) \u2014 there's no question ${over} to tag.`);
  }
  for (const n of ns) {
    const q = meta.questions[n - 1];
    const { text: text4 } = parseQuestion(q.text);
    q.text = formatQuestion(tag === "none" ? null : tag, text4);
  }
  fs10.writeFileSync(file, serializeFrontmatter(meta) + "\n" + body);
  const label = tag === "none" ? "(untagged)" : `[${tag}]`;
  say(`tagged #${id} question${ns.length > 1 ? "s" : ""} ${ns.join(", ")} as ${label}`);
  return { id, questions: ns, tag, file: rel(file) };
}
var TODO_ITEM, CREATE_FLAGS, UPDATE_FLAGS;
var init_card = __esm({
  "src/commands/card.ts"() {
    "use strict";
    init_paths();
    init_io();
    init_metrics();
    init_validate();
    init_questions();
    init_frontmatter();
    init_cadence();
    init_cards();
    init_recurring();
    init_releases();
    init_readme();
    init_reconcile();
    TODO_ITEM = /^[ \t]*[-*+][ \t]*\[[ xX]?\]/m;
    CREATE_FLAGS = ["title", "track", "priority", "roi", "release", "blocked-by", "related", "modules", "question", "option", "mode", "recommended-option", "slug", "count", "no-body", "cadence"];
    UPDATE_FLAGS = ["title", "track", "priority", "roi", "status", "release", "blocked-by", "related", "modules", "slug", "cadence"];
  }
});

// src/commands/misc.ts
import fs11 from "node:fs";
import path10 from "node:path";
function extractOldMeta(text4, file) {
  const grab = (re) => {
    const m = text4.match(re);
    return m ? m[1].trim() : null;
  };
  const folderTrack = path10.relative(TODO, file).split(path10.sep)[0];
  const title = grab(/^#\s+(.+)$/m) || slugify(path10.basename(file, ".md").replace(/^\d+-/, "")).replace(/-/g, " ");
  const track = (grab(/\*\*Track:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/) || folderTrack).toLowerCase();
  const norm = (raw) => {
    const v = (raw || "").toLowerCase();
    return LEVELS.includes(v) ? v : "med";
  };
  const ids = (raw) => raw && !/none/i.test(raw) ? (raw.match(/\d+/g) || []).map(Number) : [];
  return {
    title,
    track,
    priority: norm(grab(/\*\*Priority:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    roi: norm(grab(/\*\*ROI:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    status: "todo",
    blocked_by: ids(grab(/\*\*Blocked by:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    related: ids(grab(/\*\*Related:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    questions: []
  };
}
function stripOldHeader(text4) {
  const lines = text4.split("\n");
  let lastMeta = -1;
  for (let k = 0; k < lines.length && k < 8; k++) {
    if (/^#\s/.test(lines[k]) || /^\*\*(Track|Priority|ROI|Blocked by|Related):\*\*/.test(lines[k])) lastMeta = k;
  }
  const rest = lines.slice(lastMeta + 1);
  while (rest.length && rest[0].trim() === "") rest.shift();
  return rest.join("\n");
}
function cmdMigrate(args) {
  const { flags } = parseFlags(args, ["dry-run", "dry"]);
  const dry = !!(flags["dry-run"] || flags.dry);
  const files = walkMd(TODO).filter((f) => path10.basename(f) !== "README.md");
  let changed = 0;
  let skipped = 0;
  for (const file of files) {
    const text4 = fs11.readFileSync(file, "utf8");
    if (text4.trimStart().startsWith("---")) {
      skipped++;
      continue;
    }
    const meta = extractOldMeta(text4, file);
    const out = serializeFrontmatter(meta) + "\n\n" + stripOldHeader(text4).replace(/^\n+/, "");
    if (dry) say(`would migrate ${rel(file)}  (track=${meta.track} priority=${meta.priority} roi=${meta.roi})`);
    else {
      fs11.writeFileSync(file, out.endsWith("\n") ? out : out + "\n");
      say(`migrated ${rel(file)}`);
    }
    changed++;
  }
  say(`
${dry ? "(dry run) " : ""}${changed} card(s) ${dry ? "to migrate" : "migrated"}, ${skipped} already frontmatter`);
  return { dry_run: dry, migrated: changed, skipped };
}
function cmdRun(id) {
  if (!Number.isInteger(id)) die("need a numeric task id");
  const found = locate(id);
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: "card-not-found", id });
  if (!isRecurringCard(found)) {
    die(`#${id} is not recurring (${found.rel} is not under recurring/). Use \`archive\` for one-shot tasks.`);
  }
  const file = found.kind === "group" ? path10.join(found.target, "root.md") : found.target;
  const { meta, body } = parseFrontmatter(fs11.readFileSync(file, "utf8"));
  if (!meta) die(`${rel(file)} has no frontmatter \u2014 run \`migrate\` first`);
  const stamp = formatStamp(/* @__PURE__ */ new Date());
  meta.last_run = stamp;
  fs11.writeFileSync(file, serializeFrontmatter(meta) + "\n" + body);
  bumpMetric("completed");
  say(`ran #${id} at ${stamp}: +1 completed (card kept \u2014 recurring)`);
  const due = nextDue(meta.last_run, meta.cadence);
  say(due ? `  next due ${formatStamp(due)} (cadence ${meta.cadence})` : "  no cadence \u2014 this card runs only when you run it");
  reconcileBoard();
  return { id, last_run: stamp, cadence: meta.cadence || "", next_due: due ? formatStamp(due) : null, file: rel(file) };
}
var init_misc = __esm({
  "src/commands/misc.ts"() {
    "use strict";
    init_paths();
    init_io();
    init_metrics();
    init_validate();
    init_frontmatter();
    init_cadence();
    init_cards();
    init_reconcile();
  }
});

// src/lib/agent/log.ts
import fs12 from "node:fs";
function asUsage(v) {
  if (!v || typeof v !== "object") return void 0;
  const o = v;
  const nums = [o.input, o.cacheCreation, o.cacheRead, o.output];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) return void 0;
  return {
    input: o.input,
    cacheCreation: o.cacheCreation,
    cacheRead: o.cacheRead,
    output: o.output
  };
}
function readLogTail(logPath, maxBytes = TAIL_BYTES) {
  let fd;
  try {
    const size = fs12.statSync(logPath).size;
    const start = Math.max(0, size - maxBytes);
    const len = size - start;
    if (len === 0) return "";
    fd = fs12.openSync(logPath, "r");
    const buf = Buffer.alloc(len);
    fs12.readSync(fd, buf, 0, len, start);
    let text4 = buf.toString("utf8");
    if (start > 0) {
      const nl = text4.indexOf("\n");
      if (nl >= 0) text4 = text4.slice(nl + 1);
    }
    return text4;
  } catch {
    return null;
  } finally {
    if (fd !== void 0) {
      try {
        fs12.closeSync(fd);
      } catch {
      }
    }
  }
}
function splitLog(logText) {
  let durationMs;
  let costUsd;
  let model;
  let usage;
  const kept = [];
  for (const line2 of logText.split("\n")) {
    if (line2.startsWith(DURATION_MARKER)) {
      const ms = Number(line2.slice(DURATION_MARKER.length).trim());
      if (Number.isFinite(ms)) durationMs = ms;
      continue;
    }
    if (line2.startsWith(COST_MARKER)) {
      const usd = Number(line2.slice(COST_MARKER.length).trim());
      if (Number.isFinite(usd) && usd > 0) costUsd = usd;
      continue;
    }
    if (line2.startsWith(MODEL_MARKER)) {
      model = line2.slice(MODEL_MARKER.length).trim() || void 0;
      continue;
    }
    if (line2.startsWith(USAGE_MARKER)) {
      try {
        usage = asUsage(JSON.parse(line2.slice(USAGE_MARKER.length).trim()));
      } catch {
      }
      continue;
    }
    kept.push(line2);
  }
  return { ...splitBody(kept.join("\n")), durationMs, costUsd, model, usage };
}
function stripTrailingResult(tail2, result) {
  const r = result.trim();
  const t = tail2.replace(/\s+$/, "");
  if (!r || !t.endsWith(r)) return tail2;
  return t.slice(0, t.length - r.length).replace(/\s+$/, "");
}
function splitBody(logText) {
  const at = logText.lastIndexOf(RESULT_MARKER);
  if (at !== -1) {
    const tail3 = logText.slice(0, at).replace(/\n+$/, "");
    const result2 = logText.slice(at + RESULT_MARKER.length).replace(/^\n+/, "").replace(/\n+$/, "");
    return { tail: result2 ? stripTrailingResult(tail3, result2) : tail3, result: result2 || void 0 };
  }
  const lines = logText.split("\n");
  let lastTool = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].startsWith("\u23FA ")) lastTool = i;
  if (lastTool === -1) return { tail: logText };
  const tail2 = lines.slice(0, lastTool + 1).join("\n").replace(/\n+$/, "");
  const closing = lines.slice(lastTool + 1).join("\n").trim();
  if (!closing) return { tail: logText.replace(/\n+$/, "") };
  const paras = closing.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const half = paras.length / 2;
  let doubled = Number.isInteger(half) && half > 0;
  for (let i = 0; i < half && doubled; i++) if (paras[i] !== paras[i + half]) doubled = false;
  const result = (doubled ? paras.slice(0, half) : paras).join("\n\n");
  return { tail: tail2, result: result || void 0 };
}
var RESULT_MARKER, DURATION_MARKER, COST_MARKER, MODEL_MARKER, USAGE_MARKER, KEEP_LOGS, TAIL_BYTES, durationLine, costLine, modelLine, usageLine;
var init_log = __esm({
  "src/lib/agent/log.ts"() {
    "use strict";
    RESULT_MARKER = "<<<kanban:result>>>";
    DURATION_MARKER = "<<<kanban:duration>>>";
    COST_MARKER = "<<<kanban:cost>>>";
    MODEL_MARKER = "<<<kanban:model>>>";
    USAGE_MARKER = "<<<kanban:usage>>>";
    KEEP_LOGS = 30;
    TAIL_BYTES = 16 * 1024;
    durationLine = (ms) => `
${DURATION_MARKER} ${Math.max(0, ms)}
`;
    costLine = (costUsd) => `${COST_MARKER} ${costUsd}
`;
    modelLine = (model) => `${MODEL_MARKER} ${model}
`;
    usageLine = (usage) => `${USAGE_MARKER} ${JSON.stringify(usage)}
`;
  }
});

// src/lib/agent/codex-stream.ts
function text(value) {
  return typeof value === "string" ? value : "";
}
function hint(raw) {
  const line2 = raw.split("\n")[0].trim();
  if (!line2) return "";
  return `(${line2.length > 96 ? line2.slice(0, 93) + "\u2026" : line2})`;
}
function renderStarted(item) {
  switch (item.type) {
    case "command_execution":
      return `\u23FA Command${hint(text(item.command))}
`;
    case "mcp_tool_call":
      return `\u23FA ${text(item.server)}.${text(item.tool)}
`;
    case "web_search":
      return `\u23FA WebSearch${hint(text(item.query))}
`;
    default:
      return "";
  }
}
function renderCompleted(item) {
  switch (item.type) {
    case "agent_message": {
      const said2 = text(item.text).trim();
      return said2 ? `${said2}

` : "";
    }
    case "file_change": {
      const changes = Array.isArray(item.changes) ? item.changes : [];
      return changes.map((raw) => {
        const change = raw;
        const path24 = text(change.path);
        return path24 ? `\u23FA ${text(change.kind) || "change"}(${path24})
` : "";
      }).join("");
    }
    case "error":
      return `[error] ${text(item.message)}
`;
    default:
      return "";
  }
}
function parseUsage(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const u = raw;
  const n = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
  const usage = {
    input: n(u.input_tokens),
    cacheCreation: n(u.cache_write_input_tokens),
    cacheRead: n(u.cached_input_tokens),
    output: n(u.output_tokens)
  };
  const total = usage.input + usage.cacheCreation + usage.cacheRead + usage.output;
  return total > 0 ? usage : void 0;
}
function createCodexStreamRenderer() {
  let buf = "";
  let final;
  let usage;
  let threadId;
  const renderLine = (line2) => {
    if (!line2.trim()) return "";
    let ev;
    try {
      const parsed = JSON.parse(line2);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return line2 + "\n";
      ev = parsed;
    } catch {
      return line2 + "\n";
    }
    switch (ev.type) {
      case "thread.started":
        if (!threadId) threadId = text(ev.thread_id).trim() || void 0;
        return "";
      case "item.started":
        return renderStarted(ev.item ?? {});
      case "item.completed": {
        const item = ev.item ?? {};
        if (item.type === "agent_message") {
          const said2 = text(item.text).trim();
          if (said2) final = said2;
        }
        return renderCompleted(item);
      }
      case "turn.completed":
        usage = parseUsage(ev.usage) ?? usage;
        return "";
      case "turn.failed": {
        const err = ev.error ?? {};
        return `[error] ${text(err.message)}
`;
      }
      case "error":
        return `[error] ${text(ev.message)}
`;
      default:
        return "";
    }
  };
  return {
    push(chunk) {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      return lines.map(renderLine).join("");
    },
    flush() {
      const rest = buf;
      buf = "";
      return rest ? renderLine(rest) : "";
    },
    result: () => final,
    usage: () => usage,
    // No costUsd and no model on purpose — see the note at the top.
    resumeId: () => threadId
  };
}
var init_codex_stream = __esm({
  "src/lib/agent/codex-stream.ts"() {
    "use strict";
  }
});

// src/lib/agent/cursor-stream.ts
function text2(value) {
  return typeof value === "string" ? value : "";
}
function hint2(raw) {
  const line2 = raw.split("\n")[0].trim();
  if (!line2) return "";
  return `(${line2.length > 96 ? line2.slice(0, 93) + "\u2026" : line2})`;
}
function callOf(ev) {
  const call = ev.tool_call;
  if (!call || typeof call !== "object") return null;
  const [key] = Object.keys(call);
  if (!key) return null;
  const body = call[key];
  const args = body && typeof body === "object" ? body.args : void 0;
  return { name: key.replace(/ToolCall$/, ""), args: args && typeof args === "object" ? args : {} };
}
function argHint(args) {
  const raw = [args.command, args.path, args.file_path, args.pattern, args.query, args.url, args.prompt].find(
    (v) => typeof v === "string" && v
  );
  return raw ? hint2(raw) : "";
}
function saidIn(ev) {
  const msg = ev.message;
  const blocks = Array.isArray(msg?.content) ? msg.content : [];
  return blocks.map((raw) => {
    const b = raw;
    return b?.type === "text" ? text2(b.text) : "";
  }).join("");
}
function createCursorStreamRenderer() {
  let buf = "";
  let final;
  let model;
  let sessionId;
  let said2 = "";
  const renderLine = (line2) => {
    if (!line2.trim()) return "";
    let ev;
    try {
      const parsed = JSON.parse(line2);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return line2 + "\n";
      ev = parsed;
    } catch {
      return line2 + "\n";
    }
    if (!sessionId) sessionId = text2(ev.session_id).trim() || void 0;
    switch (ev.type) {
      case "system":
        if (ev.subtype === "init" && !model) model = text2(ev.model).trim() || void 0;
        return "";
      case "assistant": {
        const whole = saidIn(ev).trim();
        if (!whole || whole === said2) return "";
        said2 = whole;
        return `${whole}

`;
      }
      case "tool_call": {
        if (ev.subtype !== "started") return "";
        const call = callOf(ev);
        if (!call) return "";
        said2 = "";
        return `\u23FA ${call.name}${argHint(call.args)}
`;
      }
      case "result": {
        const result = text2(ev.result).trim();
        if (result) final = result;
        if (ev.is_error === true) return `[error] ${result || "the run failed"}
`;
        return "";
      }
      default:
        return "";
    }
  };
  return {
    push(chunk) {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      return lines.map(renderLine).join("");
    },
    flush() {
      const rest = buf;
      buf = "";
      return rest ? renderLine(rest) : "";
    },
    result: () => final,
    model: () => model,
    // No costUsd and no usage on purpose — see the note at the top.
    resumeId: () => sessionId
  };
}
var init_cursor_stream = __esm({
  "src/lib/agent/cursor-stream.ts"() {
    "use strict";
  }
});

// src/lib/agent/opencode-stream.ts
function text3(value) {
  return typeof value === "string" ? value : "";
}
function block(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function num(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function hint3(raw) {
  const line2 = raw.split("\n")[0].trim();
  if (!line2) return "";
  return `(${line2.length > 96 ? line2.slice(0, 93) + "\u2026" : line2})`;
}
function argHint2(input) {
  const raw = [input.command, input.filePath, input.file_path, input.path, input.pattern, input.query, input.url].find(
    (v) => typeof v === "string" && v
  );
  return raw ? hint3(raw) : "";
}
function createOpencodeStreamRenderer() {
  let buf = "";
  let final;
  let sessionId;
  let cost = 0;
  const total = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 };
  const renderLine = (line2) => {
    if (!line2.trim()) return "";
    let ev;
    try {
      const parsed = JSON.parse(line2);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return line2 + "\n";
      ev = parsed;
    } catch {
      return line2 + "\n";
    }
    if (!sessionId) sessionId = text3(ev.sessionID).trim() || void 0;
    const part = block(ev.part);
    switch (ev.type) {
      case "text": {
        const said2 = text3(part.text).trim();
        if (!said2) return "";
        final = said2;
        return `${said2}

`;
      }
      case "tool_use": {
        const state = block(part.state);
        const name = text3(part.tool) || "tool";
        const failed = state.status === "error";
        const call = `\u23FA ${name}${argHint2(block(state.input))}
`;
        return failed ? `${call}[error] ${text3(state.error)}
` : call;
      }
      case "step_finish":
        cost += typeof part.cost === "number" && Number.isFinite(part.cost) && part.cost > 0 ? part.cost : 0;
        {
          const tokens = block(part.tokens);
          const cache = block(tokens.cache);
          total.input += num(tokens.input);
          total.output += num(tokens.output);
          total.cacheRead += num(cache.read);
          total.cacheCreation += num(cache.write);
        }
        return "";
      case "error": {
        const err = block(ev.error);
        const data = block(err.data);
        const said2 = text3(data.message) || text3(err.name) || JSON.stringify(ev.error);
        return `[error] ${said2}
`;
      }
      default:
        return "";
    }
  };
  return {
    push(chunk) {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      return lines.map(renderLine).join("");
    },
    flush() {
      const rest = buf;
      buf = "";
      return rest ? renderLine(rest) : "";
    },
    result: () => final,
    // A free model reports a cost of 0, which is a real answer and not one worth
    // printing — the UI shows a price only when the run was charged for one.
    costUsd: () => cost > 0 ? cost : void 0,
    usage: () => {
      const sum = total.input + total.cacheCreation + total.cacheRead + total.output;
      return sum > 0 ? { ...total } : void 0;
    },
    // No model on purpose — see the note at the top.
    resumeId: () => sessionId
  };
}
var init_opencode_stream = __esm({
  "src/lib/agent/opencode-stream.ts"() {
    "use strict";
  }
});

// src/lib/agent/stream.ts
function toolHint(input) {
  if (!input || typeof input !== "object") return "";
  const o = input;
  const raw = [o.command, o.file_path, o.path, o.pattern, o.description, o.prompt, o.query, o.url].find(
    (v) => typeof v === "string" && v
  );
  if (!raw) return "";
  const line2 = raw.split("\n")[0];
  return `(${line2.length > 96 ? line2.slice(0, 93) + "\u2026" : line2})`;
}
function eventModel(ev) {
  if (ev.type === "system" && ev.subtype === "init" && typeof ev.model === "string") {
    return ev.model.trim() || void 0;
  }
  if (ev.type === "assistant") {
    const msg = ev.message;
    if (typeof msg?.model === "string") return msg.model.trim() || void 0;
  }
  return void 0;
}
function createStreamRenderer() {
  let buf = "";
  let final;
  let cost;
  let model;
  let usage;
  const renderLine = (line2) => {
    if (!line2.trim()) return "";
    let ev;
    try {
      const parsed = JSON.parse(line2);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return line2 + "\n";
      ev = parsed;
    } catch {
      return line2 + "\n";
    }
    if (model === void 0) model = eventModel(ev);
    switch (ev.type) {
      case "assistant": {
        const msg = ev.message;
        const blocks = Array.isArray(msg?.content) ? msg.content : [];
        const out = [];
        for (const raw of blocks) {
          const b = raw;
          if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
            out.push(b.text.trim() + "\n\n");
          } else if (b?.type === "tool_use" && typeof b.name === "string") {
            out.push(`\u23FA ${b.name}${toolHint(b.input)}
`);
          }
        }
        return out.join("");
      }
      case "result":
        if (typeof ev.result === "string") final = ev.result;
        if (typeof ev.total_cost_usd === "number" && Number.isFinite(ev.total_cost_usd) && ev.total_cost_usd > 0) {
          cost = ev.total_cost_usd;
        }
        {
          const u = ev.usage;
          const n = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
          if (u && typeof u === "object") {
            const parsed = {
              input: n(u.input_tokens),
              cacheCreation: n(u.cache_creation_input_tokens),
              cacheRead: n(u.cache_read_input_tokens),
              output: n(u.output_tokens)
            };
            if (parsed.input + parsed.cacheCreation + parsed.cacheRead + parsed.output > 0) {
              usage = parsed;
            }
          }
        }
        return "";
      default:
        return "";
    }
  };
  return {
    push(chunk) {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      return lines.map(renderLine).join("");
    },
    flush() {
      const rest = buf;
      buf = "";
      return rest ? renderLine(rest) : "";
    },
    result: () => final,
    costUsd: () => cost,
    usage: () => usage,
    model: () => model
  };
}
var init_stream = __esm({
  "src/lib/agent/stream.ts"() {
    "use strict";
  }
});

// src/lib/agent/harnesses.ts
function namesFlag(argv, flags) {
  return argv.some((tok) => flags.some((flag) => tok === flag || tok.startsWith(`${flag}=`)));
}
function claudeStreamArgs(argv) {
  return argv.includes("--output-format") ? [] : ["--output-format", "stream-json", "--verbose"];
}
function codexExtraArgs(argv) {
  const extra = [];
  if (!namesFlag(argv, ["--json", "--experimental-json"])) extra.push("--json");
  const sandboxFlags = ["--sandbox", "-s", "--full-auto", "--dangerously-bypass-approvals-and-sandbox"];
  if (!namesFlag(argv, sandboxFlags)) extra.push("--sandbox", "workspace-write");
  return extra;
}
function cursorExtraArgs(argv) {
  const extra = [];
  if (!namesFlag(argv, ["-p", "--print"])) extra.push("-p");
  if (!namesFlag(argv, ["--output-format"])) extra.push("--output-format", "stream-json");
  if (!namesFlag(argv, ["-f", "--force", "--yolo", "--auto-review"])) extra.push("--force");
  return extra;
}
function opencodeExtraArgs(argv) {
  return namesFlag(argv, ["--format"]) ? [] : ["--format", "json"];
}
function harnessByName(name) {
  return HARNESSES.find((h) => h.name === name);
}
var SKILL_SENTENCE, CLAUDE_CODE, CODEX, CURSOR, OPENCODE, HARNESSES, DEFAULT_HARNESS, RESERVED_SETTING_KEYS;
var init_harnesses = __esm({
  "src/lib/agent/harnesses.ts"() {
    "use strict";
    init_codex_stream();
    init_cursor_stream();
    init_opencode_stream();
    init_stream();
    SKILL_SENTENCE = "Use this repo's ai4kanban board skill (`.agents/skills/kanban/SKILL.md`)";
    CLAUDE_CODE = {
      name: "claude-code",
      label: "Claude Code",
      icon: "/agents/claude.svg",
      command: "claude -p",
      // Stream the events (see claudeStreamArgs), and pin the session id: `--session-id <id>`
      // makes Claude Code adopt the id we generated up front, so the record's key IS Claude
      // Code's own session id — the exact id a resume hands back to the CLI.
      extraArgs(argv, sessionId) {
        const extra = claudeStreamArgs(argv);
        if (sessionId && !argv.includes("--session-id")) extra.push("--session-id", sessionId);
        return extra;
      },
      resumes: true,
      // `claude -p --resume <id> "<prompt>"` sends one more turn into an existing
      // conversation. No `--session-id` here — Claude Code refuses both at once, and without
      // `--fork-session` the resumed turn keeps running under the very id we resumed, so the
      // new run's resume id is that same id.
      resumeArgs(argv, resumeId) {
        const extra = claudeStreamArgs(argv);
        if (!argv.includes("--resume") && !argv.includes("-r")) extra.push("--resume", resumeId);
        return extra;
      },
      // What Claude Code takes: who pays for the run, where that run goes, a model id, and how
      // hard that model thinks. The provider comes first because it decides the rest — which
      // of the boxes below apply at all, and the whole environment a run starts under.
      settings: [
        // Who pays for a run, and where it goes. Three entries, because these are the three
        // ways a person reaches Claude Code today: the subscription they already log into,
        // Anthropic's own API, and any gateway that answers in the Anthropic format. Bedrock,
        // Vertex and Foundry are more entries on this same list — add them when someone asks.
        //
        // "OpenAI" is deliberately not here. Claude Code speaks the Anthropic API only; an
        // OpenAI model reaches it through a gateway that answers in that format, which IS the
        // endpoint entry. A connector that speaks the OpenAI format brings its own list.
        {
          key: "provider",
          label: "Provider",
          kind: "provider",
          defaultProvider: "subscription",
          providers: [
            {
              id: "subscription",
              label: "Claude subscription",
              blurb: "Runs on the login your claude CLI already has. Nothing else to fill in.",
              needs: []
            },
            {
              id: "anthropic-api",
              label: "Anthropic API",
              blurb: "Pay per token, with an Anthropic API key.",
              needs: ["apiKey"],
              // A board that saved a key before this list existed was running every run on
              // that key. It reads as this provider until the user picks otherwise —
              // defaulting it to the subscription would drop the key from every run, which is
              // the opposite of "change nothing, see no change".
              preferWhenSet: ["apiKey"]
            },
            {
              id: "endpoint",
              label: "Anthropic-compatible endpoint",
              blurb: "A gateway that answers in the Anthropic format \u2014 OpenRouter, LiteLLM, a company proxy.",
              needs: ["baseUrl", "apiKey"],
              // The base URL is what makes this pick mean anything, so it is the one box that
              // has to be filled. The key isn't: a proxy on your own laptop often takes none.
              requires: ["baseUrl"],
              // A gateway key goes out as ANTHROPIC_AUTH_TOKEN, never as ANTHROPIC_API_KEY.
              // Claude Code treats a set ANTHROPIC_API_KEY as its own auth source and turns
              // the user's claude.ai connectors off when it sees one — so sending the key both
              // ways to suit whichever header a gateway prefers costs the user their
              // connectors on every run. This is the variable OpenRouter, LiteLLM and the rest
              // document, and the gateway reads it as `Authorization: Bearer`.
              envAs: { apiKey: "ANTHROPIC_AUTH_TOKEN" },
              // And the other one has to be there and EMPTY, not merely unset. That is what
              // Claude Code's own gateway instructions say, and an empty value says "this run
              // has no API key of its own" in a way a missing variable doesn't.
              env: { ANTHROPIC_API_KEY: "" }
            }
          ]
        },
        // Where an endpoint run goes. Not a secret — a gateway address is not a credential —
        // so it saves beside the model in ui.config.json, and it reaches the run as the
        // variable Claude Code reads for it rather than as a flag, because its CLI has none.
        {
          key: "baseUrl",
          label: "Endpoint base URL",
          kind: "text",
          env: "ANTHROPIC_BASE_URL",
          placeholder: "https://my-gateway.example.com",
          help: "The address the gateway answers on."
        },
        // The key the picked provider uses. It belongs to the box it is typed in, not to
        // whoever was picked at the time, so switching providers — or agents — never asks for
        // it again. Only a provider that needs it sees it: the subscription never does, so the
        // key never reaches that run. The variable it goes out under follows the pick.
        {
          key: "apiKey",
          label: "API key",
          kind: "secret",
          env: "ANTHROPIC_API_KEY",
          placeholder: "sk-ant-\u2026",
          help: "Saved to docs/kanban/.env (kept out of git), never shown back."
        },
        // The model is free text rather than a list — model ids change between agent releases,
        // and a stale list would block a model the agent already runs. `--model` is the one
        // flag its CLI takes for it; an override that already names that flag wins.
        {
          key: "model",
          label: "Model",
          kind: "text",
          placeholder: "claude-opus-5",
          flags: ["--model"],
          help: "Empty runs the agent's default. A wrong id fails the run; the log says why.",
          overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model, and that wins.`
        },
        // How hard the model thinks. A list, not a box: unlike a model id, the levels are the
        // agent's own vocabulary — these five are exactly what Claude Code's `--effort` takes
        // — and they don't change between releases, so a list can't go stale the way a list of
        // model ids would. Another agent names its own levels, or has none.
        //
        // The first choice is empty, which drops the flag and lets the agent think however it
        // thinks by default. The board never invents a level, and never judges one either:
        // what a level means, and whether the picked model can do it, is the agent's. A level
        // Claude Code doesn't know makes it warn on stderr and run at its own default — that
        // warning lands in the run's log, where the user reads it.
        {
          key: "reasoning",
          label: "Reasoning effort",
          kind: "select",
          choices: [
            { value: "", label: "Agent's default" },
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "xhigh", label: "Extra high (xhigh)" },
            { value: "max", label: "Max" }
          ],
          flags: ["--effort"],
          help: "Lower is quicker and cheaper, higher is slower and more careful.",
          overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names an effort level, and that wins.`
        }
      ],
      // Everything that could send Claude Code somewhere the pick didn't ask for. Each of
      // these is dropped from every run, and then the picked provider sets what it needs — so
      // a base URL exported months ago can't send a "Claude subscription" run through a
      // gateway while the settings say otherwise.
      //
      // It goes past the three providers on the list to the ones the board doesn't offer yet:
      // a leftover Bedrock, Vertex or Foundry switch moves a run just as surely as a base URL.
      // What is NOT here is the cloud credentials themselves — AWS_PROFILE,
      // GOOGLE_APPLICATION_CREDENTIALS and the like. They move nothing once the switch above
      // them is gone, and the agent may well need them for the work it is doing in the repo.
      providerEnv: [
        "ANTHROPIC_AUTH_TOKEN",
        // Custom headers can carry an authorization of their own, so they are a way to move a
        // run as much as a base URL is.
        "ANTHROPIC_CUSTOM_HEADERS",
        "CLAUDE_CODE_USE_BEDROCK",
        "ANTHROPIC_BEDROCK_BASE_URL",
        "CLAUDE_CODE_SKIP_BEDROCK_AUTH",
        "AWS_BEARER_TOKEN_BEDROCK",
        "CLAUDE_CODE_USE_VERTEX",
        "ANTHROPIC_VERTEX_BASE_URL",
        "CLAUDE_CODE_SKIP_VERTEX_AUTH",
        "CLAUDE_CODE_USE_FOUNDRY",
        "ANTHROPIC_FOUNDRY_BASE_URL",
        "ANTHROPIC_FOUNDRY_API_KEY"
      ],
      // The one variable that makes a rate limit fail instead of wait.
      //
      // By default Claude Code retries a 429 (session/weekly limit, overload) with exponential
      // backoff — up to 10 attempts, each request allowed 10 minutes. In a terminal that's
      // right; here it's wrong. A rate-limited run would sit holding the card for the better
      // part of an hour before it ever reported anything. `CLAUDE_CODE_MAX_RETRIES=0` turns
      // the first 429 into an immediate non-zero exit, so the board learns at once and the
      // card is free again.
      //
      // It is NOT a spend control. Whether hitting your plan's limit spills over into paid
      // extra usage is an account setting on claude.ai (the CLI has no flag for it).
      env: () => ({ ...process.env, CLAUDE_CODE_MAX_RETRIES: "0" }),
      renderer: createStreamRenderer,
      // `--session-id` above makes Claude Code run under the id we generated, so our key IS
      // its resume id — no waiting for the stream to report one.
      adoptsSessionId: true,
      // Claude Code loads a skill from its slash name.
      skillCall: "/kanban",
      install: "npm install -g @anthropic-ai/claude-code"
    };
    CODEX = {
      name: "codex",
      label: "Codex",
      icon: "/agents/codex.svg",
      command: "codex exec --json --sandbox workspace-write",
      // Nothing to pin: Codex mints its own thread id and takes none from us, so the generated
      // session id is ignored here and the id arrives on the run's first event instead.
      extraArgs(argv) {
        return codexExtraArgs(argv);
      },
      resumes: true,
      // `codex exec … resume <thread-id> "<prompt>"` sends one more turn into an existing
      // thread. `resume` is a SUBCOMMAND, not a flag: everything else has to come before it
      // and the prompt comes after, which is why a run's flags are assembled command →
      // settings → harness (see startRun).
      resumeArgs(argv, resumeId) {
        return [...codexExtraArgs(argv), "resume", resumeId];
      },
      // What Codex takes. A model, free text for the same reason Claude Code's is — ids change
      // between releases and a stale list would block one the agent already runs — and one
      // optional key. No reasoning level: Codex names its own.
      settings: [
        {
          key: "model",
          label: "Model",
          kind: "text",
          placeholder: "gpt-5.1-codex",
          flags: ["--model", "-m"],
          help: "Empty runs the agent's default. A wrong id fails the run; the log says why.",
          overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model, and that wins.`
        },
        {
          key: "apiKey",
          label: "OpenAI API key",
          kind: "secret",
          env: "OPENAI_API_KEY",
          placeholder: "sk-\u2026",
          help: "Optional \u2014 empty uses your codex CLI's own login. Saved to docs/kanban/.env, never shown back."
        }
      ],
      // Nothing extra. Claude Code gets CLAUDE_CODE_MAX_RETRIES=0 so a rate limit fails at
      // once and frees the card; Codex has no equivalent switch, so a rate-limited Codex run
      // waits it out and holds the card while it does. Better that than a made-up variable.
      env: () => ({ ...process.env }),
      renderer: createCodexStreamRenderer,
      // Codex names its own thread, so our session id is only ever the board's key for the
      // run. The real resume id lands on the first event and the record saves it there.
      adoptsSessionId: false,
      // Codex ignores a slash name — it reads as plain chat text — and triggers a skill from a
      // `$` name. The install already writes the skill to `.agents/skills/kanban/`, which is
      // where Codex looks.
      skillCall: "$kanban",
      install: "npm install -g @openai/codex"
    };
    CURSOR = {
      name: "cursor",
      label: "Cursor",
      icon: "/agents/cursor.svg",
      command: "cursor-agent -p --output-format stream-json --force",
      // Nothing to pin: Cursor mints its own session id and takes none from us, so the
      // generated session id is ignored here and the id arrives on the run's first event.
      extraArgs(argv) {
        return cursorExtraArgs(argv);
      },
      resumes: true,
      // `cursor-agent --resume <id> "<prompt>"` sends one more turn into an existing chat.
      // `--resume` is a flag whose value is optional — left bare it would open a picker — so
      // the id is always passed with it.
      resumeArgs(argv, resumeId) {
        return [...cursorExtraArgs(argv), "--resume", resumeId];
      },
      // What Cursor takes: a model, free text for the same reason the others' are, and one
      // optional key. Cursor carries its reasoning level inside the model id rather than in a
      // flag of its own (`claude-opus-4-8[effort=high]`), so there is no separate box for it.
      settings: [
        {
          key: "model",
          label: "Model",
          kind: "text",
          placeholder: "sonnet-4-thinking",
          flags: ["--model"],
          help: "Empty runs the agent's default. A wrong id fails the run; the log says why.",
          overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model, and that wins.`
        },
        {
          key: "apiKey",
          label: "Cursor API key",
          kind: "secret",
          env: "CURSOR_API_KEY",
          placeholder: "key_\u2026",
          help: "Optional \u2014 empty uses your cursor-agent CLI's own login. Saved to docs/kanban/.env, never shown back."
        }
      ],
      env: () => ({ ...process.env }),
      renderer: createCursorStreamRenderer,
      // Cursor names its own session, so our session id is only ever the board's key for the
      // run. The real resume id rides on every event and the record saves it from the first.
      adoptsSessionId: false,
      // Cursor's short skill names are documented for its chat box, not for a headless run, so
      // the prompt asks for the skill in a sentence.
      skillCall: SKILL_SENTENCE,
      // The one agent of the four that doesn't come from npm.
      install: "curl https://cursor.com/install -fsS | bash"
    };
    OPENCODE = {
      name: "opencode",
      label: "OpenCode",
      icon: "/agents/opencode.svg",
      command: "opencode run --format json",
      extraArgs(argv) {
        return opencodeExtraArgs(argv);
      },
      resumes: true,
      // `opencode run --session <id> "<prompt>"` sends one more turn into an existing session.
      resumeArgs(argv, resumeId) {
        return [...opencodeExtraArgs(argv), "--session", resumeId];
      },
      // What OpenCode takes. A model — `provider/model`, because OpenCode reaches every
      // provider and the name alone wouldn't say which — and the level the model thinks at.
      //
      // No key box. OpenCode talks to any provider and each has its own key, so one box would
      // be the wrong key for most people. Its runs use whatever `opencode auth login` saved.
      settings: [
        {
          key: "model",
          label: "Model",
          kind: "text",
          placeholder: "anthropic/claude-opus-5",
          flags: ["--model", "-m"],
          help: "Written as provider/model. Empty runs the agent's default. A wrong id fails the run; the log says why.",
          overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a model, and that wins.`
        },
        // A box rather than a list, unlike Claude Code's. Its levels are Claude Code's own
        // vocabulary and can't go stale; these are the provider's, and they differ per
        // provider — so a list written here would be wrong for somebody's model the day it
        // shipped.
        {
          key: "variant",
          label: "Reasoning effort",
          kind: "text",
          placeholder: "high",
          flags: ["--variant"],
          help: "Your provider's own level, e.g. minimal, high, max. Empty lets the model think however it thinks.",
          overriddenHelp: `Not in effect: this agent's "command" in your ui.config.json already names a variant, and that wins.`
        }
      ],
      env: () => ({ ...process.env }),
      renderer: createOpencodeStreamRenderer,
      // OpenCode names its own session; the id rides on every event and the record saves it
      // from the first one.
      adoptsSessionId: false,
      // OpenCode has no slash or `$` skill syntax at all — its model picks a skill itself — so
      // the prompt asks for the skill in a sentence.
      skillCall: SKILL_SENTENCE,
      install: "curl -fsSL https://opencode.ai/install | bash"
    };
    HARNESSES = [CLAUDE_CODE, CODEX, CURSOR, OPENCODE];
    DEFAULT_HARNESS = CLAUDE_CODE;
    RESERVED_SETTING_KEYS = ["command"];
    for (const harness of HARNESSES) {
      const seen = /* @__PURE__ */ new Set();
      const seenEnv = /* @__PURE__ */ new Set();
      for (const setting of harness.settings) {
        const { key } = setting;
        if (RESERVED_SETTING_KEYS.includes(key)) {
          throw new Error(`harness "${harness.name}": a setting can't be called "${key}" \u2014 that key is the harness block's own`);
        }
        if (seen.has(key)) throw new Error(`harness "${harness.name}": two settings share the key "${key}"`);
        seen.add(key);
        if (setting.kind !== "secret") continue;
        if (!setting.env) throw new Error(`harness "${harness.name}": the secret "${key}" names no environment variable`);
        if (setting.flags?.length) throw new Error(`harness "${harness.name}": the secret "${key}" can't take a flag \u2014 a secret reaches the run as ${setting.env}`);
        if (seenEnv.has(setting.env)) throw new Error(`harness "${harness.name}": two secrets share the variable "${setting.env}"`);
        seenEnv.add(setting.env);
      }
      const providers = harness.settings.filter((s) => s.kind === "provider");
      if (providers.length > 1) {
        throw new Error(`harness "${harness.name}": a connector declares one provider list, not ${providers.length}`);
      }
      const list = providers[0];
      if (!list) continue;
      if (!list.providers?.length) throw new Error(`harness "${harness.name}": the provider setting "${list.key}" offers no providers`);
      const ids = /* @__PURE__ */ new Set();
      for (const provider of list.providers) {
        if (ids.has(provider.id)) throw new Error(`harness "${harness.name}": two providers share the id "${provider.id}"`);
        ids.add(provider.id);
        for (const need of [...provider.needs, ...provider.preferWhenSet ?? []]) {
          if (!seen.has(need)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" needs a setting "${need}" it never declared`);
        }
        for (const required of provider.requires ?? []) {
          if (!provider.needs.includes(required)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" requires "${required}" without needing it`);
        }
        for (const key of Object.keys(provider.envAs ?? {})) {
          if (!provider.needs.includes(key)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" renames the variable of "${key}" without needing it`);
        }
      }
      if (list.defaultProvider && !ids.has(list.defaultProvider)) {
        throw new Error(`harness "${harness.name}": the default provider "${list.defaultProvider}" isn't on the list`);
      }
    }
  }
});

// src/lib/agent/providers.ts
function providerSetting(settings) {
  return settings.find((s) => s.kind === "provider");
}
function providerOwned(settings, key) {
  return !!providerSetting(settings)?.providers?.some((p) => p.needs.includes(key));
}
function defaultProviderId(setting, filled) {
  const providers = setting.providers ?? [];
  const preferred = providers.find((p) => p.preferWhenSet?.length && p.preferWhenSet.every(filled));
  return preferred?.id ?? setting.defaultProvider ?? providers[0]?.id ?? "";
}
function pickedProvider(setting, saved, filled) {
  const providers = setting.providers ?? [];
  const id = providers.some((p) => p.id === saved) ? saved : defaultProviderId(setting, filled);
  return providers.find((p) => p.id === id);
}
function missingRequired(provider, filled) {
  return (provider?.requires ?? []).filter((key) => !filled(key));
}
function shownForProvider(settings, key, provider) {
  return !providerOwned(settings, key) || !!provider?.needs.includes(key);
}
var init_providers = __esm({
  "src/lib/agent/providers.ts"() {
    "use strict";
  }
});

// src/lib/agent/settings.ts
import fs13 from "node:fs";
import path11 from "node:path";
function configBlock(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}
function readConfigRaw() {
  if (!fs13.existsSync(UI_CONFIG)) return {};
  return JSON.parse(fs13.readFileSync(UI_CONFIG, "utf8"));
}
function pickedHarnessName(configured) {
  const asked = typeof configured === "string" ? configured.trim() : "";
  return (harnessByName(asked) ?? DEFAULT_HARNESS).name;
}
function setHarness(name) {
  return writeConfig((cfg) => {
    cfg.harness = name;
  });
}
function setHarnessSetting(key, value) {
  return writeConfig((cfg) => {
    const name = pickedHarnessName(cfg.harness);
    const blocks = { ...configBlock(cfg.harnessSettings) };
    const block2 = { ...configBlock(blocks[name]) };
    const next = value.trim();
    if (next) block2[key] = next;
    else delete block2[key];
    if (Object.keys(block2).length) blocks[name] = block2;
    else delete blocks[name];
    if (Object.keys(blocks).length) cfg.harnessSettings = blocks;
    else delete cfg.harnessSettings;
  });
}
function writeConfig(change) {
  let cfg;
  try {
    cfg = readConfigRaw();
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't save: ${UI_CONFIG} won't parse (${why}). Fix the file, then try again.` };
  }
  change(cfg);
  try {
    fs13.mkdirSync(path11.dirname(UI_CONFIG), { recursive: true });
    fs13.writeFileSync(UI_CONFIG, JSON.stringify(cfg, null, 2) + "\n");
    return { ok: true };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't write ${UI_CONFIG}: ${why}` };
  }
}
function parseLine(line2) {
  const text4 = line2.trim();
  if (!text4 || text4.startsWith("#")) return null;
  const eq = text4.indexOf("=");
  if (eq <= 0) return null;
  const name = text4.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;
  return { name, value: unquote2(text4.slice(eq + 1).trim()) };
}
function unquote2(value) {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  return value;
}
function readEnvFile() {
  let text4;
  try {
    text4 = fs13.readFileSync(ENV_FILE, "utf8");
  } catch {
    return {};
  }
  const values = {};
  for (const line2 of text4.split("\n")) {
    const pair = parseLine(line2);
    if (pair && pair.value) values[pair.name] = pair.value;
  }
  return values;
}
function ensureIgnored() {
  try {
    if (!fs13.existsSync(KANBAN_GITIGNORE)) {
      fs13.mkdirSync(path11.dirname(KANBAN_GITIGNORE), { recursive: true });
      fs13.writeFileSync(KANBAN_GITIGNORE, IGNORE_BLOCK);
      return { ok: true };
    }
    const text4 = fs13.readFileSync(KANBAN_GITIGNORE, "utf8");
    if (text4.split("\n").some((line2) => line2.trim() === ".env")) return { ok: true };
    const separator = !text4 || text4.endsWith("\n") ? "" : "\n";
    fs13.writeFileSync(KANBAN_GITIGNORE, `${text4}${separator}${IGNORE_BLOCK}`);
    return { ok: true };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't write ${KANBAN_GITIGNORE} to keep the key out of git: ${why}` };
  }
}
function setSecret(name, value) {
  const ignored = ensureIgnored();
  if (!ignored.ok) return ignored;
  let lines;
  try {
    lines = fs13.existsSync(ENV_FILE) ? fs13.readFileSync(ENV_FILE, "utf8").split("\n") : [];
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't read ${ENV_FILE}: ${why}` };
  }
  const next = value.trim();
  const kept = [];
  let written = false;
  for (const line2 of lines) {
    const pair = parseLine(line2);
    if (!pair || pair.name !== name) {
      kept.push(line2);
      continue;
    }
    if (!next || written) continue;
    kept.push(`${name}=${next}`);
    written = true;
  }
  let text4 = kept.join("\n");
  if (text4 && !text4.endsWith("\n")) text4 += "\n";
  if (next && !written) text4 += `${name}=${next}
`;
  try {
    fs13.writeFileSync(ENV_FILE, text4, { mode: 384 });
    return { ok: true };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't write ${ENV_FILE}: ${why}` };
  }
}
var IGNORE_BLOCK;
var init_settings = __esm({
  "src/lib/agent/settings.ts"() {
    "use strict";
    init_paths();
    init_harnesses();
    IGNORE_BLOCK = "# The board's API keys \u2014 never commit them.\n.env\n";
  }
});

// src/lib/agent/resolve.ts
function isFilled(harness, values, secretsSet) {
  return (key) => {
    const setting = harness.settings.find((s) => s.key === key);
    return setting?.kind === "secret" ? secretsSet.includes(key) : Boolean(values[key]);
  };
}
function activeProviderOf({ harness, values, secretsSet }) {
  const setting = providerSetting(harness.settings);
  if (!setting) return void 0;
  return pickedProvider(setting, values[setting.key] ?? "", isFilled(harness, values, secretsSet));
}
function resolveHarness(pin) {
  let cfg = {};
  try {
    cfg = readConfigRaw();
  } catch {
  }
  const staleCommand = typeof cfg.command === "string" && cfg.command.trim() ? true : void 0;
  const asked = pin ?? (typeof cfg.harness === "string" ? cfg.harness.trim() : "");
  const known = harnessByName(asked);
  const harness = known ?? DEFAULT_HARNESS;
  const block2 = configBlock(configBlock(cfg.harnessSettings)[harness.name]);
  const override = typeof block2.command === "string" ? block2.command.trim() : "";
  const command = override || harness.command;
  const argv = command.split(/\s+/).filter(Boolean);
  const values = {};
  const ignored = [];
  const secretsSet = [];
  const env = harness.settings.some((s) => s.kind === "secret") ? readEnvFile() : {};
  for (const setting of harness.settings) {
    if (setting.kind === "secret") {
      if (setting.env && env[setting.env]) secretsSet.push(setting.key);
      continue;
    }
    const raw = block2[setting.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value) values[setting.key] = value;
    if (setting.flags?.length && namesFlag(argv, setting.flags)) ignored.push(setting.key);
  }
  const list = providerSetting(harness.settings);
  if (list) {
    const picked = pickedProvider(list, values[list.key] ?? "", isFilled(harness, values, secretsSet));
    if (picked) values[list.key] = picked.id;
    else delete values[list.key];
  }
  return {
    harness,
    command,
    isDefault: !known,
    values,
    secretsSet,
    ignored,
    unknownName: known ? void 0 : asked || void 0,
    staleCommand
  };
}
function activeSettings() {
  return resolveHarness().harness.settings;
}
function settingSaveError(key, value) {
  const resolved = resolveHarness();
  const { harness, values, secretsSet } = resolved;
  const list = providerSetting(harness.settings);
  if (!list) return null;
  const filled = isFilled(harness, values, secretsSet);
  const label = (k) => harness.settings.find((s) => s.key === k)?.label ?? k;
  if (key === list.key) {
    const provider = list.providers?.find((p) => p.id === value);
    if (!provider) return `"${value}" isn't one of the ${list.label.toLowerCase()} choices`;
    const missing = missingRequired(provider, filled);
    if (missing.length) {
      const names2 = missing.map((k) => `"${label(k)}"`).join(" and ");
      return `${provider.label} needs ${names2}. Fill it in and save it, then pick this provider.`;
    }
    return null;
  }
  if (value) return null;
  const picked = activeProviderOf(resolved);
  if (picked?.requires?.includes(key)) {
    return `${picked.label} needs "${label(key)}". Pick another provider first, or give this one a value.`;
  }
  return null;
}
function settingArgs(resolved) {
  const { harness, values, ignored } = resolved;
  const picked = activeProviderOf(resolved);
  return harness.settings.flatMap((setting) => {
    const value = values[setting.key];
    if (!value || !setting.flags?.length || ignored.includes(setting.key)) return [];
    if (!shownForProvider(harness.settings, setting.key, picked)) return [];
    return [setting.flags[0], value];
  });
}
function runEnv(resolved) {
  const { harness, values } = resolved;
  const picked = activeProviderOf(resolved);
  const env = { ...harness.env() };
  for (const name of ownedVars(harness)) delete env[name];
  const file = readEnvFile();
  for (const setting of harness.settings) {
    if (!setting.env) continue;
    if (!shownForProvider(harness.settings, setting.key, picked)) continue;
    const value = setting.kind === "secret" ? file[setting.env] : values[setting.key];
    if (!value) continue;
    env[picked?.envAs?.[setting.key] ?? setting.env] = value;
  }
  return { ...env, ...picked?.env ?? {} };
}
function ownedVars(harness) {
  const names2 = new Set(harness.providerEnv ?? []);
  const list = providerSetting(harness.settings);
  if (!list) return [...names2];
  for (const provider of list.providers ?? []) {
    for (const name of Object.values(provider.envAs ?? {})) names2.add(name);
    for (const name of Object.keys(provider.env ?? {})) names2.add(name);
    for (const key of provider.needs) {
      const setting = harness.settings.find((s) => s.key === key);
      if (setting?.env) names2.add(setting.env);
    }
  }
  return [...names2];
}
function planRun(sessionId) {
  const resolved = resolveHarness();
  const { harness, command } = resolved;
  const argv = command.split(/\s+/).filter(Boolean);
  return {
    harness: harness.name,
    argv: [...argv, ...settingArgs(resolved), ...harness.extraArgs(argv, sessionId)],
    resumeId: harness.adoptsSessionId ? sessionId : null,
    install: harness.install
  };
}
function planResume(harnessName, resumeId) {
  const resolved = resolveHarness();
  const { harness, command } = resolved;
  if (!harness.resumes || harness.name !== harnessName) return null;
  const argv = command.split(/\s+/).filter(Boolean);
  return {
    harness: harness.name,
    argv: [...argv, ...settingArgs(resolved), ...harness.resumeArgs(argv, resumeId)],
    // The resumed turn runs under the id it resumed, so this run can be resumed again by
    // the same id — a failure two turns deep is still recoverable.
    resumeId,
    install: harness.install
  };
}
function openPlan(plan) {
  const resolved = resolveHarness(plan.harness);
  return { ...plan, env: runEnv(resolved), renderer: resolved.harness.renderer() };
}
function resumableHarness() {
  const { harness } = resolveHarness();
  return harness.resumes ? harness.name : null;
}
function adoptsSessionId(harnessName) {
  const harness = harnessByName(harnessName);
  return !!harness && harness.resumes && harness.adoptsSessionId;
}
function skillCall() {
  return resolveHarness().harness.skillCall;
}
function setupInstruction() {
  return `${skillCall()}. Set up this board \u2014 follow docs/kanban/setup-checklist.md.`;
}
function agentInfo() {
  const { harness, command, isDefault, values, secretsSet, ignored, unknownName, staleCommand } = resolveHarness();
  return {
    name: harness.name,
    command,
    isDefault,
    values,
    // Which keys are set, and never a key. A saved one is never handed back: it buys
    // nothing, and a user who forgot theirs makes a new one.
    secretsSet,
    ignored,
    // Every agent's settings go down, not just the active one's: picking another draws its
    // own list right away, with nothing filled in, without asking again.
    options: HARNESSES.map(({ name, label, icon, command: cmd, settings }) => ({
      name,
      label,
      icon,
      command: cmd,
      settings
    })),
    unknownName,
    staleCommand
  };
}
var init_resolve = __esm({
  "src/lib/agent/resolve.ts"() {
    "use strict";
    init_harnesses();
    init_providers();
    init_settings();
  }
});

// src/lib/agent/sessions.ts
import { randomUUID } from "node:crypto";
import fs14 from "node:fs";
import path12 from "node:path";
function readRuns() {
  let data;
  try {
    data = JSON.parse(fs14.readFileSync(SESSIONS, "utf8"));
  } catch {
    return [];
  }
  const box = data;
  const raw = Array.isArray(box?.runs) ? box.runs : [...Array.isArray(box?.live) ? box.live : [], ...Array.isArray(box?.finished) ? box.finished : []];
  const runs = [];
  for (const entry of raw) {
    if (!entry || typeof entry.sessionId !== "string" || !entry.sessionId) continue;
    runs.push({
      sessionId: entry.sessionId,
      cardId: typeof entry.cardId === "number" ? entry.cardId : null,
      action: entry.action,
      status: asStatus(entry.status),
      startedAt: typeof entry.startedAt === "number" ? entry.startedAt : Date.now(),
      endedAt: typeof entry.endedAt === "number" ? entry.endedAt : void 0,
      pid: typeof entry.pid === "number" ? entry.pid : void 0,
      input: typeof entry.input === "string" ? entry.input : void 0,
      ok: typeof entry.ok === "boolean" ? entry.ok : void 0,
      code: entry.code ?? null,
      error: typeof entry.error === "string" ? entry.error : void 0,
      // A run that never reported a cost shows none, rather than a zero it didn't earn.
      costUsd: typeof entry.costUsd === "number" && entry.costUsd > 0 ? entry.costUsd : void 0,
      usage: asUsage(entry.usage),
      model: typeof entry.model === "string" && entry.model ? entry.model : void 0,
      result: typeof entry.result === "string" ? entry.result : void 0,
      // A run written down before the agent was recorded carries no name, so it gets no
      // resume: every agent resumes differently, and the one thing worse than a missing
      // offer is a command for the wrong agent.
      harness: typeof entry.harness === "string" ? entry.harness : "",
      resumeId: typeof entry.resumeId === "string" ? entry.resumeId : void 0,
      logPath: typeof entry.logPath === "string" && entry.logPath ? entry.logPath : logPathOf(entry.sessionId),
      resumedFrom: typeof entry.resumedFrom === "string" ? entry.resumedFrom : void 0,
      priorStatus: typeof entry.priorStatus === "string" ? entry.priorStatus : void 0,
      stopping: entry.stopping === true ? true : void 0
    });
  }
  return runs.sort((a, b) => a.startedAt - b.startedAt);
}
function asStatus(value) {
  return value === "running" || value === "error" || value === "interrupted" || value === "stopped" ? value : "done";
}
function writeRuns(runs) {
  const kept = prune(runs);
  fs14.mkdirSync(path12.dirname(SESSIONS), { recursive: true });
  const tmp = `${SESSIONS}.tmp`;
  fs14.writeFileSync(tmp, JSON.stringify({ runs: kept }, null, 2) + "\n");
  fs14.renameSync(tmp, SESSIONS);
}
function prune(runs) {
  const live = runs.filter((r) => r.status === "running");
  const finished = runs.filter((r) => r.status !== "running" && fs14.existsSync(r.logPath)).sort((a, b) => b.startedAt - a.startedAt).slice(0, KEEP_RUNS);
  return [...live, ...finished].sort((a, b) => a.startedAt - b.startedAt);
}
function withRuns(fn) {
  return withLock(SESSIONS_LOCK, "writing this board's run list", () => {
    const runs = readRuns();
    const before = JSON.stringify(runs);
    const out = fn(runs);
    if (JSON.stringify(runs) !== before) writeRuns(runs);
    return out;
  });
}
function reap(runs) {
  let changed = false;
  const now = Date.now();
  for (const r of runs) {
    if (r.status !== "running") continue;
    if (!r.pid) {
      if (now - r.startedAt < PENDING_MS) continue;
    } else if (pidAlive(r.pid)) {
      continue;
    }
    r.status = r.stopping ? "stopped" : "interrupted";
    r.code = null;
    r.endedAt = now;
    stampDuration(r, r.endedAt);
    restoreCardStatus(r);
    dropSpec(r.sessionId);
    changed = true;
  }
  return changed;
}
function stampDuration(run, endedAt) {
  try {
    fs14.appendFileSync(run.logPath, durationLine(endedAt - run.startedAt));
  } catch {
  }
}
function boardMove(fn) {
  try {
    withBoardLock(() => quietly(fn));
  } catch {
  }
}
function setCardStatus(cardId, status) {
  boardMove(() => cmdUpdate([String(cardId), "--status", status]));
}
function cardNow(cardId) {
  try {
    const found = locate(cardId);
    if (!found) return null;
    const { meta } = parseFrontmatter(fs14.readFileSync(found.target, "utf8"));
    if (!meta) return null;
    return { status: meta.status || "todo", questions: meta.questions.length, title: meta.title };
  } catch {
    return null;
  }
}
function claimCard(run) {
  const wanted = run.cardId !== null ? RUN_STATUS[run.action] : void 0;
  if (run.cardId === null || !wanted) return;
  run.priorStatus = cardNow(run.cardId)?.status ?? "todo";
  setCardStatus(run.cardId, wanted);
}
function restoreCardStatus(run) {
  if (run.cardId === null || !RUN_STATUS[run.action]) return;
  const card = cardNow(run.cardId);
  if (!card) return;
  setCardStatus(run.cardId, card.questions > 0 ? "todo" : run.priorStatus ?? "todo");
}
function recordRecurringRun(run) {
  if (run.action !== "run" || run.cardId === null || run.status !== "done") return;
  boardMove(() => cmdRun(run.cardId));
}
function resumeIdOf(r) {
  if (adoptsSessionId(r.harness) && !r.resumedFrom) return r.sessionId;
  return r.resumeId;
}
function toView(r, resumable) {
  return {
    ...r,
    durationMs: r.status !== "running" && r.endedAt ? r.endedAt - r.startedAt : void 0,
    // The Resume offer, and everything it needs to be honest: the run stopped short, we
    // know the id to continue by, and the agent that ran it is still the one the board
    // runs — resuming a Claude Code conversation under another agent would hand it an id
    // that means nothing there.
    canResume: canPickUp(r) && !!resumeIdOf(r) && !!resumable && r.harness === resumable
  };
}
function listRuns() {
  const runs = withRuns((all) => {
    reap(all);
    return all.map((r) => ({ ...r }));
  });
  const resumable = resumableHarness();
  return runs.map((r) => toView(r, resumable));
}
function findRun(runs, id) {
  const key = id.trim();
  if (!key) return void 0;
  if (key === "last") return runs[runs.length - 1];
  const exact = runs.find((r) => r.sessionId === key);
  if (exact) return exact;
  const hits = runs.filter((r) => r.sessionId.startsWith(key));
  if (hits.length === 1) return hits[0];
  return hits.length > 1 ? null : void 0;
}
function getRun(id, bytes) {
  const runs = withRuns((all) => {
    reap(all);
    return all.map((r) => ({ ...r }));
  });
  const found = findRun(runs, id);
  if (!found) return null;
  const view2 = toView(found, resumableHarness());
  const raw = readLogTail(found.logPath, bytes) ?? "";
  const { tail: tail2, result, durationMs, costUsd, model, usage } = splitLog(raw);
  view2.tail = tail2;
  if (result && found.status !== "running" && !view2.result) view2.result = result;
  if (view2.durationMs === void 0 && durationMs !== void 0 && found.status !== "running") {
    view2.durationMs = durationMs;
  }
  if (view2.costUsd === void 0 && costUsd !== void 0 && found.status !== "running") {
    view2.costUsd = costUsd;
  }
  if (view2.usage === void 0 && usage !== void 0 && found.status !== "running") view2.usage = usage;
  if (view2.model === void 0 && model !== void 0) view2.model = model;
  return view2;
}
function lockedBy(runs, action, cardId) {
  if (cardId !== null) {
    const live = runs.find((r) => r.status === "running" && r.cardId === cardId);
    if (live) return `#${cardId} is already being ${VERB[live.action]}`;
  }
  if (SINGLETON_ACTIONS.has(action)) {
    const live = runs.find((r) => r.status === "running" && r.action === action);
    if (live) return SINGLETON_BUSY[action] ?? `a task is already being ${VERB[action]}`;
  }
  return void 0;
}
function runInput(req) {
  const text4 = req.action === "plan-release" ? req.release ?? "" : req.description ?? req.reason ?? req.notes ?? "";
  return text4.trim() || void 0;
}
function titleOf(cardId) {
  if (!Number.isInteger(cardId)) return void 0;
  return cardNow(cardId)?.title;
}
function openRun(req, prompt) {
  const cardId = Number.isInteger(req.id) ? req.id : null;
  const sessionId = randomUUID();
  const plan = planRun(sessionId);
  const record = {
    sessionId,
    cardId,
    action: req.action,
    status: "running",
    startedAt: Date.now(),
    input: runInput(req),
    harness: plan.harness,
    // No `resumeId` here on purpose. A fresh run under an agent that takes our id needs
    // none, and one that mints its own has nothing to record yet.
    logPath: logPathOf(sessionId)
  };
  const out = withRuns((runs) => {
    const locked = lockedBy(runs, req.action, cardId);
    if (locked) return { error: locked };
    runs.push(record);
    return { run: record };
  });
  if ("error" in out) return out;
  const spec = { sessionId, plan, prompt };
  writeSpec(spec);
  return { run: record, spec };
}
function openResume(id) {
  const runs = withRuns((all) => {
    reap(all);
    return all.map((r) => ({ ...r }));
  });
  const prev = findRun(runs, id);
  if (prev === null) return { error: `"${id}" matches more than one run \u2014 give more of the id` };
  if (!prev) return { error: `no run here answers to "${id}"` };
  if (prev.status === "running") return { error: "that run is still going" };
  if (!canPickUp(prev)) return { error: "only a failed or interrupted run can be continued" };
  const resumeId = resumeIdOf(prev);
  if (!resumeId) return { error: "that run never reported an id to continue by" };
  const plan = planResume(prev.harness, resumeId);
  if (!plan) return { error: `the agent the board runs now can't continue a ${prev.harness || "earlier"} run` };
  const sessionId = randomUUID();
  const record = {
    sessionId,
    cardId: prev.cardId,
    action: prev.action,
    status: "running",
    startedAt: Date.now(),
    // No `input`: the note the user typed is already in the conversation being resumed —
    // repeating it would read as a second instruction they never gave.
    harness: plan.harness,
    resumeId: plan.resumeId ?? void 0,
    resumedFrom: prev.sessionId,
    logPath: logPathOf(sessionId)
  };
  const out = withRuns((all) => {
    const locked = lockedBy(all, prev.action, prev.cardId);
    if (locked) return { error: locked };
    all.push(record);
    const at = all.findIndex((r) => r.sessionId === prev.sessionId);
    if (at >= 0) all.splice(at, 1);
    return { run: record };
  });
  if ("error" in out) return out;
  try {
    fs14.unlinkSync(prev.logPath);
  } catch {
  }
  const spec = { sessionId, plan, prompt: "" };
  writeSpec(spec);
  return { run: record, spec };
}
function markSpawned(sessionId, pid) {
  patch(sessionId, (r) => {
    if (r.status === "running") r.pid = pid;
  });
}
function patch(sessionId, change) {
  return withRuns((runs) => {
    const run = runs.find((r) => r.sessionId === sessionId);
    if (run) change(run);
    return run ? { ...run } : void 0;
  });
}
function peekRun(sessionId) {
  return readRuns().find((r) => r.sessionId === sessionId);
}
function closeRun(sessionId, res) {
  const closed = withRuns((runs) => {
    const run = runs.find((r) => r.sessionId === sessionId);
    if (!run || run.status !== "running") return void 0;
    run.status = res.status;
    if (res.ok !== void 0) run.ok = res.ok;
    run.code = res.code ?? null;
    if (res.error) run.error = res.error;
    run.endedAt = res.endedAt ?? Date.now();
    run.pid = void 0;
    return { ...run };
  });
  if (!closed) return;
  restoreCardStatus(closed);
  recordRecurringRun(closed);
  dropSpec(sessionId);
  pruneLogs();
}
function stopRun(id) {
  const out = withRuns((runs) => {
    reap(runs);
    const run = findRun(runs, id);
    if (run === null) return { ok: false, error: `"${id}" matches more than one run \u2014 give more of the id` };
    if (!run) return { ok: false, error: `no run here answers to "${id}"` };
    if (run.status !== "running") return { ok: true, sessionId: run.sessionId };
    run.stopping = true;
    return { ok: true, sessionId: run.sessionId, pid: run.pid, live: true };
  });
  const live = out;
  if (!live.ok || !live.live) return { ok: live.ok, sessionId: live.sessionId, error: live.error };
  if (live.pid) {
    try {
      process.kill(live.pid, "SIGTERM");
    } catch {
    }
  } else {
    closeRun(live.sessionId, { status: "stopped", code: null });
  }
  return { ok: true, sessionId: live.sessionId };
}
function writeSpec(spec) {
  fs14.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs14.writeFileSync(specPathOf(spec.sessionId), JSON.stringify(spec, null, 2) + "\n");
}
function readSpec(sessionId) {
  try {
    const spec = JSON.parse(fs14.readFileSync(specPathOf(sessionId), "utf8"));
    return spec && Array.isArray(spec.plan?.argv) ? spec : null;
  } catch {
    return null;
  }
}
function dropSpec(sessionId) {
  try {
    fs14.unlinkSync(specPathOf(sessionId));
  } catch {
  }
}
function pruneLogs() {
  try {
    const files = fs14.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".log")).map((f) => ({ f, t: fs14.statSync(path12.join(SESSIONS_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const { f } of files.slice(KEEP_LOGS)) {
      try {
        fs14.unlinkSync(path12.join(SESSIONS_DIR, f));
      } catch {
      }
    }
  } catch {
  }
}
async function acquireIndexLock(giveUp) {
  const until = Date.now() + INDEX_WAIT_MS;
  const holder = path12.join(INDEX_LOCK, "holder");
  for (; ; ) {
    if (giveUp()) return null;
    try {
      fs14.mkdirSync(INDEX_LOCK, { recursive: false });
      fs14.writeFileSync(holder, String(process.pid));
      return () => fs14.rmSync(INDEX_LOCK, { recursive: true, force: true });
    } catch (err) {
      const code = err.code;
      if (code === "ENOENT") {
        fs14.mkdirSync(path12.dirname(INDEX_LOCK), { recursive: true });
        continue;
      }
      if (code !== "EEXIST") throw err;
      if (!pidAlive(Number(readHolder(holder)))) {
        fs14.rmSync(INDEX_LOCK, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > until) return null;
      await sleep2(INDEX_POLL_MS);
    }
  }
}
function readHolder(file) {
  try {
    return fs14.readFileSync(file, "utf8").trim();
  } catch {
    return String(process.pid);
  }
}
var KEEP_RUNS, PENDING_MS, INDEX_ACTIONS, SINGLETON_ACTIONS, VERB, SINGLETON_BUSY, RUN_STATUS, RUN_IGNORE_LINES, logPathOf, specPathOf, canPickUp, needsIndexLock, INDEX_WAIT_MS, INDEX_POLL_MS, sleep2;
var init_sessions = __esm({
  "src/lib/agent/sessions.ts"() {
    "use strict";
    init_card();
    init_misc();
    init_cards();
    init_frontmatter();
    init_io();
    init_lock();
    init_paths();
    init_log();
    init_resolve();
    KEEP_RUNS = 30;
    PENDING_MS = 3e4;
    INDEX_ACTIONS = /* @__PURE__ */ new Set(["create", "propose", "archive", "reject", "run", "plan-release"]);
    SINGLETON_ACTIONS = /* @__PURE__ */ new Set(["create", "propose", "plan-release"]);
    VERB = {
      implement: "implemented",
      run: "run",
      reject: "rejected",
      archive: "archived",
      edit: "edited",
      create: "created",
      propose: "proposed",
      "auto-refine": "auto-refined",
      resolve: "resolved",
      "plan-release": "planned"
    };
    SINGLETON_BUSY = {
      "plan-release": "a release is already being planned"
    };
    RUN_STATUS = { implement: "implementing" };
    RUN_IGNORE_LINES = [
      { line: ".sessions.json", comment: "# What is running on this machine, and what ran lately." },
      { line: ".sessions/", comment: "# One log per run \u2014 the agent's own output." },
      { line: ".sessions.lock/", comment: "# The lock that record is written under." },
      { line: ".index.lock/", comment: "# Held by the one run at a time that may rewrite the board index." }
    ];
    logPathOf = (sessionId) => path12.join(SESSIONS_DIR, `${sessionId}.log`);
    specPathOf = (sessionId) => path12.join(SESSIONS_DIR, `${sessionId}.plan.json`);
    canPickUp = (r) => r.status === "error" || r.status === "interrupted";
    needsIndexLock = (action) => INDEX_ACTIONS.has(action);
    INDEX_WAIT_MS = 60 * 6e4;
    INDEX_POLL_MS = 500;
    sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  }
});

// src/lib/view/goal.ts
import fs15 from "node:fs";
import path13 from "node:path";
function readGoalReviewFrom(text4) {
  const fm = text4.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line2 = fm && fm[1].match(/^reviewed:[ \t]*(.+?)[ \t]*$/m);
  const v = line2 && unquote(line2[1]);
  return v && GOAL_REVIEW_VALUES.includes(v) ? v : null;
}
function writeGoalReviewInto(text4, value) {
  const fm = text4.match(/^---\r?\n([\s\S]*?\r?\n)---/);
  if (!fm) return `---
reviewed: ${value}
---

${text4}`;
  const inner = /^reviewed:.*$/m.test(fm[1]) ? fm[1].replace(/^reviewed:.*$/m, () => `reviewed: ${value}`) : `reviewed: ${value}
${fm[1]}`;
  return `---
${inner}---${text4.slice(fm[0].length)}`;
}
function readGoalBody(text4) {
  const body = text4.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const flat = (s) => s.trim().replace(/\s+/g, " ");
  const seeded = SEEDED_GOAL_BODIES.some((s) => flat(s) === flat(body));
  return { body, seeded, written: !seeded && body.trim() !== "" };
}
function goalFile() {
  try {
    return { text: fs15.readFileSync(GOAL, "utf8") };
  } catch {
    return null;
  }
}
function goalReviewed() {
  const file = goalFile();
  const v = file && readGoalReviewFrom(file.text);
  return v === "strong" || v === "good" || v === "weak" ? v : "pending";
}
function goalWritten() {
  const file = goalFile();
  return file ? readGoalBody(file.text).written : false;
}
function goalNeedsWork() {
  return !goalWritten() || goalReviewed() === "weak";
}
function readGoalText() {
  const file = goalFile();
  if (!file) return "";
  const { body, seeded } = readGoalBody(file.text);
  return seeded ? "" : body.replace(/^\n+/, "");
}
function writeGoalText(text4) {
  const before = goalFile();
  const kept = before ? before.text.slice(0, before.text.length - readGoalBody(before.text).body.length) : "";
  const body = text4.replace(/^\n+/, "").replace(/\s+$/, "");
  fs15.mkdirSync(path13.dirname(GOAL), { recursive: true });
  fs15.writeFileSync(GOAL, writeGoalReviewInto(`${kept}${body}
`, "pending"));
}
var GOAL_REVIEW_VALUES, SEEDED_GOAL_BODIES;
var init_goal = __esm({
  "src/lib/view/goal.ts"() {
    "use strict";
    init_paths();
    init_yaml();
    GOAL_REVIEW_VALUES = ["strong", "good", "pending", "weak"];
    SEEDED_GOAL_BODIES = [
      `# Goal

Where this is headed, in the user's own words: the long-term goal, the horizon it aims
at, and the roadmap of what comes next, roughly in order. Not this week's work \u2014 that's
the cards on the board. The user owns this file; the agent seeds it but does not invent
the goal.

_(not filled in yet \u2014 the user writes this.)_`,
      `# Goal

The direction, in the user's own words \u2014 where this is headed. One short statement. The
user owns this file; the agent seeds it but does not invent the goal.

_(not filled in yet \u2014 the user writes this.)_`
    ];
  }
});

// src/lib/setup.ts
import fs17 from "node:fs";
import path15 from "node:path";
function setupUnfinished() {
  return fs17.existsSync(SETUP_CHECKLIST);
}
function readSetupChecklist() {
  if (!setupUnfinished()) return null;
  const steps = [];
  for (const raw of fs17.readFileSync(SETUP_CHECKLIST, "utf8").split("\n")) {
    const m = raw.match(LINE_RE);
    if (m) steps.push({ done: m[1] !== " ", name: m[2], owner: m[3], text: m[4] });
  }
  return steps;
}
function writeSetupChecklist() {
  const body = SETUP_STEPS.map((s) => line(s, DONE_AT_INSTALL.includes(s.name))).join("\n");
  fs17.writeFileSync(SETUP_CHECKLIST, `${HEADER}${body}
`);
}
function tickSetupStep(name) {
  if (!setupUnfinished()) return { missing: true };
  const text4 = fs17.readFileSync(SETUP_CHECKLIST, "utf8");
  const lines = text4.split("\n");
  let found = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_RE);
    if (!m || m[2] !== name) continue;
    found = { index: i, done: m[1] !== " " };
    break;
  }
  if (!found) return { unknown: true };
  const steps = readSetupChecklist() ?? [];
  const total = steps.length;
  if (found.done) return { already: true, done: steps.filter((s) => s.done).length, total };
  lines[found.index] = lines[found.index].replace(/^- \[ \]/, "- [x]");
  const done = steps.filter((s) => s.done).length + 1;
  if (done >= total) {
    fs17.rmSync(SETUP_CHECKLIST);
    swapConfigGateForDone();
    return { ok: true, done, total, finished: true, questionsCard: dropSetupQuestionsCardIfEmpty() };
  }
  fs17.writeFileSync(SETUP_CHECKLIST, lines.join("\n"));
  return { ok: true, done, total, finished: false };
}
function swapConfigGateForDone() {
  if (!fs17.existsSync(CONFIG)) return;
  const lines = fs17.readFileSync(CONFIG, "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("- **Setup gate**"));
  if (start === -1) return;
  let end = start + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++;
  lines.splice(start, end - start, CONFIG_SETUP_DONE);
  fs17.writeFileSync(CONFIG, lines.join("\n"));
}
function writeSetupQuestionsCard(track) {
  const id = readNextId();
  const fileRel = path15.join(track, `${id}-${SETUP_QUESTIONS_SLUG}.md`);
  const file = path15.join(TODO, fileRel);
  if (fs17.existsSync(file)) return null;
  writeNextId(id + 1);
  const meta = { title: SETUP_QUESTIONS_TITLE, track, priority: "high", roi: "high", status: "todo", release: "", blocked_by: [], related: [], modules: [], questions: [] };
  fs17.writeFileSync(file, serializeFrontmatter(meta) + "\n\n" + SETUP_QUESTIONS_BODY);
  addReadmeRef(track, id, SETUP_QUESTIONS_TITLE, fileRel);
  return { id, file };
}
function findSetupQuestionsCard() {
  const file = walkMd(TODO).find((f) => path15.basename(f).endsWith(`-${SETUP_QUESTIONS_SLUG}.md`));
  if (!file) return null;
  const { meta } = parseFrontmatter(fs17.readFileSync(file, "utf8"));
  return { id: idPrefix(path15.basename(file)), file, questions: meta?.questions?.length ?? 0 };
}
function dropSetupQuestionsCardIfEmpty() {
  const card = findSetupQuestionsCard();
  if (!card) return null;
  if (card.questions > 0) return { id: card.id, kept: true, questions: card.questions };
  fs17.rmSync(card.file);
  stripReadmeRefs({ kind: "file", rel: path15.relative(TODO, card.file) });
  return { id: card.id, kept: false };
}
function nextSetupStep() {
  const steps = readSetupChecklist();
  return steps ? steps.find((s) => !s.done) || null : null;
}
var SETUP_STEPS, DONE_AT_INSTALL, HEADER, line, LINE_RE, CONFIG_SETUP_DONE, SETUP_QUESTIONS_SLUG, SETUP_QUESTIONS_TITLE, SETUP_QUESTIONS_BODY;
var init_setup = __esm({
  "src/lib/setup.ts"() {
    "use strict";
    init_paths();
    init_frontmatter();
    init_readme();
    init_cards();
    SETUP_STEPS = [
      { name: "install", owner: "script", text: "Install the skill and scaffold the board." },
      { name: "project", owner: "you", text: "Say what this project is and what tracks its work falls into, in `docs/kanban/config.md`." },
      { name: "goal", owner: "you", text: "Write the project goal in `docs/kanban/memory/goal.md`." },
      { name: "agent", owner: "you", text: "Pick the agent that runs this board, and give it a key." },
      { name: "config", owner: "agent", text: "Fill in the rest of `docs/kanban/config.md` from what the repo says." },
      { name: "decisions", owner: "agent", text: "Settle `docs/kanban/memory/decisions.md` from the goal." },
      { name: "modules", owner: "agent", text: "Write `docs/kanban/modules.md`, then move each settled call into its module's memory." },
      { name: "tasks", owner: "agent", text: "Create the first tasks." }
    ];
    DONE_AT_INSTALL = ["install"];
    HEADER = `# Setup checklist

Setup's own steps, in order. Each step ticks its box when it finishes; the tick that closes
the last box deletes this file, so a board without it is a board that is set up.

The guide for each step is the skill's \`references/setup.md\` \u2014 start at the first
unticked box and follow it in order.

The script writes this file \u2014 \`kanban.mjs setup-done <step>\` ticks one box. Don't edit it
by hand: the local board UI reads its shape to show how far setup got and what comes next.

`;
    line = (step, done) => `- [${done ? "x" : " "}] \`${step.name}\` (${step.owner}) \u2014 ${step.text}`;
    LINE_RE = /^- \[([ xX])\][ \t]+`([a-z][a-z0-9-]*)`[ \t]+\((script|agent|you)\)[ \t]+—[ \t]+(.+?)[ \t]*$/;
    CONFIG_SETUP_DONE = "- **Setup** \u2014 this board is set up; plan and create cards freely.";
    SETUP_QUESTIONS_SLUG = "answer-the-questions-setup-couldnt-settle";
    SETUP_QUESTIONS_TITLE = "Answer the questions setup couldn't settle";
    SETUP_QUESTIONS_BODY = `The calls setup could not settle on its own \u2014 each step appends its own here as it runs.
Answer them through the resolve flow: each answer becomes a line in the project-wide
\`docs/kanban/memory/decisions.md\`, and the card is done when no question is left. It
holds no build work, so no todos.
`;
  }
});

// src/lib/agent/launch.ts
import { spawn as spawn2 } from "node:child_process";
import fs22 from "node:fs";
import path20 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function spawnWatcher(sessionId) {
  fs22.mkdirSync(SESSIONS_DIR, { recursive: true });
  const out = fs22.openSync(path20.join(SESSIONS_DIR, `${sessionId}.watch.log`), "a");
  try {
    const child = spawn2(process.execPath, [SELF, "__watch", sessionId, "--dir", REPO_ROOT], {
      cwd: REPO_ROOT,
      env: process.env,
      // Its own process group, so a Ctrl-C in the terminal that started the run doesn't
      // reach the agent — and so a stop can signal this run and nothing else.
      detached: true,
      stdio: ["ignore", out, out]
    });
    child.unref();
    return child.pid;
  } catch {
    return void 0;
  } finally {
    try {
      fs22.closeSync(out);
    } catch {
    }
  }
}
var SELF;
var init_launch = __esm({
  "src/lib/agent/launch.ts"() {
    "use strict";
    init_paths();
    SELF = fileURLToPath2(import.meta.url);
  }
});

// src/lib/agent/types.ts
var PROPOSE_DEFAULT, PROPOSE_MAX;
var init_types2 = __esm({
  "src/lib/agent/types.ts"() {
    "use strict";
    PROPOSE_DEFAULT = 3;
    PROPOSE_MAX = 10;
  }
});

// src/lib/agent/prompts.ts
function clampCount(count2) {
  if (!Number.isFinite(count2)) return PROPOSE_DEFAULT;
  return Math.min(PROPOSE_MAX, Math.max(1, Math.round(count2)));
}
function buildPrompt(req) {
  const kb = skillCall();
  const tag = req.id ? `#${req.id}` : "";
  const named = req.title ? `${tag} ("${req.title}")` : tag;
  switch (req.action) {
    case "implement":
      return [
        `${kb}. Implement task ${req.id} ${named}.`,
        req.notes ? `Extra notes: ${req.notes}` : "",
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`
      ].filter(Boolean).join(" ");
    // One pass of a recurring card. It is not an implement: the card is a job that repeats,
    // so the run does its `## Process` and leaves the card on the board.
    //
    // Nothing here about recording the run. That is the board's bookkeeping and the run
    // itself does it at the close (see the supervisor) — an agent asked to stamp its own
    // scheduling state is one crash away from freezing the card.
    //
    // And nothing here about how a run goes. The card's `## Process` is the job, and the
    // protocol around it — questions, the resolve pass, never archiving — is the same for
    // every recurring card, so it belongs in the guide, not in a prompt rebuilt every run.
    case "run":
      return [
        `${kb}. Run recurring task ${req.id} ${named} \u2014 one pass, following \`references/recurring-task.md\`.`,
        req.notes ? `Extra notes: ${req.notes}` : "",
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`
      ].filter(Boolean).join(" ");
    case "reject":
      return [
        `${kb}. Reject task ${req.id} ${named}. Reason: ${req.reason || "(none given)"}.`,
        `Follow the skill's reject flow.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`
      ].join(" ");
    case "archive":
      return [
        `${kb}. Archive task ${req.id} ${named}.`,
        `Follow the skill's archive flow.`,
        req.notes ? `Extra notes: ${req.notes}` : "",
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`
      ].filter(Boolean).join(" ");
    case "edit":
      return [
        `${kb}. Revise task ${req.id} ${named}: "${req.notes || ""}" ${NO_IMPLEMENT}`,
        `You can create new subtasks if it's a group task and the intent is to do so.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`
      ].join(" ");
    case "create":
      return [
        `${kb}. Add task(s) from this requirement: "${req.description || ""}".`,
        `Follow the skill's add-task flow. Create task only, don't implement it.`,
        // The board was showing one release when this was asked for, so the card ships in
        // it — otherwise it would land in no release, off the screen of the person who
        // just wrote it.
        req.release ? `Put the new card(s) in the "${req.release}" release: \`--release ${req.release}\`.` : "",
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`
      ].filter(Boolean).join(" ");
    case "propose": {
      const n = clampCount(req.count);
      return [
        `${kb}. Propose ${n} new task${n === 1 ? "" : "s"} following \`references/propose.md\`.`,
        req.module ? `Focus on the "${req.module}" module \u2014 read its memory set and write every one of them inside it.` : `Pick one focus module yourself (per references/propose.md) and write every one of them inside it.`,
        BOLDNESS_LINE[req.boldness ?? "normal"],
        `Create the cards only, don't implement them.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`
      ].filter(Boolean).join(" ");
    }
    // Plan one release against its goal. The run reads the goal off the release's own line,
    // moves in the open cards that ship it, and writes the cards the goal needs that the
    // board hasn't got — deciding all of it on its own, and saying in its log what it
    // moved, what it wrote, and what it left.
    //
    // The release id is all this prompt carries: the goal is on the board, and a copy
    // pasted in here would go stale the moment the user changed it.
    case "plan-release":
      return [
        `${kb}. Plan the "${req.release || ""}" release following \`references/plan-release.md\`:`,
        `move in the open cards that ship its goal, and write the cards the goal needs that the board is missing.`,
        `Create the cards only, don't implement them.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`
      ].join(" ");
    case "auto-refine":
      return [
        `${kb}. Auto-refine task ${req.id} ${named} following \`references/auto-refine.md\`.`,
        `Don't ask me questions with human-in-the-loop \u2014 the \`[user]\` tag is how you defer to me.`,
        NO_IMPLEMENT
      ].filter(Boolean).join(" ");
    case "resolve":
      return [
        `${kb}. Resolve the open questions on task ${req.id} ${named} following \`references/resolve.md\`.`,
        req.andImplement ? `Then, if resolving settles every question and nothing genuine is left for me to decide, go straight on to implementing the task \u2014 one continuous session. But if any real judgment call stays open, stop there and report it: don't implement on a guess.` : NO_IMPLEMENT,
        req.notes ? `Extra notes: ${req.notes}` : "",
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`
      ].filter(Boolean).join(" ");
  }
}
var RESUME_PROMPT, BOLDNESS_LINE, NO_IMPLEMENT;
var init_prompts = __esm({
  "src/lib/agent/prompts.ts"() {
    "use strict";
    init_resolve();
    init_types2();
    RESUME_PROMPT = [
      `Continue. The previous run ended before it finished the task.`,
      `Pick up where you left off and carry it through.`,
      `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`
    ].join(" ");
    BOLDNESS_LINE = {
      safe: `Boldness: **safe** (see "Boldness" in references/propose.md) \u2014 small moves that polish or fill gaps in what already works.`,
      normal: "",
      bold: `Boldness: **bold** (see "Boldness" in references/propose.md) \u2014 each task is a big leap: a capability the module doesn't have at all, still sized so one session finishes it.`
    };
    NO_IMPLEMENT = `(Unless the task note specifies, don't implement it.)`;
  }
});

// src/lib/agent/start.ts
function startRun(req) {
  const opened = openRun(req, buildPrompt(req));
  if ("error" in opened) return { error: opened.error };
  const { run } = opened;
  const pid = spawnWatcher(run.sessionId);
  markSpawned(run.sessionId, pid);
  return { run, spawned: pid !== void 0 };
}
var init_start = __esm({
  "src/lib/agent/start.ts"() {
    "use strict";
    init_launch();
    init_prompts();
    init_sessions();
  }
});

// src/lib/view/read.ts
import fs23 from "node:fs";
import path21 from "node:path";
function countTodos(body) {
  const matches = body.match(/^[ \t]*[-*]\s+\[( |x|X)\]/gm) || [];
  const done = matches.filter((l) => /\[[xX]\]/.test(l)).length;
  return { total: matches.length, done };
}
function countSubtaskLines(body) {
  let total = 0;
  let resolved = 0;
  for (const line2 of body.split("\n")) {
    const m = line2.match(/^[ \t]*[-*]\s+\[( |x|X)\]\s*(.*)$/);
    if (!m || !/#\d+/.test(m[2])) continue;
    total++;
    if (/[xX]/.test(m[1]) || /~~[\s\S]*~~/.test(m[2])) resolved++;
  }
  return { total, resolved };
}
function dueLabel(lastRun, cadence) {
  const due = nextDue(lastRun, cadence);
  if (!due) return "";
  return due.getTime() <= Date.now() ? "Due now" : formatStamp(due);
}
function readCard(file, relFromTodo) {
  const id = idPrefix2(path21.basename(relFromTodo));
  if (id === null) {
    const parts = relFromTodo.split(path21.sep);
    const folderId = idPrefix2(parts[parts.length - 2] || "");
    if (folderId === null) return null;
    return buildCard(folderId, file, relFromTodo);
  }
  return buildCard(id, file, relFromTodo);
}
function buildCard(id, file, relFromTodo) {
  const { meta, body } = parseFrontmatter(fs23.readFileSync(file, "utf8"));
  if (!meta) return null;
  const track = meta.track || path21.basename(path21.dirname(relFromTodo));
  const relPath = relFromTodo.split(path21.sep).join("/");
  const recurring = relPath.split("/")[0] === "recurring";
  return {
    id,
    relPath,
    title: meta.title,
    track,
    priority: meta.priority,
    roi: meta.roi,
    status: meta.status,
    release: meta.release,
    blocked_by: meta.blocked_by,
    related: meta.related,
    questions: meta.questions,
    modules: meta.modules,
    last_run: meta.last_run,
    cadence: meta.cadence,
    nextRun: recurring ? dueLabel(meta.last_run, meta.cadence) : "",
    body: body.replace(/^\n+/, "").replace(/\s+$/, ""),
    todos: countTodos(body),
    isGroup: false,
    // readGroup flips this on the one card that is a root
    recurring,
    openBlockers: []
    // filled by attachBlockers once every card has been read
  };
}
function attachBlockers(cards) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  for (const card of cards) {
    card.openBlockers = card.blocked_by.filter((n) => n !== card.id).map((n) => byId.get(n)).filter((b) => !!b && !b.recurring).map((b) => ({ id: b.id, title: b.title }));
  }
}
function isGroupDir(dir) {
  return fs23.existsSync(path21.join(dir, "root.md"));
}
function readGroup(folderName) {
  const groupDir = path21.join(TODO, folderName);
  const root = readCard(path21.join(groupDir, "root.md"), path21.join(folderName, "root.md"));
  if (!root) return null;
  root.isGroup = true;
  root.subtaskLines = countSubtaskLines(root.body);
  const subCards = [];
  const recurse = (dir, relDir) => {
    for (const entry of fs23.readdirSync(dir, { withFileTypes: true })) {
      const childRel = path21.join(relDir, entry.name);
      if (entry.isDirectory()) {
        recurse(path21.join(dir, entry.name), childRel);
      } else if (entry.name.endsWith(".md") && entry.name !== "README.md" && entry.name !== "root.md") {
        const c = readCard(path21.join(dir, entry.name), childRel);
        if (c) {
          c.parent = { id: root.id, title: root.title };
          subCards.push(c);
        }
      }
    }
  };
  recurse(groupDir, folderName);
  subCards.sort((a, b) => a.id - b.id);
  root.subtasks = subCards.map((c) => ({
    id: c.id,
    title: c.title,
    track: c.track,
    release: c.release,
    todos: c.todos
  }));
  return { root, subCards };
}
function standaloneCards(track) {
  const dir = path21.join(TODO, track);
  if (!fs23.existsSync(dir)) return [];
  const cards = [];
  for (const entry of fs23.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      const c = readCard(path21.join(dir, entry.name), path21.join(track, entry.name));
      if (c) cards.push(c);
    }
  }
  return cards.sort((a, b) => a.id - b.id);
}
function collectCards() {
  const board = [];
  const every = [];
  for (const entry of fs23.readdirSync(TODO, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path21.join(TODO, entry.name);
    if (isGroupDir(dir)) {
      const g = readGroup(entry.name);
      if (g) {
        board.push(g.root);
        every.push(g.root, ...g.subCards);
      }
    } else {
      const cards = standaloneCards(entry.name);
      board.push(...cards);
      every.push(...cards);
    }
  }
  attachBlockers(every);
  return { board, every };
}
function findCard(id) {
  return collectCards().every.find((c) => c.id === id) ?? null;
}
function allCards() {
  return collectCards().every;
}
function trackFolders() {
  return fs23.readdirSync(TODO, { withFileTypes: true }).filter((e) => e.isDirectory() && !isGroupDir(path21.join(TODO, e.name))).map((e) => e.name);
}
function orderedTracks() {
  const folders = new Set(trackFolders());
  const ordered = [];
  const seen = /* @__PURE__ */ new Set();
  if (fs23.existsSync(README)) {
    for (const line2 of fs23.readFileSync(README, "utf8").split("\n")) {
      const m = line2.match(/^##\s+(.+?)\s*$/);
      if (!m) continue;
      const heading = m[1];
      const track = heading.toLowerCase() === "blockers" ? "blockers" : heading;
      if (folders.has(track) && !seen.has(track)) {
        ordered.push({ track, title: track === "blockers" ? "Blockers" : heading });
        seen.add(track);
      }
    }
  }
  if (folders.has("blockers") && !seen.has("blockers")) {
    ordered.unshift({ track: "blockers", title: "Blockers" });
    seen.add("blockers");
  }
  for (const t of trackFolders()) {
    if (!seen.has(t)) ordered.push({ track: t, title: t });
  }
  return ordered;
}
function readArchiveNotes() {
  if (!fs23.existsSync(ARCHIVE_MD)) return [];
  const groups = [];
  let current = null;
  for (const line2 of fs23.readFileSync(ARCHIVE_MD, "utf8").split("\n")) {
    const h2 = line2.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      current = { category: h2[1], markdown: "" };
      groups.push(current);
      continue;
    }
    if (/^#\s/.test(line2)) continue;
    if (current) current.markdown += line2 + "\n";
  }
  return groups.map((g) => ({ ...g, markdown: g.markdown.trim() })).filter((g) => g.markdown.length > 0);
}
function countByRelease2(cards) {
  const counts = {};
  for (const card of cards) counts[card.release] = (counts[card.release] ?? 0) + 1;
  return counts;
}
function readSetupState() {
  const steps = readSetupChecklist();
  if (!steps || steps.length === 0) return null;
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, next: steps.find((s) => !s.done) ?? null };
}
function readBoard() {
  const { board, every } = collectCards();
  const byTrack = /* @__PURE__ */ new Map();
  for (const card of board) {
    const list = byTrack.get(card.track);
    if (list) list.push(card);
    else byTrack.set(card.track, [card]);
  }
  const columns = orderedTracks().map(({ track, title }) => ({
    track,
    title,
    cards: (byTrack.get(track) ?? []).sort(byPickOrder)
  }));
  const entries = readReleaseEntries();
  const releaseGoals = {};
  for (const entry of entries) if (entry.goal) releaseGoals[entry.id] = entry.goal;
  return {
    columns,
    archive: readArchiveNotes(),
    // Linkify every open id, subtasks included — not just the cards the columns show.
    openIds: Array.from(new Set(every.map((card) => card.id))),
    releases: entries.map((e) => e.id),
    releaseGoals,
    releaseCounts: countByRelease2(every),
    goalNeedsWork: goalNeedsWork(),
    goalWritten: goalWritten(),
    setup: readSetupState()
  };
}
var idPrefix2;
var init_read = __esm({
  "src/lib/view/read.ts"() {
    "use strict";
    init_paths();
    init_cadence();
    init_frontmatter();
    init_releases();
    init_setup();
    init_goal();
    init_rules();
    idPrefix2 = (name) => {
      const m = name.match(/^(\d+)-/);
      return m ? Number(m[1]) : null;
    };
  }
});

// src/lib/agent/follow.ts
function markBoard() {
  try {
    return new Map(allCards().map((c) => [c.id, { wrote: wroteOf(c), blocked: c.openBlockers.length > 0 }]));
  } catch {
    return /* @__PURE__ */ new Map();
  }
}
function refinesAfter(action, before) {
  let cards;
  try {
    cards = allCards();
  } catch {
    return [];
  }
  const follows = !NO_FOLLOW.has(action);
  return cards.filter((card) => {
    const was = before.get(card.id);
    const touched = follows && (!was || was.wrote !== wroteOf(card));
    const freed = !!was && was.blocked && card.openBlockers.length === 0;
    return touched || freed;
  }).filter((card) => card.openBlockers.length === 0 && canRefine(card)).sort(byDispatchOrder).map((card) => ({ action: "auto-refine", id: card.id, title: card.title }));
}
var unmarkSubtasks, wroteOf, NO_FOLLOW;
var init_follow = __esm({
  "src/lib/agent/follow.ts"() {
    "use strict";
    init_read();
    init_rules();
    unmarkSubtasks = (body) => body.split("\n").map((line2) => {
      const m = line2.match(/^([ \t]*[-*]\s+)(?:\[[ xX]\]\s*)?(.*#\d+.*)$/);
      if (!m) return line2;
      return `${m[1]}[ ] ${m[2].replace(/~~/g, "")}`;
    }).join("\n");
    wroteOf = (c) => JSON.stringify([
      c.relPath,
      c.title,
      c.track,
      c.priority,
      c.roi,
      c.status,
      c.release,
      c.blocked_by,
      c.related,
      c.questions.map((q) => [q.text, q.mode ?? "", q.options ?? [], q.recommend ?? []]),
      c.modules,
      c.isGroup ? unmarkSubtasks(c.body) : c.body
    ]);
    NO_FOLLOW = /* @__PURE__ */ new Set(["implement", "auto-refine"]);
  }
});

// src/lib/agent/watch.ts
var watch_exports = {};
__export(watch_exports, {
  watchRun: () => watchRun
});
import { spawn as spawn3 } from "node:child_process";
import fs24 from "node:fs";
async function watchRun(sessionId) {
  const spec = readSpec(sessionId);
  const run = peekRun(sessionId);
  if (!run || !spec) {
    if (run?.status === "running") closeRun(sessionId, { status: "interrupted", code: null });
    return 1;
  }
  const stopping = () => peekRun(sessionId)?.status !== "running";
  let releaseIndex = null;
  if (needsIndexLock(run.action)) {
    releaseIndex = await acquireIndexLock(stopping);
    if (!releaseIndex) {
      if (!stopping()) closeRun(sessionId, { status: "interrupted", code: null });
      return 0;
    }
  }
  const letGo = () => {
    if (releaseIndex) releaseIndex();
    releaseIndex = null;
  };
  if (stopping()) {
    letGo();
    return 0;
  }
  const claimed = patch(sessionId, (r) => claimCard(r));
  const record = claimed ?? run;
  fs24.mkdirSync(SESSIONS_DIR, { recursive: true });
  const log = fs24.createWriteStream(record.logPath, { flags: "a" });
  const active = openPlan(spec.plan);
  const prompt = record.resumedFrom ? RESUME_PROMPT : spec.prompt;
  const before = markBoard();
  const [cmd, ...args] = active.argv;
  let child;
  try {
    child = spawn3(cmd, [...args, prompt], {
      cwd: process.cwd(),
      env: active.env,
      shell: false,
      // `claude -p` waits ~3s on a piped stdin, then logs a "no stdin data" warning into
      // our log. Close stdin so the log is only agent output.
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (e) {
    log.end();
    closeRun(sessionId, { status: "error", ok: false, code: null, error: String(e) });
    letGo();
    return 1;
  }
  const renderer = active.renderer;
  const append = (str) => {
    if (str) log.write(str);
  };
  let sawResumeId = !!record.resumeId;
  let sawModel = false;
  const catchIds = () => {
    if (!sawResumeId) sawResumeId = catchResumeId(sessionId, renderer.resumeId?.());
    if (!sawModel) sawModel = catchModel(sessionId, renderer.model?.());
  };
  child.stdout.on("data", (d) => {
    append(renderer.push(d.toString()));
    catchIds();
  });
  child.stderr.on("data", (d) => append(d.toString()));
  let spawnError;
  child.on("error", (err) => {
    spawnError = err?.code === "ENOENT" ? `${cmd} isn't installed, or isn't on this run's PATH. Install it with: ${active.install}` : String(err);
    log.write(`
[error] ${spawnError}`);
  });
  return await new Promise((resolve) => {
    let done = false;
    const finish = (code, asked) => {
      if (done) return;
      done = true;
      append(renderer.flush());
      catchIds();
      const endedAt = Date.now();
      log.write(durationLine(endedAt - record.startedAt));
      const cost = renderer.costUsd?.();
      if (cost !== void 0) log.write(costLine(cost));
      const usage = renderer.usage?.();
      if (usage) log.write(usageLine(usage));
      const model = peekRun(sessionId)?.model;
      if (model) log.write(modelLine(model));
      const final = renderer.result();
      if (final) log.write(`
${RESULT_MARKER}
${final}
`);
      log.end();
      patch(sessionId, (r) => {
        if (cost !== void 0) r.costUsd = cost;
        if (usage) r.usage = usage;
        if (final) r.result = final;
      });
      const status = asked ? "stopped" : code === 0 ? "done" : "error";
      closeRun(sessionId, {
        status,
        // `ok` stays unset on a stopped run, as it does on one that was cut off: it
        // neither passed nor failed, it was ended.
        ok: asked ? void 0 : code === 0,
        code: asked ? null : code,
        error: spawnError,
        endedAt
      });
      letGo();
      if (status === "done") followUp(record.action, before);
      resolve(code === 0 ? 0 : 1);
    };
    let stopped = false;
    const askToStop = () => {
      if (stopped || done) return;
      stopped = true;
      try {
        child.kill("SIGTERM");
      } catch {
      }
      after(STOP_GRACE_MS, () => {
        try {
          child.kill("SIGKILL");
        } catch {
        }
      });
      after(STOP_GRACE_MS + STOP_CLOSE_MS, () => {
        finish(null, true);
        process.exit(0);
      });
    };
    process.on("SIGTERM", askToStop);
    process.on("SIGINT", askToStop);
    child.on("close", (code) => finish(code, peekRun(sessionId)?.stopping === true || stopped));
  });
}
function followUp(action, before) {
  try {
    for (const req of refinesAfter(action, before)) startRun(req);
  } catch {
  }
}
function after(ms, fn) {
  const t = setTimeout(fn, ms);
  if (typeof t.unref === "function") t.unref();
}
function catchResumeId(sessionId, id) {
  if (!id) return false;
  patch(sessionId, (r) => {
    if (!r.resumeId) r.resumeId = id;
  });
  return true;
}
function catchModel(sessionId, model) {
  if (!model) return false;
  patch(sessionId, (r) => {
    if (!r.model) r.model = model;
  });
  return true;
}
var STOP_GRACE_MS, STOP_CLOSE_MS;
var init_watch = __esm({
  "src/lib/agent/watch.ts"() {
    "use strict";
    init_paths();
    init_follow();
    init_log();
    init_prompts();
    init_resolve();
    init_sessions();
    init_start();
    STOP_GRACE_MS = 5e3;
    STOP_CLOSE_MS = 2e3;
  }
});

// src/kanban.ts
init_paths();
import fs28 from "node:fs";
import { fileURLToPath as fileURLToPath3 } from "node:url";

// src/lib/agent-cli.ts
init_io();

// src/lib/board-cli.ts
init_paths();
init_io();
init_lock();
import fs21 from "node:fs";
import path19 from "node:path";

// src/lib/help.ts
var GROUPS = ["Cards", "Releases", "Board"];
var MOVES = [
  {
    name: "init",
    group: "Board",
    brief: [["init [track...]", "scaffold docs/kanban/; on an existing board add only what\nis missing"]],
    legacy: [
      [
        "init [track...]",
        [
          "scaffold docs/kanban/ (folders, the project-wide memory set in memory/, and a blank",
          "config.md, releases.md); tracks default to feature bug research. On an",
          "existing board it only adds the files that are missing (safe to re-run)."
        ]
      ]
    ]
  },
  {
    name: "memory-init",
    group: "Board",
    brief: [["memory-init <module>", "scaffold one module's memory folder"]],
    legacy: [
      [
        "memory-init <module>",
        [
          "lazily scaffold docs/kanban/memory/<module>/ with the four-file set",
          "(readme, decisions, redesign, rejected \u2014 goal.md lives only at the",
          "board root). Idempotent \u2014 run it before the first write to a",
          "module's memory."
        ]
      ]
    ]
  },
  {
    name: "setup-done",
    group: "Board",
    brief: [["setup-done <step>", "tick one setup step; the tick that closes the last one ends\nsetup"]],
    legacy: [
      [
        "setup-done <step>",
        [
          "tick one box on docs/kanban/setup-checklist.md as that setup",
          "step finishes: install, config, goal, decisions, modules,",
          "tasks. The tick that closes the last box deletes the file, so",
          "a board without it is a board that is set up."
        ]
      ]
    ]
  },
  {
    name: "setup-status",
    group: "Board",
    brief: [["setup-status", "how far setup got and what comes next"]],
    legacy: [
      [
        "setup-status",
        ["how far setup got, and which step comes next. Says setup is", "finished when there is no checklist."]
      ]
    ]
  },
  {
    name: "create",
    group: "Cards",
    brief: [
      ["create [--count N]", "take N ids (default 1) and print them"],
      [
        "create --title T --track K",
        "write one card \u2014 its fields, a body template, its index\nentry. Options: --priority, --roi, --release, --blocked-by,\n--related, --modules, --question, --slug, --cadence, --no-body"
      ]
    ],
    legacy: [
      ["create [--count N]", ["allocate N task ids (default 1), advance next-id, print them"]],
      [
        "create --title T --track K [opts]",
        [
          "scaffold ONE card: write its frontmatter + a body template, index it.",
          "opts: --priority high|med|low (default med), --roi high|med|low",
          "(default med), --release v1 (default none \u2014 the card is wanted,",
          "not promised to a version; free text, kept as typed),",
          "--blocked-by 1,2, --related 3, --modules skill,site",
          '(validated against modules.md), --question "..." (repeatable),',
          '--slug my-slug, --no-body, --cadence "1d at 09:30"',
          "(--track recurring only \u2014 see update below).",
          "The script owns the frontmatter \u2014 fill only the body by hand.",
          "A question the user picks from carries its choices: follow its",
          '--question with one --option "a \u2014 why" per choice (2+), and',
          "--mode single|multi (default single) for how many may be",
          "ticked. The choice you recommend is declared by",
          '--recommended-option "c \u2014 why" instead of --option \u2014 it joins',
          "the same list and opens ticked, so it's written once. Without",
          "any option the question stays a plain line with a text box."
        ]
      ]
    ]
  },
  {
    name: "update",
    group: "Cards",
    brief: [
      [
        "update <id>",
        "rewrite a card's fields: --title, --priority, --roi,\n--status, --release, --blocked-by, --related, --modules,\n--cadence, --track (moves it), --slug (renames it)"
      ]
    ],
    legacy: [
      [
        "update <id> [opts]",
        [
          "rewrite a card's frontmatter fields: --title, --priority,",
          "--roi, --status todo|ready|implementing, --release,",
          '--blocked-by, --related, --modules, --cadence. --release ""',
          "(an empty value) takes the card back out of a release.",
          "--cadence sets how often a recurring card repeats \u2014 30m, 6h,",
          "7d, or 1d at 09:30 (a time of day only with whole days).",
          'Recurring cards only; --cadence "" clears it and the card',
          "runs by hand again.",
          "--track moves the card + fixes the index; --slug renames",
          "it. Body and questions are left untouched \u2014 questions have",
          "their own command below."
        ]
      ]
    ]
  },
  {
    name: "update-questions",
    group: "Cards",
    brief: [
      [
        "update-questions <id>",
        "patch the open questions one op at a time: --append,\n--update <n>, --drop <n,n>, --clear"
      ]
    ],
    legacy: [
      [
        "update-questions <id> [ops]",
        [
          "patch the open-question list, one op at a time, applied in",
          'the order typed: --append ".." adds a question, --update',
          '<n> ".." rewrites question n whole (options included),',
          "--drop n[,n...] removes answered ones, --clear removes",
          "them all. Positions are 1-based, read against the list as",
          "it stands when the op runs. --option / --mode /",
          "--recommended-option attach to the --append or --update",
          "before them, same as create's --question. A question may",
          "carry a leading [user] tag marking it as the human's",
          "judgment call."
        ]
      ]
    ]
  },
  {
    name: "tag",
    group: "Cards",
    brief: [["tag <id> <n[,n...]> <tag>", "mark a question as the human's call, or clear the mark"]],
    legacy: [
      [
        "tag <id> <n[,n...]> <t>",
        [
          "set the tag on one or more open questions (1-based, e.g.",
          "1 or 1,2,3): user | none (none strips it). Used by the",
          "auto-refine loop to hand questions to the human without",
          "rewriting the list."
        ],
        { inline: true }
      ]
    ]
  },
  {
    name: "list",
    group: "Cards",
    brief: [["list [--module <m>]", "the open cards: id, title, meta, summary, path"]],
    legacy: [
      [
        "list [--module <m>]",
        [
          "the open cards at a glance \u2014 one block per card with its id,",
          "title, meta (track, status, priority, roi, release, blockers,",
          "open questions), summary line and file path. --module <m>",
          "narrows it to the cards tagged with that module (validated",
          "against modules.md)."
        ]
      ]
    ]
  },
  {
    name: "release",
    group: "Releases",
    brief: [
      [
        "release new <id>",
        `add a release, last in ship order. --goal ".." says what it
is for; --fill puts today's unblocked high-priority cards in`
      ],
      ['release goal <id> ".."', 'change what a release is for; "" clears it'],
      ["release list", "the releases in ship order, with their open and ready counts"],
      [
        "release close <id>",
        "the version shipped: write its summary, clear it off the\ncards still open, take it off the list"
      ],
      ["release drop <id>", "the version will not ship: clear it off, no summary"]
    ],
    legacy: [
      [
        "release new <id>",
        [
          "add a release to the end of docs/kanban/releases.md (the open",
          "releases, in the order they ship). A version id is free text",
          "(v1, 0.5.0, august), kept as typed, and has to work as a",
          "filename \u2014 letters, numbers, dot, dash, underscore. Refused: an",
          "empty id and one already on the list.",
          `--goal ".." says what the version is for, in the user's own words.`,
          "It is kept on the release's own line, folded to one line whatever",
          "was typed, and is never required \u2014 a release with no goal works",
          "everywhere a release with one does.",
          "--fill puts the high-priority cards with no release in as the",
          "release is made: a card goes in when its priority is high,",
          "nothing open is blocking it, and it is not a group root \u2014",
          "nothing else is looked at, and a card already in a release",
          "stays where it is. One line per card moved; a high-priority",
          "card left behind is named with the test it failed."
        ]
      ],
      [
        'release goal <id> ".."',
        ["change what a release is for, after it was made. An empty goal", '("") clears it.']
      ],
      [
        "release list",
        [
          "the releases in ship order, each with what it is for, how many open",
          "cards name it and how many of those are ready to build; the cards in",
          "no release are counted last. Names any card pointing at a release",
          "that is not on the list."
        ]
      ],
      [
        "release close <id>",
        [
          "the version shipped: write what it held to",
          "docs/kanban/.release-summaries/<id>.md (what shipped, from the",
          "archived cards naming it; what didn't, from the open ones), clear",
          "the release off every card still open in it, and take its line off",
          "the list. Always allowed, whatever is still open. There is no",
          "second run \u2014 afterwards the id is unknown and no card names it.",
          "A card with every todo ticked but never archived counts as not",
          "shipped; the close names it so you can archive it and fix that",
          "one line by hand."
        ]
      ],
      [
        "release drop <id>",
        [
          "the version will not ship: report the cards archived under it and",
          "the open ones sent back, clear the release off every open card in",
          "it, and take its line off the list. Writes no summary file or",
          "section; an existing summary for a reused id is left untouched."
        ]
      ]
    ]
  },
  {
    name: "migrate",
    group: "Board",
    brief: [["migrate [--dry-run]", "convert cards written before frontmatter"]],
    legacy: [
      [
        "migrate [--dry-run]",
        [
          "convert old bold-header cards to frontmatter; missing meta falls",
          "back to empty / med. Skips cards that already have frontmatter."
        ]
      ]
    ]
  },
  {
    name: "archive",
    group: "Cards",
    brief: [
      ["archive <id>", "finish a card: file to .archive/, out of the index, off\nevery other card's links"]
    ],
    legacy: [
      [
        "archive <id>",
        [
          "finish task <id>: move its file/folder into docs/kanban/.archive/,",
          "strip its README entry, drop the id from every other card's",
          "blocked_by/related, count completed"
        ]
      ]
    ]
  },
  {
    name: "reject",
    group: "Cards",
    brief: [["reject <id>", "drop a card: delete it, same clean-up, counted as rejected"]],
    legacy: [
      [
        "reject  <id>",
        [
          "reject task <id>: same, but delete the file/folder, count rejected.",
          "Deleting is final \u2014 the receipt prints the card so its note can",
          "still be written from its own words.",
          "Both end with a handoff: which memory file the note goes in (and",
          "its topics), and every line elsewhere that still mentions the id.",
          "Read that instead of grepping \u2014 a bare id also matches dates."
        ]
      ]
    ]
  },
  {
    name: "record-run",
    aliases: ["run"],
    group: "Cards",
    brief: [["record-run <id>", "count one run of a recurring card and keep the card"]],
    legacy: [
      [
        "run     <id>",
        ["record one run of recurring task <id>: +1 completed, card kept (no archive)"]
      ]
    ]
  },
  {
    name: "peek",
    group: "Board",
    brief: [["peek", "the next free id, without taking it"]],
    legacy: [["peek", ["print the current next-id (no bump)"]]]
  },
  {
    name: "version",
    group: null,
    // `akb version` already prints it, so it is not one of the board's moves
    brief: [],
    legacy: [["version", ["print the installed skill version (+ source stamp if present)"]]]
  },
  {
    name: "metrics",
    group: "Board",
    brief: [["metrics", "print metrics.csv"]],
    legacy: [["metrics", ["print docs/kanban/metrics.csv"]]]
  },
  {
    name: "help",
    group: "Board",
    brief: [["help [<move>]", "this list, or one move in full"]],
    legacy: [["help", ["show this"]]]
  }
];
var MOVE_NAMES = MOVES.flatMap((m) => [m.name, ...m.aliases || []]);
var findMove = (name) => MOVES.find((m) => m.name === name || (m.aliases || []).includes(name)) || null;
var BRIEF_COL = 32;
function briefLines(move) {
  const out = [];
  for (const [label, text4] of move.brief) {
    const [first, ...rest] = String(text4).split("\n");
    out.push(`  ${label.padEnd(BRIEF_COL - 2)}${first}`);
    for (const line2 of rest) out.push(`${" ".repeat(BRIEF_COL)}${line2}`);
  }
  return out;
}
function boardHelp(program) {
  const out = [
    `${program} \u2014 the board's bookkeeping. The agent calls these between runs; a person`,
    "never has to type one.",
    "",
    `Usage: ${program} <move> [args] [options]`
  ];
  for (const group of GROUPS) {
    out.push("", group);
    for (const move of MOVES.filter((m) => m.group === group)) out.push(...briefLines(move));
  }
  out.push(
    "",
    "Options \u2014 any move takes these",
    `  ${"--dir <path>".padEnd(BRIEF_COL - 2)}the project to work on. Default: the nearest board at or`,
    `${" ".repeat(BRIEF_COL)}above the folder you ran in`,
    `  ${"--json".padEnd(BRIEF_COL - 2)}answer as one JSON object instead of prose`,
    "",
    "Never edit next-id or metrics.csv by hand, and never hand-write a card's fields \u2014 these",
    "moves own them. Write and edit only a card's body."
  );
  return out.join("\n");
}
function moveHelp(move, program) {
  const out = [];
  for (const [label, detail] of move.legacy) {
    out.push(`${program} ${label.replace(/\s{2,}/g, " ")}`);
    for (const line2 of detail) out.push(`  ${line2}`);
    out.push("");
  }
  if (move.aliases?.length) out.push(`also spelled: ${move.aliases.join(", ")}`, "");
  return out.join("\n").trimEnd();
}
var LEGACY_COL = 23;
function legacyLines(move) {
  const out = [];
  for (const [label, detail, opts] of move.legacy) {
    const head = `  ${label}`;
    if (head.length + 1 <= LEGACY_COL || opts?.inline) {
      const gap = head.length + 1 <= LEGACY_COL ? " ".repeat(LEGACY_COL - head.length) : "  ";
      out.push(`${head}${gap}${detail[0]}`);
      for (const line2 of detail.slice(1)) out.push(`${" ".repeat(LEGACY_COL)}${line2}`);
    } else {
      out.push(head);
      for (const line2 of detail) out.push(`${" ".repeat(LEGACY_COL)}${line2}`);
    }
  }
  return out;
}
var LEGACY_ORDER = [
  "init",
  "memory-init",
  "setup-done",
  "setup-status",
  "create",
  "update",
  "update-questions",
  "list",
  "release",
  "tag",
  "migrate",
  "archive",
  "reject",
  "record-run",
  "peek",
  "version",
  "metrics",
  "help"
];
function legacyHelp(usage) {
  const out = ["kanban \u2014 the only sanctioned writer of docs/kanban/next-id.", "", `Usage: ${usage}`, ""];
  for (const name of LEGACY_ORDER) out.push(...legacyLines(findMove(name)));
  out.push(
    "",
    "Never edit next-id or metrics.csv by hand \u2014 let the script write them. Never hand-write a",
    "card's frontmatter \u2014 use create/update/update-questions. Write/Edit are only for the card body."
  );
  return out.join("\n");
}

// src/commands/init.ts
init_paths();
init_io();
init_lock();
init_sessions();
init_goal();
init_validate();
init_releases();
import fs18 from "node:fs";
import path16 from "node:path";

// src/lib/memory.ts
init_paths();
init_validate();
import fs16 from "node:fs";
import path14 from "node:path";
var MEMORY_SET = {
  "readme.md": `# Shipped

User-facing work that has shipped, one line each \u2014 a link to the published doc that
covers it, or a plain-words note.

_(nothing recorded yet \u2014 the first finished task fills it in.)_
`,
  "decisions.md": `# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning \u2014 what a user can see, do, or would care about.
Internal detail stays on the card.
`,
  "redesign.md": `# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.
`,
  "rejected.md": `# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.
`
};
var PROJECT_MEMORY_SET = {
  ...MEMORY_SET,
  "goal.md": `---
reviewed: weak
---
`
};
function scaffoldMemoryPath(module) {
  return scaffoldMemoryDir(path14.join(MEMORY, module), MEMORY_SET);
}
function scaffoldProjectMemory() {
  return scaffoldMemoryDir(MEMORY, PROJECT_MEMORY_SET);
}
function scaffoldMemoryDir(dir, set) {
  const existed = fs16.existsSync(dir);
  fs16.mkdirSync(dir, { recursive: true });
  const made = [];
  for (const [name, body] of Object.entries(set)) {
    const file = path14.join(dir, name);
    if (!fs16.existsSync(file)) {
      fs16.writeFileSync(file, body);
      made.push(name);
    }
  }
  if (!existed) return { dir, made, fresh: true };
  return made.length ? { dir, made, fresh: false } : null;
}
function memoryTargets(modules, fileName) {
  const named = modules.filter((m) => {
    if (MODULE_NAME_RE.test(m)) return true;
    warn2(`card names module "${m}", which isn't a usable folder name \u2014 skipping its memory path`);
    return false;
  });
  const dirs = named.length ? named.map((m) => path14.join(MEMORY, m)) : [null];
  return dirs.map((dir) => {
    if (dir === null) scaffoldProjectMemory();
    else scaffoldMemoryPath(path14.basename(dir));
    const file = path14.join(dir ?? MEMORY, fileName);
    return { file, topics: readTopics(file) };
  });
}
function readTopics(file) {
  if (!fs16.existsSync(file)) return [];
  const topics = [];
  let current = null;
  for (const line2 of fs16.readFileSync(file, "utf8").split("\n")) {
    const heading = line2.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = { name: heading[1], entries: 0 };
      topics.push(current);
    } else if (current && /^\s*[-*] /.test(line2)) {
      current.entries++;
    }
  }
  return topics;
}

// src/commands/init.ts
init_recurring();
init_setup();
var DEFAULT_TRACKS = ["feature", "bug", "research"];
var MODULES_TEMPLATE = `# Modules

What this project is made of \u2014 one line per module, each led by its **bolded name**, then
what it is and the paths it covers. A module is a part of the product that grows on its
own, judged by meaning, not by folder.

If a line here disagrees with the repo you just read, fix the line.

_(not filled in yet \u2014 build the map from the repo before tagging a card.)_
`;
function boardReadme(tracks) {
  const sections = ["## Blockers", "", "_(none)_", ""];
  for (const t of tracks) sections.push(`## ${t}`, "", "_(none)_", "");
  return `# Board

Open tasks for the kanban board. One card per file. Ids are global and never reused \u2014
the number at the front of a filename is the task id.

Blockers gate the next milestone; clear them first. Everything else sits under a track.

${sections.join("\n")}`;
}
function writeConfigIfMissing() {
  if (fs18.existsSync(CONFIG)) return false;
  const template = path16.join(SKILL_DIR, "config.md");
  if (!fs18.existsSync(template)) die(`missing config template at ${template}`);
  fs18.mkdirSync(KANBAN, { recursive: true });
  fs18.copyFileSync(template, CONFIG);
  return true;
}
function writeModulesIfMissing() {
  if (fs18.existsSync(MODULES_MD)) return false;
  fs18.mkdirSync(KANBAN, { recursive: true });
  fs18.writeFileSync(MODULES_MD, MODULES_TEMPLATE);
  return true;
}
var IGNORE_RULES = [
  { line: ".env", comment: "# The board's API keys \u2014 never commit them." },
  { line: LOCK_IGNORE_LINE, comment: "# The write lock, held for as long as one command takes." },
  ...RUN_IGNORE_LINES
];
function writeGitignoreIfMissing() {
  fs18.mkdirSync(KANBAN, { recursive: true });
  const text4 = fs18.existsSync(KANBAN_GITIGNORE) ? fs18.readFileSync(KANBAN_GITIGNORE, "utf8") : "";
  const has = (rule) => text4.split("\n").some((line2) => line2.trim() === rule.line);
  const missing = IGNORE_RULES.filter((rule) => !has(rule));
  if (!missing.length) return false;
  const block2 = missing.map((rule) => `${rule.comment}
${rule.line}
`).join("");
  const separator = !text4 || text4.endsWith("\n") ? "" : "\n";
  fs18.writeFileSync(KANBAN_GITIGNORE, `${text4}${separator}${block2}`);
  return true;
}
function writeSkeletonIfMissing(tracks) {
  const added = [];
  if (!fs18.existsSync(TODO)) {
    fs18.mkdirSync(path16.join(TODO, "blockers"), { recursive: true });
    for (const t of tracks) fs18.mkdirSync(path16.join(TODO, t), { recursive: true });
    added.push(`${rel(TODO)}/`);
  }
  if (!fs18.existsSync(README)) {
    fs18.writeFileSync(README, boardReadme(tracks));
    added.push(rel(README));
  }
  if (!fs18.existsSync(NEXT_ID)) {
    writeNextId(1);
    added.push(rel(NEXT_ID));
  }
  return added;
}
function cmdInit(args) {
  const tracks = args.length ? args : DEFAULT_TRACKS;
  for (const t of tracks) {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(t)) {
      die(`bad track name "${t}" \u2014 use letters, digits, and dashes (a folder name)`);
    }
  }
  if (fs18.existsSync(KANBAN)) {
    const added = [
      ...writeSkeletonIfMissing(tracks),
      writeConfigIfMissing() && rel(CONFIG),
      writeModulesIfMissing() && rel(MODULES_MD),
      writeReleasesIfMissing() && rel(RELEASES),
      writeGitignoreIfMissing() && rel(KANBAN_GITIGNORE)
    ].filter(Boolean);
    if (setupUnfinished() && !findSetupQuestionsCard()) {
      const track = tracks.find((t) => fs18.existsSync(path16.join(TODO, t))) || tracks[0];
      fs18.mkdirSync(path16.join(TODO, track), { recursive: true });
      const card = writeSetupQuestionsCard(track);
      if (card) added.push(rel(card.file));
    }
    const scaffolded = [];
    const project = scaffoldProjectMemory();
    if (project) scaffolded.push(project);
    for (const m of moduleNames() || []) {
      if (!MODULE_NAME_RE.test(m)) {
        warn2(`skipping module "${m}" \u2014 a name needs letters, digits, and dashes to be a folder`);
        continue;
      }
      const done = scaffoldMemoryPath(m);
      if (done) scaffolded.push(done);
    }
    const goalRepaired = repairGoal();
    say(
      added.length ? `board already exists at ${rel(KANBAN)}/ \u2014 added the missing ${added.join(", ")} (safe to re-run)` : `board already exists at ${rel(KANBAN)}/ \u2014 ${scaffolded.length || goalRepaired ? "board files all present" : "nothing to do"} (safe to re-run)`
    );
    for (const s of scaffolded) say(`  memory path ${rel(s.dir)}/ \u2014 ${s.fresh ? "created" : `added ${s.made.join(", ")}`}`);
    if (goalRepaired) say(`  ${rel(GOAL)}: ${goalRepaired} \u2014 the agent judges the goal and edits the field`);
    if (added.includes(rel(MODULES_MD))) {
      say(`  next: fill in ${rel(MODULES_MD)} (see "The module map"), then re-run init for the memory paths`);
    }
    return { board: rel(KANBAN), created: false, added, memory_paths: scaffolded.map((s) => rel(s.dir)) };
  }
  fs18.mkdirSync(path16.join(TODO, "blockers"), { recursive: true });
  for (const t of tracks) fs18.mkdirSync(path16.join(TODO, t), { recursive: true });
  fs18.writeFileSync(README, boardReadme(tracks));
  scaffoldProjectMemory();
  writeConfigIfMissing();
  writeModulesIfMissing();
  writeReleasesIfMissing();
  writeGitignoreIfMissing();
  writeNextId(1);
  writeSetupChecklist();
  const questionsCard = writeSetupQuestionsCard(tracks[0]);
  const pruneCard = writePruneMemoryCard();
  say(`initialised board at ${rel(KANBAN)}/`);
  say(`  tracks: ${tracks.join(", ")}`);
  say(`  setup's remaining steps are in ${rel(SETUP_CHECKLIST)} \u2014 \`setup-done <step>\` ticks one`);
  if (questionsCard) say(`  questions card: #${questionsCard.id} \u2014 setup appends the calls it can't settle here`);
  if (pruneCard) say(`  recurring card: #${pruneCard.id} ${rel(pruneCard.file)} \u2014 prunes the memory; runs only when you run it`);
  const next = nextSetupStep();
  if (next) say(`  next: \`${next.name}\` (${next.owner}) \u2014 ${next.text}`);
  return { board: rel(KANBAN), created: true, tracks, next: next?.name ?? null };
}
function cmdMemoryInit(module) {
  if (!module) die("memory-init needs a module name (its bolded name in modules.md)");
  if (!MODULE_NAME_RE.test(module)) {
    die(`bad module name "${module}" \u2014 use letters, digits, and dashes (a folder name)`, {
      kind: "bad-module-name",
      module
    });
  }
  const done = scaffoldMemoryPath(module);
  if (!done) say(`${rel(path16.join(MEMORY, module))}/ already has the full set \u2014 nothing to do`);
  else if (done.fresh) say(`created memory path ${rel(done.dir)}/ with the four-file set`);
  else say(`filled in missing files in ${rel(done.dir)}/: ${done.made.join(", ")}`);
  return { module, dir: rel(done ? done.dir : path16.join(MEMORY, module)), made: done ? done.made : [] };
}
function repairGoal() {
  if (!fs18.existsSync(GOAL)) return null;
  const text4 = fs18.readFileSync(GOAL, "utf8");
  const { body, seeded, written } = readGoalBody(text4);
  const current = readGoalReviewFrom(text4);
  const value = written ? current === "good" || current === "strong" ? current : "pending" : "weak";
  if (!seeded && value === current) return null;
  const kept = seeded ? text4.slice(0, text4.length - body.length) : text4;
  fs18.writeFileSync(GOAL, writeGoalReviewInto(kept, value));
  if (seeded) return "cleared the seeded text \u2014 the goal starts empty, in the user's own words";
  return `set \`reviewed: ${value}\``;
}

// src/lib/board-cli.ts
init_card();

// src/commands/remove.ts
init_paths();
init_io();
init_metrics();
init_cards();
init_readme();
init_frontmatter();
import fs19 from "node:fs";
import path17 from "node:path";
var REF_LIST = /^(blocked_by|related):\s*\[(.*)\]\s*$/;
function dropCrossRefs(id) {
  const touched = [];
  for (const file of walkMd(TODO)) {
    if (path17.basename(file) === "README.md") continue;
    const lines = fs19.readFileSync(file, "utf8").split("\n");
    if (lines[0].trim() !== "---") continue;
    let end = 1;
    while (end < lines.length && lines[end].trim() !== "---") end++;
    if (end >= lines.length) continue;
    const fields = [];
    for (let i = 1; i < end; i++) {
      const m = lines[i].match(REF_LIST);
      if (!m) continue;
      const refs = m[2].split(",").map((s) => s.trim()).filter(Boolean);
      const kept = refs.filter((s) => Number(s.replace(/^#/, "")) !== id);
      if (kept.length === refs.length) continue;
      lines[i] = `${m[1]}: [${kept.join(", ")}]`;
      fields.push(m[1]);
    }
    if (!fields.length) continue;
    fs19.writeFileSync(file, lines.join("\n"));
    touched.push(`${path17.relative(TODO, file).split(path17.sep).join("/")} (${fields.join(", ")})`);
  }
  return touched;
}
function findMentions(id) {
  const hits = [];
  const re = new RegExp(`#${id}(?!\\d)`);
  for (const dir of [TODO, MEMORY]) {
    if (!fs19.existsSync(dir)) continue;
    for (const file of walkMd(dir)) {
      if (path17.basename(file) === "README.md") continue;
      const lines = fs19.readFileSync(file, "utf8").split("\n");
      const fmEnd = frontmatterEnd(lines);
      lines.forEach((line2, i) => {
        if (!re.test(line2)) return;
        hits.push({
          file,
          line: i + 1,
          where: i < fmEnd ? frontmatterField(lines, i) : "body",
          text: line2.trim()
        });
      });
    }
  }
  return hits;
}
function cmdRemove(id, metric) {
  if (!Number.isInteger(id)) die("need a numeric task id");
  const found = locate(id);
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: "card-not-found", id });
  const dest = metric === "completed" ? archiveDest(found) : null;
  const cardFile = found.kind === "group" ? path17.join(found.target, "root.md") : found.target;
  const cardText = fs19.existsSync(cardFile) ? fs19.readFileSync(cardFile, "utf8") : "";
  const cardMeta = parseFrontmatter(cardText).meta;
  const alsoRemoved = found.kind === "group" ? walkMd(found.target).filter((f) => f !== cardFile).map((f) => rel(f)).sort() : [];
  const removedRefs = stripReadmeRefs(found);
  const groupRoot = found.kind === "file" ? enclosingGroupRoot(found.target) : null;
  let marked = null;
  if (groupRoot) {
    const action = metric === "completed" ? "tick" : "strike";
    if (markSubtask(groupRoot, id, action)) marked = action;
    else warn2(`#${id} isn't listed in ${rel(groupRoot)} ## Todo \u2014 nothing to ${action === "tick" ? "tick off" : "strike out"}.`);
  }
  if (dest) {
    fs19.mkdirSync(ARCHIVE, { recursive: true });
    fs19.renameSync(found.target, dest);
  } else if (found.kind === "group") {
    fs19.rmSync(found.target, { recursive: true, force: true });
  } else {
    fs19.rmSync(found.target);
  }
  const unlinked = dropCrossRefs(id);
  bumpMetric(metric);
  const what = found.kind === "group" ? `folder ${found.rel}/` : `file ${found.rel}`;
  if (dest) say(`archived #${id}: moved ${what} \u2192 ${rel(dest)}${found.kind === "group" ? "/" : ""}`);
  else say(`rejected #${id}: removed ${what}`);
  if (removedRefs.length) say(`  dropped ${removedRefs.length} README ${removedRefs.length === 1 ? "entry" : "entries"}`);
  else say("  no README entry (subtask or untracked)");
  if (marked) say(`  ${marked === "tick" ? "ticked" : "struck"} #${id} in ${rel(groupRoot)}`);
  for (const card of unlinked) say(`  unlinked #${id} from ${card}`);
  const mentions = findMentions(id);
  const note = printHandoff(id, metric, cardMeta, mentions);
  if (!dest) printEpitaph(id, rel(cardFile), cardText, alsoRemoved);
  return {
    id,
    action: metric === "completed" ? "archived" : "rejected",
    card: found.rel,
    archived_to: dest ? rel(dest) : null,
    unlinked,
    also_removed: alsoRemoved,
    // What the caller still has to do by hand: write the note, rewrite the sentences.
    note,
    mentions: mentions.map((m) => ({ file: rel(m.file), line: m.line, where: m.where, text: m.text }))
  };
}
var NOTE_KIND = {
  completed: { file: "readme.md", what: "record the shipped work", section: "Finish a task", topics: false },
  rejected: { file: "rejected.md", what: "write the rejection note", section: "Reject an idea", topics: true }
};
function quoteLine(text4, width = 96) {
  if (text4.length <= width) return text4;
  const cut = text4.slice(0, width);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > width / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}\u2026`;
}
function printHandoff(id, metric, meta, mentions) {
  const kind = NOTE_KIND[metric];
  const targets = memoryTargets(meta?.modules ?? [], kind.file);
  say(`
next \u2014 what the script can't do:
`);
  say(`  1. ${kind.what} \u2014 follow "${kind.section}" in the skill`);
  for (const t of targets) {
    say(`       file    ${rel(t.file)}`);
    if (!kind.topics) continue;
    const topics = t.topics.map((x) => `"${x.name}" (${x.entries})`).join(", ");
    say(`       topics  ${topics || "(none yet \u2014 this note starts the first one)"}`);
  }
  if (targets.length > 1) {
    say("       both, because the card named two modules \u2014 one note each, in its own words");
  }
  const note = { what: kind.what, files: targets.map((t) => rel(t.file)) };
  if (!mentions.length) {
    say(`
  2. nothing \u2014 no other card or note mentions #${id}, so there is nothing to rewrite`);
    return note;
  }
  const n = mentions.length;
  say(`
  2. rewrite ${n} mention${n > 1 ? "s" : ""} of #${id} \u2014 each line below now points at a card that isn't there:`);
  for (const m of mentions) {
    say(`       ${rel(m.file)}:${m.line}  (${m.where})`);
    say(`         ${quoteLine(m.text)}`);
  }
  if (mentions.some((m) => m.where !== "body")) {
    say("     A mention in frontmatter is the script's to rewrite, not yours:");
    say('     `update-questions <id> --update <n> "..."` (see help).');
  }
  return note;
}
var EPITAPH_MAX_LINES = 200;
function printEpitaph(id, relPath, text4, alsoRemoved) {
  const lines = text4.replace(/\s+$/, "").split("\n");
  const shown = lines.slice(0, EPITAPH_MAX_LINES);
  say(`
#${id} as it was \u2014 the file is gone, so this is the last copy outside git history:
`);
  say(`  ,-- ${relPath}`);
  for (const line2 of shown) say(`  | ${line2}`);
  if (lines.length > shown.length) {
    say(`  | ... ${lines.length - shown.length} more line(s) \u2014 \`git show HEAD:${relPath}\` for the rest`);
  }
  say("  `--");
  if (alsoRemoved.length) {
    say(`
  the folder took ${alsoRemoved.length} subtask card(s) with it:`);
    for (const f of alsoRemoved) say(`    ${f}`);
    say("    (in git history \u2014 `git show HEAD:<path>`)");
  }
}

// src/lib/board-cli.ts
init_misc();

// src/commands/list.ts
init_paths();
init_io();
init_validate();
init_frontmatter();
init_cards();
import fs20 from "node:fs";
import path18 from "node:path";
var plural2 = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
function summaryLine(body) {
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length && (!lines[i].trim() || lines[i].trim().startsWith("#"))) i++;
  const para = [];
  while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#")) {
    para.push(lines[i].trim());
    i++;
  }
  const text4 = para.join(" ");
  return text4.length > 240 ? text4.slice(0, 240).replace(/\s+\S*$/, "") + " \u2026" : text4;
}
function openRows() {
  const rows = [];
  for (const file of walkMd(TODO)) {
    const base = path18.basename(file);
    if (base === "README.md") continue;
    const isRoot = base === "root.md";
    const id = isRoot ? idPrefix(path18.basename(path18.dirname(file))) : idPrefix(base);
    if (id == null) continue;
    const { meta, body } = parseFrontmatter(fs20.readFileSync(file, "utf8"));
    rows.push({
      id,
      file,
      isRoot,
      title: meta && meta.title || base.replace(/^\d+-/, "").replace(/\.md$/, ""),
      track: meta && meta.track || path18.relative(TODO, file).split(path18.sep)[0],
      status: meta && meta.status || "todo",
      priority: meta && meta.priority || "med",
      roi: meta && meta.roi || "med",
      release: meta && meta.release || "",
      blocked_by: meta && meta.blocked_by || [],
      modules: meta && meta.modules || [],
      cadence: meta && meta.cadence || "",
      questions: meta && meta.questions || [],
      summary: summaryLine(body)
    });
  }
  return rows.sort((a, b) => a.id - b.id);
}
function cmdList(args) {
  const { flags, positional } = parseFlags(args, ["module"]);
  if (positional.length) die(`list takes options, not positional args (got "${positional.join(" ")}")`);
  let rows = openRows();
  let scope = "on the board";
  const mod = flags.module;
  if (mod !== void 0) {
    if (mod === true) die("--module needs a module name, e.g. `list --module skill`");
    const known = moduleNames();
    if (known === null) die(`no ${rel(MODULES_MD)} yet \u2014 the board has no module map to filter by`);
    if (!known.includes(mod)) {
      die(`unknown module "${mod}". known modules: ${known.join(", ") || "(none)"}`);
    }
    rows = rows.filter((r) => r.modules.includes(mod));
    scope = `tagged \`${mod}\``;
  }
  const cards = rows.map((r) => ({ ...r, file: rel(r.file) }));
  if (!rows.length) {
    say(`no open cards ${scope}.`);
    return { cards, module: mod === void 0 ? null : mod };
  }
  say(`${plural2(rows.length, "open card")} ${scope}:`);
  for (const r of rows) {
    const meta = [r.track, r.status, `priority ${r.priority}`, `roi ${r.roi}`];
    if (r.isRoot) meta.push("group root");
    if (r.release) meta.push(`release ${r.release}`);
    if (r.cadence) meta.push(`every ${r.cadence}`);
    if (r.blocked_by.length) meta.push(`blocked by ${r.blocked_by.map((n) => `#${n}`).join(", ")}`);
    if (r.questions.length) meta.push(plural2(r.questions.length, "open question"));
    say("");
    say(`#${r.id} ${r.title}  (${rel(r.file)})`);
    say(`    ${meta.join(" \xB7 ")}`);
    if (r.summary) say(`    ${r.summary}`);
  }
  return { cards, module: mod === void 0 ? null : mod };
}

// src/commands/release.ts
init_paths();
init_io();
init_validate();
init_releases();
var USAGE = `usage:
  release new <id> [--goal ".."] [--fill]
                             add a release to the end of the list (e.g. \`release new v1\`);
                             --goal says what the version is for; --fill puts the
                             high-priority cards with no release in as it is made
  release goal <id> "..."    change what a release is for ("" clears it)
  release list               the releases in ship order, with what each one holds
  release close <id>         the version shipped: write the summary, clear the release off the rest
  release drop <id>          the version will not ship: take it off the list with no shipped
                             record, clear the release off its open cards`;
var plural3 = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
function cmdRelease(args) {
  const [sub, ...rest] = args;
  if (sub === "new") return releaseNew(rest);
  if (sub === "goal") return releaseGoalCmd(rest);
  if (sub === "list") return releaseList();
  if (sub === "close") return releaseClose(rest);
  if (sub === "drop") return releaseDrop(rest);
  if (sub === void 0) die(USAGE, { kind: "usage", bare: true });
  die(`unknown release command "${sub}".
${USAGE}`, { kind: "unknown-release-command", command: sub });
}
function releaseNew(rest) {
  const fill = rest.includes("--fill");
  let goal = "";
  const ids = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--fill") continue;
    if (rest[i] === "--goal") {
      if (i + 1 >= rest.length) die('--goal needs the goal after it, e.g. `release new v1 --goal "..."`');
      goal = rest[++i];
      continue;
    }
    ids.push(rest[i]);
  }
  if (ids.length > 1) die(`release new takes one version id (got "${ids.join(" ")}") \u2014 quote it if it has spaces`);
  const id = addRelease(ids[0], goal);
  const known = readReleases();
  say(`added release ${id} to ${rel(RELEASES)}`);
  say(`  ship order: ${known.join(" \u2192 ")}`);
  if (goal.trim()) say(`  for: ${goal.replace(/\s+/g, " ").trim()}`);
  else say(`  say what it is for with \`release goal ${quoteId(id)} "..."\``);
  if (!fill) {
    say(`  put a card in it with \`update <id> --release ${quoteId(id)}\``);
    return { release: id, goal: goal.trim(), ship_order: known, filled: [] };
  }
  const { fill: moved, skipped } = fillRelease(id);
  const answer2 = { release: id, goal: goal.trim(), ship_order: known, filled: moved, left: skipped };
  if (!moved.length && !skipped.length) {
    say("  no card without a release is high priority \u2014 the release starts empty");
    return answer2;
  }
  for (const card of moved) say(`  in    #${card.id} ${card.title}`);
  for (const card of skipped) say(`  left  #${card.id} ${card.title} \u2014 ${card.reason}`);
  return answer2;
}
function releaseGoalCmd(rest) {
  const [id, ...words] = rest;
  if (!id) die('release goal needs a version id and the goal, e.g. `release goal v1 "the first version worth showing someone"`');
  if (!words.length) {
    die(
      `release goal needs the goal after the version id, e.g. \`release goal ${quoteId(id)} "..."\` \u2014 \`release goal ${quoteId(id)} ""\` clears it.`
    );
  }
  if (words.length > 1) die(`release goal takes one goal (got ${words.length} words) \u2014 quote it: \`release goal ${quoteId(id)} "..."\``);
  const { goal } = setReleaseGoal(id, words[0]);
  if (goal) say(`${id} is for: ${goal}`);
  else say(`${id} now says what it is for nowhere \u2014 its goal is cleared`);
  say(`  ${rel(RELEASES)}`);
  return { release: id, goal };
}
function releaseClose(rest) {
  if (rest.length > 1) die(`release close takes one version id (got "${rest.join(" ")}") \u2014 quote it if it has spaces`);
  const { id, shipped, left, summary, remaining } = closeRelease(rest[0]);
  say(`closed release ${id} \u2014 its line is off ${rel(RELEASES)}`);
  say(`  shipped      ${plural3(shipped.length, "card")}${shipped.length ? `: ${shipped.map((c) => `#${c.id}`).join(", ")}` : ""}`);
  say(
    `  no release   ${plural3(left.length, "card")} still open${left.length ? `: ${left.map((c) => `#${c.id}`).join(", ")}` : ""}`
  );
  say(`  summary      ${rel(summary)}`);
  say(`  ship order: ${remaining.join(" \u2192 ") || "(no releases left)"}`);
  const looksDone = left.filter((c) => c.done);
  if (looksDone.length) {
    say("");
    say(`${plural3(looksDone.length, "card")} had every todo ticked but was never archived, so it counts as not shipped:`);
    for (const card of looksDone) say(`  #${card.id} ${card.title}`);
    say(`  archive the ones that really shipped, then move their line by hand in ${rel(summary)}`);
  }
  return { release: id, shipped, left, summary: rel(summary), ship_order: remaining };
}
function releaseDrop(rest) {
  if (rest.length > 1) die(`release drop takes one version id (got "${rest.join(" ")}") \u2014 quote it if it has spaces`);
  const { id, archived, left, remaining } = dropRelease(rest[0]);
  say(`dropped release ${id} \u2014 its line is off ${rel(RELEASES)}; nothing shipped`);
  say(
    `  archived under it  ${plural3(archived.length, "card")}${archived.length ? `: ${archived.map((c) => `#${c.id}`).join(", ")}` : ""}`
  );
  say(
    `  no release         ${plural3(left.length, "card")} still open${left.length ? `: ${left.map((c) => `#${c.id}`).join(", ")}` : ""}`
  );
  say(`  ship order: ${remaining.join(" \u2192 ") || "(no releases left)"}`);
  return { release: id, archived, left, ship_order: remaining };
}
function releaseList() {
  const entries = readReleaseEntries();
  const known = entries.map((e) => e.id);
  const counts = countByRelease();
  const rows = entries.map((e) => ({ id: e.id, label: e.id, goal: e.goal, ...counts.get(e.id) || { cards: 0, ready: 0 } }));
  rows.push({ id: NO_RELEASE, label: "(no release)", goal: "", ...counts.get(NO_RELEASE) || { cards: 0, ready: 0 } });
  const width = Math.max(...rows.map((r) => r.label.length));
  if (!hasReleaseList()) {
    say(`no releases yet \u2014 \`release new v1\` makes the first one (writes ${rel(RELEASES)}).`);
  } else if (!known.length) {
    say(`no releases on the list in ${rel(RELEASES)} \u2014 \`release new v1\` adds one.`);
  } else {
    say(`releases in ${rel(RELEASES)}, in ship order:`);
  }
  for (const r of rows) {
    say(`  ${r.label.padEnd(width)}  ${plural3(r.cards, "card")}, ${r.ready} ready`);
    if (r.goal) say(`  ${" ".repeat(width)}  ${r.goal}`);
  }
  const strays = /* @__PURE__ */ new Map();
  for (const card of openCards()) {
    if (card.release === NO_RELEASE || known.includes(card.release)) continue;
    strays.set(card.release, [...strays.get(card.release) || [], card.id]);
  }
  if (strays.size) {
    say("");
    say("cards naming a release that is not on the list:");
    for (const [id, ids] of strays) {
      say(`  ${id} \u2014 ${ids.map((n) => `#${n}`).join(", ")}`);
    }
    const [first] = strays.keys();
    say(
      `  put it back with \`release new ${quoteId(first)}\`, or move the cards with \`update <id> --release <known>\``
    );
  }
  return {
    releases: rows.filter((r) => r.id !== NO_RELEASE).map((r) => ({ id: r.id, goal: r.goal, cards: r.cards, ready: r.ready })),
    no_release: { cards: counts.get(NO_RELEASE)?.cards || 0, ready: counts.get(NO_RELEASE)?.ready || 0 },
    strays: [...strays].map(([id, ids]) => ({ release: id, cards: ids }))
  };
}

// src/commands/setup.ts
init_paths();
init_io();
init_setup();
var names = () => SETUP_STEPS.map((s) => s.name).join(", ");
function sayNext() {
  const next = nextSetupStep();
  if (next) say(`  next: \`${next.name}\` (${next.owner}) \u2014 ${next.text}`);
}
function cmdSetupDone(args) {
  const name = args[0];
  if (!name) die(`setup-done needs a step name \u2014 one of: ${names()}`);
  const result = tickSetupStep(name);
  if (result.missing) {
    say(`no ${rel(SETUP_CHECKLIST)} \u2014 this board is already set up, nothing to tick`);
    return { step: name, setup_finished: true, ticked: false };
  }
  if (result.unknown) die(`no setup step called "${name}" \u2014 this board's checklist holds: ${names()}`, "unknown-setup-step");
  const answer2 = {
    step: name,
    ticked: !result.already,
    done: result.done,
    total: result.total,
    setup_finished: Boolean(result.finished),
    next: nextSetupStep()?.name ?? null
  };
  if (result.already) {
    say(`\`${name}\` was already ticked \u2014 ${result.done}/${result.total} done`);
    sayNext();
    return answer2;
  }
  if (result.finished) {
    say(`ticked \`${name}\` \u2014 ${result.done}/${result.total} done, setup finished`);
    say(`  removed ${rel(SETUP_CHECKLIST)}: a board without it is a board that is set up`);
    const card = result.questionsCard;
    if (card && card.kept) {
      say(`  questions card #${card.id} holds ${card.questions} open question${card.questions === 1 ? "" : "s"} \u2014 the user answers them through the resolve flow`);
    } else if (card) {
      say(`  removed the empty questions card #${card.id} \u2014 setup settled everything itself`);
    }
    return answer2;
  }
  say(`ticked \`${name}\` \u2014 ${result.done}/${result.total} done`);
  sayNext();
  return answer2;
}
function cmdSetupStatus() {
  const steps = readSetupChecklist();
  if (!steps) {
    say("setup is finished \u2014 this board has no checklist");
    return { setup_finished: true, steps: [] };
  }
  const done = steps.filter((s) => s.done).length;
  say(`setup is unfinished \u2014 ${done}/${steps.length} done (${rel(SETUP_CHECKLIST)})`);
  for (const s of steps) say(`  [${s.done ? "x" : " "}] ${s.name} (${s.owner}) \u2014 ${s.text}`);
  const card = findSetupQuestionsCard();
  if (card) {
    say(`  questions card: #${card.id} (${card.questions} open) \u2014 \`update-questions ${card.id} --append "[user] .."\` adds a call you can't settle`);
  }
  return {
    setup_finished: false,
    done,
    total: steps.length,
    next: nextSetupStep()?.name ?? null,
    steps,
    questions_card: card ? { id: card.id, questions: card.questions } : null
  };
}

// src/lib/board-cli.ts
var RUN = {
  init: (rest) => cmdInit(rest),
  "memory-init": (rest) => cmdMemoryInit(rest[0]),
  "setup-done": (rest) => cmdSetupDone(rest),
  "setup-status": () => cmdSetupStatus(),
  create: (rest) => cmdCreate(rest),
  update: (rest) => cmdUpdate(rest),
  "update-questions": (rest) => cmdUpdateQuestions(rest),
  tag: (rest) => cmdTag(rest),
  list: (rest) => cmdList(rest),
  release: (rest) => cmdRelease(rest),
  migrate: (rest) => cmdMigrate(rest),
  archive: (rest) => cmdRemove(Number(rest[0]), "completed"),
  reject: (rest) => cmdRemove(Number(rest[0]), "rejected"),
  "record-run": (rest) => cmdRun(Number(rest[0])),
  peek: () => {
    const id = readNextId();
    say(String(id));
    return { next_id: id };
  },
  metrics: () => {
    const csv = fs21.existsSync(METRICS) ? fs21.readFileSync(METRICS, "utf8").trim() : "";
    say(csv || "(no metrics yet)");
    return { csv };
  }
};
var READ_ONLY = /* @__PURE__ */ new Set(["list", "peek", "metrics", "setup-status"]);
var MAKES_A_BOARD = "init";
function splitShared(argv) {
  const rest = [];
  let dir = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dir") {
      dir = argv[++i] ?? null;
      if (dir === null) die("--dir needs a path after it", "bad-option");
    } else if (arg.startsWith("--dir=")) {
      dir = arg.slice("--dir=".length);
    } else if (arg === "--json") {
      json = true;
    } else {
      rest.push(arg);
    }
  }
  return { rest, dir, json };
}
var hasBoard = (dir) => fs21.existsSync(path19.join(dir, "docs", "kanban"));
function requireWholeBoard(root, move) {
  if (move === MAKES_A_BOARD) return root;
  if (!fs21.existsSync(path19.join(root, "docs", "kanban", "todo"))) {
    die(`the board in ${root} has no docs/kanban/todo/ \u2014 run \`init\` to add what is missing.`, {
      kind: "board-incomplete",
      dir: root
    });
  }
  return root;
}
function findBoardUpward(from) {
  let dir = path19.resolve(from);
  for (; ; ) {
    if (hasBoard(dir)) return dir;
    const up = path19.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
function resolveBoard(move, { dir, cwd, installHint }) {
  if (dir !== null) {
    const root = path19.resolve(dir);
    if (!fs21.existsSync(root)) die(`no such folder: ${root}`, { kind: "no-such-folder", dir: root });
    if (!hasBoard(root) && move !== MAKES_A_BOARD) {
      die(`no board in ${root} \u2014 it has no docs/kanban/. Run ${installHint} there to make one.`, {
        kind: "no-board",
        dir: root
      });
    }
    return requireWholeBoard(root, move);
  }
  const found = findBoardUpward(cwd);
  if (found) return requireWholeBoard(found, move);
  if (move === MAKES_A_BOARD) return path19.resolve(cwd);
  die(
    `no board here. Looked in ${path19.resolve(cwd)} and every folder above it for docs/kanban/. Run ${installHint} to make one, or name the project with --dir.`,
    { kind: "no-board", dir: path19.resolve(cwd) }
  );
}
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}
function nearestMove(input, names2) {
  let best = null;
  let bestDist = Infinity;
  for (const c of names2) {
    const d = editDistance(input, c);
    if (d < bestDist) [best, bestDist] = [c, d];
  }
  return best !== null && bestDist <= Math.max(2, Math.ceil(best.length / 2)) ? best : null;
}
function runBoard(argv, options = {}) {
  const {
    program = "kanban",
    style = "legacy",
    cwd = process.cwd(),
    installHint = "`npx ai4kanban install`",
    version = null,
    usage = "node kanban.mjs <command> [args]"
  } = options;
  const withMove = style === "board";
  let json = argv.includes("--json");
  let rest = [];
  let dir = null;
  try {
    ;
    ({ rest, dir, json } = splitShared(argv));
  } catch (err) {
    return report(err, { program, json });
  }
  const [raw, ...args] = rest;
  const help2 = () => style === "board" ? boardHelp(program) : legacyHelp(usage);
  if (raw === void 0 || raw === "help" || raw === "--help" || raw === "-h") {
    const wanted = args[0] && findMove(args[0]);
    if (args[0] && !wanted) return report(unknownMove(args[0]), { program, json, help: help2() });
    say(wanted && style === "board" ? moveHelp(wanted, program) : help2());
    return 0;
  }
  if (raw === "version" || raw === "--version" || raw === "-v") {
    if (!version) {
      const err = new BoardError(`\`${program}\` has no version move \u2014 \`akb version\` prints it.`, {
        kind: "unknown-move",
        move: raw
      });
      return report(err, { program, json });
    }
    say(version);
    return 0;
  }
  const found = findMove(raw);
  const move = found && RUN[found.name] ? found.name : null;
  if (!move) return report(unknownMove(raw), { program, json, help: help2() });
  const box = json ? startCollecting() : null;
  try {
    const root = resolveBoard(move, { dir, cwd, installHint });
    setBoardRoot(root);
    const invoke = () => RUN[move](args) || {};
    const data = READ_ONLY.has(move) ? invoke() : withBoardLock(invoke);
    if (json) answer({ ok: true, board: KANBAN, ...data, ...prose(box) });
    return 0;
  } catch (err) {
    return report(err, { program, json, box, move: withMove ? move : null });
  } finally {
    if (json) stopCollecting();
  }
}
var unknownMove = (raw) => {
  const guess = nearestMove(raw, MOVE_NAMES);
  return new BoardError(`unknown command "${raw}".${guess ? ` Did you mean \`${guess}\`?` : ""}`, {
    kind: "unknown-move",
    move: raw
  });
};
function prose(box) {
  if (!box) return {};
  const out = {};
  if (box.out.length) out.output = box.out.join("\n");
  if (box.warnings.length) out.warnings = box.warnings;
  return out;
}
function answer(object) {
  process.stdout.write(JSON.stringify(object) + "\n");
}
function report(err, {
  program,
  json,
  move = null,
  box = null,
  help: help2 = null
}) {
  if (!(err instanceof BoardError)) {
    if (!json) throw err;
    const bug = err;
    console.error(bug?.stack || String(err));
    answer({ ok: false, error: { kind: "crashed", message: String(bug?.message || err) }, ...prose(box) });
    return 1;
  }
  if (json) {
    answer({ ok: false, error: { kind: err.kind, message: err.message, ...err.details }, ...prose(box) });
  } else {
    console.error(err.bare ? err.message : `${[program, move].filter(Boolean).join(" ")}: ${err.message}`);
    if (help2) console.error(`
${help2}`);
  }
  return 1;
}

// src/lib/agent-cli.ts
init_paths();

// src/commands/agent.ts
init_providers();
init_resolve();
init_settings();

// src/lib/agent/test.ts
init_resolve();
import { spawn } from "node:child_process";
import { randomUUID as randomUUID2 } from "node:crypto";
var TEST_PROMPT = "Reply with OK and nothing else.";
var TIMEOUT_MS = 6e4;
var KILL_AFTER_MS = 2e3;
var OUTPUT_MAX = 8e3;
function tail(text4) {
  const out = text4.trimEnd();
  if (!out) return void 0;
  if (out.length <= OUTPUT_MAX) return out;
  return `\u2026 (earlier output not shown)
${out.slice(-OUTPUT_MAX)}`;
}
function said(events, result, stderr) {
  const lines = events.replace(/\s+$/, "");
  const final = result?.trim();
  const body = final && !lines.endsWith(final) ? `${lines}
${final}` : lines;
  return tail(
    [body, stderr].map((s) => s.replace(/\s+$/, "")).filter(Boolean).join("\n")
  );
}
function testConnection() {
  const run = openPlan(planRun(randomUUID2()));
  const startedAt = Date.now();
  const [cmd, ...args] = run.argv;
  return new Promise((resolve) => {
    let events = "";
    let stderr = "";
    let settled = false;
    let stopTimer = () => {
    };
    const done = (res) => {
      if (settled) return;
      settled = true;
      stopTimer();
      resolve({ ...res, ms: Date.now() - startedAt });
    };
    const spawnFailed = (e) => {
      if (e?.code === "ENOENT") {
        done({ ok: false, missing: cmd, install: run.install });
        return;
      }
      done({ ok: false, output: said(events, run.renderer.result(), `${stderr}
${String(e)}`) });
    };
    let child;
    try {
      child = spawn(cmd, [...args, TEST_PROMPT], {
        cwd: process.cwd(),
        env: run.env,
        shell: false,
        // Same as a run: a piped stdin makes `claude -p` wait and then warn, which would
        // land in the output as if it were the failure.
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch (e) {
      spawnFailed(e);
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const kill = setTimeout(() => child.kill("SIGKILL"), KILL_AFTER_MS);
      if (typeof kill.unref === "function") kill.unref();
      done({
        ok: false,
        timedOut: true,
        output: said(events + run.renderer.flush(), run.renderer.result(), stderr)
      });
    }, TIMEOUT_MS);
    if (typeof timer.unref === "function") timer.unref();
    stopTimer = () => clearTimeout(timer);
    child.stdout.on("data", (d) => {
      events += run.renderer.push(d.toString());
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", spawnFailed);
    child.on("close", (code) => {
      events += run.renderer.flush();
      if (code === 0) done({ ok: true });
      else done({ ok: false, output: said(events, run.renderer.result(), stderr) });
    });
  });
}

// src/commands/agent.ts
init_harnesses();
init_io();
init_paths();
init_validate();
async function cmdAgent(args) {
  const [word, ...rest] = args;
  switch (word) {
    case void 0:
    case "show":
      return showAgent();
    case "list":
      return listAgents();
    case "use":
      return useAgent(rest);
    case "set":
      return setSetting(rest);
    case "test":
      return await testAgent();
    default:
      die(`unknown agent command "${word}" \u2014 try \`akb agent\`, or one of use, set, list, test`, {
        kind: "unknown-move",
        move: word
      });
  }
}
function showAgent() {
  const info = agentInfo();
  const harness = HARNESSES.find((h) => h.name === info.name);
  say(`${harness?.label ?? info.name}${info.isDefault ? " (the default \u2014 nothing is picked)" : ""}`);
  say(`  command  ${info.command}`);
  for (const setting of harness?.settings ?? []) {
    say(`  ${setting.key.padEnd(8)} ${valueOf(setting, info.values, info.secretsSet)}${info.ignored.includes(setting.key) ? "   (not in effect \u2014 the command already names it)" : ""}`);
  }
  if (info.unknownName) {
    say("");
    say(`Your ui.config.json asks for "${info.unknownName}", which this version doesn't run.`);
    say(`The default runs instead. \`akb agent list\` says what it can run.`);
  }
  if (info.staleCommand) {
    say("");
    say(`Your ui.config.json still holds a top-level "command". Nothing reads it \u2014 each`);
    say(`agent's own block carries its command now.`);
  }
  return { agent: info };
}
function valueOf(setting, values, secretsSet) {
  if (setting.kind === "secret") return secretsSet.includes(setting.key) ? "set" : "not set";
  const value = values[setting.key];
  if (!value) return `(the agent's own default)`;
  if (setting.kind !== "provider") return value;
  const provider = setting.providers?.find((p) => p.id === value);
  return provider ? `${provider.id} \u2014 ${provider.label}` : value;
}
function listAgents() {
  const info = agentInfo();
  for (const option of info.options) {
    say(`${option.name === info.name ? "*" : " "} ${option.name.padEnd(12)} ${option.label}`);
    say(`    ${option.command}`);
    const names2 = option.settings.map((s) => s.kind === "secret" ? `${s.key} (key)` : s.key);
    if (names2.length) say(`    takes: ${names2.join(", ")}`);
  }
  say("");
  say("The one marked * is what runs. Switch with `akb agent use <name>`.");
  return { agents: info.options, picked: info.name };
}
function useAgent(args) {
  const name = args[0]?.trim();
  if (!name) die("name an agent: akb agent use claude-code", { kind: "needs-input" });
  const harness = HARNESSES.find((h) => h.name === name);
  if (!harness) {
    die(`no agent called "${name}". \`akb agent list\` says what this version runs.`, {
      kind: "unknown-agent",
      agent: name
    });
  }
  const res = setHarness(harness.name);
  if (!res.ok) die(res.error ?? "the setting could not be saved", { kind: "save-failed" });
  say(`${harness.label} now runs the board.`);
  return showAgent();
}
function setSetting(args) {
  const { flags, positional } = parseFlags(args, ["dir", "json", "value"]);
  const key = positional[0]?.trim();
  if (!key) {
    const keys = activeSettings().map((s) => s.key);
    die(`name a setting: akb agent set <${keys.join("|") || "setting"}> <value>`, { kind: "needs-input" });
  }
  const setting = activeSettings().find((s) => s.key === key);
  if (!setting) {
    const keys = activeSettings().map((s) => s.key);
    die(`the agent you run has no "${key}" setting. It takes: ${keys.join(", ") || "(none)"}`, {
      kind: "unknown-setting",
      setting: key
    });
  }
  const raw = positional.slice(1).join(" ");
  const value = (typeof flags.value === "string" ? flags.value : raw).trim();
  if (setting.kind === "secret") {
    const res2 = setSecret(setting.env, value);
    if (!res2.ok) die(res2.error ?? "the key could not be saved", { kind: "save-failed" });
    say(value ? `${setting.label} saved to docs/kanban/.env.` : `${setting.label} cleared.`);
    return { setting: key, set: Boolean(value) };
  }
  if (setting.kind === "select" && value && !setting.choices?.some((c) => c.value === value)) {
    const choices = setting.choices?.map((c) => c.value || "(empty)").join(", ");
    die(`"${value}" isn't one of the ${setting.label} choices: ${choices}`, { kind: "bad-value" });
  }
  if (setting.kind === "provider" && !value) {
    const list = providerSetting(activeSettings());
    die(`a run always goes through a provider, so this one can't be cleared. Pick one: ${list?.providers?.map((p) => p.id).join(", ") ?? ""}`, { kind: "bad-value" });
  }
  const wrong = settingSaveError(key, value);
  if (wrong) die(wrong, { kind: "bad-value" });
  const res = setHarnessSetting(key, value);
  if (!res.ok) die(res.error ?? "the setting could not be saved", { kind: "save-failed" });
  say(value ? `${setting.label} is now "${value}".` : `${setting.label} cleared \u2014 the agent's own default runs.`);
  return { setting: key, value };
}
async function testAgent() {
  const info = agentInfo();
  say(`testing ${info.command} \u2026`);
  const res = await testConnection();
  if (res.ok) {
    say(`it answered in ${(res.ms / 1e3).toFixed(1)}s. The board can run it.`);
    return { test: res };
  }
  if (res.missing) {
    say(`${res.missing} isn't installed, or isn't on this terminal's PATH.`);
    say(`Install it with: ${res.install}`);
  } else if (res.timedOut) {
    say(`no answer in ${Math.round(res.ms / 1e3)}s \u2014 it gave up.`);
  } else {
    say(`it failed.`);
  }
  if (res.output) {
    say("");
    say(res.output);
  }
  die("the agent did not answer", { kind: "test-failed", test: res });
}

// src/commands/run.ts
init_launch();
init_log();
init_sessions();
init_start();
init_types2();
init_io();
init_paths();
init_validate();
var FOLLOW_MS = 400;
function cmdStartRun(action, args) {
  const { req, follow } = readRequest(action, args);
  const started = startRun(req);
  if ("error" in started) die(started.error, { kind: "run-refused", action });
  const { run, spawned } = started;
  if (!spawned) die(`couldn't start a process to run ${run.sessionId}`, { kind: "spawn-failed" });
  say(`${action} \u2014 run ${run.sessionId}`);
  say(`  follow it: akb log ${short(run.sessionId)} --follow`);
  say(`  stop it:   akb stop ${short(run.sessionId)}`);
  if (follow) return { sessionId: run.sessionId, ...followRun(run.sessionId) };
  return { sessionId: run.sessionId, action, cardId: run.cardId };
}
var SHARED = ["follow", "dir", "json"];
function readRequest(action, args) {
  const allowed = [...SHARED, ...FLAGS[action]];
  const { flags, positional } = parseFlags(args, allowed);
  const follow = flags.follow === true;
  const text4 = (key) => {
    const value = flags[key];
    return typeof value === "string" && value.trim() ? value.trim() : void 0;
  };
  if (action === "create") {
    const description = positional.join(" ").trim() || text4("notes");
    if (!description) die('say what to create: akb create "what you want"', { kind: "needs-input" });
    return { req: { action, description, release: text4("release") }, follow };
  }
  if (action === "propose") {
    const count2 = flags.count === void 0 ? void 0 : Number(flags.count);
    if (count2 !== void 0 && (!Number.isInteger(count2) || count2 < 1 || count2 > PROPOSE_MAX)) {
      die(`--count takes a whole number from 1 to ${PROPOSE_MAX}`, { kind: "bad-option" });
    }
    const boldness = text4("boldness");
    if (boldness && !["safe", "normal", "bold"].includes(boldness)) {
      die("--boldness takes safe, normal or bold", { kind: "bad-option" });
    }
    return {
      req: { action, module: text4("module"), count: count2, boldness },
      follow
    };
  }
  if (action === "plan-release") {
    const release = positional[0]?.trim() || text4("release");
    if (!release) die("name the version to plan: akb plan-release v1", { kind: "needs-input" });
    return { req: { action, release }, follow };
  }
  const id = Number(positional[0]);
  if (!Number.isInteger(id)) die(`${action} takes a card id, e.g. \`akb ${action} 12\``, { kind: "needs-input" });
  const req = { action, id, title: titleOf(id) };
  if (action === "reject") {
    req.reason = positional.slice(1).join(" ").trim() || text4("reason");
    if (!req.reason) die('say why: akb reject 12 "the reason"', { kind: "needs-input" });
  } else if (action === "edit") {
    req.notes = positional.slice(1).join(" ").trim() || text4("notes");
    if (!req.notes) die('say what to change: akb revise 12 "what to change"', { kind: "needs-input" });
  } else {
    req.notes = positional.slice(1).join(" ").trim() || text4("notes");
  }
  if (action === "resolve" && flags["and-implement"] === true) req.andImplement = true;
  return { req, follow };
}
var FLAGS = {
  implement: ["notes"],
  run: ["notes"],
  reject: ["reason"],
  archive: ["notes"],
  edit: ["notes"],
  create: ["notes", "release"],
  propose: ["module", "count", "boldness"],
  "plan-release": ["release"],
  "auto-refine": [],
  resolve: ["notes", "and-implement"]
};
function cmdResume(args) {
  const { flags, positional } = parseFlags(args, SHARED);
  const opened = openResume(positional[0] ?? "last");
  if ("error" in opened) die(opened.error, { kind: "run-refused" });
  const { run } = opened;
  const pid = spawnWatcher(run.sessionId);
  markSpawned(run.sessionId, pid);
  if (!pid) die(`couldn't start a process to run ${run.sessionId}`, { kind: "spawn-failed" });
  say(`continuing ${short(run.resumedFrom)} \u2014 run ${run.sessionId}`);
  if (flags.follow === true) return { sessionId: run.sessionId, ...followRun(run.sessionId) };
  return { sessionId: run.sessionId, resumedFrom: run.resumedFrom };
}
function cmdStop(args) {
  const { positional } = parseFlags(args, SHARED);
  const res = stopRun(positional[0] ?? "last");
  if (!res.ok) die(res.error ?? "that run could not be stopped", { kind: "run-refused" });
  say(`stopping ${short(res.sessionId)}`);
  return { sessionId: res.sessionId };
}
function cmdRuns(args) {
  const { flags } = parseFlags(args, [...SHARED, "card", "all"]);
  let runs = listRuns();
  const card = flags.card === void 0 ? null : Number(flags.card);
  if (card !== null) {
    if (!Number.isInteger(card)) die("--card takes a card id", { kind: "bad-option" });
    runs = runs.filter((r) => r.cardId === card);
  }
  const live = runs.filter((r) => r.status === "running");
  const shown = flags.all === true ? runs : [...live, ...runs.filter((r) => r.status !== "running").slice(-10)];
  if (!shown.length) {
    say(card !== null ? `nothing has run on #${card}` : "nothing is running, and nothing has lately");
    return { runs: [] };
  }
  for (const r of shown) say(runLine(r));
  if (live.length) say("");
  say(
    live.length ? `${live.length} running. Follow one with \`akb log <id> --follow\`.` : "nothing running."
  );
  return { runs: shown };
}
function cmdLog(args) {
  const { flags, positional } = parseFlags(args, [...SHARED, "full"]);
  const id = positional[0] ?? "last";
  const view2 = getRun(id, flags.full === true ? Infinity : void 0);
  if (!view2) die(`no run here answers to "${id}"`, { kind: "no-such-run", run: id });
  if (flags.follow === true) {
    say(runLine(view2));
    return { sessionId: view2.sessionId, ...followRun(view2.sessionId, view2.tail ?? "") };
  }
  say(runLine(view2));
  say("");
  if (view2.tail) say(view2.tail);
  if (view2.result) {
    say("");
    say(view2.result);
  }
  return {
    sessionId: view2.sessionId,
    status: view2.status,
    tail: view2.tail,
    result: view2.result
  };
}
function followRun(sessionId, already = "") {
  const view2 = getRun(sessionId);
  if (!view2) return {};
  let seen = already.length;
  const drain = () => {
    const text4 = readLogTail(view2.logPath, Infinity);
    if (text4 === null) return;
    const { tail: tail2 } = splitLog(text4);
    if (tail2.length > seen) {
      process.stdout.write(tail2.slice(seen));
      seen = tail2.length;
    }
  };
  for (; ; ) {
    drain();
    const now = getRun(sessionId);
    if (!now || now.status !== "running") {
      drain();
      if (now?.result) {
        process.stdout.write("\n");
        say(now.result);
      }
      say("");
      say(runLine(now ?? view2));
      return { status: now?.status, result: now?.result };
    }
    sleep3(FOLLOW_MS);
  }
}
function sleep3(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
var MARK = {
  running: "\xB7",
  done: "\u2713",
  error: "\u2717",
  interrupted: "~",
  stopped: "\u25A0"
};
function runLine(r) {
  const what = r.cardId !== null ? `${r.action} #${r.cardId}` : r.action;
  const bits = [
    `${MARK[r.status] ?? "?"} ${short(r.sessionId)}`,
    what.padEnd(18),
    r.status === "running" ? `running ${ago(Date.now() - r.startedAt)}` : r.status
  ];
  if (r.durationMs !== void 0) bits.push(`in ${ago(r.durationMs)}`);
  if (r.model) bits.push(r.model);
  if (r.costUsd !== void 0) bits.push(`$${r.costUsd.toFixed(4)}`);
  if (r.canResume) bits.push("\u2014 continue it with `akb resume " + short(r.sessionId) + "`");
  const line2 = bits.join("  ");
  return r.input ? `${line2}
    ${firstLine(r.input)}` : line2;
}
var short = (sessionId) => sessionId.slice(0, 8);
function firstLine(text4) {
  const line2 = text4.split("\n")[0].trim();
  return line2.length > 80 ? `${line2.slice(0, 77)}\u2026` : line2;
}
function ago(ms) {
  const s = Math.round(ms / 1e3);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
async function cmdWatch(args) {
  const sessionId = args[0];
  if (!sessionId) return 1;
  const { watchRun: watchRun2 } = await Promise.resolve().then(() => (init_watch(), watch_exports));
  return watchRun2(sessionId);
}

// src/lib/agent-cli.ts
var RUNS = {
  implement: "implement",
  run: "run",
  refine: "auto-refine",
  resolve: "resolve",
  revise: "edit",
  create: "create",
  propose: "propose",
  archive: "archive",
  reject: "reject",
  "plan-release": "plan-release"
};
var OTHER = {
  runs: cmdRuns,
  log: cmdLog,
  stop: cmdStop,
  resume: cmdResume,
  agent: (args) => cmdAgent(args)
};
var NAMES = [...Object.keys(RUNS), ...Object.keys(OTHER)];
var WATCH = "__watch";
async function runAgent(argv, options = {}) {
  const { program = "akb", cwd = process.cwd(), installHint = "`akb install`" } = options;
  let json = argv.includes("--json");
  let rest = [];
  let dir = null;
  try {
    ;
    ({ rest, dir, json } = splitShared(argv));
  } catch (err) {
    return report(err, { program, json });
  }
  const [raw, ...args] = rest;
  if (raw === void 0 || raw === "help" || raw === "--help" || raw === "-h") {
    say(help(program));
    return 0;
  }
  const action = raw ? RUNS[raw] : void 0;
  const other = raw ? OTHER[raw] : void 0;
  if (!action && !other && raw !== WATCH) {
    const guess = nearestMove(raw, NAMES);
    const err = new BoardError(`unknown command "${raw}".${guess ? ` Did you mean \`${guess}\`?` : ""}`, {
      kind: "unknown-move",
      move: raw
    });
    return report(err, { program, json, help: help(program) });
  }
  let root;
  try {
    root = resolveBoard("runs", { dir, cwd, installHint });
    setBoardRoot(root);
  } catch (err) {
    return report(err, { program, json });
  }
  if (raw === WATCH) return await cmdWatch(args);
  const box = json ? startCollecting() : null;
  try {
    const data = action ? cmdStartRun(action, args) : await other(args);
    if (json) answer({ ok: true, board: KANBAN, ...data, ...prose(box) });
    return 0;
  } catch (err) {
    return report(err, { program, json, box, move: raw });
  } finally {
    if (json) stopCollecting();
  }
}
function help(program) {
  return `${program} \u2014 start a run, and steer it.

Usage: ${program} <command> [args] [options]

Runs
  implement <id> [note]     build the card
  run <id> [note]           one pass of a recurring card
  refine <id>               sharpen the card until it is ready to build
  resolve <id> [note]       answer its open questions (--and-implement carries on)
  revise <id> "<what>"      change the card to say something else
  create "<what you want>"  write the card(s) for it   (--release v1)
  propose                   write the next tasks       (--module m, --count n,
                            --boldness safe|normal|bold)
  plan-release <version>    fill a release from its goal
  archive <id>              finish the card
  reject <id> "<why>"       drop the card

The run starts and this returns \u2014 close the terminal and it keeps working. Add
--follow to any of them to watch the log instead of returning.

Runs in flight
  runs [--card <id>] [--all]   what is running, and what ran lately
  log [<run>] [--follow]       one run's log; --full for all of it
  stop [<run>]                 end a run
  resume [<run>]               continue one that failed or was cut off

A <run> is a run's id, any prefix of one that names only one run, or \`last\`.
Left out, it means the newest run.

The agent that runs them
  agent                        what runs, and how it is set up
  agent list                   the agents it can run, and what each one takes
  agent use <name>             pick one
  agent set <key> [value]      a setting or a key; no value clears it
  agent test                   one small chat, to see the setup works

Options \u2014 any command takes these
  --dir <path>   the project to work on. Default: the nearest board at or above
                 the folder you ran in
  --json         answer as one JSON object instead of prose

\`${program} board help\` is the board's own bookkeeping \u2014 the commands an agent calls
between runs. You never have to type one.`;
}

// src/version.ts
var SKILL_VERSION = "0.5.1";

// src/kanban.ts
init_sessions();
init_launch();
init_prompts();
init_resolve();
init_settings();
init_paths();

// src/lib/view/api.ts
init_io();
init_lock();
init_setup();
init_releases();
init_validate();

// src/lib/view/edit.ts
init_paths();
init_cadence();
init_cards();
init_frontmatter();
init_readme();
init_releases();
init_recurring();
init_validate();
import fs25 from "node:fs";
import path22 from "node:path";
function patchCard(id, patch2) {
  if (!Number.isInteger(id)) die("a card is edited by its number", "bad-id");
  const found = locate(id);
  if (!found) die(`no open card #${id}`, { kind: "card-not-found", id });
  const file = found.kind === "group" ? path22.join(found.target, "root.md") : found.target;
  const { meta, body } = parseFrontmatter(fs25.readFileSync(file, "utf8"));
  if (!meta) die(`${rel(file)} has no frontmatter \u2014 run \`migrate\` first`, { kind: "no-frontmatter", id });
  let titleChanged = false;
  if (patch2.title !== void 0) {
    const t = patch2.title.trim();
    if (!t) die("the title must not be empty");
    if (t !== meta.title) titleChanged = true;
    meta.title = t;
  }
  for (const field of ["priority", "roi"]) {
    const value = patch2[field];
    if (value === void 0) continue;
    if (!LEVELS.includes(value)) die(`${field} must be one of ${LEVELS.join(" | ")}`);
    meta[field] = value;
  }
  if (patch2.release !== void 0) meta.release = validRelease(normalizeRelease(patch2.release));
  if (patch2.cadence !== void 0) {
    if (path22.relative(TODO, file).split(path22.sep)[0] !== RECURRING) {
      die(`#${id} is not a recurring card \u2014 only a card that repeats can have a cadence`, { kind: "not-recurring", id });
    }
    const text4 = patch2.cadence.trim();
    const parsed = text4 ? parseCadence(text4) : null;
    if (text4 && !parsed) die(`"${text4}" isn't a cadence. Accepted: ${CADENCE_FORMS}`);
    meta.cadence = parsed ? formatCadence(parsed) : "";
  }
  const newBody = patch2.body !== void 0 ? patch2.body : body;
  const normalized = newBody.replace(/^\n+/, "").replace(/\s+$/, "");
  fs25.writeFileSync(file, serializeFrontmatter(meta) + "\n\n" + normalized + "\n");
  if (patch2.release !== void 0 && found.kind === "group") setSubtreeRelease(found.target, meta.release);
  if (titleChanged) {
    const relFromTodo = path22.relative(TODO, file);
    repointReadmeLink(id, relFromTodo, relFromTodo, meta.title);
  }
}

// src/lib/view/api.ts
init_goal();

// src/lib/view/first-run.ts
init_paths();
init_goal();
import fs26 from "node:fs";
import path23 from "node:path";
var TRACK_RE = /^[a-z0-9][a-z0-9-]*$/i;
var RESERVED = ["blockers", "recurring"];
var DEFAULT_NOTES = {
  feature: "new behavior a user can see.",
  features: "new behavior a user can see.",
  bug: "something that is broken.",
  bugs: "something that is broken.",
  research: "questions to answer before the work can be planned."
};
function readConfig() {
  try {
    return fs26.readFileSync(CONFIG, "utf8");
  } catch {
    return "";
  }
}
var unanswered = (value) => !value || /\{\{[A-Z_]+\}\}/.test(value);
function bulletBlock(lines, label) {
  const start = lines.findIndex((l) => l.startsWith(`- **${label}**`));
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++;
  return { start, end };
}
function readProject() {
  const fallback = { name: path23.basename(REPO_ROOT), description: "" };
  const lines = readConfig().split("\n");
  const block2 = bulletBlock(lines, "Project");
  if (!block2) return fallback;
  const value = lines[block2.start].replace(/^- \*\*Project\*\*[ \t]*—[ \t]*/, "").trim();
  if (unanswered(value)) return fallback;
  const at = value.indexOf(":");
  if (at === -1) return { name: value, description: "" };
  return { name: value.slice(0, at).trim(), description: value.slice(at + 1).trim() };
}
function readmeHeadings() {
  try {
    return fs26.readFileSync(README, "utf8").split("\n").map((l) => l.match(/^##\s+(.+?)\s*$/)).filter((m) => Boolean(m)).map((m) => m[1]);
  } catch {
    return [];
  }
}
function trackFolders2() {
  let entries;
  try {
    entries = fs26.readdirSync(TODO, { withFileTypes: true });
  } catch {
    return [];
  }
  const folders = entries.filter((e) => e.isDirectory() && !RESERVED.includes(e.name)).filter((e) => !fs26.existsSync(path23.join(TODO, e.name, "root.md"))).map((e) => e.name);
  const order = readmeHeadings();
  return [...folders].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
  });
}
function readTrackNotes() {
  const lines = readConfig().split("\n");
  const block2 = bulletBlock(lines, "Tracks");
  const notes = {};
  if (!block2) return notes;
  for (const line2 of lines.slice(block2.start + 1, block2.end)) {
    const m = line2.match(/^\s+-\s+`([^`]+)`(?:\s+\d+%)?\s*(?:—\s*(.*?))?\s*$/);
    if (m) notes[m[1]] = (m[2] || "").trim();
  }
  return notes;
}
function readTracks() {
  const notes = readTrackNotes();
  return trackFolders2().map((name) => ({
    name,
    note: notes[name] ?? DEFAULT_NOTES[name] ?? "",
    was: name
  }));
}
function holdsCard(dir) {
  let entries;
  try {
    entries = fs26.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (holdsCard(path23.join(dir, entry.name))) return true;
    } else if (entry.name.endsWith(".md")) {
      return true;
    }
  }
  return false;
}
var isEmptyTrack = (name) => !holdsCard(path23.join(TODO, name));
var usedTracks = () => trackFolders2().filter((name) => !isEmptyTrack(name));
function readSetupDraft() {
  return { project: readProject(), tracks: readTracks(), usedTracks: usedTracks(), goal: readGoalText() };
}
function readModules() {
  let text4;
  try {
    text4 = fs26.readFileSync(MODULES_MD, "utf8");
  } catch {
    return [];
  }
  const names2 = [];
  for (const line2 of text4.split("\n")) {
    const m = line2.match(/^\s*-\s+\*\*(.+?)\*\*/);
    if (m) names2.push(m[1].trim());
  }
  return names2;
}
function saveProject(name, description, tracks) {
  const project = name.trim();
  if (!project) die("the project needs a name");
  const clean = [];
  const seen = /* @__PURE__ */ new Set();
  for (const track of tracks) {
    const id = track.name.trim().toLowerCase();
    if (!id) continue;
    if (!TRACK_RE.test(id)) {
      die(`"${track.name}" can't be a track \u2014 a track is a folder, so use letters, digits and dashes`);
    }
    if (RESERVED.includes(id)) die(`"${id}" is the board's own folder, not a track you can name`);
    if (seen.has(id)) die(`"${id}" is listed twice`);
    seen.add(id);
    clean.push({ name: id, note: track.note.trim(), was: track.was });
  }
  if (clean.length === 0) die("a board needs at least one track");
  const added = [];
  const renamed = [];
  const keptBecauseUsed = [];
  for (const track of clean) {
    const from = track.was;
    if (from && from !== track.name && fs26.existsSync(path23.join(TODO, from))) {
      if (fs26.existsSync(path23.join(TODO, track.name))) {
        die(`there is already a "${track.name}" track to move "${from}" onto`);
      }
      renameTrack(from, track.name);
      renamed.push({ from, to: track.name });
      continue;
    }
    const dir = path23.join(TODO, track.name);
    if (!fs26.existsSync(dir)) {
      fs26.mkdirSync(dir, { recursive: true });
      added.push(track.name);
    }
    addReadmeSection(track.name);
  }
  for (const gone of trackFolders2().filter((t) => !seen.has(t))) {
    if (!isEmptyTrack(gone)) {
      keptBecauseUsed.push(gone);
      continue;
    }
    fs26.rmSync(path23.join(TODO, gone), { recursive: true, force: true });
    dropReadmeSection(gone);
  }
  const notes = readTrackNotes();
  const written = [...clean, ...keptBecauseUsed.map((name2) => ({ name: name2, note: notes[name2] ?? "" }))];
  writeConfigBullets(project, description.trim(), written);
  return { ok: true, added, renamed, keptBecauseUsed };
}
function cardFiles(dir) {
  let entries;
  try {
    entries = fs26.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap(
    (entry) => entry.isDirectory() ? cardFiles(path23.join(dir, entry.name)) : entry.name.endsWith(".md") ? [path23.join(dir, entry.name)] : []
  );
}
function renameTrack(from, to) {
  fs26.renameSync(path23.join(TODO, from), path23.join(TODO, to));
  for (const file of cardFiles(path23.join(TODO, to))) {
    const text4 = fs26.readFileSync(file, "utf8");
    const next = text4.replace(/^track:[ \t]*.*$/m, `track: ${to}`);
    if (next !== text4) fs26.writeFileSync(file, next);
  }
  if (!fs26.existsSync(README)) return;
  const lines = fs26.readFileSync(README, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase() === `## ${from}`.toLowerCase()) lines[i] = `## ${to}`;
    else lines[i] = lines[i].split(`](${from}/`).join(`](${to}/`);
  }
  fs26.writeFileSync(README, lines.join("\n"));
}
var CONFIG_HEADER = `# Configuration

This file adapts ai4kanban to your project. The board app writes the project and its
tracks; the rest is filled in from your repo on setup's \`config\` step.

`;
function writeConfigBullets(name, description, tracks) {
  const existing = fs26.existsSync(CONFIG) ? fs26.readFileSync(CONFIG, "utf8") : CONFIG_HEADER;
  let lines = existing.split("\n");
  lines = replaceBullet(lines, "Project", [`- **Project** \u2014 ${description ? `${name}: ${description}` : name}`]);
  lines = replaceBullet(lines, "Tracks", [
    "- **Tracks** \u2014 the buckets a task can live in:",
    ...tracks.map((t) => `  - \`${t.name}\`${t.note ? ` \u2014 ${t.note}` : ""}`)
  ]);
  fs26.mkdirSync(path23.dirname(CONFIG), { recursive: true });
  fs26.writeFileSync(CONFIG, lines.join("\n"));
}
function replaceBullet(lines, label, replacement) {
  const block2 = bulletBlock(lines, label);
  const out = [...lines];
  if (!block2) {
    while (out.length && out[out.length - 1].trim() === "") out.pop();
    out.push(...replacement, "");
    return out;
  }
  out.splice(block2.start, block2.end - block2.start, ...replacement);
  return out;
}
function addReadmeSection(track) {
  if (!fs26.existsSync(README)) return;
  const lines = fs26.readFileSync(README, "utf8").split("\n");
  if (lines.some((l) => l.trim().toLowerCase() === `## ${track}`.toLowerCase())) return;
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  lines.push("", `## ${track}`, "", "_(none)_", "");
  fs26.writeFileSync(README, lines.join("\n"));
}
function dropReadmeSection(track) {
  if (!fs26.existsSync(README)) return;
  const lines = fs26.readFileSync(README, "utf8").split("\n");
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${track}`.toLowerCase());
  if (start === -1) return;
  let end = start + 1;
  while (end < lines.length && !/^##\s/.test(lines[end])) end++;
  if (lines.slice(start + 1, end).some((l) => /^\s*-\s/.test(l))) return;
  lines.splice(start, end - start);
  fs26.writeFileSync(README, lines.join("\n"));
}

// src/lib/view/api.ts
init_read();

// src/lib/view/metrics.ts
init_paths();
init_types();
import fs27 from "node:fs";
var DATE = "date";
var COUNTS = ["completed", "created", "rejected"];
function utcDay(offset) {
  const d = /* @__PURE__ */ new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
function count(cell) {
  const n = Number((cell ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}
function blankDays() {
  const days = /* @__PURE__ */ new Map();
  for (let i = METRICS_WINDOW_DAYS - 1; i >= 0; i--) {
    const date = utcDay(-i);
    days.set(date, { date, completed: 0, created: 0, rejected: 0 });
  }
  return days;
}
function view(days, empty) {
  const list = [...days.values()];
  const totals = { completed: 0, created: 0, rejected: 0 };
  for (const day of list) for (const c of COUNTS) totals[c] += day[c];
  return { ok: true, view: { days: list, totals, empty } };
}
function readMetricsView() {
  let text4;
  try {
    text4 = fs27.readFileSync(METRICS, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return view(blankDays(), true);
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not read ${METRICS} \u2014 ${why}` };
  }
  const rows = text4.trim().split("\n").filter(Boolean);
  if (rows.length === 0) return { ok: false, error: `${METRICS} is empty \u2014 it has no header row.` };
  const header = rows[0].split(",").map((h) => h.trim().toLowerCase());
  const at = {};
  const missing = [];
  for (const name of [DATE, ...COUNTS]) {
    const i = header.indexOf(name);
    if (i < 0) missing.push(name);
    else if (name !== DATE) at[name] = i;
  }
  if (missing.length > 0) {
    return {
      ok: false,
      error: `${METRICS} does not name its ${missing.join(", ")} column${missing.length > 1 ? "s" : ""} in the header row \u2014 the numbers can't be read without guessing which is which.`
    };
  }
  const dateAt = header.indexOf(DATE);
  const days = blankDays();
  const body = rows.slice(1);
  for (const line2 of body) {
    const cells = line2.split(",");
    const day = days.get((cells[dateAt] ?? "").trim());
    if (!day) continue;
    for (const c of COUNTS) day[c] += count(cells[at[c]]);
  }
  return view(days, body.length === 0);
}

// src/lib/view/api.ts
init_goal();

// src/lib/view/dispatch.ts
init_cadence();
init_sessions();
init_read();
init_rules();
function newestRuns(runs) {
  const newest = /* @__PURE__ */ new Map();
  for (const r of runs) {
    if (r.cardId === null || r.action !== "run") continue;
    const best = newest.get(r.cardId);
    if (!best || r.startedAt > best.startedAt) newest.set(r.cardId, r);
  }
  return newest;
}
function dueRecurring(cards, runs, busy) {
  const newest = newestRuns(runs);
  const now = Date.now();
  return cards.filter((card) => {
    if (!card.recurring || busy.has(card.id)) return false;
    const due = nextDue(card.last_run, card.cadence);
    if (!due || due.getTime() > now) return false;
    const last = newest.get(card.id);
    return !last || last.startedAt < due.getTime();
  }).sort(byDispatchOrder);
}
function nextWork() {
  let runs;
  let cards;
  try {
    runs = listRuns();
    cards = readBoard().columns.flatMap((c) => c.cards);
  } catch {
    return [];
  }
  const busy = /* @__PURE__ */ new Set();
  for (const r of runs) if (r.status === "running" && r.cardId !== null) busy.add(r.cardId);
  if (runs.some((r) => r.status === "running" && r.action === "run")) return [];
  const card = dueRecurring(cards, runs, busy)[0];
  return card ? [{ action: "run", id: card.id, title: card.title }] : [];
}

// src/lib/view/api.ts
init_releases();
function write(fn) {
  try {
    return { ok: true, ...quietly(() => withBoardLock(fn)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
function read(fn, fallback) {
  try {
    return quietly(fn);
  } catch {
    return fallback;
  }
}
function patchCard2(id, patch2) {
  return write(() => {
    patchCard(id, patch2);
    return {};
  });
}
function setCardsRelease(ids, release) {
  const target = normalizeRelease(release);
  if (target !== NO_RELEASE) {
    const known = read(readReleases, []);
    if (!known.includes(target)) {
      return {
        moved: 0,
        failed: [],
        error: `unknown release "${target}" \u2014 releases on the list: ${known.join(", ") || "(none)"}.`
      };
    }
  }
  const failed = [];
  let moved = 0;
  for (const id of ids) {
    const res = patchCard2(id, { release: target });
    if (res.ok) moved += 1;
    else failed.push({ id, error: res.error || "could not be moved" });
  }
  return { moved, failed };
}
var planCard = (card) => ({ id: card.id, title: card.title });
function fillPlan() {
  return read(
    () => {
      const { fill, skipped } = fillCandidates();
      return { fill: fill.map(planCard), skipped: skipped.map((c) => ({ ...planCard(c), reason: c.reason })) };
    },
    { fill: [], skipped: [] }
  );
}
function closePlan(id) {
  return read(
    () => {
      const { archived, left } = endingCards(id);
      return { left: left.map((c) => ({ ...planCard(c), done: c.done })), shipped: archived.length };
    },
    { left: [], shipped: 0 }
  );
}
function dropPlan(id) {
  return read(
    () => {
      const { archived, left } = endingCards(id);
      return { archived: archived.map(planCard), left: left.map(planCard) };
    },
    { archived: [], left: [] }
  );
}
function newRelease(id, goal = "", fill = false) {
  return write(() => {
    const made = addRelease(id, goal);
    if (!fill) return { fill: "none" };
    if (foldGoal(goal)) return { fill: "agent" };
    fillRelease(made);
    return { fill: "fill" };
  });
}
function setReleaseGoal2(id, goal) {
  return write(() => {
    setReleaseGoal(id.trim(), goal);
    return {};
  });
}
function closeRelease2(id) {
  return write(() => {
    closeRelease(id.trim());
    return {};
  });
}
function dropRelease2(id) {
  return write(() => {
    dropRelease(id.trim());
    return {};
  });
}
function saveGoal(text4) {
  if (typeof text4 !== "string" || !text4.trim()) return { ok: false, error: "the goal must not be empty" };
  return write(() => {
    writeGoalText(text4);
    tickSetupStep("goal");
    return {};
  });
}
function saveProject2(name, description, tracks) {
  return write(() => saveProject(name, description, tracks));
}
function finishSetupStep(name) {
  return write(() => {
    tickSetupStep(name);
    return {};
  });
}

// src/kanban.ts
var SELF2 = fileURLToPath3(import.meta.url);
function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fs28.realpathSync(entry) === fs28.realpathSync(SELF2);
  } catch {
    return false;
  }
}
if (invokedDirectly()) {
  const argv = process.argv.slice(2);
  if (argv[0] === "__watch") {
    void runAgent(argv, { program: "akb" }).then((code) => {
      process.exitCode = code;
    });
  } else {
    process.exitCode = runBoard(argv, {
      program: "kanban",
      style: "legacy",
      version: `ai4kanban ${SKILL_VERSION}`,
      usage: `node ${rel(SELF2)} <command> [args]`
    });
  }
}
export {
  SKILL_VERSION,
  activeSettings,
  agentInfo,
  allCards,
  buildPrompt,
  closePlan,
  closeRelease2 as closeRelease,
  dropPlan,
  dropRelease2 as dropRelease,
  fillPlan,
  findCard,
  finishSetupStep,
  getRun,
  listRuns,
  markSpawned,
  newRelease,
  nextWork,
  openResume,
  openRun,
  patchCard2 as patchCard,
  readBoard,
  readGoalText,
  readMetricsView,
  readModules,
  readReleases,
  readSetupDraft,
  readSetupState,
  runAgent,
  runBoard,
  saveGoal,
  saveProject2 as saveProject,
  setBoardRoot,
  setCardsRelease,
  setHarness,
  setHarnessSetting,
  setReleaseGoal2 as setReleaseGoal,
  setSecret,
  settingSaveError,
  setupInstruction,
  spawnWatcher,
  stopRun,
  testConnection,
  titleOf
};
