// The little the app remembers between launches, in one JSON file under the
// user's app-data folder.
//
// It is deliberately almost nothing: the projects the user has opened, which of
// them was open last, and the version of an update they said "later" to. The
// projects list lives here rather than in any repo because it spans repos — a
// list of projects cannot belong to one of them, and it is nobody's business but
// this machine's. Nothing about a board itself is kept here; the markdown files
// in `docs/kanban/` stay the single source of truth.

import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

/** A remembered project: where it is, and when it was last opened. */
export interface StoredProject {
  path: string;
  openedAt: number;
}

// The file is the user's — hand-editable, and sometimes hand-edited into
// nonsense — so nothing read out of it is trusted until it has been checked.
// `unknown` is that rule written down rather than remembered.
type Settings = Record<string, unknown>;

// How many projects the list keeps. Long enough that going back to something
// from last month is still a click, short enough that the list stays a list.
const KEEP_PROJECTS = 20;

function file(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function read(): Settings {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(file(), "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Settings) : {};
  } catch {
    // No file yet, or one somebody hand-edited into nonsense. Either way the
    // app opens as if it were the first time, which is a fine place to be.
    return {};
  }
}

function write(patch: Settings): Settings {
  const next = { ...read(), ...patch };
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), `${JSON.stringify(next, null, 2)}\n`);
  } catch {
    // A settings file we can't write costs the user one folder pick next
    // launch. Not worth an error in their face.
  }
  return next;
}

/** The projects the user has opened, newest first. The saved shape is trusted no
 *  further than this — a hand-edited file gives back whatever entries still read
 *  as a folder path. Folders that have since been moved or deleted are KEPT: the
 *  list says so on the line and offers to remove it, which beats a project
 *  quietly disappearing (see projects.ts). */
export function projects(): StoredProject[] {
  const raw = read().projects;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: StoredProject[] = [];
  for (const entry of raw as unknown[]) {
    const at = entry as { path?: unknown; openedAt?: unknown } | null;
    const dir = typeof entry === "string" ? entry : at?.path;
    if (typeof dir !== "string" || !dir || seen.has(dir)) continue;
    seen.add(dir);
    out.push({ path: dir, openedAt: Number(at?.openedAt) || 0 });
  }
  return out.sort((a, b) => b.openedAt - a.openedAt);
}

/** The repo the app last opened, or null when there isn't one any more — a
 *  remembered folder that has since been moved or deleted counts as none, so
 *  the app asks again instead of opening a window onto nothing. */
export function lastRepo(): string | null {
  const dir = read().repo;
  if (typeof dir !== "string" || !dir) return null;
  try {
    return fs.statSync(dir).isDirectory() ? dir : null;
  } catch {
    return null;
  }
}

/** Record that this folder is the one open now: it goes to the top of the list
 *  and becomes what the next launch reopens. */
export function rememberRepo(dir: string): void {
  const rest = projects().filter((p) => p.path !== dir);
  const next = [{ path: dir, openedAt: Date.now() }, ...rest].slice(0, KEEP_PROJECTS);
  write({ repo: dir, projects: next });
}

/** Forget which project was open, keeping the list. Closing a project is the
 *  user saying they are done with it, and the next launch honours that by
 *  starting on the launcher rather than back where they left. */
export function clearRepo(): void {
  if (read().repo) write({ repo: null });
}

/** Take a project off the list. Nothing on disk is touched — the folder, its
 *  board and its history are all exactly where they were, and opening it again
 *  puts it straight back on the list. */
export function forgetProject(dir: string): void {
  const next = projects().filter((p) => p.path !== dir);
  const patch: Settings = { projects: next };
  // Don't reopen a project the user just took off the list.
  if (read().repo === dir) patch.repo = next[0]?.path ?? null;
  write(patch);
}

/** Has the app already offered to put `akb` on the PATH? The offer is made once, at the
 *  first launch that finds no command — after that the button in the Setup group is where it
 *  lives, and declining costs nothing. Someone updating from an app that never offered it
 *  has nothing written here, so they get the offer too. */
export function commandOffered(): boolean {
  return read().commandOffered === true;
}

export function rememberCommandOffer(): void {
  write({ commandOffered: true });
}

/** The one case that earns a second ask: a command that was installed and has since stopped
 *  working, because the app it points at was moved or deleted. Asked once per breakage —
 *  a launch that finds `akb` working again clears it, so a later breakage asks afresh. */
export function commandBreakAsked(): boolean {
  return read().commandBreakAsked === true;
}

export function rememberCommandBreak(): void {
  write({ commandBreakAsked: true });
}

export function clearCommandBreak(): void {
  if (read().commandBreakAsked) write({ commandBreakAsked: false });
}

/** The newest version the user has already been told about and waved off. */
export function skippedVersion(): string | null {
  const v = read().skippedVersion;
  return typeof v === "string" ? v : null;
}

export function skipVersion(version: string): void {
  write({ skippedVersion: version });
}

/** Forget it. Asking to install a version un-waves it, so the notice can show
 *  the download that is now going (#372). */
export function unskipVersion(): void {
  if (read().skippedVersion) write({ skippedVersion: null });
}
