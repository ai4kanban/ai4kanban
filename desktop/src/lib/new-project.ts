// Making the folder a new project starts as (#546).
//
// The launcher's form answers two things — a name and the folder it goes in — and
// everything after that happens here: the name is checked against what a folder may be
// called, the folder is made, and `git init` runs in it. Nothing is written until every
// check has passed, and an existing folder is never opened, written into or replaced: the
// user is told to pick another name instead.
//
// The board is NOT installed here. `main.ts` hands the finished folder to `open()`, which
// installs a board in any folder that has none — the same path Open folder takes.

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { copy } from "./copy";
import type { Env } from "./shell-env";

// A repository in an empty folder is a handful of files. Anything longer than this is a
// `git` that is not coming back.
const TIMEOUT_MS = 30_000;

/** Characters no system takes in a name. */
const CONTROL = /[\u0000-\u001f]/;
/** Windows refuses these outright, and drops a trailing dot or space rather than keeping
 *  it — a folder that is not the one the user named. */
const WINDOWS_REFUSES = /[<>:"|?*]/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** The folder is made and open; `git` is what may still have failed, said plainly. */
export type NewProject =
  | { ok: true; dir: string; noGit: string | null }
  | { ok: false; error: string };

/** Why this cannot be one folder's name, or null when it can. */
function nameProblem(name: string): string | null {
  const c = copy().project;
  if (!name) return c.nameNeeded;
  if (name.includes("/") || name.includes("\\")) return c.nameNotOneFolder;
  if (name === "." || name === ".." || CONTROL.test(name)) return c.nameNotAllowed;
  if (process.platform === "win32") {
    if (WINDOWS_REFUSES.test(name) || WINDOWS_RESERVED.test(name)) return c.nameNotAllowed;
    if (name.endsWith(".") || name.endsWith(" ")) return c.nameNotAllowed;
  }
  return null;
}

function reason(e: unknown): string {
  return String(e instanceof Error ? e.message : e).trim();
}

/** Start a repository in `dir`. Answers with the sentence to show when there is none —
 *  a machine with no `git` still keeps its folder, its board and its open project. */
function initGit(dir: string, env: Env): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("git", ["init"], { cwd: dir, timeout: TIMEOUT_MS, env }, (err, _out, stderr) => {
      if (!err) return resolve(null);
      resolve(copy().project.noGit.detail(String(stderr || err.message).trim()));
    });
  });
}

/** Make `name` inside `parent` and start a repository in it. Every refusal is a finished
 *  sentence for the form, and none of them has written anything. */
export async function createProject(name: string, parent: string, env: Env): Promise<NewProject> {
  const c = copy().project;
  const named = name.trim();
  const problem = nameProblem(named);
  if (problem) return { ok: false, error: problem };
  if (!parent || !fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    return { ok: false, error: c.locationNeeded };
  }
  const dir = path.join(parent, named);
  if (fs.existsSync(dir)) return { ok: false, error: c.exists(dir) };
  try {
    // Not recursive, so a folder that appeared between the check above and this line is
    // an error rather than a folder we open onto somebody else's files.
    fs.mkdirSync(dir);
  } catch (e) {
    return { ok: false, error: c.failed(reason(e)) };
  }
  return { ok: true, dir, noGit: await initGit(dir, env) };
}
